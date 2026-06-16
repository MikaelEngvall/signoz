#!/bin/bash
# =============================================================================
# SigNoz Local Development Stack
# =============================================================================
# Follows the official development guide: docs/contributing/development.md
#
# Prerequisites (install once):
#   sudo apt install make
#   sudo snap install go --channel=1.25/stable --classic
#   npm install -g pnpm@10
#   Docker + Docker Compose
#   Node.js 22+
#
# Usage:
#   ./start-local-dev.sh        # Start everything
#   ./start-local-dev.sh stop   # Stop everything
#   ./start-local-dev.sh status # Check what's running
#
# After starting:
#   Frontend:    http://localhost:3301
#   Backend API: http://localhost:8080
#   OTel gRPC:   localhost:4317
#   OTel HTTP:   localhost:4318
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Check prerequisites ────────────────────────────────────────────────────
check_prerequisites() {
    local missing=()
    command -v go >/dev/null 2>&1 || missing+=("go (sudo snap install go --channel=1.25/stable --classic)")
    command -v pnpm >/dev/null 2>&1 || missing+=("pnpm (npm install -g pnpm@10)")
    command -v make >/dev/null 2>&1 || missing+=("make (sudo apt install make)")
    command -v docker >/dev/null 2>&1 || missing+=("docker")
    command -v node >/dev/null 2>&1 || missing+=("node 22+")

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}Missing prerequisites:${NC}"
        for tool in "${missing[@]}"; do
            echo -e "  ✗ $tool"
        done
        exit 1
    fi
}

# ─── Stop all services ──────────────────────────────────────────────────────
stop_all() {
    echo -e "${YELLOW}Stopping all services...${NC}"

    # Stop frontend (pnpm dev runs vite on port 3301)
    pkill -f "vite.*3301" 2>/dev/null || true
    pkill -f "vite.*3302" 2>/dev/null || true

    # Stop Go backend
    pkill -f "signoz.*server" 2>/dev/null || true
    pkill -f "go-build.*community" 2>/dev/null || true

    # Stop Docker devenv services
    cd "$SCRIPT_DIR/.devenv/docker/signoz-otel-collector" && docker compose -f compose.yaml down 2>/dev/null || true
    cd "$SCRIPT_DIR/.devenv/docker/clickhouse" && docker compose -f compose.yaml down 2>/dev/null || true

    # Also stop old Docker SigNoz if running
    docker stop signoz-signoz signoz-otel-collector signoz-clickhouse signoz-zookeeper signoz-telemetrystore-migrator 2>/dev/null || true
    docker compose -f ~/epos-fresh-start-backup/signoz/docker-compose.yaml down 2>/dev/null || true

    echo -e "${GREEN}All services stopped.${NC}"
}

# ─── Status check ───────────────────────────────────────────────────────────
status_check() {
    echo -e "${BLUE}=== SigNoz Local Dev Status ===${NC}"
    echo ""

    # ClickHouse
    if curl -s http://localhost:8123/ping 2>/dev/null | grep -q "Ok"; then
        echo -e "  ${GREEN}✓${NC} ClickHouse         localhost:8123, localhost:9000"
    else
        echo -e "  ${RED}✗${NC} ClickHouse         not running"
    fi

    # OTel Collector
    if curl -s http://localhost:13133/ >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} OTel Collector     localhost:4317 (gRPC), localhost:4318 (HTTP)"
    else
        echo -e "  ${RED}✗${NC} OTel Collector     not running"
    fi

    # Go Backend
    if curl -s http://localhost:8080/api/v1/health >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Go Backend         http://localhost:8080"
    else
        echo -e "  ${RED}✗${NC} Go Backend         not running"
    fi

    # Frontend
    if curl -s http://localhost:3301/ >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Frontend           http://localhost:3301"
    else
        echo -e "  ${RED}✗${NC} Frontend           not running"
    fi

    # WARP routing
    if ip rule show 2>/dev/null | grep -q "from 172.18.0.0/16 lookup 65743"; then
        echo -e "  ${GREEN}✓${NC} WARP routing       k3d → Ericsson internal via CloudflareWARP"
    elif ip link show CloudflareWARP &>/dev/null; then
        echo -e "  ${RED}✗${NC} WARP routing       NOT configured (run start-local-dev.sh to fix)"
    fi

    echo ""
}

# ─── Main: start everything ─────────────────────────────────────────────────
if [ "${1:-}" = "stop" ]; then
    stop_all
    exit 0
fi

if [ "${1:-}" = "status" ]; then
    status_check
    exit 0
fi

check_prerequisites

echo -e "${BLUE}=== Starting SigNoz Local Dev Stack ===${NC}"
echo -e "${BLUE}    (per docs/contributing/development.md)${NC}"
echo ""

# Stop anything that might conflict
stop_all 2>/dev/null || true
sleep 2

# ─── Fix k3d → Cloudflare WARP VPN routing ──────────────────────────────────
# Docker containers (k3d pods) can't reach Ericsson internal services unless
# their traffic is routed through the WARP tunnel (table 65743).
fix_warp_routing() {
    local WARP_TABLE=65743
    local K3D_NETWORK="172.18.0.0/16"
    local DOCKER_BRIDGE="172.17.0.0/16"
    local WARP_IFACE="CloudflareWARP"

    # Only apply if WARP interface exists
    if ! ip link show "$WARP_IFACE" &>/dev/null; then
        return 0
    fi

    echo -e "${YELLOW}[0/4] Fixing WARP VPN routing for Docker/k3d...${NC}"

    # Add ip rule so k3d traffic uses WARP routing table
    if ! ip rule show | grep -q "from ${K3D_NETWORK} lookup ${WARP_TABLE}"; then
        sudo ip rule add from ${K3D_NETWORK} lookup ${WARP_TABLE} priority 32764 2>/dev/null || true
    fi

    # MASQUERADE rules for Docker → WARP
    sudo iptables -t nat -C POSTROUTING -s ${K3D_NETWORK} -o ${WARP_IFACE} -j MASQUERADE 2>/dev/null || \
        sudo iptables -t nat -A POSTROUTING -s ${K3D_NETWORK} -o ${WARP_IFACE} -j MASQUERADE 2>/dev/null || true
    sudo iptables -t nat -C POSTROUTING -s ${DOCKER_BRIDGE} -o ${WARP_IFACE} -j MASQUERADE 2>/dev/null || \
        sudo iptables -t nat -A POSTROUTING -s ${DOCKER_BRIDGE} -o ${WARP_IFACE} -j MASQUERADE 2>/dev/null || true

    echo -e "${GREEN}  ✓ WARP routing rules applied (k3d pods can reach Ericsson internal services)${NC}"
}

fix_warp_routing

# ─── 1. Start ClickHouse + ZooKeeper ────────────────────────────────────────
echo -e "${YELLOW}[1/4] Starting ClickHouse (make devenv-clickhouse)...${NC}"
cd "$SCRIPT_DIR"
make devenv-clickhouse

echo "  Waiting for ClickHouse to be healthy..."
timeout 120 bash -c 'until curl -s http://localhost:8123/ping 2>/dev/null | grep -q "Ok"; do sleep 2; done' || {
    echo -e "${RED}  ✗ ClickHouse failed to start${NC}"
    exit 1
}
echo -e "${GREEN}  ✓ ClickHouse healthy${NC}"

# ─── 2. Start OTel Collector ────────────────────────────────────────────────
echo -e "${YELLOW}[2/4] Starting OTel Collector (make devenv-signoz-otel-collector)...${NC}"
cd "$SCRIPT_DIR"
make devenv-signoz-otel-collector
echo -e "${GREEN}  ✓ OTel Collector started (ports 4317, 4318)${NC}"

# ─── 3. Start Go Backend ────────────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Starting Go Backend (go run community with root user)...${NC}"
echo -e "       ${BLUE}(First run compiles ~3 min, subsequent runs are fast)${NC}"
cd "$SCRIPT_DIR"
SIGNOZ_INSTRUMENTATION_LOGS_LEVEL=debug \
SIGNOZ_SQLSTORE_SQLITE_PATH=signoz.db \
SIGNOZ_WEB_ENABLED=false \
SIGNOZ_TOKENIZER_JWT_SECRET=secret \
SIGNOZ_ALERTMANAGER_PROVIDER=signoz \
SIGNOZ_TELEMETRYSTORE_PROVIDER=clickhouse \
SIGNOZ_TELEMETRYSTORE_CLICKHOUSE_DSN=tcp://127.0.0.1:9000 \
SIGNOZ_TELEMETRYSTORE_CLICKHOUSE_CLUSTER=cluster \
SIGNOZ_USER_ROOT_ENABLED=true \
SIGNOZ_USER_ROOT_EMAIL=admin@test.com \
SIGNOZ_USER_ROOT_PASSWORD='Admin123!"#_' \
SIGNOZ_USER_ROOT_ORG_NAME=default \
go run -race ./cmd/community/*.go server &
GO_PID=$!

echo "  Waiting for backend to start (PID: $GO_PID)..."
timeout 300 bash -c 'until curl -s http://localhost:8080/api/v1/health >/dev/null 2>&1; do sleep 3; done' || {
    echo -e "${RED}  ✗ Go backend failed to start (timeout after 5 min)${NC}"
    echo "  Check if Go compilation failed. Try running manually:"
    echo "    make go-run-community"
    exit 1
}
echo -e "${GREEN}  ✓ Go Backend ready (http://localhost:8080)${NC}"

# ─── 4. Start Frontend ──────────────────────────────────────────────────────
echo -e "${YELLOW}[4/4] Starting Frontend (pnpm dev)...${NC}"
cd "$FRONTEND_DIR"

# Ensure .env exists
if [ ! -f .env ]; then
    echo 'VITE_FRONTEND_API_ENDPOINT=http://localhost:8080' > .env
    echo "  Created .env with VITE_FRONTEND_API_ENDPOINT=http://localhost:8080"
fi

# Install deps if needed
if [ ! -d node_modules ]; then
    echo "  Installing dependencies (pnpm install)..."
    pnpm install
fi

pnpm dev &
VITE_PID=$!
sleep 4
echo -e "${GREEN}  ✓ Frontend ready (http://localhost:3301)${NC}"

# ─── Done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  All services running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "  Frontend:        http://localhost:3301"
echo "  Backend API:     http://localhost:8080"
echo "  OTel gRPC:       localhost:4317"
echo "  OTel HTTP:       localhost:4318"
echo "  ClickHouse:      localhost:9000 (TCP), localhost:8123 (HTTP)"
echo ""
echo "  State Timeline Demo:  http://localhost:3301/state-timeline-demo"
echo ""
echo "  To stop:    ./start-local-dev.sh stop"
echo "  To check:   ./start-local-dev.sh status"
echo ""
echo -e "  ${YELLOW}Tip: Register a user at the login page on first run.${NC}"
echo ""

# Wait for background processes
wait
