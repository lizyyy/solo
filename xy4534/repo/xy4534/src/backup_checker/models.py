import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional

class Database:
    def __init__(self, db_path: str = "backup_check.db"):
        self.db_path = db_path
        self._init_db()
    
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def _init_db(self):
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # 备份演练任务表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS backup_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'pending',
            summary TEXT,
            conclusion TEXT
        )
        ''')
        
        # pg_dump 日志表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS pg_dump_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            file_path TEXT,
            database_name TEXT,
            dump_start_time TIMESTAMP,
            dump_end_time TIMESTAMP,
            total_size_bytes INTEGER,
            table_count INTEGER,
            raw_content TEXT,
            FOREIGN KEY (task_id) REFERENCES backup_tasks(id)
        )
        ''')
        
        # 对象存储 manifest 表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS object_storage_manifests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            file_path TEXT,
            bucket_name TEXT,
            manifest_date TIMESTAMP,
            total_shards INTEGER,
            total_size_bytes INTEGER,
            raw_content TEXT,
            FOREIGN KEY (task_id) REFERENCES backup_tasks(id)
        )
        ''')
        
        # 对象存储分片详情表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS object_storage_shards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            manifest_id INTEGER NOT NULL,
            shard_name TEXT NOT NULL,
            shard_size_bytes INTEGER,
            checksum TEXT,
            upload_time TIMESTAMP,
            FOREIGN KEY (manifest_id) REFERENCES object_storage_manifests(id)
        )
        ''')
        
        # 还原演练结果表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS restore_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            file_path TEXT,
            restore_start_time TIMESTAMP,
            restore_end_time TIMESTAMP,
            restored_database_name TEXT,
            restored_version TEXT,
            table_count_restored INTEGER,
            row_count_restored INTEGER,
            raw_content TEXT,
            FOREIGN KEY (task_id) REFERENCES backup_tasks(id)
        )
        ''')
        
        # 抽查的表详情表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS spot_checked_tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restore_result_id INTEGER NOT NULL,
            table_name TEXT NOT NULL,
            expected_row_count INTEGER,
            actual_row_count INTEGER,
            checksum_match BOOLEAN,
            FOREIGN KEY (restore_result_id) REFERENCES restore_results(id)
        )
        ''')
        
        # 值班备注表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS duty_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            note_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT DEFAULT 'unknown',
            FOREIGN KEY (task_id) REFERENCES backup_tasks(id)
        )
        ''')
        
        # 检查结果表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS check_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            check_type TEXT NOT NULL,
            check_name TEXT NOT NULL,
            status TEXT NOT NULL,
            message TEXT,
            details TEXT,
            risk_level TEXT DEFAULT 'low',
            reviewed BOOLEAN DEFAULT FALSE,
            review_note TEXT,
            FOREIGN KEY (task_id) REFERENCES backup_tasks(id)
        )
        ''')
        
        conn.commit()
        conn.close()
    
    # 任务相关操作
    def create_task(self, task_name: str) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO backup_tasks (task_name, status) VALUES (?, ?)',
            (task_name, 'pending')
        )
        task_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return task_id
    
    def get_task(self, task_id: int) -> Optional[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM backup_tasks WHERE id = ?', (task_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None
    
    def get_all_tasks(self) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM backup_tasks ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def update_task(self, task_id: int, **kwargs):
        conn = self._get_connection()
        cursor = conn.cursor()
        fields = ', '.join([f'{k} = ?' for k in kwargs.keys()])
        values = list(kwargs.values()) + [task_id]
        cursor.execute(f'UPDATE backup_tasks SET {fields} WHERE id = ?', values)
        conn.commit()
        conn.close()
    
    # pg_dump 日志操作
    def add_pg_dump_log(self, task_id: int, data: Dict) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO pg_dump_logs 
            (task_id, file_path, database_name, dump_start_time, dump_end_time, 
             total_size_bytes, table_count, raw_content)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            task_id, data.get('file_path'), data.get('database_name'),
            data.get('dump_start_time'), data.get('dump_end_time'),
            data.get('total_size_bytes'), data.get('table_count'),
            json.dumps(data.get('raw_content', {}), ensure_ascii=False)
        ))
        log_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return log_id
    
    def get_pg_dump_logs(self, task_id: int) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM pg_dump_logs WHERE task_id = ?', (task_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # 对象存储 manifest 操作
    def add_object_storage_manifest(self, task_id: int, data: Dict) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO object_storage_manifests 
            (task_id, file_path, bucket_name, manifest_date, 
             total_shards, total_size_bytes, raw_content)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            task_id, data.get('file_path'), data.get('bucket_name'),
            data.get('manifest_date'), data.get('total_shards'),
            data.get('total_size_bytes'),
            json.dumps(data.get('raw_content', {}), ensure_ascii=False)
        ))
        manifest_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return manifest_id
    
    def get_object_storage_manifests(self, task_id: int) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM object_storage_manifests WHERE task_id = ?', (task_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # 对象存储分片操作
    def add_object_storage_shard(self, manifest_id: int, data: Dict) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO object_storage_shards 
            (manifest_id, shard_name, shard_size_bytes, checksum, upload_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            manifest_id, data.get('shard_name'), data.get('shard_size_bytes'),
            data.get('checksum'), data.get('upload_time')
        ))
        shard_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return shard_id
    
    def get_object_storage_shards(self, manifest_id: int) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM object_storage_shards WHERE manifest_id = ?', (manifest_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # 还原演练结果操作
    def add_restore_result(self, task_id: int, data: Dict) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO restore_results 
            (task_id, file_path, restore_start_time, restore_end_time, 
             restored_database_name, restored_version, 
             table_count_restored, row_count_restored, raw_content)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            task_id, data.get('file_path'), data.get('restore_start_time'),
            data.get('restore_end_time'), data.get('restored_database_name'),
            data.get('restored_version'), data.get('table_count_restored'),
            data.get('row_count_restored'),
            json.dumps(data.get('raw_content', {}), ensure_ascii=False)
        ))
        result_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return result_id
    
    def get_restore_results(self, task_id: int) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM restore_results WHERE task_id = ?', (task_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # 抽查表操作
    def add_spot_checked_table(self, restore_result_id: int, data: Dict) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO spot_checked_tables 
            (restore_result_id, table_name, expected_row_count, 
             actual_row_count, checksum_match)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            restore_result_id, data.get('table_name'),
            data.get('expected_row_count'), data.get('actual_row_count'),
            data.get('checksum_match')
        ))
        table_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return table_id
    
    def get_spot_checked_tables(self, restore_result_id: int) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM spot_checked_tables WHERE restore_result_id = ?', (restore_result_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # 值班备注操作
    def add_duty_note(self, task_id: int, note_text: str, created_by: str = 'unknown') -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO duty_notes (task_id, note_text, created_by)
            VALUES (?, ?, ?)
        ''', (task_id, note_text, created_by))
        note_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return note_id
    
    def get_duty_notes(self, task_id: int) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM duty_notes WHERE task_id = ? ORDER BY created_at', (task_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    # 检查结果操作
    def add_check_result(self, task_id: int, data: Dict) -> int:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO check_results 
            (task_id, check_type, check_name, status, message, details, risk_level)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            task_id, data.get('check_type'), data.get('check_name'),
            data.get('status'), data.get('message'),
            json.dumps(data.get('details', {}), ensure_ascii=False) if data.get('details') else None,
            data.get('risk_level', 'low')
        ))
        result_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return result_id
    
    def get_check_results(self, task_id: int) -> List[Dict]:
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM check_results WHERE task_id = ? ORDER BY risk_level DESC, check_time', (task_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    def update_check_result_review(self, check_id: int, reviewed: bool, review_note: str = None):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE check_results 
            SET reviewed = ?, review_note = ?
            WHERE id = ?
        ''', (reviewed, review_note, check_id))
        conn.commit()
        conn.close()
    
    # 获取完整任务数据
    def get_full_task_data(self, task_id: int) -> Optional[Dict]:
        task = self.get_task(task_id)
        if not task:
            return None
        
        pg_dump_logs = self.get_pg_dump_logs(task_id)
        manifests = self.get_object_storage_manifests(task_id)
        restore_results = self.get_restore_results(task_id)
        duty_notes = self.get_duty_notes(task_id)
        check_results = self.get_check_results(task_id)
        
        # 处理 manifest 的 shards
        for manifest in manifests:
            manifest['shards'] = self.get_object_storage_shards(manifest['id'])
        
        # 处理 restore_results 的 spot_checked_tables
        for result in restore_results:
            result['spot_checked_tables'] = self.get_spot_checked_tables(result['id'])
        
        return {
            'task': task,
            'pg_dump_logs': pg_dump_logs,
            'object_storage_manifests': manifests,
            'restore_results': restore_results,
            'duty_notes': duty_notes,
            'check_results': check_results
        }
