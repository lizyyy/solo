#!/bin/bash

BASE_URL="http://localhost:8080/api/migration"

echo "=== 接口迁移双写比对 API 测试脚本 ==="
echo ""

# 1. 创建任务
echo "1. 创建迁移任务..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "interfaceName": "user_order_create",
    "businessKey": "order_001",
    "createdBy": "developer",
    "remark": "用户订单创建接口迁移测试",
    "oldDataSource": {
      "type": "mysql",
      "tableName": "t_order_old"
    },
    "newDataSource": {
      "type": "mysql",
      "tableName": "t_order_new"
    },
    "fields": [
      {
        "fieldName": "order_id",
        "fieldType": "String",
        "primaryKey": true,
        "compareEnable": true
      },
      {
        "fieldName": "user_id",
        "fieldType": "String",
        "compareEnable": true
      },
      {
        "fieldName": "amount",
        "fieldType": "BigDecimal",
        "compareEnable": true,
        "precisionThreshold": 0.01
      },
      {
        "fieldName": "status",
        "fieldType": "Integer",
        "compareEnable": true
      },
      {
        "fieldName": "create_time",
        "fieldType": "Date",
        "compareEnable": true
      }
    ],
    "writeData": {
      "order_id": "ORD202401010001",
      "user_id": "USER001",
      "amount": 99.99,
      "status": 1,
      "create_time": "2024-01-01 10:00:00"
    }
  }')

echo "$CREATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

TASK_ID=$(echo "$CREATE_RESPONSE" | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TASK_ID" ]; then
  echo "获取任务ID失败，退出测试"
  exit 1
fi

echo "任务ID: $TASK_ID"
echo ""

# 2. 校验任务
echo "2. 校验任务配置..."
VALIDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/validate" \
  -H "Content-Type: application/json")
echo "$VALIDATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VALIDATE_RESPONSE"
echo ""

# 3. 执行双写
echo "3. 执行双写操作..."
DUAL_WRITE_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/dual-write" \
  -H "Content-Type: application/json")
echo "$DUAL_WRITE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DUAL_WRITE_RESPONSE"
echo ""

# 4. 执行比对
echo "4. 执行字段比对..."
COMPARE_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/compare" \
  -H "Content-Type: application/json")
echo "$COMPARE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$COMPARE_RESPONSE"
echo ""

# 5. 生成切换结论
echo "5. 生成切换结论..."
CONCLUSION_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/conclusion" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "operator001",
    "approvedBy": "manager001",
    "remark": "测试切换"
  }')
echo "$CONCLUSION_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CONCLUSION_RESPONSE"
echo ""

# 6. 执行切换
echo "6. 执行切换操作..."
SWITCH_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/switch" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "operator001",
    "approvedBy": "manager001",
    "remark": "执行正式切换"
  }')
echo "$SWITCH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SWITCH_RESPONSE"
echo ""

# 7. 执行回滚
echo "7. 执行回滚操作..."
ROLLBACK_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "operator001",
    "remark": "发现问题，回滚到旧库"
  }')
echo "$ROLLBACK_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ROLLBACK_RESPONSE"
echo ""

# 8. 查询任务详情
echo "8. 查询任务最终详情..."
GET_RESPONSE=$(curl -s -X GET "$BASE_URL/tasks/$TASK_ID")
echo "$GET_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$GET_RESPONSE"
echo ""

# 9. 测试幂等性
echo "9. 测试幂等性（重复创建相同任务）..."
IDEMPOTENT_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "interfaceName": "user_order_create",
    "businessKey": "order_001",
    "createdBy": "developer",
    "oldDataSource": {
      "type": "mysql",
      "tableName": "t_order_old"
    },
    "newDataSource": {
      "type": "mysql",
      "tableName": "t_order_new"
    },
    "fields": [
      {
        "fieldName": "order_id",
        "primaryKey": true,
        "compareEnable": true
      }
    ],
    "writeData": {
      "order_id": "ORD202401010001"
    }
  }')
echo "$IDEMPOTENT_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$IDEMPOTENT_RESPONSE"
echo ""

# 10. 查询所有任务
echo "10. 查询所有任务列表..."
ALL_TASKS_RESPONSE=$(curl -s -X GET "$BASE_URL/tasks")
echo "$ALL_TASKS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ALL_TASKS_RESPONSE"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "任务最终状态查看: curl $BASE_URL/tasks/$TASK_ID"
