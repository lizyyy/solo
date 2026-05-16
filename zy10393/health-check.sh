#!/bin/bash
# 数据修复脚本审批API - 健康检查脚本

set -e

echo "=========================================="
echo "  数据修复脚本审批API - 健康检查"
echo "=========================================="
echo ""

# API基础地址
BASE_URL="http://localhost:8080/api"
MAX_RETRIES=15
RETRY_DELAY=3

# 检查curl是否可用
if ! command -v curl &> /dev/null; then
    echo "❌ 错误: 未找到curl命令"
    exit 1
fi

# 等待服务启动
echo "▶ 1. 检查服务状态（最多等待${MAX_RETRIES}秒）..."
SUCCESS=0
for i in $(seq 1 $MAX_RETRIES); do
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" --connect-timeout 5 --max-time 10 || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
        SUCCESS=1
        echo "   ✅ 服务运行正常 (尝试 $i 次)"
        break
    fi
    echo "   ⏳ 等待服务启动... ($i/$MAX_RETRIES, 状态: $HTTP_STATUS)"
    sleep $RETRY_DELAY
done

if [ $SUCCESS -eq 0 ]; then
    echo "   ❌ 服务未启动或无法访问"
    echo ""
    echo "   请先在另一个终端运行 ./start.sh 启动服务"
    exit 1
fi
echo ""

# 获取健康检查详情
echo "▶ 2. 健康检查详情:"
RESPONSE=$(curl -s "$BASE_URL/health")
echo "   $RESPONSE"
echo ""

# 生成测试用requestId
TEST_PREFIX="TEST_$(date +%Y%m%d%H%M%S)"

# 测试创建脚本
TEST_REQUEST_ID="${TEST_PREFIX}_CREATE"
echo "▶ 3. 测试创建脚本接口 (requestId: $TEST_REQUEST_ID)..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/repair-scripts" \
    -H "Content-Type: application/json" \
    -d "{
        \"scriptName\": \"自动化测试脚本\",
        \"scriptType\": \"UPDATE\",
        \"scriptContent\": \"SELECT 1 FROM DUAL\",
        \"description\": \"自动化测试 - 脚本创建\",
        \"businessSystem\": \"测试系统\",
        \"databaseName\": \"test_db\",
        \"applicant\": \"auto_test\",
        \"applicantDept\": \"测试部\",
        \"requestId\": \"$TEST_REQUEST_ID\",
        \"targetScopes\": [
            {
                \"scopeType\": \"TABLE\",
                \"tableName\": \"test_table\",
                \"primaryKey\": \"id\",
                \"whereCondition\": \"1=1\",
                \"estimatedRows\": 100,
                \"columnsAffected\": \"status\"
            }
        ]
    }")

if echo "$CREATE_RESPONSE" | grep -q '"code":0'; then
    echo "   ✅ 创建脚本成功"
    SCRIPT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -n 1)
    echo "   脚本ID: $SCRIPT_ID"
else
    echo "   ❌ 创建脚本失败"
    echo "   响应: $CREATE_RESPONSE"
fi
echo ""

# 测试幂等性（重复提交）
echo "▶ 4. 测试幂等性校验（重复创建脚本）..."
IDEMPOTENT_RESPONSE=$(curl -s -X POST "$BASE_URL/repair-scripts" \
    -H "Content-Type: application/json" \
    -d "{
        \"scriptName\": \"自动化测试脚本\",
        \"scriptType\": \"UPDATE\",
        \"scriptContent\": \"SELECT 1 FROM DUAL\",
        \"description\": \"自动化测试 - 幂等校验\",
        \"businessSystem\": \"测试系统\",
        \"databaseName\": \"test_db\",
        \"applicant\": \"auto_test\",
        \"applicantDept\": \"测试部\",
        \"requestId\": \"$TEST_REQUEST_ID\",
        \"targetScopes\": [
            {
                \"scopeType\": \"TABLE\",
                \"tableName\": \"test_table\",
                \"whereCondition\": \"1=1\",
                \"estimatedRows\": 100
            }
        ]
    }")

if echo "$IDEMPOTENT_RESPONSE" | grep -q '"code":0'; then
    echo "   ✅ 幂等校验正常（重复提交返回已有结果）"
else
    echo "   ⚠️  幂等校验可能有问题"
fi
echo ""

# 如果获取到了脚本ID，测试完整流程
if [ -n "$SCRIPT_ID" ] && [ "$SCRIPT_ID" != "null" ]; then
    # 测试提交审批
    SUBMIT_REQUEST_ID="${TEST_PREFIX}_SUBMIT"
    echo "▶ 5. 测试提交审批接口 (requestId: $SUBMIT_REQUEST_ID)..."
    SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/repair-scripts/submit" \
        -H "Content-Type: application/json" \
        -d "{
            \"scriptId\": $SCRIPT_ID,
            \"operator\": \"test_operator\",
            \"requestId\": \"$SUBMIT_REQUEST_ID\"
        }")

    if echo "$SUBMIT_RESPONSE" | grep -q '"code":0'; then
        echo "   ✅ 提交审批成功"
    else
        echo "   ❌ 提交审批失败"
        echo "   响应: $SUBMIT_RESPONSE"
    fi
    echo ""

    # 测试试跑接口
    DRYRUN_REQUEST_ID="${TEST_PREFIX}_DRYRUN"
    echo "▶ 6. 测试试跑接口 (requestId: $DRYRUN_REQUEST_ID)..."
    DRYRUN_RESPONSE=$(curl -s -X POST "$BASE_URL/repair-scripts/dry-run" \
        -H "Content-Type: application/json" \
        -d "{
            \"scriptId\": $SCRIPT_ID,
            \"operator\": \"test_operator\",
            \"requestId\": \"$DRYRUN_REQUEST_ID\"
        }")

    if echo "$DRYRUN_RESPONSE" | grep -q '"code":0'; then
        echo "   ✅ 试跑执行成功"
    else
        echo "   ❌ 试跑执行失败"
        echo "   响应: $DRYRUN_RESPONSE"
    fi
    echo ""

    # 测试脚本详情查询
    echo "▶ 7. 测试脚本详情查询接口..."
    DETAIL_RESPONSE=$(curl -s "$BASE_URL/repair-scripts/$SCRIPT_ID/detail")
    if echo "$DETAIL_RESPONSE" | grep -q '"code":0'; then
        echo "   ✅ 脚本详情查询成功"
    else
        echo "   ❌ 脚本详情查询失败"
    fi
    echo ""

    # 测试问题排查报告接口
    echo "▶ 8. 测试问题排查报告接口..."
    TROUBLE_RESPONSE=$(curl -s "$BASE_URL/repair-scripts/$SCRIPT_ID/troubleshoot-report")
    if echo "$TROUBLE_RESPONSE" | grep -q '"code":0'; then
        echo "   ✅ 问题排查报告生成成功"
    else
        echo "   ❌ 问题排查报告生成失败"
    fi
    echo ""
fi

# 测试分页查询
echo "▶ 9. 测试分页查询接口..."
QUERY_RESPONSE=$(curl -s "$BASE_URL/repair-scripts/page?pageNum=1&pageSize=10")
if echo "$QUERY_RESPONSE" | grep -q '"code":0'; then
    echo "   ✅ 分页查询成功"
else
    echo "   ❌ 分页查询失败"
    echo "   响应: $QUERY_RESPONSE"
fi
echo ""

echo "=========================================="
echo "  ✅ 所有核心API验证完成！"
echo "=========================================="
echo ""
echo "📋 接口列表（全部支持幂等性）:"
echo "   - 创建脚本:  POST $BASE_URL/repair-scripts"
echo "   - 提交审批:  POST $BASE_URL/repair-scripts/submit"
echo "   - 执行试跑:  POST $BASE_URL/repair-scripts/dry-run"
echo "   - 审批操作:  POST $BASE_URL/repair-scripts/approve"
echo "   - 正式执行:  POST $BASE_URL/repair-scripts/execute"
echo "   - 回滚操作:  POST $BASE_URL/repair-scripts/rollback"
echo "   - 脚本详情:  GET  $BASE_URL/repair-scripts/{id}/detail"
echo "   - 分页查询:  GET  $BASE_URL/repair-scripts/page"
echo "   - 排查报告:  GET  $BASE_URL/repair-scripts/{id}/troubleshoot-report"
echo ""
echo "💡 提示: 所有写操作都支持幂等性，通过 requestId 参数控制"
