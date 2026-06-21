import sqlite3
import os
import json
import re
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'roof_drainage.db')

FIELD_ALIASES = {
    'material_code': ['材料编号', '物料编码', '料号', 'material_code', 'code', '编号'],
    'material_name': ['材料名称', '品名', '物料名称', 'material_name', 'name', '名称'],
    'specification': ['规格型号', '规格', '型号', 'specification', 'spec', 'model'],
    'quantity': ['数量', '工程量', '采购数量', 'quantity', 'qty', 'amount'],
    'unit': ['单位', '计量单位', 'unit'],
    'supplier': ['供应商', '供货单位', '厂家', 'supplier', 'vendor', 'manufacturer'],
    'drawing_version': ['图纸版本', '版次', '图号版本', 'drawing_version', 'version', 'rev'],
    'drawing_no': ['图号', '图纸编号', 'drawing_no', 'drawing', 'dwg'],
    'submit_date': ['送审日期', '报审日期', '提交日期', 'submit_date', 'date'],
    'reviewer': ['复核人', '审核人', 'reviewer', 'checker'],
    'source_file': ['来源文件', '来源', 'source_file', 'source', '文件名'],
    'remark': ['备注', '人工备注', '说明', 'remark', 'note', 'comment'],
}

COMPONENT_ALIASES = {
    'component_id': ['构件编号', '构件ID', 'component_id', 'id', '编号'],
    'component_type': ['构件类型', '类型', 'component_type', 'type', 'category'],
    'x': ['X坐标', 'X', 'x', '坐标X', 'pos_x'],
    'y': ['Y坐标', 'Y', 'y', '坐标Y', 'pos_y'],
    'z': ['Z坐标', 'Z', 'z', '坐标Z', 'pos_z', '标高'],
    'width': ['宽度', '宽', 'width', 'w'],
    'height': ['高度', '高', 'height', 'h'],
    'length': ['长度', '长', 'length', 'l', 'depth'],
    'drawing_version': ['图纸版本', '版次', 'version', 'rev'],
    'remark': ['备注', 'remark', 'note', '偏移说明'],
}


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute('''
        CREATE TABLE IF NOT EXISTS submission_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_code TEXT,
            material_name TEXT,
            specification TEXT,
            quantity REAL,
            unit TEXT,
            supplier TEXT,
            drawing_version TEXT,
            drawing_no TEXT,
            submit_date TEXT,
            reviewer TEXT,
            source_file TEXT NOT NULL,
            source_row INTEGER,
            process_status TEXT DEFAULT '待预审',
            remark TEXT,
            manual_remark TEXT,
            import_batch TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(material_code, drawing_version, specification)
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS model_components (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            component_id TEXT UNIQUE,
            component_type TEXT,
            x REAL,
            y REAL,
            z REAL,
            width REAL,
            height REAL,
            length REAL,
            drawing_version TEXT,
            source_file TEXT,
            remark TEXT,
            import_batch TEXT,
            created_at TEXT
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS collision_issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_key TEXT UNIQUE,
            component_a_id TEXT,
            component_b_id TEXT,
            component_a_type TEXT,
            component_b_type TEXT,
            issue_type TEXT,
            description TEXT,
            suggestion TEXT,
            coordinates TEXT,
            severity TEXT DEFAULT 'warning',
            drawing_version TEXT,
            process_status TEXT DEFAULT '未处理',
            remark TEXT,
            created_at TEXT,
            resolved_at TEXT,
            last_detected_at TEXT
        )
    ''')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS coordinate_offsets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_key TEXT UNIQUE,
            component_id TEXT,
            component_type TEXT,
            offset_x REAL,
            offset_y REAL,
            offset_z REAL,
            original_x REAL,
            original_y REAL,
            original_z REAL,
            description TEXT,
            suggestion TEXT,
            source_file TEXT,
            drawing_version TEXT,
            process_status TEXT DEFAULT '未处理',
            remark TEXT,
            created_at TEXT,
            last_detected_at TEXT
        )
    ''')

    def add_column(table, col, definition):
        try:
            cur.execute(f'ALTER TABLE {table} ADD COLUMN {col} {definition}')
        except Exception:
            pass

    add_column('collision_issues', 'issue_key', 'TEXT UNIQUE')
    add_column('collision_issues', 'remark', 'TEXT')
    add_column('collision_issues', 'last_detected_at', 'TEXT')
    add_column('coordinate_offsets', 'issue_key', 'TEXT UNIQUE')
    add_column('coordinate_offsets', 'remark', 'TEXT')
    add_column('coordinate_offsets', 'last_detected_at', 'TEXT')

    cur.execute('''
        CREATE TABLE IF NOT EXISTS import_batches (
            batch_id TEXT PRIMARY KEY,
            batch_time TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_file TEXT NOT NULL,
            records_count INTEGER DEFAULT 0,
            duplicates_count INTEGER DEFAULT 0,
            notes TEXT
        )
    ''')

    conn.commit()
    conn.close()


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def map_fields(row, alias_map):
    mapped = {}
    row_lower = {str(k).strip().lower(): v for k, v in row.items()}
    row_keys = {str(k).strip(): v for k, v in row.items()}
    for std_field, aliases in alias_map.items():
        value = None
        for alias in aliases:
            if alias.lower() in row_lower and row_lower[alias.lower()] not in (None, ''):
                value = row_lower[alias.lower()]
                break
            if alias in row_keys and row_keys[alias] not in (None, ''):
                value = row_keys[alias]
                break
        if value is not None:
            mapped[std_field] = value
    return mapped


import uuid as _uuid

def generate_batch_id():
    return 'B' + datetime.now().strftime('%Y%m%d%H%M%S') + _uuid.uuid4().hex[:4].upper()


def import_submission(rows, source_file, batch_id=None):
    batch_id = batch_id or generate_batch_id()
    now = datetime.now().isoformat()
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        'INSERT INTO import_batches (batch_id, batch_time, source_type, source_file, records_count, duplicates_count) VALUES (?, ?, ?, ?, 0, 0)',
        (batch_id, now, 'submission', source_file)
    )

    total = 0
    dup_count = 0
    for idx, row in enumerate(rows):
        mapped = map_fields(row, FIELD_ALIASES)
        if not mapped.get('material_code'):
            continue
        mapped['source_file'] = mapped.get('source_file', source_file)
        mapped['source_row'] = idx + 1
        mapped['import_batch'] = batch_id
        mapped['updated_at'] = now

        old = cur.execute(
            'SELECT id, manual_remark, process_status, remark, created_at FROM submission_records WHERE material_code=? AND drawing_version=? AND specification=?',
            (mapped.get('material_code', ''), mapped.get('drawing_version', ''), mapped.get('specification', ''))
        ).fetchone()

        if old:
            dup_count += 1
            keep_manual_remark = old['manual_remark'] if old['manual_remark'] else mapped.get('remark', '')
            keep_process_status = old['process_status'] if old['process_status'] in ('已处理', '已确认', '已解决') else '待预审'
            keep_created_at = old['created_at']
            cur.execute(
                '''UPDATE submission_records SET
                    material_name=?, specification=?, quantity=?, unit=?, supplier=?,
                    drawing_version=?, drawing_no=?, submit_date=?, reviewer=?,
                    source_file=?, source_row=?, remark=?, manual_remark=?,
                    process_status=?, import_batch=?, created_at=?, updated_at=?
                    WHERE id=?''',
                (
                    mapped.get('material_name'), mapped.get('specification'),
                    mapped.get('quantity'), mapped.get('unit'), mapped.get('supplier'),
                    mapped.get('drawing_version'), mapped.get('drawing_no'),
                    mapped.get('submit_date'), mapped.get('reviewer'),
                    mapped['source_file'], mapped['source_row'],
                    mapped.get('remark'), keep_manual_remark, keep_process_status,
                    batch_id, keep_created_at, now, old['id']
                )
            )
        else:
            mapped['process_status'] = '待预审'
            mapped['created_at'] = now
            cols = list(mapped.keys())
            vals = [mapped.get(c) for c in cols]
            placeholders = ','.join(['?'] * len(cols))
            cur.execute(f'INSERT INTO submission_records ({",".join(cols)}) VALUES ({placeholders})', vals)
        total += 1

    cur.execute(
        'UPDATE import_batches SET records_count=?, duplicates_count=? WHERE batch_id=?',
        (total, dup_count, batch_id)
    )
    conn.commit()
    conn.close()
    return {'batch_id': batch_id, 'total': total, 'duplicates': dup_count}


def import_model(rows, source_file, batch_id=None):
    batch_id = batch_id or generate_batch_id()
    now = datetime.now().isoformat()
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        'INSERT INTO import_batches (batch_id, batch_time, source_type, source_file, records_count, duplicates_count) VALUES (?, ?, ?, ?, 0, 0)',
        (batch_id, now, 'model', source_file)
    )

    total = 0
    dup_count = 0
    for row in rows:
        mapped = map_fields(row, COMPONENT_ALIASES)
        if not mapped.get('component_id'):
            continue
        mapped['source_file'] = source_file
        mapped['import_batch'] = batch_id
        mapped['created_at'] = now

        old = cur.execute(
            'SELECT id FROM model_components WHERE component_id=?',
            (mapped['component_id'],)
        ).fetchone()

        if old:
            dup_count += 1
            cols = ','.join([f'{k}=?' for k in mapped.keys() if k != 'component_id'])
            vals = [mapped[k] for k in mapped.keys() if k != 'component_id'] + [mapped['component_id']]
            cur.execute(f'UPDATE model_components SET {cols} WHERE component_id=?', vals)
        else:
            cols = list(mapped.keys())
            vals = [mapped[c] for c in cols]
            placeholders = ','.join(['?'] * len(cols))
            cur.execute(f'INSERT INTO model_components ({",".join(cols)}) VALUES ({placeholders})', vals)
        total += 1

    cur.execute(
        'UPDATE import_batches SET records_count=?, duplicates_count=? WHERE batch_id=?',
        (total, dup_count, batch_id)
    )
    conn.commit()
    conn.close()
    return {'batch_id': batch_id, 'total': total, 'duplicates': dup_count}


def run_collision_detection():
    conn = get_connection()
    cur = conn.cursor()
    now = datetime.now().isoformat()

    existing_collisions = {}
    for r in cur.execute('SELECT id, issue_key, process_status, remark, created_at, resolved_at FROM collision_issues').fetchall():
        existing_collisions[r['issue_key']] = dict(r)

    existing_offsets = {}
    for r in cur.execute('SELECT id, issue_key, process_status, remark, created_at FROM coordinate_offsets').fetchall():
        existing_offsets[r['issue_key']] = dict(r)

    def collision_key(a_id, b_id):
        sorted_ids = sorted([str(a_id or ''), str(b_id or '')])
        return f'COLL:{sorted_ids[0]}|{sorted_ids[1]}'

    def offset_key(comp_id):
        return f'OFFSET:{comp_id}'

    components = [dict(r) for r in cur.execute('SELECT * FROM model_components').fetchall()]
    detected_issue_keys = set()
    detected_offset_keys = set()
    new_issues = 0
    new_offsets = 0

    def aabb_overlap(a, b):
        ax1 = (a.get('x') or 0) - (a.get('width') or 0) / 2
        ay1 = (a.get('y') or 0) - (a.get('length') or 0) / 2
        ax2 = (a.get('x') or 0) + (a.get('width') or 0) / 2
        ay2 = (a.get('y') or 0) + (a.get('length') or 0) / 2
        bx1 = (b.get('x') or 0) - (b.get('width') or 0) / 2
        by1 = (b.get('y') or 0) - (b.get('length') or 0) / 2
        bx2 = (b.get('x') or 0) + (b.get('width') or 0) / 2
        by2 = (b.get('y') or 0) + (b.get('length') or 0) / 2
        return ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1

    for c in components:
        if c.get('remark') and ('偏移' in str(c['remark']) or 'offset' in str(c['remark']).lower()):
            comp_id = c.get('component_id')
            key = offset_key(comp_id)
            detected_offset_keys.add(key)

            offset_x = 0.0
            try:
                m = re.search(r'[+-]?\d+\.?\d*', str(c['remark']))
                if m:
                    offset_x = float(m.group())
            except Exception:
                pass

            off = {
                'issue_key': key,
                'component_id': comp_id,
                'component_type': c.get('component_type'),
                'offset_x': offset_x,
                'offset_y': 0.0,
                'offset_z': 0.0,
                'original_x': c.get('x'),
                'original_y': c.get('y'),
                'original_z': c.get('z'),
                'description': c.get('remark'),
                'suggestion': generate_offset_suggestion(c),
                'source_file': c.get('source_file'),
                'drawing_version': c.get('drawing_version'),
                'last_detected_at': now,
            }

            old = existing_offsets.get(key)
            if old and old['process_status'] in ('已处理', '已解决'):
                cur.execute(
                    '''UPDATE coordinate_offsets SET
                        component_type=?, offset_x=?, offset_y=?, offset_z=?,
                        original_x=?, original_y=?, original_z=?, description=?,
                        suggestion=?, source_file=?, drawing_version=?, last_detected_at=?
                        WHERE issue_key=?''',
                    (
                        off['component_type'], off['offset_x'], off['offset_y'], off['offset_z'],
                        off['original_x'], off['original_y'], off['original_z'], off['description'],
                        off['suggestion'], off['source_file'], off['drawing_version'], now, key
                    )
                )
            elif old:
                cur.execute(
                    '''UPDATE coordinate_offsets SET
                        component_type=?, offset_x=?, offset_y=?, offset_z=?,
                        original_x=?, original_y=?, original_z=?, description=?,
                        suggestion=?, source_file=?, drawing_version=?, process_status=?,
                        last_detected_at=?
                        WHERE issue_key=?''',
                    (
                        off['component_type'], off['offset_x'], off['offset_y'], off['offset_z'],
                        off['original_x'], off['original_y'], off['original_z'], off['description'],
                        off['suggestion'], off['source_file'], off['drawing_version'],
                        '未处理', now, key
                    )
                )
            else:
                off['process_status'] = '未处理'
                off['created_at'] = now
                cols = list(off.keys())
                vals = [off[c] for c in cols]
                cur.execute(f'INSERT INTO coordinate_offsets ({",".join(cols)}) VALUES ({",".join(["?"]*len(cols))})', vals)
                new_offsets += 1

    for i, a in enumerate(components):
        for b in components[i + 1:]:
            if aabb_overlap(a, b):
                key = collision_key(a.get('component_id'), b.get('component_id'))
                detected_issue_keys.add(key)

                severity = 'critical' if (
                    any(t in str(a.get('component_type', '')) for t in ['雨水斗', '地漏', '雨水口']) and
                    any(t in str(b.get('component_type', '')) for t in ['梁', '柱', '设备基础'])
                ) else 'warning'

                iss = {
                    'issue_key': key,
                    'component_a_id': a.get('component_id'),
                    'component_b_id': b.get('component_id'),
                    'component_a_type': a.get('component_type'),
                    'component_b_type': b.get('component_type'),
                    'issue_type': '空间碰撞',
                    'description': f"{a.get('component_type')}({a.get('component_id')}) 与 {b.get('component_type')}({b.get('component_id')}) 空间位置重叠",
                    'suggestion': generate_collision_suggestion(a, b),
                    'coordinates': json.dumps({
                        'a': {'x': a.get('x'), 'y': a.get('y'), 'z': a.get('z')},
                        'b': {'x': b.get('x'), 'y': b.get('y'), 'z': b.get('z')},
                    }, ensure_ascii=False),
                    'severity': severity,
                    'drawing_version': a.get('drawing_version') or b.get('drawing_version'),
                    'last_detected_at': now,
                }

                old = existing_collisions.get(key)
                if old and old['process_status'] in ('已处理', '已解决'):
                    cur.execute(
                        '''UPDATE collision_issues SET
                            component_a_id=?, component_b_id=?, component_a_type=?, component_b_type=?,
                            description=?, suggestion=?, coordinates=?, severity=?,
                            drawing_version=?, last_detected_at=?
                            WHERE issue_key=?''',
                        (
                            iss['component_a_id'], iss['component_b_id'],
                            iss['component_a_type'], iss['component_b_type'],
                            iss['description'], iss['suggestion'], iss['coordinates'],
                            iss['severity'], iss['drawing_version'], now, key
                        )
                    )
                elif old:
                    cur.execute(
                        '''UPDATE collision_issues SET
                            component_a_id=?, component_b_id=?, component_a_type=?, component_b_type=?,
                            description=?, suggestion=?, coordinates=?, severity=?,
                            drawing_version=?, process_status=?, last_detected_at=?
                            WHERE issue_key=?''',
                        (
                            iss['component_a_id'], iss['component_b_id'],
                            iss['component_a_type'], iss['component_b_type'],
                            iss['description'], iss['suggestion'], iss['coordinates'],
                            iss['severity'], iss['drawing_version'], '未处理', now, key
                        )
                    )
                else:
                    iss['process_status'] = '未处理'
                    iss['created_at'] = now
                    cols = list(iss.keys())
                    vals = [iss[c] for c in cols]
                    cur.execute(f'INSERT INTO collision_issues ({",".join(cols)}) VALUES ({",".join(["?"]*len(cols))})', vals)
                    new_issues += 1

    conn.commit()
    conn.close()

    total_collisions = len(detected_issue_keys)
    total_offsets = len(detected_offset_keys)
    return {
        'collisions': total_collisions,
        'new_collisions': new_issues,
        'offsets': total_offsets,
        'new_offsets': new_offsets,
    }


def generate_collision_suggestion(a, b):
    s = []
    if any(t in str(a.get('component_type', '')) for t in ['雨水斗', '地漏', '雨水口']):
        s.append(f"建议复核{a.get('component_type')}定位是否可微调，避让{b.get('component_type')}")
    elif any(t in str(b.get('component_type', '')) for t in ['雨水斗', '地漏', '雨水口']):
        s.append(f"建议复核{b.get('component_type')}定位是否可微调，避让{a.get('component_type')}")
    else:
        s.append(f"建议核对图纸版次，确认{a.get('component_type')}与{b.get('component_type')}是否应共存")
    if a.get('drawing_version') != b.get('drawing_version'):
        s.append(f"注意：两构件图纸版次不一致（{a.get('drawing_version')}/{b.get('drawing_version')}），请先确认最新版")
    return '；'.join(s)


def generate_offset_suggestion(c):
    parts = [f"构件{c.get('component_id')}存在坐标偏移，请联系设计确认偏移是否为设计意图"]
    parts.append("如偏移为变更，请在材料送审表备注栏补充说明并同步更新图纸版次")
    parts.append("如偏移非设计意图，请按设计坐标重新定位后重新提交预审")
    return '；'.join(parts)


def query_all():
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    data = {
        'submissions': [dict(r) for r in cur.execute('SELECT * FROM submission_records ORDER BY id DESC').fetchall()],
        'components': [dict(r) for r in cur.execute('SELECT * FROM model_components ORDER BY id DESC').fetchall()],
        'collisions': [dict(r) for r in cur.execute('SELECT * FROM collision_issues ORDER BY severity DESC, id DESC').fetchall()],
        'offsets': [dict(r) for r in cur.execute('SELECT * FROM coordinate_offsets ORDER BY id DESC').fetchall()],
        'batches': [dict(r) for r in cur.execute('SELECT * FROM import_batches ORDER BY batch_time DESC').fetchall()],
        'stats': {
            'submission_total': cur.execute('SELECT COUNT(*) FROM submission_records').fetchone()[0],
            'submission_pending': cur.execute('SELECT COUNT(*) FROM submission_records WHERE process_status="待预审"').fetchone()[0],
            'components_total': cur.execute('SELECT COUNT(*) FROM model_components').fetchone()[0],
            'collisions_total': cur.execute('SELECT COUNT(*) FROM collision_issues').fetchone()[0],
            'collisions_critical': cur.execute('SELECT COUNT(*) FROM collision_issues WHERE severity="critical"').fetchone()[0],
            'offsets_total': cur.execute('SELECT COUNT(*) FROM coordinate_offsets').fetchone()[0],
        }
    }
    conn.close()
    return data


def update_manual_remark(record_id, manual_remark):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        'UPDATE submission_records SET manual_remark=?, updated_at=? WHERE id=?',
        (manual_remark, datetime.now().isoformat(), record_id)
    )
    conn.commit()
    conn.close()
    return True


def update_process_status(table, record_id, status, remark=None):
    conn = get_connection()
    cur = conn.cursor()
    now = datetime.now().isoformat()
    if table == 'submission':
        cur.execute('UPDATE submission_records SET process_status=?, updated_at=? WHERE id=?', (status, now, record_id))
    elif table == 'collision':
        if remark is not None:
            cur.execute('UPDATE collision_issues SET process_status=?, resolved_at=?, remark=? WHERE id=?', (status, now, remark, record_id))
        else:
            cur.execute('UPDATE collision_issues SET process_status=?, resolved_at=? WHERE id=?', (status, now, record_id))
    elif table == 'offset':
        if remark is not None:
            cur.execute('UPDATE coordinate_offsets SET process_status=?, remark=? WHERE id=?', (status, remark, record_id))
        else:
            cur.execute('UPDATE coordinate_offsets SET process_status=? WHERE id=?', (status, record_id))
    conn.commit()
    conn.close()
    return True


def update_issue_remark(table, record_id, remark):
    conn = get_connection()
    cur = conn.cursor()
    if table == 'collision':
        cur.execute('UPDATE collision_issues SET remark=? WHERE id=?', (remark, record_id))
    elif table == 'offset':
        cur.execute('UPDATE coordinate_offsets SET remark=? WHERE id=?', (remark, record_id))
    conn.commit()
    conn.close()
    return True
