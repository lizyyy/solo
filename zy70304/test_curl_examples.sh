#!/bin/bash

BASE_URL="http://localhost:3000"
SECRET="your_secret_key_here_change_in_production"

generate_signature() {
  local payload="$1"
  local timestamp="$2"
  node -e "
    const crypto = require('crypto');
    const message = '\${timestamp}.\${payload}';
    console.log(crypto.createHmac('sha256', '$SECRET').update(message).digest('hex'));
  "
}

echo "=================================="
echo "1. 正常事件 - 签名有效，处理成功"
echo "=================================="
TS1=$(date +%s)
PAYLOAD1='{"order_id":"ORD-2026-001","amount":99.99,"provider":"alipay","status":"succeeded"}'
SIG1=$(generate_signature "$PAYLOAD1" "$TS1")

curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Event-Id: evt-normal-001" \
  -H "X-Provider: alipay" \
  -H "X-Event-Type: payment.succeeded" \
  -H "X-Timestamp: $TS1" \
  -H "X-Signature: $SIG1" \
  -d "$PAYLOAD1"

echo -e "\n\n=================================="
echo "2. 签名失败事件 - 签名无效"
echo "=================================="
TS2=$(date +%s)
PAYLOAD2='{"order_id":"ORD-2026-002","amount":199.99}'

curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Event-Id: evt-sigfail-001" \
  -H "X-Provider: wechat" \
  -H "X-Event-Type: payment.succeeded" \
  -H "X-Timestamp: $TS2" \
  -H "X-Signature: invalid_signature_here" \
  -d "$PAYLOAD2"

echo -e "\n\n=================================="
echo "3. 重复事件 - 同一 Event ID 再次推送"
echo "=================================="
curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Event-Id: evt-normal-001" \
  -H "X-Provider: alipay" \
  -H "X-Event-Type: payment.succeeded" \
  -H "X-Timestamp: $TS1" \
  -H "X-Signature: $SIG1" \
  -d "$PAYLOAD1"

echo -e "\n\n=================================="
echo "4. 先创建一个待修复的失败事件（模拟业务部分成功）"
echo "=================================="
TS3=$(date +%s)
PAYLOAD3='{"tracking_number":"SF123456","amount":88.00}'
SIG3=$(generate_signature "$PAYLOAD3" "$TS3")

curl -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Event-Id: evt-fixme-001" \
  -H "X-Provider: shunfeng" \
  -H "X-Event-Type: shipping.updated" \
  -H "X-Timestamp: $TS3" \
  -H "X-Signature: $SIG3" \
  -d "$PAYLOAD3"

echo -e "\n\n=================================="
echo "5. 查询事件列表"
echo "=================================="
curl "$BASE_URL/events"

echo -e "\n\n=================================="
echo "6. 查询 evt-fixme-001 事件详情（查看处理记录）"
echo "=================================="
curl "$BASE_URL/events/evt-fixme-001"

echo -e "\n\n=================================="
echo "7. 修复后重放 evt-fixme-001（使用 business_only 模式验证业务逻辑）"
echo "=================================="
curl -X POST "$BASE_URL/events/evt-fixme-001/replay" \
  -H "Content-Type: application/json" \
  -d '{"mode": "business_only", "actor": "operator-li"}'

echo -e "\n\n=================================="
echo "8. 再次查询 evt-fixme-001 确认重放成功"
echo "=================================="
curl "$BASE_URL/events/evt-fixme-001"

echo -e "\n\n=================================="
echo "9. 测试重放已确认完成的事件（应该被拒绝）"
echo "=================================="
curl -X POST "$BASE_URL/events/evt-normal-001/confirm" \
  -H "Content-Type: application/json" \
  -d '{"actor": "manager-zhang"}'

curl -X POST "$BASE_URL/events/evt-normal-001/replay" \
  -H "Content-Type: application/json" \
  -d '{"mode": "full", "actor": "operator-li"}'

echo -e "\n\n=================================="
echo "10. 测试禁用重放窗口"
echo "=================================="
curl -X POST "$BASE_URL/events/evt-sigfail-001/disable-replay" \
  -H "Content-Type: application/json" \
  -d '{"reason": "已确认是第三方测试请求，无需处理", "actor": "admin"}'

curl -X POST "$BASE_URL/events/evt-sigfail-001/replay" \
  -H "Content-Type: application/json" \
  -d '{"mode": "verify_signature_only", "actor": "operator-li"}'

echo -e "\n\n测试完成！"
