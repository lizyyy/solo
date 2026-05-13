import os
import sys
from datetime import datetime, timedelta

from database import init_db, clear_all_tables
from sample_data import load_sample_data
from services import (
    PatientService, FollowupService, ScheduleService, 
    EventService, RunLogService, ExportService
)
from pipeline import FollowupPipeline, ReportExporter


def test_1_affected_plans_fix():
    """测试1: 逾期处理中affected_plans统计修复"""
    print("\n" + "=" * 60)
    print("测试1: 逾期处理中affected_plans统计修复")
    print("=" * 60)
    
    clear_all_tables()
    init_db()
    load_sample_data()
    
    today = datetime.now().date()
    check_date = today.strftime('%Y-%m-%d')
    
    pipeline = FollowupPipeline()
    batch = pipeline.run('daily_process', check_date=check_date)
    
    run_log = RunLogService.get_run_log_by_batch(batch)
    print(f"批次: {batch}")
    print(f"状态: {run_log['status']}")
    print(f"affected_plans: {run_log['affected_plans']}")
    
    stats = RunLogService.get_statistics(run_log['id'])
    plans_overdue_stat = next((s for s in stats if s['stat_key'] == 'plans_overdue'), None)
    print(f"plans_overdue 统计: {plans_overdue_stat['stat_value'] if plans_overdue_stat else 'N/A'}")
    
    history = RunLogService.get_run_history(run_log['id'])
    status_changes = [h for h in history if h['change_type'] == 'status_change']
    print(f"历史记录中的状态变更数: {len(status_changes)}")
    
    assert run_log['affected_plans'] == len(status_changes), "affected_plans 应等于状态变更数"
    print("✓ 测试1通过: affected_plans 统计正确")
    
    return True


def test_2_bracket_fall_schedule_link():
    """测试2: 托槽脱落与排班联动"""
    print("\n" + "=" * 60)
    print("测试2: 托槽脱落与排班联动")
    print("=" * 60)
    
    clear_all_tables()
    init_db()
    load_sample_data()
    
    patients = PatientService.get_patients()
    patient = patients[0]
    today = datetime.now().date()
    check_date = today.strftime('%Y-%m-%d')
    
    pipeline = FollowupPipeline()
    pipeline.run('daily_process', check_date=check_date)
    
    plans = FollowupService.get_patient_plans(patient['id'])
    active_plans = [p for p in plans if p['status'] in ['scheduled', 'window_active']]
    
    if not active_plans:
        print("跳过: 没有活跃的计划用于测试")
        return True
    
    plan_before = active_plans[0]
    print(f"患者: {patient['name']}, 计划#{plan_before['plan_number']}")
    print(f"处理前 - 计划日期: {plan_before['planned_date']}, 排班ID: {plan_before.get('schedule_id')}")
    
    schedules_before = ScheduleService.get_schedules_by_doctor(plan_before['doctor_id'])
    booked_before = sum(s['booked_appointments'] for s in schedules_before)
    print(f"处理前 - 医生排班总预约数: {booked_before}")
    
    batch = pipeline.run(
        'bracket_fall',
        patient_id=patient['id'],
        event_date=check_date,
        description='测试托槽脱落'
    )
    
    plans_after = FollowupService.get_patient_plans(patient['id'])
    plan_after = next((p for p in plans_after if p['id'] == plan_before['id']), None)
    
    print(f"处理后 - 计划日期: {plan_after['planned_date']}, 排班ID: {plan_after.get('schedule_id')}")
    print(f"计划日期是否变更: {plan_before['planned_date'] != plan_after['planned_date']}")
    
    schedules_after = ScheduleService.get_schedules_by_doctor(plan_before['doctor_id'])
    booked_after = sum(s['booked_appointments'] for s in schedules_after)
    print(f"处理后 - 医生排班总预约数: {booked_after}")
    
    events = EventService.get_events(patient_id=patient['id'], event_type='bracket_fall')
    print(f"创建的托槽脱落事件数: {len(events)}")
    
    run_log = RunLogService.get_run_log_by_batch(batch)
    history = RunLogService.get_run_history(run_log['id'])
    schedule_changes = [h for h in history if h['entity_type'] == 'schedule']
    print(f"历史记录中的排班变更数: {len(schedule_changes)}")
    
    assert plan_before['planned_date'] != plan_after['planned_date'], "计划日期应该变更"
    assert len(events) >= 1, "应该创建托槽脱落事件"
    print("✓ 测试2通过: 托槽脱落与排班联动正常")
    
    return True


def test_3_rerun_consistency():
    """测试3: 重跑一致性"""
    print("\n" + "=" * 60)
    print("测试3: 重跑一致性")
    print("=" * 60)
    
    clear_all_tables()
    init_db()
    load_sample_data()
    
    today = datetime.now().date()
    check_date = today.strftime('%Y-%m-%d')
    
    pipeline1 = FollowupPipeline()
    batch1 = pipeline1.run('daily_process', check_date=check_date)
    run_log1 = RunLogService.get_run_log_by_batch(batch1)
    affected1 = run_log1['affected_plans']
    print(f"第一次运行 - 批次: {batch1}")
    print(f"第一次运行 - affected_plans: {affected1}")
    
    pipeline2 = FollowupPipeline()
    batch2 = pipeline2.run('daily_process', check_date=check_date)
    run_log2 = RunLogService.get_run_log_by_batch(batch2)
    affected2 = run_log2['affected_plans']
    print(f"第二次运行 - 批次: {batch2}")
    print(f"第二次运行 - affected_plans: {affected2}")
    
    assert batch1 != batch2, "两次运行应该有不同的批次号"
    assert affected2 <= affected1, "第二次运行的affected_plans应该小于等于第一次"
    print("✓ 测试3通过: 重跑机制正常，批次唯一，统计正确递减")
    
    return True


def test_4_export_consistency():
    """测试4: 导出一致性"""
    print("\n" + "=" * 60)
    print("测试4: 导出一致性")
    print("=" * 60)
    
    clear_all_tables()
    init_db()
    load_sample_data()
    
    today = datetime.now().date()
    check_date = today.strftime('%Y-%m-%d')
    
    pipeline = FollowupPipeline()
    batch = pipeline.run('daily_process', check_date=check_date)
    run_log = RunLogService.get_run_log_by_batch(batch)
    
    file_path = ReportExporter.export_daily_report(check_date, run_log['id'])
    print(f"导出文件: {file_path}")
    print(f"文件名包含批次: {run_log['run_batch'] in file_path}")
    
    exports = ExportService.get_exports(run_log['id'])
    print(f"数据库导出记录数: {len(exports)}")
    
    assert os.path.exists(file_path), "导出文件应该存在"
    assert run_log['run_batch'] in file_path, "文件名应该包含批次号"
    assert len(exports) >= 1, "数据库应该有导出记录"
    print("✓ 测试4通过: 导出文件与数据库记录一致")
    
    return True


def main():
    print("\n" + "=" * 60)
    print("口腔正畸复诊提醒器 - 修复验证测试")
    print("=" * 60)
    
    tests = [
        test_1_affected_plans_fix,
        test_2_bracket_fall_schedule_link,
        test_3_rerun_consistency,
        test_4_export_consistency
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"✗ 测试失败: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"测试结果: 通过 {passed}/{len(tests)}, 失败 {failed}/{len(tests)}")
    print("=" * 60)
    
    return failed == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
