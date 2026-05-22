#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 二手车整备重试补偿队列 API 测试脚本 ==="
echo ""

echo "1. 健康检查"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "2. 提交回执 - 正常链路"
echo "提交检测单回执..."
RESP=$(curl -s -X POST "$BASE_URL/receipts" \
  -H "Content-Type: application/json" \
  -d '{
    "car_vin": "LSVNV2182E2100001",
    "car_plate": "京A12345",
    "source": "inspection",
    "source_file": "inspection_202401.xlsx",
    "source_line": 5,
    "raw_data": "{\"item\":\"刹车片磨损\",\"cost\":1500}",
    "standard_data": "{\"category\":\"刹车系统\",\"amount\":1500,\"description\":\"刹车片更换\"}",
    "amount": 1500.00,
    "responsible_person": "张工",
    "operator": "admin"
  }')
echo "$RESP" | python3 -m json.tool
RECEIPT_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
RECEIPT_NO=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('receipt_no',''))")
echo ""

echo "3. 查询回执详情（含状态历史和重试任务）"
curl -s "$BASE_URL/receipts/$RECEIPT_ID" | python3 -m json.tool
echo ""

echo "4. 按回执号查询"
curl -s "$BASE_URL/receipts/no/$RECEIPT_NO" | python3 -m json.tool
echo ""

echo "5. 回执列表"
curl -s "$BASE_URL/receipts?page=1&page_size=10" | python3 -m json.tool
echo ""

echo "6. 手动触发处理"
curl -s -X POST "$BASE_URL/queue/trigger?operator=test" | python3 -m json.tool
echo ""

sleep 2

echo "7. 查看回执当前状态"
curl -s "$BASE_URL/receipts/$RECEIPT_ID" | python3 -m json.tool
echo ""

echo "8. 查看原始证据链"
curl -s "$BASE_URL/receipts/$RECEIPT_ID/evidence" | python3 -m json.tool
echo ""

echo "9. 查看重试分类统计"
curl -s "$BASE_URL/stats/retry-categories" | python3 -m json.tool
echo ""

echo "10. 查看死信统计"
curl -s "$BASE_URL/stats/dead-letters" | python3 -m json.tool
echo ""

echo "=== 测试异常场景 ==="
echo ""

echo "11. 重复提交同一辆车的回执（模拟多次返厂）"
curl -s -X POST "$BASE_URL/receipts" \
  -H "Content-Type: application/json" \
  -d '{
    "car_vin": "LSVNV2182E2100001",
    "car_plate": "京A12345",
    "source": "repair_quote",
    "source_file": "repair_quote_202402.xlsx",
    "source_line": 12,
    "raw_data": "{\"item\":\"变速箱维修\",\"cost\":5800}",
    "standard_data": "{\"category\":\"变速箱\",\"amount\":5800}",
    "amount": 5800.00,
    "responsible_person": "李工",
    "operator": "admin"
  }' | python3 -m json.tool
echo ""

echo "12. 提交坏数据（缺少必填字段）"
curl -s -X POST "$BASE_URL/receipts" \
  -H "Content-Type: application/json" \
  -d '{
    "car_plate": "京B67890",
    "source": "inspection",
    "amount": 1000.00
  }' | python3 -m json.tool
echo ""

echo "=== 人工处理流程 ==="
echo ""

echo "13. 模拟等待人工处理的回执"
RESP2=$(curl -s -X POST "$BASE_URL/receipts" \
  -H "Content-Type: application/json" \
  -d '{
    "car_vin": "LSVNV2182E2100999",
    "car_plate": "京X99999",
    "source": "supplier_statement",
    "source_file": "supplier_202401.csv",
    "source_line": 88,
    "raw_data": "invalid,data,format",
    "standard_data": "",
    "amount": 2500.00,
    "responsible_person": "王工",
    "operator": "admin"
  }')
echo "$RESP2" | python3 -m json.tool
RECEIPT_ID2=$(echo "$RESP2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
echo ""

echo "14. 人工处理（成功）"
curl -s -X POST "$BASE_URL/receipts/$RECEIPT_ID2/manual" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "manager",
    "result": "success",
    "reason": "数据格式已修复，核对原始凭证无误",
    "additional_info": "凭证号: P202401001"
  }' | python3 -m json.tool
echo ""

echo "15. 补偿入账"
curl -s -X POST "$BASE_URL/receipts/$RECEIPT_ID/compensate" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "finance",
    "amount": 1500.00,
    "reason": "多次返厂补偿",
    "account_no": "ACC-2024-001",
    "voucher_no": "V-202401001"
  }' | python3 -m json.tool
echo ""

echo "16. 关闭回执"
curl -s -X POST "$BASE_URL/receipts/$RECEIPT_ID/close" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "manager",
    "reason": "案件处理完毕，无争议"
  }' | python3 -m json.tool
echo ""

echo "=== 查看最终统计 ==="
echo ""

echo "17. 重试分类统计"
curl -s "$BASE_URL/stats/retry-categories" | python3 -m json.tool
echo ""

echo "18. 查看同一辆车的所有回执"
curl -s "$BASE_URL/receipts?car_vin=LSVNV2182E2100001" | python3 -m json.tool
echo ""

echo "=== 测试完成 ==="
echo "提示: 重启服务后调用 /api/v1/queue/recover 可恢复未完成任务"
