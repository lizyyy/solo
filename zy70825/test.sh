#!/bin/bash

echo "=== MCN 样品管理系统测试 ==="
echo ""

echo "1. 安装依赖..."
npm install

echo ""
echo "2. 启动服务器（后台）..."
nohup npm run dev > server.log 2>&1 &
SERVER_PID=$!
sleep 3

echo ""
echo "3. 导入达人档案..."
curl -X POST http://localhost:3000/api/upload/influencers \
  -F "jsonFile=@examples/influencers.json"
echo ""

echo ""
echo "4. 导入寄送单CSV..."
curl -X POST http://localhost:3000/api/upload/shipments \
  -F "csvFile=@examples/shipments.csv"
echo ""

echo ""
echo "5. 查询处理结果..."
curl http://localhost:3000/api/results
echo ""

echo ""
echo "6. 查询批次列表..."
curl http://localhost:3000/api/batches
echo ""

echo ""
echo "=== 测试完成 ==="
echo "服务器PID: $SERVER_PID"
echo "查看日志: tail -f server.log"
echo "停止服务器: kill $SERVER_PID"
