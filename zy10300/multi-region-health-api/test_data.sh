#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 创建区域 ==="
REGION_BJ=$(curl -s -X POST $BASE_URL/regions \
  -H "Content-Type: application/json" \
  -d '{"request_id":"reg-bj-001","name":"北京区域","code":"bj","description":"北京主数据中心"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "北京区域 ID: $REGION_BJ"

REGION_SH=$(curl -s -X POST $BASE_URL/regions \
  -H "Content-Type: application/json" \
  -d '{"request_id":"reg-sh-001","name":"上海区域","code":"sh","description":"上海灾备中心"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "上海区域 ID: $REGION_SH"

echo ""
echo "=== 创建服务 ==="
SERVICE_USER=$(curl -s -X POST $BASE_URL/services \
  -H "Content-Type: application/json" \
  -d "{\"request_id\":\"svc-user-001\",\"region_id\":\"$REGION_BJ\",\"name\":\"用户服务\",\"code\":\"user-service\",\"description\":\"用户认证与管理\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "用户服务 ID: $SERVICE_USER"

SERVICE_ORDER=$(curl -s -X POST $BASE_URL/services \
  -H "Content-Type: application/json" \
  -d "{\"request_id\":\"svc-order-001\",\"region_id\":\"$REGION_BJ\",\"name\":\"订单服务\",\"code\":\"order-service\",\"description\":\"订单处理\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "订单服务 ID: $SERVICE_ORDER"

SERVICE_PAY=$(curl -s -X POST $BASE_URL/services \
  -H "Content-Type: application/json" \
  -d "{\"request_id\":\"svc-pay-001\",\"region_id\":\"$REGION_BJ\",\"name\":\"支付服务\",\"code\":\"pay-service\",\"description\":\"支付处理\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "支付服务 ID: $SERVICE_PAY"

echo ""
echo "=== 创建依赖关系 ==="
echo "订单服务 -> 用户服务（关键依赖）"
curl -s -X POST $BASE_URL/services/$SERVICE_ORDER/dependencies \
  -H "Content-Type: application/json" \
  -d "{\"request_id\":\"dep-order-user-001\",\"dependent_service_id\":\"$SERVICE_USER\",\"dependency_type\":\"required\",\"is_critical\":true}"

echo "支付服务 -> 订单服务（关键依赖）"
curl -s -X POST $BASE_URL/services/$SERVICE_PAY/dependencies \
  -H "Content-Type: application/json" \
  -d "{\"request_id\":\"dep-pay-order-001\",\"dependent_service_id\":\"$SERVICE_ORDER\",\"dependency_type\":\"required\",\"is_critical\":true}"

echo ""
echo "=== 正常场景: 提交健康探针 ==="
echo "用户服务 - 健康"
curl -s -X POST $BASE_URL/services/$SERVICE_USER/probes \
  -H "Content-Type: application/json" \
  -d '{"request_id":"req-user-001","probe_type":"http","raw_status":"200","metrics":"latency:12ms"}'

echo ""
echo "订单服务 - 健康"
curl -s -X POST $BASE_URL/services/$SERVICE_ORDER/probes \
  -H "Content-Type: application/json" \
  -d '{"request_id":"req-order-001","probe_type":"http","raw_status":"ok","metrics":"latency:25ms"}'

echo ""
echo "支付服务 - 降级"
curl -s -X POST $BASE_URL/services/$SERVICE_PAY/probes \
  -H "Content-Type: application/json" \
  -d '{"request_id":"req-pay-001","probe_type":"http","raw_status":"degraded","metrics":"latency:200ms","error_msg":"部分支付延迟"}'

echo ""
echo "=== 重复请求测试 (幂等性) ==="
echo "重复提交相同 request_id 的探针..."
curl -s -X POST $BASE_URL/services/$SERVICE_USER/probes \
  -H "Content-Type: application/json" \
  -d '{"request_id":"req-user-001","probe_type":"http","raw_status":"200","metrics":"latency:12ms"}'

echo ""
echo "=== 异常场景: 提交不健康探针 ==="
echo "用户服务 - 异常"
curl -s -X POST $BASE_URL/services/$SERVICE_USER/probes \
  -H "Content-Type: application/json" \
  -d '{"request_id":"req-user-002","probe_type":"http","raw_status":"503","metrics":"latency:0","error_msg":"connection refused"}'

echo ""
echo "=== 状态推进: 降级状态机 ==="
echo "用户服务 - 推进到 degrading"
curl -s -X POST $BASE_URL/services/$SERVICE_USER/degrade/transition \
  -H "Content-Type: application/json" \
  -d '{"request_id":"degrade-user-001","reason":"service unhealthy","triggered_by":"health_monitor"}'

echo ""
echo "用户服务 - 推进到 degraded"
curl -s -X POST $BASE_URL/services/$SERVICE_USER/degrade/transition \
  -H "Content-Type: application/json" \
  -d '{"request_id":"degrade-user-002","reason":"prolonged unhealthy","triggered_by":"health_monitor"}'

echo ""
echo "=== 恢复服务健康 ==="
echo "用户服务 - 恢复健康"
curl -s -X POST $BASE_URL/services/$SERVICE_USER/probes \
  -H "Content-Type: application/json" \
  -d '{"request_id":"req-user-003","probe_type":"http","raw_status":"200","metrics":"latency:15ms"}'

echo ""
echo "用户服务 - 推进到 recovering"
DEGRADE_ACTION=$(curl -s -X POST $BASE_URL/services/$SERVICE_USER/degrade/transition \
  -H "Content-Type: application/json" \
  -d '{"request_id":"degrade-user-003","reason":"service recovered","triggered_by":"health_monitor"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "降级动作 ID: $DEGRADE_ACTION"

echo ""
echo "=== 人工处理: 确认恢复 ==="
curl -s -X POST $BASE_URL/services/$SERVICE_USER/recovery/confirm \
  -H "Content-Type: application/json" \
  -d "{\"request_id\":\"recovery-user-001\",\"degrade_action_id\":\"$DEGRADE_ACTION\",\"confirmed_by\":\"ops-admin\",\"confirm_type\":\"manual\",\"description\":\"人工确认服务已恢复正常\",\"is_success\":true}"

echo ""
echo "=== 查询区域健康摘要 ==="
curl -s $BASE_URL/regions/$REGION_BJ/summary | python3 -m json.tool

echo ""
echo "=== 查询探针历史 ==="
curl -s "$BASE_URL/services/$SERVICE_USER/probes/history?limit=5" | python3 -m json.tool

echo ""
echo "=== 查询降级历史 ==="
curl -s "$BASE_URL/services/$SERVICE_USER/degrade/history?limit=5" | python3 -m json.tool

echo ""
echo "=== 测试完成 ==="
echo ""
echo "环境变量:"
echo "REGION_BJ=$REGION_BJ"
echo "REGION_SH=$REGION_SH"
echo "SERVICE_USER=$SERVICE_USER"
echo "SERVICE_ORDER=$SERVICE_ORDER"
echo "SERVICE_PAY=$SERVICE_PAY"
