#!/bin/bash
set -e

echo "=== 测试Excel/CSV导入功能 ==="
echo ""

echo "1. 生成示例数据..."
python3 sample_data.xlsx.py
echo ""

echo "2. 导入留样Excel..."
curl -s -X POST http://localhost:8000/api/import/samples/excel/ \
  -F "file=@sample_data.xlsx" | python3 -m json.tool
echo ""

echo "3. 导入温度CSV..."
curl -s -X POST http://localhost:8000/api/import/temperatures/csv/ \
  -F "file=@temperature_data.csv" | python3 -m json.tool
echo ""

echo "4. 查看所有导入错误..."
curl -s http://localhost:8000/api/import/errors/ | python3 -m json.tool
echo ""

echo "=== 导入测试完成 ==="
