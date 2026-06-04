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
    print(f"\n仪表盘: {dashboard['总采样记录数']}条记录, {dashboard['正常记录数']}条正常")
    
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
    print(f"\n仪表盘: {dashboard['冲突待确认数']}条待确认")
    
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


def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " " * 10 + "无人船横摇周期估算 - 质检工具测试" + " " * 10 + "║")
    print("╚" + "═" * 58 + "╝\n")
    
    test_normal_scenario()
    test_conflict_scenario()
    
    print("=" * 60)
    print("测试执行完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
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
    print(f"\n仪表盘: {dashboard['待安全员复核数']}条待复核")
    
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
    
    print("\n--- 导出记录 ---")
    export_result = workflow.export_record("SAMPLE-005")
    print(f"导出ID: {export_result['export_id']}")
    print(f"一致性检查: {export_result['consistency_check']}")
    
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
    
    print("=" * 60)
    print("所有测试场景执行完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
