"""完整演示：覆盖用户需求的全部场景。

场景清单：
  1. 导入一批字段名不统一的浮标日志（中英混合命名）
  2. 重复导入同一批，验证幂等（不翻倍）
  3. 运行处理链：
     - 船上记录晚于传感器数据的时序对齐
     - 传感器漂移记录单独拎出（不混入正常结果）
     - 淤积异常预警判定
  4. 给预警加人工备注，再重复添加验证不被覆盖
  5. 人工改预警口径（旧值→新判断，原因必填），检查 ChangeLog
  6. 老何接班流程：从浮标日志追到时间线，讲清楚结果
"""

from __future__ import annotations

import json
import os
import shutil
import sys

from harbor_warning.engine import HarborWarningEngine
from harbor_warning.models import WarningLevel
from harbor_warning.storage import HarborStorage
from harbor_warning.timeline import build_timeline, format_timeline_for_handover


DATA_DIR = os.path.join(os.path.dirname(__file__), "demo_harbor_data")
SAMPLE = os.path.join(os.path.dirname(__file__), "sample_data", "buoy_batch_1.json")


def section(title: str) -> None:
    bar = "=" * 72
    print(f"\n{bar}\n  {title}\n{bar}")


def load_sample() -> list[dict]:
    with open(SAMPLE, "r", encoding="utf-8") as f:
        return json.load(f)


def assert_eq(actual, expected, label: str) -> None:
    ok = actual == expected
    mark = "✓" if ok else "✗"
    print(f"  [{mark}] {label}: expect={expected} actual={actual}")
    if not ok:
        raise AssertionError(f"{label} 失败: {actual} != {expected}")


def main() -> int:
    if os.path.isdir(DATA_DIR):
        shutil.rmtree(DATA_DIR)

    storage = HarborStorage(DATA_DIR)
    engine = HarborWarningEngine(storage)
    raw = load_sample()

    # ------- 1. 首次导入（字段名不统一） -------
    section("1. 首次导入：字段名中英混合，验证 field_mapper 保住来源与处理状态")
    imp1 = engine.import_raw_records(raw)
    print(json.dumps(imp1, ensure_ascii=False, indent=2))
    assert_eq(imp1["total"], 10, "total 原始记录数")
    assert_eq(imp1["mapped"], 10, "mapped 字段映射成功数")
    assert_eq(imp1["map_failed"], 0, "map_failed 映射失败数")
    assert_eq(imp1["imported_new"], 10, "imported_new 新导入数")
    assert_eq(imp1["import_skipped"], 0, "import_skipped 跳过重复数")

    logs_first = storage.list_buoy_logs()
    missing_source = [l for l in logs_first if not l.source]
    missing_status = [l for l in logs_first if not l.process_status]
    assert_eq(len(missing_source), 0, "所有记录保住 source")
    assert_eq(len(missing_status), 0, "所有记录保住 process_status")

    # ------- 2. 重复导入 -------
    section("2. 重复导入同一批，验证幂等：正常记录不翻倍")
    imp2 = engine.import_raw_records(raw)
    print(json.dumps(imp2, ensure_ascii=False, indent=2))
    assert_eq(imp2["imported_new"], 0, "再次 imported_new 应为 0")
    assert_eq(imp2["import_skipped"], 10, "再次 import_skipped 应为 10")
    logs_again = storage.list_buoy_logs()
    assert_eq(len(logs_again), len(logs_first), "总数不变（幂等）")

    # ------- 3. 处理链 -------
    section("3. 运行完整处理链（对齐 + 漂移隔离 + 预警）")
    pipe = engine.run_pipeline(
        window_seconds=3600,
        drift_threshold=2.5,
        min_window=3,
        sediment_warning_cm=30.0,
        sediment_critical_cm=60.0,
    )
    print(json.dumps(pipe, ensure_ascii=False, indent=2))
    assert_eq(pipe["sensor_count"], 8, "sensor_count")
    assert_eq(pipe["ship_log_count"], 2, "ship_log_count")
    assert_eq(pipe["aligned_pairs"], 2, "两条船记都应被对齐")
    assert_eq(pipe["merged_logs"], 2, "生成两条合并记录")
    assert len(pipe["isolated_ids"]) >= 1, f"应检测到漂移（S4=95cm异常），实际={pipe['isolated_ids']}"
    assert pipe["warnings_added"] >= 1, "至少生成一条预警"

    # ------- 4. 人工备注 + 验证不覆盖 -------
    section("4. 给其中一条预警加人工备注，并验证重复添加不覆盖")
    warnings = storage.list_warnings()
    target_warn = warnings[0]
    note_id1, written1 = engine.add_note(
        target_type="warning",
        target_id=target_warn.warning_id,
        content="第一次备注：现场确认该区域上周进行过疏浚作业，可能读数偏高",
        author="复核人A",
    )
    print(f"  首次备注: note_id={note_id1}, written={written1}")
    assert_eq(written1, True, "首次备注应写入")

    note_id2, written2 = engine.add_note(
        target_type="warning",
        target_id=target_warn.warning_id,
        content="恶意第二次覆盖：应该被拒绝",
        author="复核人B",
    )
    print(f"  重复备注: note_id={note_id2}, written={written2}")
    assert_eq(written2, False, "第二次备注应被幂等保护，不覆盖")
    assert_eq(note_id2, note_id1, "返回的 note_id 应相同")

    notes = storage.list_notes(target_type="warning", target_id=target_warn.warning_id)
    assert_eq(len(notes), 1, "实际只存在 1 条备注，证明没被覆盖")
    assert "疏浚作业" in notes[0].content, "备注内容仍为第一条"

    # ------- 5. 人工改口径 -------
    section("5. 人工改预警口径：记录旧值、新判断、原因")
    ok, revise_msg = engine.revise_warning_level(
        warning_id=target_warn.warning_id,
        new_level=WarningLevel.ATTENTION,
        reason="与疏浚后历史基线对比，判断为临时偏高，非持续性淤积",
        operator="评审组组长",
    )
    print(f"  revise: ok={ok}, msg={revise_msg}")
    assert_eq(ok, True, "改口径应成功")

    changes = storage.list_changes(
        target_type="warning", target_id=target_warn.warning_id
    )
    assert len(changes) >= 1, "应生成变更日志"
    change = changes[-1]
    assert_eq(change.field_name, "warning_level", "变更字段应为 warning_level")
    assert change.old_value is not None, "变更日志记录旧值"
    assert_eq(change.new_value, "attention", "变更日志记录新判断=attention")
    assert "疏浚" in change.reason, "变更日志记录原因"

    ok, msg_no_reason = engine.revise_warning_level(
        warning_id=target_warn.warning_id,
        new_level=WarningLevel.NORMAL,
        reason="",  # 原因必填
    )
    assert_eq(ok, False, "原因必填校验")
    assert_eq(msg_no_reason, "REVISE_REASON_REQUIRED", "稳定提示文案")

    # ------- 6. 老何接班流程：时间线 -------
    section("6. 港口工程师老何接班流程：从浮标日志追到历史时间线")
    events = build_timeline(storage, buoy_id="B-03")
    handover = format_timeline_for_handover(events)
    print(handover)

    kinds = {e["kind"] for e in events}
    assert "drift_mark" in kinds, "时间线包含漂移标记"
    assert any(k.startswith("warning:") for k in kinds), "时间线包含预警"
    assert "aligned_pair" in kinds, "时间线包含对齐关系"
    assert "manual_note" in kinds, "时间线包含人工备注"
    assert "manual_revise" in kinds, "时间线包含人工改口径"

    # ------- summary -------
    section("SUMMARY：全局摘要")
    summary = engine.summary()
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    print("\n\n🎉 所有场景验证通过。")
    print(f"   数据目录：{DATA_DIR}")
    print("   复核人可直接使用：")
    print("     python -m harbor_warning --data-dir ./demo_harbor_data import --input sample_data/buoy_batch_1.json")
    print("     python -m harbor_warning --data-dir ./demo_harbor_data pipeline")
    print("     python -m harbor_warning --data-dir ./demo_harbor_data summary")
    print("     python -m harbor_warning --data-dir ./demo_harbor_data timeline --buoy-id B-03")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"\n💥 验证失败: {exc}", file=sys.stderr)
        raise SystemExit(1)
