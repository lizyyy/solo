#!/bin/bash

echo "====================================="
echo "  API 验证脚本"
echo "====================================="
echo ""

BASE_URL="http://localhost:8080"

# 检查服务是否启动
echo "检查服务状态..."
for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/operations" | grep -q "200\|404"; then
        echo "✅ 服务已启动"
        break
    fi
    echo "等待服务启动... ($i/30)"
    sleep 2
done
echo ""

# 测试1: 创建操作
echo "【测试1】创建高风险操作..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/operations" \
    -H "Content-Type: application/json" \
    -d '{
        "requestId": "TEST_OP_001",
        "operationType": "BALANCE_ADJUST",
        "requesterId": "user001",
        "requesterName": "张三",
        "riskLevel": "HIGH",
        "operationData": "{\"account\":\"TEST123\",\"amount\":10000}",
        "expireMinutes": 60
    }')

if echo "$CREATE_RESPONSE" | grep -q '"code":200'; then
    echo "✅ 创建操作成功"
    OP_STATUS=$(echo "$CREATE_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "   操作状态: $OP_STATUS"
else
    echo "❌ 创建操作失败: $CREATE_RESPONSE"
fi
echo ""

# 测试2: 第一次确认
echo "【测试2】第一次确认操作 (确认人: user002)..."
CONFIRM1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/operations/TEST_OP_001/confirm" \
    -H "Content-Type: application/json" \
    -d '{
        "confirmerId": "user002",
        "confirmerName": "李四",
        "comment": "审核通过"
    }')

if echo "$CONFIRM1_RESPONSE" | grep -q '"code":200'; then
    echo "✅ 第一次确认成功"
    OP_STATUS=$(echo "$CONFIRM1_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "   操作状态: $OP_STATUS"
else
    echo "❌ 第一次确认失败: $CONFIRM1_RESPONSE"
fi
echo ""

# 测试3: 重复确认幂等性
echo "【测试3】重复确认幂等性测试..."
CONFIRM2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/operations/TEST_OP_001/confirm" \
    -H "Content-Type: application/json" \
    -d '{
        "confirmerId": "user002",
        "confirmerName": "李四",
        "comment": "审核通过"
    }')

if echo "$CONFIRM2_RESPONSE" | grep -q '"code":200'; then
    echo "✅ 重复确认幂等性正常"
else
    echo "❌ 重复确认测试失败: $CONFIRM2_RESPONSE"
fi
echo ""

# 测试4: 申请人不能确认自己的操作
echo "【测试4】申请人不能确认自己的操作..."
SELF_CONFIRM_RESPONSE=$(curl -s -X POST "$BASE_URL/api/operations/TEST_OP_001/confirm" \
    -H "Content-Type: application/json" \
    -d '{
        "confirmerId": "user001",
        "confirmerName": "张三",
        "comment": "自我确认"
    }')

if echo "$SELF_CONFIRM_RESPONSE" | grep -q '"code":400'; then
    echo "✅ 申请人自我确认被正确拒绝"
else
    echo "❌ 自我确认测试异常: $SELF_CONFIRM_RESPONSE"
fi
echo ""

# 测试5: 第二次确认，完成双人确认
echo "【测试5】第二次确认操作 (确认人: user003)..."
CONFIRM3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/operations/TEST_OP_001/confirm" \
    -H "Content-Type: application/json" \
    -d '{
        "confirmerId": "user003",
        "confirmerName": "王五",
        "comment": "最终确认通过"
    }')

if echo "$CONFIRM3_RESPONSE" | grep -q '"code":200'; then
    echo "✅ 第二次确认成功"
    OP_STATUS=$(echo "$CONFIRM3_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    EXEC_TOKEN=$(echo "$CONFIRM3_RESPONSE" | grep -o '"executionToken":"[^"]*"' | cut -d'"' -f4)
    echo "   操作状态: $OP_STATUS"
    echo "   执行凭证: $EXEC_TOKEN"
else
    echo "❌ 第二次确认失败: $CONFIRM3_RESPONSE"
fi
echo ""

# 测试6: 执行操作
echo "【测试6】使用执行凭证执行操作..."
EXEC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/operations/TEST_OP_001/execute?token=$EXEC_TOKEN")

if echo "$EXEC_RESPONSE" | grep -q '"code":200'; then
    echo "✅ 操作执行成功"
    OP_STATUS=$(echo "$EXEC_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "   最终状态: $OP_STATUS"
else
    echo "❌ 操作执行失败: $EXEC_RESPONSE"
fi
echo ""

# 测试7: 导出JSON
echo "【测试7】导出JSON..."
EXPORT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/operations/export/json")
if [ "$EXPORT_RESPONSE" = "200" ]; then
    echo "✅ JSON导出功能正常 (HTTP $EXPORT_RESPONSE)"
else
    echo "❌ JSON导出测试失败 (HTTP $EXPORT_RESPONSE)"
fi
echo ""

# 测试8: 导出CSV
echo "【测试8】导出CSV..."
EXPORT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/operations/export/csv")
if [ "$EXPORT_RESPONSE" = "200" ]; then
    echo "✅ CSV导出功能正常 (HTTP $EXPORT_RESPONSE)"
else
    echo "❌ CSV导出测试失败 (HTTP $EXPORT_RESPONSE)"
fi
echo ""

echo "====================================="
echo "  所有测试完成！"
echo "====================================="
echo ""
echo "服务地址: $BASE_URL"
echo "H2控制台: $BASE_URL/h2-console"
echo ""
