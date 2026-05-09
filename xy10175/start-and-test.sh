#!/bin/bash

set -e

echo "========================================"
echo "   冷链温控追溯 API - 一键启动验证"
echo "========================================"

if [ ! -d "node_modules" ]; then
    echo ""
    echo "[1/4] 安装项目依赖..."
    npm install
else
    echo ""
    echo "[1/4] 依赖已存在，跳过安装"
fi

echo ""
echo "[2/4] 初始化数据库..."
if [ -f "data/cold_chain.db" ]; then
    echo "数据库已存在，删除旧数据重新初始化..."
    rm -f data/cold_chain.db
fi
npm run init-db

echo ""
echo "[3/4] 启动 API 服务..."
node src/index.js &
SERVER_PID=$!
echo "服务 PID: $SERVER_PID"

echo ""
echo "[4/4] 等待服务启动并运行接口验证..."
sleep 2

npm run test -- --wait

TEST_EXIT_CODE=$?

echo ""
echo "========================================"
echo "   验证完成"
echo "========================================"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ 所有接口验证通过！"
    echo ""
    echo "服务正在运行，您可以通过以下地址访问："
    echo "  - 根路径:   http://localhost:8080/"
    echo "  - 健康检查: http://localhost:8080/health"
    echo ""
    echo "API 端点："
    echo "  - POST /api/temperature/events        - 单条温度事件导入"
    echo "  - POST /api/temperature/events/batch  - 批量温度事件导入"
    echo "  - GET  /api/trace/order/:orderNumber  - 按订单查询"
    echo "  - GET  /api/trace/box/:boxNumber      - 按箱号查询"
    echo "  - GET  /api/trace/shift/:shiftName    - 按班次查询"
    echo "  - GET  /api/trace/time-range          - 按时间范围查询"
    echo "  - GET  /api/trace/statistics          - 查询统计数据"
    echo "  - GET  /api/trace/events/:id          - 查询事件详情"
    echo ""
    echo "按 Ctrl+C 停止服务"
    wait $SERVER_PID
else
    echo ""
    echo "❌ 部分验证失败，请查看上方日志"
    echo "正在停止服务..."
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi
