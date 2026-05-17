#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "======================================"
echo "  停止数据库服务"
echo "======================================"
echo ""

docker-compose stop

echo ""
echo "✅ 服务已停止"
echo ""
