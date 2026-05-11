#!/bin/bash

BASE_URL="http://localhost:3001"
PERIOD="2026Q2"

echo "=========================================="
echo "  会员等级保级 API - 完整演示脚本"
echo "=========================================="
echo ""

echo "===== 第一步：查看等级配置 ====="
echo "当前等级配置（银卡 1000分，金卡 3000分，黑卡 10000分）："
curl -s "$BASE_URL/api/tiers" | python3 -m json.tool
echo ""

echo "===== 第二步：创建三个测试会员 ====="
echo "创建会员 张三（银卡潜力）："
MEMBER1=$(curl -s -X POST "$BASE_URL/api/members" -H "Content-Type: application/json" -d '{"name":"张三","phone":"13800000001"}')
echo "$MEMBER1" | python3 -m json.tool
MEMBER1_ID=$(echo "$MEMBER1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ""

echo "创建会员 李四（金卡潜力）："
MEMBER2=$(curl -s -X POST "$BASE_URL/api/members" -H "Content-Type: application/json" -d '{"name":"李四","phone":"13800000002"}')
echo "$MEMBER2" | python3 -m json.tool
MEMBER2_ID=$(echo "$MEMBER2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ""

echo "创建会员 王五（保级失败演示）："
MEMBER3=$(curl -s -X POST "$BASE_URL/api/members" -H "Content-Type: application/json" -d '{"name":"王五","phone":"13800000003"}')
echo "$MEMBER3" | python3 -m json.tool
MEMBER3_ID=$(echo "$MEMBER3" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ""

echo "=========================================="
echo "场景 1：张三 - 从普通会员升级到银卡"
echo "=========================================="
echo ""

echo "张三消费 1200 积分（超过银卡门槛 1000）："
TX1=$(curl -s -X POST "$BASE_URL/api/transactions/consume" -H "Content-Type: application/json" -d "{\"member_id\":\"$MEMBER1_ID\",\"points\":1200,\"period\":\"$PERIOD\",\"reason\":\"购买商品 A\"}")
echo "$TX1" | python3 -m json.tool
TX1_ID=$(echo "$TX1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ""

echo "执行周期结算 $PERIOD："
curl -s -X POST "$BASE_URL/api/settlements/settle/$PERIOD" | python3 -m json.tool
echo ""

echo "确认张三的等级："
curl -s -X POST "$BASE_URL/api/settlements/confirm" -H "Content-Type: application/json" -H "X-Operator: 运营主管" -d "{\"member_id\":\"$MEMBER1_ID\",\"period\":\"$PERIOD\"}" | python3 -m json.tool
echo ""

echo "查看张三当前等级："
curl -s "$BASE_URL/api/members/$MEMBER1_ID" | python3 -m json.tool
echo ""

echo "=========================================="
echo "场景 2：李四 - 升级到金卡"
echo "=========================================="
echo ""

echo "李四消费 3500 积分（超过金卡门槛 3000）："
curl -s -X POST "$BASE_URL/api/transactions/consume" -H "Content-Type: application/json" -d "{\"member_id\":\"$MEMBER2_ID\",\"points\":3500,\"period\":\"$PERIOD\",\"reason\":\"大额消费\"}" | python3 -m json.tool
echo ""

echo "重算周期（更新李四的等级）："
curl -s -X POST "$BASE_URL/api/settlements/recalculate/$PERIOD" | python3 -m json.tool
echo ""

echo "确认李四的等级："
curl -s -X POST "$BASE_URL/api/settlements/confirm" -H "Content-Type: application/json" -H "X-Operator: 运营主管" -d "{\"member_id\":\"$MEMBER2_ID\",\"period\":\"$PERIOD\"}" | python3 -m json.tool
echo ""

echo "=========================================="
echo "场景 3：王五 - 保级失败（积分不足）"
echo "=========================================="
echo ""

echo "王五消费 500 积分（银卡门槛 1000，差 500）："
curl -s -X POST "$BASE_URL/api/transactions/consume" -H "Content-Type: application/json" -d "{\"member_id\":\"$MEMBER3_ID\",\"points\":500,\"period\":\"$PERIOD\",\"reason\":\"零星消费\"}" | python3 -m json.tool
echo ""

echo "重算周期："
curl -s -X POST "$BASE_URL/api/settlements/recalculate/$PERIOD" | python3 -m json.tool
echo ""

echo "确认王五的等级："
curl -s -X POST "$BASE_URL/api/settlements/confirm" -H "Content-Type: application/json" -H "X-Operator: 运营主管" -d "{\"member_id\":\"$MEMBER3_ID\",\"period\":\"$PERIOD\"}" | python3 -m json.tool
echo ""

echo "=========================================="
echo "场景 4：张三 - 退款导致降级（跨周期退款演示）"
echo "=========================================="
echo ""

echo "先给张三再消费一笔，让他升金卡："
TX2=$(curl -s -X POST "$BASE_URL/api/transactions/consume" -H "Content-Type: application/json" -d "{\"member_id\":\"$MEMBER1_ID\",\"points\":2000,\"period\":\"$PERIOD\",\"reason\":\"追加消费\"}")
echo "$TX2" | python3 -m json.tool
TX2_ID=$(echo "$TX2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo ""

echo "重算周期（张三现在应该是金卡 1200+2000=3200）："
curl -s -X POST "$BASE_URL/api/settlements/recalculate/$PERIOD?force=true" | python3 -m json.tool
echo ""

echo "现在对张三的第一笔消费进行退款（跨周期演示逻辑）："
curl -s -X POST "$BASE_URL/api/transactions/refund" -H "Content-Type: application/json" -H "X-Operator: 客服" -d "{\"transaction_id\":\"$TX2_ID\",\"reason\":\"商品退货\"}" | python3 -m json.tool
echo ""

echo "重算周期（张三回到银卡 1200）："
curl -s -X POST "$BASE_URL/api/settlements/recalculate/$PERIOD?force=true" | python3 -m json.tool
echo ""

echo "=========================================="
echo "场景 5：王五 - 主管人工调整积分后重新确认等级"
echo "=========================================="
echo ""

echo "主管给王五赠送 600 积分（需提供原因）："
curl -s -X POST "$BASE_URL/api/transactions/adjust" -H "Content-Type: application/json" -H "X-Operator: 运营主管" -d "{\"member_id\":\"$MEMBER3_ID\",\"points\":600,\"reason\":\"老客户关怀赠送积分\",\"period\":\"$PERIOD\"}" | python3 -m json.tool
echo ""

echo "重算周期（王五现在有 500+600=1100，应该是银卡）："
curl -s -X POST "$BASE_URL/api/settlements/recalculate/$PERIOD?force=true" | python3 -m json.tool
echo ""

echo "重新确认王五的等级："
curl -s -X POST "$BASE_URL/api/settlements/confirm" -H "Content-Type: application/json" -H "X-Operator: 运营主管" -d "{\"member_id\":\"$MEMBER3_ID\",\"period\":\"$PERIOD\"}" | python3 -m json.tool
echo ""

echo "=========================================="
echo "===== 第三步：查询统计信息 ====="
echo "=========================================="
echo ""

echo "1. 各等级人数统计："
curl -s "$BASE_URL/api/settlements/statistics/$PERIOD" | python3 -m json.tool
echo ""

echo "2. 临界会员（距离门槛 90% 范围内的会员）："
curl -s "$BASE_URL/api/settlements/critical/$PERIOD" | python3 -m json.tool
echo ""

echo "3. 异常流水（退款、人工调整等）："
curl -s "$BASE_URL/api/transactions/anomalous" | python3 -m json.tool
echo ""

echo "4. 结算历史："
curl -s "$BASE_URL/api/settlements/history/$PERIOD" | python3 -m json.tool
echo ""

echo "=========================================="
echo "演示完成！"
echo "=========================================="
