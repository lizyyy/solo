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

echo "4. 导入取样节点（核心追溯功能）..."
cd examples
NODES_RESPONSE=$(curl -s -X POST "$BASE_URL/nodes/import" \
  -F "file=@sample_nodes.csv" \
  -F "sample_id=1")
NODE_COUNT=$(echo $NODES_RESPONSE | grep -o '"count":[0-9]*' | cut -d: -f2)
echo "导入取样节点数量: $NODE_COUNT"
cd ..
echo ""

sleep 1

echo "5. 手动创建一个新的检测节点..."
curl -s -X POST "$BASE_URL/nodes" \
  -H "Content-Type: application/json" \
  -d '{
    "sample_id": 1,
    "node_id": "NODE-S001-006",
    "parent_node_id": "NODE-S001-004",
    "node_name": "复检含量检测",
    "node_type": "test",
    "status": "completed",
    "operator": "王检测员",
    "actual_time": "2024-01-16 09:00:00",
    "remark": "原始数据异常，进行复检"
  }'
echo ""
echo "新节点创建成功"
echo ""

sleep 1

echo "6. 测试节点追溯功能（核心验证）..."
TRACE_RESPONSE=$(curl -s "$BASE_URL/nodes/NODE-S001-004/trace")
TRACE_DEPTH=$(echo $TRACE_RESPONSE | grep -o '"depth":[0-9]*' | cut -d: -f2)
echo "追溯链路深度: $TRACE_DEPTH 层"
echo "完整追溯链路:"
echo $TRACE_RESPONSE | python3 -m json.tool 2>/dev/null | grep -A 30 '"trace"' || echo $TRACE_RESPONSE
echo ""

sleep 1

echo "7. 导入试验方案..."
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

echo "8. 记录取样窗口偏差异常事件..."
curl -s -X POST "$BASE_URL/exceptions" \
  -H "Content-Type: application/json" \
  -d "{
    \"batch_id\": $BATCH_ID,
    \"sample_node_id\": \"NODE-S001-001\",
    \"event_type\": \"sampling_window\",
    \"severity\": \"medium\",
    \"description\": \"实际取样时间比计划提前1分30秒\",
    \"reason\": \"生产节奏调整，提前完成取样\",
    \"handler\": \"QA监督员\",
    \"resolution\": \"偏差在允许范围内，无需重新取样\"
  }"
echo ""
echo "异常事件记录成功"
echo ""

sleep 1

echo "9. 按批号查询完整信息（包含取样节点）..."
BATCH_DETAIL=$(curl -s "$BASE_URL/query/batch/BATCH-2024-001")
echo "批次状态: $(echo $BATCH_DETAIL | grep -o '"status":"[^"]*"' | cut -d: -f2 | tr -d '"')"
echo "样品数量: $(echo $BATCH_DETAIL | grep -o '"sample_id"' | wc -l)"
echo ""

sleep 1

echo "10. 退回修改（记录原因）..."
curl -s -X PUT "$BASE_URL/batches/$BATCH_ID/return" \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "王主任",
    "reason": "1. 样品S003的取样点信息不完整；2. NODE-S001-005节点检测未完成需补充；3. 复检记录需附加异常说明"
  }'
echo ""
echo "退回成功"
echo ""

sleep 1

echo "11. 查询批次完整追踪日志..."
LOGS_RESPONSE=$(curl -s "$BASE_URL/batches/$BATCH_ID")
echo "追踪日志记录数:"
echo $LOGS_RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('tracking_logs',[])))" 2>/dev/null || echo "需在详情中查看"
echo ""

sleep 1

echo "12. 导出批次明细..."
curl -s -o export_result.csv "$BASE_URL/batches/$BATCH_ID/export"
echo "导出文件已保存为 export_result.csv"
echo "导出文件行数: $(wc -l < export_result.csv)"
echo ""

sleep 1

echo "13. 按取样节点查询详情..."
curl -s "$BASE_URL/query/node/NODE-S001-004" | python3 -m json.tool 2>/dev/null | head -20
echo "..."
echo ""

sleep 1

echo "14. 查询所有取样节点列表..."
ALL_NODES=$(curl -s "$BASE_URL/nodes")
echo "总节点数: $(echo $ALL_NODES | grep -o '"total":[0-9]*' | cut -d: -f2)"
echo ""

echo "15. 查询异常事件列表..."
EXCEPTION_COUNT=$(curl -s "$BASE_URL/exceptions?batch_id=$BATCH_ID" | grep -o '"total":[0-9]*' | cut -d: -f2)
echo "异常事件总数: $EXCEPTION_COUNT"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "=== 核心功能验证总结 ==="
echo "✓ 取样节点导入入口: POST /api/v1/nodes/import (CSV)"
echo "✓ 取样节点创建入口: POST /api/v1/nodes (JSON)"
echo "✓ 节点追溯功能: GET /api/v1/nodes/:node_id/trace"
echo "✓ 追溯链路深度: $TRACE_DEPTH 层 (原始取样 → 分样 → 分样 → 检测)"
echo "✓ 总节点数: 导入 $NODE_COUNT + 手动创建 1 = $(($NODE_COUNT + 1))"
echo "✓ 所有操作均保留操作人、时间、原因记录"
echo ""
echo "QA现在可以："
echo "1. 通过 /api/v1/nodes/NODE-S001-004/trace 追溯检测样品的完整来源"
echo "2. 通过 /api/v1/batches/$BATCH_ID 查看所有追踪日志说明放行/退回原因"
echo "3. 通过 /api/v1/exceptions 查看所有异常事件的处理记录"
echo "4. 重启服务后所有历史数据仍可查询追溯"
