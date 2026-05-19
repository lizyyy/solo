#!/bin/bash

echo "=== 农机计费系统测试脚本 ==="

BASE_URL="http://localhost:3000"

echo ""
echo "1. 检查服务健康状态..."
curl -s "$BASE_URL/api/health"
echo ""

echo ""
echo "2. 导入作业单 CSV（含错误数据）..."
curl -s -X POST -F "file=@samples/work_orders.csv" "$BASE_URL/api/import/work-orders"
echo ""

echo ""
echo "3. 查看导入批次..."
curl -s "$BASE_URL/api/batches"
echo ""

echo ""
echo "4. 查看正常记录（作业单）..."
curl -s "$BASE_URL/api/work-orders"
echo ""

echo ""
echo "5. 查看错误记录（重点验证错误分流）..."
curl -s "$BASE_URL/api/error-records"
echo ""

echo ""
echo "=== 测试完成 ==="
echo ""
echo "提示："
echo "- 上面第4步显示的是正常通过验证的记录"
echo "- 上面第5步显示的是所有错误记录，包含错误原因和修改建议"
echo "- 每条错误记录都保留了原始行号、原始数据、错误类型和修改建议"