import hashlib
import json
import csv
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from .database import get_connection

def calculate_record_hash(record: Dict[str, Any]) -> str:
    sorted_items = sorted(record.items())
    record_str = json.dumps(sorted_items, ensure_ascii=False, sort_keys=True)
    return hashlib.md5(record_str.encode('utf-8')).hexdigest()

def create_import_session(conn, session_type: str, filename: str, operator: str = 'system') -> int:
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO import_sessions 
        (session_type, filename, import_time, operator, status)
        VALUES (?, ?, ?, ?, 'processing')
    ''', (session_type, filename, datetime.now().isoformat(), operator))
    return cursor.lastrowid

def update_session_status(conn, session_id: int, status: str, **kwargs):
    cursor = conn.cursor()
    updates = []
    params = []
    for key, value in kwargs.items():
        updates.append(f"{key} = ?")
        params.append(value)
    updates.append("status = ?")
    params.append(status)
    params.append(session_id)
    
    cursor.execute(f'''
        UPDATE import_sessions 
        SET {', '.join(updates)}
        WHERE id = ?
    ''', params)

def check_duplicate(conn, table_name: str, record_hash: str) -> Tuple[bool, Optional[Dict]]:
    cursor = conn.cursor()
    cursor.execute(f'''
        SELECT id, session_id, record_hash FROM {table_name} 
        WHERE record_hash = ? AND is_deleted = 0
    ''', (record_hash,))
    row = cursor.fetchone()
    if row:
        return True, dict(row)
    return False, None

def log_audit(conn, session_id: int, action_type: str, entity_type: str, 
              entity_id: int, old_values: Any, new_values: Any, 
              operator: str, reason: str = None):
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO audit_logs 
        (session_id, action_type, entity_type, entity_id, old_values, 
         new_values, operator, operation_time, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (session_id, action_type, entity_type, entity_id,
          json.dumps(old_values, ensure_ascii=False) if old_values else None,
          json.dumps(new_values, ensure_ascii=False) if new_values else None,
          operator, datetime.now().isoformat(), reason))

def import_permissions(conn, session_id: int, records: List[Dict], operator: str) -> Dict[str, int]:
    cursor = conn.cursor()
    
    stats = {"success": 0, "duplicate": 0, "error": 0}
    import_time = datetime.now().isoformat()
    
    for record in records:
        try:
            record_hash = calculate_record_hash(record)
            is_dup, existing = check_duplicate(conn, 'permission_tables', record_hash)
            
            if is_dup:
                stats["duplicate"] += 1
                log_audit(conn, session_id, 'duplicate_skip', 'permission_tables',
                         existing['id'], None, record, operator, 
                         f"重复记录跳过，哈希: {record_hash}")
                continue
            
            cursor.execute('''
                INSERT INTO permission_tables 
                (session_id, api_name, api_path, app_key, app_name, 
                 permission_level, daily_quota, monthly_quota, 
                 effective_date, expiry_date, status, record_hash, import_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
            ''', (session_id, 
                  record.get('api_name', ''),
                  record.get('api_path', ''),
                  record.get('app_key', ''),
                  record.get('app_name', ''),
                  record.get('permission_level', ''),
                  record.get('daily_quota'),
                  record.get('monthly_quota'),
                  record.get('effective_date'),
                  record.get('expiry_date'),
                  record_hash, import_time))
            
            stats["success"] += 1
            log_audit(conn, session_id, 'insert', 'permission_tables',
                     cursor.lastrowid, None, record, operator)
            
        except Exception as e:
            stats["error"] += 1
            log_audit(conn, session_id, 'error', 'permission_tables',
                     None, None, record, operator, f"导入错误: {str(e)}")
    
    return stats

def import_migrations(conn, session_id: int, records: List[Dict], operator: str) -> Dict[str, int]:
    cursor = conn.cursor()
    
    stats = {"success": 0, "duplicate": 0, "error": 0}
    import_time = datetime.now().isoformat()
    
    for record in records:
        try:
            record_hash = calculate_record_hash(record)
            is_dup, existing = check_duplicate(conn, 'migration_checklists', record_hash)
            
            if is_dup:
                stats["duplicate"] += 1
                log_audit(conn, session_id, 'duplicate_skip', 'migration_checklists',
                         existing['id'], None, record, operator, 
                         f"重复记录跳过，哈希: {record_hash}")
                continue
            
            cursor.execute('''
                INSERT INTO migration_checklists 
                (session_id, app_key, migration_task, planned_date, 
                 actual_date, status, assignee, priority, dependencies, 
                 notes, record_hash, import_time)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
            ''', (session_id,
                  record.get('app_key', ''),
                  record.get('migration_task', ''),
                  record.get('planned_date'),
                  record.get('actual_date'),
                  record.get('assignee'),
                  record.get('priority', 'normal'),
                  record.get('dependencies'),
                  record.get('notes'),
                  record_hash, import_time))
            
            stats["success"] += 1
            log_audit(conn, session_id, 'insert', 'migration_checklists',
                     cursor.lastrowid, None, record, operator)
            
        except Exception as e:
            stats["error"] += 1
            log_audit(conn, session_id, 'error', 'migration_checklists',
                     None, None, record, operator, f"导入错误: {str(e)}")
    
    return stats

def import_alerts(conn, session_id: int, records: List[Dict], operator: str) -> Dict[str, int]:
    cursor = conn.cursor()
    
    stats = {"success": 0, "duplicate": 0, "error": 0}
    import_time = datetime.now().isoformat()
    
    for record in records:
        try:
            record_hash = calculate_record_hash(record)
            is_dup, existing = check_duplicate(conn, 'alert_records', record_hash)
            
            if is_dup:
                stats["duplicate"] += 1
                log_audit(conn, session_id, 'duplicate_skip', 'alert_records',
                         existing['id'], None, record, operator, 
                         f"重复记录跳过，哈希: {record_hash}")
                continue
            
            cursor.execute('''
                INSERT INTO alert_records 
                (session_id, alert_id, api_name, app_key, alert_type, 
                 alert_level, threshold_value, actual_value, alert_time, 
                 acknowledgement_status, record_hash, import_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            ''', (session_id,
                  record.get('alert_id', ''),
                  record.get('api_name', ''),
                  record.get('app_key', ''),
                  record.get('alert_type', ''),
                  record.get('alert_level', ''),
                  record.get('threshold_value'),
                  record.get('actual_value'),
                  record.get('alert_time'),
                  record_hash, import_time))
            
            stats["success"] += 1
            log_audit(conn, session_id, 'insert', 'alert_records',
                     cursor.lastrowid, None, record, operator)
            
        except Exception as e:
            stats["error"] += 1
            log_audit(conn, session_id, 'error', 'alert_records',
                     None, None, record, operator, f"导入错误: {str(e)}")
    
    return stats

def read_csv_file(filepath: str) -> List[Dict]:
    records = []
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned = {k: v.strip() if v else None for k, v in row.items()}
            records.append(cleaned)
    return records

def import_file(filepath: str, import_type: str, operator: str = 'system') -> Dict:
    records = read_csv_file(filepath)
    filename = filepath.split('/')[-1]
    
    conn = get_connection()
    
    session_id = create_import_session(conn, import_type, filename, operator)
    conn.commit()
    
    import_functions = {
        'permission': import_permissions,
        'migration': import_migrations,
        'alert': import_alerts
    }
    
    if import_type not in import_functions:
        update_session_status(conn, session_id, 'failed', notes=f"未知导入类型: {import_type}")
        conn.commit()
        conn.close()
        return {"session_id": session_id, "status": "failed", "error": f"未知类型: {import_type}"}
    
    stats = import_functions[import_type](conn, session_id, records, operator)
    
    final_status = 'completed' if stats["error"] == 0 else 'partial'
    update_session_status(conn, session_id, final_status,
                          total_records=len(records),
                          success_count=stats["success"],
                          duplicate_count=stats["duplicate"],
                          error_count=stats["error"])
    
    conn.commit()
    conn.close()
    
    return {
        "session_id": session_id,
        "status": final_status,
        "total": len(records),
        "success": stats["success"],
        "duplicate": stats["duplicate"],
        "error": stats["error"]
    }
