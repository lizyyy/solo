#!/bin/bash
# 对象生命周期规则API - 功能测试脚本
# 用法: ./test-api.sh

set -e

BASE_URL="http://localhost:8080/api/v1"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    echo -n " 测试: $name ... "
    
    if [ "$method" = "POST" ] || [ "$method" = "PUT" ]; then
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
        echo -e "${GREEN}✓ 通过 (HTTP $http_code)${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ 失败 (期望 HTTP $expected_status, 实际 HTTP $http_code)${NC}"
        echo "    响应: $body" | head -c 200
        ((FAIL++))
        return 1
    fi
}

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  对象生命周期规则API - 功能测试${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_footer() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo "  测试结果:"
    echo -e "  通过: ${GREEN}$PASS${NC}"
    echo -e "  失败: ${RED}$FAIL${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    if [ $FAIL -eq 0 ]; then
        echo -e "${GREEN}所有测试通过!${NC}"
        exit 0
    else
        echo -e "${RED}部分测试失败${NC}"
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
    echo ""
}

# 主测试流程
print_header
check_server

echo -e "${YELLOW}开始API测试...${NC}"
echo ""

# 1. 对象前缀测试
echo -e "${BLUE}[1/7] 测试对象前缀API${NC}"
test_endpoint "创建对象前缀" "POST" "/prefixes" '{"prefix":"/data/","bucketName":"my-bucket","description":"测试数据"}' "200"
test_endpoint "获取所有前缀" "GET" "/prefixes" "" "200"
test_endpoint "启用过滤" "GET" "/prefixes?enabledOnly=true" "" "200"
echo ""

# 2. 规则创建和状态流转测试
echo -e "${BLUE}[2/7] 测试生命周期规则API${NC}"
test_endpoint "创建规则" "POST" "/rules" '{"ruleId":"TEST-RULE-001","ruleName":"测试规则","prefixId":1,"archiveAfterDays":30,"deleteAfterDays":90}' "200"
test_endpoint "获取规则" "GET" "/rules/TEST-RULE-001" "" "200"
test_endpoint "获取所有规则" "GET" "/rules" "" "200"
test_endpoint "校验规则" "POST" "/rules/TEST-RULE-001/verify" "" "200"
test_endpoint "激活规则" "POST" "/rules/TEST-RULE-001/activate" "" "200"
test_endpoint "暂停规则" "POST" "/rules/TEST-RULE-001/suspend" "" "200"
test_endpoint "撤销规则" "POST" "/rules/TEST-RULE-001/cancel" "" "200"
echo ""

# 3. 归档任务测试
echo -e "${BLUE}[3/7] 测试归档任务API${NC}"
test_endpoint "创建归档任务" "POST" "/archive-tasks" '{"taskId":"TASK-ARCHIVE-001","ruleId":1,"objectKey":"/data/file1.txt","bucketName":"my-bucket","objectSize":1024}' "200"
test_endpoint "获取归档任务" "GET" "/archive-tasks/TASK-ARCHIVE-001" "" "200"
test_endpoint "获取所有归档任务" "GET" "/archive-tasks" "" "200"
test_endpoint "开始执行任务" "POST" "/archive-tasks/TASK-ARCHIVE-001/start" "" "200"
test_endpoint "完成任务" "POST" "/archive-tasks/TASK-ARCHIVE-001/complete" "" "200"
echo ""

# 4. 删除候选测试
echo -e "${BLUE}[4/7] 测试删除候选API${NC}"
test_endpoint "创建删除候选" "POST" "/deletion-candidates" '{"objectKey":"/data/old-file.txt","bucketName":"my-bucket","ruleId":1}' "200"
test_endpoint "获取所有候选" "GET" "/deletion-candidates" "" "200"
echo ""

# 5. 保留例外测试
echo -e "${BLUE}[5/7] 测试保留例外API${NC}"
test_endpoint "创建保留例外" "POST" "/retention-exceptions" '{"objectKey":"/data/important.txt","bucketName":"my-bucket","reason":"合规要求","effectiveFrom":"2024-01-01T00:00:00","effectiveTo":"2025-01-01T00:00:00"}' "200"
test_endpoint "获取所有例外" "GET" "/retention-exceptions" "" "200"
echo ""

# 6. 审计日志测试
echo -e "${BLUE}[6/7] 测试审计日志API${NC}"
test_endpoint "规则审计日志" "GET" "/rules/TEST-RULE-001/audit-logs" "" "200"
test_endpoint "前缀审计日志" "GET" "/prefixes/1/audit-logs" "" "200"
echo ""

# 7. 执行证明测试
echo -e "${BLUE}[7/7] 测试执行证明API${NC}"
test_endpoint "按规则ID获取证明" "GET" "/execution-proofs?ruleId=TEST-RULE-001" "" "200"
echo ""

print_footer
