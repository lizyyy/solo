#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 1. 创建实验 ==="
EXP_ID=$(curl -s -X POST "$BASE_URL/experiments" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "新支付系统测试",
    "description": "测试新支付系统的稳定性",
    "traffic_rate": 0.5,
    "bucket_key": "payment-v2",
    "thresholds": [
      {
        "metric_name": "error_rate",
        "operator": "gt",
        "value": 0.05,
        "window_size": 3,
        "trigger_count": 2
      },
      {
        "metric_name": "latency_p99",
        "operator": "gt",
        "value": 1000,
        "window_size": 5,
        "trigger_count": 3
      }
    ]
  }' | jq -r '.id')

echo "实验 ID: $EXP_ID"
echo ""

echo "=== 2. 启动实验 ==="
curl -s -X POST "$BASE_URL/experiments/$EXP_ID/start" | jq
echo ""

echo "=== 3. 测试分桶 ==="
for i in 1 2 3 4 5 6 7 8 9 10; do
  result=$(curl -s "$BASE_URL/experiments/$EXP_ID/bucket?user_id=user_$i" | jq -r '.in_experiment')
  echo "user_$i: $result"
done
echo ""

echo "=== 4. 记录指标 - 正常数据 ==="
for i in 1 2 3; do
  echo "记录指标 $i (error_rate=0.01)..."
  curl -s -X POST "$BASE_URL/experiments/$EXP_ID/metrics" \
    -H "Content-Type: application/json" \
    -d "{
      \"request_id\": \"req_normal_$i\",
      \"user_id\": \"user_1\",
      \"name\": \"error_rate\",
      \"value\": 0.01,
      \"tags\": \"payment\"
    }" | jq
done
echo ""

echo "=== 5. 测试重复提交 ==="
echo "重复提交 req_normal_1..."
curl -s -X POST "$BASE_URL/experiments/$EXP_ID/metrics" \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "req_normal_1",
    "user_id": "user_1",
    "name": "error_rate",
    "value": 0.01,
    "tags": "payment"
  }' | jq
echo ""

echo "=== 6. 记录指标 - 触发阈值 ==="
for i in 1 2 3; do
  echo "记录高错误率指标 $i..."
  result=$(curl -s -X POST "$BASE_URL/experiments/$EXP_ID/metrics" \
    -H "Content-Type: application/json" \
    -d "{
      \"request_id\": \"req_high_$i\",
      \"user_id\": \"user_1\",
      \"name\": \"error_rate\",
      \"value\": 0.1,
      \"tags\": \"payment\"
    }")
  echo "$result" | jq
  paused=$(echo "$result" | jq -r '.paused')
  if [ "$paused" = "true" ]; then
    echo "阈值已触发！实验暂停"
    break
  fi
done
echo ""

echo "=== 7. 检查暂停状态 ==="
curl -s "$BASE_URL/experiments/$EXP_ID/paused" | jq
echo ""

echo "=== 8. 导出观察结果 ==="
curl -s "$BASE_URL/experiments/$EXP_ID/export" | jq
echo ""

echo "=== 9. 确认回退 ==="
curl -s -X POST "$BASE_URL/experiments/$EXP_ID/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed_by": "admin@example.com",
    "reason": "错误率过高，回退到旧系统"
  }' | jq
echo ""

echo "=== 10. 查看最终实验状态 ==="
curl -s "$BASE_URL/experiments/$EXP_ID" | jq
