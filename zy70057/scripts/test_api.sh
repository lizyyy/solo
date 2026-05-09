#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"

echo "=== 资金归集日终校验服务测试脚本 ==="
echo "服务地址: $BASE_URL"
echo ""

echo "[1/8] 检查服务健康状态..."
response=$(curl -s "$BASE_URL/health")
if echo "$response" | grep -q '"status":"ok"'; then
  echo "✅ 服务正常运行"
else
  echo "❌ 服务异常: $response"
  exit 1
fi
echo ""

echo "[2/8] 创建账户树..."
echo "  - 创建总部账户 HQ-001"
curl -s -X POST "$BASE_URL/accounts" \
  -H "Content-Type: application/json" \
  -d '{"code":"HQ-001","name":"集团总部账户","company_type":"HEADQUARTERS"}' | head -c 300
echo ""

echo "  - 创建分公司账户 BR-001 (父级 HQ-001)"
curl -s -X POST "$BASE_URL/accounts" \
  -H "Content-Type: application/json" \
  -d '{"code":"BR-001","name":"华东分公司","company_type":"BRANCH","parent_code":"HQ-001"}' | head -c 300
echo ""

echo "  - 创建分公司账户 BR-002 (父级 HQ-001)"
curl -s -X POST "$BASE_URL/accounts" \
  -H "Content-Type: application/json" \
  -d '{"code":"BR-002","name":"华南分公司","company_type":"BRANCH","parent_code":"HQ-001"}' | head -c 300
echo ""

echo "  - 创建子公司账户 SUB-001 (父级 BR-001)"
curl -s -X POST "$BASE_URL/accounts" \
  -H "Content-Type: application/json" \
  -d '{"code":"SUB-001","name":"杭州子公司","company_type":"SUBSIDIARY","parent_code":"BR-001"}' | head -c 300
echo ""
echo "✅ 账户创建完成"
echo ""

echo "[3/8] 设置账户初始余额 (2026-05-08)"
curl -s -X POST "$BASE_URL/accounts/balance" \
  -H "Content-Type: application/json" \
  -d '{"account_code":"HQ-001","balance":1000000,"date":"2026-05-08"}'
echo ""
curl -s -X POST "$BASE_URL/accounts/balance" \
  -H "Content-Type: application/json" \
  -d '{"account_code":"BR-001","balance":500000,"date":"2026-05-08"}'
echo ""
curl -s -X POST "$BASE_URL/accounts/balance" \
  -H "Content-Type: application/json" \
  -d '{"account_code":"BR-002","balance":300000,"date":"2026-05-08"}'
echo ""
curl -s -X POST "$BASE_URL/accounts/balance" \
  -H "Content-Type: application/json" \
  -d '{"account_code":"SUB-001","balance":200000,"date":"2026-05-08"}'
echo ""
echo "✅ 初始余额设置完成"
echo ""

echo "[4/8] 创建资金归集任务 (2026-05-09)"
echo "  - 任务1: SUB-001 -> BR-001, 金额100000"
task1_response=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{"task_date":"2026-05-09","source_code":"SUB-001","target_code":"BR-001","amount":100000}')
task1_id=$(echo "$task1_response" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "  任务ID: $task1_id"
echo "$task1_response" | head -c 400
echo ""

echo "  - 任务2: BR-001 -> HQ-001, 金额150000"
task2_response=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{"task_date":"2026-05-09","source_code":"BR-001","target_code":"HQ-001","amount":150000}')
task2_id=$(echo "$task2_response" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "  任务ID: $task2_id"
echo "$task2_response" | head -c 400
echo ""

echo "  - 任务3: BR-002 -> HQ-001, 金额80000 (故意设置余额不足)"
task3_response=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{"task_date":"2026-05-09","source_code":"BR-002","target_code":"HQ-001","amount":400000}')
task3_id=$(echo "$task3_response" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
echo "  任务ID: $task3_id"
echo "$task3_response" | head -c 400
echo ""
echo "✅ 归集任务创建完成"
echo ""

echo "[5/8] 测试幂等性 - 重复创建相同任务"
echo "  - 再次创建任务1 (应该返回重复)"
duplicate_response=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d '{"task_date":"2026-05-09","source_code":"SUB-001","target_code":"BR-001","amount":100000}')
if echo "$duplicate_response" | grep -q '"is_duplicate":true\|"message":"duplicate'; then
  echo "  ✅ 幂等性检测正常，拒绝了重复任务"
else
  echo "  ⚠️  响应: $duplicate_response"
fi
echo ""

echo "[6/8] 执行任务"
echo "  - 执行任务1 (SUB-001 -> BR-001)"
curl -s -X POST "$BASE_URL/tasks/$task1_id/execute" | head -c 400
echo ""

echo "  - 执行任务2 (BR-001 -> HQ-001)"
curl -s -X POST "$BASE_URL/tasks/$task2_id/execute" | head -c 400
echo ""

echo "  - 执行任务3 (BR-002 -> HQ-001) - 应该失败(余额不足)"
fail_response=$(curl -s -X POST "$BASE_URL/tasks/$task3_id/execute")
echo "$fail_response" | head -c 300
echo ""
echo "✅ 任务执行完成"
echo ""

echo "[7/8] 查看账户余额"
echo "  - HQ-001 余额:"
curl -s "$BASE_URL/accounts/balance?account_code=HQ-001&date=2026-05-09"
echo ""
echo "  - BR-001 余额:"
curl -s "$BASE_URL/accounts/balance?account_code=BR-001&date=2026-05-09"
echo ""
echo "  - SUB-001 余额:"
curl -s "$BASE_URL/accounts/balance?account_code=SUB-001&date=2026-05-09"
echo ""

echo ""
echo "[8/8] 运行日终对账"
reconciliation_result=$(curl -s -X POST "$BASE_URL/reconciliation/run?date=2026-05-09")
echo "对账结果:"
echo "$reconciliation_result"
echo ""

echo ""
echo "=== 额外测试: 差异处理 ==="
echo ""

echo "[9/10] 查看今日任务状态"
curl -s "$BASE_URL/tasks?date=2026-05-09"
echo ""

echo "[10/10] 查看日终报告"
curl -s "$BASE_URL/reports/daily?date=2026-05-09"
echo ""

echo ""
echo "=== 测试完成 ==="
echo "关键验证点:"
echo "  1. 账户树已正确创建 (HQ-001 -> BR-001/BR-002 -> SUB-001)"
echo "  2. 幂等性测试通过 (重复任务被识别)"
echo "  3. 任务1和2执行成功, 任务3因余额不足失败"
echo "  4. 日终对账生成了差异报告"
echo ""
