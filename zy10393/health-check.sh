#!/bin/bash
# 数据修复脚本审批API - 健康检查脚本

echo "=========================================="
echo "  数据修复脚本审批API - 健康检查"
echo "=========================================="
echo ""

# API基础地址
BASE_URL="http://localhost:8080/api"

# 检查curl是否可用
if ! command -v curl &> /dev/null; then
    echo "❌ 错误: 未找到curl命令"
    exit 1
fi

# 检查服务是否启动
echo "▶ 1. 检查服务状态..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" --connect-timeout 5)
if [ "$HTTP_STATUS" != "200" ]; then
    echo "   ❌ 服务未启动或无法访问 (HTTP $HTTP_STATUS)"
    echo "   请先运行 ./start.sh 启动服务"
    exit 1
fi
echo "   ✅ 服务运行正常"
echo ""

# 获取健康检查详情
echo "▶ 2. 健康检查详情:"
RESPONSE=$(curl -s "$BASE_URL/health")
echo "   $RESPONSE"
echo ""

# 测试创建脚本
echo "▶ 3. 测试创建脚本接口..."
REQ_ID="TEST_$(date +%s)"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/repair-scripts" \
    -H "Content-Type: application/json" \
    -d "{
        \"scriptName\": \"测试脚本_$(date +%Y%m%d%H%M%S)\",
        \"scriptType\": \"UPDATE\",
        \"scriptContent\": \"SELECT 1 FROM DUAL\",
        \"description\": \"自动化测试脚本\",
        \"businessSystem\": \"测试系统\",
        \"databaseName\": \"test_db\",
        \"applicant\": \"auto_test\",
        \"applicantDept\": \"测试部\",
        \"requestId\": \"$REQ_ID\",
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

echo "   $CREATE_RESPONSE"

# 检查创建是否成功
if echo "$CREATE_RESPONSE" | grep -q '"code":0'; then
    echo "   ✅ 创建脚本成功"
    SCRIPT_ID=$(echo "$CREATE_RESPONSE" | grep -o '"data":{[^}]*"id":[0-9]*' | grep -o '[0-9]*' | head -n 1)
    echo "   脚本ID: $SCRIPT_ID"
else
    echo "   ❌ 创建脚本失败"
fi
echo ""

# 测试分页查询
echo "▶ 4. 测试分页查询接口..."
QUERY_RESPONSE=$(curl -s "$BASE_URL/repair-scripts/page?pageNum=1&pageSize=10")
echo "   $QUERY_RESPONSE"
if echo "$QUERY_RESPONSE" | grep -q '"code":0'; then
    echo "   ✅ 分页查询成功"
else
    echo "   ❌ 分页查询失败"
fi
echo ""

# 测试详情查询（如果有脚本ID）
if [ -n "$SCRIPT_ID" ]; then
    echo "▶ 5. 测试详情查询接口..."
    DETAIL_RESPONSE=$(curl -s "$BASE_URL/repair-scripts/$SCRIPT_ID/detail")
    if echo "$DETAIL_RESPONSE" | grep -q '"code":0'; then
        echo "   ✅ 详情查询成功"
    else
        echo "   ❌ 详情查询失败"
    fi
    echo ""

    echo "▶ 6. 测试问题排查报告接口..."
    TROUBLE_RESPONSE=$(curl -s "$BASE_URL/repair-scripts/$SCRIPT_ID/troubleshoot-report")
    if echo "$TROUBLE_RESPONSE" | grep -q '"code":0'; then
        echo "   ✅ 问题排查报告生成成功"
    else
        echo "   ❌ 问题排查报告生成失败"
    fi
    echo ""
fi

echo "=========================================="
echo "  ✅ 所有检查完成！"
echo "=========================================="
echo ""
echo "API 文档参考: $BASE_URL/swagger-ui.html (如已配置)"
echo "H2 控制台: $BASE_URL/h2-console"
