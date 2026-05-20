#!/bin/bash

echo "=== 景区缆车检修放行API - 完整流程测试 ==="

echo ""
echo "1. 提交检修批次..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "cableCarId": "LC001",
    "cableCarName": "1号缆车线",
    "inspectionDate": "2026-05-20",
    "inspectionItems": [
      {"itemName": "钢丝绳磨损检查", "itemResult": "pass", "remark": "正常", "inspector": "李工"},
      {"itemName": "制动系统测试", "itemResult": "pass", "remark": "正常", "inspector": "李工"},
      {"itemName": "安全门联锁", "itemResult": "pass", "remark": "正常", "inspector": "王工"}
    ]
  }')

echo "$RESPONSE"
BATCH_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | cut -d: -f2)
echo "批次ID: $BATCH_ID"

echo ""
echo "2. 验证重复提交检测..."
DUP_RESPONSE=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "cableCarId": "LC001",
    "cableCarName": "1号缆车线",
    "inspectionDate": "2026-05-20",
    "inspectionItems": [
      {"itemName": "钢丝绳磨损检查", "itemResult": "pass", "remark": "正常", "inspector": "李工"},
      {"itemName": "制动系统测试", "itemResult": "pass", "remark": "正常", "inspector": "李工"},
      {"itemName": "安全门联锁", "itemResult": "pass", "remark": "正常", "inspector": "王工"}
    ]
  }')

echo "$DUP_RESPONSE"
if echo "$DUP_RESPONSE" | grep -q '"isDuplicate":true'; then
  echo "✓ 重复检测生效 - 相同材料不会重复创建"
fi

echo ""
echo "3. 查看统计数据..."
curl -s http://localhost:3000/api/batches/statistics

echo ""
echo "4. 提交试运行记录..."
curl -s -X POST http://localhost:3000/api/batches/$BATCH_ID/trial-run \
  -H "Content-Type: application/json" \
  -d '{
    "runDuration": 30,
    "passengerCount": 50,
    "abnormalConditions": "无异常",
    "result": "pass",
    "operator": "赵操作员"
  }'

echo ""
echo "5. 提交放行审批..."
curl -s -X POST http://localhost:3000/api/batches/$BATCH_ID/approval \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "final",
    "approver": "陈主任",
    "approvalResult": "pass",
    "comment": "各项检查合格，同意放行"
  }'

echo ""
echo "6. 查看批次详情..."
curl -s http://localhost:3000/api/batches/$BATCH_ID

echo ""
echo "7. 导出CSV报告..."
curl -s -o inspection_report.csv http://localhost:3000/api/batches/$BATCH_ID/export
echo "✓ 报告已保存到 inspection_report.csv"
echo ""
cat inspection_report.csv

echo ""
echo "=== 测试完成 ==="
