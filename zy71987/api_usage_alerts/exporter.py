import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from .database import get_connection
from .revisor import TABLE_MAP

EXPORT_COLUMNS = {
    'permission': [
        'id', 'api_name', 'api_path', 'app_key', 'app_name',
        'permission_level', 'daily_quota', 'monthly_quota',
        'effective_date', 'expiry_date', 'status',
        'session_id', 'import_time'
    ],
    'migration': [
        'id', 'app_key', 'migration_task', 'planned_date',
        'actual_date', 'status', 'assignee', 'priority',
        'dependencies', 'notes', 'session_id', 'import_time'
    ],
    'alert': [
        'id', 'alert_id', 'api_name', 'app_key', 'alert_type',
        'alert_level', 'threshold_value', 'actual_value', 'alert_time',
        'acknowledgement_status', 'acknowledged_by', 'acknowledged_time',
        'resolution_notes', 'session_id', 'import_time'
    ],
    'alert_report': [
        'alert_id', 'api_name', 'app_key', 'alert_type', 'alert_level',
        'threshold_value', 'actual_value', 'alert_time',
        'acknowledgement_status', 'acknowledged_by',
        'permission_level', 'daily_quota', 'monthly_quota',
        'migration_tasks', 'migration_status',
        'confirmations_count', 'latest_confirmation_result'
    ]
}

def build_where_clause(filters: Dict[str, Any]) -> tuple:
    conditions = []
    params = []
    
    for key, value in filters.items():
        if value is None:
            continue
        if key.endswith('_like'):
            field = key.replace('_like', '')
            conditions.append(f"{field} LIKE ?")
            params.append(f"%{value}%")
        elif key.endswith('_gte'):
            field = key.replace('_gte', '')
            conditions.append(f"{field} >= ?")
            params.append(value)
        elif key.endswith('_lte'):
            field = key.replace('_lte', '')
            conditions.append(f"{field} <= ?")
            params.append(value)
        elif key.endswith('_in'):
            field = key.replace('_in', '')
            placeholders = ','.join(['?'] * len(value))
            conditions.append(f"{field} IN ({placeholders})")
            params.extend(value)
        else:
            conditions.append(f"{key} = ?")
            params.append(value)
    
    return conditions, params

def query_data(table_type: str, filters: Dict[str, Any] = None, 
               include_deleted: bool = False) -> List[Dict]:
    table_name = TABLE_MAP.get(table_type)
    if not table_name:
        return []
    
    conn = get_connection()
    cursor = conn.cursor()
    
    query = f"SELECT * FROM {table_name}"
    params = []
    
    if filters:
        conditions, params = build_where_clause(filters)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            if not include_deleted:
                query += " AND is_deleted = 0"
        elif not include_deleted:
            query += " WHERE is_deleted = 0"
    elif not include_deleted:
        query += " WHERE is_deleted = 0"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_permissions_with_context(filters: Dict[str, Any] = None) -> Dict[str, Dict]:
    permissions = query_data('permission', filters)
    perm_map = {}
    for p in permissions:
        key = (p['app_key'], p['api_name'])
        perm_map[key] = p
    return perm_map

def get_migrations_by_app() -> Dict[str, List[Dict]]:
    migrations = query_data('migration')
    migration_map = {}
    for m in migrations:
        app_key = m['app_key']
        if app_key not in migration_map:
            migration_map[app_key] = []
        migration_map[app_key].append(m)
    return migration_map

def get_confirmations_map() -> Dict[str, List[Dict]]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM manual_confirmations ORDER BY confirmed_time DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    conf_map = {}
    for c in rows:
        c_dict = dict(c)
        key = f"{c_dict['reference_type']}:{c_dict['reference_id']}"
        if key not in conf_map:
            conf_map[key] = []
        conf_map[key].append(c_dict)
    return conf_map

def generate_alert_report(alert_filters: Dict[str, Any] = None) -> List[Dict]:
    alerts = query_data('alert', alert_filters)
    perm_map = get_permissions_with_context()
    migration_map = get_migrations_by_app()
    conf_map = get_confirmations_map()
    
    report = []
    
    for alert in alerts:
        app_key = alert['app_key']
        api_name = alert['api_name']
        
        perm = perm_map.get((app_key, api_name), {})
        migrations = migration_map.get(app_key, [])
        alert_confs = conf_map.get(f"alert_records:{alert['id']}", [])
        
        migration_tasks = '; '.join([
            f"{m['migration_task']}" for m in migrations]) if migrations else ''
        migration_status = migrations[0]['status'] if migrations else '无迁移任务'
        
        report.append({
            'alert_id': alert['alert_id'],
            'api_name': api_name,
            'app_key': app_key,
            'alert_type': alert['alert_type'],
            'alert_level': alert['alert_level'],
            'threshold_value': alert['threshold_value'],
            'actual_value': alert['actual_value'],
            'alert_time': alert['alert_time'],
            'acknowledgement_status': alert['acknowledgement_status'],
            'acknowledged_by': alert['acknowledged_by'],
            'permission_level': perm.get('permission_level', '未知'),
            'daily_quota': perm.get('daily_quota', ''),
            'monthly_quota': perm.get('monthly_quota', ''),
            'migration_tasks': migration_tasks,
            'migration_status': migration_status,
            'confirmations_count': len(alert_confs),
            'latest_confirmation_result': alert_confs[0]['confirmation_result'] if alert_confs else '未确认'
        })
    
    return report

def export_to_csv(data: List[Dict], columns: List[str], filepath: str, 
                  include_metadata: bool = True) -> Dict:
    with open(filepath, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(data)
    
    metadata = {
        'export_time': datetime.now().isoformat(),
        'record_count': len(data),
        'columns': columns,
        'filepath': filepath
    }
    
    if include_metadata:
        meta_filepath = filepath.replace('.csv', '_meta.json')
        with open(meta_filepath, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
    
    return metadata

def export_table(table_type: str, filters: Dict[str, Any], filepath: str) -> Dict:
    columns = EXPORT_COLUMNS.get(table_type)
    if not columns:
        return {"status": "error", "message": f"未知导出类型: {table_type}"}
    
    data = query_data(table_type, filters)
    metadata = export_to_csv(data, columns, filepath)
    return {
        "status": "success",
        "type": table_type,
        "filter_count": len(data),
        "filepath": filepath,
        "metadata": metadata
    }

def export_alert_report(filters: Dict[str, Any], filepath: str) -> Dict:
    report_data = generate_alert_report(filters)
    columns = EXPORT_COLUMNS['alert_report']
    metadata = export_to_csv(report_data, columns, filepath)
    return {
        "status": "success",
        "type": "alert_report",
        "record_count": len(report_data),
        "filepath": filepath,
        "metadata": metadata
    }

def get_data_summary() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    summary = {}
    
    for table_type, table_name in TABLE_MAP.items():
        cursor.execute(f'''
            SELECT COUNT(*) as total,
                   COALESCE(SUM(CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END), 0) as active,
                   COALESCE(SUM(CASE WHEN is_deleted = 1 THEN 1 ELSE 0 END), 0) as deleted
            FROM {table_name}
        ''')
        row = cursor.fetchone()
        summary[table_type] = {
            'total': row['total'],
            'active': row['active'],
            'deleted': row['deleted']
        }
    
    cursor.execute('SELECT COUNT(*) as total FROM import_sessions')
    summary['sessions'] = cursor.fetchone()['total']
    
    cursor.execute('SELECT COUNT(*) as total FROM manual_confirmations')
    summary['confirmations'] = cursor.fetchone()['total']
    
    conn.close()
    return summary

def detect_anomalies() -> Dict[str, List[Dict]]:
    anomalies = {}
    
    alerts = query_data('alert', {'acknowledgement_status': 'pending'})
    if alerts:
        anomalies['pending_alerts'] = alerts[:10]
    
    migrations = query_data('migration', {'status': 'blocked'})
    if migrations:
        anomalies['blocked_migrations'] = migrations
    
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.* FROM alert_records a
        LEFT JOIN permission_tables p 
        ON a.app_key = p.app_key AND a.api_name = p.api_name
        WHERE p.id IS NULL AND a.is_deleted = 0
    ''')
    orphan_alerts = cursor.fetchall()
    conn.close()
    
    if orphan_alerts:
        anomalies['alerts_without_permission'] = [dict(a) for a in orphan_alerts][:10]
    
    return anomalies
