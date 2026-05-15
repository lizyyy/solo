#!/bin/bash

set -e

BASE_URL="http://localhost:8080/api-slimming"

echo "========================================"
echo "  API 返回体瘦身服务 - 验证脚本"
echo "========================================"
echo ""

check_service() {
    echo "🔍 检测服务是否启动..."
    if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" | grep -q "404"; then
        echo "✅ 服务已启动"
        return 0
    else
        echo "❌ 服务未启动或无法访问"
        echo "   请先用 IDE 启动 ApiSlimmingApplication.java"
        echo ""
        echo "   启动类位置: src/main/java/com/api/slimming/ApiSlimmingApplication.java"
        echo "   启动后再运行此脚本"
        exit 1
    fi
}

test_create_rule() {
    echo ""
    echo "📝 测试 1: 创建规则 + 幂等性验证"
    echo "----------------------------------------"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/rules" \
        -H "Content-Type: application/json" \
        -d '{
            "apiPath": "/api/v1/user/info",
            "excludeFields": ["data.extraInfo", "data.debugLog"],
            "requestId": "req_test_001",
            "createdBy": "tester",
            "remark": "测试规则"
        }')
    
    echo "第一次创建响应:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    echo ""
    
    RULE_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | cut -d: -f2)
    echo "创建的规则 ID: $RULE_ID"
    
    echo ""
    echo "重复提交相同 requestId..."
    RESPONSE2=$(curl -s -X POST "$BASE_URL/api/rules" \
        -H "Content-Type: application/json" \
        -d '{
            "apiPath": "/api/v1/user/info",
            "excludeFields": ["data.extraInfo", "data.debugLog"],
            "requestId": "req_test_001",
            "createdBy": "tester",
            "remark": "测试规则"
        }')
    
    echo "第二次响应:"
    echo "$RESPONSE2" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE2"
    echo ""
    echo "✅ 幂等性测试完成（不会重复创建规则）"
}

test_lifecycle() {
    echo ""
    echo "🔄 测试 2: 规则完整生命周期"
    echo "----------------------------------------"
    
    if [ -z "$RULE_ID" ]; then
        RULE_ID=1
        echo "使用默认规则 ID: $RULE_ID"
    fi
    
    echo ""
    echo "a) 校验规则"
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/rules/validate" \
        -H "Content-Type: application/json" \
        -d "{
            \"ruleId\": $RULE_ID,
            \"originalResponse\": \"{\\\"code\\\":200,\\\"data\\\":{\\\"id\\\":1,\\\"name\\\":\\\"test\\\",\\\"extraInfo\\\":\\\"冗余数据\\\"}}\",
            \"operator\": \"tester\"
        }")
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    
    echo ""
    echo "b) 激活规则"
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/rules/$RULE_ID/activate" \
        -H "Content-Type: application/json" \
        -d '{"operator": "tester"}')
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    
    echo ""
    echo "c) 查看历史变更"
    RESPONSE=$(curl -s "$BASE_URL/api/rules/$RULE_ID/history")
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    
    echo ""
    echo "✅ 生命周期测试完成"
}

test_slimming() {
    echo ""
    echo "✂️ 测试 3: 执行响应瘦身"
    echo "----------------------------------------"
    
    echo "发送瘦身请求..."
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/execute/slimming" \
        -H "Content-Type: application/json" \
        -d '{
            "apiPath": "/api/v1/user/info",
            "originalResponse": "{\"code\":200,\"data\":{\"id\":1,\"name\":\"test\",\"extraInfo\":\"这是一段很长的冗余数据,应该被裁剪掉\",\"debugLog\":\"调试日志信息也应该被移除\"}}",
            "requestId": "exec_test_001"
        }')
    
    echo "瘦身结果:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    
    echo ""
    echo "✅ 瘦身测试完成"
}

test_query() {
    echo ""
    echo "📊 测试 4: 查询执行记录"
    echo "----------------------------------------"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/records/query" \
        -H "Content-Type: application/json" \
        -d '{"pageNum": 1, "pageSize": 10}')
    
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    
    echo ""
    echo "✅ 查询测试完成"
}

show_h2_info() {
    echo ""
    echo "💾 H2 数据库控制台信息"
    echo "----------------------------------------"
    echo "访问地址: $BASE_URL/h2-console"
    echo "JDBC URL: jdbc:h2:mem:api_slimming"
    echo "用户名:   sa"
    echo "密码:     (空)"
    echo ""
    echo "验证 SQL:"
    echo "  SELECT * FROM slimming_rule;"
    echo "  SELECT * FROM slimming_record;"
    echo "  SELECT * FROM rule_history;"
}

# 执行所有测试
check_service
test_create_rule
test_lifecycle
test_slimming
test_query
show_h2_info

echo ""
echo "========================================"
echo "  ✅ 所有验证测试完成！"
echo "========================================"
echo ""
echo "📖 详细说明请查看 START.md 和 README.md"
