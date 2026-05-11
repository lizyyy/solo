#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 导入补贴规则 ==="
echo "规则说明："
echo "  日班餐补: 30元/天"
echo "  夜班餐补: 40元/天"
echo "  日限额: 30元"
echo "  非工作日: 不允许补贴"
echo "  餐段: 早餐(06:30-08:30), 午餐(11:30-13:00), 晚餐(17:30-19:30), 夜餐(22:00-05:00)"

curl -X POST "$BASE_URL/api/import/subsidy-rules" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
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
}
EOF

echo ""
echo ""
