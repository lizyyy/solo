import argparse
import sys
import os
from datetime import datetime
from tabulate import tabulate
from database import init_db, clear_all_tables
from services import (
    DoctorService, ScheduleService, PatientService, 
    FollowupService, EventService, RunLogService, ExportService, CleanupService
)
from pipeline import FollowupPipeline, ReportExporter


class CommandToolkit:
    def __init__(self):
        self.pipeline = FollowupPipeline()
    
    def cmd_init(self, args):
        init_db()
        print('数据库初始化完成')
    
    def cmd_clear(self, args):
        if args.confirm:
            clear_all_tables()
            print('所有数据已清空')
        else:
            print('请使用 --confirm 参数确认清空操作')
    
    def cmd_list_doctors(self, args):
        doctors = DoctorService.get_doctors()
        if doctors:
            headers = ['ID', '姓名', '科室', '电话']
            rows = [[d['id'], d['name'], d.get('department',''), d.get('phone','')] for d in doctors]
            print(tabulate(rows, headers=headers, tablefmt='simple'))
        else:
            print('暂无医生数据')
    
    def cmd_list_patients(self, args):
        patients = PatientService.get_patients()
        if patients:
            headers = ['ID', '姓名', '年龄', '电话', '治疗开始', '复诊周期(周)', '医生']
            rows = [[
                p['id'], p['name'], p.get('age',''), p.get('phone',''),
                p['treatment_start_date'], p['followup_interval_weeks'],
                p.get('doctor_name','')
            ] for p in patients]
            print(tabulate(rows, headers=headers, tablefmt='simple'))
        else:
            print('暂无患者数据')
    
    def cmd_patient_plans(self, args):
        plans = FollowupService.get_patient_plans(args.patient_id)
        if plans:
            headers = ['计划ID', '编号', '计划日期', '窗口开始', '窗口结束', '状态', '实际日期', '医生']
            rows = [[
                p['id'], p['plan_number'], p['planned_date'],
                p['window_start'], p['window_end'], p['status'],
                p.get('actual_date',''), p.get('doctor_name','')
            ] for p in plans]
            print(tabulate(rows, headers=headers, tablefmt='simple'))
        else:
            print('该患者暂无复诊计划')
    
    def cmd_list_schedules(self, args):
        schedules = ScheduleService.get_available_schedules(args.date)
        if schedules:
            headers = ['排班ID', '医生', '日期', '开始时间', '结束时间', '最大预约', '已预约']
            rows = [[
                s['id'], s['doctor_name'], s['schedule_date'],
                s['start_time'], s['end_time'], s['max_appointments'],
                s['booked_appointments']
            ] for s in schedules]
            print(tabulate(rows, headers=headers, tablefmt='simple'))
        else:
            print('暂无可用排班')
    
    def cmd_list_events(self, args):
        events = EventService.get_events(
            patient_id=args.patient_id,
            event_type=args.event_type,
            unresolved_only=args.unresolved
        )
        if events:
            headers = ['事件ID', '患者', '类型', '日期', '严重程度', '是否解决', '描述']
            rows = [[
                e['id'], e.get('patient_name',''), e['event_type'],
                e['event_date'], e['severity'],
                '是' if e['is_resolved'] else '否',
                e.get('description','')[:30]
            ] for e in events]
            print(tabulate(rows, headers=headers, tablefmt='simple'))
        else:
            print('暂无异常事件')
    
    def cmd_list_runs(self, args):
        runs = RunLogService.get_run_logs()
        if runs:
            headers = ['批次', '类型', '状态', '开始时间', '影响计划', '创建事件', '更新排班']
            rows = [[
                r['run_batch'], r['run_type'], r['status'],
                r['start_time'], r['affected_plans'],
                r['events_created'], r['schedules_updated']
            ] for r in runs]
            print(tabulate(rows, headers=headers, tablefmt='simple'))
        else:
            print('暂无运行记录')
    
    def cmd_run_details(self, args):
        run_log = RunLogService.get_run_log_by_batch(args.batch)
        if not run_log:
            print('未找到该批次记录')
            return
        
        print(f"\n批次: {run_log['run_batch']}")
        print(f"类型: {run_log['run_type']}")
        print(f"状态: {run_log['status']}")
        print(f"开始时间: {run_log['start_time']}")
        print(f"结束时间: {run_log.get('end_time', '-')}")
        if run_log.get('error_message'):
            print(f"错误信息: {run_log['error_message']}")
        
        stats = RunLogService.get_statistics(run_log['id'])
        if stats:
            print('\n=== 统计信息 ===')
            for s in stats:
                print(f"{s['stat_key']}: {s['stat_value']}")
        
        history = RunLogService.get_run_history(run_log['id'])
        if history:
            print('\n=== 变更历史 ===')
            headers = ['实体类型', '实体ID', '变更类型', '旧值', '新值']
            rows = [[
                h['entity_type'], h['entity_id'], h['change_type'],
                h.get('old_value','')[:20], h.get('new_value','')[:20]
            ] for h in history]
            print(tabulate(rows, headers=headers, tablefmt='simple'))
    
    def cmd_daily_process(self, args):
        run_batch = self.pipeline.run('daily_process', check_date=args.date)
        print(f'日常处理完成，批次: {run_batch}')
        
        if args.export:
            run_log = RunLogService.get_run_log_by_batch(run_batch)
            file_path = ReportExporter.export_daily_report(args.date, run_log['id'])
            print(f'报告已导出: {file_path}')
    
    def cmd_complete_plan(self, args):
        run_batch = self.pipeline.run(
            'complete_plan',
            plan_id=args.plan_id,
            actual_date=args.actual_date,
            schedule_id=args.schedule_id
        )
        print(f'复诊完成，批次: {run_batch}')
    
    def cmd_reschedule(self, args):
        run_batch = self.pipeline.run(
            'reschedule_plan',
            plan_id=args.plan_id,
            new_planned_date=args.new_date,
            new_doctor_id=args.new_doctor_id
        )
        print(f'已重新安排，批次: {run_batch}')
    
    def cmd_bracket_fall(self, args):
        run_batch = self.pipeline.run(
            'bracket_fall',
            patient_id=args.patient_id,
            event_date=args.event_date,
            description=args.description,
            plan_id=args.plan_id
        )
        print(f'托槽脱落事件已记录，批次: {run_batch}')
    
    def cmd_resolve_event(self, args):
        success = EventService.resolve_event(args.event_id)
        if success:
            print(f'事件 {args.event_id} 已标记为已解决')
        else:
            print('事件未找到')
    
    def cmd_export_daily(self, args):
        file_path = ReportExporter.export_daily_report(args.date)
        print(f'报告已导出: {file_path}')
    
    def cmd_export_overdue(self, args):
        file_path = ReportExporter.export_overdue_report(args.date)
        print(f'逾期报告已导出: {file_path}')
    
    def cmd_export_run(self, args):
        run_log = RunLogService.get_run_log_by_batch(args.batch)
        if run_log:
            file_path = ReportExporter.export_run_log_report(run_log['id'])
            print(f'运行日志报告已导出: {file_path}')
        else:
            print('未找到该批次记录')
    
    def cmd_list_exports(self, args):
        exports = ExportService.get_exports()
        if exports:
            headers = ['ID', '导出类型', '文件名', '记录数', '创建时间']
            rows = [[
                e['id'], e['export_type'], e['file_name'],
                e['record_count'], e['created_at']
            ] for e in exports]
            print(tabulate(rows, headers=headers, tablefmt='simple'))
        else:
            print('暂无导出记录')
    
    def cmd_cleanup_failed(self, args):
        count = CleanupService.remove_failed_runs()
        print(f'已清理 {count} 个失败的运行批次')
    
    def cmd_cleanup_orphan(self, args):
        count = CleanupService.remove_orphan_exports()
        print(f'已清理 {count} 个孤立的导出文件')
    
    def cmd_cleanup_full(self, args):
        if args.confirm:
            result = CleanupService.full_cleanup()
            print(f'清理完成: 失败批次={result["failed_runs"]}, 孤立文件={result["orphan_exports"]}')
        else:
            print('请使用 --confirm 参数确认清理操作')


def main():
    parser = argparse.ArgumentParser(description='口腔正畸复诊提醒器')
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    init_parser = subparsers.add_parser('init', help='初始化数据库')
    init_parser.set_defaults(func=CommandToolkit().cmd_init)
    
    clear_parser = subparsers.add_parser('clear', help='清空所有数据')
    clear_parser.add_argument('--confirm', action='store_true', help='确认清空')
    clear_parser.set_defaults(func=CommandToolkit().cmd_clear)
    
    list_doctors = subparsers.add_parser('doctors', help='列出医生')
    list_doctors.set_defaults(func=CommandToolkit().cmd_list_doctors)
    
    list_patients = subparsers.add_parser('patients', help='列出患者')
    list_patients.set_defaults(func=CommandToolkit().cmd_list_patients)
    
    patient_plans = subparsers.add_parser('patient-plans', help='查看患者复诊计划')
    patient_plans.add_argument('patient_id', type=int, help='患者ID')
    patient_plans.set_defaults(func=CommandToolkit().cmd_patient_plans)
    
    list_schedules = subparsers.add_parser('schedules', help='列出可用排班')
    list_schedules.add_argument('--date', help='指定日期 (YYYY-MM-DD)')
    list_schedules.set_defaults(func=CommandToolkit().cmd_list_schedules)
    
    list_events = subparsers.add_parser('events', help='列出异常事件')
    list_events.add_argument('--patient-id', type=int, help='患者ID')
    list_events.add_argument('--event-type', help='事件类型')
    list_events.add_argument('--unresolved', action='store_true', help='仅显示未解决')
    list_events.set_defaults(func=CommandToolkit().cmd_list_events)
    
    list_runs = subparsers.add_parser('runs', help='列出运行记录')
    list_runs.set_defaults(func=CommandToolkit().cmd_list_runs)
    
    run_details = subparsers.add_parser('run-details', help='查看运行详情')
    run_details.add_argument('batch', help='批次号')
    run_details.set_defaults(func=CommandToolkit().cmd_run_details)
    
    daily_process = subparsers.add_parser('daily', help='执行日常处理')
    daily_process.add_argument('--date', default=datetime.now().strftime('%Y-%m-%d'), help='处理日期')
    daily_process.add_argument('--export', action='store_true', help='导出报告')
    daily_process.set_defaults(func=CommandToolkit().cmd_daily_process)
    
    complete_plan = subparsers.add_parser('complete', help='标记复诊完成')
    complete_plan.add_argument('plan_id', type=int, help='计划ID')
    complete_plan.add_argument('--actual-date', default=datetime.now().strftime('%Y-%m-%d'), help='实际日期')
    complete_plan.add_argument('--schedule-id', type=int, help='排班ID')
    complete_plan.set_defaults(func=CommandToolkit().cmd_complete_plan)
    
    reschedule = subparsers.add_parser('reschedule', help='重新安排复诊')
    reschedule.add_argument('plan_id', type=int, help='计划ID')
    reschedule.add_argument('new_date', help='新计划日期 (YYYY-MM-DD)')
    reschedule.add_argument('--new-doctor-id', type=int, help='新医生ID')
    reschedule.set_defaults(func=CommandToolkit().cmd_reschedule)
    
    bracket_fall = subparsers.add_parser('bracket', help='记录托槽脱落事件')
    bracket_fall.add_argument('patient_id', type=int, help='患者ID')
    bracket_fall.add_argument('--event-date', default=datetime.now().strftime('%Y-%m-%d'), help='事件日期')
    bracket_fall.add_argument('--description', default='', help='描述')
    bracket_fall.add_argument('--plan-id', type=int, help='相关计划ID')
    bracket_fall.set_defaults(func=CommandToolkit().cmd_bracket_fall)
    
    resolve_event = subparsers.add_parser('resolve', help='标记事件已解决')
    resolve_event.add_argument('event_id', type=int, help='事件ID')
    resolve_event.set_defaults(func=CommandToolkit().cmd_resolve_event)
    
    export_daily = subparsers.add_parser('export-daily', help='导出每日报告')
    export_daily.add_argument('--date', default=datetime.now().strftime('%Y-%m-%d'), help='报告日期')
    export_daily.set_defaults(func=CommandToolkit().cmd_export_daily)
    
    export_overdue = subparsers.add_parser('export-overdue', help='导出逾期报告')
    export_overdue.add_argument('--date', default=datetime.now().strftime('%Y-%m-%d'), help='报告日期')
    export_overdue.set_defaults(func=CommandToolkit().cmd_export_overdue)
    
    export_run = subparsers.add_parser('export-run', help='导出运行日志报告')
    export_run.add_argument('batch', help='批次号')
    export_run.set_defaults(func=CommandToolkit().cmd_export_run)
    
    list_exports = subparsers.add_parser('exports', help='列出导出记录')
    list_exports.set_defaults(func=CommandToolkit().cmd_list_exports)
    
    cleanup_failed = subparsers.add_parser('cleanup-failed', help='清理失败的运行批次')
    cleanup_failed.set_defaults(func=CommandToolkit().cmd_cleanup_failed)
    
    cleanup_orphan = subparsers.add_parser('cleanup-orphan', help='清理孤立的导出文件')
    cleanup_orphan.set_defaults(func=CommandToolkit().cmd_cleanup_orphan)
    
    cleanup_full = subparsers.add_parser('cleanup-full', help='完全清理（失败批次+孤立文件）')
    cleanup_full.add_argument('--confirm', action='store_true', help='确认清理')
    cleanup_full.set_defaults(func=CommandToolkit().cmd_cleanup_full)
    
    args = parser.parse_args()
    
    if args.command:
        args.func(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
