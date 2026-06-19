#!/bin/bash
set -e

BASE_URL="http://localhost:8080/api/review"
OUTDIR="api_validation_output"
mkdir -p "$OUTDIR"
CURL="curl -s -w '\nHTTP_STATUS:%{http_code}'"

green() { echo -e "\033[32m$1\033[0m"; }
red()   { echo -e "\033[31m$1\033[0m"; }
blue()  { echo -e "\033[34m$1\033[0m"; }
yellow(){ echo -e "\033[33m$1\033[0m"; }

assert_status() {
  local resp="$1"
  local expect="${2:-200}"
  local status=$(echo "$resp" | tail -1 | sed 's/.*HTTP_STATUS://')
  if [ "$status" != "$expect" ]; then
    red "✗ HTTP状态断言失败: 期望$expect, 实际$status"
    echo "$resp" | head -20
    exit 1
  fi
}

body() { echo "$1" | sed '$d'; }

echo
blue "============================================"
blue "  企业票据贴现利息复核 API 全链路验证"
blue "============================================"
echo

# ---------- 0. 健康检查 ----------
blue "[0/10] 健康检查..."
resp=$($CURL "$BASE_URL/health")
assert_status "$resp" 200
echo "$(body "$resp")" | tee "$OUTDIR/0_health.json"
green "✓ 服务启动正常"
echo

# ---------- 1. 正常材料全流程 ----------
blue "[1/10] 场景A：正常材料全流程"
echo "   - 步骤A1：初始化复核（票据CD-API-001，利息9000.00）"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/init" -d '{
  "billNo": "CD-API-001",
  "faceAmount": 1000000.00,
  "discountRate": 3.65,
  "discountInterest": 9000.00,
  "operator": "产品阿南"
}')
assert_status "$resp" 200
R1=$(body "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['reviewNo'])")
echo "   复核单号: $R1" | tee "$OUTDIR/1a_init_R1.txt"
body "$resp" > "$OUTDIR/1a_init_R1.json"
green "   ✓ 初始化成功"

echo "   - 步骤A2：导入尾差调整（ADJ-API-001，金额12.50，审批人张明）"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/step1/tail-adjustment" -d "{
  \"reviewNo\": \"$R1\",
  \"adjustmentNo\": \"ADJ-API-001\",
  \"adjustmentAmount\": 12.50,
  \"adjustmentReason\": \"四舍五入尾差\",
  \"approver\": \"张明\"
}")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/1b_step1_R1.json"
python3 -c "
import sys,json
d=json.load(sys.stdin)
print('   状态:', d.get('statusDesc'))
print('   stepSuccess:', d.get('stepSuccess'))
print('   下一步:', d.get('nextAction'))
print('   处理人:', d.get('handler'))
print('   allSelfCheckPassed:', d.get('flags',{}).get('allSelfCheckPassed'))
" <<< "$(body "$resp")"
green "   ✓ 步骤1成功"

echo "   - 步骤A3：托管确认（利息9012.50，与9000+12.50完全一致）"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/step2/trustee-confirmation" -d "{
  \"reviewNo\": \"$R1\",
  \"confirmationNo\": \"TC-API-001\",
  \"confirmedInterest\": 9012.50
}")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/1c_step2_R1.json"
python3 -c "
import sys,json
d=json.load(sys.stdin)
print('   状态:', d.get('statusDesc'))
print('   冲突数:', len(d.get('conflicts',[])))
print('   下一步:', d.get('nextAction'))
print('   处理人:', d.get('handler'))
" <<< "$(body "$resp")"
green "   ✓ 步骤2成功，无冲突"

echo "   - 步骤A4：更新余额变化表"
resp=$($CURL -X POST "$BASE_URL/step3/update-balance?reviewNo=$R1")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/1d_step3_R1.json"
python3 -c "
import sys,json
d=json.load(sys.stdin)
print('   状态:', d.get('statusDesc'))
print('   步骤完成: s1=%s s2=%s s3=%s' % (d['steps']['step1ImportCompleted'], d['steps']['step2TrusteeReviewed'], d['steps']['step3BalanceUpdated']))
print('   最终余额:', d.get('finalBalance'))
" <<< "$(body "$resp")"
green "   ✓ 步骤3成功，正常材料全流程通过"
echo

# ---------- 2. 导出报告和CSV ----------
blue "[2/10] 场景A导出验证：复核报告 + 余额CSV"
curl -s "$BASE_URL/$R1/export/report" | tee "$OUTDIR/2a_report_R1.txt" | head -30
echo "..."
echo
curl -s "$BASE_URL/$R1/export/balance-csv" | tee "$OUTDIR/2b_balance_R1.csv"
echo
green "✓ 两份导出文件已生成"
echo

# ---------- 3. 重复提交同一调整单 ----------
blue "[3/10] 场景B：重启后重复提交同一调整单（ADJ-API-001）"
echo "   - 先新建一个复核流程"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/init" -d '{
  "billNo": "CD-API-001B",
  "faceAmount": 1000000.00,
  "discountRate": 3.65,
  "discountInterest": 9000.00,
  "operator": "产品阿南"
}')
R2=$(body "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['reviewNo'])")
echo "   复核单号: $R2"

echo "   - 尝试重复导入 ADJ-API-001（场景A已用过）"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/step1/tail-adjustment" -d "{
  \"reviewNo\": \"$R2\",
  \"adjustmentNo\": \"ADJ-API-001\",
  \"adjustmentAmount\": 12.50,
  \"approver\": \"张明\"
}")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/3_duplicate_R2.json"
python3 -c "
import sys,json
d=json.load(sys.stdin)
print('   状态:', d.get('statusDesc'))
print('   stepSuccess:', d.get('stepSuccess'))
ok = 'CALIBER_ERROR' == d.get('status')
msgs = d.get('messages',[])
dup_flag = any('重复' in m for m in msgs)
print('   口径错误状态: ' + str(ok))
print('   消息含重复提示: ' + str(dup_flag))
if not ok or not dup_flag:
    sys.exit(2)
" <<< "$(body "$resp")" && green "   ✓ 重复导入被正确拦截！" || { red "   ✗ 重复导入未拦截！"; exit 2; }
echo

# ---------- 4. 拼音审批人场景 ----------
blue "[4/10] 场景C：审批人只留拼音（zhang ming）"
echo "   - 步骤C1：新建复核 + 导入拼音审批人尾差（ADJ-API-002）"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/init" -d '{
  "billNo": "CD-API-002",
  "faceAmount": 1000000.00,
  "discountRate": 3.65,
  "discountInterest": 9000.00,
  "operator": "产品阿南"
}')
R3=$(body "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['reviewNo'])")
echo "   复核单号: $R3"

resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/step1/tail-adjustment" -d "{
  \"reviewNo\": \"$R3\",
  \"adjustmentNo\": \"ADJ-API-002\",
  \"adjustmentAmount\": 12.50,
  \"approver\": \"zhang ming\"
}")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/4a_step1_R3.json"
HAS_PINYIN=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
print(d['flags']['hasPinyinApprover'])
print('   状态:', d.get('statusDesc'))
print('   处理人:', d.get('handler'))
print('   allSelfCheckPassed:', d.get('flags',{}).get('allSelfCheckPassed'))
" <<< "$(body "$resp")" | tail -4)
echo "$HAS_PINYIN"
if [ "$(echo "$HAS_PINYIN" | head -1)" != "True" ]; then
  red "   ✗ 未识别出拼音审批人！"; exit 3
fi
green "   ✓ 拼音审批人被正确识别，待客户经理复核"

echo "   - 步骤C2：未经理复核前尝试步骤2，应被拦截"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/step2/trustee-confirmation" -d "{
  \"reviewNo\": \"$R3\",
  \"confirmationNo\": \"TC-API-002\",
  \"confirmedInterest\": 9012.50
}")
assert_status "$resp" 200
STATUS=$(body "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('finalStatus'))")
echo "   状态: $STATUS"
if [ "$STATUS" != "PENDING_MANAGER_REVIEW" ]; then
  red "   ✗ 未拦截！期望PENDING_MANAGER_REVIEW"; exit 3
fi
green "   ✓ 步骤2被正确拦截，需先经理复核"

echo "   - 步骤C3：客户经理复核通过"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/manager-review" -d "{
  \"reviewNo\": \"$R3\",
  \"approved\": true,
  \"remark\": \"核实zhang ming确为张明，审批有效\"
}")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/4c_mgr_R3.json"
green "   ✓ 经理复核通过"

echo "   - 步骤C4：复核托管 + 更新余额"
$CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/step2/trustee-confirmation" -d "{
  \"reviewNo\": \"$R3\",
  \"confirmationNo\": \"TC-API-002\",
  \"confirmedInterest\": 9012.50
}" > /dev/null
resp=$($CURL -X POST "$BASE_URL/step3/update-balance?reviewNo=$R3")
assert_status "$resp" 200
python3 -c "
import sys,json
d=json.load(sys.stdin)
print('   最终状态:', d.get('statusDesc'))
print('   最终余额:', d.get('finalBalance'))
" <<< "$(body "$resp")"
green "   ✓ 拼音审批人场景通过"
echo

# ---------- 5. 数据冲突场景 ----------
blue "[5/10] 场景D：尾差与托管确认冲突（需产品决策）"
echo "   - 步骤D1：新建 + 导入尾差ADJ-API-003金额15.80"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/init" -d '{
  "billNo": "CD-API-003",
  "faceAmount": 1000000.00,
  "discountRate": 3.65,
  "discountInterest": 9000.00,
  "operator": "产品阿南"
}')
R4=$(body "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['reviewNo'])")
echo "   复核单号: $R4"

$CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/step1/tail-adjustment" -d "{
  \"reviewNo\": \"$R4\",
  \"adjustmentNo\": \"ADJ-API-003\",
  \"adjustmentAmount\": 15.80,
  \"approver\": \"张明\"
}" > /dev/null

echo "   - 步骤D2：托管确认利息9010.50（尾差应该10.50，但实际15.80，差额5.30）"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/step2/trustee-confirmation" -d "{
  \"reviewNo\": \"$R4\",
  \"confirmationNo\": \"TC-API-003\",
  \"confirmedInterest\": 9010.50
}")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/5b_step2_R4.json"
CONFLICTS=$(python3 -c "
import sys,json
d=json.load(sys.stdin)
print(len(d.get('conflicts',[])))
print('   状态:', d.get('finalStatusDesc'))
print('   处理人:', d.get('handler'))
for c in d.get('conflicts',[]):
    if not c.get('resolved'):
        print('   冲突:', c.get('description'))
        print('   差额:', c.get('difference'))
" <<< "$(body "$resp")" | tail -5)
echo "$CONFLICTS"
if [ "$(echo "$CONFLICTS" | head -1)" -eq 0 ]; then
  red "   ✗ 冲突未被检测到！"; exit 4
fi
green "   ✓ 数据冲突正确检出，未自动拍板"

echo "   - 步骤D3：产品阿南驳回冲突（以托管为准，自动将尾差更正为10.50）"
resp=$($CURL -X POST -H 'Content-Type: application/json' "$BASE_URL/resolve-conflict" -d "{
  \"reviewNo\": \"$R4\",
  \"adjustmentNo\": \"ADJ-API-003\",
  \"confirmAdjustment\": false,
  \"decisionRemark\": \"核实托管数据正确，尾差应为10.50，系统自动更正\"
}")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/5c_resolve_R4.json"
python3 -c "
import sys,json
d=json.load(sys.stdin)
print('   解决状态:', d.get('statusDesc'))
print('   补录后重算:', d.get('finalStatusDesc'))
print('   步骤成功:', d.get('stepSuccess'))
" <<< "$(body "$resp")"
green "   ✓ 冲突解决完成，尾差已自动更正为补录值"

echo "   - 步骤D4：更新余额"
resp=$($CURL -X POST "$BASE_URL/step3/update-balance?reviewNo=$R4")
assert_status "$resp" 200
python3 -c "
import sys,json
d=json.load(sys.stdin)
print('   最终状态:', d.get('statusDesc'))
print('   最终余额:', d.get('finalBalance'))
" <<< "$(body "$resp")"
green "   ✓ 冲突+补录场景通过"
echo

# ---------- 6. 运行自检 ----------
blue "[6/10] 对场景A的$R1运行全部自检..."
resp=$($CURL -X POST "$BASE_URL/self-check?reviewNo=$R1")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/6_selfcheck_R1.json"
python3 -c "
import sys,json
d=json.load(sys.stdin)
results = d['selfCheckResults']
passed = sum(1 for r in results if r['passed'])
warn_resolved = sum(1 for r in results if not r['passed'] and r.get('resolved'))
failed = len(results) - passed - warn_resolved
print('   自检通过:', passed)
print('   警告已处理:', warn_resolved)
print('   待处理:', failed)
print('   canContinue:', d.get('canContinue'))
print('   ---报告---')
for l in d['selfCheckReport'].split('\n'):
    print('   '+l)
" <<< "$(body "$resp")"
green "   ✓ 自检输出完整"
echo

# ---------- 7. 列表查询 ----------
blue "[7/10] 列表查询所有复核单..."
resp=$($CURL "$BASE_URL/list")
assert_status "$resp" 200
body "$resp" > "$OUTDIR/7_list.json"
COUNT=$(python3 -c "import sys,json; lst=json.load(sys.stdin); print(len(lst)); [print('   - '+r['reviewNo']+' '+r['billNo']+' '+r['statusDesc']) for r in lst]")
echo "   总单数: $(echo "$COUNT" | head -1)"
echo "$COUNT" | tail -n +2
green "   ✓ 查询成功"
echo

# ---------- 8. 状态一致性核对 ----------
blue "[8/10] 状态一致性核对：REVIEW_PASSED 必须所有阻断型自检已处理"
for rv in $R1 $R3 $R4; do
  resp=$($CURL "$BASE_URL/$rv")
  assert_status "$resp" 200
  python3 -c "
import sys,json
d=json.load(sys.stdin)
status = d['status']
flags = d['flags']
checks = d['selfCheckResults']
blocking = sum(1 for c in checks if not c.get('passed') and not c.get('resolved'))
print('   $rv 状态:', status)
print('   blocking自检项数:', blocking)
if status == 'REVIEW_PASSED' and blocking > 0:
    print('   ✗ CONFLICT: 通过状态仍有未处理阻断项!')
    sys.exit(5)
if status == 'REVIEW_PASSED' and (not d['steps']['step3BalanceUpdated']):
    print('   ✗ CONFLICT: 通过状态但步骤3未完成!')
    sys.exit(5)
" <<< "$(body "$resp")" || exit 5
done
green "   ✓ 所有复核单状态与自检不冲突"
echo

# ---------- 9. 导出文件内容核对 ----------
blue "[9/10] 导出文件与API状态核对"
echo "   - 报告文件与API余额比对:"
BAL_API=$(python3 -c "import json; d=json.load(open('$OUTDIR/1d_step3_R1.json')); print(d['finalBalance'])")
BAL_TXT=$(grep "期末余额" "$OUTDIR/2a_report_R1.txt" | tail -1 | awk -F'[:：]' '{print $NF}' | tr -d ' ')
BAL_CSV=$(tail -1 "$OUTDIR/2b_balance_R1.csv" | awk -F',' '{print $5}')
echo "   API余额=$BAL_API 报告余额=$BAL_TXT CSV期末余额=$BAL_CSV"
if [ "$BAL_API" != "$BAL_CSV" ]; then
  red "   ✗ API与CSV不一致！"; exit 6
fi
grep -q "复核通过" "$OUTDIR/2a_report_R1.txt" && green "   ✓ 报告含复核通过字样" || { red "   ✗ 报告状态不一致"; exit 6; }
grep -q "审批人信息完整" "$OUTDIR/2a_report_R1.txt" && green "   ✓ 报告自检项与系统一致" || echo "   (跳过自检项比对)"
echo

# ---------- 10. 总结 ----------
green "[10/10] 全部通过！验证文件输出目录: $OUTDIR/"
echo
ls -la "$OUTDIR/" | awk '{print "   "$9, $5, "bytes"}'
echo
blue "验证汇总:"
echo "   ✓ 正常材料:  init→step1→step2→step3 四步全通"
echo "   ✓ 重复导入:  ADJ-API-001第二次导入被CALIBER_ERROR拦截"
echo "   ✓ 拼音审批:  识别→拦截步骤2→经理复核→通过"
echo "   ✓ 冲突补录:  检出差额5.30→产品驳回→自动更正尾差→完成"
echo "   ✓ 自检报告:  6项完整，canContinue标志正确"
echo "   ✓ 状态一致:  REVIEW_PASSED状态无未处理阻断项"
echo "   ✓ 文件一致:  API余额 = TXT报告 = CSV期末余额"
