#!/bin/bash

BASE_URL="http://localhost:8000"

echo "========================================"
echo "  宠物医院药房管理系统 - curl 示例"
echo "========================================"
echo ""

echo "1. 检查系统状态"
echo "curl $BASE_URL/"
curl -s "$BASE_URL/" | python3 -m json.tool
echo ""

echo "2. 获取药品列表"
echo "curl $BASE_URL/api/v1/medicines/"
curl -s "$BASE_URL/api/v1/medicines/" | python3 -m json.tool
echo ""

echo "3. 获取库存列表"
echo "curl $BASE_URL/api/v1/inventory/"
curl -s "$BASE_URL/api/v1/inventory/" | python3 -m json.tool
echo ""

echo "4. 提交正常处方（剂量正确）"
curl -s -X POST "$BASE_URL/api/v1/prescriptions/process" \
  -H "Content-Type: application/json" \
  -d '{
    "prescription_no": "PRES-CURL-001",
    "doctor_id": "DOC001",
    "doctor_name": "张医生",
    "pet_id": "PET001",
    "pet_name": "旺财",
    "pet_species": "犬",
    "pet_weight_kg": 10.0,
    "owner_name": "李先生",
    "owner_phone": "13800138000",
    "diagnosis": "皮肤感染",
    "items": [
      {
        "medicine_name": "阿莫西林片剂",
        "medicine_id": 1,
        "batch_number": "AMX-2024-001",
        "dosage": 150.0,
        "dosage_unit": "mg",
        "frequency": "每日2次",
        "duration_days": 7,
        "quantity": 14,
        "unit_price": 2.5
      }
    ]
  }' | python3 -m json.tool
echo ""

echo "5. 提交剂量超标的处方（应该被拦截）"
curl -s -X POST "$BASE_URL/api/v1/prescriptions/process" \
  -H "Content-Type: application/json" \
  -d '{
    "prescription_no": "PRES-CURL-002",
    "doctor_id": "DOC001",
    "doctor_name": "张医生",
    "pet_id": "PET002",
    "pet_name": "小咪",
    "pet_species": "猫",
    "pet_weight_kg": 3.0,
    "owner_name": "王女士",
    "owner_phone": "13900139000",
    "diagnosis": "呼吸道感染",
    "items": [
      {
        "medicine_name": "阿莫西林片剂",
        "medicine_id": 1,
        "batch_number": "AMX-2024-001",
        "dosage": 100.0,
        "dosage_unit": "mg",
        "frequency": "每日2次",
        "duration_days": 7,
        "quantity": 14,
        "unit_price": 2.5
      }
    ]
  }' | python3 -m json.tool
echo ""

echo "6. 查看所有处方"
echo "curl $BASE_URL/api/v1/prescriptions/"
curl -s "$BASE_URL/api/v1/prescriptions/" | python3 -m json.tool
echo ""

echo "7. 查看审计日志"
echo "curl $BASE_URL/api/v1/audit-logs/"
curl -s "$BASE_URL/api/v1/audit-logs/" | python3 -m json.tool
echo ""

echo "8. 查看统计数据"
echo "curl $BASE_URL/api/v1/dashboard/stats"
curl -s "$BASE_URL/api/v1/dashboard/stats" | python3 -m json.tool
echo ""

echo "9. 导出CSV（保存到文件）"
echo "curl -X POST $BASE_URL/api/v1/export/prescriptions -H 'Content-Type: application/json' -d '{\"include_blocked\": true}' -o prescriptions_export.csv"
curl -s -X POST "$BASE_URL/api/v1/export/prescriptions" \
  -H "Content-Type: application/json" \
  -d '{"include_blocked": true}' \
  -o prescriptions_export.csv
echo "导出完成，已保存到 prescriptions_export.csv"
echo ""

echo "========================================"
echo "  ✅ 所有 curl 示例执行完成！"
echo "========================================"
echo ""
echo "💡 提示："
echo "   - 访问 http://localhost:8000/docs 查看交互式API文档"
echo "   - 运行 python test_prescription.py 执行完整流程测试"
echo ""
