#!/bin/bash

echo "=== 定时任务漏跑恢复API 启动脚本 ==="

echo "1. 编译项目..."
go build -o task-recovery-api

if [ $? -ne 0 ]; then
    echo "编译失败！"
    exit 1
fi

echo "2. 启动服务..."
./task-recovery-api &
PID=$!

echo "3. 等待服务启动..."
sleep 3

echo "4. 创建样例数据..."
cd scripts
go run sample_data.go
cd ..

echo ""
echo "=== 服务已启动成功 ==="
echo "服务PID: $PID"
echo "API地址: http://localhost:8080"
echo ""
echo "常用命令："
echo "  健康检查: curl http://localhost:8080/health"
echo "  查询任务: curl http://localhost:8080/api/v1/tasks"
echo ""
echo "停止服务: kill $PID"
