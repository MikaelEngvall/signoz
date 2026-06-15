#!/bin/bash
# =============================================================================
# Run EPOS monitoring.jar — Push metrics to local SigNoz
# =============================================================================
# This script runs the monitoring JAR from ~/repo/epos in the background,
# pushing cicd_pipeline_test_verdict metrics to the local SigNoz OTel collector.
#
# It runs as a background process (nohup) so it persists even if you leave
# the workspace.
#
# Usage:
#   ./run-monitoring-pusher.sh          # Start the pusher
#   ./run-monitoring-pusher.sh stop     # Stop it
#   ./run-monitoring-pusher.sh status   # Check if running
#
# Prerequisites:
#   - Java 11+ installed
#   - Local SigNoz stack running (OTel collector on localhost:4318)
#   - monitoring.jar at ~/repo/epos/monitoring.jar
# =============================================================================

JAR_PATH="$HOME/repo/epos/monitoring.jar"
PID_FILE="/tmp/epos-monitoring-pusher.pid"
LOG_FILE="/tmp/epos-monitoring-pusher.log"

# SigNoz local OTel collector endpoint
SIGNOZ_ENDPOINT="http://localhost:4318/v1/metrics"

stop_pusher() {
    if [[ -f "$PID_FILE" ]]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            echo "Stopped monitoring pusher (PID: $PID)"
        else
            echo "Process $PID not running (stale PID file)"
        fi
        rm -f "$PID_FILE"
    else
        echo "No PID file found. Trying to find process..."
        pkill -f "monitoring.jar.*enableSignozPush" 2>/dev/null && echo "Killed" || echo "Not running"
    fi
}

status_pusher() {
    if [[ -f "$PID_FILE" ]]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            echo "✓ Running (PID: $PID)"
            echo "  Log: $LOG_FILE"
            echo "  Last 3 lines:"
            tail -3 "$LOG_FILE" 2>/dev/null | sed 's/^/    /'
            return 0
        else
            echo "✗ Not running (stale PID file)"
            rm -f "$PID_FILE"
            return 1
        fi
    else
        echo "✗ Not running"
        return 1
    fi
}

case "${1:-start}" in
    stop)
        stop_pusher
        exit 0
        ;;
    status)
        status_pusher
        exit $?
        ;;
esac

# Preflight checks
if [[ ! -f "$JAR_PATH" ]]; then
    echo "ERROR: monitoring.jar not found at $JAR_PATH"
    exit 1
fi

if ! command -v java &>/dev/null; then
    echo "ERROR: java not found in PATH"
    exit 1
fi

if ! curl -s http://localhost:4318/v1/metrics >/dev/null 2>&1; then
    echo "WARNING: OTel collector not responding at localhost:4318"
    echo "         Make sure SigNoz local dev is running first."
fi

# Stop existing instance
stop_pusher 2>/dev/null

echo "Starting EPOS monitoring pusher..."
echo "  JAR: $JAR_PATH"
echo "  Endpoint: $SIGNOZ_ENDPOINT"
echo "  Log: $LOG_FILE"

# Run in background with nohup so it persists after terminal close
nohup java \
    -DenablePrometheusPush=false \
    -DenableSignozPush=true \
    -DsignozOtlpEndpoint="$SIGNOZ_ENDPOINT" \
    -DsignozEnvironment=local-dev \
    -jar "$JAR_PATH" \
    > "$LOG_FILE" 2>&1 &

echo $! > "$PID_FILE"
PID=$(cat "$PID_FILE")
echo "  PID: $PID"
echo ""
echo "Monitoring pusher started in background."
echo "  Check status: ./run-monitoring-pusher.sh status"
echo "  Stop:         ./run-monitoring-pusher.sh stop"
echo "  View logs:    tail -f $LOG_FILE"
