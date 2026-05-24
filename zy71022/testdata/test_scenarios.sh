#!/bin/bash

BASE_URL="http://localhost:8080/api"

echo "========================================"
echo "水表异常申诉 API 测试脚本"
echo "========================================"

echo ""
echo "场景 1: 正常申诉流程 (WM001 - 张三)"
echo "----------------------------------------"
echo "提交申诉..."
curl -s -X POST "$BASE_URL/appeals" \
  -H "Content-Type: application/json" \
  -d '{
    "meter_no": "WM001",
    "user_id": "U001",
    "appeal_type": "读数异常",
    "description": "用户反馈水费异常偏高，怀疑抄表有误",
    "appeal_date": "2024-04-15T00:00:00Z",
    "start_bill_cycle": "2024-01",
    "end_bill_cycle": "2024-03",
    "disputed_amount": 112.00,
    "original_balance": 500.00
  }' | python3 -m json.tool

echo ""
echo "获取申诉列表..."
curl -s "$BASE_URL/appeals" | python3 -m json.tool

echo ""
echo "场景 2: 读数倒挂+跨周期漏水 (WM002 - 李四)"
echo "----------------------------------------"
echo "提交申诉..."
APPEAL_NO_2=$(curl -s -X POST "$BASE_URL/appeals" \
  -H "Content-Type: application/json" \
  -d '{
    "meter_no": "WM002",
    "user_id": "U002",
    "appeal_type": "漏水申诉",
    "description": "用户发现地下水管漏水，申请减免",
    "appeal_date": "2024-04-10T00:00:00Z",
    "start_bill_cycle": "2024-01",
    "end_bill_cycle": "2024-03",
    "disputed_amount": 483.00,
    "original_balance": 800.00
  }' | python3 -c "import sys,json; print(json.load(sys.stdin).get('appeal_no',''))")

echo "申诉单号: $APPEAL_NO_2"

echo ""
echo "异常拆分..."
curl -s -X POST "$BASE_URL/appeals/$APPEAL_NO_2/split" | python3 -m json.tool

echo ""
echo "账单重算..."
curl -s "$BASE_URL/appeals/$APPEAL_NO_2/recalculate" | python3 -m json.tool

echo ""
echo "创建复核报告..."
REPORT_NO=$(curl -s -X POST "$BASE_URL/reviews" \
  -H "Content-Type: application/json" \
  -d "{
    \"appeal_no\": \"$APPEAL_NO_2\",
    \"reviewer_id\": \"R001\",
    \"reviewer_name\": \"审核员A\",
    \"is_reading_valid\": false,
    \"reading_anomaly\": \"2024-02存在读数倒挂，2024-03存在漏水记录\",
    \"leak_confirmed\": true,
    \"leak_days\": 34,
    \"leak_amount\": 51.0,
    \"review_conclusion\": \"情况属实，存在读数倒挂和漏水问题，应予减免\",
    \"review_suggestion\": \"建议核减漏水水量51吨，退还多收水费\"
  }" | python3 -c "import sys,json; print(json.load(sys.stdin).get('report_no',''))")

echo "报告编号: $REPORT_NO"

echo ""
echo "人工修正..."
curl -s -X POST "$BASE_URL/reviews/$REPORT_NO/manual-correct" \
  -H "Content-Type: application/json" \
  -d '{
    "adjusted_amount": 350.00,
    "reason": "考虑用户实际情况，给予特别减免10%"
  }' | python3 -m json.tool

echo ""
echo "复核定稿（通过）..."
curl -s -X POST "$BASE_URL/reviews/$REPORT_NO/finalize" \
  -H "Content-Type: application/json" \
  -d '{"is_approved": true}' | python3 -m json.tool

echo ""
echo "结案..."
curl -s -X POST "$BASE_URL/appeals/$APPEAL_NO_2/close" \
  -H "Content-Type: application/json" \
  -d '{"handler_id": "R001", "handler_name": "审核员A"}' | python3 -m json.tool

echo ""
echo "归档..."
curl -s -X POST "$BASE_URL/appeals/$APPEAL_NO_2/archive" | python3 -m json.tool

echo ""
echo "场景 3: 重复申诉拦截 (WM002 - 李四)"
echo "----------------------------------------"
echo "尝试提交同周期重复申诉..."
curl -s -X POST "$BASE_URL/appeals" \
  -H "Content-Type: application/json" \
  -d '{
    "meter_no": "WM002",
    "user_id": "U002",
    "appeal_type": "重复申诉",
    "description": "再次提交同周期申诉，应该被拦截",
    "appeal_date": "2024-04-12T00:00:00Z",
    "start_bill_cycle": "2024-02",
    "end_bill_cycle": "2024-03",
    "disputed_amount": 300.00,
    "original_balance": 800.00
  }' | python3 -m json.tool

echo ""
echo "检查重复申诉..."
curl -s "$BASE_URL/appeals/check/duplicate?meter_no=WM002&start_cycle=2024-02&end_cycle=2024-03" | python3 -m json.tool

echo ""
echo "场景 4: 撤回申诉 (WM003 - 王五)"
echo "----------------------------------------"
echo "提交申诉..."
APPEAL_NO_3=$(curl -s -X POST "$BASE_URL/appeals" \
  -H "Content-Type: application/json" \
  -d '{
    "meter_no": "WM003",
    "user_id": "U003",
    "appeal_type": "马桶漏水",
    "description": "用户反馈马桶漏水导致水费偏高",
    "appeal_date": "2024-04-08T00:00:00Z",
    "start_bill_cycle": "2024-01",
    "end_bill_cycle": "2024-02",
    "disputed_amount": 92.40,
    "original_balance": 300.00
  }' | python3 -c "import sys,json; print(json.load(sys.stdin).get('appeal_no',''))")

echo "申诉单号: $APPEAL_NO_3"

echo ""
echo "撤回申诉..."
curl -s -X POST "$BASE_URL/appeals/$APPEAL_NO_3/withdraw" \
  -H "Content-Type: application/json" \
  -d '{
    "handler_id": "U003",
    "handler_name": "王五",
    "reason": "用户自行解决，撤回申诉"
  }' | python3 -m json.tool

echo ""
echo "场景 5: 批次提交"
echo "----------------------------------------"
echo "批量提交多个申诉..."
curl -s -X POST "$BASE_URL/appeals/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "批量操作员",
    "appeals": [
      {
        "meter_no": "WM001",
        "user_id": "U001",
        "appeal_type": "批量申诉1",
        "description": "批次测试申诉1",
        "appeal_date": "2024-04-20T00:00:00Z",
        "start_bill_cycle": "2024-03",
        "end_bill_cycle": "2024-04",
        "disputed_amount": 50.00,
        "original_balance": 200.00
      },
      {
        "meter_no": "WM002",
        "user_id": "U002",
        "appeal_type": "批量申诉2",
        "description": "批次测试申诉2（同周期重复测试）",
        "appeal_date": "2024-04-20T00:00:00Z",
        "start_bill_cycle": "2024-02",
        "end_bill_cycle": "2024-03",
        "disputed_amount": 100.00,
        "original_balance": 400.00
      }
    ]
  }' | python3 -m json.tool

echo ""
echo "场景 6: 结果导出"
echo "----------------------------------------"
echo "导出所有申诉..."
curl -s -X POST "$BASE_URL/export/appeals" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "export_type": "json"
  }' | python3 -m json.tool

echo ""
echo "========================================"
echo "测试完成！"
echo "========================================"
