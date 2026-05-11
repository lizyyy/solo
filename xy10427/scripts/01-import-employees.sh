#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== 导入员工 ==="
curl -X POST "$BASE_URL/api/import/employees" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
[
  { "employeeId": "E001", "name": "张三", "department": "生产一部" },
  { "employeeId": "E002", "name": "李四", "department": "生产一部" },
  { "employeeId": "E003", "name": "王五", "department": "生产二部" },
  { "employeeId": "E004", "name": "赵六", "department": "生产二部" }
]
EOF

echo ""
echo ""
