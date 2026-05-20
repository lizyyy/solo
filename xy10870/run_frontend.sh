#!/bin/bash

cd "$(dirname "$0")"

echo "启动前端静态服务器..."
echo "访问地址: http://localhost:3000"
echo ""

cd frontend && python3 -m http.server 3000
