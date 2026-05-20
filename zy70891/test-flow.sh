#!/bin/bash

echo "=== 社区矫正签到预警系统完整流程测试 ==="
echo ""

echo "1. 提交第一批材料..."
RESULT=$(curl -s -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "李社工",
    "records": [
      {
        "object_id": "PER001",
        "object_name": "赵六",
        "checkin_date": "2024-01-16",
        "risk_level": "低风险",
        "has_checkin": true,
        "checkin_source": "APP签到",
        "has_leave": false,
        "location_gap_hours": 1,
        "location_abnormal": false
      },
      {
        "object_id": "PER002",
        "object_name": "钱七",
        "checkin_date": "2024-01-16",
        "risk_level": "高风险",
        "has_checkin": false,
        "has_leave": false,
        "location_gap_hours": 6,
        "location_abnormal": true
      }
    ]
  }')

BATCH_ID=$(echo $RESULT | grep -o '"batchId":"[^"]*"' | cut -d'"' -f4)
echo "批次ID: $BATCH_ID"
echo ""

sleep 1

echo "2. 获取批次统计信息..."
curl "http://localhost:3001/api/batches/$BATCH_ID/stats"
echo ""
echo ""

sleep 1

echo "3. 获取每日汇总详情..."
curl "http://localhost:3001/api/batches/$BATCH_ID/summaries"
echo ""
echo ""

sleep 1

echo "4. 导出CSV报告..."
curl -s -o "report_${BATCH_ID}.csv" "http://localhost:3001/api/batches/$BATCH_ID/export"
echo "报告已导出: report_${BATCH_ID}.csv"
echo ""

sleep 1

echo "5. 测试重复提交检测..."
curl -s -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "李社工",
    "records": [
      {
        "object_id": "PER001",
        "object_name": "赵六",
        "checkin_date": "2024-01-16",
        "risk_level": "低风险",
        "has_checkin": true
      },
      {
        "object_id": "PER002",
        "object_name": "钱七",
        "checkin_date": "2024-01-16",
        "risk_level": "高风险",
        "has_checkin": false
      }
    ]
  }' | grep -E '"warning"|"message"'
echo ""

echo "=== 测试流程完成 ==="
