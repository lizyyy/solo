#!/bin/bash
set -e

echo "=== 园区访客通行验收回放链路服务 ==="
echo ""

echo "1. 下载依赖..."
go mod tidy

echo ""
echo "2. 编译项目..."
go build -o visitor-pass .

echo ""
echo "3. 初始化数据库..."
./visitor-pass init

echo ""
echo "4. 启动API服务 (后台运行)..."
./visitor-pass serve &
SERVER_PID=$!
echo "服务PID: $SERVER_PID"

echo ""
echo "等待服务启动..."
sleep 3

echo ""
echo "5. 运行测试数据演示..."
./visitor-pass gendata || true

echo ""
echo "=== 测试完成 ==="
echo ""
echo "API服务仍在运行，访问 http://localhost:8080"
echo "停止服务: kill $SERVER_PID"
echo ""
echo "按 Ctrl+C 退出"
wait
