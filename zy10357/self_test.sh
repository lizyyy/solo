#!/bin/bash

echo "==============================================="
echo "API 证书吊销列表服务 - 自检脚本"
echo "==============================================="

BASE_URL="http://localhost:8080/api/v1"
HEALTH_URL="http://localhost:8080/health"

echo ""
echo "检查服务是否运行..."
if ! curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
    echo "错误: 服务未运行，请先启动服务: go run main.go"
    exit 1
fi
echo "✓ 服务运行正常"

echo ""
echo "==============================================="
echo "测试 1: 登记吊销证书"
echo "==============================================="
SERIAL="TEST-$(date +%s)"
REQUEST_ID="REQ-$(date +%s)"

RESPONSE=$(curl -s -X POST "$BASE_URL/revocations" \
    -H "Content-Type: application/json" \
    -d "{\"serial_number\": \"$SERIAL\", \"reason\": \"KEY_COMPROMISE\", \"request_id\": \"$REQUEST_ID\"}")

echo "响应: $RESPONSE"
if echo "$RESPONSE" | grep -q "吊销登记成功"; then
    echo "✓ 吊销登记成功"
else
    echo "✗ 吊销登记失败"
fi

echo ""
echo "==============================================="
echo "测试 2: 幂等性 - 重复提交相同 RequestID"
echo "==============================================="
RESPONSE2=$(curl -s -X POST "$BASE_URL/revocations" \
    -H "Content-Type: application/json" \
    -d "{\"serial_number\": \"$SERIAL-DUP\", \"reason\": \"KEY_COMPROMISE\", \"request_id\": \"$REQUEST_ID\"}")

echo "响应: $RESPONSE2"
if echo "$RESPONSE2" | grep -q "请求已处理"; then
    echo "✓ 幂等性验证通过 - 重复请求返回已有记录"
else
    echo "✗ 幂等性验证失败"
fi

echo ""
echo "==============================================="
echo "测试 3: 重复序列号 - 应返回冲突"
echo "==============================================="
RESPONSE3=$(curl -s -X POST "$BASE_URL/revocations" \
    -H "Content-Type: application/json" \
    -d "{\"serial_number\": \"$SERIAL\", \"reason\": \"KEY_COMPROMISE\"}")

echo "响应: $RESPONSE3"
if echo "$RESPONSE3" | grep -q "CERTIFICATE_ALREADY_REVOKED"; then
    echo "✓ 重复序列号验证通过 - 返回 409 冲突"
else
    echo "✗ 重复序列号验证失败"
fi

echo ""
echo "==============================================="
echo "测试 4: 无效吊销原因 - 应返回错误"
echo "==============================================="
RESPONSE4=$(curl -s -X POST "$BASE_URL/revocations" \
    -H "Content-Type: application/json" \
    -d "{\"serial_number\": \"$SERIAL-INVALID\", \"reason\": \"INVALID_REASON\"}")

echo "响应: $RESPONSE4"
if echo "$RESPONSE4" | grep -q "INVALID_REVOCATION_REASON"; then
    echo "✓ 无效吊销原因验证通过"
else
    echo "✗ 无效吊销原因验证失败"
fi

echo ""
echo "==============================================="
echo "测试 5: 创建分发版本 - 推进状态到 DISTRIBUTED"
echo "==============================================="
RESPONSE5=$(curl -s -X POST "$BASE_URL/versions" \
    -H "Content-Type: application/json")

echo "响应: $RESPONSE5"
if echo "$RESPONSE5" | grep -q "分发版本创建成功"; then
    echo "✓ 分发版本创建成功"
else
    echo "✗ 分发版本创建失败"
fi

echo ""
echo "==============================================="
echo "测试 6: 确认缓存 - 推进状态到 CACHE_CONFIRMED"
echo "==============================================="
RESPONSE6=$(curl -s -X POST "$BASE_URL/revocations/$SERIAL/confirm-cache" \
    -H "Content-Type: application/json")

echo "响应: $RESPONSE6"
if echo "$RESPONSE6" | grep -q "缓存确认成功"; then
    echo "✓ 缓存确认成功"
else
    echo "✗ 缓存确认失败"
fi

echo ""
echo "==============================================="
echo "测试 7: 激活吊销 - 推进状态到 ACTIVE"
echo "==============================================="
RESPONSE7=$(curl -s -X POST "$BASE_URL/revocations/$SERIAL/activate" \
    -H "Content-Type: application/json")

echo "响应: $RESPONSE7"
if echo "$RESPONSE7" | grep -q "吊销激活成功"; then
    echo "✓ 吊销激活成功"
else
    echo "✗ 吊销激活失败"
fi

echo ""
echo "==============================================="
echo "测试 8: 检查吊销状态 - ACTIVE 状态应返回已吊销"
echo "==============================================="
RESPONSE8=$(curl -s "$BASE_URL/revocations/$SERIAL/check")

echo "响应: $RESPONSE8"
if echo "$RESPONSE8" | grep -q "\"is_revoked\":true"; then
    echo "✓ 吊销状态检查通过"
else
    echo "✗ 吊销状态检查失败"
fi

echo ""
echo "==============================================="
echo "测试 9: 状态不允许跳转 - 不能直接从 REGISTERED 到 ACTIVE"
echo "==============================================="
SERIAL2="TEST2-$(date +%s)"
curl -s -X POST "$BASE_URL/revocations" \
    -H "Content-Type: application/json" \
    -d "{\"serial_number\": \"$SERIAL2\", \"reason\": \"KEY_COMPROMISE\"}" > /dev/null

RESPONSE9=$(curl -s -X POST "$BASE_URL/revocations/$SERIAL2/activate" \
    -H "Content-Type: application/json")

echo "响应: $RESPONSE9"
if echo "$RESPONSE9" | grep -q "INVALID_STATUS_TRANSITION"; then
    echo "✓ 状态跳转限制验证通过"
else
    echo "✗ 状态跳转限制验证失败"
fi

echo ""
echo "==============================================="
echo "测试 10: 获取状态转换历史"
echo "==============================================="
RESPONSE10=$(curl -s "$BASE_URL/revocations/$SERIAL/history")

echo "响应: $RESPONSE10"
if echo "$RESPONSE10" | grep -q "history"; then
    echo "✓ 状态历史获取成功"
else
    echo "✗ 状态历史获取失败"
fi

echo ""
echo "==============================================="
echo "测试 11: 获取报表"
echo "==============================================="
RESPONSE11=$(curl -s "$BASE_URL/report")

echo "响应: $RESPONSE11"
if echo "$RESPONSE11" | grep -q "total_revocations"; then
    echo "✓ 报表获取成功"
else
    echo "✗ 报表获取失败"
fi

echo ""
echo "==============================================="
echo "测试 12: 不存在的证书检查"
echo "==============================================="
RESPONSE12=$(curl -s "$BASE_URL/revocations/NON_EXISTENT_12345/check")

echo "响应: $RESPONSE12"
if echo "$RESPONSE12" | grep -q "\"is_revoked\":false"; then
    echo "✓ 不存在证书检查通过"
else
    echo "✗ 不存在证书检查失败"
fi

echo ""
echo "==============================================="
echo "自检完成!"
echo "==============================================="
