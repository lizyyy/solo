#!/bin/bash
set -e

BASE_URL="http://localhost:8000/api/v1"
echo "========================================"
echo "  账单试算缓存 API 演示"
echo "========================================"
echo ""
echo "服务地址: $BASE_URL"
echo "OpenAPI 文档: http://localhost:8000/docs"
echo ""
echo "请确保服务已启动: python main.py 或 uvicorn main:app --reload"
echo ""

read -p "按 Enter 继续..."

echo ""
echo "========================================"
echo "1. 检查服务健康状态"
echo "========================================"
curl -s "http://localhost:8000/health" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "2. 给用户 user_001 分配一张优惠券"
echo "========================================"
curl -s -X POST "$BASE_URL/users/user_001/coupons/coupon_newuser20" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "3. 第一次试算：用户 user_001 购买专业版 x1，使用优惠券 NEWUSER20"
echo "   (首次调用，未命中缓存，is_cached=false)"
echo "========================================"
TRIAL1_RESP=$(curl -s -X POST "$BASE_URL/billing/trial" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "plan_id": "plan_pro",
    "coupon_ids": ["coupon_newuser20"],
    "quantity": 1,
    "billing_period_months": 1,
    "metadata": {}
  }')
echo "$TRIAL1_RESP" | python3 -m json.tool
TRIAL1_ID=$(echo "$TRIAL1_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['trial_id'])")
echo "本次试算 trial_id: $TRIAL1_ID"
echo ""

echo ""
echo "========================================"
echo "4. 相同参数再次试算"
echo "   (第二次调用，命中缓存，is_cached=true)"
echo "========================================"
curl -s -X POST "$BASE_URL/billing/trial" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "plan_id": "plan_pro",
    "coupon_ids": ["coupon_newuser20"],
    "quantity": 1,
    "billing_period_months": 1,
    "metadata": {}
  }' | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "5. 查询该次试算的缓存状态"
echo "========================================"
curl -s "$BASE_URL/cache/query/$TRIAL1_ID" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "6. 给用户 user_001 再分配一张优惠券（用户权益变化，局部失效）"
echo "========================================"
curl -s -X POST "$BASE_URL/users/user_001/coupons/coupon_summer50" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "7. 再次查询之前的试算缓存"
echo "   (由于用户优惠券变化，该缓存已失效，is_hit=false)"
echo "========================================"
curl -s "$BASE_URL/cache/query/$TRIAL1_ID" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "8. 另一个用户 user_002 试算"
echo "   (用户不同，缓存键不同，重新计算)"
echo "========================================"
TRIAL2_RESP=$(curl -s -X POST "$BASE_URL/billing/trial" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_002",
    "plan_id": "plan_pro",
    "coupon_ids": [],
    "quantity": 1,
    "billing_period_months": 1,
    "metadata": {}
  }')
echo "$TRIAL2_RESP" | python3 -m json.tool
TRIAL2_ID=$(echo "$TRIAL2_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['trial_id'])")
echo "本次试算 trial_id: $TRIAL2_ID"
echo ""

echo ""
echo "========================================"
echo "9. 更新价格规则（规则版本变化，全局失效）"
echo "   税率从 13% 调整为 9%，并增加 5% 折扣"
echo "========================================"
curl -s -X POST "$BASE_URL/price-rules?id=global_rule&version=2&name=2026%20Q2%20夏季促销规则&tax_rate=0.09&discount_percent=5.0&is_active=true" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "10. 查询 user_002 的试算缓存"
echo "    (由于价格规则版本变化，缓存失效)"
echo "========================================"
curl -s "$BASE_URL/cache/query/$TRIAL2_ID" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "11. 再次试算相同参数（使用新规则）"
echo "========================================"
curl -s -X POST "$BASE_URL/billing/trial" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_002",
    "plan_id": "plan_pro",
    "coupon_ids": [],
    "quantity": 1,
    "billing_period_months": 1,
    "metadata": {}
  }' | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "12. user_003 进行一次试算，然后记录退款"
echo "========================================"
TRIAL3_RESP=$(curl -s -X POST "$BASE_URL/billing/trial" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_003",
    "plan_id": "plan_enterprise",
    "coupon_ids": [],
    "quantity": 1,
    "billing_period_months": 12,
    "metadata": {"channel": "sales_direct"}
  }')
echo "$TRIAL3_RESP" | python3 -m json.tool
TRIAL3_ID=$(echo "$TRIAL3_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['trial_id'])")
echo "本次试算 trial_id: $TRIAL3_ID"
echo ""
echo "记录退款..."
curl -s -X POST "$BASE_URL/events/refund/$TRIAL3_ID?reason=用户%20申请%20全额%20退款" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "13. 查询该退款相关的缓存"
echo "========================================"
curl -s "$BASE_URL/cache/query/$TRIAL3_ID" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "14. 缓存命中报告"
echo "    展示所有缓存记录、组成键、版本信息、失效事件"
echo "========================================"
curl -s "$BASE_URL/cache/report" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "15. 手动失效特定用户的所有缓存"
echo "========================================"
curl -s -X POST "$BASE_URL/cache/invalidate?user_id=user_001&reason=演示%20手动%20失效" | python3 -m json.tool
echo ""

echo ""
echo "========================================"
echo "演示完成！"
echo "========================================"
echo "关键 API 速查:"
echo "  POST /api/v1/billing/trial           - 账单试算（自动缓存）"
echo "  GET  /api/v1/cache/query/{trial_id}  - 查询某次试算的缓存状态"
echo "  GET  /api/v1/cache/report            - 缓存命中报告（含失效原因）"
echo "  POST /api/v1/cache/invalidate        - 手动失效缓存"
echo "  POST /api/v1/events/refund/{id}      - 记录退款事件"
echo "  POST /api/v1/price-rules             - 创建/更新价格规则版本"
echo "  POST /api/v1/users/{uid}/coupons/{cid} - 给用户分配优惠券"
echo ""
