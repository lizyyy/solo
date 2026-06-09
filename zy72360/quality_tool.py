# -*- coding: utf-8 -*-
"""
无人船横摇周期估算 - 质检工具
入口文件：可直接从此文件导入核心类使用

推荐使用方式（从src包导入完整版本）：
    from src import QualityWorkflow, RecordStatus, ReviewInfo

或从此文件直接导入（单文件独立版本，功能一致）
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.models import (
    SamplingRecord,
    TemperatureCalibration,
    RollPeriodEstimate,
    ConflictEvidence,
    SafetyReminder,
    RecordStatus,
    SensorStatus,
    ReviewInfo,
)
from src.conflict_detector import ConflictDetector
from src.self_check import SelfChecker
from src.workflow import QualityWorkflow

__all__ = [
    "SamplingRecord",
    "TemperatureCalibration",
    "RollPeriodEstimate",
    "ConflictEvidence",
    "SafetyReminder",
    "RecordStatus",
    "SensorStatus",
    "ReviewInfo",
    "ConflictDetector",
    "SelfChecker",
    "QualityWorkflow",
]


def quick_start_demo():
    """快速入门演示：跑一遍完整操作路径"""
    print("=" * 70)
    print("              无人船横摇周期估算 - 质检工具 快速入门")
    print("=" * 70)
    print()

    wf = QualityWorkflow()

    # ------- 第一步：导入采样间隔说明 -------
    print("【第一步】导入采样间隔说明（SAMPLE-001，采样间隔0.05s）")
    r1 = wf.step1_import_sampling_record({
        "record_id": "SAMPLE-001",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-A01",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-08T20:00:00",
        "sampling_end_time": "2026-06-08T22:00:00",
        "roll_periods": [12.5, 12.3, 12.6],
        "import_user": "操作员张三"
    })
    print(f"  → 记录ID: {r1['record_id']}  当前状态: {r1['status']}  版本: v{r1['version']}")
    print()

    # ------- 第二步：温度校准记录一晚后到（触发冲突） -------
    print("【第二步】导入温度校准记录（有效间隔0.04s，与采样说明矛盾）")
    cal = wf.step2_import_calibration_and_check({
        "calibration_id": "CAL-A001",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-A01",
        "calibration_time": "2026-06-08T18:00:00",
        "effective_sampling_interval": 0.04,
        "calibration_temperature": 32.5,
        "operator": "校准员李四",
        "remarks": "夜航高温导致采样频率偏移"
    })
    print(f"  → 发现冲突: {cal['new_conflicts_found']}条")
    for c in cal["conflicts"]:
        print(f"     ·冲突证据: 采样{c['sampling_value']}s vs 校准{c['calibration_value']}s")
    print()

    # ------- 第三步：安全提醒更新 -------
    print("【第三步】更新安全提醒（列证据+不自动拍板）")
    safety = wf.step3_update_safety_reminders("质检员小白")
    print(f"  → 待处理安全提醒: {safety['total_pending_reminders']}条")
    for rem in safety["reminders"]:
        if not rem["reviewed"]:
            print(f"     ·[{rem['level']}] {rem['title']}  → 下一步: {rem['next_step']}")
    print()

    # ------- 查看详情：同一条记录各处一致 -------
    print("【关键核对】SAMPLE-001 详情页/仪表盘/导出 三处一致")
    detail = wf.get_record_detail("SAMPLE-001")
    dashboard = wf.get_dashboard()
    list_item = next(r for r in dashboard["record_list_snippet"] if r["record_id"] == "SAMPLE-001")
    export = wf.export_record("SAMPLE-001")

    ok1 = list_item["status"] == detail["summary"]["current_status"]
    ok2 = detail["summary"]["version"] == export["data"]["record_detail"]["version"]
    ok3 = detail["sampling_values"]["declared_interval"] == export["data"]["record_detail"]["sampling_interval"]

    print(f"  → 列表状态=详情状态: {'✓' if ok1 else '✗'}")
    print(f"  → 详情版本=输出版本: {'✓' if ok2 else '✗'}")
    print(f"  → 详情间隔=输出间隔: {'✓' if ok3 else '✗'}")
    print()

    print("【人工复核信息完整度检查】")
    conflicts = wf.conflict_detector.get_conflict_summary()
    cid = conflicts[0]["conflict_id"]
    print("  → 质检员小白选择折中修正0.045s，交给安全员王五复核后归档")

    res = wf.resolve_conflict(
        cid, "冲突存在折中处理", "质检员小白",
        handler_after="安全员王五复核后归档", correct_value=0.045
    )
    detail = wf.get_record_detail("SAMPLE-001")

    if detail["review_infos"]:
        ri = detail["review_infos"][0]
        print(f"     ·原始说法: {ri['original_value']}s")
        print(f"     ·改后的值: {ri['corrected_value']}s")
        print(f"     ·处理原因: {ri['reason']}")
        print(f"     ·处理人:   {ri['handled_by']}")
        print(f"     ·下一步找谁: {ri['next_handler']}")
    print(f"  → 当前状态: {detail['summary']['current_status']}（不提前归正常）")
    print()

    print("=" * 70)
    print("  完整操作路跑通！请运行 python3 run_full_test.py 查看全部场景")
    print("=" * 70)

    return wf


if __name__ == "__main__":
    quick_start_demo()
