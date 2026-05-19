#!/bin/bash
cd "$(dirname "$0")"

echo "Killing old processes..."
pkill -9 -f "ts-node src/index" 2>/dev/null
sleep 2

echo "Starting server with new code..."
npx ts-node src/index.ts > /dev/null 2>&1 &
SERVER_PID=$!
sleep 5

echo ""
echo "=== 1. Header 不存在 (预期 401 未授权) ==="
curl -s http://localhost:3001/api/replay/api/user

echo ""
echo "=== 2. Header 存在但值为空 (预期 401 未授权) ==="
curl -s -H "Authorization: " http://localhost:3001/api/replay/api/user

echo ""
echo "=== 3. Header 存在且有值 (预期 200 成功) ==="
curl -s -H "Authorization: Bearer token" http://localhost:3001/api/replay/api/user

echo ""
echo ""
echo "Server PID: $SERVER_PID"
echo "You can kill it with: kill $SERVER_PID"
