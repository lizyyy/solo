#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

print_header() {
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}========================================${NC}"
}

print_pass() {
    echo -e "${GREEN}[PASS] $1${NC}"
    ((PASSED_TESTS++))
}

print_fail() {
    echo -e "${RED}[FAIL] $1${NC}"
    ((FAILED_TESTS++))
}

assert_status() {
    local response="$1"
    local expected="$2"
    local test_name="$3"
    
    status=$(echo "$response" | grep -o '"code":[0-9]*' | grep -o '[0-9]*')
    
    if [ "$status" == "$expected" ]; then
        print_pass "$test_name"
        return 0
    else
        print_fail "$test_name (期望: $expected, 实际: $status)"
        echo "  响应: $response"
        return 1
    fi
}

extract_id() {
    echo "$1" | grep -o '"id":"[^"]*"' | cut -d'"' -f4
}

# 场景一：灰度分组回滚
print_header "场景一：灰度分组回滚"

response=$(curl -s -X POST "$BASE_URL/rollback" \
    -H "Content-Type: application/json" \
    -d '{
        "app_name": "user-service",
        "config_key": "db.config",
        "target_version": 1,
        "source_version": 2,
        "confirmer": "admin",
        "instance_scope_type": "gray",
        "instance_ids": ["gray-instance-01", "gray-instance-02"],
        "gray_group_id": "gray-group-001",
        "remark": "灰度分组回滚测试"
    }')
assert_status "$response" "200" "创建灰度分组回滚申请"
rollback_id=$(extract_id "$response")
echo "回滚ID: $rollback_id"

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id/confirm" \
    -H "Content-Type: application/json" \
    -d '{"operator": "manager"}')
assert_status "$response" "200" "二次确认回滚"

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id/execute")
assert_status "$response" "200" "执行回滚"

# 记录实例拉取
for i in 1 2; do
    curl -s -X POST "$BASE_URL/rollback/pull-log" \
        -H "Content-Type: application/json" \
        -d "{
            \"instance_id\": \"gray-instance-0$i\",
            \"app_name\": \"user-service\",
            \"config_key\": \"db.config\",
            \"version\": 1,
            \"rollback_id\": \"$rollback_id\",
            \"is_gray\": true,
            \"is_offline\": false
        }" > /dev/null
done

response=$(curl -s "$BASE_URL/rollback/$rollback_id/mismatched-instances")
mismatch_count=$(echo "$response" | grep -o '"data":\[[^]]*' | grep -o '"instance_id"' | wc -l)
if [ "$mismatch_count" -eq 0 ]; then
    print_pass "灰度实例版本全部匹配"
else
    print_fail "灰度实例版本不匹配，数量: $mismatch_count"
fi

# 场景二：离线实例回滚
print_header "场景二：离线实例回滚"

response=$(curl -s -X POST "$BASE_URL/rollback" \
    -H "Content-Type: application/json" \
    -d '{
        "app_name": "order-service",
        "config_key": "redis.config",
        "target_version": 3,
        "source_version": 4,
        "confirmer": "admin",
        "instance_scope_type": "offline",
        "instance_ids": ["offline-instance-01"],
        "remark": "离线实例回滚"
    }')
assert_status "$response" "200" "创建离线实例回滚申请"
rollback_id2=$(extract_id "$response")

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id2/confirm" \
    -H "Content-Type: application/json" \
    -d '{"operator": "manager"}')
assert_status "$response" "200" "确认离线实例回滚"

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id2/execute")
assert_status "$response" "200" "执行离线实例回滚"

curl -s -X POST "$BASE_URL/rollback/pull-log" \
    -H "Content-Type: application/json" \
    -d "{
        \"instance_id\": \"offline-instance-01\",
        \"app_name\": \"order-service\",
        \"config_key\": \"redis.config\",
        \"version\": 3,
        \"rollback_id\": \"$rollback_id2\",
        \"is_gray\": false,
        \"is_offline\": true
    }" > /dev/null
print_pass "记录离线实例拉取"

# 场景三：缓存版本未刷新
print_header "场景三：缓存版本未刷新"

response=$(curl -s -X POST "$BASE_URL/rollback" \
    -H "Content-Type: application/json" \
    -d '{
        "app_name": "payment-service",
        "config_key": "alipay.config",
        "target_version": 5,
        "source_version": 6,
        "confirmer": "admin",
        "instance_scope_type": "all",
        "remark": "缓存未刷新测试"
    }')
assert_status "$response" "200" "创建回滚申请"
rollback_id3=$(extract_id "$response")

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id3/confirm" \
    -H "Content-Type: application/json" \
    -d '{"operator": "manager"}')
assert_status "$response" "200" "确认回滚"

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id3/execute")
assert_status "$response" "200" "执行回滚"

# 实例1: 正确回滚到版本5
curl -s -X POST "$BASE_URL/rollback/pull-log" \
    -H "Content-Type: application/json" \
    -d "{
        \"instance_id\": \"cache-instance-01\",
        \"app_name\": \"payment-service\",
        \"config_key\": \"alipay.config\",
        \"version\": 5,
        \"rollback_id\": \"$rollback_id3\",
        \"is_gray\": false,
        \"is_offline\": false
    }" > /dev/null

# 实例2: 缓存未刷新，仍读取版本6（模拟异常）
curl -s -X POST "$BASE_URL/rollback/pull-log" \
    -H "Content-Type: application/json" \
    -d "{
        \"instance_id\": \"cache-instance-02\",
        \"app_name\": \"payment-service\",
        \"config_key\": \"alipay.config\",
        \"version\": 6,
        \"rollback_id\": \"$rollback_id3\",
        \"is_gray\": false,
        \"is_offline\": false
    }" > /dev/null

response=$(curl -s "$BASE_URL/rollback/$rollback_id3/mismatched-instances")
mismatch_count=$(echo "$response" | grep -o '"instance_id"' | wc -l)
if [ "$mismatch_count" -eq 1 ]; then
    print_pass "正确检测到缓存未刷新的实例"
else
    print_fail "缓存未刷新检测异常，期望1个，实际$mismatch_count个"
fi

# 场景四：重复确认测试
print_header "场景四：重复确认测试"

response=$(curl -s -X POST "$BASE_URL/rollback" \
    -H "Content-Type: application/json" \
    -d '{
        "app_name": "test-service",
        "config_key": "test.config",
        "target_version": 1,
        "source_version": 2,
        "confirmer": "admin",
        "instance_scope_type": "all",
        "remark": "重复确认测试"
    }')
assert_status "$response" "200" "创建回滚申请"
rollback_id4=$(extract_id "$response")

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id4/confirm" \
    -H "Content-Type: application/json" \
    -d '{"operator": "manager"}')
assert_status "$response" "200" "第一次确认成功"

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id4/confirm" \
    -H "Content-Type: application/json" \
    -d '{"operator": "manager"}')
assert_status "$response" "400" "第二次确认失败（状态验证正确）"

# 场景五：回滚后再次发布
print_header "场景五：回滚后再次发布"

response=$(curl -s -X POST "$BASE_URL/rollback" \
    -H "Content-Type: application/json" \
    -d '{
        "app_name": "gateway-service",
        "config_key": "route.config",
        "target_version": 10,
        "source_version": 11,
        "confirmer": "admin",
        "instance_scope_type": "all",
        "remark": "回滚后再次发布测试"
    }')
assert_status "$response" "200" "创建回滚申请"
rollback_id5=$(extract_id "$response")

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id5/confirm" \
    -H "Content-Type: application/json" \
    -d '{"operator": "manager"}')
assert_status "$response" "200" "确认回滚"

response=$(curl -s -X POST "$BASE_URL/rollback/$rollback_id5/execute")
assert_status "$response" "200" "执行回滚"

# 记录回滚后拉取版本10
curl -s -X POST "$BASE_URL/rollback/pull-log" \
    -H "Content-Type: application/json" \
    -d "{
        \"instance_id\": \"gateway-instance-01\",
        \"app_name\": \"gateway-service\",
        \"config_key\": \"route.config\",
        \"version\": 10,
        \"rollback_id\": \"$rollback_id5\",
        \"is_gray\": false,
        \"is_offline\": false
    }" > /dev/null

# 模拟再次发布版本12
release_id="release-001-$(date +%s)"

# 实例拉取新版本12
curl -s -X POST "$BASE_URL/rollback/pull-log" \
    -H "Content-Type: application/json" \
    -d "{
        \"instance_id\": \"gateway-instance-01\",
        \"app_name\": \"gateway-service\",
        \"config_key\": \"route.config\",
        \"version\": 12,
        \"release_id\": \"$release_id\",
        \"is_gray\": false,
        \"is_offline\": false
    }" > /dev/null

print_pass "回滚后再次发布新版本测试完成"

# 统计结果
print_header "测试结果汇总"
TOTAL_TESTS=$((PASSED_TESTS + FAILED_TESTS))
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"

if [ "$FAILED_TESTS" -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}所有测试通过！${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}部分测试失败，请检查！${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
