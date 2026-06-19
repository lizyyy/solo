#!/bin/bash
set -e

BASE="http://localhost:3002/api"
PASS=0
FAIL=0

check() {
  local label="$1"
  local actual="$2"
  local expected="$3"
  if echo "$actual" | grep -q "$expected"; then
    echo "✅ $label"
    PASS=$((PASS + 1))
  else
    echo "❌ $label"
    echo "   期望包含: $expected"
    echo "   实际值: $actual"
    FAIL=$((FAIL + 1))
  fi
}

check_not() {
  local label="$1"
  local actual="$2"
  local unexpected="$3"
  if echo "$actual" | grep -q "$unexpected"; then
    echo "❌ $label"
    echo "   不应包含: $unexpected"
    echo "   实际值: $actual"
    FAIL=$((FAIL + 1))
  else
    echo "✅ $label"
    PASS=$((PASS + 1))
  fi
}

echo "========================================"
echo "泵站汽蚀风险计算 - 端到端闭环验证"
echo "维修群截图第一次导入完整流程"
echo "========================================"
echo ""

echo "--- 步骤1: 去重检测 - 新记录 ---"
RESULT1=$(curl --noproxy localhost -s -X POST "$BASE/screenshots/check-duplicate" \
  -H "Content-Type: application/json" \
  -d '{"fileHash":"hash-unique-001","fileName":"维修群截图_新文件.png","currentBatchHashes":[]}')
check "新文件应返回repeatType=new" "$(echo "$RESULT1" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("repeatType",""))')" "new"
check "新文件应返回isDuplicate=false" "$(echo "$RESULT1" | python3 -c 'import sys,json; print(str(json.load(sys.stdin).get("isDuplicate","")).lower())')" "false"

echo ""
echo "--- 步骤2: 去重检测 - 历史重复 ---"
RESULT2=$(curl --noproxy localhost -s -X POST "$BASE/screenshots/check-duplicate" \
  -H "Content-Type: application/json" \
  -d '{"fileHash":"hash-abc123","fileName":"维修群截图_重复上传.png","currentBatchHashes":[]}')
check "历史重复应返回repeatType=historical" "$(echo "$RESULT2" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("repeatType",""))')" "historical"
check "历史重复应返回isDuplicate=true" "$(echo "$RESULT2" | python3 -c 'import sys,json; print(str(json.load(sys.stdin).get("isDuplicate","")).lower())')" "true"

echo ""
echo "--- 步骤3: 去重检测 - 本次重复 ---"
RESULT3=$(curl --noproxy localhost -s -X POST "$BASE/screenshots/check-duplicate" \
  -H "Content-Type: application/json" \
  -d '{"fileHash":"hash-new-batch-001","fileName":"维修群截图_批次内重复.png","currentBatchHashes":["hash-new-batch-001","hash-other"]}')
check "本次重复应返回repeatType=current_batch" "$(echo "$RESULT3" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("repeatType",""))')" "current_batch"
check "本次重复应返回isDuplicate=true" "$(echo "$RESULT3" | python3 -c 'import sys,json; print(str(json.load(sys.stdin).get("isDuplicate","")).lower())')" "true"

echo ""
echo "--- 步骤4: 上传重复截图(历史重复) ---"
RESULT4=$(curl --noproxy localhost -s -X POST "$BASE/screenshots/upload" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"维修群截图_重复上传.png","fileHash":"hash-abc123","fileSize":1024000,"uploader":"user-1","isDuplicate":true,"duplicateOf":"shot-1","repeatType":"historical"}')
DUP_SHOT_ID=$(echo "$RESULT4" | python3 -c 'import sys,json; d=json.load(sys.stdin).get("screenshot",{}); print(d.get("id",""))')
check "重复截图上传成功" "$DUP_SHOT_ID" "shot-"
check "重复截图状态为duplicate" "$(echo "$RESULT4" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("screenshot",{}).get("status",""))')" "duplicate"
check "重复截图repeatType=historical" "$(echo "$RESULT4" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("screenshot",{}).get("repeatType",""))')" "historical"

echo ""
echo "--- 步骤5: 创建汽蚀风险计算(14:30/15:00/16:00 缺15:30) ---"
RESULT5=$(curl --noproxy localhost -s -X POST "$BASE/calculations" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"泵站A-01 维修群第一次导入汽蚀风险计算",
    "pumpId":"pump-a01",
    "screenshotIds":["shot-1","shot-2","shot-3"],
    "samplingIntervalIds":["interval-1"],
    "parameters":{
      "pressure":[0.32,0.30,0.28],
      "flowRate":[120,115,110],
      "temperatures":[25,26,27],
      "sampleTimes":["2024-06-01T14:30:00","2024-06-01T15:00:00","2024-06-01T16:00:00"],
      "missingIntervals":[]
    },
    "status":"draft",
    "remark":"维修群第一次导入，注意15:30缺失半小时数据",
    "createdBy":"user-1"
  }')
CALC_ID=$(echo "$RESULT5" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')
check "计算创建成功" "$CALC_ID" "calc-"

MISSING_COUNT=$(echo "$RESULT5" | python3 -c 'import sys,json; print(len(json.load(sys.stdin).get("parameters",{}).get("missingIntervals",[])))')
check "检测到1个缺失采样点" "$MISSING_COUNT" "1"

MISSING_START=$(echo "$RESULT5" | python3 -c 'import sys,json; mi=json.load(sys.stdin).get("parameters",{}).get("missingIntervals",[]); print(mi[0].get("start","") if mi else "")')
MISSING_DURATION=$(echo "$RESULT5" | python3 -c 'import sys,json; mi=json.load(sys.stdin).get("parameters",{}).get("missingIntervals",[]); print(mi[0].get("duration","") if mi else "")')
check "缺失采样点起始时间含15:30" "$MISSING_START" "15:30"
check "缺失采样点时长为30分钟(非60分钟)" "$MISSING_DURATION" "30"
check_not "缺失时长不应是60分钟" "$MISSING_DURATION" "60"

CALC_STATUS=$(echo "$RESULT5" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')
check "计算状态为pending_review" "$CALC_STATUS" "pending_review"

echo ""
echo "--- 步骤6: 检查复核任务描述 ---"
TASKS=$(curl --noproxy localhost -s "$BASE/tasks?assignee=user-2&status=pending")
TASK_DESC=$(echo "$TASKS" | python3 -c "
import sys,json
tasks = json.load(sys.stdin)
for t in tasks:
    if t.get('calculationId') == '$CALC_ID':
        print(t.get('description',''))
        break
else:
    print('')
")
check "复核任务描述含15:30" "$TASK_DESC" "15:30"
check "复核任务描述含30分钟" "$TASK_DESC" "30"
check_not "复核任务描述不应含60分钟" "$TASK_DESC" "60"

TASK_ID=$(echo "$TASKS" | python3 -c "
import sys,json
tasks = json.load(sys.stdin)
for t in tasks:
    if t.get('calculationId') == '$CALC_ID':
        print(t.get('id',''))
        break
else:
    print('')
")

echo ""
echo "--- 步骤7: 林老师补录备注 ---"
RESULT7=$(curl --noproxy localhost -s -X PUT "$BASE/calculations/$CALC_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "updates":{"remark":"林老师补充：15:30设备临时停机检修，有现场巡检记录可查"},
    "updatedBy":"user-1",
    "changeReason":"补充15:30缺失数据的现场背景说明"
  }')
check "备注修改成功" "$(echo "$RESULT7" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("remark",""))')" "林老师补充"

echo ""
echo "--- 步骤8: 验证备注变更历史 ---"
HISTORY=$(curl --noproxy localhost -s "$BASE/calculations/$CALC_ID/history")
check "变更历史含改前值" "$(echo "$HISTORY" | python3 -c 'import sys,json; [print(c.get("oldValue","")) for c in json.load(sys.stdin) if c.get("fieldName")=="remark"]')" "维修群第一次导入"
check "变更历史含改后值" "$(echo "$HISTORY" | python3 -c 'import sys,json; [print(c.get("newValue","")) for c in json.load(sys.stdin) if c.get("fieldName")=="remark"]')" "林老师补充"
check "变更历史含修改人" "$(echo "$HISTORY" | python3 -c 'import sys,json; [print(c.get("changedBy","")) for c in json.load(sys.stdin) if c.get("fieldName")=="remark"]')" "user-1"
check "变更历史含修改原因" "$(echo "$HISTORY" | python3 -c 'import sys,json; [print(c.get("changeReason","")) for c in json.load(sys.stdin) if c.get("fieldName")=="remark"]')" "现场背景说明"

echo ""
echo "--- 步骤9: 质检员复核 ---"
RESULT9=$(curl --noproxy localhost -s -X PUT "$BASE/tasks/$TASK_ID/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution":"经核查，15:30设备临时停机检修有巡检记录和审批单，不属于数据异常，不影响汽蚀风险评估结果",
    "resolvedBy":"user-2",
    "markAsNormal":true
  }')
check "复核任务已解决" "$(echo "$RESULT9" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')" "resolved"

echo ""
echo "--- 步骤10: 刷新重算 ---"
RESULT10=$(curl --noproxy localhost -s -X POST "$BASE/calculations/$CALC_ID/recalculate")
RECALC_STATUS=$(echo "$RESULT10" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("riskLevel",""))')
check "重算成功返回riskLevel" "$RECALC_STATUS" "low"
RECALC_MISSING=$(echo "$RESULT10" | python3 -c 'import sys,json; mi=json.load(sys.stdin).get("parameters",{}).get("missingIntervals",[]); print(len(mi))')
check "重算后缺失采样点仍为1个" "$RECALC_MISSING" "1"

echo ""
echo "--- 步骤11: 生成复盘报告 ---"
RESULT11=$(curl --noproxy localhost -s -X POST "$BASE/reviews" \
  -H "Content-Type: application/json" \
  -d "{
    \"calculationId\":\"$CALC_ID\",
    \"decisions\":[
      {\"dataPointId\":\"dp-1\",\"keepReason\":\"14:30数据完整，压力流量温度正常，作为基准值\",\"missingMaterials\":[],\"nextAction\":\"none\"},
      {\"dataPointId\":\"dp-2\",\"keepReason\":\"15:00数据正常，压力略有下降符合趋势\",\"missingMaterials\":[],\"nextAction\":\"none\"},
      {\"dataPointId\":\"dp-3\",\"keepReason\":\"16:00数据正常，15:30停机有巡检记录已复核\",\"missingMaterials\":[\"15:30停机审批单扫描件\"],\"nextAction\":\"teacher\",\"assignee\":\"user-1\"},
      {\"dataPointId\":\"missing-1\",\"keepReason\":\"15:30缺失因设备停机检修，已有巡检记录佐证\",\"missingMaterials\":[\"停机审批单\"],\"nextAction\":\"teacher\",\"assignee\":\"user-1\"}
    ],
    \"createdBy\":\"user-1\"
  }")
REPORT=$(echo "$RESULT11" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("reportContent",""))')

echo ""
echo "--- 步骤12: 核对报告关键内容 ---"
check "报告含缺失采样点15:30" "$REPORT" "15:30"
check "报告含缺30分钟" "$REPORT" "缺30分钟"
check_not "报告不应含缺60分钟" "$REPORT" "缺60分钟"
check "报告含为什么缺15:30的解释" "$REPORT" "30分钟间隔内缺少1个采样记录"
check "报告含新记录截图" "$REPORT" "维修群截图_20240601_1430"
check "报告含重复类型标注" "$REPORT" "重复类型"
check "报告含备注变更历史" "$REPORT" "备注变更历史"
check "报告含改前值" "$REPORT" "维修群第一次导入"
check "报告含改后值(林老师补充)" "$REPORT" "林老师补充"
check "报告含修改原因" "$REPORT" "现场背景说明"
check "报告含缺失材料" "$REPORT" "停机审批单"
check "报告含缺失采样点决策" "$REPORT" "缺失采样点决策"
check "报告含处理判断" "$REPORT" "处理判断"
check "报告含最终结论" "$REPORT" "最终结论"

echo ""
echo "--- 步骤13: 导出报告(含重复截图) ---"
EXPORT=$(curl --noproxy localhost -s "$BASE/reports/$CALC_ID")
EXPORT_REPORT=$(echo "$EXPORT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("report",""))')
check "导出报告含15:30缺失" "$EXPORT_REPORT" "15:30"
check "导出报告含30分钟" "$EXPORT_REPORT" "缺30分钟"
check_not "导出报告不应含60分钟" "$EXPORT_REPORT" "缺60分钟"
check "导出报告含重复类型" "$EXPORT_REPORT" "重复类型"
check "导出报告含备注变更" "$EXPORT_REPORT" "备注变更历史"
check "导出报告含缺失采样点决策" "$EXPORT_REPORT" "缺失采样点决策"

echo ""
echo "========================================"
echo "验证结果: 通过 $PASS / 失败 $FAIL"
echo "========================================"
if [ "$FAIL" -gt 0 ]; then
  echo "⚠️  有 $FAIL 项检查未通过，请查看上方详细输出"
  exit 1
else
  echo "🎉 所有检查项均通过！维修群截图第一次导入闭环验证成功"
fi
