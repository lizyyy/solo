#!/usr/bin/env python3
"""测试复盘脚本是否能正确重放所有状态"""
import sys
import os
import shutil

sys.path.insert(0, '.')

from src.storage import ShowStorage

SHOW_ID = "show_7ac8a217"

print("=" * 60)
print("📋 验证复盘脚本重放一致性")
print("=" * 60)

storage_orig = ShowStorage("data")
show_orig = storage_orig.load_show(SHOW_ID)

print("\n📌 原始场次关键状态:")
print(f"  工作流阶段: {show_orig.workflow_stage.value}")
print(f"  批次数: {len(show_orig.batches)}")
print(f"  总票数: {sum(len(b.tickets) for b in show_orig.batches)}")
print(f"  能量曲目数: {len(show_orig.energy_curve.points) if show_orig.energy_curve else 0}")
print(f"  审核决定数: {len(show_orig.review_decisions)}")

replay_dir = "data_replay_test"
if os.path.exists(replay_dir):
    shutil.rmtree(replay_dir)

print("\n▶️  运行复盘脚本...")
os.system(f"DATA_DIR={replay_dir} python3 replay_demo.py")

storage_replay = ShowStorage(replay_dir)
show_replay = storage_replay.load_show(SHOW_ID)

if not show_replay:
    print("\n❌ 错误: 复盘脚本未生成场次")
    sys.exit(1)

print("\n📌 复盘后场次关键状态:")
print(f"  工作流阶段: {show_replay.workflow_stage.value}")
print(f"  批次数: {len(show_replay.batches)}")
print(f"  总票数: {sum(len(b.tickets) for b in show_replay.batches)}")
print(f"  能量曲目数: {len(show_replay.energy_curve.points) if show_replay.energy_curve else 0}")
print(f"  审核决定数: {len(show_replay.review_decisions)}")

print("\n🔍 逐项对比:")

checks = [
    ("工作流阶段", show_orig.workflow_stage == show_replay.workflow_stage),
    ("批次数", len(show_orig.batches) == len(show_replay.batches)),
    ("总票数", sum(len(b.tickets) for b in show_orig.batches) == sum(len(b.tickets) for b in show_replay.batches)),
    ("能量曲线曲目数", 
     len(show_orig.energy_curve.points) if show_orig.energy_curve else 0 == 
     len(show_replay.energy_curve.points) if show_replay.energy_curve else 0),
    ("审核决定数", len(show_orig.review_decisions) == len(show_replay.review_decisions)),
    ("导入记录数", len(show_orig.rehearsal_imports) == len(show_replay.rehearsal_imports)),
    ("合同截图数", len(show_orig.contract_screenshots) == len(show_replay.contract_screenshots)),
]

all_pass = True
for name, ok in checks:
    status = "✅" if ok else "❌"
    print(f"  {status} {name}")
    if not ok:
        all_pass = False

if all_pass:
    print("\n🎉 全部通过! 复盘脚本可以完整重放所有状态")
else:
    print("\n⚠️  有项目不匹配，请检查")

shutil.rmtree(replay_dir, ignore_errors=True)
