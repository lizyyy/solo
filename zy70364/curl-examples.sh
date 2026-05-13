#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 邮件退信处理 API - curl 示例 ==="
echo ""

echo "--- 1. 创建发送记录 ---"
curl -X POST "$BASE_URL/api/sends" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "send_001",
    "email": "user1@example.com",
    "business_type": "marketing",
    "subject": "促销活动",
    "message_id": "msg_001"
  }'
echo ""
echo ""

echo "--- 2. 检查发送决策 (初始状态) ---"
curl "$BASE_URL/api/can-send/user1@example.com?business_type=marketing"
echo ""
echo ""

echo "--- 3. 处理软退信事件 ---"
curl -X POST "$BASE_URL/api/bounces" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bounce_soft_001",
    "email": "user1@example.com",
    "type": "soft",
    "reason": "邮箱临时不可用，请稍后重试",
    "message_id": "msg_001"
  }'
echo ""
echo ""

echo "--- 4. 检查发送决策 (软退后，仍可重试) ---"
curl "$BASE_URL/api/can-send/user1@example.com?business_type=marketing"
echo ""
echo ""

echo "--- 5. 重复推送同一退信事件 (幂等性) ---"
curl -X POST "$BASE_URL/api/bounces" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bounce_soft_001",
    "email": "user1@example.com",
    "type": "soft",
    "reason": "邮箱临时不可用，请稍后重试",
    "message_id": "msg_001"
  }'
echo ""
echo ""

echo "--- 6. 创建硬退信发送记录 ---"
curl -X POST "$BASE_URL/api/sends" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "send_002",
    "email": "invalid_user@test.com",
    "business_type": "marketing",
    "subject": "产品更新",
    "message_id": "msg_002"
  }'
echo ""
echo ""

echo "--- 7. 处理硬退信事件 ---"
curl -X POST "$BASE_URL/api/bounces" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bounce_hard_001",
    "email": "invalid_user@test.com",
    "type": "hard",
    "reason": "550 5.1.1 User unknown",
    "message_id": "msg_002"
  }'
echo ""
echo ""

echo "--- 8. 检查硬退信后的营销邮件发送决策 (禁止发送) ---"
curl "$BASE_URL/api/can-send/invalid_user@test.com?business_type=marketing"
echo ""
echo ""

echo "--- 9. 检查硬退信后的账单邮件发送决策 (允许但需人工确认) ---"
curl "$BASE_URL/api/can-send/invalid_user@test.com?business_type=billing"
echo ""
echo ""

echo "--- 10. 创建退订用户发送记录 ---"
curl -X POST "$BASE_URL/api/sends" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "send_003",
    "email": "unsubscribed@user.com",
    "business_type": "marketing",
    "subject": "新功能上线",
    "message_id": "msg_003"
  }'
echo ""
echo ""

echo "--- 11. 处理退订事件 ---"
curl -X POST "$BASE_URL/api/bounces" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "bounce_unsub_001",
    "email": "unsubscribed@user.com",
    "type": "complaint",
    "reason": "User requested unsubscribe",
    "message_id": "msg_003"
  }'
echo ""
echo ""

echo "--- 12. 检查退订用户发送决策 (禁止营销邮件) ---"
curl "$BASE_URL/api/can-send/unsubscribed@user.com?business_type=marketing"
echo ""
echo ""

echo "--- 13. 查询地址状态 ---"
curl "$BASE_URL/api/addresses/user1@example.com"
echo ""
echo ""

echo "--- 14. 查询投递质量报告 ---"
curl "$BASE_URL/api/delivery-quality"
echo ""
echo ""

echo "=== 示例完成 ==="
