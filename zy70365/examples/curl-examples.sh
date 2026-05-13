#!/bin/bash

BASE_URL="http://localhost:8080"

echo "=========================================="
echo "  Task Sandbox API - curl 示例"
echo "  请先启动服务: node src/app.js"
echo "=========================================="
echo ""

echo "=== 1. 健康检查 ==="
curl -s "${BASE_URL}/health" | python3 -m json.tool
echo ""
echo ""

echo "=== 2. 查看可用策略 ==="
curl -s "${BASE_URL}/api/tasks/policies" | python3 -m json.tool
echo ""
echo ""

echo "=== 3. 查看配额预设 ==="
curl -s "${BASE_URL}/api/tasks/quotas" | python3 -m json.tool
echo ""
echo ""

echo "=== 4. 查看模拟模式 ==="
curl -s "${BASE_URL}/api/tasks/simulation-modes" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "  示例 A: 正常任务执行"
echo "=========================================="
echo ""

echo "A1. 创建正常任务"
TASK1_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "normal-task-$(date +%s)",
    "scriptContent": "console.log(\"Hello from sandbox\");",
    "scriptType": "javascript",
    "submitter": "operator_zhang",
    "policyType": "limited",
    "quotaPreset": "standard",
    "parameters": {
      "input": "data123",
      "count": 100
    }
  }')
echo "$TASK1_RESPONSE" | python3 -m json.tool
TASK1_ID=$(echo "$TASK1_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['task']['taskId'])")
echo "任务ID: $TASK1_ID"
echo ""

echo "A2. 立即执行任务 (正常模式)"
curl -s -X POST "${BASE_URL}/api/tasks/${TASK1_ID}/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "simulationMode": "normal",
    "options": {
      "duration": 2000,
      "steps": 5
    },
    "operator": "operator_zhang"
  }' | python3 -m json.tool
echo ""
echo "等待任务执行..."
sleep 3
echo ""

echo "A3. 查询任务状态"
curl -s "${BASE_URL}/api/tasks/${TASK1_ID}?detailed=true" | python3 -m json.tool
echo ""

echo "A4. 查看任务日志"
curl -s "${BASE_URL}/api/tasks/${TASK1_ID}/logs" | python3 -m json.tool
echo ""

echo "A5. 导出任务结果"
curl -s "${BASE_URL}/api/tasks/${TASK1_ID}/export" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "  示例 B: 超时任务"
echo "=========================================="
echo ""

echo "B1. 创建超时测试任务"
TASK2_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "timeout-task-$(date +%s)",
    "submitter": "operator_wang",
    "policyType": "limited",
    "quotaPreset": "lightweight",
    "customQuotas": {
      "maxExecutionTime": 3000
    }
  }')
echo "$TASK2_RESPONSE" | python3 -m json.tool
TASK2_ID=$(echo "$TASK2_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['task']['taskId'])")
echo "任务ID: $TASK2_ID"
echo ""

echo "B2. 执行超时模拟"
curl -s -X POST "${BASE_URL}/api/tasks/${TASK2_ID}/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "simulationMode": "timeout",
    "options": {
      "timeoutDuration": 3000,
      "simulatedDuration": 8000
    },
    "operator": "operator_wang"
  }' | python3 -m json.tool
echo ""
echo "等待超时检测..."
sleep 5
echo ""

echo "B3. 查询超时任务状态"
curl -s "${BASE_URL}/api/tasks/${TASK2_ID}" | python3 -m json.tool
echo ""

echo "B4. 查看超时日志"
curl -s "${BASE_URL}/api/tasks/${TASK2_ID}/logs" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "  示例 C: 越权文件访问"
echo "=========================================="
echo ""

echo "C1. 创建权限测试任务"
TASK3_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "permission-test-$(date +%s)",
    "submitter": "operator_li",
    "policyType": "no_filesystem"
  }')
echo "$TASK3_RESPONSE" | python3 -m json.tool
TASK3_ID=$(echo "$TASK3_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['task']['taskId'])")
echo "任务ID: $TASK3_ID"
echo ""

echo "C2. 模拟越权访问 /etc/passwd"
curl -s -X POST "${BASE_URL}/api/tasks/${TASK3_ID}/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "simulationMode": "permission_violation",
    "options": {
      "targetPath": "/etc/passwd"
    },
    "operator": "operator_li"
  }' | python3 -m json.tool
echo ""
echo "等待权限检查..."
sleep 2
echo ""

echo "C3. 查询权限违规任务"
curl -s "${BASE_URL}/api/tasks/${TASK3_ID}?detailed=true" | python3 -m json.tool
echo ""

echo "C4. 查看权限违规详情"
curl -s "${BASE_URL}/api/tasks/${TASK3_ID}/logs?type=platform" | python3 -m json.tool
echo ""

echo "C5. 直接权限检查 API (测试)"
curl -s "${BASE_URL}/api/tasks/${TASK3_ID}/check-permission?operation=readFile&resource=/etc/passwd" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "  示例 D: 手动取消任务"
echo "=========================================="
echo ""

echo "D1. 创建可取消的任务"
TASK4_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cancellable-task-$(date +%s)",
    "submitter": "operator_zhao",
    "policyType": "limited",
    "quotaPreset": "standard"
  }')
echo "$TASK4_RESPONSE" | python3 -m json.tool
TASK4_ID=$(echo "$TASK4_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['task']['taskId'])")
echo "任务ID: $TASK4_ID"
echo ""

echo "D2. 执行长时间运行的任务 (带日志模式)"
curl -s -X POST "${BASE_URL}/api/tasks/${TASK4_ID}/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "simulationMode": "normal_with_logs",
    "options": {
      "duration": 10000,
      "logCount": 20
    },
    "operator": "operator_zhao"
  }' | python3 -m json.tool
echo ""
echo "任务运行中，等待1秒后取消..."
sleep 1
echo ""

echo "D3. 查看运行中的任务列表"
curl -s "${BASE_URL}/api/tasks/running/list" | python3 -m json.tool
echo ""

echo "D4. 用户取消任务"
curl -s -X POST "${BASE_URL}/api/tasks/${TASK4_ID}/cancel" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "operator_zhao",
    "reason": "用户手动取消，任务不再需要"
  }' | python3 -m json.tool
echo ""
echo "等待取消处理..."
sleep 2
echo ""

echo "D5. 验证任务已取消且无法写入结果"
curl -s "${BASE_URL}/api/tasks/${TASK4_ID}" | python3 -m json.tool
echo ""

echo "D6. 查看取消后的日志"
curl -s "${BASE_URL}/api/tasks/${TASK4_ID}/logs" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "  示例 E: 重复提交检测"
echo "=========================================="
echo ""

echo "E1. 创建第一个任务 (不执行)"
TASK5_NAME="duplicate-test-$(date +%s)"
TASK5A_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${TASK5_NAME}\",
    \"submitter\": \"operator_qian\"
  }")
echo "$TASK5A_RESPONSE" | python3 -m json.tool
TASK5A_ID=$(echo "$TASK5A_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['task']['taskId'])")
echo "第一个任务ID: $TASK5A_ID"
echo ""

echo "E2. 提交第一个任务"
curl -s -X POST "${BASE_URL}/api/tasks/${TASK5A_ID}/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator": "operator_qian"}' | python3 -m json.tool
echo ""

echo "E3. 尝试创建同名任务 (应该被拒绝)"
curl -s -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${TASK5_NAME}\",
    \"submitter\": \"operator_qian\"
  }" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "  示例 F: 内存超限任务"
echo "=========================================="
echo ""

echo "F1. 创建内存测试任务"
TASK6_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "memory-test-$(date +%s)",
    "submitter": "operator_sun",
    "policyType": "limited",
    "quotaPreset": "lightweight"
  }')
echo "$TASK6_RESPONSE" | python3 -m json.tool
TASK6_ID=$(echo "$TASK6_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['task']['taskId'])")
echo "任务ID: $TASK6_ID"
echo ""

echo "F2. 执行内存超限模拟"
curl -s -X POST "${BASE_URL}/api/tasks/${TASK6_ID}/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "simulationMode": "memory_exceeded",
    "operator": "operator_sun"
  }' | python3 -m json.tool
echo ""
echo "等待内存超限检测..."
sleep 3
echo ""

echo "F3. 查询资源使用情况"
curl -s "${BASE_URL}/api/tasks/${TASK6_ID}/resources" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "  示例 G: 管理员强制终止"
echo "=========================================="
echo ""

echo "G1. 创建长运行任务"
TASK7_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "admin-kill-test-$(date +%s)",
    "submitter": "operator_zhou",
    "policyType": "limited",
    "quotaPreset": "heavy"
  }')
echo "$TASK7_RESPONSE" | python3 -m json.tool
TASK7_ID=$(echo "$TASK7_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['task']['taskId'])")
echo "任务ID: $TASK7_ID"
echo ""

echo "G2. 执行任务"
curl -s -X POST "${BASE_URL}/api/tasks/${TASK7_ID}/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "simulationMode": "normal_with_logs",
    "options": {
      "duration": 30000,
      "logCount": 50
    },
    "operator": "operator_zhou"
  }' | python3 -m json.tool
echo ""
echo "任务运行中，等待2秒..."
sleep 2
echo ""

echo "G3. 管理员强制终止任务"
curl -s -X POST "${BASE_URL}/api/tasks/${TASK7_ID}/kill" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "admin_user",
    "reason": "检测到异常资源使用，管理员强制终止"
  }' | python3 -m json.tool
echo ""
echo "等待终止处理..."
sleep 2
echo ""

echo "G4. 验证终止状态"
curl -s "${BASE_URL}/api/tasks/${TASK7_ID}" | python3 -m json.tool
echo ""

echo "G5. 查看审计记录"
curl -s "${BASE_URL}/api/tasks/${TASK7_ID}/logs?type=audit" | python3 -m json.tool
echo ""
echo ""

echo "=========================================="
echo "  示例 H: 列出所有任务"
echo "=========================================="
echo ""

echo "H1. 列出所有任务"
curl -s "${BASE_URL}/api/tasks" | python3 -m json.tool
echo ""

echo "H2. 按提交者筛选"
curl -s "${BASE_URL}/api/tasks?submitter=operator_zhang" | python3 -m json.tool
echo ""

echo "H3. 按状态筛选 (失败的任务)"
curl -s "${BASE_URL}/api/tasks?state=failed" | python3 -m json.tool
echo ""

echo "=========================================="
echo "  所有示例完成！"
echo "=========================================="
