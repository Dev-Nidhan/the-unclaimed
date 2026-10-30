#!/bin/sh
set -eu

ollama serve &
ollama_pid=$!

stop_ollama() {
  kill "$ollama_pid" 2>/dev/null || true
  wait "$ollama_pid" 2>/dev/null || true
}
trap stop_ollama INT TERM

attempt=0
until ollama list >/dev/null 2>&1; do
  if ! kill -0 "$ollama_pid" 2>/dev/null; then
    echo "Ollama exited before its API became ready." >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 180 ]; then
    echo "Ollama API did not become ready within 180 seconds." >&2
    exit 1
  fi
  sleep 1
done

ollama pull "${OLLAMA_MODEL:-gemma3:4b}"
exec /usr/local/bin/ollama-gateway
