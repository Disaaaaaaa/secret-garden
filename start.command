#!/bin/bash
# The Secret Garden — double-click to start (macOS)
cd "$(dirname "$0")"
PORT=8080
echo "The Secret Garden is running at http://localhost:$PORT"
echo "Close this window to stop."
( sleep 1; open "http://localhost:$PORT" ) &
python3 -m http.server $PORT
