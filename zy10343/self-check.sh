#!/bin/bash

echo "========================================"
echo "  文件病毒扫描编排 API - 自检脚本"
echo "========================================"
echo ""

BASE_URL="http://localhost:8080/api"

check_service() {
    echo "1. 检查服务是否启动..."
    for i in {1..30}; do
        if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/scan-tasks/statistics" 2>/dev/null | grep -q "200"; then
            echo "   ✓ 服务已启动并正常运行"
            return 0
        fi
        sleep 1
    done
    echo "   ✗ 服务未能在 30 秒内启动"
    exit 1
}

run_test() {
    local test_name="$1"
    local command="$2"
    local expected="$3"

    echo -n "   $test_name... "
    result=$(eval "$command")
    if echo "$result" | grep -q "$expected"; then
        echo "✓"
        return 0
    else
        echo "✗"
        echo "     结果: $result"
        return 1
    fi
}

# 生成唯一标识
TIMESTAMP=$(date +%s)
FILE_ID="TEST-FILE-$TIMESTAMP"
REQUEST_ID="REQ-$TIMESTAMP"

echo ""
echo "2. 开始 API 功能测试..."
echo ""

FAILED=0

# 测试 1: 创建扫描任务
TASK_ID=$(curl -s -X POST "$BASE_URL/scan-tasks" \
    -H "Content-Type: application/json" \
    -d "{
        \"fileId\": \"$FILE_ID\",
        \"fileName\": \"test-file.txt\",
        \"fileSize\": 1024,
        \"fileHash\": \"abc123hash\",
        \"requestId\": \"$REQUEST_ID\",
        \"maxRetry\": 2
    }" | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TASK_ID" ]; then
    echo "   ✓ 创建扫描任务成功，任务ID: $TASK_ID"
else
    echo "   ✗ 创建扫描任务失败"
    FAILED=$((FAILED + 1))
fi

# 测试 2: 重复提交防脏数据（相同 requestId）
echo -n "   重复提交测试（相同 requestId）... "
REPEAT_RESULT=$(curl -s -X POST "$BASE_URL/scan-tasks" \
    -H "Content-Type: application/json" \
    -d "{
        \"fileId\": \"$FILE_ID-2\",
        \"fileName\": \"test-file-2.txt\",
        \"fileSize\": 1024,
        \"fileHash\": \"abc123hash\",
        \"requestId\": \"$REQUEST_ID\",
        \"maxRetry\": 2
    }")

if echo "$REPEAT_RESULT" | grep -q "$TASK_ID"; then
    echo "✓ 返回已有任务，防重复提交有效"
else
    echo "✗"
    FAILED=$((FAILED + 1))
fi

# 测试 3: 同一文件不能有多个活跃任务
echo -n "   同一文件多活跃任务检查... "
CONFLICT_RESULT=$(curl -s -X POST "$BASE_URL/scan-tasks" \
    -H "Content-Type: application/json" \
    -d "{
        \"fileId\": \"$FILE_ID\",
        \"fileName\": \"test-file-3.txt\",
        \"fileSize\": 1024,
        \"fileHash\": \"abc123hash\",
        \"maxRetry\": 2
    }")

if echo "$CONFLICT_RESULT" | grep -q "409"; then
    echo "✓ 正确拒绝创建重复任务"
else
    echo "✗"
    FAILED=$((FAILED + 1))
fi

# 测试 4: 状态推进 PENDING -> SCANNING
echo -n "   状态推进 PENDING -> SCANNING... "
STATUS1=$(curl -s -X PUT "$BASE_URL/scan-tasks/$TASK_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"targetStatus": "SCANNING"}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS1" = "SCANNING" ]; then
    echo "✓"
else
    echo "✗ (当前状态: $STATUS1)"
    FAILED=$((FAILED + 1))
fi

# 测试 5: 状态推进 SCANNING -> INFECTED
echo -n "   状态推进 SCANNING -> INFECTED... "
STATUS2=$(curl -s -X PUT "$BASE_URL/scan-tasks/$TASK_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"targetStatus": "INFECTED", "virusDetails": "EICAR test virus"}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS2" = "INFECTED" ]; then
    echo "✓"
else
    echo "✗ (当前状态: $STATUS2)"
    FAILED=$((FAILED + 1))
fi

# 测试 6: 非法状态转换 (INFECTED -> CLEAN)
echo -n "   非法状态转换检测... "
INVALID_RESULT=$(curl -s -X PUT "$BASE_URL/scan-tasks/$TASK_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"targetStatus": "CLEAN"}' -w "%{http_code}")

if echo "$INVALID_RESULT" | grep -q "409"; then
    echo "✓ 正确拒绝非法状态转换"
else
    echo "✗"
    FAILED=$((FAILED + 1))
fi

# 测试 7: 查询任务详情
echo -n "   查询任务详情... "
DETAIL_RESULT=$(curl -s "$BASE_URL/scan-tasks/$TASK_ID")
if echo "$DETAIL_RESULT" | grep -q "$FILE_ID"; then
    echo "✓"
else
    echo "✗"
    FAILED=$((FAILED + 1))
fi

# 测试 8: 查询统计信息
echo -n "   查询统计信息... "
STATS_RESULT=$(curl -s "$BASE_URL/scan-tasks/statistics")
if echo "$STATS_RESULT" | grep -q "totalTasks"; then
    echo "✓"
else
    echo "✗"
    FAILED=$((FAILED + 1))
fi

# 测试 9: 状态推进 INFECTED -> QUARANTINED
echo -n "   状态推进 INFECTED -> QUARANTINED... "
STATUS3=$(curl -s -X PUT "$BASE_URL/scan-tasks/$TASK_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"targetStatus": "QUARANTINED", "operator": "admin"}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS3" = "QUARANTINED" ]; then
    echo "✓"
else
    echo "✗ (当前状态: $STATUS3)"
    FAILED=$((FAILED + 1))
fi

# 测试 10: 查询隔离文件列表
echo -n "   查询隔离文件列表... "
QUARANTINE_RESULT=$(curl -s "$BASE_URL/quarantines")
if echo "$QUARANTINE_RESULT" | grep -q "$FILE_ID"; then
    echo "✓"
else
    echo "✗"
    FAILED=$((FAILED + 1))
fi

# 获取隔离区 ID
QUARANTINE_ID=$(echo "$QUARANTINE_RESULT" | grep -o '"quarantineId":"[^"]*"' | head -1 | cut -d'"' -f4)

# 测试 11: 放行隔离文件
echo -n "   放行隔离文件... "
RELEASE_RESULT=$(curl -s -X POST "$BASE_URL/quarantines/release" \
    -H "Content-Type: application/json" \
    -d "{
        \"fileId\": \"$FILE_ID\",
        \"quarantineId\": \"$QUARANTINE_ID\",
        \"releaseReason\": \"误报放行\",
        \"releasedBy\": \"admin\"
    }")

if echo "$RELEASE_RESULT" | grep -q "certificateId"; then
    echo "✓"
else
    echo "✗"
    FAILED=$((FAILED + 1))
fi

# 测试 12: 脏数据测试 - 查询不存在的任务
echo -n "   查询不存在的任务... "
NOT_FOUND=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/scan-tasks/NON-EXISTENT-TASK")
if [ "$NOT_FOUND" = "404" ]; then
    echo "✓ 正确返回 404"
else
    echo "✗ (返回码: $NOT_FOUND)"
    FAILED=$((FAILED + 1))
fi

echo ""
echo "========================================"
echo "  测试结果汇总"
echo "========================================"
TOTAL_TESTS=12
PASSED=$((TOTAL_TESTS - FAILED))
echo "  总测试数: $TOTAL_TESTS"
echo "  通过: $PASSED"
echo "  失败: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "  ✓ 所有测试通过！系统运行正常。"
    echo ""
    echo "  测试数据："
    echo "    - 测试文件ID: $FILE_ID"
    echo "    - 任务ID: $TASK_ID"
    echo "    - 隔离区ID: $QUARANTINE_ID"
    exit 0
else
    echo "  ✗ 有 $FAILED 个测试失败，请检查。"
    exit 1
fi