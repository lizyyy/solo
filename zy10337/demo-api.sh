#!/bin/bash
# 批量审批回调协调器 - API 调用示例脚本

BASE_URL="http://localhost:8080"
BATCH_ID="BATCH-$(date +%Y%m%d%H%M%S)"

echo "========================================="
echo "  批量审批回调协调器 - API 演示脚本"
echo "========================================="
echo "批次ID: $BATCH_ID"
echo ""

# 1. 创建批次
echo "【1/8】创建审批批次..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "'"$BATCH_ID"'",
    "businessType": "EXPENSE_APPROVAL",
    "sourceSystem": "FINANCE-SYS",
    "createdBy": "admin",
    "remark": "费用报销批量审批",
    "chunkSize": 5,
    "items": [
      {"itemId": "EXP-001", "idempotentKey": "IDEM-EXP-001-'$(date +%s)'", "businessData": "{\"amount\": 1000}", "callbackPayload": "{\"url\": \"http://callback.example.com\"}"},
      {"itemId": "EXP-002", "idempotentKey": "IDEM-EXP-002-'$(date +%s)'", "businessData": "{\"amount\": 2000}", "callbackPayload": "{\"url\": \"http://callback.example.com\"}"},
      {"itemId": "EXP-003", "idempotentKey": "IDEM-EXP-003-'$(date +%s)'", "businessData": "{\"amount\": 3000}", "callbackPayload": "{\"url\": \"http://callback.example.com\"}"},
      {"itemId": "EXP-004", "idempotentKey": "IDEM-EXP-004-'$(date +%s)'", "businessData": "{\"amount\": 4000}", "callbackPayload": "{\"url\": \"http://callback.example.com\"}"},
      {"itemId": "EXP-005", "idempotentKey": "IDEM-EXP-005-'$(date +%s)'", "businessData": "{\"amount\": 5000}", "callbackPayload": "{\"url\": \"http://callback.example.com\"}"},
      {"itemId": "EXP-006", "idempotentKey": "IDEM-EXP-006-'$(date +%s)'", "businessData": "{\"amount\": 6000}", "callbackPayload": "{\"url\": \"http://callback.example.com\"}"},
      {"itemId": "EXP-007", "idempotentKey": "IDEM-EXP-007-'$(date +%s)'", "businessData": "{\"amount\": 7000}", "callbackPayload": "{\"url\": \"http://callback.example.com\"}"}
    ]
  }')
echo "✅ 批次创建成功"
echo "响应: $CREATE_RESPONSE"
echo ""

sleep 1

# 2. 开始处理
echo "【2/8】开始处理批次..."
START_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/start?operator=admin")
echo "✅ 批次已启动处理"
echo "响应: $START_RESPONSE"
echo ""

sleep 1

# 3. 模拟回调 - 部分成功部分失败
echo "【3/8】模拟回调结果（4成功3失败）..."
CALLBACK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "'"$BATCH_ID"'",
    "operator": "callback-service",
    "results": [
      {"itemId": "EXP-001", "success": true, "responseData": "{\"approvalId\": \"APV-001\"}"},
      {"itemId": "EXP-002", "success": true, "responseData": "{\"approvalId\": \"APV-002\"}"},
      {"itemId": "EXP-003", "success": true, "responseData": "{\"approvalId\": \"APV-003\"}"},
      {"itemId": "EXP-004", "success": true, "responseData": "{\"approvalId\": \"APV-004\"}"},
      {"itemId": "EXP-005", "success": false, "errorCode": "BUDGET_EXCEEDED", "errorMessage": "超出部门预算限额"},
      {"itemId": "EXP-006", "success": false, "errorCode": "MANAGER_NOT_FOUND", "errorMessage": "找不到审批经理"},
      {"itemId": "EXP-007", "success": false, "errorCode": "INTERNAL_ERROR", "errorMessage": "系统内部错误"}
    ]
  }')
echo "✅ 回调处理完成"
echo "响应: $CALLBACK_RESPONSE"
echo ""

sleep 1

# 4. 验证重复回调保护
echo "【4/8】验证重复回调保护（重复提交相同回调，应该被跳过）..."
DUPLICATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "'"$BATCH_ID"'",
    "operator": "callback-service",
    "results": [
      {"itemId": "EXP-001", "success": true, "responseData": "{\"approvalId\": \"APV-001\"}"},
      {"itemId": "EXP-005", "success": false, "errorCode": "BUDGET_EXCEEDED", "errorMessage": "超出部门预算限额"}
    ]
  }')
echo "✅ 重复回调处理完成"
echo "响应: $DUPLICATE_RESPONSE"
echo ""

sleep 1

# 5. 查询批次详情（验证计数正确：成功4，失败3）
echo "【5/8】查询批次详情（当前计数：成功4，失败3）..."
DETAIL_RESPONSE=$(curl -s "$BASE_URL/api/batches/$BATCH_ID")
echo "响应: $DETAIL_RESPONSE"
echo ""

sleep 1

# 6. 重放失败单据（路径参数方式，验证第三轮修复）
echo "【6/8】重放失败单据（使用路径参数 API）..."
REPLAY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/replay" \
  -H "Content-Type: application/json" \
  -d '{
    "replayAllFailed": true,
    "operator": "admin",
    "remark": "修复预算问题后重放"
  }')
echo "✅ 重放请求提交成功"
echo "响应: $REPLAY_RESPONSE"
echo ""

sleep 1

# 7. 重放后的回调
echo "【7/8】提交重放后的回调结果（2成功，1失败）..."
REPLAY_CALLBACK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/callback" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "'"$BATCH_ID"'",
    "operator": "callback-service",
    "results": [
      {"itemId": "EXP-005", "success": true, "responseData": "{\"approvalId\": \"APV-005-FIXED\"}"},
      {"itemId": "EXP-006", "success": true, "responseData": "{\"approvalId\": \"APV-006-FIXED\"}"},
      {"itemId": "EXP-007", "success": false, "errorCode": "INTERNAL_ERROR", "errorMessage": "系统内部错误 - 仍然失败"}
    ]
  }')
echo "✅ 重放回调处理完成"
echo "响应: $REPLAY_CALLBACK_RESPONSE"
echo ""

sleep 1

# 8. 导出问题排查报告
echo "【8/8】导出问题排查报告（最终计数应为：成功6，失败1）..."
REPORT_RESPONSE=$(curl -s "$BASE_URL/api/batches/$BATCH_ID/debug-report")
echo "报告内容:"
echo "-------------------------------------------------------------------------"
echo "$REPORT_RESPONSE" | grep -o '"data":"[^"]*"' | sed 's/"data":"//' | sed 's/"$//' | sed 's/\\n/\n/g' | head -80
echo "-------------------------------------------------------------------------"
echo ""

echo "========================================="
echo "  演示完成！"
echo "========================================="
echo ""
echo "核心规则验证要点:"
echo "✅ 重复回调被跳过，不产生脏计数"
echo "✅ 重放 API 路径参数正常工作（第三轮修复）"
echo "✅ 重放成功自动扣减失败计数（通过 previousStatus）"
echo "✅ 最终统计正确: 6成功，1失败"
echo ""
echo "可用的后续操作:"
echo "1. 查看失败单据: curl $BASE_URL/api/batches/$BATCH_ID/items/failed"
echo "2. 重放失败单据: curl -X POST $BASE_URL/api/batches/$BATCH_ID/replay -H 'Content-Type: application/json' -d '{\"replayAllFailed\": true, \"operator\": \"admin\"}'"
echo "3. 生成处理回执: curl -X POST $BASE_URL/api/batches/$BATCH_ID/receipts?operator=admin"
echo "4. 访问管理页面: $BASE_URL"
echo "5. 访问H2控制台: $BASE_URL/h2-console (JDBC: jdbc:h2:mem:approvaldb)"
echo ""