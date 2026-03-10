#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"
LOG_DIR="$ROOT_DIR/.logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PORT_server=8080
PORT_web=3001

get_port() {
  case "$1" in
    server) echo "$PORT_server" ;;
    web)    echo "$PORT_web" ;;
  esac
}

is_running() {
  local name=$1
  local pidfile="$PID_DIR/$name.pid"
  if [[ -f "$pidfile" ]]; then
    local pid
    pid=$(<"$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pidfile"
  fi
  return 1
}

get_pid() {
  local name=$1
  local pidfile="$PID_DIR/$name.pid"
  if [[ -f "$pidfile" ]]; then
    cat "$pidfile"
  fi
}

start_server() {
  if is_running server; then
    echo -e "${YELLOW}server${NC} already running (PID $(get_pid server))"
    return
  fi
  echo -e "${CYAN}Starting${NC} todo-server..."
  cd "$ROOT_DIR/todo-server"
  go build -o "$ROOT_DIR/.pids/server-bin" . 2>"$LOG_DIR/server.log"
  "$ROOT_DIR/.pids/server-bin" >> "$LOG_DIR/server.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/server.pid"
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    echo -e "${GREEN}server${NC} started (PID $pid) → http://localhost:${PORT_server}"
  else
    echo -e "${RED}server${NC} failed to start. Check $LOG_DIR/server.log"
    rm -f "$PID_DIR/server.pid"
    return 1
  fi
}

start_web() {
  if is_running web; then
    echo -e "${YELLOW}web${NC} already running (PID $(get_pid web))"
    return
  fi
  echo -e "${CYAN}Starting${NC} todo-web..."
  cd "$ROOT_DIR/todo-web"
  if [[ ! -d "node_modules" ]]; then
    echo -e "${CYAN}Installing${NC} dependencies..."
    npm install >> "$LOG_DIR/web.log" 2>&1
  fi
  npx vite > "$LOG_DIR/web.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_DIR/web.pid"
  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    echo -e "${GREEN}web${NC} started (PID $pid) → http://localhost:${PORT_web}"
  else
    echo -e "${RED}web${NC} failed to start. Check $LOG_DIR/web.log"
    rm -f "$PID_DIR/web.pid"
    return 1
  fi
}

stop_one() {
  local name=$1
  if is_running "$name"; then
    local pid
    pid=$(get_pid "$name")
    # Kill process tree (go run spawns a child process)
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    rm -f "$PID_DIR/$name.pid"
    echo -e "${RED}Stopped${NC} $name (PID $pid)"
  else
    echo -e "${YELLOW}$name${NC} not running"
  fi
}

status_all() {
  echo -e "${BOLD}Service        Status         PID      URL${NC}"
  echo "─────────────────────────────────────────────────────"
  for name in server web; do
    if is_running "$name"; then
      local pid
      pid=$(get_pid "$name")
      printf "%-14s ${GREEN}%-14s${NC} %-8s %s\n" "$name" "running" "$pid" "http://localhost:$(get_port "$name")"
    else
      printf "%-14s ${RED}%-14s${NC} %-8s %s\n" "$name" "stopped" "-" "-"
    fi
  done
}

logs_one() {
  local name=$1
  local logfile="$LOG_DIR/$name.log"
  if [[ -f "$logfile" ]]; then
    tail -f "$logfile"
  else
    echo "No log file for $name"
  fi
}

usage() {
  echo -e "${BOLD}Usage:${NC} $0 <command> [service]"
  echo ""
  echo -e "${BOLD}Commands:${NC}"
  echo "  start [service]   Start all services or a specific one (server|web)"
  echo "  stop [service]    Stop all services or a specific one"
  echo "  restart [service] Restart all services or a specific one"
  echo "  status            Show status of all services"
  echo "  logs <service>    Tail logs for a service"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  $0 start          Start all servers"
  echo "  $0 stop web       Stop only the web server"
  echo "  $0 restart server Restart the API server"
  echo "  $0 logs server    Follow server logs"
}

cmd="${1:-}"
target="${2:-}"

case "$cmd" in
  start)
    case "$target" in
      server) start_server ;;
      web)    start_web ;;
      "")     start_server; start_web ;;
      *)      echo "Unknown service: $target"; exit 1 ;;
    esac
    ;;
  stop)
    case "$target" in
      server|web) stop_one "$target" ;;
      "")         stop_one server; stop_one web ;;
      *)          echo "Unknown service: $target"; exit 1 ;;
    esac
    ;;
  restart)
    case "$target" in
      server) stop_one server; start_server ;;
      web)    stop_one web; start_web ;;
      "")     stop_one server; stop_one web; start_server; start_web ;;
      *)      echo "Unknown service: $target"; exit 1 ;;
    esac
    ;;
  status|st)
    status_all
    ;;
  logs|log)
    if [[ -z "$target" ]]; then
      echo "Usage: $0 logs <server|web>"
      exit 1
    fi
    logs_one "$target"
    ;;
  *)
    usage
    ;;
esac
