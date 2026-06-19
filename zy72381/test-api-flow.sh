#!/bin/bash
# 桥面热胀伸缩估算 - 端到端 API 测试脚本
# 覆盖：重置 → 查初始状态 → 导入 → 人工修正 → 补录 → 重算 → 异常表 → 验证一致性

BASE_URL="http://localhost:3001"
passed=0
failed=0
total=0

echo "=============================================="
echo "  桥面热胀伸缩估算 - API 端到端测试"
echo "=============================================="

step() {
  total=$((total + 1))
  echo ""
  echo "[$total] $1"
  echo "----------------------------------------------"
}

assert_eq() {
  local name="$1"
  local expected="$2"
  local actual="$3"
  
  if [ "$expected" = "$actual" ]; then
    echo "  ✓ $name: $actual"
    passed=$((passed + 1))
  else
    echo "  ✗ $name: 期望 $expected，实际 $actual"
    failed=$((failed + 1))
  fi
}

assert_contains() {
  local name="$1"
  local needle="$2"
  local haystack="$3"
  
  if echo "$haystack" | grep -q "$needle"; then
    echo "  ✓ $name: 包含 '$needle'"
    passed=$((passed + 1))
  else
    echo "  ✗ $name: 不包含 '$needle'"
    echo "    实际内容: $haystack"
    failed=$((failed + 1))
  fi
}

# 检查服务器是否运行
step "检查 API 服务器是否运行"
if curl -s --noproxy localhost "$BASE_URL/api/records" > /dev/null 2>&1; then
  echo "  ✓ API 服务器运行正常"
  passed=$((passed + 1))
else
  echo "  ✗ API 服务器未运行，请先启动：node api/server.js"
  exit 1
fi
total=$((total + 1))

# 步骤1：重置数据
step "步骤1：重置演示数据"
reset_result=$(curl -s --noproxy localhost -X POST "$BASE_URL/api/reset")
assert_contains "重置响应" "演示数据已重置" "$reset_result"

# 步骤2：检查初始记录数
step "步骤2：检查初始状态 - 记录数"
records=$(curl -s --noproxy localhost "$BASE_URL/api/records")
record_count=$(echo "$records" | python3 -c "import sys, json; print(len(json.load(sys.stdin)))" 2>/dev/null)
assert_eq "记录总数" "3" "$record_count"

# 步骤3：检查 REC-002 初始状态（应该已经是人工修正完成）
step "步骤3：验证 REC-002 初始数据一致性"
rec002=$(echo "$records" | python3 -c "
import sys, json
records = json.load(sys.stdin)
for r in records:
    if r['recordNo'] == 'REC-002':
        print(json.dumps(r, ensure_ascii=False))
        break
")

rec002_status=$(echo "$rec002" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
rec002_dir=$(echo "$rec002" | python3 -c "import sys, json; print(json.load(sys.stdin)['directionMark'])" 2>/dev/null)
rec002_est=$(echo "$rec002" | python3 -c "import sys, json; print(json.load(sys.stdin)['estimatedValue'])" 2>/dev/null)

assert_eq "REC-002 状态" "manual_corrected" "$rec002_status"
assert_eq "REC-002 方向标记" "负方向" "$rec002_dir"
assert_eq "REC-002 估算值" "-17.76" "$rec002_est"

# 步骤4：检查 REC-002 的操作历史是否包含改前/改后/原因
step "步骤4：验证 REC-002 操作历史"
op_history=$(echo "$rec002" | python3 -c "
import sys, json
rec = json.load(sys.stdin)
ops = [op for op in rec['operationHistory'] if op['type'] == 'correct']
if ops:
    print(json.dumps(ops[0], ensure_ascii=False))
")

has_old=$(echo "$op_history" | python3 -c "import sys, json; print('oldValue' in json.load(sys.stdin))" 2>/dev/null)
has_new=$(echo "$op_history" | python3 -c "import sys, json; print('newValue' in json.load(sys.stdin))" 2>/dev/null)
has_reason=$(echo "$op_history" | python3 -c "import sys, json; print('reason' in json.load(sys.stdin))" 2>/dev/null)
reason_text=$(echo "$op_history" | python3 -c "import sys, json; print(json.load(sys.stdin).get('reason', ''))" 2>/dev/null)
old_val=$(echo "$op_history" | python3 -c "import sys, json; print(json.load(sys.stdin).get('oldValue', ''))" 2>/dev/null)
new_val=$(echo "$op_history" | python3 -c "import sys, json; print(json.load(sys.stdin).get('newValue', ''))" 2>/dev/null)

assert_eq "有改前值" "True" "$has_old"
assert_eq "有改后值" "True" "$has_new"
assert_eq "有修改原因" "True" "$has_reason"
assert_eq "改前值" "向左" "$old_val"
assert_eq "改后值" "负方向" "$new_val"
assert_contains "原因内容" "现场师傅口径不规范" "$reason_text"

# 步骤5：检查异常工况表
step "步骤5：验证异常工况表与记录一致"
exceptions=$(curl -s --noproxy localhost "$BASE_URL/api/exceptions")

exc002=$(echo "$exceptions" | python3 -c "
import sys, json
excs = json.load(sys.stdin)
for e in excs:
    if e['recordNo'] == 'REC-002':
        print(json.dumps(e, ensure_ascii=False))
        break
")

exc002_status=$(echo "$exc002" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
exc002_type=$(echo "$exc002" | python3 -c "import sys, json; print(json.load(sys.stdin)['exceptionType'])" 2>/dev/null)
exc002_desc=$(echo "$exc002" | python3 -c "import sys, json; print(json.load(sys.stdin)['description'])" 2>/dev/null)
exc002_op=$(echo "$exc002" | python3 -c "import sys, json; print(json.load(sys.stdin)['operator'])" 2>/dev/null)

assert_eq "REC-002 异常状态" "resolved" "$exc002_status"
assert_eq "REC-002 异常类型" "direction_mismatch" "$exc002_type"
assert_eq "REC-002 异常处理人" "何工" "$exc002_op"
assert_contains "异常描述包含修正信息" "何工人工修正" "$exc002_desc"
assert_contains "异常描述包含原因" "现场师傅口径不规范" "$exc002_desc"

# 步骤6：测试导入新记录（模拟第一次导入）
step "步骤6：测试导入温度校准记录"
import_data='[
  { "startTemp": 22.0, "endTemp": 36.5, "tempDiff": 14.5, "directionMark": "向左", "sensorId": null },
  { "startTemp": 24.0, "endTemp": 38.0, "tempDiff": 14.0, "directionMark": "正方向", "sensorId": "SNS-BR-001" }
]'

import_result=$(curl -s --noproxy localhost -X POST "$BASE_URL/api/records/import" \
  -H "Content-Type: application/json" \
  -d "$import_data")

import_count=$(echo "$import_result" | python3 -c "import sys, json; print(json.load(sys.stdin)['imported'])" 2>/dev/null)
assert_eq "导入记录数" "2" "$import_count"

# 获取新导入的记录
records_after_import=$(curl -s --noproxy localhost "$BASE_URL/api/records")

# 找到刚导入的"向左"记录
new_left_rec=$(echo "$records_after_import" | python3 -c "
import sys, json
records = json.load(sys.stdin)
for r in records:
    if r['directionMark'] == '向左' and r['status'] == 'pending_review':
        print(json.dumps(r, ensure_ascii=False))
        break
")

new_left_id=$(echo "$new_left_rec" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
new_left_status=$(echo "$new_left_rec" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
new_left_est=$(echo "$new_left_rec" | python3 -c "import sys, json; print(json.load(sys.stdin).get('estimatedValue', 'null'))" 2>/dev/null)

assert_eq "新导入向左记录状态" "pending_review" "$new_left_status"
assert_eq "新导入向左记录估算值" "null" "$new_left_est"

# 步骤7：验证导入后异常表自动生成
step "步骤7：验证导入后异常表自动生成"
exceptions_after=$(curl -s --noproxy localhost "$BASE_URL/api/exceptions")

new_exc=$(echo "$exceptions_after" | python3 -c "
import sys, json
excs = json.load(sys.stdin)
for e in excs:
    if e['exceptionType'] == 'direction_mismatch' and e['status'] == 'pending_review':
        print(json.dumps(e, ensure_ascii=False))
        break
")

new_exc_status=$(echo "$new_exc" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
new_exc_desc=$(echo "$new_exc" | python3 -c "import sys, json; print(json.load(sys.stdin)['description'])" 2>/dev/null)

assert_eq "新方向异常状态" "pending_review" "$new_exc_status"
assert_contains "新方向异常描述" "向左" "$new_exc_desc"

# 步骤8：人工修正方向
step "步骤8：测试人工修正方向（含原因）"
correct_result=$(curl -s --noproxy localhost -X POST "$BASE_URL/api/records/$new_left_id/correct" \
  -H "Content-Type: application/json" \
  -d '{"newDirection": "负方向", "reason": "测试验证：向左就是负方向，已与现场确认"}')

correct_status=$(echo "$correct_result" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
correct_dir=$(echo "$correct_result" | python3 -c "import sys, json; print(json.load(sys.stdin)['directionMark'])" 2>/dev/null)
correct_est=$(echo "$correct_result" | python3 -c "import sys, json; print(json.load(sys.stdin)['estimatedValue'])" 2>/dev/null)

assert_eq "修正后状态" "manual_corrected" "$correct_status"
assert_eq "修正后方向" "负方向" "$correct_dir"
assert_eq "修正后估算值" "-17.4" "$correct_est"

# 步骤9：验证修正后异常表同步更新
step "步骤9：验证修正后异常表同步更新"
exceptions_after_correct=$(curl -s --noproxy localhost "$BASE_URL/api/exceptions")
exc_after_correct=$(echo "$exceptions_after_correct" | python3 -c "
import sys, json
excs = json.load(sys.stdin)
matching = [e for e in excs if e['recordId'] == '$new_left_id']
if matching:
    print(json.dumps(matching[0], ensure_ascii=False))
")

exc_after_status=$(echo "$exc_after_correct" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
exc_after_desc=$(echo "$exc_after_correct" | python3 -c "import sys, json; print(json.load(sys.stdin)['description'])" 2>/dev/null)

assert_eq "修正后异常状态" "resolved" "$exc_after_status"
assert_contains "修正后异常描述含原因" "测试验证" "$exc_after_desc"

# 步骤10：补录传感器
step "步骤10：测试补录传感器编号"
supplement_result=$(curl -s --noproxy localhost -X POST "$BASE_URL/api/records/$new_left_id/supplement" \
  -H "Content-Type: application/json" \
  -d '{"sensorNo": "SNS-BR-003"}')

supp_status=$(echo "$supplement_result" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
supp_sensor=$(echo "$supplement_result" | python3 -c "import sys, json; print(json.load(sys.stdin)['sensorId'])" 2>/dev/null)

assert_eq "补录后状态" "supplemented" "$supp_status"
assert_eq "补录后传感器" "SNS-BR-003" "$supp_sensor"

# 步骤11：验证补录后异常表更新
step "步骤11：验证补录后异常表同步更新"
exceptions_after_supp=$(curl -s --noproxy localhost "$BASE_URL/api/exceptions")
exc_after_supp=$(echo "$exceptions_after_supp" | python3 -c "
import sys, json
excs = json.load(sys.stdin)
matching = [e for e in excs if e['recordId'] == '$new_left_id' and e['exceptionType'] == 'supplemented']
if matching:
    print(json.dumps(matching[0], ensure_ascii=False))
")

exc_supp_status=$(echo "$exc_after_supp" | python3 -c "import sys, json; print(json.load(sys.stdin)['status'])" 2>/dev/null)
exc_supp_desc=$(echo "$exc_after_supp" | python3 -c "import sys, json; print(json.load(sys.stdin)['description'])" 2>/dev/null)

assert_eq "补录后异常状态" "supplemented" "$exc_supp_status"
assert_contains "补录异常描述含传感器" "SNS-BR-003" "$exc_supp_desc"
assert_contains "补录异常描述含旧口径" "2020版旧口径" "$exc_supp_desc"

# 步骤12：验证桥长说明和估算公式
step "步骤12：验证估算口径一致性（100米桥长）"
# 导入一条温差为 10K 的记录，验证 100 米桥长下的结果
import_data_10k='[
  { "startTemp": 20.0, "endTemp": 30.0, "tempDiff": 10.0, "directionMark": "正方向", "sensorId": "SNS-BR-001" }
]'
import_10k=$(curl -s --noproxy localhost -X POST "$BASE_URL/api/records/import" \
  -H "Content-Type: application/json" \
  -d "$import_data_10k")

records_10k=$(curl -s --noproxy localhost "$BASE_URL/api/records")
rec_10k=$(echo "$records_10k" | python3 -c "
import sys, json
records = json.load(sys.stdin)
for r in records:
    if abs(r['tempDiff'] - 10.0) < 0.01 and r['directionMark'] == '正方向':
        print(json.dumps(r, ensure_ascii=False))
        break
")

est_value=$(echo "$rec_10k" | python3 -c "import sys, json; print(json.load(sys.stdin)['estimatedValue'])" 2>/dev/null)

# 10K × 100000mm × 0.000012/K = 12.0 mm
expected="12.0"
est_rounded=$(printf "%.1f" "$est_value" 2>/dev/null)
assert_eq "10℃温差估算值（100米桥长）" "$expected" "$est_rounded"

# 步骤13：汇总结果
echo ""
echo "=============================================="
echo "  测试结果汇总"
echo "=============================================="
echo "  总测试项: $total"
echo "  通过:     $passed"
echo "  失败:     $failed"
echo ""

if [ $failed -eq 0 ]; then
  echo "  ✓ 所有测试通过！"
  echo "=============================================="
  exit 0
else
  echo "  ✗ 有 $failed 个测试失败"
  echo "=============================================="
  exit 1
fi
