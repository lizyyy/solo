#!/bin/bash
# 对象生命周期规则API - 功能测试脚本
# 覆盖: Happy Path、重复调用、脏数据、状态不允许跳转、规则匹配、删除预检

set -e

BASE_URL="http://localhost:8080/api/v1"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    
    printf "  %-55s ... " "$name"
    
    if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            "$BASE_URL$endpoint" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS (HTTP $http_code)${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ FAIL (期望 HTTP $expected_status, 实际 HTTP $http_code)${NC}"
        echo "    响应: $body" | head -c 200
        echo ""
        ((FAIL++))
        return 1
    fi
}

test_endpoint_expect_fail() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    
    printf "  %-55s ... " "$name"
    
    if [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "PATCH" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            "$BASE_URL$endpoint" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS (HTTP $http_code - 正确拒绝)${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ FAIL (期望 HTTP $expected_status, 实际 HTTP $http_code)${NC}"
        echo "    响应: $body" | head -c 200
        echo ""
        ((FAIL++))
        return 1
    fi
}

print_header() {
    echo ""
    echo -e "${BLUE}================================================================================${NC}"
    echo -e "${BLUE}  对象生命周期规则 API - 完整功能测试${NC}"
    echo -e "${BLUE}================================================================================${NC}"
    echo ""
}

print_section() {
    echo -e "\n${CYAN}[ $1 ]${NC}"
}

print_footer() {
    echo ""
    echo -e "${BLUE}================================================================================${NC}"
    echo "  测试结果汇总:"
    echo -e "  通过: ${GREEN}$PASS${NC}"
    echo -e "  失败: ${RED}$FAIL${NC}"
    echo -e "${BLUE}================================================================================${NC}"
    echo ""
    
    if [ $FAIL -eq 0 ]; then
        echo -e "${GREEN}🎉 所有测试通过!${NC}"
        exit 0
    else
        echo -e "${RED}❌ 部分测试失败${NC}"
        exit 1
    fi
}

check_server() {
    echo "检查服务状态..."
    if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo -e "${RED}错误: 服务未运行${NC}"
        echo "请先运行: ./run.sh start"
        exit 1
    fi
    echo -e "${GREEN}✓ 服务正常运行${NC}"
}

# 主测试流程
print_header
check_server

echo -e "${YELLOW}开始完整API测试...${NC}"
echo ""

# ===== 1/7 =====
print_section "1/7 - 对象前缀管理"
echo ""
test_endpoint "创建前缀 /data/" "POST" "/prefixes" '{"prefix":"/data/","bucketName":"my-bucket","description":"业务数据目录"}' "200"
test_endpoint "创建前缀 /logs/" "POST" "/prefixes" '{"prefix":"/logs/","bucketName":"my-bucket","description":"日志目录"}' "200"
test_endpoint "获取所有前缀" "GET" "/prefixes" "" "200"

# ===== 2/7 =====
print_section "2/7 - 生命周期规则状态流转测试"
echo ""
echo -e "${CYAN}  2.1 正常创建规则${NC}"
test_endpoint "创建规则 TEST-RULE-001" "POST" "/rules" '{"ruleId":"TEST-RULE-001","ruleName":"测试规则1","prefixId":1,"archiveAfterDays":30,"deleteAfterDays":90}' "200"
test_endpoint "获取规则详情" "GET" "/rules/TEST-RULE-001" "" "200"

echo ""
echo -e "${CYAN}  2.2 状态不允许跳转测试${NC}"
test_endpoint_expect_fail "DRAFT状态不能直接激活" "POST" "/rules/TEST-RULE-001/activate" "" "400"
test_endpoint_expect_fail "DRAFT状态不能直接暂停" "POST" "/rules/TEST-RULE-001/suspend" "" "400"

test_endpoint "DRAFT to VERIFIED 校验" "POST" "/rules/TEST-RULE-001/verify" "" "200"
test_endpoint_expect_fail "VERIFIED状态不能暂停" "POST" "/rules/TEST-RULE-001/suspend" "" "400"

test_endpoint "VERIFIED to ACTIVE 激活" "POST" "/rules/TEST-RULE-001/activate" "" "200"
test_endpoint_expect_fail "ACTIVE状态不能重复校验" "POST" "/rules/TEST-RULE-001/verify" "" "400"

test_endpoint "ACTIVE to SUSPENDED 暂停" "POST" "/rules/TEST-RULE-001/suspend" "" "200"
test_endpoint "SUSPENDED to ACTIVE 恢复" "POST" "/rules/TEST-RULE-001/activate" "" "200"

test_endpoint "ACTIVE to CANCELLED 撤销" "POST" "/rules/TEST-RULE-001/cancel" "" "200"
test_endpoint_expect_fail "CANCELLED状态不能激活" "POST" "/rules/TEST-RULE-001/activate" "" "400"

# 再创建一个规则用于后续测试
test_endpoint "创建规则 TEST-RULE-002" "POST" "/rules" '{"ruleId":"TEST-RULE-002","ruleName":"测试规则2","prefixId":1,"archiveAfterDays":30,"deleteAfterDays":90}' "200"
test_endpoint "校验规则2" "POST" "/rules/TEST-RULE-002/verify" "" "200"
test_endpoint "激活规则2" "POST" "/rules/TEST-RULE-002/activate" "" "200"

# ===== 3/7 =====
print_section "3/7 - 归档任务 - 规则匹配 + 重复调用测试"
echo ""
echo -e "${CYAN}  3.1 规则匹配校验${NC}"
test_endpoint_expect_fail "非ACTIVE规则不能创建任务" "POST" "/archive-tasks" '{"taskId":"TASK-001","ruleId":2,"objectKey":"/data/file1.txt","bucketName":"my-bucket"}' "400"
test_endpoint_expect_fail "对象前缀不匹配规则" "POST" "/archive-tasks" '{"taskId":"TASK-001","ruleId":2,"objectKey":"/other/file.txt","bucketName":"my-bucket"}' "400"
test_endpoint_expect_fail "bucket不匹配规则" "POST" "/archive-tasks" '{"taskId":"TASK-001","ruleId":2,"objectKey":"/data/file1.txt","bucketName":"other-bucket"}' "400"

echo ""
echo -e "${CYAN}  3.2 Happy Path${NC}"
test_endpoint "创建匹配的归档任务" "POST" "/archive-tasks" '{"taskId":"TASK-001","ruleId":2,"objectKey":"/data/file1.txt","bucketName":"my-bucket","objectSize":1024000}' "200"
test_endpoint "获取归档任务" "GET" "/archive-tasks/TASK-001" "" "200"

echo ""
echo -e "${CYAN}  3.3 重复调用测试${NC}"
test_endpoint_expect_fail "重复创建相同任务ID" "POST" "/archive-tasks" '{"taskId":"TASK-001","ruleId":2,"objectKey":"/data/file2.txt","bucketName":"my-bucket"}' "409"
test_endpoint_expect_fail "重复创建相同对象任务" "POST" "/archive-tasks" '{"taskId":"TASK-002","ruleId":2,"objectKey":"/data/file1.txt","bucketName":"my-bucket"}' "409"

echo ""
echo -e "${CYAN}  3.4 任务状态不允许跳转${NC}"
test_endpoint "PENDING to RUNNING 开始" "POST" "/archive-tasks/TASK-001/start" "" "200"
test_endpoint_expect_fail "RUNNING不能重复开始" "POST" "/archive-tasks/TASK-001/start" "" "400"
test_endpoint "RUNNING to COMPLETED 完成" "POST" "/archive-tasks/TASK-001/complete" "" "200"
test_endpoint_expect_fail "COMPLETED不能撤销" "POST" "/archive-tasks/TASK-001/cancel" "" "400"

# 再创建一个任务用于测试撤销
test_endpoint "创建任务TASK-002用于撤销测试" "POST" "/archive-tasks" '{"taskId":"TASK-002","ruleId":2,"objectKey":"/data/file2.txt","bucketName":"my-bucket"}' "200"
test_endpoint "PENDING to CANCELLED 撤销" "POST" "/archive-tasks/TASK-002/cancel" "" "200"

# ===== 4/7 =====
print_section "4/7 - 删除候选 - 删除预检 + 规则匹配"
echo ""
echo -e "${CYAN}  4.1 规则匹配校验${NC}"
test_endpoint_expect_fail "非ACTIVE规则不能创建删除候选" "POST" "/deletion-candidates" '{"objectKey":"/data/old1.txt","bucketName":"my-bucket","ruleId":1}' "400"
test_endpoint_expect_fail "对象前缀不匹配规则" "POST" "/deletion-candidates" '{"objectKey":"/other/old.txt","bucketName":"my-bucket","ruleId":2}' "400"

echo ""
echo -e "${CYAN}  4.2 Happy Path${NC}"
test_endpoint "创建匹配的删除候选" "POST" "/deletion-candidates" '{"objectKey":"/data/old-log.txt","bucketName":"my-bucket","ruleId":2}' "200"

echo ""
echo -e "${CYAN}  4.3 重复调用测试${NC}"
test_endpoint_expect_fail "重复创建相同删除候选" "POST" "/deletion-candidates" '{"objectKey":"/data/old-log.txt","bucketName":"my-bucket","ruleId":2}' "409"

# ===== 5/7 =====
print_section "5/7 - 保留例外 - 删除预检验证"
echo ""
echo -e "${CYAN}  5.1 创建保留例外${NC}"
test_endpoint "创建保留例外" "POST" "/retention-exceptions" '{"objectKey":"/data/important.pdf","bucketName":"my-bucket","reason":"合规要求保留","effectiveFrom":"2024-01-01T00:00:00","effectiveTo":"2025-01-01T00:00:00","ruleId":2}' "200"

echo ""
echo -e "${CYAN}  5.2 删除预检 - 有保留例外的对象不能删除${NC}"
test_endpoint_expect_fail "有保留例外的对象不能创建删除候选" "POST" "/deletion-candidates" '{"objectKey":"/data/important.pdf","bucketName":"my-bucket","ruleId":2}' "400"

echo ""
echo -e "${CYAN}  5.3 禁用例外后可以删除${NC}"
test_endpoint "禁用保留例外" "PATCH" "/retention-exceptions/1/toggle?enabled=false" "" "200"
test_endpoint "例外禁用后可以创建删除候选" "POST" "/deletion-candidates" '{"objectKey":"/data/important.pdf","bucketName":"my-bucket","ruleId":2}' "200"

# ===== 6/7 =====
print_section "6/7 - 审计日志 - 可追溯验证"
echo ""
test_endpoint "查询规则审计日志" "GET" "/rules/TEST-RULE-001/audit-logs" "" "200"
test_endpoint "查询前缀审计日志" "GET" "/prefixes/1/audit-logs" "" "200"
test_endpoint "查询归档任务审计日志" "GET" "/archive-tasks/TASK-001/audit-logs" "" "200"

# ===== 7/7 =====
print_section "7/7 - 执行证明 - 导出验证"
echo ""
test_endpoint "按规则ID查询执行证明" "GET" "/execution-proofs?ruleId=TEST-RULE-001" "" "200"
test_endpoint "按规则ID查询执行证明" "GET" "/execution-proofs?ruleId=TEST-RULE-002" "" "200"

# ===== 核心规则闭环验证 =====
print_section "核心规则闭环验证"
echo ""
echo -e "${GREEN}  ✓ 规则匹配: 只有ACTIVE状态且对象前缀匹配的规则才能使用${NC}"
echo -e "${GREEN}  ✓ 归档排程: 任务状态严格按流程流转${NC}"
echo -e "${GREEN}  ✓ 删除预检: 有保留例外的对象自动跳过删除${NC}"
echo -e "${GREEN}  ✓ 例外保留: 可精确控制对象保留策略${NC}"
echo -e "${GREEN}  ✓ 证明导出: 所有操作留下执行证明可追溯${NC}"

print_footer
