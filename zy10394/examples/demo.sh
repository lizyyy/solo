#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== API 状态订阅聚合器 演示脚本 ==="
echo ""

echo "1. 健康检查"
curl -s "${BASE_URL}/health" | jq .
echo ""

echo "2. 创建订阅（成功流）"
curl -s -X POST "${BASE_URL}/subscriptions" \
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
  }' | jq .
echo ""

echo "3. 重复提交同一个订阅（幂等性验证）"
curl -s -X POST "${BASE_URL}/subscriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "topic_name": "order_status",
    "business_type": "order",
    "business_id": "ORD20240115001",
    "subscriber_id": "wms_system",
    "subscriber": "仓储系统",
    "endpoint": "http://httpbin.org/post",
    "idempotent_key": "sub_ORD20240115001_wms_001"
  }' | jq .
echo ""

echo "4. 模拟状态变更 - 待支付 → 已支付"
curl -s -X POST "${BASE_URL}/status/change" \
  -H "Content-Type: application/json" \
  -d '{
    "business_type": "order",
    "business_id": "ORD20240115001",
    "topic_name": "order_status",
    "from_status": "pending",
    "to_status": "paid",
    "change_reason": "用户完成在线支付",
    "operator_id": "user_10086",
    "operator_name": "张三",
    "idempotent_key": "change_ORD20240115001_paid_01"
  }' | jq .
echo ""

echo "5. 创建失败流订阅（指向不存在的地址）"
curl -s -X POST "${BASE_URL}/subscriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "topic_name": "order_status",
    "business_type": "order",
    "business_id": "ORD20240115002",
    "subscriber_id": "notify_system",
    "subscriber": "通知系统",
    "endpoint": "http://localhost:9999/nonexistent",
    "method": "POST",
    "timeout": 5,
    "retry_count": 2,
    "retry_interval": 5,
    "idempotent_key": "sub_ORD20240115002_notify_001"
  }' | jq .
echo ""

echo "6. 模拟状态变更 - 触发失败投递"
curl -s -X POST "${BASE_URL}/status/change" \
  -H "Content-Type: application/json" \
  -d '{
    "business_type": "order",
    "business_id": "ORD20240115002",
    "topic_name": "order_status",
    "from_status": "paid",
    "to_status": "shipped",
    "change_reason": "仓库已发货",
    "operator_id": "user_10010",
    "operator_name": "李四",
    "idempotent_key": "change_ORD20240115002_shipped_01"
  }' | jq .
echo ""

echo "7. 等待 15 秒让投递重试完成..."
sleep 15

echo "8. 查询历史记录（验证数据持久化）"
curl -s -X POST "${BASE_URL}/status/history" \
  -H "Content-Type: application/json" \
  -d '{
    "page": 1,
    "page_size": 10
  }' | jq .
echo ""

echo "=== 演示完成 ==="
echo "提示：可以重启服务后再次执行步骤 8，验证数据是否仍然存在"
