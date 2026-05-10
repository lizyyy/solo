import sqlite3
from contextlib import contextmanager
from config import DB_PATH


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.executescript('''
            CREATE TABLE IF NOT EXISTS doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                department TEXT,
                phone TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER,
                phone TEXT,
                treatment_start_date TEXT NOT NULL,
                followup_interval_weeks INTEGER NOT NULL,
                doctor_id INTEGER,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (doctor_id) REFERENCES doctors(id)
            );
            
            CREATE TABLE IF NOT EXISTS doctor_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doctor_id INTEGER NOT NULL,
                schedule_date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                max_appointments INTEGER DEFAULT 10,
                booked_appointments INTEGER DEFAULT 0,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (doctor_id) REFERENCES doctors(id),
                UNIQUE(doctor_id, schedule_date, start_time)
            );
            
            CREATE TABLE IF NOT EXISTS followup_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                plan_number INTEGER NOT NULL,
                planned_date TEXT NOT NULL,
                window_start TEXT NOT NULL,
                window_end TEXT NOT NULL,
                status TEXT DEFAULT 'scheduled',
                actual_date TEXT,
                doctor_id INTEGER,
                schedule_id INTEGER,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (doctor_id) REFERENCES doctors(id),
                FOREIGN KEY (schedule_id) REFERENCES doctor_schedules(id),
                UNIQUE(patient_id, plan_number)
            );
            
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_id INTEGER NOT NULL,
                followup_plan_id INTEGER,
                event_type TEXT NOT NULL,
                event_date TEXT NOT NULL,
                description TEXT,
                impact_days INTEGER DEFAULT 0,
                severity TEXT DEFAULT 'medium',
                is_resolved INTEGER DEFAULT 0,
                resolved_date TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (patient_id) REFERENCES patients(id),
                FOREIGN KEY (followup_plan_id) REFERENCES followup_plans(id)
            );
            
            CREATE TABLE IF NOT EXISTS run_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_batch TEXT NOT NULL,
                run_type TEXT NOT NULL,
                start_time TEXT DEFAULT CURRENT_TIMESTAMP,
                end_time TEXT,
                status TEXT DEFAULT 'pending',
                parameters TEXT,
                affected_patients INTEGER DEFAULT 0,
                affected_plans INTEGER DEFAULT 0,
                events_created INTEGER DEFAULT 0,
                schedules_updated INTEGER DEFAULT 0,
                error_message TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(run_batch)
            );
            
            CREATE TABLE IF NOT EXISTS run_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_log_id INTEGER NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                old_value TEXT,
                new_value TEXT,
                change_type TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_log_id) REFERENCES run_logs(id)
            );
            
            CREATE TABLE IF NOT EXISTS exports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_log_id INTEGER,
                export_type TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                record_count INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_log_id) REFERENCES run_logs(id)
            );
            
            CREATE TABLE IF NOT EXISTS statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_log_id INTEGER NOT NULL,
                stat_key TEXT NOT NULL,
                stat_value TEXT NOT NULL,
                stat_date TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_log_id) REFERENCES run_logs(id),
                UNIQUE(run_log_id, stat_key)
            );
        ''')


def clear_all_tables():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.executescript('''
            DELETE FROM statistics;
            DELETE FROM exports;
            DELETE FROM run_history;
            DELETE FROM run_logs;
            DELETE FROM events;
            DELETE FROM followup_plans;
            DELETE FROM doctor_schedules;
            DELETE FROM patients;
            DELETE FROM doctors;
        ''')
