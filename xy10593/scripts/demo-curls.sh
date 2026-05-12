#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "售楼认购锁房API - 演示脚本"
echo "=========================================="
echo ""

separator() {
  echo ""
  echo "------------------------------------------"
  echo ""
}

print_header() {
  echo ""
  echo "=========================================="
  echo "$1"
  echo "=========================================="
}

get_code() {
  echo "$1" | grep -o '"'$2'":"[^"]*"' | sed 's/"'$2'":"\([^"]*\)"/\1/'
}

wait_user() {
  echo ""
  read -p "按回车继续下一步..." -n 1 -r
  echo ""
}

print_header "【1/9】健康检查和API信息"
echo ""
echo "GET $BASE_URL/health"
curl -s "$BASE_URL/health" | python3 -m json.tool
separator

echo "GET $BASE_URL/"
curl -s "$BASE_URL/" | python3 -m json.tool
separator

print_header "【2/9】查询预置基础数据"
echo ""
echo "--- 项目列表 ---"
curl -s "$BASE_URL/api/projects" | python3 -m json.tool
separator

echo "--- 房源列表 ---"
curl -s "$BASE_URL/api/properties" | python3 -m json.tool
separator

echo "--- 渠道列表 ---"
curl -s "$BASE_URL/api/channels" | python3 -m json.tool
separator

echo "--- 客户列表 ---"
curl -s "$BASE_URL/api/customers" | python3 -m json.tool
wait_user

print_header "【3/9】场景一：正常认购流程"
echo ""
echo "步骤1: 查询房源状态 (PROP-A101)"
PROP_A101=$(curl -s "$BASE_URL/api/properties?project_id=&status=" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data['data']:
    if p['property_code'] == 'PROP-A101':
        print(p['id'])
")
echo "房源ID: $PROP_A101"
curl -s "$BASE_URL/api/properties/$PROP_A101" | python3 -m json.tool
separator

echo "步骤2: 查询客户王小明 (CUS-001)"
CUS_001=$(curl -s "$BASE_URL/api/customers" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data['data']:
    if c['customer_code'] == 'CUS-001':
        print(c['id'])
")
echo "客户ID: $CUS_001"
curl -s "$BASE_URL/api/customers/$CUS_001" | python3 -m json.tool
separator

echo "步骤3: 查询渠道链家房产 (CHN-001)"
CHN_001=$(curl -s "$BASE_URL/api/channels" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for ch in data['data']:
    if ch['channel_code'] == 'CHN-001':
        print(ch['id'])
")
echo "渠道ID: $CHN_001"
separator

echo "步骤4: 创建认购单"
BOOKING_RESULT=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d "{
    \"property_id\": \"$PROP_A101\",
    \"customer_id\": \"$CUS_001\",
    \"channel_id\": \"$CHN_001\",
    \"total_price\": 3500000,
    \"booking_amount\": 50000,
    \"deposit_amount\": 200000,
    \"lock_source\": \"manual\",
    \"notes\": \"客户王小明认购1号楼1单元101\",
    \"created_by\": \"销售专员A\"
  }")
echo "$BOOKING_RESULT" | python3 -m json.tool

BOOKING_ID=$(echo "$BOOKING_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['id'])
")
BOOKING_CODE=$(echo "$BOOKING_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['booking_code'])
")
echo ""
echo "认购单ID: $BOOKING_ID"
echo "认购单号: $BOOKING_CODE"
separator

echo "步骤5: 锁定房源"
curl -s -X POST "$BASE_URL/api/bookings/$BOOKING_ID/lock" \
  -H "Content-Type: application/json" \
  -d '{"operator": "销售专员A"}' | python3 -m json.tool
separator

echo "步骤6: 验证房源已锁定"
echo "--- 房源状态 ---"
curl -s "$BASE_URL/api/properties/$PROP_A101" | python3 -m json.tool
separator

echo "步骤7: 尝试重复锁定 (预期：失败)"
echo "--- 尝试用同一房源创建新认购单 ---"
curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d "{
    \"property_id\": \"$PROP_A101\",
    \"customer_id\": \"$CUS_001\",
    \"channel_id\": \"$CHN_001\",
    \"total_price\": 3500000,
    \"booking_amount\": 50000,
    \"deposit_amount\": 200000,
    \"created_by\": \"测试\"
  }" | python3 -m json.tool
separator

echo "步骤8: 创建定金单"
DEPOSIT_RESULT=$(curl -s -X POST "$BASE_URL/api/deposits" \
  -H "Content-Type: application/json" \
  -d "{
    \"booking_id\": \"$BOOKING_ID\",
    \"amount\": 200000,
    \"payment_method\": \"bank_transfer\",
    \"created_by\": \"财务A\"
  }")
echo "$DEPOSIT_RESULT" | python3 -m json.tool

DEPOSIT_ID=$(echo "$DEPOSIT_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['id'])
")
echo "定金单ID: $DEPOSIT_ID"
separator

echo "步骤9: 支付回调 (模拟支付成功)"
CALLBACK_ID="CB-$(date +%Y%m%d%H%M%S)-001"
echo "回调ID: $CALLBACK_ID"
curl -s -X POST "$BASE_URL/api/deposits/callback" \
  -H "Content-Type: application/json" \
  -d "{
    \"callback_id\": \"$CALLBACK_ID\",
    \"deposit_id\": \"$DEPOSIT_ID\",
    \"success\": true,
    \"transaction_no\": \"TXN-20260512-001\",
    \"operator\": \"payment_gateway\"
  }" | python3 -m json.tool
separator

echo "步骤10: 验证支付回调幂等 (相同callback_id再次调用)"
echo "--- 重复回调 ---"
curl -s -X POST "$BASE_URL/api/deposits/callback" \
  -H "Content-Type: application/json" \
  -d "{
    \"callback_id\": \"$CALLBACK_ID\",
    \"deposit_id\": \"$DEPOSIT_ID\",
    \"success\": true,
    \"transaction_no\": \"TXN-20260512-001\",
    \"operator\": \"payment_gateway\"
  }" | python3 -m json.tool
separator

echo "步骤11: 验证认购单和房源状态"
echo "--- 认购单详情 ---"
curl -s "$BASE_URL/api/bookings/$BOOKING_ID/detail" | python3 -m json.tool
separator

echo "--- 房源状态 ---"
curl -s "$BASE_URL/api/properties/$PROP_A101" | python3 -m json.tool
separator

echo "步骤12: 创建佣金记录"
curl -s -X POST "$BASE_URL/api/commissions" \
  -H "Content-Type: application/json" \
  -d "{
    \"booking_id\": \"$BOOKING_ID\",
    \"operator\": \"佣金专员\"
  }" | python3 -m json.tool
separator

echo "步骤13: 审批佣金"
COMMISSION=$(curl -s "$BASE_URL/api/commissions" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data['data']['commissions']:
    print(c['id'])
    break
")
echo "佣金ID: $COMMISSION"
curl -s -X POST "$BASE_URL/api/commissions/$COMMISSION/approve" \
  -H "Content-Type: application/json" \
  -d '{"operator": "财务主管"}' | python3 -m json.tool
wait_user

print_header "【4/9】场景二：改名审批流程"
echo ""
echo "步骤1: 创建新客户李小红"
CUS_002=$(curl -s "$BASE_URL/api/customers" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data['data']:
    if c['customer_code'] == 'CUS-002':
        print(c['id'])
")
echo "新客户ID: $CUS_002"
separator

echo "步骤2: 创建改名申请"
NC_RESULT=$(curl -s -X POST "$BASE_URL/api/name-changes" \
  -H "Content-Type: application/json" \
  -d "{
    \"booking_id\": \"$BOOKING_ID\",
    \"old_customer_id\": \"$CUS_001\",
    \"new_customer_id\": \"$CUS_002\",
    \"reason\": \"实际购房人为李小红，王小明为代看\",
    \"created_by\": \"销售专员A\"
  }")
echo "$NC_RESULT" | python3 -m json.tool

NC_ID=$(echo "$NC_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['id'])
")
echo "改名申请ID: $NC_ID"
separator

echo "步骤3: 提交审批"
curl -s -X POST "$BASE_URL/api/name-changes/$NC_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator": "销售专员A"}' | python3 -m json.tool
separator

echo "步骤4: 审批通过"
curl -s -X POST "$BASE_URL/api/name-changes/$NC_ID/approve" \
  -H "Content-Type: application/json" \
  -d "{
    \"approval_notes\": \"改名原因合理，审批通过\",
    \"operator\": \"审批主管\"
  }" | python3 -m json.tool
separator

echo "步骤5: 验证改名结果"
echo "--- 认购单客户已变更 ---"
curl -s "$BASE_URL/api/bookings/$BOOKING_ID" | python3 -m json.tool
separator

echo "--- 佣金已冻结 (因改名) ---"
curl -s "$BASE_URL/api/commissions/$COMMISSION" | python3 -m json.tool
separator

echo "--- 客户变更历史 ---"
curl -s "$BASE_URL/api/name-changes/changes" | python3 -m json.tool
wait_user

print_header "【5/9】场景三：退定解锁流程"
echo ""
echo "步骤1: 查询另一房源 (PROP-A102)"
PROP_A102=$(curl -s "$BASE_URL/api/properties" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data['data']:
    if p['property_code'] == 'PROP-A102':
        print(p['id'])
")
echo "房源ID: $PROP_A102"
echo "--- 房源初始状态 ---"
curl -s "$BASE_URL/api/properties/$PROP_A102" | python3 -m json.tool
separator

echo "步骤2: 快速创建认购单并锁定"
echo "--- 创建认购单 ---"
BOOKING2_RESULT=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d "{
    \"property_id\": \"$PROP_A102\",
    \"customer_id\": \"$CUS_001\",
    \"channel_id\": \"$CHN_001\",
    \"total_price\": 3200000,
    \"booking_amount\": 50000,
    \"deposit_amount\": 150000,
    \"notes\": \"王小明认购1号楼1单元102\",
    \"created_by\": \"销售专员B\"
  }")
echo "$BOOKING2_RESULT" | python3 -m json.tool

BOOKING2_ID=$(echo "$BOOKING2_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['id'])
")
echo ""
echo "认购单ID: $BOOKING2_ID"
separator

echo "--- 锁定房源 ---"
curl -s -X POST "$BASE_URL/api/bookings/$BOOKING2_ID/lock" \
  -H "Content-Type: application/json" \
  -d '{"operator": "销售专员B"}' | python3 -m json.tool
separator

echo "步骤3: 创建定金单并支付"
DEPOSIT2_RESULT=$(curl -s -X POST "$BASE_URL/api/deposits" \
  -H "Content-Type: application/json" \
  -d "{
    \"booking_id\": \"$BOOKING2_ID\",
    \"amount\": 150000,
    \"payment_method\": \"wechat\",
    \"created_by\": \"财务A\"
  }")
DEPOSIT2_ID=$(echo "$DEPOSIT2_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['id'])
")
echo "定金单ID: $DEPOSIT2_ID"

CALLBACK_ID2="CB-$(date +%Y%m%d%H%M%S)-002"
curl -s -X POST "$BASE_URL/api/deposits/callback" \
  -H "Content-Type: application/json" \
  -d "{
    \"callback_id\": \"$CALLBACK_ID2\",
    \"deposit_id\": \"$DEPOSIT2_ID\",
    \"success\": true,
    \"transaction_no\": \"TXN-20260512-002\",
    \"operator\": \"payment_gateway\"
  }" | python3 -m json.tool
separator

echo "步骤4: 创建佣金"
curl -s -X POST "$BASE_URL/api/commissions" \
  -H "Content-Type: application/json" \
  -d "{
    \"booking_id\": \"$BOOKING2_ID\",
    \"operator\": \"佣金专员\"
  }" | python3 -m json.tool
separator

echo "步骤5: 创建退定申请"
REFUND_RESULT=$(curl -s -X POST "$BASE_URL/api/refunds" \
  -H "Content-Type: application/json" \
  -d "{
    \"booking_id\": \"$BOOKING2_ID\",
    \"amount\": 150000,
    \"reason\": \"客户资金周转问题，申请退定\",
    \"created_by\": \"销售专员B\"
  }")
echo "$REFUND_RESULT" | python3 -m json.tool

REFUND_ID=$(echo "$REFUND_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['id'])
")
echo "退定申请ID: $REFUND_ID"
separator

echo "步骤6: 提交审批"
curl -s -X POST "$BASE_URL/api/refunds/$REFUND_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator": "销售专员B"}' | python3 -m json.tool
separator

echo "步骤7: 审批通过"
curl -s -X POST "$BASE_URL/api/refunds/$REFUND_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"operator": "财务主管"}' | python3 -m json.tool
separator

echo "步骤8: 执行退款"
curl -s -X POST "$BASE_URL/api/refunds/$REFUND_ID/execute" \
  -H "Content-Type: application/json" \
  -d "{
    \"refund_method\": \"bank_transfer\",
    \"transaction_no\": \"RF-20260512-001\",
    \"operator\": \"财务A\"
  }" | python3 -m json.tool
separator

echo "步骤9: 验证退定结果"
echo "--- 房源已解锁 ---"
curl -s "$BASE_URL/api/properties/$PROP_A102" | python3 -m json.tool
separator

echo "--- 认购单状态 ---"
curl -s "$BASE_URL/api/bookings/$BOOKING2_ID" | python3 -m json.tool
separator

echo "--- 定金已退还 ---"
curl -s "$BASE_URL/api/deposits/$DEPOSIT2_ID" | python3 -m json.tool
separator

echo "--- 佣金已作废 ---"
COMMISSION2=$(curl -s "$BASE_URL/api/commissions" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data['data']['commissions']:
    print(c['id'])
" | sed -n '2p')
echo "佣金ID: $COMMISSION2"
curl -s "$BASE_URL/api/commissions/$COMMISSION2" | python3 -m json.tool
wait_user

print_header "【6/9】场景四：人工修正记录"
echo ""
echo "步骤1: 人工修正客户信息"
curl -s -X POST "$BASE_URL/api/customers/$CUS_001/correct" \
  -H "Content-Type: application/json" \
  -d "{
    \"field_name\": \"phone\",
    \"new_value\": \"13999999999\",
    \"reason\": \"客户换手机号，人工更新\",
    \"operator\": \"客户专员\"
  }" | python3 -m json.tool
separator

echo "步骤2: 查看修正记录"
curl -s "$BASE_URL/api/customers/$CUS_001/history" | python3 -m json.tool
wait_user

print_header "【7/9】场景五：失败路径演示"
echo ""
echo "案例1: 定金未到账尝试创建佣金 (预期：失败)"
PROP_A201=$(curl -s "$BASE_URL/api/properties" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for p in data['data']:
    if p['property_code'] == 'PROP-A201':
        print(p['id'])
")
echo "房源ID: $PROP_A201"

BOOKING3_RESULT=$(curl -s -X POST "$BASE_URL/api/bookings" \
  -H "Content-Type: application/json" \
  -d "{
    \"property_id\": \"$PROP_A201\",
    \"customer_id\": \"$CUS_001\",
    \"channel_id\": \"$CHN_001\",
    \"total_price\": 3600000,
    \"booking_amount\": 50000,
    \"deposit_amount\": 180000,
    \"created_by\": \"测试\"
  }")
BOOKING3_ID=$(echo "$BOOKING3_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['id'])
")
echo "认购单ID: $BOOKING3_ID"

echo "--- 锁定房源 ---"
curl -s -X POST "$BASE_URL/api/bookings/$BOOKING3_ID/lock" \
  -H "Content-Type: application/json" \
  -d '{"operator": "测试"}' > /dev/null

echo "--- 尝试创建佣金 (认购单仅锁定，未支付定金) ---"
curl -s -X POST "$BASE_URL/api/commissions" \
  -H "Content-Type: application/json" \
  -d "{
    \"booking_id\": \"$BOOKING3_ID\",
    \"operator\": \"测试\"
  }" | python3 -m json.tool
separator

echo "案例2: 支付失败回调"
DEPOSIT3_RESULT=$(curl -s -X POST "$BASE_URL/api/deposits" \
  -H "Content-Type: application/json" \
  -d "{
    \"booking_id\": \"$BOOKING3_ID\",
    \"amount\": 180000,
    \"payment_method\": \"alipay\",
    \"created_by\": \"测试\"
  }")
DEPOSIT3_ID=$(echo "$DEPOSIT3_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data['data']['id'])
")
echo "定金单ID: $DEPOSIT3_ID"

echo "--- 支付失败回调 ---"
CALLBACK_ID3="CB-$(date +%Y%m%d%H%M%S)-003"
curl -s -X POST "$BASE_URL/api/deposits/callback" \
  -H "Content-Type: application/json" \
  -d "{
    \"callback_id\": \"$CALLBACK_ID3\",
    \"deposit_id\": \"$DEPOSIT3_ID\",
    \"success\": false,
    \"transaction_no\": \"TXN-20260512-003\",
    \"failure_reason\": \"余额不足，支付失败\",
    \"operator\": \"payment_gateway\"
  }" | python3 -m json.tool
separator

echo "--- 验证定金失败状态 ---"
curl -s "$BASE_URL/api/deposits/$DEPOSIT3_ID" | python3 -m json.tool
separator

echo "--- 验证认购单仍锁定 ---"
curl -s "$BASE_URL/api/bookings/$BOOKING3_ID" | python3 -m json.tool
wait_user

print_header "【8/9】查询接口 - 历史记录和状态变化"
echo ""
echo "--- 认购单详情 (含所有关联) ---"
curl -s "$BASE_URL/api/bookings/$BOOKING_ID/detail" | python3 -m json.tool
separator

echo "--- 房源时间线 ---"
curl -s "$BASE_URL/api/properties/$PROP_A101/timeline" | python3 -m json.tool
separator

echo "--- 定金账本 ---"
curl -s "$BASE_URL/api/deposits" | python3 -m json.tool
separator

echo "--- 客户变更 ---"
curl -s "$BASE_URL/api/name-changes/changes" | python3 -m json.tool
separator

echo "--- 渠道佣金 ---"
curl -s "$BASE_URL/api/commissions" | python3 -m json.tool
wait_user

print_header "【9/9】报告导出"
echo ""
echo "--- 仪表盘 ---"
curl -s "$BASE_URL/api/reports/dashboard" | python3 -m json.tool
separator

echo "--- 完整报告 (JSON) ---"
curl -s "$BASE_URL/api/reports/full" | python3 -m json.tool
separator

echo "--- 文本格式报告 ---"
curl -s "$BASE_URL/api/reports/export?format=text"
separator

echo ""
echo "=========================================="
echo "演示完成！"
echo "=========================================="
echo ""
echo "关键验证点："
echo "1. 房源PROP-A101: 状态应为 deposited (定金已到账)"
echo "2. 房源PROP-A102: 状态应为 available (已退定解锁)"
echo "3. 认购单1客户: 应为李小红 (改名成功)"
echo "4. 佣金1状态: 应为 frozen (因改名冻结)"
echo "5. 佣金2状态: 应为 void (因退定作废)"
echo "6. 定金账本: 应有已支付和已退还记录"
echo ""
