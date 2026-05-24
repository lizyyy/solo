#!/bin/bash
set -e

BASE_URL="http://localhost:8082/api/v1"

echo "=== 1. 创建补贴申请（收件阶段） ==="
APP_ID=$(curl -s -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{
    "application_year": 2025,
    "applicant_name": "张三",
    "applicant_id_card": "330101198001010001",
    "vessel_number": "浙渔00001",
    "receipt_numbers": ["RCP202500001", "RCP202500002"],
    "voyages": [
      {"voyage_number": "V202503001", "departure_date": "2025-03-10T08:00:00Z", "return_date": "2025-03-12T18:00:00Z", "fishing_area": "东海189海区", "fuel_consumed": 2500, "catch_weight": 5000},
      {"voyage_number": "V202504001", "departure_date": "2025-04-15T06:00:00Z", "return_date": "2025-04-18T20:00:00Z", "fishing_area": "东海192海区", "fuel_consumed": 3500, "catch_weight": 8000},
      {"voyage_number": "V202506001", "departure_date": "2025-06-05T08:00:00Z", "return_date": "2025-06-08T18:00:00Z", "fishing_area": "东海195海区", "fuel_consumed": 2000, "catch_weight": 3000}
    ]
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['application']['id']); print('申请编号:', d['data']['application']['application_no']); print('当前状态:', d['data']['application']['status']); print('校验结果: 禁渔期问题航次数量 =', sum(1 for v in d['data']['validation']['voyage_results'] if not v['passed'])); print('禁渔期问题:', [v['reasons'] for v in d['data']['validation']['voyage_results'] if not v['passed']])")

echo ""
echo "=== 2. 核验申请 ==="
VERIFY_RESULT=$(curl -s -X POST "$BASE_URL/applications/verify" \
  -H "Content-Type: application/json" \
  -d "{\"application_id\": \"$APP_ID\", \"operator\": \"auditor1\", \"passed\": true, \"reason\": \"材料核验通过\"}")
echo "$VERIFY_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('核验后状态:', d['data']['application']['status'])"

echo ""
echo "=== 3. 处理申请（计算补贴） ==="
PROCESS_RESULT=$(curl -s -X POST "$BASE_URL/applications/process" \
  -H "Content-Type: application/json" \
  -d "{\"application_id\": \"$APP_ID\", \"operator\": \"auditor2\", \"reason\": \"补贴计算完成\"}")
echo "$PROCESS_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('处理后状态:', d['data']['status']); print('总油量:', d['data']['total_fuel_amount'], '升'); print('补贴金额:', d['data']['subsidy_amount'], '元')"

echo ""
echo "=== 4. 复查申请 ==="
REVIEW_RESULT=$(curl -s -X POST "$BASE_URL/applications/review" \
  -H "Content-Type: application/json" \
  -d "{\"application_id\": \"$APP_ID\", \"operator\": \"reviewer\", \"passed\": true, \"reason\": \"复核通过\"}")
echo "$REVIEW_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('复查后状态:', d['data']['status'])"

echo ""
echo "=== 5. 结案 ==="
CLOSE_RESULT=$(curl -s -X POST "$BASE_URL/applications/close" \
  -H "Content-Type: application/json" \
  -d "{\"application_id\": \"$APP_ID\", \"operator\": \"admin\", \"reason\": \"同意结案\"}")
echo "$CLOSE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('结案后状态:', d['data']['status'])"

echo ""
echo "=== 6. 查看审核日志 ==="
curl -s "$BASE_URL/applications/$APP_ID/logs" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('审核流程:')
for log in d['data']:
    print(f'  [{log[\"created_at\"]}] {log[\"operator_name\"]} - {log[\"stage\"]}: {log[\"to_status\"]} - {log[\"reason\"]}')
"

echo ""
echo "=== 7. 查看统计数据 ==="
curl -s "$BASE_URL/statistics?year=2025" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('2025年度统计:')
print(f'  总申请数: {d[\"data\"][\"total_apps\"]}')
print(f'  已结案: {d[\"data\"][\"closed_apps\"]}')
print(f'  总油量: {d[\"data\"][\"total_fuel_amount\"]} 升')
print(f'  总补贴: {d[\"data\"][\"total_subsidy\"]} 元')
print(f'  涉及渔船: {d[\"data\"][\"total_vessels\"]} 艘')
"

echo ""
echo "=== 8. 导出 Excel 报告 ==="
curl -s "$BASE_URL/reports/export?year=2025" | python3 -c "import sys,json; d=json.load(sys.stdin); print('报告生成成功:', d['data']['file_path'])"

echo ""
echo "=== 9. 测试重复提交 ==="
echo "再次提交相同的加油票..."
curl -s -X POST "$BASE_URL/applications" \
  -H "Content-Type: application/json" \
  -H "X-Operator: admin" \
  -d '{
    "application_year": 2025,
    "applicant_name": "张三",
    "applicant_id_card": "330101198001010001",
    "vessel_number": "浙渔00001",
    "receipt_numbers": ["RCP202500001"],
    "voyages": []
  }' | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d['code'] == 1001:
    print('✓ 正确检测到重复提交!')
    print('  原始申请编号:', d['data']['original_application']['application_no'])
    print('  处理人:', d['data']['processed_by'])
else:
    print('未检测到重复，code=', d['code'])
"

echo ""
echo "=== 测试完成 ==="
