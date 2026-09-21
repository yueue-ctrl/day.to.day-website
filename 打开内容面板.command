#!/bin/zsh
cd "$(dirname "$0")"
node tools/content-server.js &
DTD_SERVER_PID=$!
trap 'kill "$DTD_SERVER_PID" 2>/dev/null' EXIT INT TERM
sleep 1
open "http://127.0.0.1:4173/admin.html"
wait "$DTD_SERVER_PID"
