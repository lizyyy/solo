#!/bin/bash

# 宠物寄养喂药提醒 API 验收脚本
# 请确保服务已启动：node app.js

BASE_URL="http://localhost:3000"

echo "========================================"
echo "  宠物寄养喂药提醒 API 验收测试"
echo "========================================"
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查服务是否运行
echo -e "${YELLOW}1. 检查服务是否运行...${NC}"
HEALTH_CHECK=$(curl -s "${BASE_URL}/health")
if echo "$HEALTH_CHECK" | grep -q "运行正常"; then
    echo -e "${GREEN}✓ 服务运行正常${NC}"
    echo ""
else
    echo -e "${RED}✗ 服务未运行，请先执行：node app.js${NC}"
    exit 1
fi

# 存储 ID 变量
declare -A PET_IDS
declare -A PLAN_IDS
declare -A RECEIPT_IDS

echo "========================================"
echo "  第一部分：正常业务流程测试"
echo "========================================"
echo ""

# 测试 1：创建宠物档案
echo -e "${YELLOW}测试 1：创建宠物档案（3 只宠物）${NC}"
echo ""

echo "创建宠物 '旺财'（金毛，3岁，25kg）"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/pets" \
  -H "Content-Type: application/json" \
  -H "x-request-id: pet-wangcai-001" \
  -d '{
    "name": "旺财",
    "species": "狗",
    "breed": "金毛",
    "age": 3,
    "weight": 25,
    "ownerName": "张三",
    "ownerPhone": "13800138001",
    "medicalHistory": "无特殊病史",
    "specialNeeds": "怕打雷"
  }')

PET_IDS["旺财"]=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "响应：$RESPONSE"
echo ""
echo "旺财 ID: ${PET_IDS["旺财"]}"
echo ""

echo "创建宠物 '咪咪'（猫，2岁，4.5kg）"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/pets" \
  -H "Content-Type: application/json" \
  -H "x-request-id: pet-mimi-001" \
  -d '{
    "name": "咪咪",
    "species": "猫",
    "breed": "英短",
    "age": 2,
    "weight": 4.5,
    "ownerName": "李四",
    "ownerPhone": "13800138002",
    "medicalHistory": "皮肤敏感",
    "specialNeeds": "只吃特定品牌猫粮"
  }')

PET_IDS["咪咪"]=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "响应：$RESPONSE"
echo ""
echo "咪咪 ID: ${PET_IDS["咪咪"]}"
echo ""

echo "创建宠物 '豆豆'（泰迪，5岁，6kg）"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/pets" \
  -H "Content-Type: application/json" \
  -H "x-request-id: pet-doudou-001" \
  -d '{
    "name": "豆豆",
    "species": "狗",
    "breed": "泰迪",
    "age": 5,
    "weight": 6,
    "ownerName": "王五",
    "ownerPhone": "13800138003",
    "medicalHistory": "心脏病，需要长期服药",
    "specialNeeds": "心脏药必须在饭后服用"
  }')

PET_IDS["豆豆"]=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "响应：$RESPONSE"
echo ""
echo "豆豆 ID: ${PET_IDS["豆豆"]}"
echo ""

# 测试 2：创建喂药计划
echo -e "${YELLOW}测试 2：创建喂药计划${NC}"
echo ""

echo "为旺财创建皮肤感染治疗计划"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans" \
  -H "Content-Type: application/json" \
  -H "x-request-id: plan-wangcai-skin-001" \
  -d '{
    "petId": "'"${PET_IDS["旺财"]}"'",
    "medicationName": "头孢氨苄片",
    "dosage": 500,
    "dosageUnit": "mg",
    "frequency": "每日2次",
    "startDate": "2026-05-10",
    "endDate": "2026-05-24",
    "administrationTime": ["08:00", "20:00"],
    "fastingInstructions": {
      "required": false,
      "notes": "建议饭后服用"
    },
    "notes": "治疗皮肤感染，共14天"
  }')

PLAN_IDS["旺财-皮肤"]=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "响应：$RESPONSE"
echo ""
echo "旺财皮肤治疗计划 ID: ${PLAN_IDS["旺财-皮肤"]}"
echo ""

echo "为咪咪创建过敏治疗计划（需要禁食）"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans" \
  -H "Content-Type: application/json" \
  -H "x-request-id: plan-mimi-allergy-001" \
  -d '{
    "petId": "'"${PET_IDS["咪咪"]}"'",
    "medicationName": "泼尼松龙",
    "dosage": 5,
    "dosageUnit": "mg",
    "frequency": "每日1次",
    "startDate": "2026-05-10",
    "endDate": "2026-05-17",
    "administrationTime": ["09:00"],
    "fastingInstructions": {
      "required": true,
      "hoursBefore": 2,
      "hoursAfter": 1,
      "notes": "空腹服用效果更好"
    },
    "notes": "治疗皮肤过敏，共7天"
  }')

PLAN_IDS["咪咪-过敏"]=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "响应：$RESPONSE"
echo ""
echo "咪咪过敏治疗计划 ID: ${PLAN_IDS["咪咪-过敏"]}"
echo ""

echo "为豆豆创建心脏病长期治疗计划"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans" \
  -H "Content-Type: application/json" \
  -H "x-request-id: plan-doudou-heart-001" \
  -d '{
    "petId": "'"${PET_IDS["豆豆"]}"'",
    "medicationName": "呋塞米片",
    "dosage": 12.5,
    "dosageUnit": "mg",
    "frequency": "每日2次",
    "startDate": "2026-05-10",
    "endDate": "2026-12-31",
    "administrationTime": ["08:00", "20:00"],
    "fastingInstructions": {
      "required": false,
      "notes": "必须饭后服用，避免胃部刺激"
    },
    "notes": "长期控制心脏病，需定期检查肾功能"
  }')

PLAN_IDS["豆豆-心脏"]=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "响应：$RESPONSE"
echo ""
echo "豆豆心脏治疗计划 ID: ${PLAN_IDS["豆豆-心脏"]}"
echo ""

# 测试 3：推进喂药计划
echo -e "${YELLOW}测试 3：推进喂药计划（记录喂药执行）${NC}"
echo ""

echo "记录旺财第一次喂药"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans/${PLAN_IDS["旺财-皮肤"]}/advance" \
  -H "Content-Type: application/json" \
  -H "x-request-id: advance-wangcai-001" \
  -d '{
    "executedBy": "李护士",
    "actualDosage": 500,
    "notes": "宠物配合良好，全部服用",
    "compliance": "full"
  }')
echo "响应：$RESPONSE"
echo ""

echo "记录咪咪第一次喂药"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans/${PLAN_IDS["咪咪-过敏"]}/advance" \
  -H "Content-Type: application/json" \
  -H "x-request-id: advance-mimi-001" \
  -d '{
    "executedBy": "王护士",
    "actualDosage": 5,
    "notes": "空腹2小时后服用",
    "compliance": "full"
  }')
echo "响应：$RESPONSE"
echo ""

# 测试 4：创建执行回执
echo -e "${YELLOW}测试 4：创建执行回执（详细记录）${NC}"
echo ""

echo "为旺财创建详细执行回执"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/execution-receipts" \
  -H "Content-Type: application/json" \
  -H "x-request-id: receipt-wangcai-001" \
  -d '{
    "petId": "'"${PET_IDS["旺财"]}"'",
    "planId": "'"${PLAN_IDS["旺财-皮肤"]}"'",
    "executedBy": "李护士",
    "actualDosage": 500,
    "dosageUnit": "mg",
    "executionTime": "2026-05-10T08:00:00Z",
    "lastMealTime": "2026-05-10T07:30:00Z",
    "petCondition": "正常",
    "administrationMethod": "口服",
    "notes": "宠物状态良好，药物全部服用"
  }')

RECEIPT_IDS["旺财-1"]=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "响应：$RESPONSE"
echo ""
echo "旺财执行回执 ID: ${RECEIPT_IDS["旺财-1"]}"
echo ""

echo "为咪咪创建详细执行回执（验证禁食约束）"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/execution-receipts" \
  -H "Content-Type: application/json" \
  -H "x-request-id: receipt-mimi-001" \
  -d '{
    "petId": "'"${PET_IDS["咪咪"]}"'",
    "planId": "'"${PLAN_IDS["咪咪-过敏"]}"'",
    "executedBy": "王护士",
    "actualDosage": 5,
    "dosageUnit": "mg",
    "executionTime": "2026-05-10T09:00:00Z",
    "lastMealTime": "2026-05-10T06:30:00Z",
    "petCondition": "正常",
    "administrationMethod": "口服",
    "notes": "空腹2.5小时后服用，符合要求"
  }')

RECEIPT_IDS["咪咪-1"]=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "响应：$RESPONSE"
echo ""
echo "咪咪执行回执 ID: ${RECEIPT_IDS["咪咪-1"]}"
echo ""

# 测试 5：查询汇总
echo -e "${YELLOW}测试 5：查询汇总信息${NC}"
echo ""

echo "查询今日汇总"
curl -s "${BASE_URL}/api/summary/today" | python3 -m json.tool
echo ""

echo "查询旺财详细汇总"
curl -s "${BASE_URL}/api/summary/pet/${PET_IDS["旺财"]}" | python3 -m json.tool
echo ""

echo "查询仪表盘总览"
curl -s "${BASE_URL}/api/summary/dashboard" | python3 -m json.tool
echo ""

echo "========================================"
echo "  第二部分：异常场景测试"
echo "========================================"
echo ""

# 异常 1：重复数据（重复创建同名宠物）
echo -e "${YELLOW}异常测试 1：重复数据 - 尝试创建同名宠物${NC}"
echo ""
echo "尝试再次创建名为 '旺财' 的宠物"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/pets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "旺财",
    "species": "狗",
    "breed": "拉布拉多",
    "age": 2,
    "weight": 30
  }')
echo "响应：$RESPONSE"
echo -e "${GREEN}✓ 预期错误：已存在名为 \"旺财\" 的宠物档案${NC}"
echo ""

# 异常 2：缺字段（创建宠物时缺少必填字段）
echo -e "${YELLOW}异常测试 2：缺字段 - 创建宠物时缺少必填字段${NC}"
echo ""
echo "尝试创建宠物但缺少 'name' 字段"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/pets" \
  -H "Content-Type: application/json" \
  -d '{
    "species": "狗",
    "breed": "哈士奇",
    "age": 1,
    "weight": 20
  }')
echo "响应：$RESPONSE"
echo -e "${GREEN}✓ 预期错误：缺少必填字段：宠物名称${NC}"
echo ""

echo "尝试创建喂药计划但缺少 'dosage' 字段"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans" \
  -H "Content-Type: application/json" \
  -d '{
    "petId": "'"${PET_IDS["旺财"]}"'",
    "medicationName": "测试药物",
    "frequency": "每日1次",
    "startDate": "2026-05-10",
    "endDate": "2026-05-17"
  }')
echo "响应：$RESPONSE"
echo -e "${GREEN}✓ 预期错误：缺少必填字段：剂量${NC}"
echo ""

# 异常 3：禁食约束违规
echo -e "${YELLOW}异常测试 3：禁食约束违规${NC}"
echo ""
echo "尝试为咪咪创建执行回执，但禁食时间不足"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/execution-receipts" \
  -H "Content-Type: application/json" \
  -d '{
    "petId": "'"${PET_IDS["咪咪"]}"'",
    "planId": "'"${PLAN_IDS["咪咪-过敏"]}"'",
    "executedBy": "测试护士",
    "actualDosage": 5,
    "dosageUnit": "mg",
    "executionTime": "2026-05-10T09:00:00Z",
    "lastMealTime": "2026-05-10T08:00:00Z",
    "petCondition": "正常",
    "administrationMethod": "口服"
  }')
echo "响应：$RESPONSE"
echo -e "${GREEN}✓ 预期错误：禁食时间不足：需要 2 小时，实际只有 1.0 小时${NC}"
echo ""

# 异常 4：人工改错（修正错误数据）
echo -e "${YELLOW}异常测试 4：人工改错 - 修正错误的喂药计划${NC}"
echo ""
echo "查看修正前的旺财喂药计划"
curl -s "${BASE_URL}/api/medication-plans/${PLAN_IDS["旺财-皮肤"]}" | python3 -m json.tool
echo ""

echo "修正旺财喂药计划的剂量（从 500mg 改为 250mg）"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans/${PLAN_IDS["旺财-皮肤"]}/correct" \
  -H "Content-Type: application/json" \
  -H "x-request-id: correct-wangcai-001" \
  -d '{
    "correctedBy": "张医生",
    "reason": "根据宠物体重重新计算剂量，25kg 应该用 250mg",
    "dosage": 250,
    "notes": "剂量已根据体重调整"
  }')
echo "响应：$RESPONSE"
echo ""

echo "查看修正后的旺财喂药计划（包含修正记录）"
curl -s "${BASE_URL}/api/medication-plans/${PLAN_IDS["旺财-皮肤"]}" | python3 -m json.tool
echo ""

# 异常 5：重复请求幂等性测试
echo -e "${YELLOW}异常测试 5：重复请求幂等性${NC}"
echo ""
echo "使用相同的 x-request-id 重复创建宠物"
RESPONSE1=$(curl -s -X POST "${BASE_URL}/api/pets" \
  -H "Content-Type: application/json" \
  -H "x-request-id: idempotent-test-001" \
  -d '{
    "name": "幂等测试狗",
    "species": "狗",
    "breed": "测试品种",
    "age": 1,
    "weight": 10
  }')
echo "第一次请求响应：$RESPONSE1"
echo ""

echo "使用相同的 x-request-id 再次发送相同请求"
RESPONSE2=$(curl -s -X POST "${BASE_URL}/api/pets" \
  -H "Content-Type: application/json" \
  -H "x-request-id: idempotent-test-001" \
  -d '{
    "name": "幂等测试狗",
    "species": "狗",
    "breed": "测试品种",
    "age": 1,
    "weight": 10
  }')
echo "第二次请求响应：$RESPONSE2"
echo ""
echo -e "${GREEN}✓ 两次响应应该相同，证明幂等性生效${NC}"
echo ""

# 异常 6：撤回喂药计划
echo -e "${YELLOW}异常测试 6：撤回喂药计划${NC}"
echo ""
echo "创建一个临时喂药计划用于测试撤回"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans" \
  -H "Content-Type: application/json" \
  -d '{
    "petId": "'"${PET_IDS["豆豆"]}"'",
    "medicationName": "临时测试药",
    "dosage": 10,
    "dosageUnit": "mg",
    "frequency": "每日1次",
    "startDate": "2026-05-10",
    "endDate": "2026-05-17"
  }')
TEMP_PLAN_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "临时计划 ID: $TEMP_PLAN_ID"
echo ""

echo "撤回这个临时喂药计划"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans/${TEMP_PLAN_ID}/withdraw" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "宠物症状改善，无需继续服药"
  }')
echo "响应：$RESPONSE"
echo ""

echo "尝试推进已撤回的计划"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/medication-plans/${TEMP_PLAN_ID}/advance" \
  -H "Content-Type: application/json" \
  -d '{
    "executedBy": "测试护士",
    "actualDosage": 10
  }')
echo "响应：$RESPONSE"
echo -e "${GREEN}✓ 预期错误：喂药计划状态为 \"withdrawn\"，无法推进${NC}"
echo ""

# 异常 7：剂量不一致记录
echo -e "${YELLOW}异常测试 7：剂量不一致（执行剂量与计划剂量不同）${NC}"
echo ""
echo "为豆豆创建执行回执，但实际剂量与计划不同"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/execution-receipts" \
  -H "Content-Type: application/json" \
  -H "x-request-id: receipt-doudou-variance-001" \
  -d '{
    "petId": "'"${PET_IDS["豆豆"]}"'",
    "planId": "'"${PLAN_IDS["豆豆-心脏"]}"'",
    "executedBy": "赵护士",
    "actualDosage": 10,
    "dosageUnit": "mg",
    "executionTime": "2026-05-10T20:00:00Z",
    "lastMealTime": "2026-05-10T19:30:00Z",
    "petCondition": "食欲不佳，只吃了部分",
    "administrationMethod": "口服",
    "notes": "宠物食欲不好，只服用了部分剂量"
  }')

RECEIPT_IDS["豆豆-差异"]=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "响应：$RESPONSE"
echo ""
echo "注意：响应中包含 dosageVariance 字段，记录了剂量差异"
echo ""

echo "查看仪表盘，应该能看到剂量差异告警"
curl -s "${BASE_URL}/api/summary/dashboard" | python3 -m json.tool
echo ""

echo "========================================"
echo "  第三部分：综合场景测试"
echo "========================================"
echo ""

echo "场景：多宠物同日多次喂药的完整流程"
echo ""

echo "1. 旺财第二次喂药"
curl -s -X POST "${BASE_URL}/api/medication-plans/${PLAN_IDS["旺财-皮肤"]}/advance" \
  -H "Content-Type: application/json" \
  -H "x-request-id: advance-wangcai-002" \
  -d '{
    "executedBy": "李护士",
    "actualDosage": 250,
    "notes": "按修正后的剂量服用",
    "compliance": "full"
  }'
echo ""

echo "2. 豆豆第二次喂药"
curl -s -X POST "${BASE_URL}/api/medication-plans/${PLAN_IDS["豆豆-心脏"]}/advance" \
  -H "Content-Type: application/json" \
  -H "x-request-id: advance-doudou-001" \
  -d '{
    "executedBy": "赵护士",
    "actualDosage": 12.5,
    "notes": "饭后服用，状态良好",
    "compliance": "full"
  }'
echo ""

echo "3. 查看今日最终汇总"
curl -s "${BASE_URL}/api/summary/today" | python3 -m json.tool
echo ""

echo "========================================"
echo "  验收测试完成"
echo "========================================"
echo ""
echo -e "${GREEN}请检查以上输出，确认：${NC}"
echo "1. 正常业务流程是否按预期执行"
echo "2. 异常场景是否正确捕获并返回错误"
echo "3. 幂等性是否生效"
echo "4. 禁食约束是否正确验证"
echo "5. 剂量差异是否正确记录和告警"
echo "6. 修正记录是否完整保存"
echo ""
