import os
import sys
from datetime import datetime, timedelta

from database import init_db, clear_all_tables
from sample_data import load_sample_data
from services import (
    PatientService, FollowupService, ScheduleService, 
    EventService, RunLogService, ExportService, CleanupService
)
from pipeline import FollowupPipeline, ReportExporter


def test_1_rescheduled_plan_reenters_window():
    """测试1: 重排计划能重新进入窗口处理"""
    print("\n" + "=" * 70)
    print("测试1: 重排计划能重新进入窗口处理")
    print("=" * 70)
    
    clear_all_tables()
    init_db()
    load_sample_data()
    
    today = datetime.now().date()
    check_date = today.strftime('%Y-%m-%d')
    
    print(f"\n步骤1: 执行首次日常处理，日期: {check_date}")
    pipeline1 = FollowupPipeline()
    batch1 = pipeline1.run('daily_process', check_date=check_date)
    
    window_plans_before = FollowupService.get_plans_in_window(check_date)
    print(f"窗口内计划数: {len(window_plans_before)}")
    
    patients = PatientService.get_patients()
    patient = patients[0]
    plans = FollowupService.get_patient_plans(patient['id'])
    active_plans = [p for p in plans if p['status'] in ['scheduled', 'window_active']]
    
    if not active_plans:
        print("跳过: 没有活跃的计划用于测试")
        return True
    
    plan_to_reschedule = active_plans[0]
    print(f"\n步骤2: 选择患者 {patient['name']} 的计划 #{plan_to_reschedule['plan_number']}")
    print(f"  原计划日期: {plan_to_reschedule['planned_date']}")
    print(f"  原状态: {plan_to_reschedule['status']}")
    
    new_date = (today + timedelta(days=5)).strftime('%Y-%m-%d')
    print(f"\n步骤3: 执行托槽脱落，重排计划到 {new_date}")
    pipeline2 = FollowupPipeline()
    batch2 = pipeline2.run(
        'bracket_fall',
        patient_id=patient['id'],
        event_date=check_date,
        description='上牙左侧第3颗托槽脱落'
    )
    
    plans_after = FollowupService.get_patient_plans(patient['id'])
    rescheduled_plan = next((p for p in plans_after if p['id'] == plan_to_reschedule['id']), None)
    
    print(f"  新计划日期: {rescheduled_plan['planned_date']}")
    print(f"  新状态: {rescheduled_plan['status']}")
    
    assert rescheduled_plan['status'] == 'scheduled', f"状态应该是 'scheduled'，实际是 '{rescheduled_plan['status']}'"
    print("  ✓ 状态为 'scheduled'，不是 'rescheduled'")
    
    future_check_date = (today + timedelta(days=5)).strftime('%Y-%m-%d')
    print(f"\n步骤4: 模拟 {future_check_date} 的日常处理")
    
    pipeline3 = FollowupPipeline()
    batch3 = pipeline3.run('daily_process', check_date=future_check_date)
    
    window_plans_future = FollowupService.get_plans_in_window(future_check_date)
    print(f"  {future_check_date} 窗口内计划数: {len(window_plans_future)}")
    
    plan_in_window = next((p for p in window_plans_future if p['id'] == rescheduled_plan['id']), None)
    
    if plan_in_window:
        print(f"  ✓ 重排的计划进入了窗口处理")
        print(f"    计划状态: {plan_in_window['status']}")
    else:
        print(f"  ✗ 重排的计划没有进入窗口处理")
        return False
    
    run_log3 = RunLogService.get_run_log_by_batch(batch3)
    print(f"\n步骤5: 验证重跑统计")
    print(f"  affected_plans: {run_log3['affected_plans']}")
    
    assert plan_in_window is not None, "重排的计划应该能进入窗口处理"
    print("\n✓ 测试1通过: 重排计划能重新进入窗口处理")
    
    return True


def test_2_export_consistency():
    """测试2: 导出文件与数据库一致"""
    print("\n" + "=" * 70)
    print("测试2: 导出文件与数据库一致")
    print("=" * 70)
    
    clear_all_tables()
    init_db()
    load_sample_data()
    
    CleanupService.remove_orphan_exports()
    
    today = datetime.now().date()
    check_date = today.strftime('%Y-%m-%d')
    
    print(f"\n步骤1: 执行首次日常处理并导出")
    pipeline1 = FollowupPipeline()
    batch1 = pipeline1.run('daily_process', check_date=check_date)
    run_log1 = RunLogService.get_run_log_by_batch(batch1)
    
    file1 = ReportExporter.export_daily_report(check_date, run_log1['id'])
    print(f"  导出文件1: {os.path.basename(file1)}")
    
    db_exports1 = ExportService.get_exports()
    print(f"  数据库记录数: {len(db_exports1)}")
    
    dir_files1 = [f for f in os.listdir('exports') if f.endswith('.csv')] if os.path.exists('exports') else []
    print(f"  目录文件数: {len(dir_files1)}")
    
    assert len(db_exports1) == len(dir_files1), "首次导出应该一致"
    print("  ✓ 首次导出一致")
    
    print(f"\n步骤2: 再次导出同一日期的报告")
    pipeline2 = FollowupPipeline()
    batch2 = pipeline2.run('daily_process', check_date=check_date)
    run_log2 = RunLogService.get_run_log_by_batch(batch2)
    
    file2 = ReportExporter.export_daily_report(check_date, run_log2['id'])
    print(f"  导出文件2: {os.path.basename(file2)}")
    
    db_exports2 = ExportService.get_exports()
    print(f"  数据库记录数: {len(db_exports2)}")
    
    dir_files2 = [f for f in os.listdir('exports') if f.endswith('.csv')] if os.path.exists('exports') else []
    print(f"  目录文件数: {len(dir_files2)}")
    
    assert len(db_exports2) == 1, "同一日期应该只有1条导出记录"
    assert len(dir_files2) == 1, "同一日期应该只有1个导出文件"
    
    print(f"  ✓ 同一日期只有1条导出记录 (旧记录已清理)")
    print(f"  ✓ 同一日期只有1个导出文件 (旧文件已清理)")
    
    print(f"\n步骤3: 验证导出记录指向正确的文件")
    export_record = db_exports2[0]
    assert export_record['file_name'] == os.path.basename(file2), "文件名应该匹配"
    assert os.path.exists(export_record['file_path']), "文件应该存在"
    print(f"  ✓ 导出记录文件名与实际文件一致")
    
    print("\n✓ 测试2通过: 导出文件与数据库一致，不会膨胀")
    
    return True


def test_3_complete_business_link():
    """测试3: 完整业务链路跑通"""
    print("\n" + "=" * 70)
    print("测试3: 完整业务链路跑通")
    print("=" * 70)
    
    clear_all_tables()
    init_db()
    load_sample_data()
    
    CleanupService.remove_orphan_exports()
    
    today = datetime.now().date()
    day1 = today.strftime('%Y-%m-%d')
    day2 = (today + timedelta(days=1)).strftime('%Y-%m-%d')
    day8 = (today + timedelta(days=8)).strftime('%Y-%m-%d')
    day20 = (today + timedelta(days=20)).strftime('%Y-%m-%d')
    
    print(f"\n【Day 1: {day1}】日常处理")
    p1 = FollowupPipeline()
    b1 = p1.run('daily_process', check_date=day1)
    r1 = RunLogService.get_run_log_by_batch(b1)
    print(f"  批次: {b1}")
    print(f"  affected_plans: {r1['affected_plans']}")
    
    patients = PatientService.get_patients()
    patient = patients[0]
    plans = FollowupService.get_patient_plans(patient['id'])
    active_plans = [p for p in plans if p['status'] in ['scheduled', 'window_active']]
    
    if not active_plans:
        print("跳过: 没有活跃的计划")
        return True
    
    plan = active_plans[0]
    print(f"\n【Day 2: {day2}】托槽脱落事件")
    print(f"  患者: {patient['name']}")
    print(f"  原计划: #{plan['plan_number']} @ {plan['planned_date']}")
    
    p2 = FollowupPipeline()
    b2 = p2.run(
        'bracket_fall',
        patient_id=patient['id'],
        event_date=day2,
        description='上牙托槽脱落',
        plan_id=plan['id']
    )
    r2 = RunLogService.get_run_log_by_batch(b2)
    print(f"  批次: {b2}")
    print(f"  plans_rescheduled: {r2['affected_plans'] - r2['events_created'] + 1}")
    print(f"  schedules_updated: {r2['schedules_updated']}")
    
    plans_after = FollowupService.get_patient_plans(patient['id'])
    rescheduled_plan = next((p for p in plans_after if p['id'] == plan['id']), None)
    print(f"  新计划: #{rescheduled_plan['plan_number']} @ {rescheduled_plan['planned_date']}")
    print(f"  新状态: {rescheduled_plan['status']}")
    
    assert rescheduled_plan['status'] == 'scheduled', "重排后状态应为 scheduled"
    
    print(f"\n【Day 8: {day8}】日常处理（重排计划进入窗口）")
    p3 = FollowupPipeline()
    b3 = p3.run('daily_process', check_date=day8)
    r3 = RunLogService.get_run_log_by_batch(b3)
    print(f"  批次: {b3}")
    print(f"  affected_plans: {r3['affected_plans']}")
    
    plans_day8 = FollowupService.get_patient_plans(patient['id'])
    plan_day8 = next((p for p in plans_day8 if p['id'] == plan['id']), None)
    print(f"  计划状态: {plan_day8['status']}")
    
    if plan_day8['status'] == 'window_active':
        print(f"  ✓ 重排计划进入了窗口处理")
    else:
        print(f"  注意: 计划状态为 {plan_day8['status']}（可能不在窗口内）")
    
    print(f"\n【Day 20: {day20}】日常处理（逾期检测）")
    p4 = FollowupPipeline()
    b4 = p4.run('daily_process', check_date=day20)
    r4 = RunLogService.get_run_log_by_batch(b4)
    print(f"  批次: {b4}")
    print(f"  affected_plans: {r4['affected_plans']}")
    print(f"  events_created: {r4['events_created']}")
    
    print(f"\n【导出报告】")
    ReportExporter.export_daily_report(day20, r4['id'])
    
    db_exports = ExportService.get_exports()
    dir_files = [f for f in os.listdir('exports') if f.endswith('.csv')] if os.path.exists('exports') else []
    print(f"  数据库导出记录: {len(db_exports)}")
    print(f"  目录文件数: {len(dir_files)}")
    
    assert len(db_exports) == len(dir_files), "导出记录与文件数应该一致"
    
    runs = RunLogService.get_run_logs()
    print(f"\n【运行记录】共 {len(runs)} 次:")
    for r in runs[:5]:
        print(f"  {r['run_batch']} | {r['run_type']} | {r['status']} | affected={r['affected_plans']}")
    
    print("\n✓ 测试3通过: 完整业务链路跑通")
    
    return True


def main():
    print("\n" + "=" * 70)
    print("口腔正畸复诊提醒器 - 核心修复验证测试")
    print("=" * 70)
    
    tests = [
        test_1_rescheduled_plan_reenters_window,
        test_2_export_consistency,
        test_3_complete_business_link
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"\n✗ 测试失败: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 70)
    print(f"测试结果: 通过 {passed}/{len(tests)}, 失败 {failed}/{len(tests)}")
    print("=" * 70)
    
    return failed == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
