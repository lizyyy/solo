#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 导入班次 ==="
echo "说明："
echo "  E001 张三 - 日班 (08:00-20:00) - 工作日"
echo "  E002 李四 - 夜班 (20:00-08:00) - 跨天 - 工作日"
echo "  E003 王五 - 日班 (08:00-20:00) - 工作日（会产生重复刷卡异常）"
echo "  E004 赵六 - 日班 (08:00-20:00) - 非工作日（会产生非工作日消费异常）"

curl -X POST "$BASE_URL/api/import/shifts" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
[
  { "employeeId": "E001", "date": "2025-01-15", "shiftType": "day", "startTime": "08:00", "endTime": "20:00", "isWorkDay": true },
  { "employeeId": "E002", "date": "2025-01-15", "shiftType": "night", "startTime": "20:00", "endTime": "08:00", "isWorkDay": true },
  { "employeeId": "E003", "date": "2025-01-15", "shiftType": "day", "startTime": "08:00", "endTime": "20:00", "isWorkDay": true },
  { "employeeId": "E004", "date": "2025-01-15", "shiftType": "day", "startTime": "08:00", "endTime": "20:00", "isWorkDay": false }
]
EOF

echo ""
echo ""
