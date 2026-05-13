import sqlite3
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from database import get_db


class DoctorService:
    @staticmethod
    def create_doctor(name, department=None, phone=None):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO doctors (name, department, phone)
                VALUES (?, ?, ?)
            ''', (name, department, phone))
            return cursor.lastrowid
    
    @staticmethod
    def get_doctors():
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM doctors')
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def get_doctor_by_id(doctor_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM doctors WHERE id = ?', (doctor_id,))
            row = cursor.fetchone()
            return dict(row) if row else None


class ScheduleService:
    @staticmethod
    def create_schedule(doctor_id, schedule_date, start_time, end_time, max_appointments=10, notes=None):
        with get_db() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('''
                    INSERT INTO doctor_schedules 
                    (doctor_id, schedule_date, start_time, end_time, max_appointments, notes)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (doctor_id, schedule_date, start_time, end_time, max_appointments, notes))
                return cursor.lastrowid
            except sqlite3.IntegrityError:
                cursor.execute('''
                    SELECT id FROM doctor_schedules 
                    WHERE doctor_id = ? AND schedule_date = ? AND start_time = ?
                ''', (doctor_id, schedule_date, start_time))
                return cursor.fetchone()[0]
    
    @staticmethod
    def get_available_schedules(schedule_date=None):
        with get_db() as conn:
            cursor = conn.cursor()
            if schedule_date:
                cursor.execute('''
                    SELECT ds.*, d.name as doctor_name
                    FROM doctor_schedules ds
                    JOIN doctors d ON ds.doctor_id = d.id
                    WHERE ds.schedule_date = ? 
                    AND ds.booked_appointments < ds.max_appointments
                    ORDER BY ds.schedule_date, ds.start_time
                ''', (schedule_date,))
            else:
                cursor.execute('''
                    SELECT ds.*, d.name as doctor_name
                    FROM doctor_schedules ds
                    JOIN doctors d ON ds.doctor_id = d.id
                    WHERE ds.booked_appointments < ds.max_appointments
                    ORDER BY ds.schedule_date, ds.start_time
                ''')
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def book_appointment(schedule_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE doctor_schedules 
                SET booked_appointments = booked_appointments + 1
                WHERE id = ? AND booked_appointments < max_appointments
            ''', (schedule_id,))
            return cursor.rowcount > 0
    
    @staticmethod
    def get_schedules_by_doctor(doctor_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM doctor_schedules 
                WHERE doctor_id = ?
                ORDER BY schedule_date, start_time
            ''', (doctor_id,))
            return [dict(row) for row in cursor.fetchall()]


class PatientService:
    @staticmethod
    def create_patient(name, age, phone, treatment_start_date, followup_interval_weeks, doctor_id=None, notes=None):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO patients 
                (name, age, phone, treatment_start_date, followup_interval_weeks, doctor_id, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (name, age, phone, treatment_start_date, followup_interval_weeks, doctor_id, notes))
            patient_id = cursor.lastrowid
            PatientService.generate_followup_plans(conn, patient_id, treatment_start_date, followup_interval_weeks, doctor_id)
            return patient_id
    
    @staticmethod
    def generate_followup_plans(conn, patient_id, start_date, interval_weeks, doctor_id):
        cursor = conn.cursor()
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        total_months = 24
        
        for i in range(1, int(total_months * 4 / interval_weeks) + 1):
            planned_dt = start_dt + timedelta(weeks=i * interval_weeks)
            window_start = planned_dt - timedelta(days=3)
            window_end = planned_dt + timedelta(days=3)
            
            cursor.execute('''
                INSERT INTO followup_plans 
                (patient_id, plan_number, planned_date, window_start, window_end, doctor_id)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                patient_id,
                i,
                planned_dt.strftime('%Y-%m-%d'),
                window_start.strftime('%Y-%m-%d'),
                window_end.strftime('%Y-%m-%d'),
                doctor_id
            ))
    
    @staticmethod
    def get_patients():
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.*, d.name as doctor_name
                FROM patients p
                LEFT JOIN doctors d ON p.doctor_id = d.id
            ''')
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def get_patient_by_id(patient_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT p.*, d.name as doctor_name
                FROM patients p
                LEFT JOIN doctors d ON p.doctor_id = d.id
                WHERE p.id = ?
            ''', (patient_id,))
            row = cursor.fetchone()
            return dict(row) if row else None


class FollowupService:
    @staticmethod
    def get_patient_plans(patient_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT fp.*, d.name as doctor_name
                FROM followup_plans fp
                LEFT JOIN doctors d ON fp.doctor_id = d.id
                WHERE fp.patient_id = ?
                ORDER BY fp.plan_number
            ''', (patient_id,))
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def get_plans_by_status(status):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT fp.*, p.name as patient_name, d.name as doctor_name
                FROM followup_plans fp
                JOIN patients p ON fp.patient_id = p.id
                LEFT JOIN doctors d ON fp.doctor_id = d.id
                WHERE fp.status = ?
                ORDER BY fp.planned_date
            ''', (status,))
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def get_plans_in_window(check_date):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT fp.*, p.name as patient_name, d.name as doctor_name
                FROM followup_plans fp
                JOIN patients p ON fp.patient_id = p.id
                LEFT JOIN doctors d ON fp.doctor_id = d.id
                WHERE ? BETWEEN fp.window_start AND fp.window_end
                AND fp.status IN ('scheduled', 'window_active')
                ORDER BY fp.planned_date
            ''', (check_date,))
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def get_overdue_plans(check_date):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT fp.*, p.name as patient_name, d.name as doctor_name
                FROM followup_plans fp
                JOIN patients p ON fp.patient_id = p.id
                LEFT JOIN doctors d ON fp.doctor_id = d.id
                WHERE fp.window_end < ?
                AND fp.status IN ('scheduled', 'window_active')
                ORDER BY fp.window_end
            ''', (check_date,))
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def update_plan_status(plan_id, status, actual_date=None, schedule_id=None):
        with get_db() as conn:
            cursor = conn.cursor()
            updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP']
            params = [status]
            
            if actual_date:
                updates.append('actual_date = ?')
                params.append(actual_date)
            
            if schedule_id:
                updates.append('schedule_id = ?')
                params.append(schedule_id)
                cursor.execute('SELECT doctor_id FROM doctor_schedules WHERE id = ?', (schedule_id,))
                row = cursor.fetchone()
                if row:
                    updates.append('doctor_id = ?')
                    params.append(row[0])
            
            params.append(plan_id)
            cursor.execute(f'''
                UPDATE followup_plans 
                SET {', '.join(updates)}
                WHERE id = ?
            ''', params)
            
            if schedule_id:
                cursor.execute('''
                    UPDATE doctor_schedules 
                    SET booked_appointments = booked_appointments + 1
                    WHERE id = ? AND booked_appointments < max_appointments
                ''', (schedule_id,))
            
            return cursor.rowcount > 0
    
    @staticmethod
    def reschedule_plan(plan_id, new_planned_date, new_doctor_id=None):
        with get_db() as conn:
            cursor = conn.cursor()
            planned_dt = datetime.strptime(new_planned_date, '%Y-%m-%d')
            window_start = planned_dt - timedelta(days=3)
            window_end = planned_dt + timedelta(days=3)
            
            updates = [
                'planned_date = ?',
                'window_start = ?',
                'window_end = ?',
                'status = ?',
                'updated_at = CURRENT_TIMESTAMP'
            ]
            params = [new_planned_date, window_start.strftime('%Y-%m-%d'), window_end.strftime('%Y-%m-%d'), 'rescheduled']
            
            if new_doctor_id:
                updates.append('doctor_id = ?')
                params.append(new_doctor_id)
            
            params.append(plan_id)
            cursor.execute(f'''
                UPDATE followup_plans 
                SET {', '.join(updates)}
                WHERE id = ?
            ''', params)
            
            return cursor.rowcount > 0


class EventService:
    @staticmethod
    def create_event(patient_id, event_type, event_date, description=None, impact_days=0, severity='medium', followup_plan_id=None):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO events 
                (patient_id, followup_plan_id, event_type, event_date, description, impact_days, severity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (patient_id, followup_plan_id, event_type, event_date, description, impact_days, severity))
            return cursor.lastrowid
    
    @staticmethod
    def get_events(patient_id=None, event_type=None, unresolved_only=False):
        with get_db() as conn:
            cursor = conn.cursor()
            query = '''
                SELECT e.*, p.name as patient_name, fp.plan_number
                FROM events e
                JOIN patients p ON e.patient_id = p.id
                LEFT JOIN followup_plans fp ON e.followup_plan_id = fp.id
                WHERE 1=1
            '''
            params = []
            
            if patient_id:
                query += ' AND e.patient_id = ?'
                params.append(patient_id)
            
            if event_type:
                query += ' AND e.event_type = ?'
                params.append(event_type)
            
            if unresolved_only:
                query += ' AND e.is_resolved = 0'
            
            query += ' ORDER BY e.event_date DESC'
            cursor.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def resolve_event(event_id, resolved_date=None):
        with get_db() as conn:
            cursor = conn.cursor()
            if not resolved_date:
                resolved_date = datetime.now().strftime('%Y-%m-%d')
            cursor.execute('''
                UPDATE events 
                SET is_resolved = 1, resolved_date = ?
                WHERE id = ?
            ''', (resolved_date, event_id))
            return cursor.rowcount > 0


class RunLogService:
    @staticmethod
    def create_run_log(run_batch, run_type, parameters=None):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO run_logs (run_batch, run_type, status, parameters)
                VALUES (?, ?, 'running', ?)
            ''', (run_batch, run_type, parameters))
            return cursor.lastrowid
    
    @staticmethod
    def update_run_log(run_log_id, **kwargs):
        with get_db() as conn:
            cursor = conn.cursor()
            updates = []
            params = []
            
            for key, value in kwargs.items():
                updates.append(f'{key} = ?')
                params.append(value)
            
            params.append(run_log_id)
            cursor.execute(f'''
                UPDATE run_logs 
                SET {', '.join(updates)}
                WHERE id = ?
            ''', params)
    
    @staticmethod
    def get_run_logs():
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM run_logs ORDER BY created_at DESC')
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def get_run_log_by_batch(run_batch):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM run_logs WHERE run_batch = ?', (run_batch,))
            row = cursor.fetchone()
            return dict(row) if row else None
    
    @staticmethod
    def add_history(run_log_id, entity_type, entity_id, old_value, new_value, change_type):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO run_history 
                (run_log_id, entity_type, entity_id, old_value, new_value, change_type)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (run_log_id, entity_type, entity_id, old_value, new_value, change_type))
    
    @staticmethod
    def add_statistic(run_log_id, stat_key, stat_value):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO statistics 
                (run_log_id, stat_key, stat_value)
                VALUES (?, ?, ?)
            ''', (run_log_id, stat_key, str(stat_value)))
    
    @staticmethod
    def get_statistics(run_log_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM statistics WHERE run_log_id = ?', (run_log_id,))
            return [dict(row) for row in cursor.fetchall()]
    
    @staticmethod
    def get_run_history(run_log_id):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM run_history WHERE run_log_id = ? ORDER BY created_at', (run_log_id,))
            return [dict(row) for row in cursor.fetchall()]


class ExportService:
    @staticmethod
    def create_export_record(run_log_id, export_type, file_name, file_path, record_count):
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO exports 
                (run_log_id, export_type, file_name, file_path, record_count)
                VALUES (?, ?, ?, ?, ?)
            ''', (run_log_id, export_type, file_name, file_path, record_count))
            return cursor.lastrowid
    
    @staticmethod
    def get_exports(run_log_id=None):
        with get_db() as conn:
            cursor = conn.cursor()
            if run_log_id:
                cursor.execute('SELECT * FROM exports WHERE run_log_id = ?', (run_log_id,))
            else:
                cursor.execute('SELECT * FROM exports ORDER BY created_at DESC')
            return [dict(row) for row in cursor.fetchall()]


class CleanupService:
    @staticmethod
    def remove_failed_runs():
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM run_logs WHERE status = ?', ('failed',))
            failed_ids = [row[0] for row in cursor.fetchall()]
            
            if not failed_ids:
                return 0
            
            ids_str = ','.join(['?'] * len(failed_ids))
            
            cursor.execute(f'DELETE FROM run_history WHERE run_log_id IN ({ids_str})', failed_ids)
            cursor.execute(f'DELETE FROM statistics WHERE run_log_id IN ({ids_str})', failed_ids)
            cursor.execute(f'DELETE FROM exports WHERE run_log_id IN ({ids_str})', failed_ids)
            cursor.execute(f'DELETE FROM run_logs WHERE id IN ({ids_str})', failed_ids)
            
            return len(failed_ids)
    
    @staticmethod
    def remove_orphan_exports():
        import os
        from config import EXPORT_DIR
        
        db_exports = ExportService.get_exports()
        db_files = {e['file_name'] for e in db_exports}
        
        removed = 0
        if os.path.exists(EXPORT_DIR):
            for f in os.listdir(EXPORT_DIR):
                if f.endswith('.csv') and f not in db_files:
                    try:
                        os.remove(os.path.join(EXPORT_DIR, f))
                        removed += 1
                    except:
                        pass
        
        return removed
    
    @staticmethod
    def clean_export_files_for_rerun(check_date):
        import os
        from config import EXPORT_DIR
        
        removed = 0
        if os.path.exists(EXPORT_DIR):
            for f in os.listdir(EXPORT_DIR):
                if f.startswith(f'daily_report_{check_date}_') or f.startswith(f'overdue_report_{check_date}_'):
                    continue
        return removed
    
    @staticmethod
    def full_cleanup():
        failed_count = CleanupService.remove_failed_runs()
        orphan_count = CleanupService.remove_orphan_exports()
        return {'failed_runs': failed_count, 'orphan_exports': orphan_count}
