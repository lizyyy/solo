#!/bin/bash

BASE_URL="http://127.0.0.1:8000"

echo "========================================"
echo "地下泵房巡检数据处理系统 - 主流程测试"
echo "========================================"
echo ""

echo "【步骤 1】检查系统状态"
curl -s "${BASE_URL}/" | python3 -m json.tool
echo ""

echo "【步骤 2】上传CSV巡检表数据"
curl -s -X POST -F "file=@test_inspection.csv" "${BASE_URL}/api/upload/csv" | python3 -m json.tool
echo ""

echo "【步骤 3】上传JSON传感器告警数据"
curl -s -X POST -F "file=@test_sensor.json" "${BASE_URL}/api/upload/json" | python3 -m json.tool
echo ""

echo "【步骤 4】获取系统统计信息"
curl -s "${BASE_URL}/api/stats" | python3 -m json.tool
echo ""

echo "【步骤 5】查询巡检记录列表"
curl -s "${BASE_URL}/api/records?limit=5" | python3 -m json.tool
echo ""

echo "【步骤 6】查询所有错误记录（含详细原因和建议"
curl -s "${BASE_URL}/api/errors" | python3 -m json.tool
echo ""

echo "【步骤 7】查询文件处理历史"
curl -s "${BASE_URL}/api/history" | python3 -m json.tool
echo ""

echo "【步骤 8】标记第一条错误记录为已解决"
FIRST_ERROR_ID=$(curl -s "${BASE_URL}/api/errors?limit=1" | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['errors'][0]['id'])")
curl -s -X PUT "${BASE_URL}/api/errors/${FIRST_ERROR_ID}/resolve" | python3 -m json.tool
echo ""

echo "【步骤 9】导出巡检记录为CSV"
curl -s -o exported_records.csv "${BASE_URL}/api/export/records" && echo "导出成功，保存为 exported_records.csv"
echo ""

echo "【步骤 10】导出错误记录为CSV"
curl -s -o exported_errors.csv "${BASE_URL}/api/export/errors" && echo "导出成功，保存为 exported_errors.csv"
echo ""

echo "========================================"
echo "主流程测试完成！"
echo "请检查："
echo "  - 敏感字段（姓名、电话）是否已脱敏"
echo "  - 错误记录是否包含详细原因和修改建议"
echo "  - 重启服务后历史数据是否保留（SQLite本地持久化）"
echo "========================================"
