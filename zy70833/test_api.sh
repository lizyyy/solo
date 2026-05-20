#!/bin/bash

echo "=== 晨检用药管理系统 API 测试 ==="
echo ""

echo "1. 提交晨检CSV、用药JSON和班级名单"
curl -X POST "http://localhost:8000/api/submit" \
  -F "morning_check=@sample_data/morning_check.csv" \
  -F "medicine_auth=@sample_data/medicine_auth.json" \
  -F "class_list=@sample_data/class_list.csv" \
  -H "Content-Type: multipart/form-data" | python3 -m json.tool
echo ""
echo ""

echo "2. 再次提交同一批数据（应该提示重复提交）"
curl -X POST "http://localhost:8000/api/submit" \
  -F "morning_check=@sample_data/morning_check.csv" \
  -F "medicine_auth=@sample_data/medicine_auth.json" \
  -F "class_list=@sample_data/class_list.csv" \
  -H "Content-Type: multipart/form-data" | python3 -m json.tool
echo ""
echo ""

echo "3. 查询所有提交批次"
curl -X GET "http://localhost:8000/api/batches" | python3 -m json.tool
echo ""
echo ""

echo "4. 查询发热学生 S002 的隔离历史（追踪来源）"
curl -X GET "http://localhost:8000/api/isolation/student/S002" | python3 -m json.tool
echo ""
echo ""

echo "5. 查询发热学生 S004 的隔离历史（追踪来源）"
curl -X GET "http://localhost:8000/api/isolation/student/S004" | python3 -m json.tool
echo ""
echo ""

echo "=== 测试完成 ==="
