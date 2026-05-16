#!/bin/bash
# 快速验证脚本 - 验证拦截路径是否生效

echo "========================================"
echo "  API 回放隐私预算 - 拦截验证"
echo "========================================"

# 检查服务是否启动
if ! curl -s http://localhost:8080/api/sample/user/user001 > /dev/null 2>&1; then
    echo "❌ 服务未启动，请先运行: ./start.sh"
    exit 1
fi

echo "✅ 服务运行正常"
echo ""

# 获取样本ID
echo "步骤 1/3: 获取样本ID..."
SAMPLE_RESPONSE=$(curl -s http://localhost:8080/api/sample/user/user001)
SAMPLE_ID=$(echo "$SAMPLE_RESPONSE" | grep -o '"sampleId":"[^"]*"' | head -n 1 | cut -d'"' -f4)

if [ -z "$SAMPLE_ID" ]; then
    echo "❌ 无法获取样本ID"
    exit 1
fi

echo "✅ 获取样本ID: $SAMPLE_ID"
echo ""

# 构造10个相同样本ID
SAMPLE_IDS="\"$SAMPLE_ID\""
for i in {1..9}; do
    SAMPLE_IDS="$SAMPLE_IDS,\"$SAMPLE_ID\""
done

echo "步骤 2/3: 创建回放申请（10个HIGH级别样本）..."
echo "   预期成本: 10 × 15 × (3 + 1) = 600"
echo "   user002预算: 500"
echo "   预期结果: 预算不足被拦截 (code=2002)"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:8080/api/replay/request \
  -H "Content-Type: application/json" \
  -d "{
    \"requestId\": \"BLOCK_TEST_$(date +%s)\",
    \"requesterId\": \"user002\",
    \"purpose\": \"拦截测试\",
    \"sampleIds\": [$SAMPLE_IDS],
    \"maskingLevel\": \"HIGH\"
  }")

echo "步骤 3/3: 验证拦截结果..."
echo ""
echo "服务响应:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

CODE=$(echo "$RESPONSE" | grep -o '"code":[0-9]*' | cut -d':' -f2)
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":\(true\|false\)' | cut -d':' -f2)

if [ "$CODE" = "2002" ] && [ "$SUCCESS" = "false" ]; then
    echo "✅ 拦截验证成功！预算不足拦截正常工作"
    echo "   错误码: $CODE (隐私预算不足)"
    echo "   执行状态: $SUCCESS (被预期拦截)"
else
    echo "⚠️  拦截未按预期触发，请检查:"
    echo "   返回码: $CODE"
    echo "   成功状态: $SUCCESS"
fi

echo ""
echo "========================================"
