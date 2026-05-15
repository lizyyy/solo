#!/bin/bash

cd "$(dirname "$0")"

echo "Starting frontend server on port 8080..."
echo "Access: http://localhost:8080/index.html"
python3 -m http.server 8080
