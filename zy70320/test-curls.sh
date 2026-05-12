#!/bin/bash
BASE_URL="http://localhost:3001/api/v1"
NOW=$(date +%s)
SECONDS_IN_HOUR=3600

echo "====================================="
echo "1. 正常队列场景测试"
echo "====================================="

for i in $(seq 0 5); do
  TS=$((NOW - (5 - i) * 60))
  curl -s -X POST "$BASE_URL/queues/normal-queue/metrics" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": ${TS}000, \"produceRate\": 50, \"consumeRate\": 50, \"backlogCount\": 100}"
  echo ""
done

curl -s -X POST "$BASE_URL/consumers/normal-group/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\": ${NOW}000, \"instanceId\": \"consumer-1\", \"consumerCount\": 3}"
echo ""

echo ""
echo "诊断正常队列:"
curl -s "$BASE_URL/queues/normal-queue/diagnosis?consumerGroupId=normal-group" | python3 -m json.tool
echo ""

echo "====================================="
echo "2. 生产突增场景测试"
echo "====================================="

for i in $(seq 0 2); do
  TS=$((NOW - (5 - i) * 60))
  curl -s -X POST "$BASE_URL/queues/production-spike-queue/metrics" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": ${TS}000, \"produceRate\": 50, \"consumeRate\": 50, \"backlogCount\": 200}"
  echo ""
done

for i in $(seq 3 5); do
  TS=$((NOW - (5 - i) * 60))
  curl -s -X POST "$BASE_URL/queues/production-spike-queue/metrics" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": ${TS}000, \"produceRate\": 150, \"consumeRate\": 60, \"backlogCount\": 2000}"
  echo ""
done

curl -s -X POST "$BASE_URL/consumers/production-group/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\": ${NOW}000, \"instanceId\": \"consumer-2\", \"consumerCount\": 3}"
echo ""

echo ""
echo "诊断生产突增队列:"
curl -s "$BASE_URL/queues/production-spike-queue/diagnosis?consumerGroupId=production-group" | python3 -m json.tool
echo ""

echo "====================================="
echo "3. 消费者掉线场景测试"
echo "====================================="

for i in $(seq 0 5); do
  TS=$((NOW - (5 - i) * 60))
  curl -s -X POST "$BASE_URL/queues/consumer-offline-queue/metrics" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": ${TS}000, \"produceRate\": 100, \"consumeRate\": 10, \"backlogCount\": 5000}"
  echo ""
done

OLD_TS=$((NOW - 120))
curl -s -X POST "$BASE_URL/consumers/offline-group/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\": ${OLD_TS}000, \"instanceId\": \"consumer-3\", \"consumerCount\": 2}"
echo ""

echo ""
echo "诊断消费者掉线队列:"
curl -s "$BASE_URL/queues/consumer-offline-queue/diagnosis?consumerGroupId=offline-group" | python3 -m json.tool
echo ""

echo "====================================="
echo "4. 失败重试堆积场景测试"
echo "====================================="

for i in $(seq 0 5); do
  TS=$((NOW - (5 - i) * 60))
  curl -s -X POST "$BASE_URL/queues/failure-queue/metrics" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": ${TS}000, \"produceRate\": 80, \"consumeRate\": 50, \"failureCount\": 20, \"backlogCount\": 3000}"
  echo ""
done

for i in $(seq 1 5); do
  TS=$((NOW - i * 30))
  curl -s -X POST "$BASE_URL/queues/failure-queue/failures" \
    -H "Content-Type: application/json" \
    -d "{\"timestamp\": ${TS}000, \"messageId\": \"msg-fail-$i\", \"errorMessage\": \"数据库连接超时\", \"retryCount\": 2}"
  echo ""
done

curl -s -X POST "$BASE_URL/retry/failure-queue-retry/status" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\": ${NOW}000, \"totalCount\": 500, \"messages\": [{\"messageId\": \"msg-loop-1\", \"retryCount\": 5}, {\"messageId\": \"msg-loop-2\", \"retryCount\": 8}]}"
echo ""

curl -s -X POST "$BASE_URL/consumers/failure-group/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\": ${NOW}000, \"instanceId\": \"consumer-4\", \"consumerCount\": 3}"
echo ""

echo ""
echo "诊断失败重试堆积队列:"
curl -s "$BASE_URL/queues/failure-queue/diagnosis?consumerGroupId=failure-group" | python3 -m json.tool
echo ""

echo "====================================="
echo "5. 告警生成和确认测试"
echo "====================================="

echo "为消费者掉线队列生成告警:"
ALERT_RESULT=$(curl -s -X POST "$BASE_URL/queues/consumer-offline-queue/diagnosis/generate-alert" \
  -H "Content-Type: application/json" \
  -d "{\"consumerGroupId\": \"offline-group\"}")
echo "$ALERT_RESULT" | python3 -m json.tool

ALERT_ID=$(echo "$ALERT_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['alert']['id'])")
echo "告警ID: $ALERT_ID"

echo ""
echo "确认告警:"
curl -s -X POST "$BASE_URL/alerts/$ALERT_ID/acknowledge" | python3 -m json.tool

echo ""
echo "查看所有告警:"
curl -s "$BASE_URL/alerts?queueName=consumer-offline-queue" | python3 -m json.tool

echo ""
echo "====================================="
echo "6. 幂等性测试（重复上报）"
echo "====================================="

echo "第一次上报同一指标:"
curl -s -X POST "$BASE_URL/queues/idempotent-queue/metrics" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\": ${NOW}000, \"produceRate\": 100, \"consumeRate\": 100, \"backlogCount\": 100}"
echo ""

echo "第二次上报同一指标（应该显示 isNew: false）:"
curl -s -X POST "$BASE_URL/queues/idempotent-queue/metrics" \
  -H "Content-Type: application/json" \
  -d "{\"timestamp\": ${NOW}000, \"produceRate\": 100, \"consumeRate\": 100, \"backlogCount\": 100}"
echo ""

echo ""
echo "查看指标数量（应该只有1条）:"
curl -s "$BASE_URL/queues/idempotent-queue/metrics" | python3 -m json.tool

echo ""
echo "测试完成！"
