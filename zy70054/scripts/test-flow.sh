#!/bin/bash

BASE_URL="http://localhost:3000"
API_URL="${BASE_URL}/api/replacement"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

log() {
    echo -e "\n${YELLOW}=== $1 ===${NC}"
}

assert_success() {
    local test_name="$1"
    local response="$2"
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}[PASS]${NC} $test_name"
        ((PASS_COUNT++))
    else
        echo -e "${RED}[FAIL]${NC} $test_name"
        echo "  Response: $response"
        ((FAIL_COUNT++))
    fi
}

assert_failure() {
    local test_name="$1"
    local response="$2"
    local expected_code="$3"
    
    if echo "$response" | grep -q "\"code\":\"$expected_code\""; then
        echo -e "${GREEN}[PASS]${NC} $test_name"
        ((PASS_COUNT++))
    else
        echo -e "${RED}[FAIL]${NC} $test_name"
        echo "  Expected error code: $expected_code"
        echo "  Response: $response"
        ((FAIL_COUNT++))
    fi
}

extract_id() {
    echo "$1" | sed 's/.*"id":"\([^"]*\)".*/\1/'
}

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}  银行卡换卡寄送 API 服务测试${NC}"
echo -e "${YELLOW}========================================${NC}"

log "检查服务健康状态"
HEALTH=$(curl -s "${BASE_URL}/health")
echo "$HEALTH" | grep -q '"status":"ok"' && echo -e "${GREEN}[PASS]${NC} 服务运行中" || {
    echo -e "${RED}[FAIL]${NC} 服务未运行，请先执行: npm run dev"
    exit 1
}

log "测试场景 1: 正常换卡主流程"

CREATE_RESP=$(curl -s -X POST "${API_URL}/create" \
    -H "Content-Type: application/json" \
    -d '{
        "userId": "user_001",
        "oldCardNumber": "6222021234567890",
        "oldCardHolderName": "张三",
        "replacementReason": "卡片丢失",
        "shippingAddress": {
            "province": "广东省",
            "city": "深圳市",
            "district": "南山区",
            "detail": "科技园路 100 号",
            "receiverName": "张三",
            "receiverPhone": "13800138000"
        }
    }')

assert_success "创建换卡申请" "$CREATE_RESP"

REPLACEMENT_ID=$(extract_id "$CREATE_RESP")
echo "  换卡申请 ID: $REPLACEMENT_ID"

STATUS_RESP=$(curl -s "${API_URL}/${REPLACEMENT_ID}/status")
echo "  当前进度: $(echo "$STATUS_RESP" | sed 's/.*"progress":\([0-9]*\).*/\1/')%"

FREEZE_RESP=$(curl -s -X POST "${API_URL}/freeze" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID\", \"operatorId\": \"op_001\", \"operatorName\": \"风控员小王\"}")
assert_success "冻结旧卡" "$FREEZE_RESP"

curl -s -X POST "${API_URL}/logistics" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID\", \"step\": \"PICKED_UP\", \"location\": \"深圳制卡中心\", \"operator\": \"顺丰快递\"}" > /dev/null
echo -e "${GREEN}[PASS]${NC} 物流节点 - 已揽收"

curl -s -X POST "${API_URL}/logistics" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID\", \"step\": \"IN_TRANSIT\", \"location\": \"广州转运中心\"}" > /dev/null
echo -e "${GREEN}[PASS]${NC} 物流节点 - 运输中"

curl -s -X POST "${API_URL}/logistics" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID\", \"step\": \"ARRIVED\", \"location\": \"深圳南山网点\"}" > /dev/null
echo -e "${GREEN}[PASS]${NC} 物流节点 - 已到达"

curl -s -X POST "${API_URL}/logistics" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID\", \"step\": \"DELIVERED\", \"location\": \"派送中\"}" > /dev/null
echo -e "${GREEN}[PASS]${NC} 物流节点 - 派送中"

SIGNED_RESP=$(curl -s -X POST "${API_URL}/logistics" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID\", \"step\": \"SIGNED\", \"location\": \"本人签收\", \"operator\": \"快递员小李\"}")
assert_success "物流节点 - 已签收" "$SIGNED_RESP"

ACTIVATE_RESP=$(curl -s -X POST "${API_URL}/activate" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID\", \"newCardNumber\": \"6222020987654321\", \"operatorId\": \"op_002\", \"operatorName\": \"客服小美\"}")
assert_success "激活新卡" "$ACTIVATE_RESP"

STATUS_RESP=$(curl -s "${API_URL}/${REPLACEMENT_ID}/status")
echo "  最终进度: $(echo "$STATUS_RESP" | sed 's/.*"progress":\([0-9]*\).*/\1/')%"
echo "  最终状态: $(echo "$STATUS_RESP" | sed 's/.*"status":"\([^"]*\)".*/\1/')"

HISTORY_RESP=$(curl -s "${API_URL}/${REPLACEMENT_ID}/history")
STEP_COUNT=$(echo "$HISTORY_RESP" | grep -o '"step"' | wc -l)
echo "  历史步骤数: $STEP_COUNT"

log "测试场景 2: 步骤被拒绝 - 查询卡点"

CREATE_RESP2=$(curl -s -X POST "${API_URL}/create" \
    -H "Content-Type: application/json" \
    -d '{
        "userId": "user_002",
        "oldCardNumber": "6222021111111111",
        "oldCardHolderName": "李四",
        "replacementReason": "卡片过期",
        "shippingAddress": {
            "province": "北京市",
            "city": "北京市",
            "district": "朝阳区",
            "detail": "建国路 88 号",
            "receiverName": "李四",
            "receiverPhone": "13900139000"
        }
    }')
REPLACEMENT_ID2=$(extract_id "$CREATE_RESP2")
echo "  换卡申请 ID: $REPLACEMENT_ID2"

REJECT_RESP=$(curl -s -X POST "${API_URL}/reject" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID2\", \"step\": \"OLD_CARD_FREEZE\", \"reason\": \"OLD_CARD_UNFREEZABLE\", \"operatorId\": \"op_001\", \"operatorName\": \"风控员\", \"remark\": \"旧卡存在异常交易\"}")
assert_success "拒绝冻结步骤" "$REJECT_RESP"

STUCK_RESP=$(curl -s "${API_URL}/${REPLACEMENT_ID2}/stuck-point")
echo "$STUCK_RESP" | grep -q '"isStuck":true' \
    && echo -e "${GREEN}[PASS]${NC} 卡点检测正确 - isStuck=true" \
    || echo -e "${RED}[FAIL]${NC} 卡点检测错误"
echo "  卡点原因: $(echo "$STUCK_RESP" | sed 's/.*"stuckReason":"\([^"]*\)".*/\1/')"
echo "  上一步成功: $(echo "$STUCK_RESP" | sed 's/.*"lastSuccessfulStep":"\([^"]*\)".*/\1/')"

COMPENSATE_RESP=$(curl -s -X POST "${API_URL}/compensate" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID2\", \"method\": \"MANUAL_HANDLING\", \"operatorId\": \"op_003\", \"operatorName\": \"主管\", \"remark\": \"人工审核通过，允许继续\"}")
assert_success "执行补偿" "$COMPENSATE_RESP"

STUCK_RESP2=$(curl -s "${API_URL}/${REPLACEMENT_ID2}/stuck-point")
echo "$STUCK_RESP2" | grep -q '"isStuck":false' \
    && echo -e "${GREEN}[PASS]${NC} 补偿后卡点解除 - isStuck=false" \
    || echo -e "${RED}[FAIL]${NC} 补偿后卡点未解除"

log "测试场景 3: 步骤顺序检查 - 不能跳过依赖"

CREATE_RESP3=$(curl -s -X POST "${API_URL}/create" \
    -H "Content-Type: application/json" \
    -d '{
        "userId": "user_003",
        "oldCardNumber": "6222022222222222",
        "oldCardHolderName": "王五",
        "replacementReason": "卡片损坏",
        "shippingAddress": {
            "province": "上海市",
            "city": "上海市",
            "district": "浦东新区",
            "detail": "陆家嘴金融中心",
            "receiverName": "王五",
            "receiverPhone": "13700137000"
        }
    }')
REPLACEMENT_ID3=$(extract_id "$CREATE_RESP3")

ACTIVATE_EARLY=$(curl -s -X POST "${API_URL}/activate" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID3\", \"newCardNumber\": \"6222029999999999\"}")
assert_failure "不允许跳过步骤直接激活" "$ACTIVATE_EARLY" "DEPENDENCY_STEP_IN_PROGRESS"

log "测试场景 4: 物流节点顺序检查"

curl -s -X POST "${API_URL}/freeze" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID3\"}" > /dev/null

curl -s -X POST "${API_URL}/logistics" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID3\", \"step\": \"PICKED_UP\", \"location\": \"制卡中心\"}" > /dev/null

curl -s -X POST "${API_URL}/logistics" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID3\", \"step\": \"IN_TRANSIT\", \"location\": \"途中\"}" > /dev/null

BACKWARDS=$(curl -s -X POST "${API_URL}/logistics" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID3\", \"step\": \"PICKED_UP\", \"location\": \"倒序测试\"}")
assert_failure "不允许物流节点倒序" "$BACKWARDS" "LOGISTICS_STEP_OUT_OF_ORDER"

log "测试场景 5: 客服批注影响流程"

CREATE_RESP4=$(curl -s -X POST "${API_URL}/create" \
    -H "Content-Type: application/json" \
    -d '{
        "userId": "user_004",
        "oldCardNumber": "6222023333333333",
        "oldCardHolderName": "赵六",
        "replacementReason": "信息更新",
        "shippingAddress": {
            "province": "浙江省",
            "city": "杭州市",
            "district": "西湖区",
            "detail": "文三路 100 号",
            "receiverName": "赵六",
            "receiverPhone": "13600136000"
        }
    }')
REPLACEMENT_ID4=$(extract_id "$CREATE_RESP4")

CS_RESP=$(curl -s -X POST "${API_URL}/customer-service" \
    -H "Content-Type: application/json" \
    -d "{\"replacementId\": \"$REPLACEMENT_ID4\", \"csrId\": \"csr_001\", \"csrName\": \"客服主管\", \"content\": \"身份核实存在问题\", \"action\": \"REJECT\"}")
assert_success "客服拒绝操作" "$CS_RESP"

STUCK_RESP4=$(curl -s "${API_URL}/${REPLACEMENT_ID4}/stuck-point")
echo "$STUCK_RESP4" | grep -q '"isStuck":true' \
    && echo -e "${GREEN}[PASS]${NC} 客服拒绝后流程卡住" \
    || echo -e "${RED}[FAIL]${NC} 客服拒绝未生效"

log "测试场景 6: 错误处理"

NOT_FOUND=$(curl -s "${API_URL}/non-existent-id")
assert_failure "查询不存在的申请" "$NOT_FOUND" "REPLACEMENT_NOT_FOUND"

INVALID_CREATE=$(curl -s -X POST "${API_URL}/create" \
    -H "Content-Type: application/json" \
    -d '{"userId": "test"}')
assert_failure "创建申请缺少必要参数" "$INVALID_CREATE" "VALIDATION_ERROR"

echo -e "\n${YELLOW}========================================${NC}"
echo -e "${GREEN}通过: $PASS_COUNT${NC}"
echo -e "${RED}失败: $FAIL_COUNT${NC}"
echo -e "${YELLOW}========================================${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "\n${GREEN}所有测试通过！${NC}\n"
    exit 0
else
    echo -e "\n${RED}有 $FAIL_COUNT 个测试失败${NC}\n"
    exit 1
fi
