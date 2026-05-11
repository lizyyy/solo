import sqlite3
import os
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


class Database:
    def __init__(self, db_path: str = "clinic.db"):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS residents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    id_card TEXT,
                    phone TEXT,
                    address TEXT,
                    created_at TEXT NOT NULL,
                    UNIQUE(id_card),
                    UNIQUE(phone)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS samplings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sampling_no TEXT NOT NULL UNIQUE,
                    resident_id INTEGER,
                    resident_name TEXT,
                    resident_phone TEXT,
                    sampling_date TEXT NOT NULL,
                    sampling_type TEXT,
                    sampler TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (resident_id) REFERENCES residents(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS test_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sampling_no TEXT NOT NULL,
                    test_date TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    lab_name TEXT,
                    raw_data TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (sampling_no) REFERENCES samplings(sampling_no)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS abnormal_indicators (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    test_result_id INTEGER NOT NULL,
                    sampling_no TEXT NOT NULL,
                    indicator_name TEXT NOT NULL,
                    result_value TEXT,
                    reference_range TEXT,
                    abnormal_flag TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (test_result_id) REFERENCES test_results(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sampling_no TEXT NOT NULL,
                    test_result_id INTEGER,
                    notification_date TEXT NOT NULL,
                    notification_method TEXT,
                    notifier TEXT,
                    contact_result TEXT,
                    notes TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (test_result_id) REFERENCES test_results(id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS followup_appointments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sampling_no TEXT NOT NULL,
                    resident_id INTEGER,
                    test_result_id INTEGER,
                    appointment_date TEXT NOT NULL,
                    appointment_time TEXT,
                    followup_items TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    notes TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (resident_id) REFERENCES residents(id),
                    FOREIGN KEY (test_result_id) REFERENCES test_results(id)
                )
            ''')
            
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_samplings_no ON samplings(sampling_no)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_test_no ON test_results(sampling_no)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_abnormal_no ON abnormal_indicators(sampling_no)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_notify_no ON notifications(sampling_no)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_followup_no ON followup_appointments(sampling_no)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_followup_date ON followup_appointments(appointment_date)')
            
    def _now(self) -> str:
        return datetime.now().isoformat()

    def add_resident(self, name: str, id_card: Optional[str] = None, 
                     phone: Optional[str] = None, address: Optional[str] = None) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('''
                    INSERT INTO residents (name, id_card, phone, address, created_at)
                    VALUES (?, ?, ?, ?, ?)
                ''', (name, id_card, phone, address, self._now()))
                return cursor.lastrowid
            except sqlite3.IntegrityError:
                cursor.execute('SELECT id FROM residents WHERE id_card = ? OR phone = ?', 
                             (id_card, phone))
                row = cursor.fetchone()
                return row['id'] if row else -1

    def get_resident(self, resident_id: int) -> Optional[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM residents WHERE id = ?', (resident_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def add_sampling(self, sampling_no: str, resident_id: Optional[int] = None,
                     resident_name: str = "", resident_phone: str = "",
                     sampling_date: str = "", sampling_type: str = "",
                     sampler: str = "", status: str = "pending") -> Tuple[bool, str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM samplings WHERE sampling_no = ?', (sampling_no,))
            if cursor.fetchone():
                return False, f"采样号 {sampling_no} 已存在，跳过"
            cursor.execute('''
                INSERT INTO samplings 
                (sampling_no, resident_id, resident_name, resident_phone, 
                 sampling_date, sampling_type, sampler, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (sampling_no, resident_id, resident_name, resident_phone,
                  sampling_date, sampling_type, sampler, status, self._now()))
            return True, f"采样记录 {sampling_no} 已添加"

    def get_sampling(self, sampling_no: str) -> Optional[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM samplings WHERE sampling_no = ?', (sampling_no,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_all_samplings(self) -> List[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM samplings ORDER BY sampling_date DESC')
            return [dict(row) for row in cursor.fetchall()]

    def add_test_result(self, sampling_no: str, test_date: str = "",
                        status: str = "received", lab_name: str = "",
                        raw_data: str = "") -> Tuple[bool, str, int]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM samplings WHERE sampling_no = ?', (sampling_no,))
            if not cursor.fetchone():
                return False, f"采样号 {sampling_no} 不存在采样记录，无法添加检验结果", -1
            cursor.execute('SELECT id FROM test_results WHERE sampling_no = ?', (sampling_no,))
            existing = cursor.fetchone()
            if existing:
                return False, f"检验结果 {sampling_no} 已存在，跳过", existing['id']
            cursor.execute('''
                INSERT INTO test_results 
                (sampling_no, test_date, status, lab_name, raw_data, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (sampling_no, test_date, status, lab_name, raw_data, self._now()))
            return True, f"检验结果 {sampling_no} 已添加", cursor.lastrowid

    def get_test_result(self, sampling_no: str) -> Optional[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM test_results WHERE sampling_no = ?', (sampling_no,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def add_abnormal_indicator(self, test_result_id: int, sampling_no: str,
                                indicator_name: str, result_value: str = "",
                                reference_range: str = "", 
                                abnormal_flag: str = "") -> Tuple[bool, str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id FROM abnormal_indicators 
                WHERE test_result_id = ? AND indicator_name = ?
            ''', (test_result_id, indicator_name))
            if cursor.fetchone():
                return False, f"异常指标 {indicator_name} 已存在，跳过"
            cursor.execute('''
                INSERT INTO abnormal_indicators 
                (test_result_id, sampling_no, indicator_name, result_value, 
                 reference_range, abnormal_flag, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (test_result_id, sampling_no, indicator_name, result_value,
                  reference_range, abnormal_flag, self._now()))
            return True, f"异常指标 {indicator_name} 已添加"

    def get_abnormal_indicators(self, sampling_no: str) -> List[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM abnormal_indicators 
                WHERE sampling_no = ? ORDER BY id
            ''', (sampling_no,))
            return [dict(row) for row in cursor.fetchall()]

    def has_any_abnormal(self, sampling_no: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT COUNT(*) as cnt FROM abnormal_indicators 
                WHERE sampling_no = ?
            ''', (sampling_no,))
            return cursor.fetchone()['cnt'] > 0

    def add_notification(self, sampling_no: str, notification_date: str,
                         test_result_id: Optional[int] = None,
                         notification_method: str = "", notifier: str = "",
                         contact_result: str = "", notes: str = "") -> Tuple[bool, str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id FROM notifications 
                WHERE sampling_no = ? AND notification_date = ? 
                  AND notification_method = ? AND notifier = ? 
                  AND contact_result = ?
            ''', (sampling_no, notification_date, notification_method, notifier, contact_result))
            if cursor.fetchone():
                return False, f"通知记录 {sampling_no} 已存在，跳过"
            cursor.execute('''
                INSERT INTO notifications 
                (sampling_no, test_result_id, notification_date, notification_method,
                 notifier, contact_result, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (sampling_no, test_result_id, notification_date, notification_method,
                  notifier, contact_result, notes, self._now()))
            return True, f"通知记录 {sampling_no} 已添加"

    def get_notifications(self, sampling_no: str) -> List[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM notifications 
                WHERE sampling_no = ? ORDER BY notification_date DESC
            ''', (sampling_no,))
            return [dict(row) for row in cursor.fetchall()]

    def has_any_notification(self, sampling_no: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT COUNT(*) as cnt FROM notifications 
                WHERE sampling_no = ?
            ''', (sampling_no,))
            return cursor.fetchone()['cnt'] > 0

    def add_followup_appointment(self, sampling_no: str, appointment_date: str,
                                 resident_id: Optional[int] = None,
                                 test_result_id: Optional[int] = None,
                                 appointment_time: str = "",
                                 followup_items: str = "",
                                 status: str = "pending",
                                 notes: str = "") -> Tuple[bool, str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM followup_appointments 
                WHERE sampling_no = ? AND appointment_date = ? AND status = 'pending'
            ''', (sampling_no, appointment_date))
            existing = cursor.fetchone()
            if existing:
                return False, f"同一天 {appointment_date} 已有待处理的复查预约"
            cursor.execute('''
                INSERT INTO followup_appointments 
                (sampling_no, resident_id, test_result_id, appointment_date,
                 appointment_time, followup_items, status, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (sampling_no, resident_id, test_result_id, appointment_date,
                  appointment_time, followup_items, status, notes, self._now()))
            return True, f"复查预约 {appointment_date} 已添加"

    def get_followup_appointments(self, sampling_no: str) -> List[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM followup_appointments 
                WHERE sampling_no = ? ORDER BY appointment_date DESC
            ''', (sampling_no,))
            return [dict(row) for row in cursor.fetchall()]

    def update_test_result_status(self, sampling_no: str, status: str) -> Tuple[bool, str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE test_results SET status = ? WHERE sampling_no = ?
            ''', (status, sampling_no))
            if cursor.rowcount > 0:
                return True, f"检验单 {sampling_no} 状态已更新为 {status}"
            return False, f"检验单 {sampling_no} 不存在"

    def update_followup_status(self, appointment_id: int, status: str) -> Tuple[bool, str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE followup_appointments SET status = ? WHERE id = ?
            ''', (status, appointment_id))
            if cursor.rowcount > 0:
                return True, f"复查预约 {appointment_id} 状态已更新为 {status}"
            return False, f"复查预约 {appointment_id} 不存在"

    def get_uncollected_tests(self) -> List[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT s.sampling_no, s.resident_name, s.resident_phone, 
                       s.sampling_date, s.sampling_type
                FROM samplings s
                LEFT JOIN test_results t ON s.sampling_no = t.sampling_no
                WHERE t.id IS NULL AND s.status != 'cancelled'
                ORDER BY s.sampling_date
            ''')
            return [dict(row) for row in cursor.fetchall()]

    def get_abnormal_tracking(self) -> List[Dict]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT DISTINCT 
                    s.sampling_no, 
                    s.resident_name, 
                    s.resident_phone,
                    t.test_date,
                    t.status as test_status,
                    (SELECT COUNT(*) FROM notifications n 
                     WHERE n.sampling_no = s.sampling_no) as notify_count,
                    (SELECT COUNT(*) FROM followup_appointments fa 
                     WHERE fa.sampling_no = s.sampling_no) as followup_count,
                    (SELECT GROUP_CONCAT(indicator_name, ', ') 
                     FROM abnormal_indicators ai 
                     WHERE ai.sampling_no = s.sampling_no) as abnormal_items
                FROM samplings s
                JOIN test_results t ON s.sampling_no = t.sampling_no
                JOIN abnormal_indicators ai ON s.sampling_no = ai.sampling_no
                WHERE t.status != 'completed'
                ORDER BY t.test_date
            ''')
            return [dict(row) for row in cursor.fetchall()]

    def get_summary_stats(self) -> Dict[str, Any]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('SELECT COUNT(*) as cnt FROM samplings')
            total_samplings = cursor.fetchone()['cnt']
            
            cursor.execute('''
                SELECT COUNT(*) as cnt FROM samplings s
                LEFT JOIN test_results t ON s.sampling_no = t.sampling_no
                WHERE t.id IS NULL AND s.status != 'cancelled'
            ''')
            uncollected = cursor.fetchone()['cnt']
            
            cursor.execute('SELECT COUNT(*) as cnt FROM test_results')
            collected = cursor.fetchone()['cnt']
            
            cursor.execute('''
                SELECT COUNT(DISTINCT sampling_no) as cnt 
                FROM abnormal_indicators
            ''')
            with_abnormal = cursor.fetchone()['cnt']
            
            cursor.execute('''
                SELECT COUNT(DISTINCT t.sampling_no) as cnt
                FROM abnormal_indicators ai
                JOIN test_results t ON ai.sampling_no = t.sampling_no
                LEFT JOIN notifications n ON t.sampling_no = n.sampling_no
                WHERE n.id IS NULL AND t.status != 'completed'
            ''')
            abnormal_not_notified = cursor.fetchone()['cnt']
            
            cursor.execute('''
                SELECT COUNT(*) as cnt FROM test_results WHERE status = 'completed'
            ''')
            completed = cursor.fetchone()['cnt']
            
            cursor.execute('''
                SELECT COUNT(*) as cnt FROM followup_appointments WHERE status = 'pending'
            ''')
            pending_followup = cursor.fetchone()['cnt']
            
            return {
                "total_samplings": total_samplings,
                "collected": collected,
                "uncollected": uncollected,
                "with_abnormal": with_abnormal,
                "abnormal_not_notified": abnormal_not_notified,
                "completed": completed,
                "pending_followup": pending_followup,
                "collection_rate": round(collected / total_samplings * 100, 1) if total_samplings > 0 else 0,
                "completion_rate": round(completed / collected * 100, 1) if collected > 0 else 0
            }
