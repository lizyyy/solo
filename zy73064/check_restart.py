import json
import urllib.request

BASE = "http://127.0.0.1:8000"


def g(p):
    with urllib.request.urlopen(BASE + p, timeout=5) as r:
        return json.loads(r.read().decode())


bar = "=" * 70
print(bar)
print("  重启后持久化验证")
print(bar)

notes = g("/notes")
print(f"\n/notes 返回 {notes['total']} 条备注")
assert notes["total"] >= 3, "重启后人工备注丢失！"
for n in notes["items"]:
    print(f"  ✓ {n['note_no']}  管线={n['pipeline_id']}  人={n['operator']}  {n['content'][:28]}")

details = g("/attributions/details")
print(f"\n/attributions/details 返回 {details['total']} 条明细")
assert details["total"] >= 3
for d in details["items"]:
    print(f"  ✓ {d['attr_no']}  status={d['status']}  status_for_export={d['status_for_export']}")

review = g("/attributions/monthly-review")
print("\n/attributions/monthly-review 分组：")
for grp in ["已确认", "待补件", "退回"]:
    cnt = review.get(grp, {}).get("count", 0)
    print(f"  【{grp}】：{cnt} 条")
    assert cnt >= 1, f"重启后 {grp} 分组记录丢失！"

cons = g("/consistency")
print(f"\n状态一致性 ok={cons['status_consistency']['ok']}")
print(f"持久化一致性 ok={cons['persistence_consistency']['ok']}")
assert cons["status_consistency"]["ok"]
assert cons["persistence_consistency"]["ok"]

queue = g("/attributions/queue-export")
dm = {d["attr_no"]: d for d in details["items"]}
qm = {q["归因编号"]: q for q in queue["items"]}
for no, d in dm.items():
    q = qm[no]
    assert q["状态"] == d["status_for_export"], f"{no} 状态不一致"
print("\n✓ 接口明细 status_for_export == 异常队列『状态』")

print(f"\n{bar}")
print("  ✅ 重启后人工备注、归因状态、月底分组、一致性全部保留")
print(bar)
