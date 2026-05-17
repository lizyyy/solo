#!/bin/bash
# 库存锁定释放API - curl 示例脚本
# 使用方法:
#   1. 启动服务: npm start
#   2. 执行示例: chmod +x api-examples.sh && ./api-examples.sh

BASE_URL="http://localhost:3000/api"
ACTIVITY_ID="PROMO_2024_001"
REQUEST_ID="req_$(date +%s)"

echo "=========================================="
echo "库存锁定释放API - 示例脚本"
echo "=========================================="
echo ""

# 1. 健康检查
echo "【1/10】健康检查"
curl -s "${BASE_URL}/health" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/health"
echo ""
echo "------------------------------------------"
echo ""

# 2. 创建库存锁定
echo "【2/10】创建库存锁定 - 活动 ${ACTIVITY_ID}"
CREATE_RESULT=$(curl -s -X POST "${BASE_URL}/stock/locks" \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "'"${ACTIVITY_ID}"'",
    "skuItems": [
      { "sku": "SKU001", "skuName": "商品A-红色XL", "quantity": 100 },
      { "sku": "SKU002", "skuName": "商品B-蓝色M", "quantity": 200 },
      { "sku": "SKU003", "skuName": "商品C-绿色L", "quantity": 150 }
    ],
    "releaseCondition": "ACTIVITY_CANCEL",
    "operator": "张三"
  }')
echo "${CREATE_RESULT}" | python3 -m json.tool 2>/dev/null || echo "${CREATE_RESULT}"
echo ""
echo "------------------------------------------"
echo ""

# 3. 查询库存锁定列表
echo "【3/10】查询库存锁定列表（按活动号）"
curl -s "${BASE_URL}/stock/locks?activityId=${ACTIVITY_ID}" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/stock/locks?activityId=${ACTIVITY_ID}"
echo ""
echo "------------------------------------------"
echo ""

# 4. 导出库存锁定列表（业务友好格式）
echo "【4/10】导出库存锁定列表 - 保存为 stock_locks.txt"
curl -s "${BASE_URL}/stock/locks/export?activityId=${ACTIVITY_ID}" -o stock_locks.txt
echo "文件已保存: stock_locks.txt"
head -30 stock_locks.txt
echo ""
echo "------------------------------------------"
echo ""

# 5. 推进状态（释放库存）
echo "【5/10】推进状态 - 活动 ${ACTIVITY_ID} 释放库存"
ADVANCE_RESULT=$(curl -s -X POST "${BASE_URL}/stock/locks/advance" \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "'"${ACTIVITY_ID}"'",
    "releaseCondition": "ACTIVITY_CANCEL",
    "requestId": "'"${REQUEST_ID}"'",
    "operator": "李四"
  }')
echo "${ADVANCE_RESULT}" | python3 -m json.tool 2>/dev/null || echo "${ADVANCE_RESULT}"
echo ""
echo "------------------------------------------"
echo ""

# 6. 幂等性测试 - 重复调用相同请求
echo "【6/10】幂等性测试 - 重复调用相同请求（预期：已处理，无重复释放）"
curl -s -X POST "${BASE_URL}/stock/locks/advance" \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "'"${ACTIVITY_ID}"'",
    "releaseCondition": "ACTIVITY_CANCEL",
    "requestId": "'"${REQUEST_ID}"'",
    "operator": "李四"
  }' | python3 -m json.tool 2>/dev/null || curl -s -X POST "${BASE_URL}/stock/locks/advance" \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "'"${ACTIVITY_ID}"'",
    "releaseCondition": "ACTIVITY_CANCEL",
    "requestId": "'"${REQUEST_ID}"'",
    "operator": "李四"
  }'
echo ""
echo "------------------------------------------"
echo ""

# 7. 查询异常列表
echo "【7/10】查询异常列表"
curl -s "${BASE_URL}/stock/exceptions" | python3 -m json.tool 2>/dev/null || curl -s "${BASE_URL}/stock/exceptions"
echo ""
echo "------------------------------------------"
echo ""

# 8. 生成释放报告
echo "【8/10】生成释放报告 - 活动 ${ACTIVITY_ID}"
REPORT_RESULT=$(curl -s -X POST "${BASE_URL}/stock/reports/${ACTIVITY_ID}" \
  -H "Content-Type: application/json" \
  -d '{"operator": "王五"}')
echo "${REPORT_RESULT}" | python3 -m json.tool 2>/dev/null || echo "${REPORT_RESULT}"
echo ""
echo "------------------------------------------"
echo ""

# 9. 导出报告（业务友好格式 txt）
echo "【9/10】导出释放报告 - 保存为 stock_report.txt"
curl -s "${BASE_URL}/stock/reports/${ACTIVITY_ID}/export" -o stock_report.txt
echo "文件已保存: stock_report.txt"
cat stock_report.txt
echo ""
echo "------------------------------------------"
echo ""

# 10. 导出报告（CSV格式）
echo "【10/10】导出释放报告（CSV格式） - 保存为 stock_report.csv"
curl -s "${BASE_URL}/stock/reports/${ACTIVITY_ID}/export?format=csv" -o stock_report.csv
echo "文件已保存: stock_report.csv"
cat stock_report.csv
echo ""
echo "=========================================="
echo "示例执行完成！"
echo "生成的文件:"
echo "  - stock_locks.txt    库存锁定列表"
echo "  - stock_report.txt   释放报告（易读格式）"
echo "  - stock_report.csv   释放报告（CSV格式）"
echo "=========================================="
