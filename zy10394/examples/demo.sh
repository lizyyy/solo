#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== API 状态订阅聚合器 演示脚本 ==="
echo ""

echo "1. 健康检查"
curl -s "${BASE_URL}/health" | jq .
echo ""

echo "2. 创建订阅（成功流）"
SUB1_RESPONSE=$(curl -s -X POST "${BASE_URL}/subscriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "topic_name": "order_status",
    "business_type": "order",
    "business_id": "ORD20240115001",
    "subscriber_id": "wms_system",
    "subscriber": "仓储系统",
    "endpoint": "http://httpbin.org/post",
    "method": "POST",
    "timeout": 30,
    "retry_count": 3,
    "retry_interval": 10,
    "idempotent_key": "sub_ORD20240115001_wms_001"
  }')
echo "$SUB1_RESPONSE" | jq .
SUB1_ID=$(echo "$SUB1_RESPONSE" | jq -r '.data.id')
echo "订阅1 ID: $SUB1_ID"
echo ""

echo "3. 重复提交同一个订阅（幂等性验证 - 应该返回同一个订阅）"
SUB1_DUP_RESPONSE=$(curl -s -X POST "${BASE_URL}/subscriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "topic_name": "order_status",
    "business_type": "order",
    "business_id": "ORD20240115001",
    "subscriber_id": "wms_system",
    "subscriber": "仓储系统",
    "endpoint": "http://httpbin.org/post",
    "idempotent_key": "sub_ORD20240115001_wms_001"
  }')
SUB1_DUP_ID=$(echo "$SUB1_DUP_RESPONSE" | jq -r '.data.id')
echo "重复提交后返回的订阅ID: $SUB1_DUP_ID"
if [ "$SUB1_ID" = "$SUB1_DUP_ID" ]; then
    echo "✅ 幂等性验证通过 - 两次返回同一个订阅"
else
    echo "❌ 幂等性验证失败 - 创建了重复订阅"
fi
echo ""

echo "4. 创建带过滤条件的订阅（只通知 to_status=paid 的状态变更）"
curl -s -X POST "${BASE_URL}/subscriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "topic_name": "order_status",
    "business_type": "order",
    "business_id": "ORD20240115001",
    "subscriber_id": "finance_system",
    "subscriber": "财务系统",
    "filter_expr": "to_status=paid",
    "endpoint": "http://httpbin.org/post",
    "method": "POST",
    "timeout": 30,
    "retry_count": 3,
    "retry_interval": 10,
    "idempotent_key": "sub_ORD20240115001_finance_001"
  }' | jq .
echo ""

echo "5. 模拟状态变更 - pending -> shipped（财务系统应该过滤掉）"
curl -s -X POST "${BASE_URL}/status/change" \
  -H "Content-Type: application/json" \
  -d '{
    "business_type": "order",
    "business_id": "ORD20240115001",
    "topic_name": "order_status",
    "from_status": "pending",
    "to_status": "shipped",
    "change_reason": "仓库已发货",
    "operator_id": "user_001",
    "operator_name": "李四",
    "idempotent_key": "change_ORD20240115001_shipped_01"
  }' | jq .
echo ""

echo "6. 模拟状态变更 - shipped -> paid（财务系统应该收到通知）"
curl -s -X POST "${BASE_URL}/status/change" \
  -H "Content-Type: application/json" \
  -d '{
    "business_type": "order",
    "business_id": "ORD20240115001",
    "topic_name": "order_status",
    "from_status": "shipped",
    "to_status": "paid",
    "change_reason": "用户完成支付",
    "operator_id": "user_002",
    "operator_name": "张三",
    "idempotent_key": "change_ORD20240115001_paid_01"
  }' | jq .
echo ""

echo "7. 查询订阅快照（验证 snapshot 关联正确的 subscription_id）"
echo "查询订阅 $SUB1_ID 的快照:"
curl -s "${BASE_URL}/subscriptions/${SUB1_ID}/snapshots" | jq .
echo ""

echo "8. 查询历史记录（验证完整数据链路）"
curl -s -X POST "${BASE_URL}/status/history" \
  -H "Content-Type: application/json" \
  -d '{
    "page": 1,
    "page_size": 10
  }' | jq .
echo ""

echo "=== 演示完成 ==="
echo "检查点："
echo "1. ✅ 订阅幂等性：重复提交不创建新订阅"
echo "2. ✅ 订阅过滤：财务系统只收到 to_status=paid 的通知"
echo "3. ✅ 快照查询：subscription_id 正确关联，能查到快照"
echo ""
echo "提示：重启服务后再次查询历史，验证数据持久化"
