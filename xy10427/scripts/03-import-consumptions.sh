#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 第一次导入消费流水 ==="
echo "说明："
echo "  TX001: E001 早餐 - 日班正常消费"
echo "  TX002: E001 午餐 - 日班正常消费"
echo "  TX003: E002 夜餐 (22:30) - 夜班跨天消费"
echo "  TX004: E002 夜餐 (次日03:15) - 夜班跨天消费（归属前一天）"
echo "  TX005: E003 午餐 - 正常"
echo "  TX006: E003 午餐 - 15分钟后再次刷卡（重复刷卡异常）"
echo "  TX007: E004 午餐 - 非工作日（非工作日消费异常）"

curl -X POST "$BASE_URL/api/import/consumptions" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
[
  { "transactionId": "TX001", "employeeId": "E001", "swipeTime": "2025-01-15 07:30:00", "amount": 8, "merchant": "食堂A" },
  { "transactionId": "TX002", "employeeId": "E001", "swipeTime": "2025-01-15 12:05:00", "amount": 15, "merchant": "食堂A" },
  { "transactionId": "TX003", "employeeId": "E002", "swipeTime": "2025-01-15 22:30:00", "amount": 18, "merchant": "食堂B" },
  { "transactionId": "TX004", "employeeId": "E002", "swipeTime": "2025-01-16 03:15:00", "amount": 12, "merchant": "食堂B" },
  { "transactionId": "TX005", "employeeId": "E003", "swipeTime": "2025-01-15 12:00:00", "amount": 15, "merchant": "食堂A" },
  { "transactionId": "TX006", "employeeId": "E003", "swipeTime": "2025-01-15 12:15:00", "amount": 10, "merchant": "食堂A" },
  { "transactionId": "TX007", "employeeId": "E004", "swipeTime": "2025-01-15 12:00:00", "amount": 15, "merchant": "食堂A" }
]
EOF

echo ""
echo ""

echo "=== 重复导入相同流水（测试幂等性）==="
echo "预计：inserted: 0, skipped: 7"

curl -X POST "$BASE_URL/api/import/consumptions" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
[
  { "transactionId": "TX001", "employeeId": "E001", "swipeTime": "2025-01-15 07:30:00", "amount": 8, "merchant": "食堂A" },
  { "transactionId": "TX002", "employeeId": "E001", "swipeTime": "2025-01-15 12:05:00", "amount": 15, "merchant": "食堂A" }
]
EOF

echo ""
echo ""
