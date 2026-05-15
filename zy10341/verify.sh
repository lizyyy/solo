#!/bin/bash
# Schema 注册审批 API 快速验证脚本
# 测试完整的 API 流程：创建 Topic -> 注册 Schema -> 兼容检查 -> 提交审批 -> 审批通过 -> 发布 -> 查看通知

set -e

BASE_URL="http://localhost:8080"

echo "============================================"
echo "Schema 注册审批 API 验证脚本"
echo "============================================"
echo ""

# 检查服务是否启动
echo "1. 检查服务是否启动..."
if ! curl -s "$BASE_URL/api/topics" > /dev/null 2>&1; then
    echo "   服务未启动或无法访问"
    echo "   请先运行: ./mvnw spring-boot:run"
    exit 1
fi
echo "   ✓ 服务正常运行"
echo ""

# 创建 Topic
echo "2. 创建测试 Topic..."
TOPIC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/topics" \
    -H "Content-Type: application/json" \
    -d '{
        "topicName": "test_order_event",
        "description": "测试订单事件",
        "compatibilityLevel": "BACKWARD",
        "ownerTeam": "test-team",
        "businessDomain": "test",
        "createdBy": "tester"
    }')
echo "   ✓ Topic 创建成功"
echo ""

# 注册 Schema
echo "3. 注册 Schema..."
SCHEMA_RESPONSE=$(curl -s -X POST "$BASE_URL/api/schemas/register" \
    -H "Content-Type: application/json" \
    -d '{
        "topicName": "test_order_event",
        "schemaContent": "{\"type\":\"record\",\"name\":\"Order\",\"fields\":[{\"name\":\"id\",\"type\":\"string\"}]}",
        "description": "测试订单 Schema",
        "requestId": "test-req-001",
        "createdBy": "tester"
    }')
SCHEMA_ID=$(echo "$SCHEMA_RESPONSE" | grep -o '"id":[0-9]*' | cut -d: -f2)
echo "   ✓ Schema 注册成功，ID: $SCHEMA_ID"
echo ""

# 触发兼容检查
echo "4. 触发兼容性检查..."
CHECK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/schemas/$SCHEMA_ID/compatibility-check" \
    -H "Content-Type: application/json" \
    -d '{"operator": "tester"}')
echo "   ✓ 兼容性检查完成"
echo ""

# 提交审批
echo "5. 提交审批..."
SUBMIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/schemas/$SCHEMA_ID/submit-approval" \
    -H "Content-Type: application/json" \
    -d '{"operator": "tester"}')
echo "   ✓ 已提交审批"
echo ""

# 审批通过
echo "6. 审批 Schema..."
APPROVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/schemas/approve" \
    -H "Content-Type: application/json" \
    -d "{
        \"schemaVersionId\": $SCHEMA_ID,
        \"approver\": \"manager\",
        \"approvalComment\": \"审批通过\",
        \"isApproved\": true,
        \"approvalStep\": 1,
        \"totalSteps\": 1
    }")
echo "   ✓ 审批完成"
echo ""

# 发布 Schema
echo "7. 发布 Schema..."
PUBLISH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/schemas/$SCHEMA_ID/publish" \
    -H "Content-Type: application/json" \
    -d '{"operator": "ops"}')
echo "   ✓ Schema 发布成功"
echo ""

# 查看 Schema 详情
echo "8. 查看 Schema 最终状态..."
SCHEMA_DETAIL=$(curl -s "$BASE_URL/api/schemas/$SCHEMA_ID")
echo "   ✓ 状态查询完成"
echo ""

echo "============================================"
echo "所有 API 测试通过！"
echo "============================================"
echo ""
echo "其他可用接口："
echo "  - 查看 Topic 列表:    GET $BASE_URL/api/topics"
echo "  - 查看 Topic 下所有 Schema: GET $BASE_URL/api/schemas/topic/test_order_event"
echo "  - 查看兼容检查历史:   GET $BASE_URL/api/schemas/$SCHEMA_ID/compatibility-history"
echo "  - 查看审批历史:       GET $BASE_URL/api/schemas/$SCHEMA_ID/approval-history"
echo "  - 查看发布历史:       GET $BASE_URL/api/schemas/$SCHEMA_ID/publish-history"
echo "  - H2 控制台:          http://localhost:8080/h2-console"
echo ""
