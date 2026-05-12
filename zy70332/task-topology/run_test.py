import sys
from pathlib import Path
import shutil
import yaml

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from core.parser import load_task_definitions
from core.dependency_graph import DependencyGraph
from core.runtime import RuntimeManager
from storage.json_store import JsonStore

from core.config import ensure_dirs, STORAGE_DIR
ensure_dirs()

storage_data_dir = STORAGE_DIR
if storage_data_dir.exists():
    for item in storage_data_dir.iterdir():
        if item.is_dir():
            shutil.rmtree(item)
        elif item.is_file():
            item.unlink()

print("=" * 60)
print("  任务依赖拓扑 CLI - 自动测试")
print("=" * 60)
print()

print("[1] 加载任务定义...")
tasks = load_task_definitions()
assert len(tasks) == 12, f"期望 12 个任务，实际 {len(tasks)}"
print(f"    OK - 加载了 {len(tasks)} 个任务")

print()
print("[2] 构建依赖图...")
graph = DependencyGraph(tasks)
analysis = graph.analyze_graph()
assert len(analysis.cycles) == 0, "不应该有环"
assert len(analysis.missing_dependencies) == 0, "不应该有缺失依赖"
assert len(analysis.topological_order) == 12, "拓扑顺序应该包含所有任务"
print(f"    OK - 无环，拓扑顺序: {' -> '.join(analysis.topological_order[:4])}...")

print()
print("[3] 导入失败状态...")
store = JsonStore()
runtime = RuntimeManager(graph, store)
run_date = "2026-05-12"

with open(PROJECT_ROOT / "samples/state_1_failed.yaml", "r") as f:
    state1 = yaml.safe_load(f)

added_s, added_f, h = runtime.import_statuses(run_date, state1)
assert added_s > 0, "应该有新增状态"
assert added_f == 1, f"应该有 1 个失败，实际 {added_f}"
print(f"    OK - 新增状态: {added_s}, 新增失败: {added_f}")

print()
print("[4] 分析失败影响...")
impact = runtime.analyze_impact(run_date)
assert "order_raw_sync" in impact.failed_tasks, "order_raw_sync 应该失败"
assert len(impact.affected_downstream) > 0, "应该有受影响下游"
print(f"    OK - 失败任务: {impact.failed_tasks}")
print(f"    OK - 受影响下游数: {len(impact.affected_downstream)}")

print()
print("[5] 生成重跑计划...")
plan = runtime.compute_rerun_plan(run_date)
blocked = [p.task_id for p in plan if p.suggested_action == "BLOCKED"]
rerun = [p.task_id for p in plan if p.suggested_action == "RERUN"]
assert len(blocked) > 0, "应该有阻断任务"
print(f"    OK - 阻断任务: {blocked}")
print(f"    OK - 建议重跑: {rerun}")

print()
print("[6] 手工跳过任务（验证原因必填）...")
try:
    runtime.add_skip(run_date, "order_detail_report", "")
    assert False, "应该抛出异常"
except ValueError as e:
    print(f"    OK - 空原因被拒绝: {e}")

skip = runtime.add_skip(
    run_date, "order_detail_report",
    "运营已确认今天不需要订单明细报表"
)
assert skip.task_id == "order_detail_report"
assert skip.reason
print(f"    OK - 已跳过: {skip.task_id}, 原因: {skip.reason}")

print()
print("[7] 验证手工跳过后计划中的显示...")
plan2 = runtime.compute_rerun_plan(run_date)
skipped_items = [p for p in plan2 if p.task_id == "order_detail_report"]
assert len(skipped_items) == 1
item = skipped_items[0]
assert item.suggested_action == "SKIPPED"
assert item.skip_reason == skip.reason
print(f"    OK - 计划中显示跳过: {item.task_id} -> {item.skip_reason}")

print()
print("[8] 测试重复导入去重...")
added_s2, added_f2, h2 = runtime.import_statuses(run_date, state1)
assert added_s2 == 0, f"重复导入应该 0 新增，实际 {added_s2}"
assert added_f2 == 0, f"重复导入应该 0 失败，实际 {added_f2}"
print(f"    OK - 重复导入: 新增状态={added_s2}, 新增失败={added_f2}")

print()
print("[9] 标记上游修复并导入新状态...")
runtime.mark_fixed(run_date, "order_raw_sync")
runtime.update_statuses_on_fix(run_date, "order_raw_sync")

with open(PROJECT_ROOT / "samples/state_2_fixed.yaml", "r") as f:
    state2 = yaml.safe_load(f)

added_s3, added_f3, h3 = runtime.import_statuses(run_date, state2)
assert added_s3 > 0, "应该有新状态导入"
print(f"    OK - 导入修复状态: 新增={added_s3}")

print()
print("[10] 验证手工跳过不被覆盖...")
skips_final = runtime.load_skips(run_date)
assert "order_detail_report" in skips_final
print(f"    OK - 手工跳过保留: {list(skips_final.keys())}")

statuses = runtime.load_statuses(run_date)
success_count = sum(1 for s in statuses.values() if s.status.value == "success")
print(f"    OK - 最终成功任务数: {success_count}")

print()
print("=" * 60)
print("  所有测试通过！")
print("=" * 60)
