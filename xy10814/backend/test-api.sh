#!/bin/bash

BASE_URL="http://localhost:3001"

echo "======================================"
echo "Mock 合约回放器 - API 测试脚本"
echo "======================================"
echo ""

echo "1. 测试健康检查"
curl -s "$BASE_URL/api/health" | head -5
echo ""
echo ""

echo "2. 测试获取用户信息 - 成功场景（500ms延迟）"
time curl -s "$BASE_URL/api/replay/api/user"
echo ""
echo ""

echo "3. 测试获取用户信息 - 未授权场景"
curl -s -H "Authorization:" "$BASE_URL/api/replay/api/user"
echo ""
echo ""

echo "4. 测试创建订单 - 成功场景（随机延迟）"
time curl -s -X POST "$BASE_URL/api/replay/api/order"
echo ""
echo ""

echo "5. 测试创建订单 - 重复提交场景"
curl -s -X POST -H "X-Idempotency-Key: duplicate" "$BASE_URL/api/replay/api/order"
echo ""
echo ""

echo "6. 测试支付接口 - 余额不足场景"
curl -s -X POST -H "Content-Type: application/json" -d '{"amount": "1000"}' "$BASE_URL/api/replay/api/payment"
echo ""
echo ""

echo "7. 测试无匹配路径"
curl -s "$BASE_URL/api/replay/api/nonexist"
echo ""
echo ""

echo "8. 获取所有合约列表"
curl -s "$BASE_URL/api/contracts" | head -100
echo ""
echo ""

echo "9. 获取统计数据"
curl -s "$BASE_URL/api/history/statistics"
echo ""
echo ""

echo "======================================"
echo "测试完成！"
echo "======================================"
