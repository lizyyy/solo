#!/usr/bin/env python3
"""对比原始场次和复盘场次的状态"""
import json
import sys
sys.path.insert(0, '.')

from src.storage import ShowStorage

SHOW_ID = "show_7ac8a217"

print("=" * 60)
print("原始场次 vs 复盘场次 状态对比")
print("=" * 60)

with open(f"data/shows_backup_orig/{SHOW_ID}.json") as f:
    orig = json.load(f)

storage = ShowStorage("data")
replay = storage.load_show(SHOW_ID)

print()
print(f"{'指标':<20} {'原始':<18} {'复盘':<18} {'一致'}")
print("-" * 65)

def check(name, orig_val, replay_val):
    ok = orig_val == replay_val
    status = "YES" if ok else "NO"
    print(f"{name:<20} {str(orig_val):<18} {str(replay_val):<18} {status}")
    return ok

all_ok = True

all_ok &= check("工作流阶段", orig["workflow_stage"], replay.workflow_stage.value)
all_ok &= check("批次数", len(orig["batches"]), len(replay.batches))

orig_tickets = sum(len(b["tickets"]) for b in orig["batches"])
replay_tickets = sum(len(b.tickets) for b in replay.batches)
all_ok &= check("总票数", orig_tickets, replay_tickets)

orig_energy = len(orig.get("energy_curve", {}).get("points", []))
replay_energy = len(replay.energy_curve.points) if replay.energy_curve else 0
all_ok &= check("能量曲目数", orig_energy, replay_energy)

all_ok &= check("审核决定数", len(orig.get("review_decisions", [])), len(replay.review_decisions))
all_ok &= check("导入记录数", len(orig.get("rehearsal_imports", [])), len(replay.rehearsal_imports))
all_ok &= check("合同截图数", len(orig.get("contract_screenshots", [])), len(replay.contract_screenshots))

print()
print("批次状态对比:")
orig_status = {b["name"]: b["status"] for b in orig["batches"]}
replay_status = {b.name: b.status.value for b in replay.batches}

for name in sorted(orig_status.keys()):
    o = orig_status.get(name, "N/A")
    r = replay_status.get(name, "N/A")
    ok = o == r
    all_ok = all_ok and ok
    status = "YES" if ok else "NO"
    print(f"  {name:<15} 原始:{o:<12} 复盘:{r:<12} {status}")

print()
if all_ok:
    print("[PASS] 所有关键指标一致! 复盘脚本可完整重放所有状态")
else:
    print("[FAIL] 部分指标不一致，请检查")

sys.exit(0 if all_ok else 1)
