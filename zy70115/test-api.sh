#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=========================================="
echo "  中央厨房配餐路由 API 测试脚本"
echo "=========================================="
echo ""

echo "步骤 1: 检查服务是否运行..."
curl -s "$BASE_URL/api/health" | head -c 500
echo ""
echo ""

echo "步骤 2: 查看学校列表..."
SCHOOLS=$(curl -s "$BASE_URL/api/schools")
echo "$SCHOOLS"
echo ""

echo "步骤 3: 查看班级列表..."
CLASSES=$(curl -s "$BASE_URL/api/classes")
echo "$CLASSES"
echo ""

echo "步骤 4: 查看配送线路..."
ROUTES=$(curl -s "$BASE_URL/api/routes")
echo "$ROUTES"
echo ""

echo "步骤 5: 查看过敏源规则..."
ALLERGENS=$(curl -s "$BASE_URL/api/allergens")
echo "$ALLERGENS"
echo ""

echo "步骤 6: 测试路由匹配 - 班级1 (阳光小学一年级1班，47人)..."
MATCH_RESULT=$(curl -s -X POST "$BASE_URL/api/mealPlans/matchRoute" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": 1,
    "mealCount": 47,
    "menuAllergens": [],
    "operator": "测试员"
  }')
echo "$MATCH_RESULT"
echo ""

echo "步骤 7: 创建配餐计划..."
TODAY=$(date +%Y-%m-%d)
CREATE_PLAN=$(curl -s -X POST "$BASE_URL/api/mealPlans" \
  -H "Content-Type: application/json" \
  -d "{
    \"planDate\": \"$TODAY\",
    \"notes\": \"日常配餐测试\",
    \"operator\": \"测试员\"
  }")
echo "$CREATE_PLAN"

PLAN_ID=$(echo "$CREATE_PLAN" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo "配餐计划ID: $PLAN_ID"
echo ""

echo "步骤 8: 向配餐计划添加班级项目..."
ADD_ITEM=$(curl -s -X POST "$BASE_URL/api/mealPlans/$PLAN_ID/items" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": 1,
    "mealCount": 47,
    "menuAllergens": [],
    "operator": "测试员"
  }')
echo "$ADD_ITEM"
echo ""

echo "步骤 9: 再添加一个班级..."
ADD_ITEM2=$(curl -s -X POST "$BASE_URL/api/mealPlans/$PLAN_ID/items" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": 4,
    "mealCount": 53,
    "menuAllergens": [],
    "operator": "测试员"
  }')
echo "$ADD_ITEM2"
echo ""

echo "步骤 10: 查看配餐计划详情..."
curl -s "$BASE_URL/api/mealPlans/$PLAN_ID"
echo ""
echo ""

echo "步骤 11: 查看配餐项目列表..."
curl -s "$BASE_URL/api/mealPlans/$PLAN_ID/items"
echo ""
echo ""

echo "步骤 12: 执行过敏源规则校验..."
VALIDATE=$(curl -s -X POST "$BASE_URL/api/mealPlans/$PLAN_ID/validateAllergens" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "审核员"
  }')
echo "$VALIDATE"
echo ""

echo "步骤 13: 查看流程状态..."
curl -s "$BASE_URL/api/process/$PLAN_ID/status"
echo ""
echo ""

echo "步骤 14: 测试人数变更申请..."
COUNT_CHANGE=$(curl -s -X POST "$BASE_URL/api/studentCount/requests" \
  -H "Content-Type: application/json" \
  -d "{
    \"classId\": 1,
    \"mealPlanId\": $PLAN_ID,
    \"changeType\": \"增加\",
    \"newCount\": 50,
    \"reason\": \"3名学生今天返校\",
    \"createdBy\": \"班主任\"
  }")
echo "$COUNT_CHANGE"
CHANGE_ID=$(echo "$COUNT_CHANGE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
echo "变更申请ID: $CHANGE_ID"
echo ""

echo "步骤 15: 审核人数变更 (批准)..."
REVIEW_CHANGE=$(curl -s -X POST "$BASE_URL/api/studentCount/requests/$CHANGE_ID/review" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "reviewedBy": "配餐主管",
    "reviewNote": "同意增加"
  }')
echo "$REVIEW_CHANGE"
echo ""

echo "步骤 16: 查看更新后的配餐项目..."
curl -s "$BASE_URL/api/mealPlans/$PLAN_ID/items"
echo ""
echo ""

echo "步骤 17: 创建线路装载 (线路1: 东线A)..."
CREATE_LOAD=$(curl -s -X POST "$BASE_URL/api/delivery/loads" \
  -H "Content-Type: application/json" \
  -d "{
    \"mealPlanId\": $PLAN_ID,
    \"routeId\": 1,
    \"loadedBy\": \"装卸工A\"
  }")
echo "$CREATE_LOAD"
LOAD_ID=$(echo "$CREATE_LOAD" | grep -o '"loadId":[0-9]*' | grep -o '[0-9]*')
echo "装载ID: $LOAD_ID"
echo ""

echo "步骤 18: 确认线路装载..."
CONFIRM_LOAD=$(curl -s -X POST "$BASE_URL/api/delivery/loads/$LOAD_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "confirmedBy": "配送主管"
  }')
echo "$CONFIRM_LOAD"
echo ""

echo "步骤 19: 创建签收回执 (学校1: 阳光小学)..."
RECEIPT=$(curl -s -X POST "$BASE_URL/api/delivery/receipts" \
  -H "Content-Type: application/json" \
  -d "{
    \"loadId\": $LOAD_ID,
    \"schoolId\": 1,
    \"receivedBy\": \"王校长\",
    \"receivedCount\": 50,
    \"condition\": \"餐品完好，温度正常\",
    \"signature\": \"已签收\"
  }")
echo "$RECEIPT"
echo ""

echo "步骤 20: 测试异常报告..."
EXCEPTION=$(curl -s -X POST "$BASE_URL/api/delivery/exceptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"mealPlanId\": $PLAN_ID,
    \"stepName\": \"签收回执\",
    \"exceptionType\": \"数量不符\",
    \"description\": \"实际送达数量与配餐单不符\",
    \"relatedEntityType\": \"receipt\",
    \"reportedBy\": \"司机陈师傅\"
  }")
echo "$EXCEPTION"
EXCEPTION_ID=$(echo "$EXCEPTION" | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
echo "异常ID: $EXCEPTION_ID"
echo ""

echo "步骤 21: 解决异常..."
RESOLVE_EXCEPTION=$(curl -s -X POST "$BASE_URL/api/delivery/exceptions/$EXCEPTION_ID/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "经核实，司机在运输途中临时调整，已与学校确认无误",
    "resolvedBy": "客服主管"
  }')
echo "$RESOLVE_EXCEPTION"
echo ""

echo "步骤 22: 再次查看流程状态..."
curl -s "$BASE_URL/api/process/$PLAN_ID/status"
echo ""
echo ""

echo "步骤 23: 测试导出功能..."
curl -s "$BASE_URL/api/exports/full/$PLAN_ID"
echo ""
echo ""

echo "=========================================="
echo "  测试完成！"
echo "  配餐计划ID: $PLAN_ID"
echo "  请查看 exports 目录下生成的 Excel 文件"
echo "=========================================="
