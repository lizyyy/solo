#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 城市除雪盐库 API 修复验证测试 ==="
echo ""

echo "=== 测试1: 同车重复领盐拦截 ==="
echo "创建包含重复车辆的批次..."
curl -s -X POST "$BASE_URL/dispatch/batches" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{
    "batch_no": "BATCH-TEST-DUP-001",
    "weather_level_id": 2,
    "created_by": "调度员测试",
    "items": [
      {"salt_depot_id": 1, "vehicle_id": 1, "road_section_id": 1, "salt_amount": 5},
      {"salt_depot_id": 1, "vehicle_id": 1, "road_section_id": 2, "salt_amount": 3}
    ]
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'消息: {d[\"message\"]}'); print(f'是否检测到异常: {\"检测到\" in d[\"message\"]}')" 2>/dev/null || cat
echo ""

echo "=== 测试2: 尝试直接更新到completed状态（应该失败） ==="
echo "首先创建一个正常批次..."
curl -s -X POST "$BASE_URL/dispatch/batches" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{
    "batch_no": "BATCH-TEST-FSM-001",
    "weather_level_id": 2,
    "created_by": "调度员测试",
    "items": [
      {"salt_depot_id": 1, "vehicle_id": 2, "road_section_id": 2, "salt_amount": 5}
    ]
  }' > /dev/null 2>&1

ITEM_ID=2
echo "尝试把任务 $ITEM_ID 直接更新为 completed..."
curl -s -X POST "$BASE_URL/dispatch/items/$ITEM_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{"status": "completed", "location": "测试", "remark": "绕过签收测试"}'
echo ""
echo ""

echo "=== 测试3: 验证状态流转 pending → enroute（应该失败，需先发车） ==="
curl -s -X POST "$BASE_URL/dispatch/items/$ITEM_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{"status": "enroute", "location": "途中", "remark": "测试"}'
echo ""
echo ""

echo "=== 测试4: 正常状态流转测试 ==="
echo "步骤1: 发车 (pending → dispatched)"
curl -s -X POST "$BASE_URL/dispatch/items/$ITEM_ID/start" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试"
echo ""
echo "步骤2: 更新为途中 (dispatched → enroute)"
curl -s -X POST "$BASE_URL/dispatch/items/$ITEM_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{"status": "enroute", "location": "长江路中段", "remark": "正常行驶"}'
echo ""
echo "步骤3: 更新为到达 (enroute → arrived)"
curl -s -X POST "$BASE_URL/dispatch/items/$ITEM_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{"status": "arrived", "location": "长江路作业点", "remark": "已到达"}'
echo ""
echo "步骤4: 更新为作业中 (arrived → delivering)"
curl -s -X POST "$BASE_URL/dispatch/items/$ITEM_ID/status" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{"status": "delivering", "location": "作业现场", "remark": "开始撒盐作业"}'
echo ""
echo "步骤5: 签收 (delivering → completed - 唯一合法路径)"
curl -s -X POST "$BASE_URL/dispatch/items/$ITEM_ID/receipt" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{"received_amount": 5, "receiver_name": "路段班长", "receiver_sign": "张三", "remark": "数量正确"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'回执号: {d[\"receipt_no\"]}'); print(f'签收人: {d[\"receiver_name\"]}')" 2>/dev/null || cat
echo ""

echo "=== 测试5: 验证签收后车辆状态变为idle ==="
curl -s "$BASE_URL/vehicles" | python3 -c "import sys,json; d=json.load(sys.stdin); v=[x for x in d if x['id']==2][0]; print(f'车辆 京A23456 状态: {v[\"status\"]}')"
echo ""

echo "=== 测试6: 验证取消任务功能 ==="
echo "创建新批次用于取消测试..."
curl -s -X POST "$BASE_URL/dispatch/batches" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{
    "batch_no": "BATCH-TEST-CANCEL-001",
    "weather_level_id": 2,
    "created_by": "调度员测试",
    "items": [
      {"salt_depot_id": 2, "vehicle_id": 3, "road_section_id": 3, "salt_amount": 8}
    ]
  }' > /dev/null 2>&1

CANCEL_ITEM_ID=3
echo "取消任务 $CANCEL_ITEM_ID ..."
curl -s -X POST "$BASE_URL/dispatch/items/$CANCEL_ITEM_ID/cancel" \
  -H "Content-Type: application/json" \
  -H "X-Operator: 调度员测试" \
  -d '{"reason": "临时调整路线"}'
echo ""
echo "验证任务状态为cancelled:"
curl -s "$BASE_URL/dispatch/items/$CANCEL_ITEM_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'任务状态: {d[\"status\"]}')" 2>/dev/null || cat
echo ""

echo "=== 测试7: 验证统计数据一致性 ==="
curl -s "$BASE_URL/stats" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "=== 修复验证完成 ==="
