#!/bin/bash
BASE_URL="http://localhost:8000"

echo "========================================="
echo "  地下泵房巡检管理系统 - 测试脚本"
echo "========================================="
echo ""

echo "1. 导入正常巡检表CSV..."
curl -s -X POST "$BASE_URL/import/inspection/csv" -F "file=@test_inspection.csv" | python3 -m json.tool
echo ""

echo "2. 导入含错误的巡检表CSV（测试坏记录处理）..."
curl -s -X POST "$BASE_URL/import/inspection/csv" -F "file=@test_bad_inspection.csv" | python3 -m json.tool
echo ""

echo "3. 导入传感器告警JSON..."
curl -s -X POST "$BASE_URL/import/sensor/json" -F "file=@test_sensor.json" | python3 -m json.tool
echo ""

echo "4. 获取系统摘要..."
curl -s "$BASE_URL/summary" | python3 -m json.tool
echo ""

echo "5. 查询所有巡检记录..."
curl -s "$BASE_URL/records/inspection" | python3 -m json.tool
echo ""

echo "6. 按负责人筛选巡检记录（张工）..."
curl -s "$BASE_URL/records/inspection?inspector=张工" | python3 -m json.tool
echo ""

echo "7. 按状态筛选异常巡检记录..."
curl -s "$BASE_URL/records/inspection?status=异常" | python3 -m json.tool
echo ""

echo "8. 查询所有异常记录..."
curl -s "$BASE_URL/records/abnormal" | python3 -m json.tool
echo ""

echo "9. 按异常类型筛选异常记录..."
curl -s "$BASE_URL/records/abnormal?abnormal_type=电机过热" | python3 -m json.tool
echo ""

echo "10. 查询导入错误记录..."
curl -s "$BASE_URL/records/import-errors" | python3 -m json.tool
echo ""

echo "11. 导出巡检记录..."
curl -s "$BASE_URL/export/inspection" -o exported_inspection.csv
echo "已导出到 exported_inspection.csv"
echo ""

echo "12. 导出异常记录..."
curl -s "$BASE_URL/export/abnormal" -o exported_abnormal.csv
echo "已导出到 exported_abnormal.csv"
echo ""

echo "========================================="
echo "  测试完成！"
echo "========================================="