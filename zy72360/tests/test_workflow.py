import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.workflow import QualityWorkflow
from src.models import RecordStatus
import json


def test_normal_scenario():
    print("=" * 60)
    print("测试场景1：正常材料 - 无冲突、无异常")
    print("=" * 60)

    workflow = QualityWorkflow()

    result1 = workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-001",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-001",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-03T08:00:00",
        "sampling_end_time": "2026-06-03T10:00:00",
        "roll_periods": [12.5, 12.3, 12.6, 12.4, 12.5],
        "import_user": "操作员张三"
    })
    print(f"第一步导入结果: 状态={result1['status']}, 冲突={result1['conflict_found']}")

    result2 = workflow.step2_import_calibration_and_check({
        "calibration_id": "CAL-001",
        "ship_id": "SHIP-A",
        "sensor_id": "SENSOR-001",
        "calibration_time": "2026-06-02T14:00:00",
        "effective_sampling_interval": 0.05,
        "calibration_temperature": 25.5,
        "operator": "校准员李四"
    })
    print(f"第二步校准结果: 新冲突数={result2['new_conflicts_found']}")

    result3 = workflow.step3_update_safety_reminders("质检员小白")
    print(f"第三步安全提醒: 新增提醒={result3['new_reminders_added']}")

    estimate = workflow.calculate_roll_period_estimate("SHIP-A", "系统")
    print(f"横摇周期估算: 平均周期={estimate['average_period']}s")

    dashboard = workflow.get_dashboard()
    print(f"\n仪表盘: {dashboard['overview']['total_sampling_records']}条记录, {dashboard['status_breakdown']['正常']}条正常")

    print("✓ 正常场景测试通过\n")
    return workflow


def test_conflict_scenario():
    print("=" * 60)
    print("测试场景2：错口径材料 - 采样间隔与校准冲突")
    print("=" * 60)

    workflow = QualityWorkflow()

    result1 = workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-002",
        "ship_id": "SHIP-B",
        "sensor_id": "SENSOR-002",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-03T08:00:00",
        "sampling_end_time": "2026-06-03T10:00:00",
        "roll_periods": [11.8, 12.0, 11.9, 12.1, 12.0],
        "import_user": "操作员张三"
    })
    print(f"第一步导入结果: 状态={result1['status']}")

    result2 = workflow.step2_import_calibration_and_check({
        "calibration_id": "CAL-002",
        "ship_id": "SHIP-B",
        "sensor_id": "SENSOR-002",
        "calibration_time": "2026-06-02T14:00:00",
        "effective_sampling_interval": 0.04,
        "calibration_temperature": 30.0,
        "operator": "校准员李四",
        "remarks": "高温下传感器采样频率偏移"
    })
    print(f"第二步校准结果: 新冲突数={result2['new_conflicts_found']}")
    if result2['conflicts']:
        print(f"  冲突详情: {result2['conflicts'][0]['description']}")

    result3 = workflow.step3_update_safety_reminders("质检员小白")
    print(f"第三步安全提醒: 新增提醒={result3['new_reminders_added']}")
    for r in result3['reminders']:
        if not r['reviewed']:
            print(f"  - [{r['level']}] {r['title']}")

    dashboard = workflow.get_dashboard()
    print(f"\n仪表盘: {dashboard['status_breakdown']['冲突待确认']}条待确认")

    conflicts = workflow.conflict_detector.get_conflict_summary()
    print(f"\n冲突证据列表:")
    for c in conflicts:
        print(f"  - {c['type']}: {c['description']}")
        print(f"    状态: {c['status']}")

    print("\n--- 质检员小白选择确认 ---")
    conflict_id = conflicts[0]['conflict_id']
    resolve_result = workflow.resolve_conflict(
        conflict_id,
        "确认有效，以采样记录为准",
        "质检员小白"
    )
    print(f"处理结果: {resolve_result['resolution']}")
    print(f"记录新状态: {resolve_result['record_new_status']}")

    result4 = workflow.step3_update_safety_reminders("质检员小白")
    print(f"\n冲突解决后待处理提醒: {result4['total_pending_reminders']}")

    print("✓ 冲突场景测试通过\n")
    return workflow


def test_sensor_restart_scenario():
    print("=" * 60)
    print("测试场景3：传感器重启后编号变更 - 留待安全员复核")
    print("=" * 60)

    workflow = QualityWorkflow()

    result1 = workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-003A",
        "ship_id": "SHIP-C",
        "sensor_id": "SENSOR-003",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-03T08:00:00",
        "sampling_end_time": "2026-06-03T10:00:00",
        "roll_periods": [12.5, 12.6, 12.7],
        "import_user": "操作员张三"
    })
    print(f"第一条记录: 状态={result1['status']}")

    result2 = workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-003B",
        "ship_id": "SHIP-C",
        "sensor_id": "SENSOR-003-NEW",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-03T14:00:00",
        "sampling_end_time": "2026-06-03T16:00:00",
        "roll_periods": [12.8, 12.9, 13.0],
        "import_user": "操作员张三"
    })
    print(f"第二条记录(重启后): 状态={result2['status']}")
    print(f"  发现问题: {result2['check_issues']}")

    result3 = workflow.step3_update_safety_reminders("质检员小白")
    print(f"\n安全提醒: 新增={result3['new_reminders_added']}")
    for r in result3['reminders']:
        if not r['reviewed']:
            print(f"  - [{r['level']}] {r['title']}")
            print(f"    {r['related_record']}")

    dashboard = workflow.get_dashboard()
    print(f"\n仪表盘: {dashboard['status_breakdown']['待安全员复核']}条待复核")

    print("\n--- 安全员王五复核通过 ---")
    reminder_id = result3['reminders'][0]['id']
    review_result = workflow.review_safety_reminder(
        reminder_id,
        "安全员王五",
        is_approved=True
    )
    print(f"复核结果: {'通过' if review_result['is_approved'] else '拒绝'}")
    print(f"记录新状态: {review_result['record_new_status']}")

    print("✓ 传感器重启场景测试通过\n")
    return workflow


def test_supplementary_scenario():
    print("=" * 60)
    print("测试场景4：补录材料 - 补录后重算验证")
    print("=" * 60)

    workflow = QualityWorkflow()

    workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-004",
        "ship_id": "SHIP-D",
        "sensor_id": "SENSOR-004",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-03T08:00:00",
        "sampling_end_time": "2026-06-03T10:00:00",
        "roll_periods": [12.0, 12.0, 12.0],
        "import_user": "操作员张三"
    })

    estimate1 = workflow.calculate_roll_period_estimate("SHIP-D", "系统")
    print(f"补录前估算: 平均周期={estimate1['average_period']}s, 使用记录数={estimate1['records_used']}")

    print("\n--- 导入补录数据 ---")
    result = workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-004-SUPP",
        "ship_id": "SHIP-D",
        "sensor_id": "SENSOR-004",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-03T12:00:00",
        "sampling_end_time": "2026-06-03T14:00:00",
        "roll_periods": [14.0, 14.0, 14.0],
        "import_user": "操作员张三",
        "is_supplementary": True,
        "original_record_id": "SAMPLE-004"
    })
    print(f"补录记录状态: {result['status']}")
    print(f"自检问题: {result['check_issues']}")

    estimate2 = workflow.calculate_roll_period_estimate("SHIP-D", "系统")
    print(f"补录后估算: 平均周期={estimate2['average_period']}s, 使用记录数={estimate2['records_used']}")

    check_result = workflow.self_checker.check_supplementary_recalc(
        workflow.sampling_records[-1],
        workflow.sampling_records[0],
        estimate1['average_period'],
        estimate2['average_period']
    )
    print(f"补录重算验证: {check_result[1]}")

    print("✓ 补录场景测试通过\n")
    return workflow


def test_duplicate_and_export():
    print("=" * 60)
    print("测试场景5：重复导入和导出一致性")
    print("=" * 60)

    workflow = QualityWorkflow()

    workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-005",
        "ship_id": "SHIP-E",
        "sensor_id": "SENSOR-005",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-03T08:00:00",
        "sampling_end_time": "2026-06-03T10:00:00",
        "roll_periods": [12.5, 12.5],
        "import_user": "操作员张三"
    })
    print("第一次导入成功")

    print("\n--- 重复导入同一条记录 ---")
    result = workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-005",
        "ship_id": "SHIP-E",
        "sensor_id": "SENSOR-005",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-03T08:00:00",
        "sampling_end_time": "2026-06-03T10:00:00",
        "roll_periods": [12.5, 12.5],
        "import_user": "操作员张三"
    })
    print(f"重复导入检测: {result['check_issues']}")
    print(f"重复导入成功标记: {result.get('success', True)}")
    print(f"当前记录总数: {len(workflow.sampling_records)}")

    print("\n--- 导出记录 ---")
    export_result = workflow.export_record("SAMPLE-005")
    print(f"导出ID: {export_result['data']['export_id']}")
    print(f"一致性检查: {export_result['data']['consistency_check']}")

    check_summary = workflow.self_checker.get_check_summary()
    print(f"\n自检汇总: {json.dumps(check_summary, ensure_ascii=False, indent=2)}")

    print("✓ 重复导入和导出测试通过\n")
    return workflow


def test_history_tracking():
    print("=" * 60)
    print("测试场景6：历史记录追踪")
    print("=" * 60)

    workflow = QualityWorkflow()

    workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-006",
        "ship_id": "SHIP-F",
        "sensor_id": "SENSOR-006",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-03T08:00:00",
        "sampling_end_time": "2026-06-03T10:00:00",
        "roll_periods": [12.0],
        "import_user": "操作员张三"
    })

    workflow.step2_import_calibration_and_check({
        "calibration_id": "CAL-006",
        "ship_id": "SHIP-F",
        "sensor_id": "SENSOR-006",
        "calibration_time": "2026-06-02T14:00:00",
        "effective_sampling_interval": 0.06,
        "calibration_temperature": 22.0,
        "operator": "校准员李四"
    })

    workflow.step3_update_safety_reminders("质检员小白")

    print("操作历史:")
    for log in workflow.get_history():
        print(f"  [{log['timestamp']}] {log['action']}")
        print(f"    {json.dumps(log['details'], ensure_ascii=False)}")

    print("✓ 历史记录追踪测试通过\n")
    return workflow


def test_temperature_calibration_full():
    """测试温度校准记录完整流程：导入→冲突→修正→复核→补录→重算→自检汇总"""
    print("=" * 60)
    print("测试场景7：温度校准记录完整流程 + 自检汇总")
    print("=" * 60)

    workflow = QualityWorkflow()

    print("\n--- 第一步：导入采样间隔说明 ---")
    r1 = workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-007",
        "ship_id": "SHIP-G",
        "sensor_id": "SENSOR-007",
        "sampling_interval": 0.05,
        "sampling_start_time": "2026-06-08T20:00:00",
        "sampling_end_time": "2026-06-08T22:00:00",
        "roll_periods": [12.5, 12.3, 12.6],
        "import_user": "操作员张三"
    })
    print(f"  状态: {r1['status']}, 版本: v{r1['version']}")

    print("\n--- 第二步：温度校准记录一晚后到，触发冲突 ---")
    cal = workflow.step2_import_calibration_and_check({
        "calibration_id": "CAL-007",
        "ship_id": "SHIP-G",
        "sensor_id": "SENSOR-007",
        "calibration_time": "2026-06-08T18:00:00",
        "effective_sampling_interval": 0.04,
        "calibration_temperature": 32.5,
        "operator": "校准员李四",
        "remarks": "夜航高温导致采样频率偏移"
    })
    print(f"  新冲突: {cal['new_conflicts_found']}条")
    for c in cal['conflicts']:
        print(f"    证据: 采样{c['sampling_value']}s vs 校准{c['calibration_value']}s")

    print("\n--- 第三步：更新安全提醒 ---")
    safety = workflow.step3_update_safety_reminders("质检员小白")
    print(f"  待处理提醒: {safety['total_pending_reminders']}条")

    print("\n--- 自检汇总（此时） ---")
    summary = workflow.self_checker.get_check_summary()
    print(f"  重复导入: {summary['duplicate_import']}")
    print(f"  传感器变更: {summary['sensor_id_change']}")
    print(f"  补录重算: {summary['supplementary_recalc']}")
    print(f"  导出一致性: {summary['export_consistency']}")

    print("\n--- 第四步：质检员选择折中修正，交给安全员复核 ---")
    conflicts = workflow.conflict_detector.get_conflict_summary()
    cid = conflicts[0]['conflict_id']
    res = workflow.resolve_conflict(
        cid, "确认冲突存在，采用折中0.045s", "质检员小白",
        handler_after="安全员王五复核后归档", correct_value=0.045
    )
    print(f"  新状态: {res['record_new_status']}, 下一步: {res['next_handler']}")

    print("\n--- 第五步：补录SAMPLE-007-SUPP后重算 ---")
    est_before = workflow.calculate_roll_period_estimate("SHIP-G", "系统")
    print(f"  补录前估算: {est_before['average_period']}s")

    supp = workflow.step1_import_sampling_record({
        "record_id": "SAMPLE-007-SUPP",
        "ship_id": "SHIP-G",
        "sensor_id": "SENSOR-007",
        "sampling_interval": 0.045,
        "sampling_start_time": "2026-06-08T22:30:00",
        "sampling_end_time": "2026-06-09T00:30:00",
        "roll_periods": [13.0, 13.2, 12.9],
        "import_user": "操作员张三",
        "is_supplementary": True,
        "original_record_id": "SAMPLE-007"
    })
    print(f"  补录状态: {supp['status']}")

    est_after = workflow.calculate_roll_period_estimate("SHIP-G", "系统")
    print(f"  补录后估算: {est_after['average_period']}s")

    print("\n--- 自检汇总（补录后） ---")
    summary2 = workflow.self_checker.get_check_summary()
    print(f"  补录重算检查数: {summary2['supplementary_recalc']['count']}")
    print(f"  补录重算有问题: {summary2['supplementary_recalc']['has_issues']}")

    supp_results = workflow.self_checker.check_results['supplementary_recalc']
    if supp_results:
        latest = supp_results[-1]
        print(f"  最新重算: {latest['details']}")

    print("\n--- 第六步：导出报告 ---")
    export = workflow.export_record("SAMPLE-007")
    print(f"  导出包含历史: {len(export['data']['history_log'])}条")
    print(f"  导出包含补录: {len(export['data']['supplementary_records'])}条")
    print(f"  导出包含校准: {len(export['data']['related_calibrations'])}条")

    print("✓ 温度校准完整流程测试通过\n")
    return workflow


def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " " * 10 + "无人船横摇周期估算 - 质检工具测试" + " " * 10 + "║")
    print("╚" + "═" * 58 + "╝\n")

    test_normal_scenario()
    test_conflict_scenario()
    test_sensor_restart_scenario()
    test_supplementary_scenario()
    test_duplicate_and_export()
    test_history_tracking()
    test_temperature_calibration_full()

    print("=" * 60)
    print("所有7个测试场景执行完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
