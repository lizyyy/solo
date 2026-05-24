#!/bin/bash
BASE_URL="http://localhost:8080/api/v1"

echo "====================================="
echo "修复验证脚本"
echo "====================================="

echo ""
echo "1. 验证老人档案幂等性..."
curl -s -X POST "$BASE_URL/elderly" \
  -H "Content-Type: application/json" \
  -d '{"id":"verify-elder-001","name":"验证老人","phone":"13800000001","address":"地址","contact_name":"联系人","contact_phone":"13900000001"}' > /dev/null

RESULT=$(curl -s -X POST "$BASE_URL/elderly" \
  -H "Content-Type: application/json" \
  -d '{"id":"verify-elder-001","name":"验证老人","phone":"13800000001","address":"地址","contact_name":"联系人","contact_phone":"13900000001"}')

if echo "$RESULT" | grep -q "duplicate"; then
    echo "✅ 老人档案幂等性正常"
else
    echo "❌ 老人档案幂等性失败: $RESULT"
fi

echo ""
echo "2. 验证志愿者幂等性..."
curl -s -X POST "$BASE_URL/volunteers" \
  -H "Content-Type: application/json" \
  -d '{"id":"verify-vol-001","name":"验证志愿者","phone":"13700000001","area":"区域"}' > /dev/null

RESULT=$(curl -s -X POST "$BASE_URL/volunteers" \
  -H "Content-Type: application/json" \
  -d '{"id":"verify-vol-001","name":"验证志愿者","phone":"13700000001","area":"区域"}')

if echo "$RESULT" | grep -q "duplicate"; then
    echo "✅ 志愿者幂等性正常"
else
    echo "❌ 志愿者幂等性失败"
fi

echo ""
echo "3. 验证同日同老人派单幂等性（REQ-003 问题）..."
curl -s -X POST "$BASE_URL/routes" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"REQ-VERIFY-A","elderly_id":"verify-elder-001","date":"2026-05-25"}' > /dev/null

RESULT=$(curl -s -X POST "$BASE_URL/routes" \
  -H "Content-Type: application/json" \
  -d '{"request_id":"REQ-VERIFY-B","elderly_id":"verify-elder-001","date":"2026-05-25"}')

if echo "$RESULT" | grep -q "duplicate"; then
    echo "✅ 同日同老人幂等性正常（REQ-003 问题修复）"
else
    echo "❌ 同日同老人幂等性失败"
fi

ROUTE_ID=$(curl -s "$BASE_URL/routes/request/REQ-VERIFY-A" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

echo ""
echo "4. 验证 evidence_url 持久化（核心修复）..."
curl -s -X POST "$BASE_URL/routes/$ROUTE_ID/start" > /dev/null

VISIT=$(curl -s -X POST "$BASE_URL/visits" \
  -H "Content-Type: application/json" \
  -d "{\"route_id\":\"$ROUTE_ID\",\"result\":\"normal\"}")
VISIT_ID=$(echo "$VISIT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

curl -s -X POST "$BASE_URL/visits/$VISIT_ID/evidence" \
  -H "Content-Type: application/json" \
  -d '{"evidence_url":"http://test.com/evidence.jpg"}' > /dev/null

EVIDENCE=$(curl -s "$BASE_URL/visits/$VISIT_ID" | python3 -c "import sys,json; print(json.load(sys.stdin).get('evidence_url',''))")

if [ "$EVIDENCE" = "http://test.com/evidence.jpg" ]; then
    echo "✅ evidence_url 持久化正常"
else
    echo "❌ evidence_url 持久化失败: '$EVIDENCE'"
fi

echo ""
echo "5. 验证统计稳定性..."
COUNT=$(curl -s "$BASE_URL/routes?date=2026-05-25" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)")

if [ "$COUNT" = "1" ]; then
    echo "✅ 统计稳定: 2026-05-25 路线数 = $COUNT"
else
    echo "❌ 统计不稳定: 2026-05-25 路线数 = $COUNT (预期 1)"
fi

echo ""
echo "====================================="
echo "修复验证完成"
echo "====================================="
