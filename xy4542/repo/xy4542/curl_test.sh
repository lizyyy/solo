#!/bin/bash

BASE_URL="http://localhost:8000"
BUSINESS_DATE="2026-05-05"
DATA_DIR="./data"

echo "========================================"
echo "现金中心清分核对系统 - 测试流程"
echo "========================================"
echo ""

echo "【步骤1】检查系统状态"
echo "------------------------"
curl -s "${BASE_URL}/" | python3 -m json.tool
echo ""

echo "【步骤2】导入柜员缴款CSV"
echo "------------------------"
curl -s -X POST "${BASE_URL}/import/teller-payment" \
  -F "file=@${DATA_DIR}/teller_payments.csv" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=测试员" | python3 -m json.tool
echo ""

echo "【步骤3】导入清分机冠字号日志CSV"
echo "------------------------"
curl -s -X POST "${BASE_URL}/import/sorting-log" \
  -F "file=@${DATA_DIR}/sorting_logs.csv" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=测试员" | python3 -m json.tool
echo ""

echo "【步骤4】导入扎把标签JSON"
echo "------------------------"
curl -s -X POST "${BASE_URL}/import/bundle-tag" \
  -F "file=@${DATA_DIR}/bundle_tags.json" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=测试员" | python3 -m json.tool
echo ""

echo "【步骤5】导入ATM加钞计划CSV"
echo "------------------------"
curl -s -X POST "${BASE_URL}/import/atm-plan" \
  -F "file=@${DATA_DIR}/atm_plans.csv" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=测试员" | python3 -m json.tool
echo ""

echo "【步骤6】导入差错备注CSV"
echo "------------------------"
curl -s -X POST "${BASE_URL}/import/error-remark" \
  -F "file=@${DATA_DIR}/error_remarks.csv" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=测试员" | python3 -m json.tool
echo ""

echo "【步骤7】执行风险重算"
echo "------------------------"
curl -s -X POST "${BASE_URL}/action/recalculate" \
  -F "business_date=${BUSINESS_DATE}" \
  -F "operator=测试员" | python3 -m json.tool
echo ""

echo "【步骤8】查询统计信息"
echo "------------------------"
curl -s "${BASE_URL}/query/stats?business_date=${BUSINESS_DATE}" | python3 -m json.tool
echo ""

echo "【步骤9】查询风险预警列表"
echo "------------------------"
curl -s "${BASE_URL}/query/risks?business_date=${BUSINESS_DATE}" | python3 -m json.tool
echo ""

echo "【步骤10】查询扎把列表"
echo "------------------------"
curl -s "${BASE_URL}/query/bundles?business_date=${BUSINESS_DATE}" | python3 -m json.tool
echo ""

echo "【步骤11】查询柜员缴款汇总"
echo "------------------------"
curl -s "${BASE_URL}/query/tellers?business_date=${BUSINESS_DATE}" | python3 -m json.tool
echo ""

echo "【步骤12】查询ATM加钞计划"
echo "------------------------"
curl -s "${BASE_URL}/query/atm-plans?business_date=${BUSINESS_DATE}" | python3 -m json.tool
echo ""

echo "【步骤13】导出Markdown交接单"
echo "------------------------"
curl -s "${BASE_URL}/action/export/handover?business_date=${BUSINESS_DATE}" | python3 -m json.tool
echo ""

echo "【步骤14】导出JSON审计明细"
echo "------------------------"
curl -s "${BASE_URL}/action/export/audit?business_date=${BUSINESS_DATE}" | python3 -m json.tool
echo ""

echo "【步骤15】查询审计日志"
echo "------------------------"
curl -s "${BASE_URL}/query/audit-logs?business_date=${BUSINESS_DATE}" | python3 -m json.tool
echo ""

echo "========================================"
echo "测试流程完成！"
echo "========================================"
echo ""
echo "【后续操作建议】"
echo "1. 查看风险预警详情，进行人工复核"
echo "2. 下载导出的交接单和审计明细"
echo "3. 访问 http://localhost:8000/docs 查看完整API文档"
echo ""
