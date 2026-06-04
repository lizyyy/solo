import sqlite3
import json
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
        is_old_caliber INTEGER DEFAULT 0,
        old_caliber_note TEXT,
        review_status TEXT DEFAULT 'pending',
        review_note TEXT,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
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
        calculated_y REAL,
        residual REAL,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TIMESTAMP,
        deleted_by TEXT,
        is_old_caliber INTEGER DEFAULT 0,
        old_caliber_source TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledger_records(id)
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
        action TEXT NOT NULL,
        detail_json TEXT,
        operator TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledger_records(id),
        FOREIGN KEY (param_version_id) REFERENCES param_versions(id)
    )
    ''')
    
    c.execute('''
    CREATE TABLE IF NOT EXISTS review_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger_id INTEGER NOT NULL,
        review_type TEXT NOT NULL,
        review_result TEXT NOT NULL,
        review_note TEXT,
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
                INSERT INTO ledger_items (ledger_id, item_no, x_value, y_value)
                VALUES (?, ?, ?, ?)
            ''', (ledger_id, idx, item['x'], item['y']))
        
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
            ORDER BY lr.created_at DESC
        ''')
        rows = c.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    
    @staticmethod
    def update_status(ledger_id: int, status: str, operator: str) -> None:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            UPDATE ledger_records 
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (status, ledger_id))
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, f'状态变更为:{status}', 
              json.dumps({'old_status': '', 'new_status': status}, ensure_ascii=False),
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
            SELECT item_no FROM ledger_items 
            WHERE ledger_id = ? AND is_deleted = 0
            ORDER BY item_no
        ''', (ledger_id,))
        rows = c.fetchall()
        
        if not external_conn:
            conn.close()
        
        nos = [r['item_no'] for r in rows]
        gaps = []
        if len(nos) > 1:
            for i in range(len(nos) - 1):
                if nos[i + 1] - nos[i] > 1:
                    gaps.append((nos[i], nos[i + 1]))
        
        return {'has_gap': len(gaps) > 0, 'gaps': gaps, 'item_nos': nos}

class LedgerItem:
    @staticmethod
    def soft_delete(item_id: int, deleted_by: str) -> int:
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT ledger_id, item_no FROM ledger_items WHERE id = ?', (item_id,))
        row = c.fetchone()
        if not row:
            conn.close()
            return 0
        
        ledger_id = row['ledger_id']
        item_no = row['item_no']
        
        c.execute('''
            UPDATE ledger_items 
            SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
            WHERE id = ?
        ''', (deleted_by, item_id))
        
        gap_info = LedgerRecord.check_gap(ledger_id, conn, c)
        if gap_info['has_gap']:
            c.execute('''
                UPDATE ledger_records 
                SET has_gap = 1, 
                    gap_note = ?,
                    review_status = 'pending_review',
                    status = 'pending_review',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (f"检测到编号断档: {gap_info['gaps']}", ledger_id))
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, '软删除数据行', 
              json.dumps({'item_id': item_id, 'item_no': item_no, 
                         'has_gap': gap_info['has_gap']}, ensure_ascii=False),
              deleted_by))
        
        conn.commit()
        conn.close()
        return ledger_id
    
    @staticmethod
    def add_old_caliber_item(ledger_id: int, x_value: float, y_value: float,
                            source: str, created_by: str) -> int:
        conn = get_conn()
        c = conn.cursor()
        
        c.execute('''
            SELECT COALESCE(MAX(item_no), 0) + 1 as next_no
            FROM ledger_items WHERE ledger_id = ?
        ''', (ledger_id,))
        next_no = c.fetchone()['next_no']
        
        c.execute('''
            INSERT INTO ledger_items 
            (ledger_id, item_no, x_value, y_value, is_old_caliber, old_caliber_source)
            VALUES (?, ?, ?, ?, 1, ?)
        ''', (ledger_id, next_no, x_value, y_value, source))
        
        item_id = c.lastrowid
        
        c.execute('''
            UPDATE ledger_records 
            SET is_old_caliber = 1,
                old_caliber_note = COALESCE(old_caliber_note, '') || ? || ';',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (f"从[{source}]补录旧口径数据(x={x_value}, y={y_value})", ledger_id))
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, '补录旧口径数据', 
              json.dumps({'item_id': item_id, 'x': x_value, 'y': y_value,
                         'source': source}, ensure_ascii=False),
              created_by))
        
        conn.commit()
        conn.close()
        return item_id

class ParamVersion:
    @staticmethod
    def create(ledger_id: int, params: Dict, change_type: str, 
               change_note: str, created_by: str,
               weight_table_id: int = None, 
               formula_screenshot_id: int = None,
               conn=None, c=None) -> int:
        external_conn = conn is not None
        if not external_conn:
            conn = get_conn()
            c = conn.cursor()
        
        c.execute('''
            SELECT COALESCE(MAX(version_no), 0) + 1 as next_version
            FROM param_versions WHERE ledger_id = ?
        ''', (ledger_id,))
        next_version = c.fetchone()['next_version']
        
        c.execute('''
            INSERT INTO param_versions 
            (ledger_id, version_no, params_json, weight_table_id, 
             formula_screenshot_id, change_type, change_note, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (ledger_id, next_version, json.dumps(params, ensure_ascii=False),
              weight_table_id, formula_screenshot_id, 
              change_type, change_note, created_by))
        
        pv_id = c.lastrowid
        
        c.execute('''
            UPDATE ledger_records 
            SET params_json = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (json.dumps(params, ensure_ascii=False), ledger_id))
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, param_version_id, action, 
                                     detail_json, operator)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, pv_id, f'参数版本更新:v{next_version}',
              json.dumps({'change_type': change_type, 'change_note': change_note,
                         'params': params}, ensure_ascii=False),
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
            result.append(d)
        return result

class HistoryLog:
    @staticmethod
    def list_by_ledger(ledger_id: int) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            SELECT hl.*, pv.version_no as param_version_no
            FROM history_logs hl
            LEFT JOIN param_versions pv ON hl.param_version_id = pv.id
            WHERE hl.ledger_id = ?
            ORDER BY hl.created_at DESC
        ''', (ledger_id,))
        rows = c.fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('detail_json'):
                d['detail'] = json.loads(d['detail_json'])
            result.append(d)
        return result
    
    @staticmethod
    def create(ledger_id: int, action: str, detail: Dict, operator: str,
               param_version_id: int = None) -> int:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            INSERT INTO history_logs 
            (ledger_id, param_version_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, param_version_id, action,
              json.dumps(detail, ensure_ascii=False), operator))
        new_id = c.lastrowid
        conn.commit()
        conn.close()
        return new_id

class ReviewRecord:
    @staticmethod
    def create(ledger_id: int, review_type: str, review_result: str,
               review_note: str, reviewed_by: str) -> int:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            INSERT INTO review_records 
            (ledger_id, review_type, review_result, review_note, reviewed_by)
            VALUES (?, ?, ?, ?, ?)
        ''', (ledger_id, review_type, review_result, review_note, reviewed_by))
        
        new_id = c.lastrowid
        
        if review_type == 'gap_review':
            if review_result == 'approve':
                c.execute('''
                    UPDATE ledger_records
                    SET review_status = 'reviewed',
                        has_gap = 0,
                        gap_note = gap_note || ' [已复核通过]',
                        reviewed_by = ?,
                        reviewed_at = CURRENT_TIMESTAMP,
                        status = 'ready',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (reviewed_by, ledger_id))
            else:
                c.execute('''
                    UPDATE ledger_records
                    SET review_status = 'rejected',
                        review_note = ?,
                        reviewed_by = ?,
                        reviewed_at = CURRENT_TIMESTAMP,
                        status = 'rejected',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (review_note, reviewed_by, ledger_id))
        
        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, f'复核[{review_type}]:{review_result}',
              json.dumps({'review_note': review_note, 
                         'review_result': review_result}, ensure_ascii=False),
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

def run_calculation(ledger_id: int, operator: str) -> Dict:
    record = LedgerRecord.get(ledger_id)
    if not record:
        return {'error': '台账记录不存在'}
    
    wt_id = record.get('weight_table_id')
    weights = None
    if wt_id:
        wt = WeightTable.get(wt_id)
        if wt:
            weights = wt['data']
    
    result = calculate_least_squares(record['items'], weights)
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
    
    change_note = f"重跑计算,n={result['n']},R²={result['r_squared']}"
    if record.get('has_gap'):
        change_note += " [含断档数据]"
    if record.get('is_old_caliber'):
        change_note += " [含旧口径数据]"
    
    pv_id = ParamVersion.create(
        ledger_id=ledger_id,
        params=params,
        change_type='rerun',
        change_note=change_note,
        created_by=operator,
        weight_table_id=wt_id,
        formula_screenshot_id=record.get('formula_screenshot_id'),
        conn=conn,
        c=c
    )
    
    c.execute('''
        UPDATE ledger_records
        SET result_json = ?, status = 'completed', 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (json.dumps(params, ensure_ascii=False), ledger_id))
    
    c.execute('''
        INSERT INTO history_logs (ledger_id, param_version_id, action, 
                                 detail_json, operator)
        VALUES (?, ?, ?, ?, ?)
    ''', (ledger_id, pv_id, '完成计算',
          json.dumps({'params': params, 'weights': weights}, ensure_ascii=False),
          operator))
    
    conn.commit()
    conn.close()
    
    return {
        'ledger_id': ledger_id,
        'params': params,
        'param_version_id': pv_id,
        'has_gap': record.get('has_gap', 0),
        'is_old_caliber': record.get('is_old_caliber', 0),
        'status': 'completed'
    }

init_db()
