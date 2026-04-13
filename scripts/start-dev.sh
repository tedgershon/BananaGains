#!/usr/bin/env bash
# Start frontend + backend for local testing (run from YOUR machine / WSL terminal).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p .dev

kill_on_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill -9 ${pids} 2>/dev/null || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
}

PY="${ROOT}/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "Missing ${PY}. Create it with:"
  echo "  cd ${ROOT} && python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

kill_on_port 3000
kill_on_port 8000
sleep 0.5

rm -f "${ROOT}/frontend/.next/dev/lock"

echo "Starting backend on 0.0.0.0:8000 ..."
(
  cd "${ROOT}/backend"
  exec "$PY" -m uvicorn main:app --host 0.0.0.0 --port 8000
) > "${ROOT}/.dev/backend.log" 2>&1 &
echo $! > "${ROOT}/.dev/backend.pid"

echo "Starting frontend on 0.0.0.0:3000 ..."
(
  cd "${ROOT}/frontend"
  npm run dev -- --hostname 0.0.0.0 --port 3000
) > "${ROOT}/.dev/frontend.log" 2>&1 &
echo $! > "${ROOT}/.dev/frontend.pid"

sleep 2
if ! kill -0 "$(cat "${ROOT}/.dev/backend.pid")" 2>/dev/null; then
  echo "Backend exited immediately. Last log lines:"
  tail -n 30 "${ROOT}/.dev/backend.log"
  exit 1
fi
if ! kill -0 "$(cat "${ROOT}/.dev/frontend.pid")" 2>/dev/null; then
  echo "Frontend exited immediately. Last log lines:"
  tail -n 30 "${ROOT}/.dev/frontend.log"
  exit 1
fi

echo ""
echo "Both servers are running."
echo "  Frontend: http://127.0.0.1:3000   (Windows browser: try http://localhost:3000)"
echo "  Backend:  http://127.0.0.1:8000"
echo "  Logs:     ${ROOT}/.dev/frontend.log  ${ROOT}/.dev/backend.log"
echo "  Stop:     npm run dev:stop"
echo ""
