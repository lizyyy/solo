#!/bin/bash

BASE_URL="http://localhost:8000"

echo "========================================="
echo "高校实验室试剂管理系统 - 主流程测试"
echo "========================================="
echo ""

echo "[1/8] 导入危化品规则..."
curl -s -X POST "$BASE_URL/import/chemical-rules" \
  -F "file=@data/chemical_rules.json" \
  -H "Content-Type: multipart/form-data" | python3 -m json.tool
echo ""

echo "[2/8] 导入库存数据..."
curl -s -X POST "$BASE_URL/import/inventory" \
  -F "file=@data/inventory.json" \
  -H "Content-Type: multipart/form-data" | python3 -m json.tool
echo ""

echo "[3/8] 导入申领单数据 (CSV)..."
curl -s -X POST "$BASE_URL/import/applications" \
  -F "file=@data/applications.csv" \
  -H "Content-Type: multipart/form-data" | python3 -m json.tool
echo ""

echo "[4/8] 创建新的申领单 (乙酸乙酯)..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/application/create" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "applicant_id=S2024003" \
  -d "applicant_name=王五" \
  -d "applicant_role=student" \
  -d "cas_number=141-78-6" \
  -d "chinese_name=乙酸乙酯" \
  -d "quantity=300" \
  -d "unit=ml" \
  -d "purpose=萃取实验" \
  -d "lab_name=化学楼303")
echo "$CREATE_RESPONSE" | python3 -m json.tool
APPLICATION_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['application_id'])")
echo "新建申领单ID: $APPLICATION_ID"
echo ""

echo "[5/8] 测试幂等性 - 重复提交相同申领单..."
curl -s -X POST "$BASE_URL/application/create" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "applicant_id=S2024003" \
  -d "applicant_name=王五" \
  -d "applicant_role=student" \
  -d "cas_number=141-78-6" \
  -d "chinese_name=乙酸乙酯" \
  -d "quantity=300" \
  -d "unit=ml" \
  -d "purpose=萃取实验" \
  -d "lab_name=化学楼303" | python3 -m json.tool
echo ""

echo "[6/8] 审批申领单 (2级审批)..."
curl -s -X POST "$BASE_URL/application/approve" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "application_id=$APPLICATION_ID" \
  -d "approver_id=T2024002" \
  -d "approver_name=李主任" \
  -d "approval_level=2" \
  -d "decision=approve" \
  -d "comment=实验需要，同意" | python3 -m json.tool
echo ""

echo "[7/8] 试剂出库..."
curl -s -X POST "$BASE_URL/inventory/issue" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "application_id=$APPLICATION_ID" \
  -d "operator_id=A001" \
  -d "operator_name=仓库管理员" | python3 -m json.tool
echo ""

echo "[8/8] 查看当前库存 (确认敏感字段已脱敏)..."
curl -s -X GET "$BASE_URL/inventory" | python3 -m json.tool
echo ""

echo "========================================="
echo "查看错误记录示例:"
curl -s -X GET "$BASE_URL/bad-records" | python3 -m json.tool
echo ""

echo "查看所有申领单:"
curl -s -X GET "$BASE_URL/applications" | python3 -m json.tool
echo ""

echo "导出操作日志:"
curl -s -X GET "$BASE_URL/export/logs" | python3 -m json.tool
echo ""

echo "========================================="
echo "主流程测试完成！"
echo "========================================="
