---
inclusion: manual
---

# SigNoz Local Development Environment

Official local development setup per the SigNoz contributing guide.
Source: `docs/contributing/development.md` and https://signoz.io/docs/contributing/

## Prerequisites — Install Once

Run these commands to install all required tools:

```bash
# 1. Make (build automation)
sudo apt install make

# 2. Go 1.25.x (backend) — check go.mod line 3 for exact version
sudo snap install go --channel=1.25/stable --classic

# 3. pnpm 10.x (frontend package manager) — REQUIRED, npm won't work
npm install -g pnpm@10

# 4. Docker + Docker Compose (already installed)
docker compose version  # verify
```

Verify:
```bash
make --version && go version && pnpm --version && node --version && docker compose version
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser → http://localhost:3301 (Frontend)     │
│                       │                          │
│                       ▼                          │
│  Go Backend → http://localhost:8080 (API)       │
│                       │                          │
│                       ▼                          │
│  ClickHouse → localhost:9000 (TCP) / 8123 (HTTP)│
│  ZooKeeper → localhost:2181                     │
│                                                  │
│  OTel Collector → localhost:4317 (gRPC)         │
│                 → localhost:4318 (HTTP)          │
└─────────────────────────────────────────────────┘
```

## Setup Steps (from repo root: ~/repo/SigNoz/signoz)

### 1. Start ClickHouse + ZooKeeper + Schema Migrator

```bash
make devenv-clickhouse
```

Or manually:
```bash
cd .devenv/docker/clickhouse && docker compose -f compose.yaml up -d
```

Wait for healthy: `curl http://localhost:8123/ping` → "Ok."

### 2. Start OTel Collector

```bash
make devenv-signoz-otel-collector
```

Or manually:
```bash
cd .devenv/docker/signoz-otel-collector && docker compose -f compose.yaml up -d
```

Verify: `curl http://localhost:13133` → health check OK

### 3. Start both infra at once (shortcut)

```bash
make devenv-up
```

### 4. Start Go Backend

```bash
make go-run-community
```

Or manually:
```bash
SIGNOZ_INSTRUMENTATION_LOGS_LEVEL=debug \
SIGNOZ_SQLSTORE_SQLITE_PATH=signoz.db \
SIGNOZ_WEB_ENABLED=false \
SIGNOZ_TOKENIZER_JWT_SECRET=secret \
SIGNOZ_ALERTMANAGER_PROVIDER=signoz \
SIGNOZ_TELEMETRYSTORE_PROVIDER=clickhouse \
SIGNOZ_TELEMETRYSTORE_CLICKHOUSE_DSN=tcp://127.0.0.1:9000 \
SIGNOZ_TELEMETRYSTORE_CLICKHOUSE_CLUSTER=cluster \
go run -race ./cmd/community/main.go ./cmd/community/server.go ./cmd/community/metastore.go server
```

Verify: `curl http://localhost:8080/api/v1/health` → `{"status":"ok"}`

### 5. Start Frontend Dev Server

```bash
cd frontend
pnpm install
```

Create `frontend/.env`:
```env
VITE_FRONTEND_API_ENDPOINT=http://localhost:8080
```

Then:
```bash
pnpm dev
```

Frontend is at: **http://localhost:3301**

## Verify Everything

```bash
curl http://localhost:8123/ping          # ClickHouse → "Ok."
curl http://localhost:13133              # OTel Collector → health
curl http://localhost:8080/api/v1/health # Backend → {"status":"ok"}
# Frontend → open http://localhost:3301 in browser
```

## Send Test Data

```bash
# OTLP gRPC: localhost:4317
# OTLP HTTP: localhost:4318
```

## Key Notes

- The frontend uses **pnpm** (not npm/npx). The `preinstall` script enforces this. `npx vite` works as a workaround but `pnpm dev` is the official way.
- `pnpm dev` runs Vite on port **3301** (not 3302). This is the official port.
- The backend uses SQLite by default for local dev (`signoz.db` in the repo root).
- ClickHouse data is stored in `.devenv/docker/clickhouse/fs/tmp/`.
- To clean ClickHouse data: `make devenv-clickhouse-clean`
- The type checker (vite-plugin-checker) runs separately from Vite's transform pipeline. Type errors appear as warnings but don't block the dev server.
- To disable the type checker overlay in the browser, set `overlay: false` in `vite.config.ts` under `vitePluginChecker`.
- First-time `go run` with `-race` takes 3-5 minutes to compile all dependencies. Subsequent runs are fast.

## Stopping Everything

```bash
# Stop frontend: Ctrl+C in that terminal
# Stop backend: Ctrl+C in that terminal
# Stop Docker infra:
cd .devenv/docker/signoz-otel-collector && docker compose down
cd .devenv/docker/clickhouse && docker compose down
```

## Common Issues

| Issue | Solution |
|-------|----------|
| `pnpm: command not found` | `npm install -g pnpm@10` |
| `make: command not found` | `sudo apt install make` |
| Go version mismatch | Check `go.mod` line 3 for required version |
| ClickHouse ZooKeeper permission denied | `sudo chmod -R 777 .devenv/docker/clickhouse/fs/tmp/zookeeper` |
| Port 9000 not accessible | Ensure the devenv clickhouse compose is used (not the old Docker SigNoz) |
| styled-components "children" type errors | Pre-existing in `main` branch, doesn't block runtime |
