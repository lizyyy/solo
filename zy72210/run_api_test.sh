#!/bin/bash
set -e

PORT=8089
BASE="http://localhost:$PORT/api/review"
WORKDIR="/Users/lzy/pro/solo/workspaces/zy72210"
OUTDIR="$WORKDIR/output_api"
DATADIR="$WORKDIR/data"
JAR="$WORKDIR/target/financial-interest-review-1.0.0.jar"

rm -rf "$OUTDIR" "$DATADIR"
mkdir -p "$OUTDIR"

echo "=============================="
echo "[1] 启动Spring Boot服务 (port=$PORT)"
echo "=============================="
cd "$WORKDIR"
java -jar "$JAR" --server.port=$PORT > "$OUTDIR/spring.log" 2>&1 &
SERVER_PID=$!
echo "服务PID: $SERVER_PID"

for i in {1..30}; do
  sleep 2
  if curl -sf "$BASE/health" > /dev/null 2>&1; then
    echo "服务启动成功 ($((i*2))秒)"
    break
  fi
done

echo ""
echo "=============================="
echo "[2] 健康检查 + 初始数据"
echo "=============================="
curl -s "$BASE/health" | python3 -m json.tool

echo ""
echo "=============================="
echo "[3] 场景A：正常材料全流程 + 重复提交"
echo "=============================="
echo ">> 步骤0：初始化复核"
REV_A=$(curl -s -X POST "$BASE/init" \
  -H "Content-Type: application/json" \
  -d '{
    "billNo": "CD20260619A001",
    "billType": "银行承兑汇票",
    "faceAmount": 1000000.00,
    "discountRate": 3.65,
    "discountInterest": 9000.00,
    "operator": "operator_anan_01"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['reviewNo'])")
echo "  复核单号A: $REV_A"
echo "  详情："
curl -s "$BASE/$REV_A" | python3 -m json.tool | head -25

echo ""
echo ">> 步骤1：尾差调整导入（审批人=张明 完整中文名）"
curl -s -X POST "$BASE/step1/tail-adjustment" \
  -H "Content-Type: application/json" \
  -d "{
    \"reviewNo\": \"$REV_A\",
    \"adjustmentNo\": \"ADJ-20260619-001\",
    \"billNo\": \"CD20260619A001\",
    \"adjustmentAmount\": 12.50,
    \"adjustmentReason\": \"四舍五入尾差调整\",
    \"approver\": \"张明\",
    \"importBatchNo\": \"BATCH-API-001\"
  }" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  结果:', '成功' if r.get('stepSuccess') else '需人工介入')
print('  状态:', r.get('statusDesc'))
print('  消息:', '; '.join(r.get('messages', [])))
print('  下一步:', r.get('nextAction'))
print('  处理人:', r.get('handler'))
"

echo ""
echo ">> 步骤1重复提交：同一调整单号再次导入（验证重复检测）"
curl -s -X POST "$BASE/step1/tail-adjustment" \
  -H "Content-Type: application/json" \
  -d "{
    \"reviewNo\": \"$REV_A\",
    \"adjustmentNo\": \"ADJ-20260619-001\",
    \"billNo\": \"CD20260619A001\",
    \"adjustmentAmount\": 12.50,
    \"approver\": \"张明\"
  }" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  重复检测触发:', '是' if not r.get('stepSuccess') else '否')
print('  状态:', r.get('statusDesc'))
print('  消息:', '; '.join(r.get('messages', [])))
"

echo ""
echo ">> 步骤2：托管确认（利息9012.50 = 系统9000 + 尾差12.50）"
curl -s -X POST "$BASE/step2/trustee-confirmation" \
  -H "Content-Type: application/json" \
  -d "{
    \"reviewNo\": \"$REV_A\",
    \"confirmationNo\": \"TC-20260619-001\",
    \"billNo\": \"CD20260619A001\",
    \"confirmedInterest\": 9012.50,
    \"confirmedBalance\": 9012.50,
    \"trustee\": \"中国工商银行托管部\",
    \"confirmationStatus\": \"已确认\"
  }" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  结果:', '成功' if r.get('stepSuccess') else '需人工介入')
print('  状态:', r.get('statusDesc'))
print('  消息:', '; '.join(r.get('messages', [])))
print('  冲突数:', len(r.get('conflicts', [])))
"

echo ""
echo ">> 步骤3：余额变化表更新"
curl -s -X POST "$BASE/step3/update-balance" \
  -d "reviewNo=$REV_A" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  结果:', '成功' if r.get('stepSuccess') else '失败')
print('  状态:', r.get('statusDesc'))
print('  最终余额:', r.get('finalBalance'))
print('  消息:', '; '.join(r.get('messages', [])))
"

echo ""
echo ">> 场景A运行自检"
curl -s -X POST "$BASE/self-check" -d "reviewNo=$REV_A" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  是否可继续:', r.get('canContinue'))
print('  报告预览:')
for line in r.get('selfCheckReport', '').split('\n')[:8]:
    print('   ', line)
"

echo ""
echo ">> 场景A导出：复核报告 + 余额CSV"
curl -s "$BASE/$REV_A/export/report" > "$OUTDIR/${REV_A}_复核报告.txt"
curl -s "$BASE/$REV_A/export/balance-csv" > "$OUTDIR/${REV_A}_余额变化表.csv"
echo "  复核报告已导出：$OUTDIR/${REV_A}_复核报告.txt ($(wc -c < "$OUTDIR/${REV_A}_复核报告.txt")字节)"
echo "  余额CSV已导出：$OUTDIR/${REV_A}_余额变化表.csv ($(wc -c < "$OUTDIR/${REV_A}_余额变化表.csv")字节)"

echo ""
echo "=============================="
echo "[4] 场景B：冲突材料（尾差15.80 vs 托管9010.50） + 产品决策 + 补录"
echo "=============================="
echo ">> 步骤0：初始化 + 步骤1导入（拼音审批人zhang ming + 冲突尾差金额15.80）"
REV_B=$(curl -s -X POST "$BASE/init" \
  -H "Content-Type: application/json" \
  -d '{
    "billNo": "CD20260619B002",
    "faceAmount": 500000.00,
    "discountRate": 3.65,
    "discountInterest": 9000.00,
    "operator": "operator_anan_02"
  }' | python3 -c "import sys,json; print(json.load(sys.stdin)['reviewNo'])")
echo "  复核单号B: $REV_B"

curl -s -X POST "$BASE/step1/tail-adjustment" \
  -H "Content-Type: application/json" \
  -d "{
    \"reviewNo\": \"$REV_B\",
    \"adjustmentNo\": \"ADJ-20260619-002\",
    \"billNo\": \"CD20260619B002\",
    \"adjustmentAmount\": 15.80,
    \"adjustmentReason\": \"计算尾差\",
    \"approver\": \"zhang ming\",
    \"importBatchNo\": \"BATCH-API-002\"
  }" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  步骤1结果:', '成功' if r.get('stepSuccess') else '需人工介入')
print('  状态:', r.get('statusDesc'))
print('  拼音标记:', r.get('flags', {}).get('hasPinyinApprover'))
print('  消息:', '; '.join(r.get('messages', [])))
"

echo ""
echo ">> 客户经理复核拼音审批人（确认zhang ming = 张明）"
curl -s -X POST "$BASE/manager-review" \
  -H "Content-Type: application/json" \
  -d "{
    \"reviewNo\": \"$REV_B\",
    \"approved\": true,
    \"remark\": \"已核实zhang ming确为张明，审批有效\"
  }" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  经理复核:', '通过' if r.get('stepSuccess') else '驳回')
print('  状态:', r.get('statusDesc'))
print('  下一步:', r.get('nextAction'))
"

echo ""
echo ">> 步骤2：托管确认（故意设为9010.50，产生冲突：9000+15.80=9015.80 vs 9010.50，差5.30）"
curl -s -X POST "$BASE/step2/trustee-confirmation" \
  -H "Content-Type: application/json" \
  -d "{
    \"reviewNo\": \"$REV_B\",
    \"confirmationNo\": \"TC-20260619-002\",
    \"billNo\": \"CD20260619B002\",
    \"confirmedInterest\": 9010.50,
    \"confirmedBalance\": 9010.50,
    \"trustee\": \"中国工商银行托管部\",
    \"confirmationStatus\": \"已确认\"
  }" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  托管复核:', '成功' if r.get('stepSuccess') else '冲突待处理')
print('  状态:', r.get('statusDesc'))
print('  未解决冲突:', r.get('flags', {}).get('hasUnresolvedConflicts'))
print('  冲突证据:')
for c in r.get('conflicts', []):
    if not c.get('resolved'):
        print('   ', c.get('conflictType'), '差额=', c.get('difference'))
        print('   ', c.get('description'))
"

echo ""
echo ">> 支付平台产品阿南决策：驳回，以托管为准（尾差自动更正为10.50）"
curl -s -X POST "$BASE/resolve-conflict" \
  -H "Content-Type: application/json" \
  -d "{
    \"reviewNo\": \"$REV_B\",
    \"adjustmentNo\": \"ADJ-20260619-002\",
    \"confirmAdjustment\": false,
    \"decisionRemark\": \"经核实托管数据无误，驳回尾差调整，尾差自动改为托管差额10.50\"
  }" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  冲突处理:', '成功' if r.get('stepSuccess') else '失败')
print('  状态:', r.get('statusDesc'))
print('  未解决冲突:', r.get('flags', {}).get('hasUnresolvedConflicts'))
"

echo ""
echo ">> 补录材料验证：运行自检（补录后重算应一致：9000+10.50=9010.50=托管）"
curl -s -X POST "$BASE/self-check" -d "reviewNo=$REV_B" | python3 -c "
import sys,json
r = json.load(sys.stdin)
results = r.get('selfCheckResults', [])
print('  是否可继续:', r.get('canContinue'))
pass_cnt = sum(1 for x in results if x.get('passed'))
warn_resolved = sum(1 for x in results if not x.get('passed') and x.get('resolved'))
fail_cnt = len(results) - pass_cnt - warn_resolved
print(f'  自检结果: 通过{pass_cnt}项, 已处理{warn_resolved}项, 待处理{fail_cnt}项')
for x in results:
    status = '✓通过' if x.get('passed') else ('△已处理' if x.get('resolved') else '✗待处理')
    desc = x.get('checkItemDescription') or x.get('checkItemName') or '未知项'
    print(f'   {status} {desc}: {x.get(\"message\")}')
    if x.get('resolutionRemark'):
        print(f'       处理说明: {x.get(\"resolutionRemark\")}')
"

echo ""
echo ">> 步骤3：余额更新"
curl -s -X POST "$BASE/step3/update-balance" \
  -d "reviewNo=$REV_B" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  余额更新:', '成功' if r.get('stepSuccess') else '失败')
print('  状态:', r.get('statusDesc'))
print('  最终余额:', r.get('finalBalance'))
"

echo ""
echo ">> 场景B导出"
curl -s "$BASE/$REV_B/export/report" > "$OUTDIR/${REV_B}_复核报告.txt"
curl -s "$BASE/$REV_B/export/balance-csv" > "$OUTDIR/${REV_B}_余额变化表.csv"
echo "  复核报告：$OUTDIR/${REV_B}_复核报告.txt"
echo "  余额CSV：$OUTDIR/${REV_B}_余额变化表.csv"

echo ""
echo "=============================="
echo "[5] 停止服务 → 重启 → 验证持久化：重复导入记录/上下文是否存在"
echo "=============================="
echo "  停止服务PID $SERVER_PID"
kill $SERVER_PID 2>/dev/null || true
sleep 3
echo "  磁盘持久化文件："
ls -la "$DATADIR" 2>/dev/null
find "$DATADIR" -type f 2>/dev/null | while read f; do echo "   $f ($(wc -c < "$f")字节)"; done

echo ""
echo "  重启服务（加载磁盘数据）..."
java -jar "$JAR" --server.port=$PORT > "$OUTDIR/spring_after_restart.log" 2>&1 &
SERVER_PID2=$!
for i in {1..30}; do
  sleep 2
  if curl -sf "$BASE/health" > /dev/null 2>&1; then
    echo "  服务重启成功（PID=$SERVER_PID2, $((i*2))秒）"
    break
  fi
done

echo ""
echo "  重启后健康检查（验证导入记录数量）："
curl -s "$BASE/health" | python3 -m json.tool

echo ""
echo "  重启后再次导入ADJ-20260619-001（验证持久化重复检测生效）："
REV_C=$(curl -s -X POST "$BASE/init" \
  -H "Content-Type: application/json" \
  -d '{"billNo": "CD-RESTART-001", "faceAmount": 100000, "discountRate": 3, "discountInterest": 1000, "operator": "operator_after_restart"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['reviewNo'])")
echo "  新复核单号C: $REV_C"

curl -s -X POST "$BASE/step1/tail-adjustment" \
  -H "Content-Type: application/json" \
  -d "{
    \"reviewNo\": \"$REV_C\",
    \"adjustmentNo\": \"ADJ-20260619-001\",
    \"billNo\": \"CD-RESTART-001\",
    \"adjustmentAmount\": 5.00,
    \"approver\": \"李明\"
  }" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  重启后重复检测:', '生效 ✓' if not r.get('stepSuccess') else '未生效 ✗')
print('  状态:', r.get('statusDesc'))
print('  消息:', '; '.join(r.get('messages', [])))
"

echo ""
echo "  重启后加载场景A，查询原始数据是否恢复："
curl -s "$BASE/$REV_A" | python3 -c "
import sys,json
r = json.load(sys.stdin)
print('  场景A状态:', r.get('statusDesc'))
print('  步骤完成情况:', r.get('steps'))
print('  最终余额:', r.get('finalBalance'))
"

echo ""
echo "  重启后查询全部复核列表："
curl -s "$BASE/list" | python3 -m json.tool

echo ""
echo "=============================="
echo "[6] 导出内容核对：场景A/场景B报告 vs API返回"
echo "=============================="
for f in "$OUTDIR"/*_复核报告.txt; do
  echo ">> $(basename $f):"
  head -35 "$f" | sed 's/^/   /'
  echo ""
done

for f in "$OUTDIR"/*_余额变化表.csv; do
  echo ">> $(basename $f):"
  cat "$f" | sed 's/^/   /'
  echo ""
done

echo ""
echo "  停止服务PID $SERVER_PID2"
kill $SERVER_PID2 2>/dev/null || true

echo ""
echo "=============================="
echo "全部API流程完成 ✓"
echo "输出目录: $OUTDIR"
echo "=============================="
