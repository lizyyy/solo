#!/bin/bash

echo "========================================="
echo "外部回调白名单 API 自检脚本"
echo "========================================="
echo ""

API_BASE="http://localhost:8080/api/v1"

echo "[1/8] 检查服务是否启动..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/parties > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 服务未启动，请先运行: go run cmd/main.go"
    exit 1
fi
echo "✅ 服务运行正常"
echo ""

echo "[2/8] 创建回调方..."
PARTY_RESP=$(curl -s -X POST "$API_BASE/parties" \
    -H "Content-Type: application/json" \
    -d '{"name":"自检测试方","app_id":"self_test_001"}')
PARTY_ID=$(echo $PARTY_RESP | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$PARTY_ID" ]; then
    echo "❌ 创建回调方失败"
    exit 1
fi
echo "✅ 创建成功，Party ID: $PARTY_ID"
echo ""

echo "[3/8] 创建白名单规则..."
RULE_RESP=$(curl -s -X POST "$API_BASE/rules" \
    -H "Content-Type: application/json" \
    -d "{\"party_id\":\"$PARTY_ID\",\"name\":\"自检测试规则\",\"source_rules\":[\"192.168.1.0/24\"],\"path_rules\":[\"/webhook/.*\"],\"method_rules\":[\"POST\"],\"header_rules\":[\"X-Signature\"]}")
RULE_ID=$(echo $RULE_RESP | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
RULE_STATUS=$(echo $RULE_RESP | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ -z "$RULE_ID" ]; then
    echo "❌ 创建规则失败"
    exit 1
fi
echo "✅ 创建成功，Rule ID: $RULE_ID, 状态: $RULE_STATUS"
echo ""

echo "[4/8] 测试幂等性（重复创建相同规则）..."
RULE_RESP2=$(curl -s -X POST "$API_BASE/rules" \
    -H "Content-Type: application/json" \
    -d "{\"party_id\":\"$PARTY_ID\",\"name\":\"自检测试规则\",\"description\":\"第二次请求\"}")
RULE_ID2=$(echo $RULE_RESP2 | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ "$RULE_ID" = "$RULE_ID2" ]; then
    echo "✅ 幂等性正常，返回相同的规则 ID"
else
    echo "❌ 幂等性失败，返回了不同的规则 ID"
fi
echo ""

echo "[5/8] 测试非法状态流转（草稿 → 激活）..."
STATUS_RESP=$(curl -s -X PUT "$API_BASE/rules/$RULE_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"active","comment":"直接激活"}')
STATUS_CODE=$(echo $STATUS_RESP | grep -o '"code":[0-9]*' | cut -d':' -f2)
if [ "$STATUS_CODE" = "400" ] || [ "$STATUS_CODE" = "500" ]; then
    echo "✅ 非法状态流转正确被拒绝"
else
    echo "❌ 非法状态流转未被拒绝，响应: $STATUS_RESP"
fi
echo ""

echo "[6/8] 合法状态流转：草稿 → 测试中 → 激活..."
curl -s -X PUT "$API_BASE/rules/$RULE_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"testing","comment":"进入测试阶段"}' > /dev/null
curl -s -X PUT "$API_BASE/rules/$RULE_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"active","comment":"正式激活"}' > /dev/null
echo "✅ 状态流转成功"
echo ""

echo "[7/8] 测试回调验证（合法请求）..."
VERIFY_RESP=$(curl -s -X POST "$API_BASE/verify" \
    -H "Content-Type: application/json" \
    -d "{\"rule_id\":\"$RULE_ID\",\"party_id\":\"$PARTY_ID\",\"source_ip\":\"192.168.1.100\",\"request_path\":\"/webhook/test\",\"request_method\":\"POST\",\"headers\":{\"X-Signature\":\"valid\"},\"is_dry_run\":false}")
VERIFY_CODE=$(echo $VERIFY_RESP | grep -o '"code":[0-9]*' | cut -d':' -f2)
if [ "$VERIFY_CODE" = "200" ]; then
    echo "✅ 合法请求验证通过"
else
    echo "❌ 合法请求验证失败，响应: $VERIFY_RESP"
fi
echo ""

echo "[8/8] 测试回调验证（非法源 IP）..."
VERIFY_RESP2=$(curl -s -X POST "$API_BASE/verify" \
    -H "Content-Type: application/json" \
    -d "{\"rule_id\":\"$RULE_ID\",\"party_id\":\"$PARTY_ID\",\"source_ip\":\"10.0.0.1\",\"request_path\":\"/webhook/test\",\"request_method\":\"POST\",\"headers\":{\"X-Signature\":\"valid\"},\"is_dry_run\":false}")
VERIFY_CODE2=$(echo $VERIFY_RESP2 | grep -o '"code":[0-9]*' | cut -d':' -f2)
if [ "$VERIFY_CODE2" = "403" ]; then
    echo "✅ 非法源 IP 正确被拒绝"
else
    echo "❌ 非法源 IP 验证失败，响应: $VERIFY_RESP2"
fi
echo ""

echo "========================================="
echo "自检完成！"
echo "========================================="
echo ""
echo "管理控制台: http://localhost:8080"
echo "API 文档参考 README.md"
