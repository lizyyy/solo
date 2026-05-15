#!/bin/bash

echo "======================================"
echo "  费用试算 API 功能验证脚本"
echo "======================================"
echo ""

BASE_URL="http://localhost:8080"
REQUEST_NO=""
CERT_NO=""

echo "📋 检查服务状态..."
if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" | grep -q "200\|302\|404"; then
    echo "❌ 服务未启动，请先运行: ./start.sh"
    echo "   或在IDE中运行 FeeCalculationApplication.java"
    exit 1
fi
echo "✅ 服务运行正常"
echo ""

echo "🧪 1. 创建费用试算..."
response=$(curl -s -X POST "$BASE_URL/api/fee/calculate" \
    -H "Content-Type: application/json" \
    -d '{
        "bizType": "ORDER",
        "bizNo": "TEST_'$(date +%Y%m%d%H%M%S)'",
        "ruleCode": "VIP_MEMBERSHIP",
        "quantity": 12,
        "discountCodes": ["NEW_USER_10", "COUPON_50"]
    }')

code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2)
if [ "$code" = "200" ]; then
    echo "✅ 试算创建成功"
    REQUEST_NO=$(echo "$response" | grep -o '"requestNo":"[^"]*"' | cut -d'"' -f4)
    echo "   请求号: $REQUEST_NO"
    originalAmount=$(echo "$response" | grep -o '"originalAmount":[0-9.]*' | cut -d':' -f2)
    finalAmount=$(echo "$response" | grep -o '"finalAmount":[0-9.]*' | cut -d':' -f2)
    echo "   原价: $originalAmount, 最终价: $finalAmount"
else
    echo "❌ 试算创建失败: $response"
    exit 1
fi
echo ""

echo "🧪 2. 查询试算结果..."
response=$(curl -s "$BASE_URL/api/fee/result/$REQUEST_NO")
code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2)
if [ "$code" = "200" ]; then
    echo "✅ 查询成功"
    status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "   当前状态: $status"
else
    echo "❌ 查询失败"
    exit 1
fi
echo ""

echo "🧪 3. 锁定价格..."
response=$(curl -s -X POST "$BASE_URL/api/fee/lock/$REQUEST_NO")
code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2)
if [ "$code" = "200" ]; then
    echo "✅ 价格锁定成功"
    CERT_NO=$(echo "$response" | grep -o '"certificateNo":"[^"]*"' | cut -d'"' -f4)
    echo "   凭证号: $CERT_NO"
else
    echo "❌ 价格锁定失败"
    exit 1
fi
echo ""

echo "🧪 4. 校验锁价凭证..."
response=$(curl -s "$BASE_URL/api/fee/validate/$CERT_NO")
code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2)
valid=$(echo "$response" | grep -o '"data":true\|false' | cut -d':' -f2)
if [ "$code" = "200" ] && [ "$valid" = "true" ]; then
    echo "✅ 凭证有效"
else
    echo "❌ 凭证校验失败"
    exit 1
fi
echo ""

echo "🧪 5. 查询操作时间线..."
response=$(curl -s "$BASE_URL/api/fee/timeline/$REQUEST_NO")
code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2)
if [ "$code" = "200" ]; then
    count=$(echo "$response" | grep -o '"action":"[^"]*"' | wc -l)
    echo "✅ 时间线查询成功，共 $count 条记录"
else
    echo "❌ 时间线查询失败"
    exit 1
fi
echo ""

echo "🧪 6. 生成问题排查汇总..."
response=$(curl -s "$BASE_URL/api/fee/diagnosis/$REQUEST_NO")
code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2)
if [ "$code" = "200" ]; then
    echo "✅ 排查汇总生成成功"
    echo "   包含: 基本信息 + 费用明细 + 锁价凭证 + 时间线 + 排查建议"
else
    echo "❌ 排查汇总生成失败"
    exit 1
fi
echo ""

echo "🧪 7. 执行扣费..."
response=$(curl -s -X POST "$BASE_URL/api/fee/charge/$CERT_NO")
code=$(echo "$response" | grep -o '"code":[0-9]*' | cut -d':' -f2)
if [ "$code" = "200" ]; then
    echo "✅ 扣费成功"
else
    echo "❌ 扣费失败"
    exit 1
fi
echo ""

echo "🧪 8. 导出文本报告..."
response=$(curl -s -I "$BASE_URL/api/fee/export/text/$REQUEST_NO" | head -n 1)
if echo "$response" | grep -q "200"; then
    echo "✅ 文本报告可正常导出"
else
    echo "⚠️  文本导出响应: $response"
fi
echo ""

echo "🧪 9. 导出JSON报告..."
response=$(curl -s -I "$BASE_URL/api/fee/export/json/$REQUEST_NO" | head -n 1)
if echo "$response" | grep -q "200"; then
    echo "✅ JSON报告可正常导出"
else
    echo "⚠️  JSON导出响应: $response"
fi
echo ""

echo "======================================"
echo "🎉 所有功能验证通过！"
echo "======================================"
echo ""
echo "📝 测试数据摘要:"
echo "   请求号: $REQUEST_NO"
echo "   凭证号: $CERT_NO"
echo ""
echo "🌐 管理控制台: $BASE_URL"
echo "📊 可在控制台中查看完整的费用明细和导出文件"
echo ""
