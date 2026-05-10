import sys
from datetime import datetime, timedelta
from database import init_db
from sample_data import load_sample_data
from services import PatientService, FollowupService, EventService, RunLogService
from pipeline import FollowupPipeline, ReportExporter


def run_demo():
    print('=' * 60)
    print('口腔正畸复诊提醒器 - 完整业务流程演示')
    print('=' * 60)
    
    print('\n【步骤 1】初始化数据库')
    init_db()
    
    print('\n【步骤 2】加载样例数据（医生、排班、患者）')
    load_sample_data()
    
    patients = PatientService.get_patients()
    print(f'\n患者列表:')
    for p in patients:
        print(f'  ID:{p["id"]} {p["name"]} - 复诊周期:{p["followup_interval_weeks"]}周')
    
    today = datetime.now().date()
    check_date = today.strftime('%Y-%m-%d')
    
    print(f'\n【步骤 3】执行日常处理 - 日期: {check_date}')
    pipeline = FollowupPipeline()
    batch1 = pipeline.run('daily_process', check_date=check_date)
    print(f'处理批次: {batch1}')
    
    run_log = RunLogService.get_run_log_by_batch(batch1)
    print(f'状态: {run_log["status"]}')
    print(f'影响计划: {run_log["affected_plans"]}')
    print(f'创建事件: {run_log["events_created"]}')
    
    window_plans = FollowupService.get_plans_in_window(check_date)
    print(f'\n今日处于复诊窗口期的计划数: {len(window_plans)}')
    if window_plans:
        for plan in window_plans[:3]:
            print(f'  患者:{plan["patient_name"]} 计划#{plan["plan_number"]} 状态:{plan["status"]}')
    
    overdue_plans = FollowupService.get_overdue_plans(check_date)
    print(f'\n逾期未复诊计划数: {len(overdue_plans)}')
    
    if window_plans:
        plan_to_complete = window_plans[0]
        print(f'\n【步骤 4】完成复诊 - 患者:{plan_to_complete["patient_name"]} 计划#{plan_to_complete["plan_number"]}')
        batch2 = pipeline.run(
            'complete_plan',
            plan_id=plan_to_complete['id'],
            actual_date=check_date
        )
        print(f'完成批次: {batch2}')
        
        updated = FollowupService.get_patient_plans(plan_to_complete['patient_id'])
        completed_plan = next((p for p in updated if p['id'] == plan_to_complete['id']), None)
        if completed_plan:
            print(f'  状态更新: {plan_to_complete["status"]} -> {completed_plan["status"]}')
            print(f'  实际日期: {completed_plan["actual_date"]}')
            print(f'  关联排班: {completed_plan["schedule_id"]}')
    
    if window_plans and len(window_plans) > 1:
        plan_to_reschedule = window_plans[1]
        new_date = (today + timedelta(days=7)).strftime('%Y-%m-%d')
        print(f'\n【步骤 5】重新安排复诊 - 患者:{plan_to_reschedule["patient_name"]}')
        print(f'  原计划: {plan_to_reschedule["planned_date"]} -> 新计划: {new_date}')
        batch3 = pipeline.run(
            'reschedule_plan',
            plan_id=plan_to_reschedule['id'],
            new_planned_date=new_date
        )
        print(f'重排批次: {batch3}')
    
    if patients:
        patient_with_event = patients[0]
        print(f'\n【步骤 6】记录托槽脱落事件 - 患者:{patient_with_event["name"]}')
        batch4 = pipeline.run(
            'bracket_fall',
            patient_id=patient_with_event['id'],
            event_date=check_date,
            description='上牙左侧第3颗托槽脱落，无明显疼痛',
            impact_days=7
        )
        print(f'事件批次: {batch4}')
        
        events = EventService.get_events(patient_id=patient_with_event['id'])
        print(f'\n该患者事件列表:')
        for e in events:
            print(f'  ID:{e["id"]} 类型:{e["event_type"]} 日期:{e["event_date"]} 解决:{"是" if e["is_resolved"] else "否"}')
    
    print(f'\n【步骤 7】查看所有运行记录')
    runs = RunLogService.get_run_logs()
    print(f'共 {len(runs)} 次运行:')
    for r in runs:
        print(f'  批次:{r["run_batch"]} 类型:{r["run_type"]} 状态:{r["status"]}')
    
    print(f'\n【步骤 8】导出报告')
    run_log_for_export = RunLogService.get_run_log_by_batch(batch1)
    daily_report = ReportExporter.export_daily_report(check_date, run_log_for_export['id'])
    print(f'每日报告: {daily_report}')
    
    overdue_report = ReportExporter.export_overdue_report(check_date, run_log_for_export['id'])
    print(f'逾期报告: {overdue_report}')
    
    print('\n【步骤 9】验证重跑机制 - 再次运行日常处理')
    pipeline2 = FollowupPipeline()
    batch5 = pipeline2.run('daily_process', check_date=check_date)
    print(f'重跑批次: {batch5}')
    
    run_log2 = RunLogService.get_run_log_by_batch(batch5)
    print(f'影响计划: {run_log2["affected_plans"]} (应远小于第一次，状态已更新的不会重复处理)')
    
    all_runs = RunLogService.get_run_logs()
    print(f'\n总运行次数: {len(all_runs)}')
    
    print('\n【步骤 10】查看最新运行详情')
    last_run = all_runs[0]
    stats = RunLogService.get_statistics(last_run['id'])
    print(f'\n批次: {last_run["run_batch"]}')
    print('统计信息:')
    for s in stats:
        print(f'  {s["stat_key"]}: {s["stat_value"]}')
    
    history = RunLogService.get_run_history(last_run['id'])
    print(f'\n变更记录数: {len(history)}')
    
    print('\n' + '=' * 60)
    print('演示完成！请通过 CLI 命令查看更多详细信息:')
    print('  python cli.py patients       - 查看患者列表')
    print('  python cli.py patient-plans 1 - 查看患者1的所有复诊计划')
    print('  python cli.py events         - 查看异常事件')
    print('  python cli.py runs           - 查看运行记录')
    print('  python cli.py run-details <批次> - 查看运行详情')
    print('  python cli.py exports        - 查看导出记录')
    print('=' * 60)
    
    return 0


if __name__ == '__main__':
    sys.exit(run_demo())
