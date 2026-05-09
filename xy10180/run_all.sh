#!/bin/bash

set -e

echo "=============================================="
echo "  设备保养计划 API - 完整运行脚本"
echo "=============================================="

cd "$(dirname "$0")"

if [ -f "./maintenance.db" ]; then
    echo "清理旧数据库..."
    rm -f ./maintenance.db
fi

if [ ! -d "./venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "安装依赖..."
pip install -q -r requirements.txt

echo ""
echo "=============================================="
echo "  步骤 1/3: 启动 API 服务"
echo "=============================================="
echo ""

LOG_FILE="./server.log"
rm -f "$LOG_FILE"

nohup python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "服务器 PID: $SERVER_PID"
echo "日志文件: $LOG_FILE"
echo ""

echo "等待服务器启动..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
        echo "服务器已就绪!"
        break
    fi
    sleep 1
done

echo ""
echo "=============================================="
echo "  步骤 2/3: 运行接口验证测试"
echo "=============================================="
echo ""

python3 test_api.py
TEST_RESULT=$?

echo ""
echo "=============================================="
echo "  步骤 3/3: 停止服务"
echo "=============================================="
echo ""

echo "停止服务器 (PID: $SERVER_PID)..."
kill $SERVER_PID 2>/dev/null || true

echo ""
echo "=============================================="
echo "  运行完成"
echo "=============================================="

if [ $TEST_RESULT -eq 0 ]; then
    echo "  ✓ 所有测试通过!"
    echo ""
    echo "  访问 API 文档: http://127.0.0.1:8000/docs"
    echo ""
    exit 0
else
    echo "  ✗ 测试失败!"
    echo ""
    echo "  服务器日志:"
    cat "$LOG_FILE"
    exit 1
fi
