#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== API请求体兼容系统 - curl示例 ==="
echo ""

echo "=== 1. 旧客户端示例 (使用旧字段) ==="
echo "说明：客户端版本 1.0.0，使用旧字段 user_name, mobile_phone, user_age, home_address"
echo ""
curl -X POST "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "X-Client-Version: 1.0.0" \
  -d '{
    "user_name": "张三",
    "mobile_phone": "13800138000",
    "user_age": 30,
    "home_address": "北京市朝阳区"
  }'

echo ""
echo ""

echo "=== 2. 新客户端示例 (使用新字段) ==="
echo "说明：客户端版本 2.0.0，使用新字段 username, phone, age, address"
echo ""
curl -X POST "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "X-Client-Version: 2.0.0" \
  -d '{
    "username": "李四",
    "phone": "13900139000",
    "age": 28,
    "address": "上海市浦东新区",
    "deviceType": "ios",
    "appSource": "appstore",
    "isWebview": false
  }'

echo ""
echo ""

echo "=== 3. 字段冲突示例 (新旧字段同时存在) ==="
echo "说明：同时存在 user_name 和 username，会返回400错误和修正建议"
echo ""
curl -X POST "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "X-Client-Version: 1.5.0" \
  -d '{
    "user_name": "王五",
    "username": "wangwu",
    "phone": "13700137000"
  }'

echo ""
echo ""

echo "=== 4. 灰度字段拒绝示例 (低版本使用灰度字段) ==="
echo "说明：版本 1.4.0 尝试使用 newFeatureEnabled (需要 1.5.0+)"
echo ""
curl -X POST "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "X-Client-Version: 1.4.0" \
  -d '{
    "username": "赵六",
    "phone": "13600136000",
    "newFeatureEnabled": true
  }'

echo ""
echo ""

echo "=== 5. 弃用字段警告示例 ==="
echo "说明：使用即将下线的 legacy_id 字段，会返回警告"
echo ""
curl -X POST "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "X-Client-Version: 1.2.0" \
  -d '{
    "username": "钱七",
    "phone": "13500135000",
    "legacy_id": "old_user_123"
  }'

echo ""
echo ""

echo "=== 6. 重复请求幂等示例 ==="
echo "说明：使用相同的 X-Idempotency-Key 发送两次请求"
echo ""
IDEMPOTENCY_KEY="test-idempotent-key-$(date +%s)"

echo "--- 第一次请求 ---"
curl -X POST "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "X-Client-Version: 2.0.0" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "username": "孙八",
    "phone": "13400134000"
  }'

echo ""
echo ""

echo "--- 第二次请求 (幂等) ---"
curl -X POST "$BASE_URL/api/user/profile" \
  -H "Content-Type: application/json" \
  -H "X-Client-Version: 2.0.0" \
  -H "X-Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "username": "孙八",
    "phone": "13400134000"
  }'

echo ""
echo ""

echo "=== 7. 查询兼容报告 ==="
echo "说明：查看按客户端版本统计的旧字段使用情况"
echo ""
curl -X GET "$BASE_URL/api/compatibility/report"

echo ""
echo ""
echo "=== 示例执行完成 ==="
