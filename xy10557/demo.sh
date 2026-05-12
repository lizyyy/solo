#!/bin/bash

BASE_URL="${NURSERY_API_URL:-http://localhost:8765}"

echo "=========================================="
echo "  托育接送授权API系统 - 演示脚本"
echo "=========================================="
echo ""

pause() {
    read -p "按回车继续..."
    echo ""
}

echo "[步骤1] 检查服务状态"
echo "------------------------"
curl -s "$BASE_URL/api/health" | python3 -m json.tool
echo ""
pause

echo "[步骤2] 查看所有儿童档案"
echo "------------------------"
curl -s "$BASE_URL/api/children" | python3 -m json.tool
echo ""
pause

CHILD_IDS=$(curl -s "$BASE_URL/api/children" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data['data']:
    print(f\"{c['name']}:{c['id']}\")
")

echo "儿童ID列表:"
echo "$CHILD_IDS"
echo ""

ZHANG_XIAOMING_ID=$(echo "$CHILD_IDS" | grep "张小明" | cut -d: -f2)
LI_XIAOHONG_ID=$(echo "$CHILD_IDS" | grep "李小红" | cut -d: -f2)
WANG_XIAOQIANG_ID=$(echo "$CHILD_IDS" | grep "王小强" | cut -d: -f2)

echo "[步骤3] 查看张小明的完整状态（授权链路 + 历史记录）"
echo "---------------------------------------------------"
curl -s "$BASE_URL/api/children/$ZHANG_XIAOMING_ID/status" | python3 -m json.tool
echo ""
pause

echo "[步骤4] 查看当前所有临时授权"
echo "----------------------------"
curl -s "$BASE_URL/api/authorizations/temporary" | python3 -m json.tool
echo ""
pause

echo "[步骤5] 查看黑名单"
echo "-------------------"
curl -s "$BASE_URL/api/blacklist" | python3 -m json.tool
echo ""
pause

echo "[步骤6] 演示路径1: 正常接送（张小明 + 父亲张伟）"
echo "-------------------------------------------------"
echo "发送接送请求..."
TODAY=$(date +%Y-%m-%d)
curl -s -X POST "$BASE_URL/api/pickup" \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -H "X-Idempotency-Key: pickup-normal-$(date +%s)" \
  -d "{
    \"childId\": \"$ZHANG_XIAOMING_ID\",
    \"authorizerId\": \"auth_parent_zhangwei\",
    \"authorizerName\": \"张伟\",
    \"pickupTime\": \"${TODAY}T17:00:00\",
    \"notes\": \"正常离园\"
  }" | python3 -m json.tool
echo ""
pause

echo "[步骤7] 演示路径2: 幂等性测试（重复发送相同接送请求）"
echo "-----------------------------------------------------"
echo "使用相同的幂等键再次发送..."
curl -s -X POST "$BASE_URL/api/pickup" \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -H "X-Idempotency-Key: pickup-normal-$(date +%s)" \
  -d "{
    \"childId\": \"$ZHANG_XIAOMING_ID\",
    \"authorizerId\": \"auth_parent_zhangwei\",
    \"authorizerName\": \"张伟\",
    \"pickupTime\": \"${TODAY}T17:00:00\",
    \"notes\": \"正常离园\"
  }" | python3 -m json.tool
echo ""
pause

echo "[步骤8] 演示路径3: 授权过期拦截（李小红 + 母亲张英）"
echo "-----------------------------------------------------"
echo "张英的授权已过期，应该被拦截..."
curl -s -X POST "$BASE_URL/api/pickup" \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -d "{
    \"childId\": \"$LI_XIAOHONG_ID\",
    \"authorizerId\": \"auth_mother_zhangying\",
    \"authorizerName\": \"张英\",
    \"pickupTime\": \"${TODAY}T17:30:00\",
    \"notes\": \"接孩子\"
  }" | python3 -m json.tool
echo ""
pause

echo "[步骤9] 演示路径4: 重复离园拦截（王小强 + 母亲王芳）"
echo "-----------------------------------------------------"
echo "王小强已被接送，再次尝试应该被拦截..."
curl -s -X POST "$BASE_URL/api/pickup" \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -d "{
    \"childId\": \"$WANG_XIAOQIANG_ID\",
    \"authorizerId\": \"auth_parent_wangfang\",
    \"authorizerName\": \"王芳\",
    \"pickupTime\": \"${TODAY}T18:00:00\",
    \"notes\": \"接孩子\"
  }" | python3 -m json.tool
echo ""
pause

echo "[步骤10] 演示路径5: 黑名单拦截（任意儿童 + 刘磊）"
echo "--------------------------------------------------"
echo "刘磊在黑名单中，应该被拦截..."
curl -s -X POST "$BASE_URL/api/pickup" \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -d "{
    \"childId\": \"$LI_XIAOHONG_ID\",
    \"authorizerId\": \"blacklist_liulei\",
    \"authorizerName\": \"刘磊\",
    \"pickupTime\": \"${TODAY}T17:45:00\",
    \"notes\": \"接孩子\"
  }" | python3 -m json.tool
echo ""
pause

echo "[步骤11] 查看所有异常记录"
echo "--------------------------"
curl -s "$BASE_URL/api/exceptions?status=open" | python3 -m json.tool
echo ""
pause

echo "[步骤12] 查看今日接送报告"
echo "--------------------------"
curl -s "$BASE_URL/api/reports/daily" | python3 -m json.tool
echo ""
pause

echo "[步骤13] 演示: 为李小红创建新的临时授权"
echo "------------------------------------------"
NEW_TEMP_AUTH=$(curl -s -X POST "$BASE_URL/api/authorizations/temporary" \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_admin" \
  -d "{
    \"childId\": \"$LI_XIAOHONG_ID\",
    \"authorizerId\": \"temp_demo_auntie\",
    \"authorizerName\": \"阿姨赵丽\",
    \"authorizerPhone\": \"13800138100\",
    \"authorizerIdNumber\": \"110101197508088901\",
    \"relation\": \"阿姨\",
    \"validFrom\": \"${TODAY}T00:00:00\",
    \"validUntil\": \"${TODAY}T23:59:59\",
    \"pickupTime\": \"${TODAY}T18:00:00\"
  }")

echo "创建结果:"
echo "$NEW_TEMP_AUTH" | python3 -m json.tool
echo ""

TEMP_AUTH_ID=$(echo "$NEW_TEMP_AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

echo "[步骤14] 演示: 确认这个临时授权"
echo "---------------------------------"
curl -s -X POST "$BASE_URL/api/authorizations/temporary/$TEMP_AUTH_ID/confirm" \
  -H "Content-Type: application/json" \
  -H "X-Operator: principal" | python3 -m json.tool
echo ""
pause

echo "[步骤15] 演示: 使用刚确认的临时授权接送李小红"
echo "-----------------------------------------------"
curl -s -X POST "$BASE_URL/api/pickup" \
  -H "Content-Type: application/json" \
  -H "X-Operator: teacher_wang" \
  -d "{
    \"childId\": \"$LI_XIAOHONG_ID\",
    \"authorizerId\": \"temp_demo_auntie\",
    \"authorizerName\": \"阿姨赵丽\",
    \"pickupTime\": \"${TODAY}T18:00:00\",
    \"notes\": \"临时授权接送\"
  }" | python3 -m json.tool
echo ""
pause

echo "[步骤16] 查看最终的接送报告"
echo "----------------------------"
curl -s "$BASE_URL/api/reports/daily" | python3 -m json.tool
echo ""

echo "=========================================="
echo "  演示完成！"
echo "=========================================="
echo ""
echo "您可以通过以下API查看更多详情:"
echo "  - 儿童状态: GET /api/children/:id/status"
echo "  - 异常记录: GET /api/exceptions"
echo "  - 历史记录: 通过上述接口的history字段查看"
echo "  - 报告导出: GET /api/reports/export/daily"
echo ""
