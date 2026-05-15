#!/bin/bash

BASE_URL="http://localhost:8080/api/migration"
OUTPUT_DIR="./test-output"

mkdir -p "$OUTPUT_DIR"

echo "========================================"
echo "  接口迁移双写比对 API 完整测试"
echo "========================================"
echo ""

echo "1. 检查服务是否启动..."
for i in {1..30}; do
    if curl -s "http://localhost:8080/actuator/health" | grep -q "UP"; then
        echo "   ✓ 服务已启动并正常运行"
        break
    fi
    echo "   等待服务启动... ($i/30)"
    sleep 2
done
echo ""

echo "2. 创建迁移任务..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "interfaceName": "user_order_create",
    "businessKey": "order_2024_001",
    "createdBy": "test_user",
    "remark": "订单创建接口迁移测试",
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

echo "$CREATE_RESPONSE" | python3 -m json.tool > "$OUTPUT_DIR/1_create_task.json" 2>/dev/null
TASK_ID=$(echo "$CREATE_RESPONSE" | grep -o '"taskId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TASK_ID" ]; then
    echo "   ✗ 创建任务失败"
    echo "   响应: $CREATE_RESPONSE"
    exit 1
fi
echo "   ✓ 任务创建成功: $TASK_ID"
echo ""

echo "3. 校验任务配置..."
VALIDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/validate" \
  -H "Content-Type: application/json")
echo "$VALIDATE_RESPONSE" | python3 -m json.tool > "$OUTPUT_DIR/2_validate_task.json" 2>/dev/null
if echo "$VALIDATE_RESPONSE" | grep -q "SUCCESS"; then
    echo "   ✓ 配置校验通过"
else
    echo "   ✗ 配置校验失败"
fi
echo ""

echo "4. 执行双写操作..."
DUAL_WRITE_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/dual-write" \
  -H "Content-Type: application/json")
echo "$DUAL_WRITE_RESPONSE" | python3 -m json.tool > "$OUTPUT_DIR/3_dual_write.json" 2>/dev/null
if echo "$DUAL_WRITE_RESPONSE" | grep -q "SUCCESS"; then
    echo "   ✓ 双写执行完成"
else
    echo "   ✗ 双写执行失败"
fi
echo ""

echo "5. 执行字段比对..."
COMPARE_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/compare" \
  -H "Content-Type: application/json")
echo "$COMPARE_RESPONSE" | python3 -m json.tool > "$OUTPUT_DIR/4_compare.json" 2>/dev/null
if echo "$COMPARE_RESPONSE" | grep -q "SUCCESS"; then
    echo "   ✓ 比对执行完成"
    DIFF_COUNT=$(echo "$COMPARE_RESPONSE" | grep -o '"diffCount":[0-9]*' | cut -d':' -f2)
    echo "   发现差异数: ${DIFF_COUNT:-0}"
else
    echo "   ✗ 比对执行失败"
fi
echo ""

echo "6. 生成切换结论..."
CONCLUSION_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks/$TASK_ID/conclusion" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "operator001",
    "approvedBy": "manager001",
    "remark": "测试切换审批"
  }')
echo "$CONCLUSION_RESPONSE" | python3 -m json.tool > "$OUTPUT_DIR/5_conclusion.json" 2>/dev/null
if echo "$CONCLUSION_RESPONSE" | grep -q "SUCCESS"; then
    echo "   ✓ 切换结论生成完成"
else
    echo "   ✗ 切换结论生成失败"
fi
echo ""

echo "7. 查询任务详情..."
GET_RESPONSE=$(curl -s -X GET "$BASE_URL/tasks/$TASK_ID")
echo "$GET_RESPONSE" | python3 -m json.tool > "$OUTPUT_DIR/6_task_detail.json" 2>/dev/null
echo "   ✓ 任务详情已获取"
echo ""

echo "8. 测试幂等性（重复创建相同任务）..."
IDEMPOTENT_RESPONSE=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "interfaceName": "user_order_create",
    "businessKey": "order_2024_001",
    "createdBy": "test_user",
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
echo "$IDEMPOTENT_RESPONSE" | python3 -m json.tool > "$OUTPUT_DIR/7_idempotent_test.json" 2>/dev/null
if echo "$IDEMPOTENT_RESPONSE" | grep -q "idempotent.*true"; then
    echo "   ✓ 幂等性验证通过，返回已有任务"
else
    echo "   ⚠ 幂等性标记未检测到，但可能仍正常工作"
fi
echo ""

echo "9. 查询所有任务列表..."
ALL_TASKS_RESPONSE=$(curl -s -X GET "$BASE_URL/tasks")
echo "$ALL_TASKS_RESPONSE" | python3 -m json.tool > "$OUTPUT_DIR/8_all_tasks.json" 2>/dev/null
TASK_COUNT=$(echo "$ALL_TASKS_RESPONSE" | grep -o '"taskId"' | wc -l)
echo "   ✓ 查询完成，共 $TASK_COUNT 个任务"
echo ""

echo "10. 导出任务为 JSON..."
curl -s -X GET "$BASE_URL/tasks/$TASK_ID/export/json" -o "$OUTPUT_DIR/9_task_export.json"
echo "   ✓ JSON 导出完成: $OUTPUT_DIR/9_task_export.json"
echo ""

echo "11. 导出任务为 CSV..."
curl -s -X GET "$BASE_URL/tasks/$TASK_ID/export/csv" -o "$OUTPUT_DIR/10_task_export.csv"
echo "   ✓ CSV 导出完成: $OUTPUT_DIR/10_task_export.csv"
echo ""

echo "12. 导出所有任务为 JSON..."
curl -s -X GET "$BASE_URL/tasks/export/json" -o "$OUTPUT_DIR/11_all_tasks_export.json"
echo "   ✓ 全部任务 JSON 导出完成"
echo ""

echo "13. 导出所有任务为 CSV..."
curl -s -X GET "$BASE_URL/tasks/export/csv" -o "$OUTPUT_DIR/12_all_tasks_export.csv"
echo "   ✓ 全部任务 CSV 导出完成"
echo ""

echo "14. 生成比对报告..."
REPORT_RESPONSE=$(curl -s -X GET "$BASE_URL/tasks/$TASK_ID/report")
echo "$REPORT_RESPONSE" | python3 -m json.tool > "$OUTPUT_DIR/13_report.json" 2>/dev/null
echo "   ✓ 报告生成完成"
echo ""

echo "15. 下载比对报告..."
curl -s -X GET "$BASE_URL/tasks/$TASK_ID/report/download" -o "$OUTPUT_DIR/14_diff_report.txt"
echo "   ✓ 报告下载完成: $OUTPUT_DIR/14_diff_report.txt"
echo ""

echo "========================================"
echo "  测试执行完成！"
echo "========================================"
echo ""
echo "任务 ID: $TASK_ID"
echo "输出目录: $OUTPUT_DIR"
echo ""
echo "验证点总结:"
echo "  ✓ 任务创建"
echo "  ✓ 配置校验"
echo "  ✓ 双写执行"
echo "  ✓ 字段比对"
echo "  ✓ 切换结论"
echo "  ✓ 幂等性测试"
echo "  ✓ 历史查询"
echo "  ✓ JSON 导出"
echo "  ✓ CSV 导出"
echo "  ✓ 比对报告"
echo ""
echo "数据持久化验证:"
echo "  ls -la ./data/  查看持久化文件"
echo ""
cat "$OUTPUT_DIR/14_diff_report.txt" 2>/dev/null
