#!/bin/bash
# API 验证脚本

set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:8080/diagnostic/api/diagnostic"

log_info() {
    echo "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $1"
}

check_service() {
    log_info "检查服务是否启动..."
    for i in {1..30}; do
        if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/statuses" | grep -q "200"; then
            log_info "服务启动成功！"
            return 0
        fi
        echo -n "."
        sleep 2
    done
    echo ""
    log_error "服务启动超时"
    return 1
}

test_api() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    
    echo ""
    log_info "测试: $name"
    
    if [ -n "$data" ]; then
        result=$(curl -s -X $method -H "Content-Type: application/json" -d "$data" "$url")
    else
        result=$(curl -s -X $method "$url")
    fi
    
    http_code=$(echo "$result" | grep -o '"code":[0-9]*' | head -1 | grep -o '[0-9]*')
    
    if [ -n "$http_code" ] && [ "$http_code" = "200" ]; then
        log_info "✓ 成功: $name"
        echo "  响应: $result"
        return 0
    else
        log_warn "? 响应: $result"
        return 1
    fi
}

log_info "===================================="
log_info "API 验证脚本"
log_info "===================================="

# 检查服务
if ! check_service; then
    log_error "请先启动服务: ./start.sh"
    exit 1
fi

# 1. 获取所有状态
test_api "获取所有状态" "GET" "$BASE_URL/statuses" ""

# 2. 创建诊断记录
CREATE_DATA='{
    "instanceId": "test-service-001",
    "poolName": "hikari-pool",
    "sampleTime": "'$(date +%Y-%m-%dT%H:%M:%S)'",
    "totalConnections": 100,
    "activeConnections": 95,
    "idleConnections": 5,
    "waitingThreads": 15,
    "maxPoolSize": 100,
    "connectionUsageAvgTime": 280,
    "connectionUsageMaxTime": 450,
    "stackSummary": "com.mysql.jdbc.PreparedStatement.executeQuery",
    "rawInput": "test_raw_input_data"
}'

test_api "创建诊断记录" "POST" "$BASE_URL" "$CREATE_DATA"

# 3. 查询诊断记录
QUERY_DATA='{"pageNum": 1, "pageSize": 10}'
test_api "查询诊断记录" "POST" "$BASE_URL/query" "$QUERY_DATA"

# 4. 获取状态列表（再次确认）
test_api "获取状态列表" "GET" "$BASE_URL/statuses" ""

# 5. 测试归档接口
test_api "归档旧记录" "POST" "$BASE_URL/archive" ""

echo ""
log_info "===================================="
log_info "核心接口验证完成！"
log_info "===================================="
echo ""
echo "下一步可手动测试："
echo "  - 状态推进: PUT $BASE_URL/status"
echo "  - 人工修正: PUT $BASE_URL/manual-correction"
echo "  - 导出Excel: POST $BASE_URL/export/excel"
echo "  - 导出JSON: POST $BASE_URL/export/json"
