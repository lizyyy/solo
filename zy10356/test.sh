#!/bin/bash

BASE_URL="http://localhost:8080/api/v1/feature-flag"
TIMESTAMP=$(date +%s)

echo "=========================================="
echo "  特征开关命中审计 API - 测试脚本"
echo "=========================================="
echo ""

# 检查服务是否启动
check_service() {
    echo "🔍 检查服务是否启动..."
    for i in {1..5}; do
        if curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/" | grep -q "200\|404"; then
            echo "✅ 服务已启动!"
            return 0
        fi
        echo "   等待服务启动... ($i/5)"
        sleep 3
    done
    echo "❌ 服务未启动，请先运行 ./start.sh 启动服务"
    exit 1
}

check_service
echo ""

echo "1️⃣  测试正常请求 - 命中分桶"
echo "------------------------------------------"
REQ_ID="test_normal_${TIMESTAMP}"
echo "Request ID: $REQ_ID"
curl -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d "{
    \"requestId\": \"$REQ_ID\",
    \"experimentKey\": \"button_color_test\",
    \"userIdentifier\": \"normal_user_001\",
    \"userAttributes\": {
      \"userId\": \"normal_user_001\",
      \"country\": \"CN\",
      \"userSegment\": \"new\"
    }
  }" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "2️⃣  测试重复请求 - 应该被拦截返回 409"
echo "------------------------------------------"
echo "使用相同 Request ID: $REQ_ID"
curl -s -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d "{
    \"requestId\": \"$REQ_ID\",
    \"experimentKey\": \"button_color_test\",
    \"userIdentifier\": \"normal_user_001\",
    \"userAttributes\": {}
  }" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "3️⃣  测试覆盖用户 - QA账号强制命中对照组"
echo "------------------------------------------"
curl -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d "{
    \"requestId\": \"test_qa_${TIMESTAMP}\",
    \"experimentKey\": \"button_color_test\",
    \"userIdentifier\": \"qa_user_001\",
    \"userAttributes\": {}
  }" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "4️⃣  测试覆盖用户 - 管理员强制命中变体"
echo "------------------------------------------"
curl -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d "{
    \"requestId\": \"test_admin_${TIMESTAMP}\",
    \"experimentKey\": \"button_color_test\",
    \"userIdentifier\": \"admin_001\",
    \"userAttributes\": {}
  }" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "5️⃣  测试实验不存在 - 返回错误"
echo "------------------------------------------"
curl -X POST "$BASE_URL/evaluate" \
  -H "Content-Type: application/json" \
  -d "{
    \"requestId\": \"test_notfound_${TIMESTAMP}\",
    \"experimentKey\": \"non_existent_exp\",
    \"userIdentifier\": \"user_001\",
    \"userAttributes\": {}
  }" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "6️⃣  查询失败记录"
echo "------------------------------------------"
curl -s "$BASE_URL/audit/failed" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "7️⃣  查询审计记录列表"
echo "------------------------------------------"
curl -s "$BASE_URL/audit?page=0&size=10" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "8️⃣  人工补偿失败记录 (ID: 3)"
echo "------------------------------------------"
curl -X POST "$BASE_URL/audit/3/compensate?compensatedBy=admin_test" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "9️⃣  导出审计记录为CSV"
echo "------------------------------------------"
curl -s -o audit_export.csv "$BASE_URL/audit/export?experimentKey=button_color_test"
echo "导出完成，文件: audit_export.csv"
echo "文件内容预览:"
head -5 audit_export.csv
echo ""
echo ""

echo "🔟  按 Request ID 查询审计记录"
echo "------------------------------------------"
echo "查询: $REQ_ID"
curl -s "$BASE_URL/audit/request/$REQ_ID" | python3 -m json.tool 2>/dev/null || cat
echo ""
echo ""

echo "=========================================="
echo "  ✅ 所有测试完成!"
echo "=========================================="
echo ""
echo "📊 验证要点:"
echo "  - 正常请求返回 bucketKey/bucketValue (200)"
echo "  - 重复请求返回 409 Conflict (已正确拦截)"
echo "  - QA用户返回 control 分组 (红色 #FF0000)"
echo "  - 管理员返回 variant 分组 (绿色 #00FF00)"
echo "  - 不存在实验返回 404 或错误信息"
echo "  - 失败记录查询正常返回"
echo "  - 补偿后状态变为 COMPENSATED"
echo "  - CSV导出成功生成"
