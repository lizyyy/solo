import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Optional, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reservations.db')

class Database:
    def __init__(self):
        self.init_db()
    
    def get_connection(self):
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                activity_name TEXT NOT NULL,
                responsible_person TEXT NOT NULL,
                phone TEXT NOT NULL,
                venue TEXT NOT NULL,
                date_time_start TEXT NOT NULL,
                date_time_end TEXT NOT NULL,
                people_count INTEGER NOT NULL,
                remarks TEXT,
                status TEXT NOT NULL DEFAULT '待确认',
                is_deleted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS operation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reservation_id INTEGER,
                operation_type TEXT NOT NULL,
                details TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (reservation_id) REFERENCES reservations (id)
            )
        ''')
        
        if self.is_empty():
            self.insert_sample_data()
        
        conn.commit()
        conn.close()
    
    def is_empty(self) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM reservations')
        count = cursor.fetchone()[0]
        conn.close()
        return count == 0
    
    def insert_sample_data(self):
        samples = [
            {
                'activity_name': '社区舞蹈课',
                'responsible_person': '张阿姨',
                'phone': '13800138001',
                'venue': '多功能厅',
                'date_time_start': '2026-05-06 09:00',
                'date_time_end': '2026-05-06 11:00',
                'people_count': 20,
                'remarks': '需要音响设备',
                'status': '已确认'
            },
            {
                'activity_name': '老年人健康讲座',
                'responsible_person': '李医生',
                'phone': '13900139002',
                'venue': '会议室A',
                'date_time_start': '2026-05-06 14:00',
                'date_time_end': '2026-05-06 16:00',
                'people_count': 30,
                'remarks': '需要投影仪',
                'status': '已确认'
            },
            {
                'activity_name': '青少年书法班',
                'responsible_person': '王老师',
                'phone': '13700137003',
                'venue': '多功能厅',
                'date_time_start': '2026-05-07 10:00',
                'date_time_end': '2026-05-07 12:00',
                'people_count': 15,
                'remarks': '',
                'status': '待确认'
            },
            {
                'activity_name': '社区棋牌比赛',
                'responsible_person': '陈大爷',
                'phone': '13600136004',
                'venue': '棋牌室',
                'date_time_start': '2026-05-08 13:00',
                'date_time_end': '2026-05-08 17:00',
                'people_count': 24,
                'remarks': '需要准备桌椅',
                'status': '已确认'
            },
            {
                'activity_name': '亲子手工活动',
                'responsible_person': '刘女士',
                'phone': '13500135005',
                'venue': '活动室B',
                'date_time_start': '2026-05-09 09:30',
                'date_time_end': '2026-05-09 11:30',
                'people_count': 20,
                'remarks': '需要准备手工材料',
                'status': '待确认'
            }
        ]
        
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        for sample in samples:
            cursor.execute('''
                INSERT INTO reservations 
                (activity_name, responsible_person, phone, venue, date_time_start, date_time_end, 
                 people_count, remarks, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                sample['activity_name'], sample['responsible_person'], sample['phone'],
                sample['venue'], sample['date_time_start'], sample['date_time_end'],
                sample['people_count'], sample['remarks'], sample['status'], now, now
            ))
            reservation_id = cursor.lastrowid
            cursor.execute('''
                INSERT INTO operation_logs (reservation_id, operation_type, details, created_at)
                VALUES (?, ?, ?, ?)
            ''', (reservation_id, '新增', f"新增预约: {sample['activity_name']}", now))
        
        conn.commit()
        conn.close()
    
    def get_all_reservations(self, include_deleted: bool = False) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if include_deleted:
            cursor.execute('''
                SELECT * FROM reservations ORDER BY date_time_start
            ''')
        else:
            cursor.execute('''
                SELECT * FROM reservations WHERE is_deleted = 0 ORDER BY date_time_start
            ''')
        
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_reservation_by_id(self, reservation_id: int) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM reservations WHERE id = ?', (reservation_id,))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def get_deleted_reservations(self) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM reservations WHERE is_deleted = 1 ORDER BY updated_at DESC
        ''')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def add_reservation(self, data: Dict[str, Any]) -> int:
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            INSERT INTO reservations 
            (activity_name, responsible_person, phone, venue, date_time_start, date_time_end, 
             people_count, remarks, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['activity_name'], data['responsible_person'], data['phone'],
            data['venue'], data['date_time_start'], data['date_time_end'],
            data['people_count'], data['remarks'], data['status'], now, now
        ))
        
        reservation_id = cursor.lastrowid
        
        cursor.execute('''
            INSERT INTO operation_logs (reservation_id, operation_type, details, created_at)
            VALUES (?, ?, ?, ?)
        ''', (reservation_id, '新增', f"新增预约: {data['activity_name']}", now))
        
        conn.commit()
        conn.close()
        return reservation_id
    
    def update_reservation(self, reservation_id: int, data: Dict[str, Any]) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            UPDATE reservations 
            SET activity_name = ?, responsible_person = ?, phone = ?, venue = ?,
                date_time_start = ?, date_time_end = ?, people_count = ?, remarks = ?,
                status = ?, updated_at = ?
            WHERE id = ?
        ''', (
            data['activity_name'], data['responsible_person'], data['phone'],
            data['venue'], data['date_time_start'], data['date_time_end'],
            data['people_count'], data['remarks'], data['status'], now, reservation_id
        ))
        
        cursor.execute('''
            INSERT INTO operation_logs (reservation_id, operation_type, details, created_at)
            VALUES (?, ?, ?, ?)
        ''', (reservation_id, '编辑', f"编辑预约: {data['activity_name']}", now))
        
        conn.commit()
        affected = cursor.rowcount > 0
        conn.close()
        return affected
    
    def soft_delete_reservation(self, reservation_id: int) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        reservation = self.get_reservation_by_id(reservation_id)
        if not reservation:
            conn.close()
            return False
        
        cursor.execute('''
            UPDATE reservations SET is_deleted = 1, updated_at = ? WHERE id = ?
        ''', (now, reservation_id))
        
        cursor.execute('''
            INSERT INTO operation_logs (reservation_id, operation_type, details, created_at)
            VALUES (?, ?, ?, ?)
        ''', (reservation_id, '删除', f"删除预约: {reservation['activity_name']}", now))
        
        conn.commit()
        affected = cursor.rowcount > 0
        conn.close()
        return affected
    
    def restore_reservation(self, reservation_id: int) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        reservation = self.get_reservation_by_id(reservation_id)
        if not reservation:
            conn.close()
            return False
        
        cursor.execute('''
            UPDATE reservations SET is_deleted = 0, updated_at = ? WHERE id = ?
        ''', (now, reservation_id))
        
        cursor.execute('''
            INSERT INTO operation_logs (reservation_id, operation_type, details, created_at)
            VALUES (?, ?, ?, ?)
        ''', (reservation_id, '恢复', f"恢复预约: {reservation['activity_name']}", now))
        
        conn.commit()
        affected = cursor.rowcount > 0
        conn.close()
        return affected
    
    def check_time_conflict(self, venue: str, start_time: str, end_time: str, exclude_id: int = None) -> bool:
        conn = self.get_connection()
        cursor = conn.cursor()
        
        if exclude_id:
            cursor.execute('''
                SELECT * FROM reservations 
                WHERE venue = ? AND is_deleted = 0 AND id != ?
                AND NOT (date_time_end <= ? OR date_time_start >= ?)
            ''', (venue, exclude_id, start_time, end_time))
        else:
            cursor.execute('''
                SELECT * FROM reservations 
                WHERE venue = ? AND is_deleted = 0
                AND NOT (date_time_end <= ? OR date_time_start >= ?)
            ''', (venue, start_time, end_time))
        
        conflicts = cursor.fetchall()
        conn.close()
        return len(conflicts) > 0
    
    def get_operation_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM operation_logs ORDER BY created_at DESC LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_today_reservations(self) -> List[Dict[str, Any]]:
        today = datetime.now().strftime('%Y-%m-%d')
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM reservations 
            WHERE is_deleted = 0 AND date(date_time_start) = ?
            ORDER BY date_time_start
        ''', (today,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def get_all_venues(self) -> List[str]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT DISTINCT venue FROM reservations WHERE is_deleted = 0')
        rows = cursor.fetchall()
        conn.close()
        return [row['venue'] for row in rows]
    
    def get_all_statuses(self) -> List[str]:
        return ['待确认', '已确认', '已取消', '已完成']
