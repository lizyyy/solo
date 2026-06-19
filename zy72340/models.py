import sqlite3
import json
import csv
import io
from datetime import datetime
from typing import List, Dict, Optional, Any

DB_PATH = 'ledger.db'

def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA busy_timeout=30000')
    return conn

def init_db():
    conn = get_conn()
    c = conn.cursor()
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS weight_tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active INTEGER DEFAULT 1
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS formula_screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_id INTEGER,
        description TEXT,
        image_path TEXT,
        formula_content TEXT,
        is_old_formula INTEGER DEFAULT 1,
        uploaded_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledger_records(id)
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS ledger_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial_no TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        weight_table_id INTEGER,
        formula_screenshot_id INTEGER,
        params_json TEXT,
        result_json TEXT,
        has_gap INTEGER DEFAULT 0,
        gap_note TEXT,
        gap_original_claim TEXT,
        gap_corrected_value TEXT,
        gap_reason TEXT,
        gap_next_handler TEXT,
        is_old_caliber INTEGER DEFAULT 0,
        old_caliber_note TEXT,
        review_status TEXT DEFAULT 'pending',
        review_note TEXT,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        original_params_json TEXT,
        corrected_params_json TEXT,
        correction_reason TEXT,
        next_handler TEXT,
        suspension_note TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (weight_table_id) REFERENCES weight_tables(id),
        FOREIGN KEY (formula_screenshot_id) REFERENCES formula_screenshots(id)
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS ledger_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_id INTEGER NOT NULL,
        item_no INTEGER NOT NULL,
        original_no INTEGER,
        x_value REAL NOT NULL,
        y_value REAL NOT NULL,
        original_x REAL,
        original_y REAL,
        calculated_y REAL,
        residual REAL,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TIMESTAMP,
        deleted_by TEXT,
        delete_reason TEXT,
        is_old_caliber INTEGER DEFAULT 0,
        old_caliber_source TEXT,
        correction_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledger_records(id)
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS change_traces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_id INTEGER NOT NULL,
        item_id INTEGER,
        trace_type TEXT NOT NULL,
        field_name TEXT,
        original_value TEXT,
        corrected_value TEXT,
        change_reason TEXT NOT NULL,
        source_ref TEXT,
        next_handler TEXT,
        handled_by TEXT,
        handled_at TIMESTAMP,
        is_suspended INTEGER DEFAULT 0,
        suspension_note TEXT,
        operator TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledger_records(id),
        FOREIGN KEY (item_id) REFERENCES ledger_items(id)
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS param_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_id INTEGER NOT NULL,
        version_no INTEGER NOT NULL,
        params_json TEXT NOT NULL,
        weight_table_id INTEGER,
        formula_screenshot_id INTEGER,
        change_type TEXT NOT NULL,
        change_note TEXT,
        is_suspended INTEGER DEFAULT 0,
        suspension_note TEXT,
        original_params_json TEXT,
        correction_reason TEXT,
        next_handler TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledger_records(id),
        FOREIGN KEY (weight_table_id) REFERENCES weight_tables(id),
        FOREIGN KEY (formula_screenshot_id) REFERENCES formula_screenshots(id)
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS history_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_id INTEGER NOT NULL,
        param_version_id INTEGER,
        change_trace_id INTEGER,
        action TEXT NOT NULL,
        detail_json TEXT,
        operator TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledger_records(id),
        FOREIGN KEY (param_version_id) REFERENCES param_versions(id),
        FOREIGN KEY (change_trace_id) REFERENCES change_traces(id)
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS review_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_id INTEGER NOT NULL,
        review_type TEXT NOT NULL,
        review_result TEXT NOT NULL,
        review_note TEXT,
        original_claim TEXT,
        corrected_value TEXT,
        next_step TEXT,
        next_handler TEXT,
        reviewed_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledger_records(id)
    )
    ''')
    
    conn.commit()
    conn.close()

class WeightTable:
    @staticmethod
    def create(version: str, name: str, data: Dict, created_by: str) -> int:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            INSERT INTO weight_tables (version, name, data, created_by)
            VALUES (?, ?, ?, ?)
        ''', (version, name, json.dumps(data, ensure_ascii=False), created_by))
        conn.commit()
        new_id = c.lastrowid
        conn.close()
        return new_id
    
    @staticmethod
    def get(wt_id: int) -> Optional[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT * FROM weight_tables WHERE id = ?', (wt_id,))
        row = c.fetchone()
        conn.close()
        if row:
            d = dict(row)
            d['data'] = json.loads(d['data'])
            return d
        return None
    
    @staticmethod
    def list_all() -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT * FROM weight_tables ORDER BY created_at DESC')
        rows = c.fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            d['data'] = json.loads(d['data'])
            result.append(d)
        return result

class FormulaScreenshot:
    @staticmethod
    def create(ledger_id: int, description: str, formula_content: str, 
               uploaded_by: str, image_path: str = None) -> int:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            INSERT INTO formula_screenshots (ledger_id, description, image_path, 
                                           formula_content, uploaded_by)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, description, image_path, formula_content, uploaded_by))
        conn.commit()
        new_id = c.lastrowid
        conn.close()
        return new_id
    
    @staticmethod
    def get(fs_id: int) -> Optional[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT * FROM formula_screenshots WHERE id = ?', (fs_id,))
        row = c.fetchone()
        conn.close()
        return dict(row) if row else None
    
    @staticmethod
    def list_by_ledger(ledger_id: int) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT * FROM formula_screenshots WHERE ledger_id = ? ORDER BY created_at', 
                  (ledger_id,))
        rows = c.fetchall()
        conn.close()
        return [dict(r) for r in rows]

class ChangeTrace:
    @staticmethod
    def create(ledger_id: int, trace_type: str, change_reason: str,
               operator: str, item_id: int = None, field_name: str = None,
               original_value: Any = None, corrected_value: Any = None,
               source_ref: str = None, next_handler: str = None,
               is_suspended: int = 0, suspension_note: str = None,
               conn=None, c=None) -> int:
        external_conn = conn is not None
        if not external_conn:
            conn = get_conn()
            c = conn.cursor()
        
        orig_str = json.dumps(original_value, ensure_ascii=False) if original_value is not None else None
        corr_str = json.dumps(corrected_value, ensure_ascii=False) if corrected_value is not None else None
        
        c.execute('''
            INSERT INTO change_traces 
            (ledger_id, item_id, trace_type, field_name, original_value, 
             corrected_value, change_reason, source_ref, next_handler, 
             is_suspended, suspension_note, operator)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (ledger_id, item_id, trace_type, field_name, orig_str, corr_str,
              change_reason, source_ref, next_handler, is_suspended, 
              suspension_note, operator))
        
        trace_id = c.lastrowid
        
        if not external_conn:
            conn.commit()
            conn.close()
        return trace_id
    
    @staticmethod
    def list_by_ledger(ledger_id: int) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            SELECT ct.*, li.item_no as item_no
            FROM change_traces ct
            LEFT JOIN ledger_items li ON ct.item_id = li.id
            WHERE ct.ledger_id = ?
            ORDER BY ct.created_at DESC
        ''', (ledger_id,))
        rows = c.fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('original_value'):
                try:
                    d['original_value'] = json.loads(d['original_value'])
                except:
                    pass
            if d.get('corrected_value'):
                try:
                    d['corrected_value'] = json.loads(d['corrected_value'])
                except:
                    pass
            result.append(d)
        return result

class LedgerRecord:
    @staticmethod
    def create(serial_no: str, title: str, weight_table_id: int, 
               items: List[Dict], created_by: str) -> int:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            INSERT INTO ledger_records (serial_no, title, weight_table_id, created_by)
            VALUES (?, ?, ?, ?)
        ''', (serial_no, title, weight_table_id, created_by))
        ledger_id = c.lastrowid
        
        for idx, item in enumerate(items, 1):
            c.execute('''
                INSERT INTO ledger_items (ledger_id, item_no, x_value, y_value, original_x, original_y)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (ledger_id, idx, item['x'], item['y'], item['x'], item['y']))
        
        item_ids = []
        c.execute('SELECT id, item_no FROM ledger_items WHERE ledger_id = ?', (ledger_id,))
        for r in c.fetchall():
            item_ids.append({'id': r['id'], 'item_no': r['item_no']})
        
        ChangeTrace.create(
            ledger_id=ledger_id,
            trace_type='create',
            change_reason='创建台账记录，初始化数据点',
            operator=created_by,
            original_value={'item_count': len(items), 'weight_table_id': weight_table_id},
            corrected_value={'item_ids': item_ids},
            conn=conn, c=c
        )
        
        conn.commit()
        conn.close()
        return ledger_id
    
    @staticmethod
    def get(ledger_id: int) -> Optional[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT * FROM ledger_records WHERE id = ?', (ledger_id,))
        row = c.fetchone()
        if not row:
            conn.close()
            return None
        
        record = dict(row)
        if record.get('params_json'):
            record['params'] = json.loads(record['params_json'])
        if record.get('result_json'):
            record['result'] = json.loads(record['result_json'])
        if record.get('original_params_json'):
            record['original_params'] = json.loads(record['original_params_json'])
        if record.get('corrected_params_json'):
            record['corrected_params'] = json.loads(record['corrected_params_json'])
        
        c.execute('''
            SELECT * FROM ledger_items 
            WHERE ledger_id = ? AND is_deleted = 0
            ORDER BY item_no
        ''', (ledger_id,))
        items = c.fetchall()
        record['items'] = [dict(it) for it in items]
        
        c.execute('''
            SELECT * FROM ledger_items 
            WHERE ledger_id = ? AND is_deleted = 1
            ORDER BY item_no
        ''', (ledger_id,))
        deleted_items = c.fetchall()
        record['deleted_items'] = [dict(it) for it in deleted_items]
        
        c.execute('''
            SELECT wt.name as weight_table_name, wt.version as weight_version,
                   wt.data as weight_table_data,
                   fs.description as screenshot_desc, fs.formula_content
            FROM ledger_records lr
            LEFT JOIN weight_tables wt ON lr.weight_table_id = wt.id
            LEFT JOIN formula_screenshots fs ON lr.formula_screenshot_id = fs.id
            WHERE lr.id = ?
        ''', (ledger_id,))
        meta = c.fetchone()
        if meta:
            record['weight_table_name'] = meta['weight_table_name']
            record['weight_version'] = meta['weight_version']
            if meta['weight_table_data']:
                record['weight_table_data'] = json.loads(meta['weight_table_data'])
            record['screenshot_desc'] = meta['screenshot_desc']
            record['formula_content'] = meta['formula_content']
        
        c.execute('SELECT * FROM review_records WHERE ledger_id = ? ORDER BY created_at DESC',
                  (ledger_id,))
        record['reviews'] = [dict(r) for r in c.fetchall()]
        
        screenshots = FormulaScreenshot.list_by_ledger(ledger_id)
        record['screenshots'] = screenshots
        
        traces = ChangeTrace.list_by_ledger(ledger_id)
        record['change_traces'] = traces
        
        gap_info = LedgerRecord.check_gap(ledger_id, conn, c)
        record['gap_detail'] = gap_info
        
        versions = ParamVersion.list_by_ledger(ledger_id)
        record['param_versions'] = versions
        
        history = HistoryLog.list_by_ledger(ledger_id)
        record['history'] = history
        
        has_suspended = any(t.get('is_suspended') for t in traces)
        has_suspended_pv = any(pv.get('is_suspended') for pv in versions)
        record['is_suspended'] = has_suspended or has_suspended_pv or (record.get('review_status') == 'pending_review')
        
        record['latest_version'] = max((pv['version_no'] for pv in versions), default=None)
        
        summary_items = {
            'total': len(record['items']) + len(record['deleted_items']),
            'active': len(record['items']),
            'deleted': len(record['deleted_items']),
            'old_caliber': sum(1 for it in record['items'] if it.get('is_old_caliber')),
            'traces': len(traces),
            'param_versions': len(versions),
            'reviews': len(record['reviews'])
        }
        record['summary'] = summary_items
        
        conn.close()
        return record
    
    @staticmethod
    def list_all() -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            SELECT lr.*, wt.name as weight_table_name, wt.version as weight_version
            FROM ledger_records lr
            LEFT JOIN weight_tables wt ON lr.weight_table_id = wt.id
            ORDER BY lr.updated_at DESC
        ''')
        rows = c.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('params_json'):
                d['params'] = json.loads(d['params_json'])
            
            c.execute('''
                SELECT 
                    SUM(CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END) as active_count,
                    SUM(CASE WHEN is_deleted = 1 THEN 1 ELSE 0 END) as deleted_count,
                    SUM(CASE WHEN is_old_caliber = 1 AND is_deleted = 0 THEN 1 ELSE 0 END) as old_count
                FROM ledger_items WHERE ledger_id = ?
            ''', (d['id'],))
            counts = c.fetchone()
            d['active_count'] = counts['active_count'] or 0
            d['deleted_count'] = counts['deleted_count'] or 0
            d['old_caliber_count'] = counts['old_count'] or 0
            
            c.execute('SELECT COUNT(*) as cnt FROM change_traces WHERE ledger_id = ?', (d['id'],))
            d['trace_count'] = c.fetchone()['cnt'] or 0
            
            c.execute('SELECT COUNT(*) as cnt FROM param_versions WHERE ledger_id = ?', (d['id'],))
            d['version_count'] = c.fetchone()['cnt'] or 0
            
            c.execute('SELECT MAX(version_no) as max_v FROM param_versions WHERE ledger_id = ?', (d['id'],))
            d['latest_version'] = c.fetchone()['max_v']
            
            result.append(d)
        conn.close()
        return result
    
    @staticmethod
    def update_status(ledger_id: int, status: str, operator: str, 
                      reason: str = '', next_handler: str = None) -> None:
        conn = get_conn()
        c = conn.cursor()
        
        c.execute('SELECT status FROM ledger_records WHERE id = ?', (ledger_id,))
        old_row = c.fetchone()
        old_status = old_row['status'] if old_row else ''
        
        updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP']
        params = [status, ledger_id]
        
        if reason:
            updates.insert(0, 'suspension_note = ?')
            params.insert(0, reason)
        if next_handler:
            updates.insert(0, 'next_handler = ?')
            params.insert(0, next_handler)
        
        c.execute(f'''
            UPDATE ledger_records SET {', '.join(updates)} WHERE id = ?
        ''', params)
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, f'状态变更:{old_status}→{status}', 
              json.dumps({'old_status': old_status, 'new_status': status,
                         'reason': reason, 'next_handler': next_handler}, 
                        ensure_ascii=False),
              operator))
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def check_gap(ledger_id: int, conn=None, c=None) -> Dict:
        external_conn = conn is not None
        if not external_conn:
            conn = get_conn()
            c = conn.cursor()
        
        c.execute('''
            SELECT item_no, id FROM ledger_items 
            WHERE ledger_id = ? AND is_deleted = 0
            ORDER BY item_no
        ''', (ledger_id,))
        rows = c.fetchall()
        
        if not external_conn:
            conn.close()
        
        nos = [r['item_no'] for r in rows]
        ids = [r['id'] for r in rows]
        gaps = []
        gap_details = []
        if len(nos) > 1:
            for i in range(len(nos) - 1):
                if nos[i + 1] - nos[i] > 1:
                    gaps.append((nos[i], nos[i + 1]))
                    missing_nos = list(range(nos[i] + 1, nos[i + 1]))
                    gap_details.append({
                        'between': [nos[i], nos[i + 1]],
                        'missing': missing_nos,
                        'count': len(missing_nos)
                    })
        
        return {
            'has_gap': len(gaps) > 0,
            'gaps': gaps,
            'gap_details': gap_details,
            'item_nos': nos,
            'item_ids': ids,
            'consecutive': len(gaps) == 0,
            'max_no': max(nos) if nos else 0,
            'min_no': min(nos) if nos else 0
        }
    
    @staticmethod
    def suspend(ledger_id: int, operator: str, suspension_note: str,
                next_handler: str = None) -> int:
        conn = get_conn()
        c = conn.cursor()
        
        trace_id = ChangeTrace.create(
            ledger_id=ledger_id, trace_type='suspend',
            change_reason=suspension_note, operator=operator,
            next_handler=next_handler, is_suspended=1,
            suspension_note=suspension_note,
            conn=conn, c=c
        )
        
        c.execute('''
            UPDATE ledger_records
            SET status = 'suspended', suspension_note = ?,
                next_handler = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (suspension_note, next_handler, ledger_id))
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, change_trace_id, action, 
                                     detail_json, operator)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, trace_id, '暂停处理',
              json.dumps({'suspension_note': suspension_note, 
                         'next_handler': next_handler}, ensure_ascii=False),
              operator))
        
        conn.commit()
        conn.close()
        return trace_id
    
    @staticmethod
    def resume(ledger_id: int, operator: str, resume_note: str = '') -> int:
        conn = get_conn()
        c = conn.cursor()
        
        trace_id = ChangeTrace.create(
            ledger_id=ledger_id, trace_type='resume',
            change_reason=resume_note or '恢复处理流程', operator=operator,
            is_suspended=0,
            conn=conn, c=c
        )
        
        c.execute('''
            SELECT has_gap, review_status FROM ledger_records WHERE id = ?
        ''', (ledger_id,))
        row = c.fetchone()
        
        new_status = 'ready'
        if row and row['has_gap'] and row['review_status'] != 'reviewed':
            new_status = 'pending_review'
        
        c.execute('''
            UPDATE ledger_records
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (new_status, ledger_id))
        
        c.execute('''
            UPDATE change_traces
            SET is_suspended = 0, handled_by = ?, handled_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (operator, trace_id))
        
        c.execute('''
            UPDATE change_traces
            SET is_suspended = 0, handled_by = COALESCE(handled_by, ?), 
                handled_at = COALESCE(handled_at, CURRENT_TIMESTAMP)
            WHERE ledger_id = ? AND is_suspended = 1
        ''', (operator, ledger_id))
        
        if new_status != 'pending_review' and new_status != 'suspended':
            c.execute('''
                UPDATE param_versions
                SET is_suspended = 0
                WHERE ledger_id = ? AND is_suspended = 1
            ''', (ledger_id,))
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, change_trace_id, action, 
                                     detail_json, operator)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, trace_id, '恢复处理',
              json.dumps({'resume_note': resume_note, 'new_status': new_status}, 
                        ensure_ascii=False),
              operator))
        
        conn.commit()
        conn.close()
        return trace_id
    
    @staticmethod
    def generate_report(ledger_id: int, fmt: str = 'json') -> Any:
        record = LedgerRecord.get(ledger_id)
        if not record:
            return None
        
        def clean_val(v):
            if isinstance(v, (dict, list)):
                return json.dumps(v, ensure_ascii=False)
            return v if v is not None else '-'
        
        if fmt == 'json':
            report = {
                'ledger_id': record['id'],
                'serial_no': record['serial_no'],
                'title': record['title'],
                'status': record['status'],
                'review_status': record['review_status'],
                'created_by': record['created_by'],
                'created_at': record['created_at'],
                'updated_at': record['updated_at'],
                'weight_table': {
                    'name': record.get('weight_table_name'),
                    'version': record.get('weight_version'),
                    'data': record.get('weight_table_data')
                },
                'screenshots': record.get('screenshots', []),
                'current_params': record.get('params'),
                'original_params': record.get('original_params'),
                'corrected_params': record.get('corrected_params'),
                'correction_reason': record.get('correction_reason'),
                'gap_info': {
                    'has_gap': record.get('has_gap'),
                    'gap_note': record.get('gap_note'),
                    'gap_detail': record.get('gap_detail'),
                    'original_claim': record.get('gap_original_claim'),
                    'corrected_value': record.get('gap_corrected_value'),
                    'gap_reason': record.get('gap_reason'),
                    'next_handler': record.get('gap_next_handler')
                },
                'old_caliber_info': {
                    'is_old_caliber': record.get('is_old_caliber'),
                    'note': record.get('old_caliber_note')
                },
                'review_info': {
                    'note': record.get('review_note'),
                    'reviewed_by': record.get('reviewed_by'),
                    'reviewed_at': record.get('reviewed_at'),
                    'history': record.get('reviews', [])
                },
                'summary': record.get('summary'),
                'items': record.get('items', []),
                'deleted_items': record.get('deleted_items', []),
                'param_versions': record.get('param_versions', []),
                'change_traces': record.get('change_traces', []),
                'history': record.get('history', []),
                'next_handler': record.get('next_handler'),
                'suspension_note': record.get('suspension_note')
            }
            return report
        
        elif fmt == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            
            writer.writerow(['最小二乘标定台账报告'])
            writer.writerow([f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'])
            writer.writerow([])
            
            writer.writerow(['一、基本信息'])
            writer.writerow(['台账编号', record['serial_no']])
            writer.writerow(['标题', record['title']])
            writer.writerow(['当前状态', record['status']])
            writer.writerow(['复核状态', record['review_status']])
            writer.writerow(['创建人', record['created_by']])
            writer.writerow(['创建时间', record['created_at']])
            writer.writerow(['最后更新', record['updated_at']])
            writer.writerow([])
            
            writer.writerow(['二、权重表信息'])
            writer.writerow(['名称', clean_val(record.get('weight_table_name'))])
            writer.writerow(['版本', clean_val(record.get('weight_version'))])
            writer.writerow(['配置', clean_val(record.get('weight_table_data'))])
            writer.writerow([])
            
            writer.writerow(['三、当前参数'])
            params = record.get('params') or {}
            writer.writerow(['斜率k', clean_val(params.get('slope'))])
            writer.writerow(['截距b', clean_val(params.get('intercept'))])
            writer.writerow(['R²', clean_val(params.get('r_squared'))])
            writer.writerow([])
            
            writer.writerow(['四、断档信息'])
            writer.writerow(['是否断档', '是' if record.get('has_gap') else '否'])
            writer.writerow(['断档说明', clean_val(record.get('gap_note'))])
            writer.writerow(['原始说法', clean_val(record.get('gap_original_claim'))])
            writer.writerow(['修改后的值', clean_val(record.get('gap_corrected_value'))])
            writer.writerow(['处理原因', clean_val(record.get('gap_reason'))])
            writer.writerow(['下一步处理人', clean_val(record.get('gap_next_handler'))])
            writer.writerow([])
            
            writer.writerow(['五、复核信息'])
            writer.writerow(['复核意见', clean_val(record.get('review_note'))])
            writer.writerow(['复核人', clean_val(record.get('reviewed_by'))])
            writer.writerow(['复核时间', clean_val(record.get('reviewed_at'))])
            writer.writerow([])
            
            writer.writerow(['六、数据明细（含删除）'])
            writer.writerow(['序号', 'X值', 'Y值', '计算Y', '残差', '旧口径', '来源', '是否删除', '删除人', '删除时间', '修正原因'])
            for it in record.get('items', []) + record.get('deleted_items', []):
                writer.writerow([
                    it.get('item_no'),
                    it.get('x_value'),
                    it.get('y_value'),
                    clean_val(it.get('calculated_y')),
                    clean_val(it.get('residual')),
                    '是' if it.get('is_old_caliber') else '否',
                    clean_val(it.get('old_caliber_source')),
                    '是' if it.get('is_deleted') else '否',
                    clean_val(it.get('deleted_by')),
                    clean_val(it.get('deleted_at')),
                    clean_val(it.get('correction_reason'))
                ])
            writer.writerow([])
            
            writer.writerow(['七、变更轨迹'])
            writer.writerow(['时间', '类型', '字段', '原值', '改后值', '原因', '来源', '下一步找谁', '处理人', '处理时间', '操作人'])
            for t in record.get('change_traces', []):
                writer.writerow([
                    t.get('created_at'),
                    t.get('trace_type'),
                    clean_val(t.get('field_name')),
                    clean_val(t.get('original_value')),
                    clean_val(t.get('corrected_value')),
                    clean_val(t.get('change_reason')),
                    clean_val(t.get('source_ref')),
                    clean_val(t.get('next_handler')),
                    clean_val(t.get('handled_by')),
                    clean_val(t.get('handled_at')),
                    t.get('operator')
                ])
            writer.writerow([])
            
            writer.writerow(['八、参数版本历史'])
            writer.writerow(['版本', '斜率', '截距', 'R²', '变更类型', '说明', '暂停', '暂停说明', '下一步找谁', '操作人', '时间'])
            for pv in record.get('param_versions', []):
                p = pv.get('params') or {}
                writer.writerow([
                    f"v{pv.get('version_no')}",
                    clean_val(p.get('slope')),
                    clean_val(p.get('intercept')),
                    clean_val(p.get('r_squared')),
                    pv.get('change_type'),
                    clean_val(pv.get('change_note')),
                    '是' if pv.get('is_suspended') else '否',
                    clean_val(pv.get('suspension_note')),
                    clean_val(pv.get('next_handler')),
                    pv.get('created_by'),
                    pv.get('created_at')
                ])
            writer.writerow([])
            
            writer.writerow(['九、复核历史'])
            for rv in record.get('reviews', []):
                writer.writerow([
                    rv.get('created_at'),
                    rv.get('review_type'),
                    rv.get('review_result'),
                    clean_val(rv.get('review_note')),
                    clean_val(rv.get('original_claim')),
                    clean_val(rv.get('corrected_value')),
                    clean_val(rv.get('next_step')),
                    clean_val(rv.get('next_handler')),
                    rv.get('reviewed_by')
                ])
            
            return output.getvalue()
        
        return None

class LedgerItem:
    @staticmethod
    def soft_delete(item_id: int, deleted_by: str, 
                    delete_reason: str = '人工识别为异常点') -> int:
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT ledger_id, item_no, x_value, y_value FROM ledger_items WHERE id = ?', 
                  (item_id,))
        row = c.fetchone()
        if not row:
            conn.close()
            return 0
        
        ledger_id = row['ledger_id']
        item_no = row['item_no']
        orig_x = row['x_value']
        orig_y = row['y_value']
        
        c.execute('''
            UPDATE ledger_items 
            SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, 
                deleted_by = ?, delete_reason = ?
            WHERE id = ?
        ''', (deleted_by, delete_reason, item_id))
        
        gap_info = LedgerRecord.check_gap(ledger_id, conn, c)
        
        updates = []
        params_list = []
        
        trace_data = {
            'item_id': item_id,
            'item_no': item_no,
            'original_xy': {'x': orig_x, 'y': orig_y},
            'delete_reason': delete_reason,
            'gap_detected': gap_info['has_gap'],
            'gap_details': gap_info.get('gap_details', [])
        }
        
        if gap_info['has_gap']:
            updates = [
                'has_gap = 1',
                'gap_note = ?',
                'gap_original_claim = ?',
                'gap_corrected_value = ?',
                'gap_reason = ?',
                'gap_next_handler = ?',
                'next_handler = ?',
                'review_status = ?',
                'status = ?',
                'updated_at = CURRENT_TIMESTAMP'
            ]
            gap_note_text = f"检测到编号断档: {gap_info['gaps']}; 缺失编号: {gap_info.get('gap_details', [])}"
            orig_claim = f"原始编号连续序列应有: {list(range(gap_info['min_no'], gap_info['max_no'] + 1))}"
            corrected = f"当前有效编号: {gap_info['item_nos']}, 删除了编号{item_no}的数据(x={orig_x}, y={orig_y})"
            reason_text = f"删除原因: {delete_reason}; 编号{item_no}缺失导致断档"
            next_handler_text = '教研组复核断档'
            params_list = [gap_note_text, orig_claim, corrected, reason_text, 
                          next_handler_text, next_handler_text,
                          'pending_review', 'pending_review', ledger_id]
            
            trace_data['gap_next_handler'] = next_handler_text
            trace_data['original_claim'] = orig_claim
            trace_data['corrected_value'] = corrected
        else:
            updates = ['updated_at = CURRENT_TIMESTAMP']
            params_list = [ledger_id]
        
        c.execute(f'''
            UPDATE ledger_records SET {', '.join(updates)} WHERE id = ?
        ''', params_list)
        
        trace_id = ChangeTrace.create(
            ledger_id=ledger_id,
            item_id=item_id,
            trace_type='item_delete',
            field_name='is_deleted',
            original_value={'status': 'active', 'x': orig_x, 'y': orig_y, 'item_no': item_no},
            corrected_value={'status': 'deleted', 'reason': delete_reason},
            change_reason=delete_reason,
            next_handler='教研组复核断档' if gap_info['has_gap'] else None,
            is_suspended=1 if gap_info['has_gap'] else 0,
            suspension_note=f"编号断档待复核:{gap_info['gaps']}" if gap_info['has_gap'] else None,
            operator=deleted_by,
            conn=conn, c=c
        )
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, change_trace_id, action, 
                                     detail_json, operator)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, trace_id, '软删除数据行',
              json.dumps(trace_data, ensure_ascii=False),
              deleted_by))
        
        conn.commit()
        conn.close()
        return ledger_id
    
    @staticmethod
    def add_old_caliber_item(ledger_id: int, x_value: float, y_value: float,
                            source: str, created_by: str,
                            reason: str = '从旧公式截图补录，用于新旧口径对比') -> int:
        conn = get_conn()
        c = conn.cursor()
        
        c.execute('''
            SELECT COALESCE(MAX(item_no), 0) + 1 as next_no
            FROM ledger_items WHERE ledger_id = ?
        ''', (ledger_id,))
        next_no = c.fetchone()['next_no']
        
        c.execute('''
            SELECT is_old_caliber, old_caliber_note, params_json 
            FROM ledger_records WHERE id = ?
        ''', (ledger_id,))
        old_row = c.fetchone()
        old_params = json.loads(old_row['params_json']) if old_row and old_row['params_json'] else None
        
        c.execute('''
            INSERT INTO ledger_items 
            (ledger_id, item_no, x_value, y_value, original_x, original_y,
             is_old_caliber, old_caliber_source, correction_reason)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
        ''', (ledger_id, next_no, x_value, y_value, x_value, y_value, source, reason))
        
        item_id = c.lastrowid
        
        note_suffix = f"从[{source}]补录旧口径(x={x_value}, y={y_value}),原因:{reason};"
        c.execute('''
            UPDATE ledger_records 
            SET is_old_caliber = 1,
                old_caliber_note = COALESCE(old_caliber_note, '') || ?,
                original_params_json = COALESCE(original_params_json, params_json),
                correction_reason = COALESCE(correction_reason, '') || ?,
                next_handler = '唐老师复核旧口径适用性',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (note_suffix, f"[补录编号{next_no}]来源:{source};", ledger_id))
        
        trace_id = ChangeTrace.create(
            ledger_id=ledger_id,
            item_id=item_id,
            trace_type='old_caliber_add',
            field_name='data_point',
            original_value={'count_before': next_no - 1, 'params_before': old_params},
            corrected_value={'x': x_value, 'y': y_value, 'source': source, 'item_no': next_no},
            change_reason=reason,
            source_ref=source,
            next_handler='唐老师复核旧口径适用性',
            operator=created_by,
            conn=conn, c=c
        )
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, change_trace_id, action, 
                                     detail_json, operator)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, trace_id, '补录旧口径数据',
              json.dumps({'item_id': item_id, 'x': x_value, 'y': y_value,
                         'source': source, 'reason': reason,
                         'original_params': old_params}, ensure_ascii=False),
              created_by))
        
        conn.commit()
        conn.close()
        return item_id
    
    @staticmethod
    def correct_item(item_id: int, new_x: float = None, new_y: float = None,
                    reason: str = '', source: str = '', operator: str = '',
                    next_handler: str = None) -> Dict:
        conn = get_conn()
        c = conn.cursor()
        
        c.execute('''
            SELECT ledger_id, item_no, x_value, y_value, original_x, original_y
            FROM ledger_items WHERE id = ?
        ''', (item_id,))
        row = c.fetchone()
        if not row:
            conn.close()
            return {'error': '数据行不存在'}
        
        ledger_id = row['ledger_id']
        item_no = row['item_no']
        old_x = row['x_value']
        old_y = row['y_value']
        
        update_fields = []
        update_params = []
        orig_val = {}
        corr_val = {}
        
        if new_x is not None and new_x != old_x:
            update_fields.append('x_value = ?')
            update_params.append(new_x)
            orig_val['x'] = old_x
            corr_val['x'] = new_x
        
        if new_y is not None and new_y != old_y:
            update_fields.append('y_value = ?')
            update_params.append(new_y)
            orig_val['y'] = old_y
            corr_val['y'] = new_y
        
        if not update_fields:
            conn.close()
            return {'error': '值未变化，无需修正'}
        
        if reason:
            update_fields.append('correction_reason = ?')
            update_params.append(reason)
        
        update_params.append(item_id)
        
        c.execute(f'''
            UPDATE ledger_items SET {', '.join(update_fields)} WHERE id = ?
        ''', update_params)
        
        trace_id = ChangeTrace.create(
            ledger_id=ledger_id,
            item_id=item_id,
            trace_type='item_correct',
            field_name='x_value' if new_x is not None else 'y_value',
            original_value=orig_val,
            corrected_value=corr_val,
            change_reason=reason or '人工修正数据',
            source_ref=source,
            next_handler=next_handler,
            operator=operator,
            conn=conn, c=c
        )
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, change_trace_id, action, 
                                     detail_json, operator)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, trace_id, f'修正编号{item_no}数据',
              json.dumps({'original': orig_val, 'corrected': corr_val,
                         'reason': reason, 'source': source}, ensure_ascii=False),
              operator))
        
        conn.commit()
        conn.close()
        return {'ledger_id': ledger_id, 'trace_id': trace_id, 'status': 'success'}

class ParamVersion:
    @staticmethod
    def create(ledger_id: int, params: Dict, change_type: str, 
               change_note: str, created_by: str,
               weight_table_id: int = None, 
               formula_screenshot_id: int = None,
               is_suspended: int = 0,
               suspension_note: str = None,
               original_params: Dict = None,
               correction_reason: str = None,
               next_handler: str = None,
               conn=None, c=None) -> int:
        external_conn = conn is not None
        if not external_conn:
            conn = get_conn()
            c = conn.cursor()
        
        c.execute('''
            SELECT COALESCE(MAX(version_no), 0) + 1 as next_version,
                   params_json as old_params
            FROM param_versions WHERE ledger_id = ?
        ''', (ledger_id,))
        row = c.fetchone()
        next_version = row['next_version']
        old_params = json.loads(row['old_params']) if row and row['old_params'] else None
        
        orig_params_json = json.dumps(original_params, ensure_ascii=False) if original_params else None
        
        c.execute('''
            INSERT INTO param_versions 
            (ledger_id, version_no, params_json, weight_table_id, 
             formula_screenshot_id, change_type, change_note, created_by,
             is_suspended, suspension_note, original_params_json,
             correction_reason, next_handler)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (ledger_id, next_version, json.dumps(params, ensure_ascii=False),
              weight_table_id, formula_screenshot_id, 
              change_type, change_note, created_by,
              is_suspended, suspension_note, orig_params_json,
              correction_reason, next_handler))
        
        pv_id = c.lastrowid
        
        if not is_suspended:
            c.execute('''
                UPDATE ledger_records 
                SET params_json = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (json.dumps(params, ensure_ascii=False), ledger_id))
        
        detail = {
            'change_type': change_type, 
            'change_note': change_note,
            'params': params
        }
        if original_params:
            detail['original_params'] = original_params
        if correction_reason:
            detail['correction_reason'] = correction_reason
        if old_params:
            detail['diff'] = {k: {'old': old_params.get(k), 'new': params.get(k)} 
                             for k in set(list(old_params.keys()) + list(params.keys()))
                             if old_params.get(k) != params.get(k)}
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, param_version_id, action, 
                                     detail_json, operator)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, pv_id, f'参数版本更新:v{next_version}',
              json.dumps(detail, ensure_ascii=False),
              created_by))
        
        if not external_conn:
            conn.commit()
            conn.close()
        return pv_id
    
    @staticmethod
    def list_by_ledger(ledger_id: int) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            SELECT pv.*, wt.name as weight_table_name, wt.version as weight_version,
                   fs.description as screenshot_desc
            FROM param_versions pv
            LEFT JOIN weight_tables wt ON pv.weight_table_id = wt.id
            LEFT JOIN formula_screenshots fs ON pv.formula_screenshot_id = fs.id
            WHERE pv.ledger_id = ?
            ORDER BY pv.version_no
        ''', (ledger_id,))
        rows = c.fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            d['params'] = json.loads(d['params_json'])
            if d.get('original_params_json'):
                d['original_params'] = json.loads(d['original_params_json'])
            result.append(d)
        return result

class HistoryLog:
    @staticmethod
    def list_by_ledger(ledger_id: int) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            SELECT hl.*, pv.version_no as param_version_no,
                   ct.trace_type as change_trace_type,
                   ct.original_value as ct_original,
                   ct.corrected_value as ct_corrected,
                   ct.change_reason as ct_reason,
                   ct.next_handler as ct_next_handler
            FROM history_logs hl
            LEFT JOIN param_versions pv ON hl.param_version_id = pv.id
            LEFT JOIN change_traces ct ON hl.change_trace_id = ct.id
            WHERE hl.ledger_id = ?
            ORDER BY hl.created_at DESC
        ''', (ledger_id,))
        rows = c.fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('detail_json'):
                try:
                    d['detail'] = json.loads(d['detail_json'])
                except:
                    d['detail'] = d['detail_json']
            if d.get('ct_original'):
                try:
                    d['ct_original'] = json.loads(d['ct_original'])
                except:
                    pass
            if d.get('ct_corrected'):
                try:
                    d['ct_corrected'] = json.loads(d['ct_corrected'])
                except:
                    pass
            result.append(d)
        return result
    
    @staticmethod
    def create(ledger_id: int, action: str, detail: Dict, operator: str,
               param_version_id: int = None, change_trace_id: int = None) -> int:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            INSERT INTO history_logs 
            (ledger_id, param_version_id, change_trace_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (ledger_id, param_version_id, change_trace_id, action,
              json.dumps(detail, ensure_ascii=False), operator))
        new_id = c.lastrowid
        conn.commit()
        conn.close()
        return new_id

class ReviewRecord:
    @staticmethod
    def create(ledger_id: int, review_type: str, review_result: str,
               review_note: str, reviewed_by: str,
               original_claim: str = None, corrected_value: str = None,
               next_step: str = None, next_handler: str = None) -> int:
        conn = get_conn()
        c = conn.cursor()
        
        c.execute('''
            INSERT INTO review_records 
            (ledger_id, review_type, review_result, review_note, 
             original_claim, corrected_value, next_step, next_handler, reviewed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (ledger_id, review_type, review_result, review_note,
              original_claim, corrected_value, next_step, next_handler, reviewed_by))
        
        new_id = c.lastrowid
        
        if review_type == 'gap_review':
            if review_result == 'approve':
                c.execute('''
                    UPDATE ledger_records
                    SET review_status = 'reviewed',
                        gap_note = COALESCE(gap_note, '') || ' [已复核通过]',
                        review_note = ?,
                        gap_original_claim = COALESCE(gap_original_claim, ?),
                        gap_corrected_value = COALESCE(gap_corrected_value, ?),
                        gap_reason = COALESCE(gap_reason, ?),
                        gap_next_handler = ?,
                        reviewed_by = ?,
                        reviewed_at = CURRENT_TIMESTAMP,
                        status = 'ready',
                        next_handler = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (review_note, original_claim, corrected_value, 
                      review_note, next_handler, reviewed_by, 
                      next_handler, ledger_id))
            else:
                c.execute('''
                    UPDATE ledger_records
                    SET review_status = 'rejected',
                        review_note = ?,
                        gap_original_claim = COALESCE(gap_original_claim, ?),
                        gap_corrected_value = COALESCE(gap_corrected_value, ?),
                        gap_reason = COALESCE(gap_reason, ?),
                        reviewed_by = ?,
                        reviewed_at = CURRENT_TIMESTAMP,
                        status = 'rejected',
                        next_handler = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (review_note, original_claim, corrected_value,
                      review_note, reviewed_by, next_handler or '补充数据后重新提交', 
                      ledger_id))
        
        trace_detail = {
            'review_note': review_note, 
            'review_result': review_result,
            'original_claim': original_claim,
            'corrected_value': corrected_value,
            'next_step': next_step,
            'next_handler': next_handler
        }
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, f'复核[{review_type}]:{review_result}',
              json.dumps(trace_detail, ensure_ascii=False),
              reviewed_by))
        
        conn.commit()
        conn.close()
        return new_id

def calculate_least_squares(items: List[Dict], weights: Dict = None) -> Dict:
    valid_items = [it for it in items if not it.get('is_deleted', 0)]
    
    if weights is None:
        weights = {'x': 1.0, 'y': 1.0, 'intercept': 1.0}
    
    n = len(valid_items)
    if n < 2:
        return {'error': '数据点不足2个'}
    
    sum_x = sum(it['x_value'] for it in valid_items)
    sum_y = sum(it['y_value'] for it in valid_items)
    sum_xy = sum(it['x_value'] * it['y_value'] for it in valid_items)
    sum_x2 = sum(it['x_value'] ** 2 for it in valid_items)
    
    w_x = weights.get('x', 1.0)
    w_y = weights.get('y', 1.0)
    w_intercept = weights.get('intercept', 1.0)
    
    denominator = n * sum_x2 - sum_x * sum_x
    if abs(denominator) < 1e-10:
        return {'error': '分母趋近于0，无法计算'}
    
    slope = (n * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / n
    
    slope *= w_x
    intercept *= w_intercept
    
    for it in valid_items:
        it['calculated_y'] = slope * it['x_value'] + intercept
        it['residual'] = it['y_value'] - it['calculated_y']
    
    ss_res = sum(it['residual'] ** 2 for it in valid_items)
    ss_tot = sum((it['y_value'] - sum_y / n) ** 2 for it in valid_items)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    
    return {
        'slope': round(slope, 6),
        'intercept': round(intercept, 6),
        'r_squared': round(r_squared, 6),
        'n': n,
        'weights_used': weights,
        'items': valid_items
    }

def run_calculation(ledger_id: int, operator: str, 
                    force: bool = False) -> Dict:
    conn = get_conn()
    c = conn.cursor()
    
    c.execute('SELECT * FROM ledger_records WHERE id = ?', (ledger_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return {'error': '台账记录不存在'}
    
    record = dict(row)
    conn.close()
    
    if not force and record.get('status') == 'suspended':
        return {
            'error': '记录暂停中，不能直接计算',
            'reason': record.get('suspension_note') or '记录处于暂停状态',
            'next_handler': record.get('next_handler'),
            'suspended': True
        }
    
    full_record = LedgerRecord.get(ledger_id)
    if not full_record:
        return {'error': '台账记录不存在'}
    
    is_review_pending = (not force) and (full_record.get('review_status') == 'pending_review')
    
    wt_id = full_record.get('weight_table_id')
    weights = None
    if wt_id:
        wt = WeightTable.get(wt_id)
        if wt:
            weights = wt['data']
    
    old_params = full_record.get('params')
    
    result = calculate_least_squares(full_record['items'], weights)
    if 'error' in result:
        return result
    
    conn = get_conn()
    c = conn.cursor()
    
    for it in result['items']:
        c.execute('''
            UPDATE ledger_items
            SET calculated_y = ?, residual = ?
            WHERE id = ?
        ''', (it['calculated_y'], it['residual'], it['id']))
    
    params = {
        'slope': result['slope'],
        'intercept': result['intercept'],
        'r_squared': result['r_squared']
    }
    
    param_diff = None
    if old_params:
        param_diff = {}
        for k in ['slope', 'intercept', 'r_squared']:
            if old_params.get(k) != params.get(k):
                param_diff[k] = {'old': old_params.get(k), 'new': params.get(k)}
    
    change_note = f"重跑计算,n={result['n']},R²={result['r_squared']}"
    is_suspended_pv = 0
    suspension_note_pv = None
    next_handler_pv = None
    correction_reason_pv = None
    
    if (full_record.get('has_gap') and not full_record.get('review_status') == 'reviewed') or is_review_pending:
        is_suspended_pv = 1
        suspension_note_pv = '含断档数据，待教研组复核确认后生效'
        next_handler_pv = full_record.get('gap_next_handler') or '教研组复核断档'
        change_note += " [含断档数据-待复核]"
    elif full_record.get('has_gap'):
        change_note += " [含断档数据-已复核]"
    
    if full_record.get('is_old_caliber'):
        change_note += " [含旧口径数据]"
        if not full_record.get('review_status') == 'reviewed':
            next_handler_pv = next_handler_pv or '唐老师复核旧口径适用性'
    
    if param_diff:
        correction_reason_pv = f"参数变化:{json.dumps(param_diff, ensure_ascii=False)}"
    
    pv_id = ParamVersion.create(
        ledger_id=ledger_id,
        params=params,
        change_type='rerun',
        change_note=change_note,
        created_by=operator,
        weight_table_id=wt_id,
        formula_screenshot_id=full_record.get('formula_screenshot_id'),
        is_suspended=is_suspended_pv,
        suspension_note=suspension_note_pv,
        original_params=old_params,
        correction_reason=correction_reason_pv,
        next_handler=next_handler_pv,
        conn=conn, c=c
    )
    
    final_status = 'completed'
    if is_suspended_pv:
        final_status = full_record.get('status') or 'pending_review'
    
    c.execute('''
        UPDATE ledger_records
        SET result_json = ?, status = ?, 
            original_params_json = COALESCE(original_params_json, params_json),
            corrected_params_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (json.dumps(params, ensure_ascii=False), final_status,
          json.dumps(params, ensure_ascii=False), ledger_id))
    
    c.execute('''
        INSERT INTO history_logs (ledger_id, param_version_id, action, 
                                 detail_json, operator)
        VALUES (?, ?, ?, ?, ?)
    ''', (ledger_id, pv_id, '完成计算',
          json.dumps({'params': params, 'weights': weights,
                     'param_diff': param_diff,
                     'has_gap': full_record.get('has_gap'),
                     'is_old_caliber': full_record.get('is_old_caliber')}, 
                   ensure_ascii=False),
          operator))
    
    conn.commit()
    conn.close()
    
    return {
        'ledger_id': ledger_id,
        'params': params,
        'param_version_id': pv_id,
        'has_gap': full_record.get('has_gap', 0),
        'is_old_caliber': full_record.get('is_old_caliber', 0),
        'status': final_status,
        'param_diff': param_diff,
        'is_suspended': is_suspended_pv,
        'next_handler': next_handler_pv
    }

init_db()
