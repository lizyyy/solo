#!/bin/bash

BASE_URL="http://localhost:3000"

echo "========================================"
echo "  员工餐补异常 API - 完整演示脚本"
echo "========================================"
echo ""
echo "检查服务是否运行..."
curl -s "$BASE_URL/health" || {
  echo "服务未运行，请先执行: npm run dev"
  exit 1
}
echo ""

echo "----------------------------------------"
echo "Step 1: 导入员工"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/api/import/employees" \
  -H "Content-Type: application/json" \
  -d '[
    { "employeeId": "E001", "name": "张三", "department": "生产一部" },
    { "employeeId": "E002", "name": "李四", "department": "生产一部" },
    { "employeeId": "E003", "name": "王五", "department": "生产二部" },
    { "employeeId": "E004", "name": "赵六", "department": "生产二部" }
  ]'
echo ""
echo ""

echo "----------------------------------------"
echo "Step 2: 导入班次"
echo "  E001 张三: 日班 08:00-20:00 (工作日)"
echo "  E002 李四: 夜班 20:00-08:00 (跨天，工作日)"
echo "  E003 王五: 日班 08:00-20:00 (工作日)"
echo "  E004 赵六: 日班 08:00-20:00 (非工作日)"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/api/import/shifts" \
  -H "Content-Type: application/json" \
  -d '[
    { "employeeId": "E001", "date": "2025-01-15", "shiftType": "day", "startTime": "08:00", "endTime": "20:00", "isWorkDay": true },
    { "employeeId": "E002", "date": "2025-01-15", "shiftType": "night", "startTime": "20:00", "endTime": "08:00", "isWorkDay": true },
    { "employeeId": "E003", "date": "2025-01-15", "shiftType": "day", "startTime": "08:00", "endTime": "20:00", "isWorkDay": true },
    { "employeeId": "E004", "date": "2025-01-15", "shiftType": "day", "startTime": "08:00", "endTime": "20:00", "isWorkDay": false }
  ]'
echo ""
echo ""

echo "----------------------------------------"
echo "Step 3: 导入消费流水（幂等）"
echo "  TX001: E001 早餐 8元 - 日班正常"
echo "  TX002: E001 午餐 15元 - 日班正常"
echo "  TX003: E002 夜餐 18元 (22:30) - 夜班正常"
echo "  TX004: E002 夜餐 12元 (次日03:15) - 跨天，归属前一天"
echo "  TX005: E003 午餐 15元 - 正常"
echo "  TX006: E003 午餐 10元 - 15分钟后重复刷卡（异常）"
echo "  TX007: E004 午餐 15元 - 非工作日（异常）"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/api/import/consumptions" \
  -H "Content-Type: application/json" \
  -d '[
    { "transactionId": "TX001", "employeeId": "E001", "swipeTime": "2025-01-15 07:30:00", "amount": 8, "merchant": "食堂A" },
    { "transactionId": "TX002", "employeeId": "E001", "swipeTime": "2025-01-15 12:05:00", "amount": 15, "merchant": "食堂A" },
    { "transactionId": "TX003", "employeeId": "E002", "swipeTime": "2025-01-15 22:30:00", "amount": 18, "merchant": "食堂B" },
    { "transactionId": "TX004", "employeeId": "E002", "swipeTime": "2025-01-16 03:15:00", "amount": 12, "merchant": "食堂B" },
    { "transactionId": "TX005", "employeeId": "E003", "swipeTime": "2025-01-15 12:00:00", "amount": 15, "merchant": "食堂A" },
    { "transactionId": "TX006", "employeeId": "E003", "swipeTime": "2025-01-15 12:15:00", "amount": 10, "merchant": "食堂A" },
    { "transactionId": "TX007", "employeeId": "E004", "swipeTime": "2025-01-15 12:00:00", "amount": 15, "merchant": "食堂A" }
  ]'
echo ""
echo ""

echo "----------------------------------------"
echo "Step 3b: 测试幂等性（重复导入相同流水）"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/api/import/consumptions" \
  -H "Content-Type: application/json" \
  -d '[
    { "transactionId": "TX001", "employeeId": "E001", "swipeTime": "2025-01-15 07:30:00", "amount": 8, "merchant": "食堂A" },
    { "transactionId": "TX002", "employeeId": "E001", "swipeTime": "2025-01-15 12:05:00", "amount": 15, "merchant": "食堂A" }
  ]'
echo ""
echo ""

echo "----------------------------------------"
echo "Step 4: 导入补贴规则"
echo "  日班: 30元/天, 夜班: 40元/天"
echo "  日限额: 30元, 非工作日: 不允许"
echo "----------------------------------------"
curl -s -X POST "$BASE_URL/api/import/subsidy-rules" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "RULE_2025",
    "name": "2025年标准餐补规则",
    "dayShiftAmount": 30,
    "nightShiftAmount": 40,
    "dailyLimit": 30,
    "mealTimes": {
      "breakfast": { "start": "06:30", "end": "08:30" },
      "lunch": { "start": "11:30", "end": "13:00" },
      "dinner": { "start": "17:30", "end": "19:30" },
      "nightMeal": { "start": "22:00", "end": "05:00" }
    },
    "nonWorkDayAllowed": false,
    "effectiveFrom": "2025-01-01",
    "effectiveTo": null
  }'
echo ""
echo ""

echo "----------------------------------------"
echo "Step 5: 执行餐补计算"
echo "----------------------------------------"
CALC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "periodStart": "2025-01-15",
    "periodEnd": "2025-01-16",
    "ruleId": "RULE_2025"
  }')
echo "$CALC_RESPONSE"
BATCH_ID=$(echo "$CALC_RESPONSE" | grep -o '"batchId":"[^"]*"' | cut -d'"' -f4)
echo ""
echo "Batch ID: $BATCH_ID"
echo ""

echo "----------------------------------------"
echo "Step 6: 查询异常明细"
echo "----------------------------------------"
curl -s "$BASE_URL/api/abnormals/$BATCH_ID" | python3 -m json.tool
echo ""
echo ""

echo "----------------------------------------"
echo "Step 7: 按部门查询汇总"
echo "----------------------------------------"
SUMMARY=$(curl -s "$BASE_URL/api/summary/$BATCH_ID")
echo "$SUMMARY" | python3 -m json.tool
echo ""
echo ""

echo "----------------------------------------"
echo "Step 8: 提取 calculationId 进行复核"
echo "----------------------------------------"
E003_CALC_ID=$(echo "$SUMMARY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for dept in data.get('data', []):
    for emp in dept.get('employees', []):
        if emp.get('employeeId') == 'E003':
            print(emp.get('employeeId', ''))
" 2>/dev/null)

echo "准备进行复核操作..."
echo ""

echo "查询所有计算记录以获取 calculationId:"
ALL_CALCS=$(curl -s "$BASE_URL/api/abnormals/$BATCH_ID")
echo "$ALL_CALCS"
echo ""

echo "----------------------------------------"
echo "演示完成！"
echo "----------------------------------------"
echo ""
echo "预期检测到的异常："
echo "  1. E003 王五 - duplicate_swipe (重复刷卡)"
echo "  2. E004 赵六 - non_workday (非工作日消费)"
echo ""
echo "跨天处理："
echo "  E002 李四 - 夜班消费(次日03:15)正确归属到 2025-01-15"
echo ""
echo "下一步操作："
echo "  1. 手动调用 /api/approval 进行人工复核"
echo "  2. 调用 /api/differences/$BATCH_ID 查看复核差额"
echo "  3. 调用 /api/regenerate-report/$BATCH_ID 重新生成报表"
echo ""
