#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 1. 创建第一个迁移任务 (预期成功切换) ==="
RESPONSE=$(curl -s -X POST "$BASE_URL/migrations" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "SUP001",
    "supplier_name": "阿里云支付",
    "old_webhook": "https://old.example.com/webhook/alipay",
    "new_webhook": "https://new.example.com/webhook/alipay",
    "event_types": ["payment.created", "payment.success", "payment.failed", "refund.created"],
    "dual_send_duration_hours": 24,
    "operator": "admin"
  }')
echo "$RESPONSE"
MIGRATION_ID1=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "创建的迁移ID1: $MIGRATION_ID1"

echo ""
echo "=== 2. 启动双投 ==="
curl -s -X POST "$BASE_URL/migrations/$MIGRATION_ID1/dual-send" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'

echo ""
echo "=== 3. 批量记录事件 (95个成功, 5个失败) ==="
for i in $(seq 1 95); do
  curl -s -X POST "$BASE_URL/events" \
    -H "Content-Type: application/json" \
    -d "{
      \"migration_id\": \"$MIGRATION_ID1\",
      \"event_type\": \"payment.success\",
      \"event_id\": \"EVT_$(printf %04d $i)\",
      \"payload_hash\": \"hash_$i\",
      \"old_delivered\": true,
      \"old_response_status\": 200,
      \"old_response_time_ms\": 150,
      \"old_response_body\": \"{\\\"status\\\":\\\"ok\\\"}\",
      \"new_delivered\": true,
      \"new_response_status\": 200,
      \"new_response_time_ms\": 120,
      \"new_response_body\": \"{\\\"status\\\":\\\"ok\\\"}\",
      \"raw_old_request\": \"POST /webhook {}\",
      \"raw_new_request\": \"POST /webhook {}\"
    }" > /dev/null
  echo -n "."
done
echo ""

for i in $(seq 96 100); do
  curl -s -X POST "$BASE_URL/events" \
    -H "Content-Type: application/json" \
    -d "{
      \"migration_id\": \"$MIGRATION_ID1\",
      \"event_type\": \"payment.success\",
      \"event_id\": \"EVT_$(printf %04d $i)\",
      \"payload_hash\": \"hash_$i\",
      \"old_delivered\": true,
      \"old_response_status\": 200,
      \"old_response_time_ms\": 150,
      \"old_response_body\": \"{\\\"status\\\":\\\"ok\\\"}\",
      \"new_delivered\": true,
      \"new_response_status\": 500,
      \"new_response_time_ms\": 500,
      \"new_response_body\": \"{\\\"error\\\":\\\"internal error\\\"}\",
      \"raw_old_request\": \"POST /webhook {}\",
      \"raw_new_request\": \"POST /webhook {}\"
    }" > /dev/null
  echo -n "x"
done
echo ""

echo ""
echo "=== 4. 开始对账流程 ==="
curl -s -X POST "$BASE_URL/migrations/$MIGRATION_ID1/reconciliation" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'

echo ""
echo "=== 5. 执行对账计算 ==="
curl -s -X POST "$BASE_URL/migrations/$MIGRATION_ID1/reconcile"

echo ""
echo "=== 6. 查看对账后的迁移详情 ==="
curl -s "$BASE_URL/migrations/$MIGRATION_ID1" | python3 -m json.tool

echo ""
echo "=== 7. 确认切换到新地址 ==="
curl -s -X POST "$BASE_URL/migrations/$MIGRATION_ID1/confirm" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'

echo ""
echo "=== 8. 查看状态流转历史 ==="
curl -s "$BASE_URL/migrations/$MIGRATION_ID1/transitions" | python3 -m json.tool

echo ""
echo "=== 9. 创建第二个迁移任务 (预期失败回滚) ==="
RESPONSE2=$(curl -s -X POST "$BASE_URL/migrations" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "SUP002",
    "supplier_name": "微信支付",
    "old_webhook": "https://old.example.com/webhook/wxpay",
    "new_webhook": "https://new.example.com/webhook/wxpay",
    "event_types": ["payment.created", "payment.success"],
    "dual_send_duration_hours": 12,
    "operator": "admin"
  }')
echo "$RESPONSE2"
MIGRATION_ID2=$(echo "$RESPONSE2" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "创建的迁移ID2: $MIGRATION_ID2"

echo ""
echo "=== 10. 启动双投 ==="
curl -s -X POST "$BASE_URL/migrations/$MIGRATION_ID2/dual-send" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'

echo ""
echo "=== 11. 记录低成功率事件 (80%成功率) ==="
for i in $(seq 1 8); do
  curl -s -X POST "$BASE_URL/events" \
    -H "Content-Type: application/json" \
    -d "{
      \"migration_id\": \"$MIGRATION_ID2\",
      \"event_type\": \"payment.created\",
      \"event_id\": \"WX_$(printf %04d $i)\",
      \"payload_hash\": \"wx_hash_$i\",
      \"old_delivered\": true,
      \"old_response_status\": 200,
      \"old_response_time_ms\": 200,
      \"old_response_body\": \"ok\",
      \"new_delivered\": true,
      \"new_response_status\": 200,
      \"new_response_time_ms\": 180,
      \"new_response_body\": \"ok\",
      \"raw_old_request\": \"POST /wx {}\",
      \"raw_new_request\": \"POST /wx {}\"
    }" > /dev/null
  echo -n "."
done

for i in $(seq 9 10); do
  curl -s -X POST "$BASE_URL/events" \
    -H "Content-Type: application/json" \
    -d "{
      \"migration_id\": \"$MIGRATION_ID2\",
      \"event_type\": \"payment.created\",
      \"event_id\": \"WX_$(printf %04d $i)\",
      \"payload_hash\": \"wx_hash_$i\",
      \"old_delivered\": true,
      \"old_response_status\": 200,
      \"old_response_time_ms\": 200,
      \"old_response_body\": \"ok\",
      \"new_delivered\": false,
      \"new_response_status\": 0,
      \"new_response_time_ms\": 0,
      \"new_response_body\": \"\",
      \"raw_old_request\": \"POST /wx {}\",
      \"raw_new_request\": \"POST /wx {}\"
    }" > /dev/null
  echo -n "x"
done
echo ""

echo ""
echo "=== 12. 开始对账 ==="
curl -s -X POST "$BASE_URL/migrations/$MIGRATION_ID2/reconciliation" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin"}'

echo ""
echo "=== 13. 执行对账计算 (预期失败) ==="
curl -s -X POST "$BASE_URL/migrations/$MIGRATION_ID2/reconcile"

echo ""
echo "=== 14. 查看失败后的迁移详情 ==="
curl -s "$BASE_URL/migrations/$MIGRATION_ID2" | python3 -m json.tool

echo ""
echo "=== 15. 执行回滚 ==="
curl -s -X POST "$BASE_URL/migrations/$MIGRATION_ID2/rollback" \
  -H "Content-Type: application/json" \
  -d '{"operator": "admin", "reason": "新地址成功率过低，未达到95%阈值要求，回滚至旧地址"}'

echo ""
echo "=== 16. 查看所有迁移列表 ==="
curl -s "$BASE_URL/migrations?page=1&pageSize=10" | python3 -m json.tool

echo ""
echo "=== 样例数据创建完成！ ==="
echo "可以访问以下接口查看更多信息:"
echo "  - 导出第一个迁移CSV: GET $BASE_URL/migrations/$MIGRATION_ID1/export"
echo "  - 导出所有迁移CSV: GET $BASE_URL/migrations/export"
echo "  - 查看迁移1的事件: GET $BASE_URL/migrations/$MIGRATION_ID1/events"
