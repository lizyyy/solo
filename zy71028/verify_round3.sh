#!/bin/bash
BASE_URL="http://127.0.0.1:8080/api/v1"

echo "====================================="
echo "第三轮修复验证脚本"
echo "====================================="

echo ""
echo "=== 清理并重启服务 ==="
lsof -ti :8080 | xargs -r kill -9
rm -rf data report_*.xlsx
sleep 1
./bin/server &
sleep 3

echo ""
echo "=== 1. 验证志愿者存在性校验（修复 SQLite 外键 500 错误） ==="
echo ""

# 创建老人
curl -s -X POST "$BASE_URL/elderly" -H "Content-Type: application/json" \
  -d '{"id":"e1","name":"测试老人","phone":"13800000001","address":"A","contact_name":"A","contact_phone":"13900000001"}' > /dev/null

# 创建路线
curl -s -X POST "$BASE_URL/routes" -H "Content-Type: application/json" \
  -d '{"request_id":"R1","elderly_id":"e1","date":"2026-08-01"}' > /dev/null
ROUTE_ID=$(sqlite3 data/elderly_meal.db "SELECT id FROM delivery_routes WHERE request_id='R1';")
echo "路线 ID: $ROUTE_ID"

echo ""
echo "测试 1a: 分配不存在的志愿者（应该返回 404 NOT_FOUND，而非 500）"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/routes/$ROUTE_ID/assign" \
  -H "Content-Type: application/json" \
  -d '{"volunteer_id":"non-existent-volunteer"}')
HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)

if [ "$HTTP_CODE" = "404" ]; then
    echo "✅ HTTP 404 - 志愿者不存在，正确返回 NOT_FOUND"
    echo "   Body: $BODY"
else
    echo "❌ HTTP $HTTP_CODE - 应该返回 404 而非 $HTTP_CODE"
    echo "   Body: $BODY"
fi

echo ""
echo "测试 1b: 分配存在的志愿者（应该正常 200）"
curl -s -X POST "$BASE_URL/volunteers" -H "Content-Type: application/json" \
  -d '{"id":"v1","name":"志愿者A","phone":"13700000001","area":"A"}' > /dev/null

RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/routes/$ROUTE_ID/assign" \
  -H "Content-Type: application/json" \
  -d '{"volunteer_id":"v1"}')
HTTP_CODE=$(echo "$RESULT" | tail -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTP 200 - 分配存在的志愿者成功"
else
    echo "❌ HTTP $HTTP_CODE - 应该返回 200 而非 $HTTP_CODE"
fi

echo ""
echo "=== 2. 验证错误类型区分 ==="
echo ""

echo "测试 2a: 缺字段 - 应该返回 MISSING_FIELD (400)"
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/elderly" \
  -H "Content-Type: application/json" \
  -d '{"name":"测试"}')
HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)

if echo "$BODY" | grep -q "MISSING_FIELD"; then
    echo "✅ MISSING_FIELD - 缺字段正确识别"
else
    echo "❌ 缺字段未正确识别: $BODY"
fi

echo ""
echo "测试 2b: 状态不允许 - 应该返回 INVALID_STATE (409)"
curl -s -X POST "$BASE_URL/routes/$ROUTE_ID/start" > /dev/null  # 开始派送
RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/routes/$ROUTE_ID/assign" \
  -H "Content-Type: application/json" \
  -d '{"volunteer_id":"v1"}')  # 重复分配（状态不对）
HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)

if echo "$BODY" | grep -q "INVALID_STATE"; then
    echo "✅ INVALID_STATE - 状态错误正确识别"
else
    echo "❌ 状态错误未正确识别: $BODY"
fi

echo ""
echo "测试 2c: 重复请求 - 应该返回 DUPLICATE_REQUEST (200)"
RESULT=$(curl -s -X POST "$BASE_URL/routes" -H "Content-Type: application/json" \
  -d '{"request_id":"R1","elderly_id":"e1","date":"2026-08-01"}')
if echo "$RESULT" | grep -q "duplicate"; then
    echo "✅ DUPLICATE_REQUEST - 重复请求正确识别"
else
    echo "❌ 重复请求未正确识别: $RESULT"
fi

echo ""
echo "测试 2d: 需要复核 - 异常安访返回 NEED_REVIEW (422)"
curl -s -X POST "$BASE_URL/routes" -H "Content-Type: application/json" \
  -d '{"request_id":"R2","elderly_id":"e1","date":"2026-08-02"}' > /dev/null
ROUTE2_ID=$(sqlite3 data/elderly_meal.db "SELECT id FROM delivery_routes WHERE request_id='R2';")
curl -s -X POST "$BASE_URL/routes/$ROUTE2_ID/assign" -H "Content-Type: application/json" \
  -d '{"volunteer_id":"v1"}' > /dev/null
curl -s -X POST "$BASE_URL/routes/$ROUTE2_ID/start" > /dev/null

RESULT=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/visits" \
  -H "Content-Type: application/json" \
  -d "{\"route_id\":\"$ROUTE2_ID\",\"result\":\"abnormal\",\"notes\":\"老人状态异常\"}")
HTTP_CODE=$(echo "$RESULT" | tail -1)
BODY=$(echo "$RESULT" | head -n -1)

if [ "$HTTP_CODE" = "422" ]; then
    echo "✅ NEED_REVIEW HTTP 422 - 异常安访需要复核正确识别"
else
    echo "❌ 异常安访状态码错误: $HTTP_CODE, Body: $BODY"
fi

echo ""
echo "=== 3. 验证日报待跟进不跨日期污染 ==="
echo ""

# 创建今日(2026-08-01)的待跟进
VISIT1_ID=$(sqlite3 data/elderly_meal.db "SELECT id FROM safety_visits WHERE route_id='$ROUTE_ID';")
if [ -z "$VISIT1_ID" ]; then
    curl -s -X POST "$BASE_URL/visits" -H "Content-Type: application/json" \
      -d "{\"route_id\":\"$ROUTE_ID\",\"result\":\"no_answer\"}" > /dev/null
fi

# 生成不同日期的报告
echo "生成 2026-08-01 报告..."
REPORT1=$(curl -s -X POST "$BASE_URL/reports/2026-08-01/generate")
PENDING1=$(echo "$REPORT1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pending_follow_ups',0))")

echo "生成 2026-08-02 报告..."
REPORT2=$(curl -s -X POST "$BASE_URL/reports/2026-08-02/generate")
PENDING2=$(echo "$REPORT2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pending_follow_ups',0))")

echo "  2026-08-01 待跟进数: $PENDING1"
echo "  2026-08-02 待跟进数: $PENDING2"

if [ "$PENDING1" = "1" ] && [ "$PENDING2" = "1" ]; then
    echo "✅ 日报按日期统计待跟进 - 两日各有 1 个待跟进"
else
    echo "❌ 日报统计异常: 8/1=$PENDING1 (预期1), 8/2=$PENDING2 (预期1)"
fi

echo ""
echo "=== 4. 验证 evidence_url 持久化（上轮修复回归测试） ==="
echo ""

ROUTE3_ID=$(sqlite3 data/elderly_meal.db "SELECT id FROM delivery_routes WHERE request_id='R2';")
VISIT3_ID=$(sqlite3 data/elderly_meal.db "SELECT id FROM safety_visits WHERE route_id='$ROUTE3_ID';")

curl -s -X POST "$BASE_URL/visits/$VISIT3_ID/evidence" -H "Content-Type: application/json" \
  -d '{"evidence_url":"http://test.com/round3.jpg"}' > /dev/null

EVIDENCE=$(sqlite3 data/elderly_meal.db "SELECT evidence_url FROM safety_visits WHERE id='$VISIT3_ID';")

if [ "$EVIDENCE" = "http://test.com/round3.jpg" ]; then
    echo "✅ evidence_url 持久化验证通过"
else
    echo "❌ evidence_url 持久化验证失败: '$EVIDENCE'"
fi

echo ""
echo "====================================="
echo "所有验证完成！"
echo "====================================="
