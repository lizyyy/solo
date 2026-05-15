#!/bin/bash

BASE_URL="http://localhost:8080/api/v1/simulations"
IDEMPOTENCY_KEY="test-key-$(date +%s)"

echo "=== 授权范围模拟 API 完整流程测试 ==="
echo ""

echo "1. 创建模拟请求 (POST /simulations)"
echo "   Idempotency-Key: $IDEMPOTENCY_KEY"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "'"$IDEMPOTENCY_KEY"'",
    "partner_id": "P001",
    "requested_scopes": ["user:read", "order:read"]
  }')
echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

SIM_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['id'])")
echo "   模拟 ID: $SIM_ID"
echo ""

echo "2. 测试幂等性 - 重复提交相同请求"
echo "   应该返回相同的结果，不创建新记录"
IDEMPOTENT_RESPONSE=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "'"$IDEMPOTENCY_KEY"'",
    "partner_id": "P001",
    "requested_scopes": ["user:read", "order:read"]
  }')
echo "$IDEMPOTENT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$IDEMPOTENT_RESPONSE"
echo ""

echo "3. 校验模拟 (POST /simulations/validate)"
VALIDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/validate" \
  -H "Content-Type: application/json" \
  -d '{"simulation_id": "'"$SIM_ID"'"}')
echo "$VALIDATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VALIDATE_RESPONSE"
echo ""

echo "4. 获取模拟详情 (GET /simulations/{id})"
GET_RESPONSE=$(curl -s -X GET "$BASE_URL/$SIM_ID")
echo "$GET_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$GET_RESPONSE"
echo ""

echo "5. 开通凭证 (POST /simulations/activate)"
ACTIVATE_RESPONSE=$(curl -s -X POST "$BASE_URL/activate" \
  -H "Content-Type: application/json" \
  -d '{"simulation_id": "'"$SIM_ID"'"}')
echo "$ACTIVATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ACTIVATE_RESPONSE"
echo ""

echo "6. 导出模拟结果 (GET /simulations/{id}/export)"
EXPORT_RESPONSE=$(curl -s -X GET "$BASE_URL/$SIM_ID/export")
echo "$EXPORT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$EXPORT_RESPONSE"
echo ""

echo "7. 查询历史记录 (GET /simulations/history)"
HISTORY_RESPONSE=$(curl -s -X GET "$BASE_URL/history?partner_id=P001&page=1&page_size=10")
echo "$HISTORY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$HISTORY_RESPONSE"
echo ""

echo "8. 测试错误场景 - 使用不存在的合作方"
echo "   预期错误: PARTNER_NOT_FOUND"
ERROR_RESPONSE=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "error-test-1",
    "partner_id": "INVALID_PARTNER",
    "requested_scopes": ["user:read"]
  }')
echo "$ERROR_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ERROR_RESPONSE"
echo ""

echo "9. 测试错误场景 - 使用不存在的权限范围"
echo "   预期错误: SCOPE_NOT_FOUND"
ERROR_RESPONSE2=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "error-test-2",
    "partner_id": "P001",
    "requested_scopes": ["user:read", "invalid:scope"]
  }')
echo "$ERROR_RESPONSE2" | python3 -m json.tool 2>/dev/null || echo "$ERROR_RESPONSE2"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "可用的权限范围:"
echo "  - user:read (用户读取)"
echo "  - user:write (用户写入)"
echo "  - order:read (订单读取)"
echo "  - order:write (订单写入)"
echo ""
echo "可用的合作方:"
echo "  - P001 (测试合作方)"
