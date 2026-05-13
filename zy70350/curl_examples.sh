#!/bin/bash

BASE_URL="http://localhost:5001/api/v1"

echo "=== 数据质量规则 API curl 示例 ==="
echo ""

echo "1. 创建客户数据集"
curl -s -X POST "$BASE_URL/datasets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "客户表",
    "description": "客户基本信息表",
    "source_type": "mysql",
    "connection_info": "host=localhost;port=3306;db=commerce",
    "table_name": "customers"
  }' | python3 -m json.tool
echo ""
echo ""

echo "2. 创建订单数据集"
curl -s -X POST "$BASE_URL/datasets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "订单表",
    "description": "订单主表",
    "source_type": "mysql",
    "connection_info": "host=localhost;port=3306;db=commerce",
    "table_name": "orders"
  }' | python3 -m json.tool
echo ""
echo ""

echo "3. 创建支付数据集"
curl -s -X POST "$BASE_URL/datasets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "支付表",
    "description": "支付记录表",
    "source_type": "mysql",
    "connection_info": "host=localhost;port=3306;db=commerce",
    "table_name": "payments"
  }' | python3 -m json.tool
echo ""
echo ""

echo "4. 查看所有数据集"
DATASETS=$(curl -s -X GET "$BASE_URL/datasets")
echo "$DATASETS" | python3 -m json.tool
echo ""
echo ""

CUSTOMER_ID=$(echo "$DATASETS" | python3 -c "import sys,json; data=json.load(sys.stdin); print([d['id'] for d in data['data'] if d['table_name']=='customers'][0])")
ORDER_ID=$(echo "$DATASETS" | python3 -c "import sys,json; data=json.load(sys.stdin); print([d['id'] for d in data['data'] if d['table_name']=='orders'][0])")
PAYMENT_ID=$(echo "$DATASETS" | python3 -c "import sys,json; data=json.load(sys.stdin); print([d['id'] for d in data['data'] if d['table_name']=='payments'][0])")

echo "数据集ID: 客户=$CUSTOMER_ID, 订单=$ORDER_ID, 支付=$PAYMENT_ID"
echo ""
echo ""

echo "5. 创建客户手机号空值检查规则 (阈值 10%)"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -d "{
    \"dataset_id\": $CUSTOMER_ID,
    \"rule_name\": \"客户手机号空值检查\",
    \"rule_type\": \"null_rate\",
    \"column_name\": \"phone\",
    \"threshold_config\": \"{\\\"max_null_rate\\\": 0.1}\"
  }" | python3 -m json.tool
echo ""
echo ""

echo "6. 创建订单金额日环比波动检查 (最大涨幅 20%)"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -d "{
    \"dataset_id\": $ORDER_ID,
    \"rule_name\": \"订单金额日环比波动检查\",
    \"rule_type\": \"daily_fluctuation\",
    \"column_name\": \"amount\",
    \"threshold_config\": \"{\\\"max_increase_ratio\\\": 0.2, \\\"max_decrease_ratio\\\": 0.3}\"
  }" | python3 -m json.tool
echo ""
echo ""

echo "7. 创建订单金额取值范围检查 (最大 10000)"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -d "{
    \"dataset_id\": $ORDER_ID,
    \"rule_name\": \"订单金额取值范围检查\",
    \"rule_type\": \"value_range\",
    \"column_name\": \"amount\",
    \"threshold_config\": \"{\\\"max_value\\\": 10000, \\\"min_value\\\": 0}\"
  }" | python3 -m json.tool
echo ""
echo ""

echo "8. 创建支付金额和订单金额一致性检查 (差异率 1%)"
curl -s -X POST "$BASE_URL/rules" \
  -H "Content-Type: application/json" \
  -d "{
    \"dataset_id\": $ORDER_ID,
    \"rule_name\": \"支付金额与订单金额一致性检查\",
    \"rule_type\": \"cross_table_consistency\",
    \"column_name\": \"amount\",
    \"target_dataset_id\": $PAYMENT_ID,
    \"target_column_name\": \"amount\",
    \"threshold_config\": \"{\\\"max_diff_ratio\\\": 0.01}\"
  }" | python3 -m json.tool
echo ""
echo ""

echo "9. 触发客户表检查任务"
TASK1=$(curl -s -X POST "$BASE_URL/check-tasks" \
  -H "Content-Type: application/json" \
  -d "{\"dataset_id\": $CUSTOMER_ID}")
echo "$TASK1" | python3 -m json.tool
echo ""
echo ""

echo "10. 触发订单表检查任务"
TASK2=$(curl -s -X POST "$BASE_URL/check-tasks" \
  -H "Content-Type: application/json" \
  -d "{\"dataset_id\": $ORDER_ID}")
echo "$TASK2" | python3 -m json.tool
echo ""
echo ""

echo "等待检查任务执行...(3秒)"
sleep 3
echo ""

echo "11. 查询客户表任务详情"
TASK1_ID=$(echo "$TASK1" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['data']['task_id'])")
curl -s -X GET "$BASE_URL/check-tasks/$TASK1_ID" | python3 -m json.tool
echo ""
echo ""

echo "12. 查询订单表任务详情"
TASK2_ID=$(echo "$TASK2" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['data']['task_id'])")
curl -s -X GET "$BASE_URL/check-tasks/$TASK2_ID" | python3 -m json.tool
echo ""
echo ""

echo "13. 查看客户数据集的规则"
RULES_CUST=$(curl -s -X GET "$BASE_URL/datasets/$CUSTOMER_ID/rules")
echo "$RULES_CUST" | python3 -m json.tool
echo ""
echo ""

echo "14. 查看客户手机号空值检查的异常样本"
TASK1_DETAIL=$(curl -s -X GET "$BASE_URL/check-tasks/$TASK1_ID")
CUST_RESULT_ID=$(echo "$TASK1_DETAIL" | python3 -c "import sys,json; data=json.load(sys.stdin); results=data['data']['results']; [print(r['id']) for r in results if r['result_type']!='passed']" 2>/dev/null)

if [ -n "$CUST_RESULT_ID" ]; then
    for RESULT_ID in $CUST_RESULT_ID; do
        echo "查看结果 $RESULT_ID 的样本:"
        curl -s -X GET "$BASE_URL/check-results/$RESULT_ID/samples?page=1&per_page=5" | python3 -m json.tool
        FIRST_SAMPLE=$(curl -s -X GET "$BASE_URL/check-results/$RESULT_ID/samples?page=1&per_page=1" | python3 -c "import sys,json; data=json.load(sys.stdin); samples=data['data']['samples']; print(samples[0]['id']) if samples else print('')")
    done
fi
echo ""
echo ""

echo "15. 人工确认误报 (第一个异常样本)"
if [ -n "$FIRST_SAMPLE" ]; then
    echo "确认样本 $FIRST_SAMPLE 为误报:"
    curl -s -X POST "$BASE_URL/anomaly-samples/$FIRST_SAMPLE/confirm" \
      -H "Content-Type: application/json" \
      -d '{
        "confirmation_status": "false_positive",
        "confirmed_by": "数据分析师",
        "note": "这是测试数据，属于误报"
      }' | python3 -m json.tool
fi
echo ""
echo ""

echo "16. 生成客户表质量日报"
curl -s -X POST "$BASE_URL/daily-reports/generate" \
  -H "Content-Type: application/json" \
  -d "{\"dataset_id\": $CUSTOMER_ID}" | python3 -m json.tool
echo ""
echo ""

echo "17. 生成订单表质量日报"
curl -s -X POST "$BASE_URL/daily-reports/generate" \
  -H "Content-Type: application/json" \
  -d "{\"dataset_id\": $ORDER_ID}" | python3 -m json.tool
echo ""
echo ""

echo "18. 查询订单表质量统计 (含质量分、失败规则、样本证据、趋势)"
curl -s -X GET "$BASE_URL/quality-stats?dataset_id=$ORDER_ID" | python3 -m json.tool
echo ""
echo ""

echo "19. 查看所有日报列表"
REPORTS=$(curl -s -X GET "$BASE_URL/daily-reports")
echo "$REPORTS" | python3 -m json.tool
echo ""
echo ""

REPORT_ID=$(echo "$REPORTS" | python3 -c "import sys,json; data=json.load(sys.stdin); reports=data['data']['reports']; print(reports[0]['id']) if reports else print('')")

echo "20. 导出日报 (json格式)"
if [ -n "$REPORT_ID" ]; then
    curl -s -X GET "$BASE_URL/daily-reports/$REPORT_ID/export" | python3 -m json.tool
fi
echo ""
echo ""

echo "21. 重复提交相同任务演示 (应该返回已有任务)"
echo "再次提交客户表检查任务:"
curl -s -X POST "$BASE_URL/check-tasks" \
  -H "Content-Type: application/json" \
  -d "{\"dataset_id\": $CUSTOMER_ID}" | python3 -m json.tool
echo ""
echo ""

echo "22. 查看所有任务列表"
curl -s -X GET "$BASE_URL/check-tasks?dataset_id=$CUSTOMER_ID" | python3 -m json.tool
echo ""
echo ""

echo "=== 示例执行完成 ==="
