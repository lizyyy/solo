import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any

DATABASE = 'config_console.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tenant_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id TEXT NOT NULL,
            tenant_name TEXT NOT NULL,
            config_key TEXT NOT NULL,
            config_value TEXT NOT NULL,
            raw_input TEXT NOT NULL,
            processed_result TEXT,
            gray_scope TEXT,
            status TEXT DEFAULT 'pending',
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, config_key)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS env_vars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id TEXT NOT NULL,
            env_name TEXT NOT NULL,
            var_key TEXT NOT NULL,
            var_value TEXT NOT NULL,
            is_secret BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, env_name, var_key)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS config_snapshot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id TEXT NOT NULL UNIQUE,
            tenant_id TEXT NOT NULL,
            tenant_name TEXT NOT NULL,
            configs_before TEXT NOT NULL,
            configs_after TEXT NOT NULL,
            env_vars_before TEXT NOT NULL,
            env_vars_after TEXT NOT NULL,
            change_type TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            gray_scope TEXT,
            gray_intercepted BOOLEAN DEFAULT 0,
            intercept_reason TEXT,
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rollback_record (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rollback_id TEXT NOT NULL UNIQUE,
            snapshot_id TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            tenant_name TEXT NOT NULL,
            rollback_reason TEXT NOT NULL,
            rollback_type TEXT NOT NULL,
            handled_by TEXT,
            handled_at TIMESTAMP,
            is_manual_handled BOOLEAN DEFAULT 0,
            handle_note TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (snapshot_id) REFERENCES config_snapshot(snapshot_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS publish_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            log_id TEXT NOT NULL UNIQUE,
            snapshot_id TEXT,
            tenant_id TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            error_detail TEXT,
            retry_count INTEGER DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def dict_from_row(row: sqlite3.Row) -> Dict:
    return {key: row[key] for key in row.keys()}

def parse_json_field(value: Optional[str]) -> Any:
    if value is None:
        return None
    try:
        return json.loads(value)
    except:
        return value

class TenantConfig:
    @staticmethod
    def create(tenant_id: str, tenant_name: str, config_key: str, config_value: str, 
               raw_input: str, gray_scope: str, created_by: str) -> int:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO tenant_config 
            (tenant_id, tenant_name, config_key, config_value, raw_input, gray_scope, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (tenant_id, tenant_name, config_key, config_value, raw_input, gray_scope, created_by))
        conn.commit()
        config_id = cursor.lastrowid
        conn.close()
        return config_id
    
    @staticmethod
    def get_by_tenant(tenant_id: str) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM tenant_config WHERE tenant_id = ?', (tenant_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict_from_row(row) for row in rows]
    
    @staticmethod
    def update(config_id: int, **kwargs):
        conn = get_db()
        cursor = conn.cursor()
        fields = ', '.join([f"{k} = ?" for k in kwargs.keys()])
        values = list(kwargs.values()) + [config_id]
        cursor.execute(f'UPDATE tenant_config SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?', values)
        conn.commit()
        conn.close()
    
    @staticmethod
    def search(keyword: str = None) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        if keyword:
            cursor.execute('''
                SELECT * FROM tenant_config 
                WHERE tenant_id LIKE ? OR tenant_name LIKE ? OR config_key LIKE ?
            ''', (f'%{keyword}%', f'%{keyword}%', f'%{keyword}%'))
        else:
            cursor.execute('SELECT * FROM tenant_config ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [dict_from_row(row) for row in rows]

class EnvVar:
    @staticmethod
    def get_by_tenant_and_env(tenant_id: str, env_name: str) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM env_vars WHERE tenant_id = ? AND env_name = ?', 
                       (tenant_id, env_name))
        rows = cursor.fetchall()
        conn.close()
        return [dict_from_row(row) for row in rows]
    
    @staticmethod
    def create(tenant_id: str, env_name: str, var_key: str, var_value: str, is_secret: bool = False):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO env_vars (tenant_id, env_name, var_key, var_value, is_secret)
            VALUES (?, ?, ?, ?, ?)
        ''', (tenant_id, env_name, var_key, var_value, is_secret))
        conn.commit()
        conn.close()

class ConfigSnapshot:
    @staticmethod
    def create(snapshot_id: str, tenant_id: str, tenant_name: str,
               configs_before: Dict, configs_after: Dict,
               env_vars_before: Dict, env_vars_after: Dict,
               change_type: str, gray_scope: str, created_by: str) -> str:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO config_snapshot 
            (snapshot_id, tenant_id, tenant_name, configs_before, configs_after,
             env_vars_before, env_vars_after, change_type, gray_scope, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (snapshot_id, tenant_id, tenant_name,
              json.dumps(configs_before, ensure_ascii=False),
              json.dumps(configs_after, ensure_ascii=False),
              json.dumps(env_vars_before, ensure_ascii=False),
              json.dumps(env_vars_after, ensure_ascii=False),
              change_type, gray_scope, created_by))
        conn.commit()
        conn.close()
        return snapshot_id
    
    @staticmethod
    def get(snapshot_id: str) -> Optional[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM config_snapshot WHERE snapshot_id = ?', (snapshot_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            result = dict_from_row(row)
            for key in ['configs_before', 'configs_after', 'env_vars_before', 'env_vars_after']:
                result[key] = parse_json_field(result[key])
            return result
        return None
    
    @staticmethod
    def update_status(snapshot_id: str, status: str, gray_intercepted: bool = False, intercept_reason: str = None):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE config_snapshot 
            SET status = ?, gray_intercepted = ?, intercept_reason = ?
            WHERE snapshot_id = ?
        ''', (status, gray_intercepted, intercept_reason, snapshot_id))
        conn.commit()
        conn.close()
    
    @staticmethod
    def list_all(tenant_id: str = None) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        if tenant_id:
            cursor.execute('SELECT * FROM config_snapshot WHERE tenant_id = ? ORDER BY created_at DESC', (tenant_id,))
        else:
            cursor.execute('SELECT * FROM config_snapshot ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        results = []
        for row in rows:
            result = dict_from_row(row)
            for key in ['configs_before', 'configs_after', 'env_vars_before', 'env_vars_after']:
                result[key] = parse_json_field(result[key])
            results.append(result)
        return results

class RollbackRecord:
    @staticmethod
    def create(rollback_id: str, snapshot_id: str, tenant_id: str, tenant_name: str,
               rollback_reason: str, rollback_type: str) -> str:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO rollback_record 
            (rollback_id, snapshot_id, tenant_id, tenant_name, rollback_reason, rollback_type)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (rollback_id, snapshot_id, tenant_id, tenant_name, rollback_reason, rollback_type))
        conn.commit()
        conn.close()
        return rollback_id
    
    @staticmethod
    def get(rollback_id: str) -> Optional[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM rollback_record WHERE rollback_id = ?', (rollback_id,))
        row = cursor.fetchone()
        conn.close()
        return dict_from_row(row) if row else None
    
    @staticmethod
    def handle_manual(rollback_id: str, handled_by: str, handle_note: str):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE rollback_record 
            SET handled_by = ?, handled_at = CURRENT_TIMESTAMP, 
                is_manual_handled = 1, handle_note = ?, status = 'handled'
            WHERE rollback_id = ?
        ''', (handled_by, handle_note, rollback_id))
        conn.commit()
        conn.close()
    
    @staticmethod
    def list_all(tenant_id: str = None) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        if tenant_id:
            cursor.execute('SELECT * FROM rollback_record WHERE tenant_id = ? ORDER BY created_at DESC', (tenant_id,))
        else:
            cursor.execute('SELECT * FROM rollback_record ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [dict_from_row(row) for row in rows]

class PublishLog:
    @staticmethod
    def create(log_id: str, tenant_id: str, action: str, status: str, 
               created_by: str, snapshot_id: str = None, error_detail: str = None):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO publish_log (log_id, snapshot_id, tenant_id, action, status, error_detail, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (log_id, snapshot_id, tenant_id, action, status, error_detail, created_by))
        conn.commit()
        conn.close()
    
    @staticmethod
    def list_all(tenant_id: str = None) -> List[Dict]:
        conn = get_db()
        cursor = conn.cursor()
        if tenant_id:
            cursor.execute('SELECT * FROM publish_log WHERE tenant_id = ? ORDER BY created_at DESC', (tenant_id,))
        else:
            cursor.execute('SELECT * FROM publish_log ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [dict_from_row(row) for row in rows]
    
    @staticmethod
    def increment_retry(log_id: str):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('UPDATE publish_log SET retry_count = retry_count + 1 WHERE log_id = ?', (log_id,))
        conn.commit()
        conn.close()
