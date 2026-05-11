#!/bin/bash
BASE="http://localhost:3000"

echo "=== 步骤1: 查看门店和品类列表 ==="
echo "门店:"
curl -s "$BASE/stores" | python3 -m json.tool
echo ""
echo "品类:"
curl -s "$BASE/categories" | python3 -m json.tool
echo ""

echo ""
echo "=== 步骤2: 新开一张测试卡（用于演示） ==="
TEST_CARD=$(curl -s -X POST "$BASE/cards" -H "Content-Type: application/json" -d '{"card_type":"测试卡","initial_amount":500}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "新卡 ID: $TEST_CARD"
echo ""

echo "=== 步骤3: 为测试卡配置规则（限北京门店 + 餐饮品类 + 每日限额300）==="
curl -s -X POST "$BASE/cards/$TEST_CARD/rules" -H "Content-Type: application/json" -d '{"store_id":"store_beijing"}' | python3 -m json.tool
curl -s -X POST "$BASE/cards/$TEST_CARD/rules" -H "Content-Type: application/json" -d '{"category_id":"cat_food"}' | python3 -m json.tool
curl -s -X POST "$BASE/cards/$TEST_CARD/rules" -H "Content-Type: application/json" -d '{"daily_limit":300}' | python3 -m json.tool
echo ""

echo "=== 步骤4: 查看测试卡规则 ==="
curl -s "$BASE/cards/$TEST_CARD/rules" | python3 -m json.tool
echo ""

echo "=== 步骤5: 正常消费（北京门店 + 餐饮 + 200元）==="
CONSUME_TX=$(curl -s -X POST "$BASE/consume" -H "Content-Type: application/json" \
  -d "{\"card_id\":\"$TEST_CARD\",\"amount\":200,\"store_id\":\"store_beijing\",\"category_id\":\"cat_food\"}" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "消费成功，交易 ID: $CONSUME_TX"
echo ""

echo "=== 步骤6: 查看消费后卡信息 ==="
curl -s "$BASE/cards/$TEST_CARD/summary" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('余额:', d['card']['balance'], '| 状态:', d['card']['status'])"
echo ""

echo "=== 步骤7: 限额拦截测试（超过每日限额，再消费150）==="
echo "期望: DAILY_LIMIT_EXCEEDED 错误"
curl -s -X POST "$BASE/consume" -H "Content-Type: application/json" \
  -d "{\"card_id\":\"$TEST_CARD\",\"amount\":150,\"store_id\":\"store_beijing\",\"category_id\":\"cat_food\"}" | python3 -m json.tool
echo ""

echo "=== 步骤8: 门店限制拦截（尝试在上海门店消费）==="
echo "期望: STORE_NOT_ALLOWED 错误"
curl -s -X POST "$BASE/consume" -H "Content-Type: application/json" \
  -d "{\"card_id\":\"$TEST_CARD\",\"amount\":50,\"store_id\":\"store_shanghai\",\"category_id\":\"cat_food\"}" | python3 -m json.tool
echo ""

echo "=== 步骤9: 品类限制拦截（尝试洗护品类）==="
echo "期望: CATEGORY_NOT_ALLOWED 错误"
curl -s -X POST "$BASE/consume" -H "Content-Type: application/json" \
  -d "{\"card_id\":\"$TEST_CARD\",\"amount\":50,\"store_id\":\"store_beijing\",\"category_id\":\"cat_salon\"}" | python3 -m json.tool
echo ""

echo "=== 步骤10: 余额不足拦截（先充值10元再尝试消费320）==="
curl -s -X POST "$BASE/cards/$TEST_CARD/recharge" -H "Content-Type: application/json" -d '{"amount":10}' > /dev/null
echo "期望: INSUFFICIENT_BALANCE 错误（当前余额约310，尝试消费320）"
curl -s -X POST "$BASE/consume" -H "Content-Type: application/json" \
  -d "{\"card_id\":\"$TEST_CARD\",\"amount\":320,\"store_id\":\"store_beijing\",\"category_id\":\"cat_food\"}" | python3 -m json.tool
echo ""

echo "=== 步骤11: 退款回滚 ==="
echo "退款交易: $CONSUME_TX"
REFUND_RESULT=$(curl -s -X POST "$BASE/refund" -H "Content-Type: application/json" \
  -d "{\"tx_id\":\"$CONSUME_TX\",\"reason\":\"顾客取消订单\"}")
echo "$REFUND_RESULT" | python3 -m json.tool
echo ""

echo "=== 步骤12: 重复退款拦截 ==="
echo "期望: REFUND_ALREADY_DONE 错误"
curl -s -X POST "$BASE/refund" -H "Content-Type: application/json" \
  -d "{\"tx_id\":\"$CONSUME_TX\"}" | python3 -m json.tool
echo ""

echo "=== 步骤13: 冻结卡片（原因：疑似盗刷）==="
FREEZE_RESULT=$(curl -s -X POST "$BASE/cards/$TEST_CARD/freeze" -H "Content-Type: application/json" \
  -d '{"reason":"疑似盗刷","operator":"风控系统"}')
echo "$FREEZE_RESULT" | python3 -m json.tool
echo ""

echo "=== 步骤14: 冻结卡消费拦截 ==="
echo "期望: CARD_FROZEN 错误"
curl -s -X POST "$BASE/consume" -H "Content-Type: application/json" \
  -d "{\"card_id\":\"$TEST_CARD\",\"amount\":50,\"store_id\":\"store_beijing\",\"category_id\":\"cat_food\"}" | python3 -m json.tool
echo ""

echo "=== 步骤15: 解冻卡片（原因：风控核实无异常）==="
curl -s -X POST "$BASE/cards/$TEST_CARD/unfreeze" -H "Content-Type: application/json" \
  -d '{"reason":"风控核实无异常","operator":"客服"}' | python3 -m json.tool
echo ""

echo "=== 步骤16: 查看完整卡汇总（余额+规则+流水+对账差异）==="
echo "===== 卡汇总 ====="
curl -s "$BASE/cards/$TEST_CARD/summary" | python3 -m json.tool
echo ""
