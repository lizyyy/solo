import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from .database import get_connection
from .importer import create_import_session, update_session_status, log_audit

TABLE_MAP = {
    'permission': 'permission_tables',
    'migration': 'migration_checklists',
    'alert': 'alert_records'
}

def get_session_records(session_id: int, table_type: str) -> List[Dict]:
    table_name = TABLE_MAP.get(table_type)
    if not table_name:
        return []
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f'''
        SELECT * FROM {table_name} 
        WHERE session_id = ? AND is_deleted = 0
    ''', (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_session_info(session_id: int) -> Optional[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM import_sessions WHERE id = ?
    ''', (session_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def list_sessions(limit: int = 20, session_type: str = None) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    
    if session_type:
        cursor.execute('''
            SELECT * FROM import_sessions 
            WHERE session_type = ?
            ORDER BY import_time DESC LIMIT ?
        ''', (session_type, limit))
    else:
        cursor.execute('''
            SELECT * FROM import_sessions 
            ORDER BY import_time DESC LIMIT ?
        ''', (limit,))
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def rollback_session(session_id: int, operator: str, reason: str = None) -> Dict:
    session_info = get_session_info(session_id)
    if not session_info:
        return {"status": "error", "message": f"会话 {session_id} 不存在"}
    
    if session_info['status'] == 'rolled_back':
        return {"status": "error", "message": f"会话 {session_id} 已经撤回"}
    
    table_type = session_info['session_type']
    table_name = TABLE_MAP.get(table_type)
    if not table_name:
        return {"status": "error", "message": f"未知会话类型: {table_type}"}
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute(f'''
        SELECT id FROM {table_name} 
        WHERE session_id = ? AND is_deleted = 0
    ''', (session_id,))
    record_ids = [row[0] for row in cursor.fetchall()]
    
    cursor.execute(f'''
        UPDATE {table_name} 
        SET is_deleted = 1 
        WHERE session_id = ? AND is_deleted = 0
    ''', (session_id,))
    affected_count = cursor.rowcount
    
    new_session_id = create_import_session(
        conn,
        table_type, 
        f"ROLLBACK_{session_info['filename']}",
        operator
    )
    conn.commit()
    
    for record_id in record_ids:
        log_audit(conn, new_session_id, 'rollback_delete', table_name,
                 record_id, None, None, operator, 
                 reason or f"撤回会话 {session_id}")
    
    cursor.execute('''
        UPDATE import_sessions 
        SET status = 'rolled_back', parent_session_id = ?
        WHERE id = ?
    ''', (session_id, new_session_id))
    
    cursor.execute('''
        UPDATE import_sessions 
        SET status = 'rolled_back', notes = ?
        WHERE id = ?
    ''', (f"已撤回，由会话 {new_session_id} 执行", session_id))
    
    update_session_status(conn, new_session_id, 'completed',
                          total_records=affected_count,
                          success_count=affected_count,
                          notes=reason or f"撤回会话 {session_id}")
    
    conn.commit()
    conn.close()
    
    return {
        "status": "success",
        "rollback_session_id": new_session_id,
        "rolled_back_records": affected_count,
        "original_session_id": session_id
    }

def add_manual_confirmation(session_id: int, reference_type: str, 
                           reference_id: int, confirmation_type: str,
                           confirmed_by: str, confirmation_result: str,
                           comments: str = None, evidence_snapshot: Dict = None) -> Dict:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO manual_confirmations 
        (session_id, reference_type, reference_id, confirmation_type,
         confirmed_by, confirmed_time, confirmation_result, comments, evidence_snapshot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (session_id, reference_type, reference_id, confirmation_type,
          confirmed_by, datetime.now().isoformat(), confirmation_result,
          comments, 
          json.dumps(evidence_snapshot, ensure_ascii=False) if evidence_snapshot else None))
    
    confirm_id = cursor.lastrowid
    
    log_audit(conn, session_id, 'confirmation', reference_type, reference_id,
             None, {"type": confirmation_type, "result": confirmation_result},
             confirmed_by, comments)
    
    conn.commit()
    conn.close()
    
    return {
        "confirmation_id": confirm_id,
        "status": "success"
    }

def get_confirmations(reference_type: str = None, reference_id: int = None) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    
    if reference_type and reference_id:
        cursor.execute('''
            SELECT * FROM manual_confirmations 
            WHERE reference_type = ? AND reference_id = ?
            ORDER BY confirmed_time DESC
        ''', (reference_type, reference_id))
    else:
        cursor.execute('''
            SELECT * FROM manual_confirmations 
            ORDER BY confirmed_time DESC
        ''')
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_audit_logs(session_id: int = None, entity_type: str = None, limit: int = 100) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM audit_logs WHERE 1=1"
    params = []
    
    if session_id:
        query += " AND session_id = ?"
        params.append(session_id)
    
    if entity_type:
        query += " AND entity_type = ?"
        params.append(entity_type)
    
    query += " ORDER BY operation_time DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_record_history(table_type: str, record_id: int) -> Dict[str, Any]:
    table_name = TABLE_MAP.get(table_type)
    if not table_name:
        return {"error": f"未知类型: {table_type}"}
    
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute(f'''
        SELECT * FROM {table_name} WHERE id = ?
    ''', (record_id,))
    current = cursor.fetchone()
    
    cursor.execute('''
        SELECT * FROM audit_logs 
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY operation_time DESC
    ''', (table_name, record_id))
    audits = cursor.fetchall()
    
    cursor.execute('''
        SELECT * FROM manual_confirmations 
        WHERE reference_type = ? AND reference_id = ?
        ORDER BY confirmed_time DESC
    ''', (table_name, record_id))
    confirmations = cursor.fetchall()
    
    conn.close()
    
    return {
        "current": dict(current) if current else None,
        "audit_logs": [dict(a) for a in audits],
        "confirmations": [dict(c) for c in confirmations]
    }
