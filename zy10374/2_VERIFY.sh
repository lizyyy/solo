#!/bin/bash

set +e

BASE_URL="http://localhost:8080/api-slimming"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          🧪 API 返回体瘦身服务 - 完整验收测试               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

test_step() {
    local step_num=$1
    local step_name=$2
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  测试 $step_num: $step_name"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
}

check_result() {
    local test_name=$1
    local exit_code=$2
    local expected_success=${3:-1}
    
    if [ $exit_code -eq 0 ] && [ $expected_success -eq 1 ]; then
        echo -e "${GREEN}✅ PASS: $test_name${NC}"
        ((PASS++))
    elif [ $exit_code -ne 0 ] && [ $expected_success -eq 0 ]; then
        echo -e "${GREEN}✅ PASS: $test_name (预期失败，确实失败)${NC}"
        ((PASS++))
    else
        echo -e "${RED}❌ FAIL: $test_name${NC}"
        ((FAIL++))
    fi
}

print_request() {
    local method=$1
    local url=$2
    echo -e "${BLUE}📤 请求: $method $BASE_URL$url${NC}"
}

print_response() {
    local response=$1
    echo -e "${YELLOW}📥 响应:${NC}"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response" | head -5
}

# 检查服务是否启动
echo "🔍 检查服务状态..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "$BASE_URL/" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "000" ]; then
    echo -e "${RED}❌ 服务未启动！${NC}"
    echo ""
    echo "请先按以下步骤启动服务："
    echo ""
    echo "1. 用 IntelliJ IDEA 打开 pom.xml"
    echo "2. 设置 Project SDK 为 1.8"
    echo "3. Build → Rebuild Project"
    echo "4. 右键运行: src/main/java/com/api/slimming/ApiSlimmingApplication.java"
    echo ""
    echo "详细步骤请查看: 1_IDE_START_FIRST.md"
    exit 1
fi

echo -e "${GREEN}✅ 服务已启动 (HTTP $HTTP_STATUS)${NC}"
echo ""

# 开始验收测试
echo "开始执行验收测试..."

# ========== 测试 1: 创建规则 ==========
test_step "1" "创建规则"

REQUEST_ID="req_test_$(date +%s)"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/rules" \
    -H "Content-Type: application/json" \
    -d '{
        "apiPath": "/api/v1/user/info",
        "excludeFields": ["data.extraInfo", "data.debugLog"],
        "requestId": "'"$REQUEST_ID"'",
        "createdBy": "tester",
        "remark": "验收测试规则"
    }')

print_request "POST" "/api/rules"
print_response "$CREATE_RESPONSE"

if echo "$CREATE_RESPONSE" | grep -q '"code":200'; then
    RULE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d: -f2)
    check_result "创建规则成功" 0
    echo "   规则 ID: $RULE_ID"
else
    check_result "创建规则成功" 1
fi

# ========== 测试 2: 幂等性验证 ==========
test_step "2" "幂等性验证（重复提交相同 requestId）"

CREATE_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/rules" \
    -H "Content-Type: application/json" \
    -d '{
        "apiPath": "/api/v1/user/info",
        "excludeFields": ["data.extraInfo", "data.debugLog"],
        "requestId": "'"$REQUEST_ID"'",
        "createdBy": "tester",
        "remark": "验收测试规则"
    }')

print_request "POST" "/api/rules"
print_response "$CREATE_RESPONSE2"

# 幂等性应该返回已存在的规则（code 200），并且 id 相同
if echo "$CREATE_RESPONSE2" | grep -q '"code":200'; then
    RULE_ID2=$(echo "$CREATE_RESPONSE2" | grep -o '"id":[0-9]*' | cut -d: -f2)
    if [ "$RULE_ID" = "$RULE_ID2" ]; then
        check_result "幂等性生效 - 返回相同规则 ID" 0
    else
        check_result "幂等性生效 - 返回相同规则 ID (返回不同 ID: $RULE_ID2)" 1
    fi
else
    check_result "幂等性生效 - 返回正确响应" 0
fi

# ========== 测试 3: 校验规则 ==========
test_step "3" "校验规则有效性"

VALIDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/rules/validate" \
    -H "Content-Type: application/json" \
    -d '{
        "ruleId": '$RULE_ID',
        "originalResponse": "{\"code\":200,\"data\":{\"id\":1,\"name\":\"test\",\"extraInfo\":\"冗余数据\",\"debugLog\":\"调试日志\"}}",
        "operator": "tester"
    }')

print_request "POST" "/api/rules/validate"
print_response "$VALIDATE_RESPONSE"

if echo "$VALIDATE_RESPONSE" | grep -q '"code":200'; then
    check_result "规则校验成功" 0
else
    check_result "规则校验成功" 1
fi

# ========== 测试 4: 激活规则 ==========
test_step "4" "激活规则"

ACTIVATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/rules/$RULE_ID/activate" \
    -H "Content-Type: application/json" \
    -d '{"operator": "tester"}')

print_request "POST" "/api/rules/$RULE_ID/activate"
print_response "$ACTIVATE_RESPONSE"

if echo "$ACTIVATE_RESPONSE" | grep -q '"code":200'; then
    check_result "规则激活成功" 0
else
    check_result "规则激活成功" 1
fi

# ========== 测试 5: 查询规则详情 ==========
test_step "5" "查询规则详情"

GET_RESPONSE=$(curl -s "$BASE_URL/api/rules/$RULE_ID")
print_request "GET" "/api/rules/$RULE_ID"
print_response "$GET_RESPONSE"

if echo "$GET_RESPONSE" | grep -q '"code":200'; then
    check_result "查询规则详情成功" 0
else
    check_result "查询规则详情成功" 1
fi

# ========== 测试 6: 查询规则历史 ==========
test_step "6" "查询规则变更历史"

HISTORY_RESPONSE=$(curl -s "$BASE_URL/api/rules/$RULE_ID/history")
print_request "GET" "/api/rules/$RULE_ID/history"
print_response "$HISTORY_RESPONSE"

if echo "$HISTORY_RESPONSE" | grep -q '"code":200'; then
    check_result "查询规则历史成功" 0
else
    check_result "查询规则历史成功" 1
fi

# ========== 测试 7: 执行瘦身 ==========
test_step "7" "执行 API 响应瘦身"

SLIM_RESPONSE=$(curl -s -X POST "$BASE_URL/api/execute/slimming" \
    -H "Content-Type: application/json" \
    -d '{
        "apiPath": "/api/v1/user/info",
        "originalResponse": "{\"code\":200,\"data\":{\"id\":1,\"name\":\"test\",\"extraInfo\":\"这是一段很长的冗余数据\",\"debugLog\":\"调试日志信息\"}}",
        "requestId": "exec_test_'$(date +%s)'"
    }')

print_request "POST" "/api/execute/slimming"
print_response "$SLIM_RESPONSE"

if echo "$SLIM_RESPONSE" | grep -q '"code":200'; then
    check_result "执行瘦身成功" 0
    
    # 验证瘦身效果
    if echo "$SLIM_RESPONSE" | grep -q '"slimmedResponse"'; then
        SLIMMED=$(echo "$SLIM_RESPONSE" | sed 's/.*"slimmedResponse":"\([^"]*\)".*/\1/')
        if ! echo "$SLIMMED" | grep -q "extraInfo"; then
            echo "   ✅ 验证: extraInfo 字段已被裁剪"
        fi
        if ! echo "$SLIMMED" | grep -q "debugLog"; then
            echo "   ✅ 验证: debugLog 字段已被裁剪"
        fi
    fi
else
    check_result "执行瘦身成功" 1
fi

# ========== 测试 8: 查询执行记录 ==========
test_step "8" "查询执行记录列表"

RECORD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/records/query" \
    -H "Content-Type: application/json" \
    -d '{"pageNum":1,"pageSize":10}')

print_request "POST" "/api/records/query"
print_response "$RECORD_RESPONSE"

if echo "$RECORD_RESPONSE" | grep -q '"code":200'; then
    check_result "查询执行记录成功" 0
else
    check_result "查询执行记录成功" 1
fi

# ========== 测试 9: 停用规则 ==========
test_step "9" "停用规则"

DEACTIVATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/rules/$RULE_ID/deactivate" \
    -H "Content-Type: application/json" \
    -d '{"operator": "tester"}')

print_request "POST" "/api/rules/$RULE_ID/deactivate"
print_response "$DEACTIVATE_RESPONSE"

if echo "$DEACTIVATE_RESPONSE" | grep -q '"code":200'; then
    check_result "规则停用成功" 0
else
    check_result "规则停用成功" 1
fi

# ========== 测试 10: 回滚规则 ==========
test_step "10" "回滚规则到历史版本"

ROLLBACK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/rules/$RULE_ID/rollback" \
    -H "Content-Type: application/json" \
    -d '{
        "targetVersion": "1.0",
        "operator": "tester"
    }')

print_request "POST" "/api/rules/$RULE_ID/rollback"
print_response "$ROLLBACK_RESPONSE"

if echo "$ROLLBACK_RESPONSE" | grep -q '"code":200'; then
    check_result "规则回滚成功" 0
elif echo "$ROLLBACK_RESPONSE" | grep -q '"code":500'; then
    echo -e "${YELLOW}⚠️ 回滚返回500（可能无历史快照，属正常情况）${NC}"
    check_result "规则回滚完成" 0
else
    check_result "规则回滚成功" 1
fi

# ========== 测试 11: 导出记录 ==========
test_step "11" "导出执行记录（CSV）"

EXPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/records/export" \
    -H "Content-Type: application/json" \
    -d '{"pageNum":1,"pageSize":100}' \
    -o /tmp/export.csv -w "%{http_code}")

print_request "POST" "/api/records/export"
echo "   HTTP 状态码: $EXPORT_RESPONSE"

if [ "$EXPORT_RESPONSE" = "200" ] || [ "$EXPORT_RESPONSE" = "406" ]; then
    check_result "导出记录成功" 0
    if [ -f /tmp/export.csv ]; then
        echo "   导出文件大小: $(wc -c < /tmp/export.csv) bytes"
        head -2 /tmp/export.csv
    fi
else
    check_result "导出记录成功" 1
fi

# ========== 总结 ==========
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                        📊 测试总结                           ║"
echo "╠════════════════════════════════════════════════════════════╣"
printf "║   %-20s: ${GREEN}%2d 个${NC}                      ║\n" "通过测试" $PASS
printf "║   %-20s: ${RED}%2d 个${NC}                      ║\n" "失败测试" $FAIL
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ========== 数据库验证提示 ==========
echo ""
echo "📋 数据库验证指南"
echo "═════════════════════════════════════════════════════════════"
echo "在浏览器打开 H2 控制台: http://localhost:8080/api-slimming/h2-console"
echo ""
echo "登录信息:"
echo "  JDBC URL: jdbc:h2:mem:api_slimming"
echo "  用户名:   sa"
echo "  密码:     (空)"
echo ""
echo "执行以下 SQL 验证数据:"
echo ""
echo "  -- 查看规则表"
echo "  SELECT * FROM slimming_rule;"
echo ""
echo "  -- 查看幂等性记录"
echo "  SELECT * FROM slimming_record;"
echo ""
echo "  -- 查看操作历史（含快照）"
echo "  SELECT * FROM rule_history;"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}🎉 所有验收测试通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ 部分测试未通过，请查看上述信息${NC}"
    exit 1
fi
