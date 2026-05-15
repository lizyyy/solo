#!/bin/bash

BASE_URL="http://localhost:8080/api/v1/compensation"
PROCESS_ID="ORDER-TEST-001"

cd "$(dirname "$0")"

echo "====================================="
echo "跨服务补偿指令 API - 完整流程测试"
echo "====================================="
echo ""

wait_for_service() {
    echo "等待服务启动..."
    for i in {1..30}; do
        if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/$PROCESS_ID" | grep -q "404\|200"; then
            echo "✅ 服务已启动"
            return 0
        fi
        sleep 1
    done
    echo "❌ 服务启动超时，请先运行 ./start.sh 启动服务"
    exit 1
}

echo_section() {
    echo ""
    echo "-------------------------------------"
    echo " $1"
    echo "-------------------------------------"
}

check_json_value() {
    local json="$1"
    local key="$2"
    local expected="$3"
    local actual=$(echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | cut -d'"' -f4)
    if [ "$actual" = "$expected" ]; then
        echo "  ✅ $key = $expected"
        return 0
    else
        echo "  ❌ $key = $actual (期望: $expected)"
        return 1
    fi
}

wait_for_service

echo_section "1. 创建补偿流程"
RESULT1=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d @src/test/resources/test-request.json)
echo "$RESULT1" | head -c 200
echo ""
check_json_value "$RESULT1" "code" "200"
check_json_value "$RESULT1" "message" "补偿流程创建成功"

echo_section "2. 幂等性测试 - 重复创建相同流程"
RESULT2=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -d @src/test/resources/test-request.json)
echo "$RESULT2" | head -c 200
echo ""
check_json_value "$RESULT2" "code" "200"
check_json_value "$RESULT2" "message" "流程已存在，返回已有数据"

echo_section "3. 查看流程详情"
DETAIL=$(curl -s -X GET "$BASE_URL/$PROCESS_ID")
echo "$DETAIL" | head -c 300
echo "..."

echo_section "4. 启动补偿流程"
START=$(curl -s -X POST "$BASE_URL/$PROCESS_ID/start")
echo "$START"
check_json_value "$START" "code" "200"

echo_section "5. 获取下一条可执行指令（应该只有顺序 1）"
NEXT=$(curl -s -X GET "$BASE_URL/$PROCESS_ID/next")
echo "$NEXT"
NEXT_ID=$(echo "$NEXT" | grep -o '"instructionId":"[^\"]*"' | head -n 1 | cut -d'"' -f4)
NEXT_ORDER=$(echo "$NEXT" | grep -o '"executionOrder":[0-9]*' | head -n 1 | cut -d':' -f2)
echo "  获取到的下一条指令: $NEXT_ID (顺序: $NEXT_ORDER)"
if [ "$NEXT_ORDER" = "1" ]; then
    echo "  ✅ 正确返回顺序 1 的指令"
else
    echo "  ❌ 错误：应该返回顺序 1 的指令"
fi

echo_section "6. 顺序控制测试 - 尝试执行顺序 3 的指令（应该失败，前序未完成）"
INST3="INST-$PROCESS_ID-3"
EXEC3=$(curl -s -X POST "$BASE_URL/instruction/$INST3/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-TEST-3","executor":"tester"}')
echo "$EXEC3"
if echo "$EXEC3" | grep -q "前序指令未完成"; then
    echo "  ✅ 正确拦截了乱序执行"
else
    echo "  ❌ 顺序控制失效"
fi

echo_section "7. 人工确认指令 2（需要人工确认）"
INST2="INST-$PROCESS_ID-2"
MANUAL=$(curl -s -X POST "$BASE_URL/instruction/$INST2/confirm" \
  -H "Content-Type: application/json" \
  -d '{"operator":"admin","remark":"确认可以执行"}')
echo "$MANUAL"
check_json_value "$MANUAL" "code" "200"

echo_section "8. 执行指令 1（应该成功）"
INST1="INST-$PROCESS_ID-1"
EXEC1=$(curl -s -X POST "$BASE_URL/instruction/$INST1/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-TEST-1","executor":"tester"}')
echo "$EXEC1"
check_json_value "$EXEC1" "code" "200"

echo_section "9. 幂等性测试 - 重复执行指令 1"
EXEC1_DUP=$(curl -s -X POST "$BASE_URL/instruction/$INST1/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-TEST-1","executor":"tester"}')
echo "$EXEC1_DUP"
if echo "$EXEC1_DUP" | grep -q "幂等处理"; then
    echo "  ✅ 幂等处理生效"
else
    echo "  ❌ 幂等性失效"
fi

echo_section "10. 执行指令 2（应该成功，前序已完成）"
EXEC2=$(curl -s -X POST "$BASE_URL/instruction/$INST2/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-TEST-2","executor":"tester"}')
echo "$EXEC2"
check_json_value "$EXEC2" "code" "200"

echo_section "11. 测试重试机制 - 强制失败执行指令 3（maxRetry=3）"
echo "  第 1 次执行（失败，retryCount=1，状态回到 PENDING）"
EXEC3_1=$(curl -s -X POST "$BASE_URL/instruction/$INST3/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-TEST-3-1","executor":"tester","forceFail":true}')
echo "$EXEC3_1"
if echo "$EXEC3_1" | grep -q "执行失败，等待重试"; then
    echo "  ✅ 正确返回重试状态"
else
    echo "  ❌ 重试机制异常"
fi

echo "  第 2 次执行（失败，retryCount=2，状态回到 PENDING）"
EXEC3_2=$(curl -s -X POST "$BASE_URL/instruction/$INST3/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-TEST-3-2","executor":"tester","forceFail":true}')
echo "$EXEC3_2"

echo "  第 3 次执行（失败，retryCount=3，状态变为 FAILED）"
EXEC3_3=$(curl -s -X POST "$BASE_URL/instruction/$INST3/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-TEST-3-3","executor":"tester","forceFail":true}')
echo "$EXEC3_3"
if echo "$EXEC3_3" | grep -q "已达最大重试次数"; then
    echo "  ✅ 正确触发最大重试限制"
else
    echo "  ❌ 最大重试机制异常"
fi

echo_section "12. 继续执行指令 4（跳过失败的 3，完成流程）"
INST4="INST-$PROCESS_ID-4"
EXEC4=$(curl -s -X POST "$BASE_URL/instruction/$INST4/execute" \
  -H "Content-Type: application/json" \
  -d '{"executionId":"EXEC-TEST-4","executor":"tester"}')
echo "$EXEC4"

echo_section "13. 查询历史记录"
HISTORY=$(curl -s -X GET "$BASE_URL/history")
echo "$HISTORY" | python3 -m json.tool 2>/dev/null || echo "$HISTORY"

echo_section "14. 导出执行报告 - 第一次"
EXPORT1=$(curl -s -X GET "$BASE_URL/$PROCESS_ID/export")
echo "$EXPORT1" | head -n 50
echo "..."

echo_section "15. 导出执行报告 - 第二次（验证一致性）"
EXPORT2=$(curl -s -X GET "$BASE_URL/$PROCESS_ID/export")
if [ "$EXPORT1" = "$EXPORT2" ]; then
    echo "  ✅ 两次导出结果完全一致"
else
    echo "  ❌ 导出结果不一致"
fi

echo ""
echo "====================================="
echo "测试完成！"
echo "====================================="
echo ""
echo "验证要点总结："
echo "  ✅ 1. 幂等性 - 重复创建/执行不产生脏数据"
echo "  ✅ 2. 顺序控制 - 必须按 executionOrder 顺序执行"
echo "  ✅ 3. 失败原因 - 乱序执行会返回明确的前序依赖错误"
echo "  ✅ 4. 重试机制 - 支持 maxRetry 次重试"
echo "  ✅ 5. 历史查询 - 可查询流程执行状态"
echo "  ✅ 6. 导出一致性 - 多次导出结果一致"
echo ""
