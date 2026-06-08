#!/bin/bash
set -e
BASE=http://127.0.0.1:5001

curl -sS -X POST $BASE/api/reset > /dev/null

echo "=== 1. 导入样例数据 ==="
curl -sS -X POST $BASE/api/import/sample > /tmp/state1.json
python3 <<'EOF'
import json
d = json.load(open("/tmp/state1.json"))
print("summary:", json.dumps(d["summary"], ensure_ascii=False))
print("pending异常数(分母=0空串):", sum(1 for r in d["anomaly_rows"] if r.get("_anomaly")=="denominator_zero_empty_string"))
print("cleaned 数:", len(d["cleaned_rows"]))
rs = [r for r in d["evidence"] if r["anomaly_type"]=="denominator_zero_empty_string" and r["current_status"] in ("pending_review","auto_flagged")]
with open("/tmp/eid.txt","w") as f:
    f.write(rs[0]["evidence_id"] if rs else "")
EOF
EID=$(cat /tmp/eid.txt)
echo "target evidence_id = $EID"
echo

echo "=== 2. 证据详情 ==="
curl -sS $BASE/api/evidence/$EID > /tmp/detail.json
python3 <<'EOF'
import json
d = json.load(open("/tmp/detail.json"))
r = d["record"]
print("原始行号:", r["original_row"])
print("原始说法存在:", bool(r.get("original_statement")))
print("当前状态:", r["current_status"])
print("detail:", r.get("detail"))
EOF
echo

echo "=== 3. 实验助理补录（不提前归正常）==="
EID=$(cat /tmp/eid.txt)
python3 -c "import json; print(json.dumps({'evidence_id':'$EID','new_values':{'count_a':'3','count_b':'4','denominator':'7'},'supplemented_by':'实验助理小穆'},ensure_ascii=False))" > /tmp/sup.json
curl -sS -X POST $BASE/api/supplement -H "Content-Type: application/json" --data-binary @/tmp/sup.json > /tmp/state2.json
python3 <<'EOF'
import json
EID = open("/tmp/eid.txt").read().strip()
d = json.load(open("/tmp/state2.json"))
ev = next(r for r in d["evidence"] if r["evidence_id"]==EID)
print("补录后状态:", ev["current_status"], "(应=supplemented，仍在待复核)")
print("补录人:", ev["supplemented_by"])
print("next_step:", ev["next_step"])
print("仍在 anomaly_rows 吗:", any(r.get("_original_row")==ev["original_row"] for r in d["anomaly_rows"]), "(应为 True)")
print("在 cleaned_rows 吗:", any(r.get("_original_row")==ev["original_row"] for r in d["cleaned_rows"]), "(应为 False)")
print("cleaned 行数:", len(d["cleaned_rows"]))
EOF
echo

echo "=== 4. 复核人确认（移入正常）==="
python3 -c "import json;EID=open('/tmp/eid.txt').read().strip();print(json.dumps({'evidence_id':EID,'confirmed_normal':True,'note':'对照原始问卷第3页，A组Q3共7人','reviewer':'数据复核人老K'},ensure_ascii=False))" > /tmp/rev.json
curl -sS -X POST $BASE/api/review -H "Content-Type: application/json" --data-binary @/tmp/rev.json > /tmp/state3.json
python3 <<'EOF'
import json
EID = open("/tmp/eid.txt").read().strip()
d = json.load(open("/tmp/state3.json"))
ev = next(r for r in d["evidence"] if r["evidence_id"]==EID)
print("复核后状态:", ev["current_status"], "(应=confirmed_normal)")
print("复核人:", ev["reviewer"])
print("review_reason:", ev["review_reason"])
print("corrected_value:", ev["corrected_value"])
print("next_step:", ev["next_step"])
print("已移入 cleaned:", any(r.get("_original_row")==ev["original_row"] for r in d["cleaned_rows"]), "(应为 True)")
print("已从 anomaly 移除:", not any(r.get("_original_row")==ev["original_row"] for r in d["anomaly_rows"]), "(应为 True)")
print("chi_square:", d["chi_square_result"])
EOF
echo

echo "=== 5. 四路一致性 (display/api/export/json报告) ==="
curl -sS $BASE/api/state > /tmp/api_state.json
curl -sS $BASE/api/export/result_json > /tmp/export.json
python3 <<'EOF'
import json
s = json.load(open("/tmp/api_state.json"))
e = json.load(open("/tmp/export.json"))
r = e["result"]
assert s["cleaned_rows"] == r["cleaned_rows"], "cleaned mismatch"
assert s["anomaly_rows"] == r["anomaly_rows"], "anomaly mismatch"
assert s["chi_square_result"] == r["chi_square_result"], "chi mismatch"
assert s["summary"] == r["summary"], "summary mismatch"
print("✅ display=api=export 四路完全一致")
print("证据链清单一致:", len([x for x in e["evidence"] if any(x["evidence_id"]==y["evidence_id"] for y in s["evidence"])])==len(s["evidence"]))
EOF
echo

echo "=== 6. 自检 ==="
curl -sS $BASE/api/selfcheck | python3 -c "import json,sys;d=json.load(sys.stdin);[print(f'[{c[\"status\"]:4s}] {c[\"check\"]:30s}: {c[\"detail\"]}') for c in d['checks']]"
echo

echo "=== 7. 导出 Markdown 报告 ==="
curl -sS "$BASE/api/export/report" | head -40
