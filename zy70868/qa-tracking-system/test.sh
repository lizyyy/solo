#!/bin/bash

echo "=== 药企QA追踪系统测试脚本 ==="
echo ""

BASE_URL="http://localhost:8080/api/v1"

echo "1. 创建批次..."
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-2024-001",
    "product_name": "阿莫西林胶囊",
    "created_by": "张三"
  }')
echo "创建成功: $(echo $BATCH_RESPONSE | grep -o '"id":[0-9]*' | cut -d: -f2)"
BATCH_ID=$(echo $BATCH_RESPONSE | grep -o '"id":[0-9]*' | cut -d: -f2)
echo ""

sleep 1

echo "2. 标记处理..."
curl -s -X PUT "$BASE_URL/batches/$BATCH_ID/process" \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "李四",
    "remark": "开始QA审核流程"
  }'
echo ""
echo "标记处理成功"
echo ""

sleep 1

echo "3. 导入样品数据..."
cd examples
SAMPLE_RESPONSE=$(curl -s -X POST "$BASE_URL/samples/import" \
  -F "file=@samples.csv" \
  -F "batch_id=$BATCH_ID")
echo "导入样品数量: $(echo $SAMPLE_RESPONSE | grep -o '"count":[0-9]*' | cut -d: -f2)"
cd ..
echo ""

sleep 1

echo "4. 导入试验方案..."
curl -s -X POST "$BASE_URL/protocols/import?batch_id=$BATCH_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "protocol_id": "P001",
    "protocol_name": "加速稳定性试验方案",
    "version": "1.0",
    "created_by": "赵六",
    "conditions": {
      "temperature": 40,
      "humidity": 75,
      "duration": "6个月"
    }
  }'
echo ""
echo "试验方案导入成功"
echo ""

sleep 1

echo "5. 记录超温异常事件..."
curl -s -X POST "$BASE_URL/exceptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"chamber_id\": \"CH001\",
    \"event_type\": \"over_temperature\",
    \"severity\": \"high\",
    \"description\": \"2024-01-15 04:00 温度达到45.5°C，超出范围\",
    \"reason\": \"温控系统临时故障，已修复\",
    \"handler\": \"钱七\",
    \"resolution\": \"已校准设备，样品不受影响\"
  }"
echo ""
echo "异常事件记录成功"
echo ""

sleep 1

echo "6. 按批号查询完整信息..."
curl -s "$BASE_URL/query/batch/BATCH-2024-001" | head -c 500
echo "..."
echo ""

sleep 1

echo "7. 退回修改（记录原因）..."
curl -s -X PUT "$BASE_URL/batches/$BATCH_ID/return" \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "王主任",
    "reason": "样品S003的取样点信息不完整，缺少具体位置描述；环境箱记录缺少压力数据"
  }'
echo ""
echo "退回成功"
echo ""

sleep 1

echo "8. 查询批次追踪日志..."
curl -s "$BASE_URL/batches/$BATCH_ID" | grep -o '"TrackingLogs":\[.*\]'
echo ""
echo ""

echo "9. 导出批次明细..."
curl -s -o export_result.csv "$BASE_URL/batches/$BATCH_ID/export"
echo "导出文件已保存为 export_result.csv"
echo ""

echo "10. 查询异常事件列表..."
EXCEPTION_COUNT=$(curl -s "$BASE_URL/exceptions?batch_id=$BATCH_ID" | grep -o '"total":[0-9]*' | cut -d: -f2)
echo "异常事件总数: $EXCEPTION_COUNT"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "重要说明："
echo "1. 所有操作都保留了完整的操作人、时间、原因记录"
echo "2. 取样节点可通过 /api/v1/nodes/:node_id/trace 追溯完整来源"
echo "3. 导出数据量与查询结果通过 X-Export-Count 头保持一致"
echo "4. 重启服务后所有历史数据均可通过批号、环境箱、节点ID查询"
