import os
import json
import uuid
from datetime import datetime, timedelta
from config import EXPORT_DIR
from database import get_db
from services import (
    FollowupService, EventService, ScheduleService, 
    RunLogService, ExportService, PatientService
)


class FollowupPipeline:
    def __init__(self):
        self.run_log_id = None
        self.run_batch = None
        self.stats = {
            'affected_patients': 0,
            'affected_plans': 0,
            'events_created': 0,
            'schedules_updated': 0,
            'plans_completed': 0,
            'plans_overdue': 0,
            'plans_rescheduled': 0,
            'plans_window_active': 0
        }
    
    def _record_history(self, entity_type, entity_id, old_value, new_value, change_type):
        if self.run_log_id:
            RunLogService.add_history(
                self.run_log_id, entity_type, entity_id,
                old_value, new_value, change_type
            )
    
    def _record_change(self, old_plan, new_status, actual_date=None, schedule_id=None):
        if old_plan['status'] != new_status:
            self._record_history(
                'followup_plan', old_plan['id'],
                old_plan['status'], new_status, 'status_change'
            )
            self.stats['affected_plans'] += 1
        
        if actual_date:
            if old_plan['actual_date'] != actual_date:
                self._record_history(
                    'followup_plan', old_plan['id'],
                    str(old_plan['actual_date']), actual_date, 'actual_date_set'
                )
    
    def _find_available_schedule(self, preferred_date, doctor_id=None):
        schedules = ScheduleService.get_available_schedules(preferred_date)
        
        if doctor_id:
            schedules = [s for s in schedules if s['doctor_id'] == doctor_id]
        
        if schedules:
            return schedules[0]['id']
        
        for i in range(1, 8):
            check_date = (datetime.strptime(preferred_date, '%Y-%m-%d') + timedelta(days=i)).strftime('%Y-%m-%d')
            schedules = ScheduleService.get_available_schedules(check_date)
            if doctor_id:
                schedules = [s for s in schedules if s['doctor_id'] == doctor_id]
            if schedules:
                return schedules[0]['id']
        
        return None
    
    def process_window_plans(self, check_date):
        plans = FollowupService.get_plans_in_window(check_date)
        
        for plan in plans:
            if plan['status'] == 'scheduled':
                old_status = plan['status']
                FollowupService.update_plan_status(plan['id'], 'window_active')
                self._record_history(
                    'followup_plan', plan['id'],
                    old_status, 'window_active', 'status_change'
                )
                self.stats['affected_plans'] += 1
                self.stats['plans_window_active'] += 1
    
    def process_overdue_plans(self, check_date):
        overdue_plans = FollowupService.get_overdue_plans(check_date)
        
        for plan in overdue_plans:
            old_status = plan['status']
            FollowupService.update_plan_status(plan['id'], 'overdue')
            self._record_history(
                'followup_plan', plan['id'],
                old_status, 'overdue', 'status_change'
            )
            self.stats['affected_plans'] += 1
            
            event_id = EventService.create_event(
                patient_id=plan['patient_id'],
                followup_plan_id=plan['id'],
                event_type='delay_visit',
                event_date=check_date,
                description=f'复诊逾期，计划日期: {plan["planned_date"]}',
                impact_days=7,
                severity='high'
            )
            self._record_history('event', event_id, None, 'created', 'event_create')
            self.stats['events_created'] += 1
            self.stats['plans_overdue'] += 1
    
    def complete_plan(self, plan_id, actual_date, schedule_id=None):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM followup_plans WHERE id = ?', (plan_id,))
            old_plan = dict(cursor.fetchone())
        
        schedule_id_to_use = schedule_id
        if not schedule_id_to_use and old_plan['doctor_id']:
            schedule_id_to_use = self._find_available_schedule(actual_date, old_plan['doctor_id'])
        
        FollowupService.update_plan_status(plan_id, 'completed', actual_date, schedule_id_to_use)
        self._record_change(old_plan, 'completed', actual_date, schedule_id_to_use)
        self.stats['plans_completed'] += 1
        
        if schedule_id_to_use:
            self.stats['schedules_updated'] += 1
    
    def _release_schedule(self, schedule_id):
        if not schedule_id:
            return False
        rowcount = 0
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE doctor_schedules 
                SET booked_appointments = MAX(0, booked_appointments - 1)
                WHERE id = ? AND booked_appointments > 0
            ''', (schedule_id,))
            rowcount = cursor.rowcount
        if rowcount > 0:
            self._record_history('schedule', schedule_id, 'booked', 'released', 'schedule_release')
            self.stats['schedules_updated'] += 1
            return True
        return False
    
    def _book_schedule_for_plan(self, plan_id, preferred_date, doctor_id=None):
        schedule_id = self._find_available_schedule(preferred_date, doctor_id)
        if schedule_id:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE followup_plans 
                    SET schedule_id = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (schedule_id, plan_id))
                cursor.execute('''
                    UPDATE doctor_schedules 
                    SET booked_appointments = booked_appointments + 1
                    WHERE id = ? AND booked_appointments < max_appointments
                ''', (schedule_id,))
            self._record_history('schedule', schedule_id, 'available', 'booked', 'schedule_book')
            self.stats['schedules_updated'] += 1
            return schedule_id
        return None
    
    def reschedule_plan(self, plan_id, new_planned_date, new_doctor_id=None):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM followup_plans WHERE id = ?', (plan_id,))
            old_plan = dict(cursor.fetchone())
        
        old_schedule_id = old_plan.get('schedule_id')
        doctor_to_use = new_doctor_id if new_doctor_id else old_plan.get('doctor_id')
        
        if old_schedule_id:
            self._release_schedule(old_schedule_id)
        
        FollowupService.reschedule_plan(plan_id, new_planned_date, new_doctor_id)
        self._record_history(
            'followup_plan', plan_id,
            old_plan['planned_date'], new_planned_date, 'reschedule'
        )
        
        if new_doctor_id and old_plan['doctor_id'] != new_doctor_id:
            self._record_history(
                'followup_plan', plan_id,
                str(old_plan['doctor_id']), str(new_doctor_id), 'doctor_change'
            )
        
        new_schedule_id = self._book_schedule_for_plan(plan_id, new_planned_date, doctor_to_use)
        if new_schedule_id:
            self._record_history(
                'followup_plan', plan_id,
                str(old_schedule_id), str(new_schedule_id), 'schedule_change'
            )
        
        self.stats['plans_rescheduled'] += 1
        self.stats['affected_plans'] += 1
    
    def _find_latest_active_plan(self, patient_id, event_date):
        plans = FollowupService.get_patient_plans(patient_id)
        active_statuses = ['scheduled', 'window_active']
        event_dt = datetime.strptime(event_date, '%Y-%m-%d')
        
        future_plans = []
        for plan in plans:
            if plan['status'] in active_statuses:
                plan_dt = datetime.strptime(plan['planned_date'], '%Y-%m-%d')
                days_diff = (plan_dt - event_dt).days
                if days_diff >= -7:
                    future_plans.append((abs(days_diff), plan))
        
        if future_plans:
            future_plans.sort(key=lambda x: x[0])
            return future_plans[0][1]
        return None
    
    def handle_bracket_fall(self, patient_id, event_date, description, plan_id=None, impact_days=7):
        if not plan_id:
            active_plan = self._find_latest_active_plan(patient_id, event_date)
            if active_plan:
                plan_id = active_plan['id']
        
        event_id = EventService.create_event(
            patient_id=patient_id,
            followup_plan_id=plan_id,
            event_type='bracket_fall',
            event_date=event_date,
            description=description,
            impact_days=impact_days,
            severity='high'
        )
        self._record_history('event', event_id, None, 'created', 'event_create')
        self.stats['events_created'] += 1
        
        if plan_id:
            planned_dt = datetime.strptime(event_date, '%Y-%m-%d') + timedelta(days=2)
            new_date = planned_dt.strftime('%Y-%m-%d')
            self.reschedule_plan(plan_id, new_date)
        
        return event_id
    
    def _save_stats(self):
        for key, value in self.stats.items():
            RunLogService.add_statistic(self.run_log_id, key, value)
    
    def run(self, run_type, check_date=None, **kwargs):
        if not check_date:
            check_date = datetime.now().strftime('%Y-%m-%d')
        
        self.run_batch = f"{run_type}_{check_date}_{uuid.uuid4().hex[:8]}"
        parameters = json.dumps({'check_date': check_date, **kwargs}, ensure_ascii=False)
        self.run_log_id = RunLogService.create_run_log(self.run_batch, run_type, parameters)
        
        try:
            if run_type == 'daily_process':
                self.process_window_plans(check_date)
                self.process_overdue_plans(check_date)
            elif run_type == 'complete_plan':
                self.complete_plan(kwargs['plan_id'], kwargs['actual_date'], kwargs.get('schedule_id'))
            elif run_type == 'reschedule_plan':
                self.reschedule_plan(kwargs['plan_id'], kwargs['new_planned_date'], kwargs.get('new_doctor_id'))
            elif run_type == 'bracket_fall':
                self.handle_bracket_fall(
                    kwargs['patient_id'], kwargs['event_date'], 
                    kwargs.get('description', ''), kwargs.get('plan_id'),
                    kwargs.get('impact_days', 7)
                )
            elif run_type == 'full_refresh':
                self.process_window_plans(check_date)
                self.process_overdue_plans(check_date)
            
            self._save_stats()
            RunLogService.update_run_log(
                self.run_log_id,
                status='success',
                end_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                affected_patients=self.stats['affected_patients'],
                affected_plans=self.stats['affected_plans'],
                events_created=self.stats['events_created'],
                schedules_updated=self.stats['schedules_updated']
            )
            
            return self.run_batch
            
        except Exception as e:
            RunLogService.update_run_log(
                self.run_log_id,
                status='failed',
                end_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                error_message=str(e)
            )
            raise


class ReportExporter:
    @staticmethod
    def _get_suffix(run_log_id=None):
        if run_log_id:
            run_logs = RunLogService.get_run_logs()
            run_log = next((r for r in run_logs if r['id'] == run_log_id), None)
            if run_log:
                return run_log['run_batch']
        return datetime.now().strftime('%Y%m%d_%H%M%S')
    
    @staticmethod
    def export_daily_report(check_date, run_log_id=None):
        window_plans = FollowupService.get_plans_in_window(check_date)
        overdue_plans = FollowupService.get_overdue_plans(check_date)
        patients = PatientService.get_patients()
        unresolved_events = EventService.get_events(unresolved_only=True)
        
        suffix = ReportExporter._get_suffix(run_log_id)
        file_name = f"daily_report_{check_date}_{suffix}.csv"
        file_path = os.path.join(EXPORT_DIR, file_name)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('口腔正畸复诊每日报告\n')
            f.write(f'报告日期: {check_date}\n')
            if run_log_id:
                f.write(f'关联批次: {suffix}\n')
            f.write('\n')
            
            f.write('=== 今日处于复诊窗口期的患者 ===\n')
            f.write('患者姓名,计划编号,计划日期,窗口开始,窗口结束,状态,负责医生\n')
            for plan in window_plans:
                f.write(f"{plan.get('patient_name','')},{plan['plan_number']},{plan['planned_date']},{plan['window_start']},{plan['window_end']},{plan['status']},{plan.get('doctor_name','')}\n")
            f.write(f'总计: {len(window_plans)} 人\n\n')
            
            f.write('=== 逾期未复诊的患者 ===\n')
            f.write('患者姓名,计划编号,计划日期,逾期天数,状态,负责医生\n')
            today = datetime.strptime(check_date, '%Y-%m-%d')
            for plan in overdue_plans:
                plan_end = datetime.strptime(plan['window_end'], '%Y-%m-%d')
                overdue_days = (today - plan_end).days
                f.write(f"{plan.get('patient_name','')},{plan['plan_number']},{plan['planned_date']},{overdue_days},{plan['status']},{plan.get('doctor_name','')}\n")
            f.write(f'总计: {len(overdue_plans)} 人\n\n')
            
            f.write('=== 未处理的异常事件 ===\n')
            f.write('事件ID,患者姓名,事件类型,事件日期,严重程度,影响天数,描述\n')
            for event in unresolved_events:
                f.write(f"{event['id']},{event.get('patient_name','')},{event['event_type']},{event['event_date']},{event['severity']},{event['impact_days']},{event.get('description','')}\n")
            f.write(f'总计: {len(unresolved_events)} 个\n\n')
            
            f.write('=== 患者概览 ===\n')
            f.write('患者总数: {}\n'.format(len(patients)))
        
        record_count = len(window_plans) + len(overdue_plans) + len(unresolved_events)
        
        if run_log_id:
            ExportService.create_export_record(run_log_id, 'daily_report', file_name, file_path, record_count)
        
        return file_path
    
    @staticmethod
    def export_overdue_report(check_date, run_log_id=None):
        overdue_plans = FollowupService.get_overdue_plans(check_date)
        
        suffix = ReportExporter._get_suffix(run_log_id)
        file_name = f"overdue_report_{check_date}_{suffix}.csv"
        file_path = os.path.join(EXPORT_DIR, file_name)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('逾期复诊患者报告\n')
            f.write(f'统计日期: {check_date}\n')
            if run_log_id:
                f.write(f'关联批次: {suffix}\n')
            f.write('\n')
            f.write('患者姓名,电话,计划编号,计划日期,窗口结束,逾期天数,负责医生,备注\n')
            
            today = datetime.strptime(check_date, '%Y-%m-%d')
            for plan in overdue_plans:
                plan_end = datetime.strptime(plan['window_end'], '%Y-%m-%d')
                overdue_days = (today - plan_end).days
                patient = PatientService.get_patient_by_id(plan['patient_id'])
                phone = patient.get('phone', '') if patient else ''
                f.write(f"{plan.get('patient_name','')},{phone},{plan['plan_number']},{plan['planned_date']},{plan['window_end']},{overdue_days},{plan.get('doctor_name','')},{plan.get('notes','')}\n")
            f.write(f'\n总计逾期: {len(overdue_plans)} 人\n')
        
        if run_log_id:
            ExportService.create_export_record(run_log_id, 'overdue_report', file_name, file_path, len(overdue_plans))
        
        return file_path
    
    @staticmethod
    def export_run_log_report(run_log_id):
        run_logs = RunLogService.get_run_logs()
        run_log = next((r for r in run_logs if r['id'] == run_log_id), None)
        if not run_log:
            return None
        
        stats = RunLogService.get_statistics(run_log_id)
        history = RunLogService.get_run_history(run_log_id)
        
        file_name = f"run_log_{run_log['run_batch']}.csv"
        file_path = os.path.join(EXPORT_DIR, file_name)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('运行日志报告\n')
            f.write(f'批次号: {run_log["run_batch"]}\n')
            f.write(f'运行类型: {run_log["run_type"]}\n')
            f.write(f'状态: {run_log["status"]}\n')
            f.write(f'开始时间: {run_log["start_time"]}\n')
            f.write(f'结束时间: {run_log.get("end_time","")}\n\n')
            
            f.write('=== 统计信息 ===\n')
            f.write('统计项,值\n')
            for stat in stats:
                f.write(f"{stat['stat_key']},{stat['stat_value']}\n")
            f.write('\n')
            
            f.write('=== 变更历史 ===\n')
            f.write('实体类型,实体ID,变更类型,旧值,新值,时间\n')
            for h in history:
                f.write(f"{h['entity_type']},{h['entity_id']},{h['change_type']},{h.get('old_value','')},{h.get('new_value','')},{h['created_at']}\n")
        
        ExportService.create_export_record(run_log_id, 'run_log_report', file_name, file_path, len(history))
        return file_path
