#!/bin/bash

set -e

echo "========================================"
echo "  证书轮换API系统 - 自检脚本"
echo "========================================"
echo ""

echo "[1/5] 检查Go环境..."
if ! command -v go &> /dev/null; then
    echo "❌ Go未安装"
    exit 1
fi
echo "✅ Go版本: $(go version)"
echo ""

echo "[2/5] 下载依赖..."
cd "$(dirname "$0")/.."
go mod tidy
echo "✅ 依赖下载完成"
echo ""

echo "[3/5] 编译检查..."
go build -o /dev/null .
echo "✅ 编译成功"
echo ""

echo "[4/5] 运行单元测试..."
go test -v ./service/... -count=1
echo ""
echo "✅ 测试完成"
echo ""

echo "[5/5] 启动服务健康检查..."
echo "正在启动服务..."
DB_PATH=:memory: PORT=8081 go run . &
PID=$!

sleep 3

if curl -s http://localhost:8081/health | grep -q "ok"; then
    echo "✅ 服务健康检查通过"
else
    echo "❌ 服务健康检查失败"
fi

kill $PID 2>/dev/null || true

echo ""
echo "========================================"
echo "  自检完成！"
echo "========================================"
echo ""
echo "API端点清单:"
echo "  POST   /api/v1/rotations              - 创建证书轮换"
echo "  GET    /api/v1/rotations              - 查询轮换列表"
echo "  GET    /api/v1/rotations/:id          - 查询单个轮换详情"
echo "  POST   /api/v1/rotations/:id/start-parallel - 启动并行验证"
echo "  POST   /api/v1/rotations/:id/samples  - 记录验证样本"
echo "  GET    /api/v1/rotations/:id/samples  - 查询验证样本"
echo "  POST   /api/v1/rotations/:id/advance-status - 推进状态"
echo "  POST   /api/v1/rotations/:id/exception - 异常处理"
echo "  POST   /api/v1/rotations/:id/manual-fix - 人工修正"
echo "  POST   /api/v1/rotations/:id/generate-report - 生成报告"
echo "  GET    /api/v1/rotations/:id/export-report - 导出报告"
echo "  GET    /api/v1/rotations/:id/reports  - 查询报告列表"
echo "  POST   /api/v1/rotations/:id/complete-switch - 完成切换"
echo ""
