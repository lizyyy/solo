#!/bin/bash

BASE_URL="http://localhost:3000/api"

echo "=========================================="
echo "任务优先级仲裁 API - Curl 样例"
echo "=========================================="
echo ""

echo "0. 检查服务健康状态"
echo "------------------------------------------"
curl -s "$BASE_URL/health"
echo ""
echo ""

echo "1. 查看可用元数据（任务类型、租户等级等）"
echo "------------------------------------------"
curl -s "$BASE_URL/metadata"
echo ""
echo ""

echo "=========================================="
echo "场景一：普通排队 - 提交普通用户的批处理任务"
echo "=========================================="
echo ""

echo "提交普通批处理任务（Guest 用户）"
echo "curl -s -X POST $BASE_URL/tasks \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"tenantId":"guest-001","taskType":"batch_processing","tenantLevel":"guest","priority":0,"resourceEstimate":{"cpu":2,"memory":2,"duration":300},"payload":{"job":"nightly-backup"}}'"
echo ""

TASK1_RESULT=$(curl -s -X POST "$BASE_URL/tasks" \
  -H 'Content-Type: application/json' \
  -d '{"tenantId":"guest-001","taskType":"batch_processing","tenantLevel":"guest","priority":0,"resourceEstimate":{"cpu":2,"memory":2,"duration":300},"payload":{"job":"nightly-backup"}}')

TASK1_ID=$(echo $TASK1_RESULT | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.parse(d).data.task.taskId)")

echo "任务 ID: $TASK1_ID"
echo "响应:"
echo $TASK1_RESULT | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.stringify(JSON.parse(d),null,2))"
echo ""

echo "=========================================="
echo "场景二：VIP 插队 - 提交 Gold 租户的实时导出任务"
echo "=========================================="
echo ""

echo "提交 VIP 实时导出任务（Gold 租户，高优先级）"
echo "该任务会抢占低优先级的批处理任务"
echo ""

TASK2_RESULT=$(curl -s -X POST "$BASE_URL/tasks" \
  -H 'Content-Type: application/json' \
  -d '{"tenantId":"vip-company","taskType":"realtime_export","tenantLevel":"gold","priority":10,"deadline":"2026-05-13T23:59:59.999Z","resourceEstimate":{"cpu":4,"memory":4,"duration":60},"payload":{"exportType":"user-data","format":"xlsx"}}')

TASK2_ID=$(echo $TASK2_RESULT | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.parse(d).data.task.taskId)")

echo "VIP 任务 ID: $TASK2_ID"
echo "响应:"
echo $TASK2_RESULT | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.stringify(JSON.parse(d),null,2))"
echo ""

echo "=========================================="
echo "场景三：批处理暂停 - 查看被暂停的低优先级任务"
echo "=========================================="
echo ""

echo "查看所有任务（展示被暂停 vs 运行中）"
curl -s "$BASE_URL/tasks" | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.stringify(JSON.parse(d),null,2))"
echo ""

echo "查看第一个普通任务的仲裁分析"
curl -s "$BASE_URL/tasks/$TASK1_ID" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log('状态:',j.data.task.status);console.log('仲裁原因:',j.data.task.arbitrationReason);console.log('暂停次数:',j.data.task.suspendedCount);"
echo ""

echo "=========================================="
echo "场景四：补偿任务优先级提升 - 模拟长时间等待的补偿任务"
echo "=========================================="
echo ""

echo "注意：补偿任务等待超过 5 分钟后会自动提升优先级"
echo "（实际环境中需要等待，这里提交补偿任务展示配置方式）"
echo ""

echo "提交夜间补偿任务"
TASK3_RESULT=$(curl -s -X POST "$BASE_URL/tasks" \
  -H 'Content-Type: application/json' \
  -d '{"tenantId":"system","taskType":"compensation","tenantLevel":"silver","priority":0,"resourceEstimate":{"cpu":2,"memory":3,"duration":600},"payload":{"compensationType":"order-reconciliation","date":"2026-05-12"}}')

TASK3_ID=$(echo $TASK3_RESULT | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.parse(d).data.task.taskId)")

echo "补偿任务 ID: $TASK3_ID"
echo "响应:"
echo $TASK3_RESULT | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.stringify(JSON.parse(d),null,2))"
echo ""

echo "=========================================="
echo "场景五：重复提交幂等 - 使用相同 idempotencyKey"
echo "=========================================="
echo ""

echo "第一次提交带幂等键的任务"
TASK4_IDEMP_KEY="report-job-2026-05-13-001"
TASK4_RESULT=$(curl -s -X POST "$BASE_URL/tasks" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"enterprise-a\",\"taskType\":\"report_generation\",\"tenantLevel\":\"silver\",\"idempotencyKey\":\"$TASK4_IDEMP_KEY\",\"resourceEstimate\":{\"cpu\":1,\"memory\":1,\"duration\":120},\"payload\":{\"reportType\":\"daily-summary\"}}")

echo "第一次提交响应:"
echo $TASK4_RESULT | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log('isNew:',j.data.isNew);console.log('任务ID:',j.data.task.taskId);"
echo ""

echo "第二次提交相同幂等键的任务（应返回已有任务，isNew=false）"
TASK4_RESULT2=$(curl -s -X POST "$BASE_URL/tasks" \
  -H 'Content-Type: application/json' \
  -d "{\"tenantId\":\"enterprise-a\",\"taskType\":\"report_generation\",\"tenantLevel\":\"silver\",\"idempotencyKey\":\"$TASK4_IDEMP_KEY\",\"resourceEstimate\":{\"cpu\":1,\"memory\":1,\"duration\":120},\"payload\":{\"reportType\":\"daily-summary\"}}")

echo "第二次提交响应:"
echo $TASK4_RESULT2 | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);console.log('isNew:',j.data.isNew);console.log('任务ID:',j.data.task.taskId);console.log('原因:',j.data.submissionReason);"
echo ""

echo "=========================================="
echo "场景六：任务完成后自动仲裁恢复"
echo "=========================================="
echo ""

echo "模拟 VIP 任务完成"
echo "VIP 任务完成后，仲裁引擎会自动恢复被暂停的低优先级任务"
echo ""

echo "完成 VIP 任务..."
curl -s -X POST "$BASE_URL/tasks/$TASK2_ID/complete" | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.stringify(JSON.parse(d),null,2))"
echo ""

echo "查看更新后的任务状态"
curl -s "$BASE_URL/tasks" | node -e "const d=require('fs').readFileSync(0,'utf8');const j=JSON.parse(d);j.data.tasks.forEach(t=>{console.log(t.taskId.slice(0,8)+'...', t.status, '优先级:', t.effectivePriority, '仲裁:', t.arbitrationReason);});"
echo ""

echo "=========================================="
echo "场景七：查看完整统计信息和仲裁原因"
echo "=========================================="
echo ""

echo "获取所有任务列表（含仲裁原因、等待时间、资源占用）"
curl -s "$BASE_URL/tasks" | node -e "
const d = require('fs').readFileSync(0, 'utf8');
const j = JSON.parse(d);
console.log('总任务数:', j.data.total);
console.log('');
console.log('任务详情:');
j.data.tasks.forEach((t, i) => {
  console.log(\`[\${i+1}] \${t.taskId.slice(0,12)}...\`);
  console.log('    类型:', t.taskType, '| 租户:', t.tenantLevel);
  console.log('    状态:', t.status, '| 有效优先级:', t.effectivePriority);
  console.log('    仲裁原因:', t.arbitrationReason || '暂无');
  console.log('    等待时间:', Math.round(t.waitTimeMs/1000) + '秒');
  console.log('    已分配资源: CPU=' + t.resourcesAllocated.cpu + ', MEM=' + t.resourcesAllocated.memory + 'GB');
  console.log('');
});
"
echo ""

echo "获取统计概览"
curl -s "$BASE_URL/tasks/statistics" | node -e "const d=require('fs').readFileSync(0,'utf8');console.log(JSON.stringify(JSON.parse(d),null,2))"
echo ""

echo "=========================================="
echo "样例演示完成！"
echo "=========================================="
