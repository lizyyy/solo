import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any

DB_PATH = 'ledger.db'

WORKFLOW_NORMAL = 'normal'
WORKFLOW_PAUSED = 'paused'
WORKFLOW_RESUMED = 'resumed'

STATUS_MAP = {
    'pending': '待处理',
    'completed': '已完成',
    'pending_review': '待复核（暂停）',
    'rejected': '已驳回',
    'ready': '已就绪（续局后）'
}

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
        workflow_state TEXT NOT NULL DEFAULT 'normal',
        pause_reason TEXT,
        pause_trigger TEXT,
        resume_reason TEXT,
        resumed_by TEXT,
        resumed_at TIMESTAMP,
        weight_table_id INTEGER,
        formula_screenshot_id INTEGER,
        params_json TEXT,
        result_json TEXT,
        has_gap INTEGER DEFAULT 0,
        gap_note TEXT,
        gap_positions TEXT,
        is_old_caliber INTEGER DEFAULT 0,
        old_caliber_note TEXT,
        review_status TEXT DEFAULT 'pending',
        review_note TEXT,
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        next_owner TEXT,
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
        delete_reason TEXT,
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
        workflow_snapshot TEXT,
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
        original_state_json TEXT,
        modified_state_json TEXT,
        reason TEXT,
        deleted_items_json TEXT,
        gap_detail_json TEXT,
        next_owner TEXT,
        reviewed_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ledger_id) REFERENCES ledger_records(id)
    )
    ''')

    conn.commit()
    conn.close()

def _snapshot_ledger_state(ledger_id: int, conn, c) -> Dict:
    c.execute('SELECT * FROM ledger_records WHERE id = ?', (ledger_id,))
    lr = dict(c.fetchone())
    c.execute('SELECT * FROM ledger_items WHERE ledger_id = ? ORDER BY item_no', (ledger_id,))
    items = [dict(it) for it in c.fetchall()]
    return {
        'ledger': {k: v for k, v in lr.items() if k not in ('params_json', 'result_json', 'gap_positions')},
        'items': items,
        'params': json.loads(lr.get('params_json') or '{}') if lr.get('params_json') else None,
        'has_gap': lr.get('has_gap', 0),
        'is_old_caliber': lr.get('is_old_caliber', 0)
    }

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
        c.execute('SELECT * FROM formula_screenshots WHERE ledger_id = ? ORDER BY created_at', (ledger_id,))
        rows = c.fetchall()
        conn.close()
        return [dict(r) for r in rows]

class LedgerRecord:
    @staticmethod
    def create(serial_no: str, title: str, weight_table_id: int,
               items: List[Dict], created_by: str) -> int:
        conn = get_conn()
        c = conn.cursor()
        c.execute('''
            INSERT INTO ledger_records (serial_no, title, weight_table_id, 
                                       workflow_state, created_by)
            VALUES (?, ?, ?, 'normal', ?)
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
        if record.get('gap_positions'):
            record['gap_list'] = json.loads(record['gap_positions'])

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
            SELECT rr.* FROM review_records rr
            WHERE rr.ledger_id = ?
            ORDER BY rr.created_at DESC
        ''', (ledger_id,))
        reviews = c.fetchall()
        record['reviews'] = []
        for rv in reviews:
            rd = dict(rv)
            if rd.get('original_state_json'):
                rd['original_state'] = json.loads(rd['original_state_json'])
            if rd.get('modified_state_json'):
                rd['modified_state'] = json.loads(rd['modified_state_json'])
            if rd.get('deleted_items_json'):
                rd['deleted_items_detail'] = json.loads(rd['deleted_items_json'])
            if rd.get('gap_detail_json'):
                rd['gap_detail'] = json.loads(rd['gap_detail_json'])
            record['reviews'].append(rd)

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
                    gaps.append({'from': nos[i], 'to': nos[i + 1],
                                'missing': list(range(nos[i] + 1, nos[i + 1]))})

        return {'has_gap': len(gaps) > 0, 'gaps': gaps, 'item_nos': nos}

    @staticmethod
    def set_paused(ledger_id: int, pause_reason: str, pause_trigger: str,
                   next_owner: str, operator: str,
                   deleted_items: List[Dict] = None, gap_detail: Dict = None,
                   conn=None, c=None) -> None:
        external_conn = conn is not None
        if not external_conn:
            conn = get_conn()
            c = conn.cursor()

        original_state = _snapshot_ledger_state(ledger_id, conn, c)

        gap_json = json.dumps(gap_detail.get('gaps', []), ensure_ascii=False) if gap_detail else None

        c.execute('''
            UPDATE ledger_records
            SET workflow_state = 'paused',
                pause_reason = ?,
                pause_trigger = ?,
                status = 'pending_review',
                review_status = 'pending_review',
                has_gap = CASE WHEN ? > 0 THEN 1 ELSE has_gap END,
                gap_note = CASE WHEN ? IS NOT NULL THEN ? ELSE gap_note END,
                gap_positions = CASE WHEN ? IS NOT NULL THEN ? ELSE gap_positions END,
                next_owner = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (pause_reason, pause_trigger,
              1 if gap_detail and gap_detail.get('has_gap') else 0,
              pause_reason, pause_reason,
              gap_json, gap_json,
              next_owner, ledger_id))

        detail = {
            'pause_reason': pause_reason,
            'pause_trigger': pause_trigger,
            'next_owner': next_owner,
            'original_state': original_state
        }
        if deleted_items:
            detail['deleted_items'] = deleted_items
        if gap_detail:
            detail['gap_detail'] = gap_detail

        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, '工作流：进入暂停（待复核）',
              json.dumps(detail, ensure_ascii=False), operator))

        if not external_conn:
            conn.commit()
            conn.close()

    @staticmethod
    def set_resumed(ledger_id: int, resume_reason: str, operator: str,
                    conn=None, c=None) -> None:
        external_conn = conn is not None
        if not external_conn:
            conn = get_conn()
            c = conn.cursor()

        c.execute('''
            UPDATE ledger_records
            SET workflow_state = 'resumed',
                resume_reason = ?,
                resumed_by = ?,
                resumed_at = CURRENT_TIMESTAMP,
                status = 'ready',
                review_status = 'reviewed',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (resume_reason, operator, ledger_id))

        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, '工作流：续局完成（复核通过）',
              json.dumps({'resume_reason': resume_reason}, ensure_ascii=False),
              operator))

        if not external_conn:
            conn.commit()
            conn.close()

class LedgerItem:
    @staticmethod
    def soft_delete(item_id: int, deleted_by: str, delete_reason: str = '') -> Dict:
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT * FROM ledger_items WHERE id = ?', (item_id,))
        row = c.fetchone()
        if not row:
            conn.close()
            return {'error': '数据行不存在'}

        ledger_id = row['ledger_id']
        item_no = row['item_no']
        deleted_item_detail = dict(row)

        c.execute('''
            UPDATE ledger_items
            SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP,
                deleted_by = ?, delete_reason = ?
            WHERE id = ?
        ''', (deleted_by, delete_reason or '人工删除', item_id))

        gap_info = LedgerRecord.check_gap(ledger_id, conn, c)
        deleted_items = [deleted_item_detail]

        if gap_info['has_gap']:
            c.execute('''
                SELECT * FROM ledger_items WHERE ledger_id = ? AND is_deleted = 1
            ''', (ledger_id,))
            deleted_items = [dict(r) for r in c.fetchall()]

            pause_reason = (f"检测到编号断档：{[(g['from'], g['to']) for g in gap_info['gaps']]}。"
                          f"原编号{item_no}被删除后，编号不连续，需教研组复核。")

            LedgerRecord.set_paused(
                ledger_id=ledger_id,
                pause_reason=pause_reason,
                pause_trigger=f'人工删除行#{item_no}，触发断档',
                next_owner='教研组长',
                operator=deleted_by,
                deleted_items=deleted_items,
                gap_detail=gap_info,
                conn=conn,
                c=c
            )
        else:
            c.execute('''
                INSERT INTO history_logs (ledger_id, action, detail_json, operator)
                VALUES (?, ?, ?, ?)
            ''', (ledger_id, '软删除数据行（未触发断档）',
                  json.dumps({'item_id': item_id, 'item_no': item_no,
                             'delete_reason': delete_reason,
                             'has_gap': False}, ensure_ascii=False),
                  deleted_by))

        conn.commit()
        conn.close()
        return {'ledger_id': ledger_id, 'has_gap': gap_info['has_gap']}

    @staticmethod
    def add_old_caliber_item(ledger_id: int, x_value: float, y_value: float,
                            source: str, created_by: str) -> Dict:
        conn = get_conn()
        c = conn.cursor()

        c.execute('''
            SELECT COALESCE(MAX(item_no), 0) + 1 as next_no
            FROM ledger_items WHERE ledger_id = ?
        ''', (ledger_id,))
        next_no = c.fetchone()['next_no']

        original_state = _snapshot_ledger_state(ledger_id, conn, c)

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
        ''', (f"从[{source}]补录旧口径数据(x={x_value}, y={y_value}); ", ledger_id))

        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, '补录旧口径数据',
              json.dumps({'item_id': item_id, 'x': x_value, 'y': y_value,
                         'source': source,
                         'before_state': original_state}, ensure_ascii=False),
              created_by))

        conn.commit()
        conn.close()
        return {'item_id': item_id, 'ledger_id': ledger_id}

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

        c.execute('SELECT status, workflow_state, has_gap, is_old_caliber FROM ledger_records WHERE id = ?', (ledger_id,))
        wf = dict(c.fetchone())
        workflow_snapshot = json.dumps(wf, ensure_ascii=False)

        c.execute('''
            INSERT INTO param_versions
            (ledger_id, version_no, params_json, weight_table_id,
             formula_screenshot_id, change_type, change_note, 
             workflow_snapshot, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (ledger_id, next_version, json.dumps(params, ensure_ascii=False),
              weight_table_id, formula_screenshot_id,
              change_type, change_note, workflow_snapshot, created_by))

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
                         'params': params, 'workflow_snapshot': wf},
                        ensure_ascii=False),
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
            if d.get('workflow_snapshot'):
                d['workflow'] = json.loads(d['workflow_snapshot'])
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
                try:
                    d['detail'] = json.loads(d['detail_json'])
                except Exception:
                    d['detail'] = d['detail_json']
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
               review_note: str, reviewed_by: str,
               reason: str = '', next_owner: str = '') -> int:
        conn = get_conn()
        c = conn.cursor()

        c.execute('SELECT * FROM ledger_records WHERE id = ?', (ledger_id,))
        lr = dict(c.fetchone())
        original_state = _snapshot_ledger_state(ledger_id, conn, c)

        c.execute('SELECT * FROM ledger_items WHERE ledger_id = ? AND is_deleted = 1', (ledger_id,))
        deleted_items = [dict(r) for r in c.fetchall()]

        gap_detail = LedgerRecord.check_gap(ledger_id, conn, c)

        c.execute('''
            INSERT INTO review_records
            (ledger_id, review_type, review_result, review_note,
             original_state_json, modified_state_json, reason,
             deleted_items_json, gap_detail_json, next_owner, reviewed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (ledger_id, review_type, review_result, review_note,
              json.dumps(original_state, ensure_ascii=False),
              json.dumps(original_state, ensure_ascii=False),
              reason or review_note,
              json.dumps(deleted_items, ensure_ascii=False),
              json.dumps(gap_detail, ensure_ascii=False),
              next_owner, reviewed_by))

        new_id = c.lastrowid

        if review_type == 'gap_review':
            if review_result == 'approve':
                c.execute('''
                    UPDATE ledger_records
                    SET review_status = 'reviewed',
                        review_note = ?,
                        reviewed_by = ?,
                        reviewed_at = CURRENT_TIMESTAMP,
                        next_owner = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (review_note, reviewed_by, next_owner or '唐老师（续局处理）', ledger_id))

                LedgerRecord.set_resumed(
                    ledger_id=ledger_id,
                    resume_reason=(f"教研组复核通过：{review_note}。"
                                 f"编号断档已确认合理，可以续局继续计算。"),
                    operator=reviewed_by,
                    conn=conn,
                    c=c
                )
            else:
                c.execute('''
                    UPDATE ledger_records
                    SET review_status = 'rejected',
                        review_note = ?,
                        reviewed_by = ?,
                        reviewed_at = CURRENT_TIMESTAMP,
                        next_owner = ?,
                        status = 'rejected',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                ''', (review_note, reviewed_by, next_owner or '数据录入员（补数据）', ledger_id))

                c.execute('''
                    INSERT INTO history_logs (ledger_id, action, detail_json, operator)
                    VALUES (?, ?, ?, ?)
                ''', (ledger_id, '工作流：复核驳回（需返工）',
                      json.dumps({'review_note': review_note,
                                 'reason': reason,
                                 'next_owner': next_owner}, ensure_ascii=False),
                      reviewed_by))

        c.execute('''
            INSERT INTO history_logs (ledger_id, action, detail_json, operator)
            VALUES (?, ?, ?, ?)
        ''', (ledger_id, f'教研组复核[{review_type}]:{review_result}',
              json.dumps({'review_note': review_note,
                         'review_result': review_result,
                         'reason': reason,
                         'next_owner': next_owner,
                         'deleted_items_count': len(deleted_items),
                         'gap_detail': gap_detail}, ensure_ascii=False),
              reviewed_by))

        conn.commit()
        conn.close()
        return new_id

    @staticmethod
    def list_by_ledger(ledger_id: int) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute('SELECT * FROM review_records WHERE ledger_id = ? ORDER BY created_at DESC', (ledger_id,))
        rows = c.fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('original_state_json'):
                d['original_state'] = json.loads(d['original_state_json'])
            if d.get('modified_state_json'):
                d['modified_state'] = json.loads(d['modified_state_json'])
            if d.get('deleted_items_json'):
                d['deleted_items_detail'] = json.loads(d['deleted_items_json'])
            if d.get('gap_detail_json'):
                d['gap_detail'] = json.loads(d['gap_detail_json'])
            result.append(d)
        return result

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
    conn = get_conn()
    c = conn.cursor()
    c.execute('SELECT * FROM ledger_records WHERE id = ?', (ledger_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return {'error': '台账记录不存在'}

    record = dict(row)
    conn.close()

    if record['workflow_state'] == WORKFLOW_PAUSED or record['status'] == 'pending_review':
        return {
            'error': '当前台账处于暂停（待复核）状态，不能进行计算。',
            'workflow_state': record['workflow_state'],
            'status': record['status'],
            'pause_reason': record.get('pause_reason'),
            'next_owner': record.get('next_owner'),
            'hint': '请先由教研组完成复核，通过后状态变为"已就绪（续局后）"方可重跑。'
        }

    full_record = LedgerRecord.get(ledger_id)
    if not full_record:
        return {'error': '台账记录不存在'}

    wt_id = full_record.get('weight_table_id')
    weights = None
    if wt_id:
        wt = WeightTable.get(wt_id)
        if wt:
            weights = wt['data']

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

    workflow_tag = []
    if full_record.get('workflow_state') == WORKFLOW_RESUMED:
        workflow_tag.append('[续局后计算]')
    if full_record.get('has_gap'):
        workflow_tag.append('[含已复核断档]')
    if full_record.get('is_old_caliber'):
        workflow_tag.append('[含旧口径数据]')

    change_note = (f"重跑计算,n={result['n']},R²={result['r_squared']}"
                 + ''.join(workflow_tag))

    pv_id = ParamVersion.create(
        ledger_id=ledger_id,
        params=params,
        change_type='rerun',
        change_note=change_note,
        created_by=operator,
        weight_table_id=wt_id,
        formula_screenshot_id=full_record.get('formula_screenshot_id'),
        conn=conn,
        c=c
    )

    final_status = 'completed'
    if full_record.get('workflow_state') == WORKFLOW_RESUMED:
        final_status = 'completed'

    c.execute('''
        UPDATE ledger_records
        SET result_json = ?, status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (json.dumps(params, ensure_ascii=False), final_status, ledger_id))

    c.execute('''
        INSERT INTO history_logs (ledger_id, param_version_id, action,
                                 detail_json, operator)
        VALUES (?, ?, ?, ?, ?)
    ''', (ledger_id, pv_id, '完成计算',
          json.dumps({'params': params, 'weights': weights,
                     'workflow_state': full_record.get('workflow_state'),
                     'workflow_tags': workflow_tag}, ensure_ascii=False),
          operator))

    conn.commit()
    conn.close()

    return {
        'ledger_id': ledger_id,
        'params': params,
        'param_version_id': pv_id,
        'has_gap': full_record.get('has_gap', 0),
        'is_old_caliber': full_record.get('is_old_caliber', 0),
        'workflow_state': full_record.get('workflow_state', 'normal'),
        'workflow_tags': workflow_tag,
        'status': final_status
    }

def export_report(ledger_id: int) -> Dict:
    record = LedgerRecord.get(ledger_id)
    if not record:
        return {'error': '台账记录不存在'}

    param_versions = ParamVersion.list_by_ledger(ledger_id)
    history = HistoryLog.list_by_ledger(ledger_id)
    reviews = ReviewRecord.list_by_ledger(ledger_id)
    screenshots = FormulaScreenshot.list_by_ledger(ledger_id)
    weight_table = WeightTable.get(record['weight_table_id']) if record.get('weight_table_id') else None

    workflow_summary = {
        'current_state': record.get('workflow_state', 'normal'),
        'status': record.get('status'),
        'pause_reason': record.get('pause_reason'),
        'resume_reason': record.get('resume_reason'),
        'resumed_by': record.get('resumed_by'),
        'resumed_at': record.get('resumed_at'),
        'next_owner': record.get('next_owner'),
        'has_gap': record.get('has_gap'),
        'gap_list': record.get('gap_list', []),
        'gap_note': record.get('gap_note'),
        'is_old_caliber': record.get('is_old_caliber'),
        'old_caliber_note': record.get('old_caliber_note')
    }

    return {
        'ledger': {
            'id': record['id'],
            'serial_no': record['serial_no'],
            'title': record['title'],
            'created_by': record['created_by'],
            'created_at': record['created_at'],
            'updated_at': record['updated_at']
        },
        'workflow': workflow_summary,
        'weight_table': weight_table,
        'screenshots': screenshots,
        'items_active': record['items'],
        'items_deleted': record['deleted_items'],
        'latest_params': record.get('params'),
        'param_versions': [{
            'version_no': pv['version_no'],
            'params': pv['params'],
            'change_type': pv['change_type'],
            'change_note': pv['change_note'],
            'workflow': pv.get('workflow'),
            'weight_table_name': pv.get('weight_table_name'),
            'weight_version': pv.get('weight_version'),
            'screenshot_desc': pv.get('screenshot_desc'),
            'created_by': pv['created_by'],
            'created_at': pv['created_at']
        } for pv in param_versions],
        'reviews': [{
            'review_type': rv['review_type'],
            'review_result': rv['review_result'],
            'review_note': rv['review_note'],
            'reason': rv.get('reason'),
            'next_owner': rv.get('next_owner'),
            'reviewed_by': rv['reviewed_by'],
            'created_at': rv['created_at'],
            'gap_detail': rv.get('gap_detail'),
            'deleted_items_detail': rv.get('deleted_items_detail')
        } for rv in reviews],
        'history': [{
            'action': h['action'],
            'operator': h['operator'],
            'created_at': h['created_at'],
            'param_version_no': h.get('param_version_no'),
            'detail': h.get('detail')
        } for h in history],
        'generated_at': datetime.now().isoformat()
    }

init_db()
