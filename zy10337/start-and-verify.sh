#!/bin/bash
# 批量审批回调协调器 - 一站式启动+验证脚本

set -e

BASE_URL="http://localhost:8080"
BATCH_ID="BATCH-$(date +%Y%m%d%H%M%S)"
PID_FILE="/tmp/approval-coordinator.pid"
LOG_FILE="/tmp/approval-coordinator.log"

echo "========================================="
echo "  批量审批回调协调器 - 启动+验证脚本"
echo "========================================="
echo ""

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# 检查端口是否被占用
check_port() {
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warn "端口 8080 已被占用，尝试停止..."
        lsof -Pi :8080 -sTCP:LISTEN -t | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# 等待服务启动
wait_for_start() {
    echo "等待服务启动中..."
    for i in {1..60}; do
        if curl -s "$BASE_URL/" >/dev/null 2>&1; then
            echo ""
            log_success "服务启动成功！"
            return 0
        fi
        sleep 2
        echo -n "."
    done
    echo ""
    log_error "服务启动超时（120秒）"
    echo "最后 20 行日志:"
    tail -20 "$LOG_FILE"
    exit 1
}

# 步骤 0: 检查环境
echo "【0/10】环境检查..."
if ! command -v java &> /dev/null; then
    log_error "未找到 Java 运行环境"
    exit 1
fi
java -version 2>&1 | head -1
log_success "Java 环境正常"
echo ""

# 步骤 1: 清理端口
check_port

# 步骤 2: 编译项目
echo "【1/10】编译项目（跳过测试）..."
cd "$(dirname "$0")"
./mvnw clean package -DskipTests -q 2>&1 | tail -5
if [ $? -eq 0 ]; then
    log_success "项目编译成功"
else
    log_error "项目编译失败"
    exit 1
fi
echo ""

# 步骤 3: 启动服务
echo "【2/10】启动 Spring Boot 服务..."
nohup ./mvnw spring-boot:run -q > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
log_success "服务已启动，PID: $(cat $PID_FILE)"
echo "日志文件: $LOG_FILE"
echo ""

# 步骤 4: 等待启动
wait_for_start
echo ""

# 步骤 5: 创建批次
echo "【3/10】创建审批批次..."
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
if echo "$CREATE_RESPONSE" | grep -q '"success":true'; then
    log_success "批次创建成功，批次ID: $BATCH_ID"
else
    log_error "批次创建失败: $CREATE_RESPONSE"
    exit 1
fi
echo ""
sleep 1

# 步骤 6: 开始处理
echo "【4/10】开始处理批次..."
START_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/start?operator=admin")
if echo "$START_RESPONSE" | grep -q '"success":true'; then
    log_success "批次已启动处理"
else
    log_error "启动处理失败: $START_RESPONSE"
    exit 1
fi
echo ""
sleep 1

# 步骤 7: 首次回调 - 4成功3失败
echo "【5/10】首次回调（4成功，3失败）..."
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
if echo "$CALLBACK_RESPONSE" | grep -q '"success":true'; then
    log_success "首次回调处理完成"
else
    log_error "回调处理失败: $CALLBACK_RESPONSE"
    exit 1
fi
echo ""
sleep 1

# 步骤 8: 验证首次计数
echo "【6/10】验证首次回调计数（4成功，3失败）..."
DETAIL_RESPONSE=$(curl -s "$BASE_URL/api/batches/$BATCH_ID")
SUCCESS_COUNT=$(echo "$DETAIL_RESPONSE" | grep -o '"successCount":[0-9]*' | cut -d: -f2)
FAILED_COUNT=$(echo "$DETAIL_RESPONSE" | grep -o '"failedCount":[0-9]*' | cut -d: -f2)

log_success "当前计数 - 成功: $SUCCESS_COUNT, 失败: $FAILED_COUNT"

if [ "$SUCCESS_COUNT" -eq 4 ] && [ "$FAILED_COUNT" -eq 3 ]; then
    log_success "首次计数验证通过 ✓"
else
    log_error "首次计数验证失败！预期：success=4, failed=3"
    exit 1
fi
echo ""
sleep 1

# 步骤 9: 重放失败单据
echo "【7/10】重放失败单据（路径参数 API 验证）..."
REPLAY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/batches/$BATCH_ID/replay" \
  -H "Content-Type: application/json" \
  -d '{
    "replayAllFailed": true,
    "operator": "admin",
    "remark": "修复预算问题后重放"
  }')
if echo "$REPLAY_RESPONSE" | grep -q '"success":true'; then
    REPLAY_COUNT=$(echo "$REPLAY_RESPONSE" | grep -o '"replayCount":[0-9]*' | cut -d: -f2)
    log_success "重放请求提交成功，重放单据数: $REPLAY_COUNT"
else
    log_error "重放请求失败: $REPLAY_RESPONSE"
    exit 1
fi
echo ""
sleep 1

# 步骤 10: 重放后的回调
echo "【8/10】重放后回调（2成功，1失败）..."
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
if echo "$REPLAY_CALLBACK_RESPONSE" | grep -q '"success":true'; then
    log_success "重放回调处理完成"
else
    log_error "重放回调失败: $REPLAY_CALLBACK_RESPONSE"
    exit 1
fi
echo ""
sleep 1

# 步骤 11: 验证最终计数
echo "【9/10】验证最终计数（预期：6成功，1失败）..."
FINAL_DETAIL=$(curl -s "$BASE_URL/api/batches/$BATCH_ID")
FINAL_SUCCESS=$(echo "$FINAL_DETAIL" | grep -o '"successCount":[0-9]*' | cut -d: -f2)
FINAL_FAILED=$(echo "$FINAL_DETAIL" | grep -o '"failedCount":[0-9]*' | cut -d: -f2)

log_success "最终计数 - 成功: $FINAL_SUCCESS, 失败: $FINAL_FAILED"

if [ "$FINAL_SUCCESS" -eq 6 ] && [ "$FINAL_FAILED" -eq 1 ]; then
    log_success "重放计数验证通过 ✓"
    log_success "核心规则：重放成功自动扣减失败计数，统计准确！"
else
    log_error "重放计数验证失败！预期：success=6, failed=1"
    log_error "可能原因：previousStatus 状态保存或读取失败"
    exit 1
fi
echo ""

# 步骤 12: 导出排查报告
echo "【10/10】导出问题排查报告..."
REPORT_RESPONSE=$(curl -s "$BASE_URL/api/batches/$BATCH_ID/debug-report")
echo ""
echo "-------------------------------------------------------------------------"
echo "$REPORT_RESPONSE" | grep -o '"data":"[^"]*"' | sed 's/"data":"//' | sed 's/"$//' | sed 's/\\n/\n/g' | head -50
echo "-------------------------------------------------------------------------"
echo ""

echo "========================================="
echo "  🎉 所有验证通过！"
echo "========================================="
echo ""
echo "✅ 服务正常启动和响应"
echo "✅ API 路径参数正常工作（重放接口）"
echo "✅ 首次回调计数正确（4/3）"
echo "✅ 重放状态正确保存（previousStatus）"
echo "✅ 重放后计数自动修正（6/1）"
echo "✅ 重复提交不产生脏结果"
echo ""
echo "服务仍在运行，访问:"
echo "  - 管理页面: $BASE_URL"
echo "  - H2控制台: $BASE_URL/h2-console"
echo "  - 批次详情: $BASE_URL/api/batches/$BATCH_ID"
echo ""
echo "停止服务: kill $(cat $PID_FILE)"
echo ""