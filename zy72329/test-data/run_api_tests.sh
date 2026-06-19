#!/bin/bash
set -e

BASE_URL="http://localhost:3002"

echo "=== 1. 登录 ==="
LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "$LOGIN_RESP" | python3 -m json.tool

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
echo "Token acquired: ${TOKEN:0:30}..."

echo ""
echo "=== 2. 导入老师批注 ==="
curl -s -X POST "$BASE_URL/api/import/teacher-notes" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-data/teacher_notes_sample.csv" \
  | python3 -m json.tool

echo ""
echo "=== 3. 导入抽样名单 ==="
curl -s -X POST "$BASE_URL/api/import/sampling-list" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-data/sampling_list_sample.csv" \
  | python3 -m json.tool

echo ""
echo "=== 4. 获取记录列表 ==="
curl -s "$BASE_URL/api/records" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

echo ""
echo "=== 5. 获取版本列表 ==="
curl -s "$BASE_URL/api/versions" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

echo ""
echo "=== 6. 获取导入历史 ==="
curl -s "$BASE_URL/api/import/history" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

echo ""
echo "=== 7. 版本对比 (v1.0 vs v1.1) ==="
curl -s "$BASE_URL/api/versions/compare?from=1.0&to=1.1" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool

echo ""
echo "=== 8. 获取操作历史 ==="
curl -s "$BASE_URL/api/history" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool | head -100

echo ""
echo "=== 9. 导出 Excel (保存到 /tmp/report.xlsx) ==="
curl -s -o /tmp/report.xlsx "$BASE_URL/api/export/excel" \
  -H "Authorization: Bearer $TOKEN"
file /tmp/report.xlsx
ls -lh /tmp/report.xlsx

echo ""
echo "=== 10. 导出 CSV (前200字) ==="
curl -s "$BASE_URL/api/export/csv" \
  -H "Authorization: Bearer $TOKEN" \
  | head -c 500

echo ""
echo ""
echo "✅ 所有 API 测试完成"
