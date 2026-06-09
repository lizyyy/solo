import os
import re
import json
import sqlite3
import csv
import io
from datetime import datetime
from functools import wraps
from collections import defaultdict
from flask import Flask, request, jsonify, send_file, g

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'warning_system.db')

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['JSON_AS_ASCII'] = False

try:
    from flask_cors import CORS
    CORS(app)
except Exception:
    pass


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


def query_db(query, args=(), one=False, commit=False):
    cur = get_db().execute(query, args)
    if commit:
        get_db().commit()
    rv = cur.fetchall()
    cur.close()
    return (rv[0] if rv else None) if one else rv


DEVICE_PREFIX_MAP = {
    'fd': 'FD', '风机': 'FD', '风力发电机': 'FD',
    'bld': 'BLD', '叶片': 'BLD',
}


def normalize_device_no(raw_no):
    if not raw_no:
        return None, "空值"
    original = str(raw_no).strip()
    s = original.replace(' ', '').replace('　', '')

    prefix = 'FD'
    for key, val in DEVICE_PREFIX_MAP.items():
        if s.lower().startswith(key.lower()):
            prefix = val
            s = s[len(key):]
            break

    num_match = re.search(r'(\d{1,5})', s)
    if not num_match:
        return None, f"无法提取数字: {original}"

    normalized = f"{prefix}-{num_match.group(1).zfill(5)}"
    return normalized, None


FIELD_ALIASES = {
    'device_no': ['设备编号', '设备号', '机组编号', '风机编号', '机组号', '风机号', 'device', 'device_no', 'deviceNo', 'DeviceNo', '编号', 'FD编号', '塔号', '机位号'],
    'blade_no': ['叶片编号', '叶片号', 'blade', 'blade_no', 'BladeNo', '叶片序号', '叶片位置'],
    'threshold_type': ['阈值类型', '预警类型', '类型', '告警类型', 'threshold', 'type'],
    'current_value': ['当前值', '检测值', '实际值', '测量值', 'value', 'current_value', 'CurrentValue', '数值'],
    'threshold_value': ['阈值', '预警阈值', '告警阈值', '标准值', 'threshold_value', 'ThresholdValue', '限值', '标准限值'],
    'temp_threshold': ['临时阈值', '调整阈值', '临时调高值', 'temp_threshold', 'TempThreshold', '临时限值'],
    'is_temp_adjusted': ['阈值是否临时调整', '是否调高', '临时调整', '临时调高', 'is_temp', 'temp', 'adjusted'],
    'spare_part_name': ['备件名称', '配件名称', '零件名称', '物料名称', 'spare_part', 'part_name', 'PartName', '备件名'],
    'spare_part_qty': ['备件数量', '需求数量', '数量', 'qty', 'quantity', 'Qty', '备件用量'],
    'spare_part_model': ['规格型号', '型号', '规格', 'model', 'spec', 'Spec', 'PartModel'],
    'source': ['来源', '数据来源', '来源系统', 'source', 'Source', '报表来源'],
    'remark': ['备注', '说明', '注释', 'remark', 'Remark', 'Note'],
    'status': ['处理状态', '状态', '复核状态', 'status', 'Status', 'State'],
    'reviewer': ['复核人', '处理人', 'reviewer', 'Reviewer', '负责人'],
    'conclusion': ['复核结论', '结论', '处理结论', 'conclusion', 'Conclusion', '文件结论'],
    'report_date': ['报告日期', '检测日期', '日期', 'date', 'report_date', 'ReportDate'],
}

CORE_FIELDS = ['source', 'status', 'remark', 'conclusion', 'reviewer', 'device_no',
               'spare_part_name', 'spare_part_qty', 'spare_part_model', 'threshold_type',
               'current_value', 'threshold_value']


def build_field_mapping(headers):
    mapping = {}
    header_norm = {}
    for h in headers:
        hh = str(h).strip().lower().replace(' ', '').replace('_', '').replace('-', '')
        header_norm[hh] = h
    for std_field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            a_norm = alias.lower().replace(' ', '').replace('_', '').replace('-', '')
            if a_norm in header_norm:
                mapping[std_field] = header_norm[a_norm]
                break
    return mapping


def parse_row_with_mapping(row, mapping, headers):
    result = {}
    idx_map = {h: i for i, h in enumerate(headers)}
    for std_field in FIELD_ALIASES.keys():
        if std_field in mapping:
            orig_col = mapping[std_field]
            val = row[idx_map[orig_col]] if idx_map[orig_col] < len(row) else None
            if val is not None and str(val).strip() != '':
                result[std_field] = val
    result['_raw_headers'] = list(headers)
    result['_raw_values'] = list(row)
    result['_field_mapping'] = mapping
    return result


TEMP_KEYWORDS = ['临时', '调高', '调整', '放宽', '暂调', '临时调整', 'temporary', 'temp', 'adjust']


def detect_temp_adjusted(record):
    is_explicit = False
    explicit_reason = ""
    temp_flag = record.get('is_temp_adjusted')
    if temp_flag is not None:
        s = str(temp_flag).strip().lower()
        if s in ['是', 'true', '1', 'yes', 'y', '有', '已调高', '已调整']:
            is_explicit = True
            explicit_reason = f"字段标记: {temp_flag}"
        elif s in ['否', 'false', '0', 'no', 'n', '无']:
            return False, "字段明确标记为否"

    remark = str(record.get('remark', '') or '')
    conclusion = str(record.get('conclusion', '') or '')
    for kw in TEMP_KEYWORDS:
        if kw in remark:
            return True, explicit_reason or f"备注含关键词: {kw}"
        if kw in conclusion:
            return True, explicit_reason or f"结论含关键词: {kw}"

    temp_val = record.get('temp_threshold')
    base_val = record.get('threshold_value')
    try:
        if temp_val is not None and base_val is not None and str(temp_val).strip() and str(base_val).strip():
            tv = float(str(temp_val).replace(',', ''))
            bv = float(str(base_val).replace(',', ''))
            if tv > bv:
                return True, explicit_reason or f"临时阈值({tv}) > 标准阈值({bv})"
    except (ValueError, TypeError):
        pass

    try:
        cur_raw = record.get('current_value')
        if cur_raw is not None and base_val is not None and str(cur_raw).strip() and str(base_val).strip():
            cur = float(str(cur_raw).replace(',', ''))
            bv = float(str(base_val).replace(',', ''))
            if temp_val is not None and str(temp_val).strip():
                tv = float(str(temp_val).replace(',', ''))
                if bv < cur <= tv:
                    return True, explicit_reason or f"当前值({cur})在(标准{bv}, 临时{tv}]区间内"
    except (ValueError, TypeError):
        pass
    return is_explicit, explicit_reason or "无明显标记"


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS spare_part_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    source TEXT DEFAULT '',
    device_no_raw TEXT,
    device_no_norm TEXT,
    blade_no TEXT,
    threshold_type TEXT,
    current_value REAL,
    threshold_value REAL,
    temp_threshold REAL,
    is_temp_adjusted INTEGER DEFAULT 0,
    temp_adjust_reason TEXT,
    spare_part_name TEXT,
    spare_part_qty REAL,
    spare_part_model TEXT,
    status TEXT DEFAULT '待复核',
    reviewer TEXT,
    remark TEXT,
    conclusion TEXT,
    report_date TEXT,
    raw_payload TEXT NOT NULL,
    field_mapping TEXT,
    import_time TEXT NOT NULL,
    update_time TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_spare_device ON spare_part_records(device_no_norm);
CREATE INDEX IF NOT EXISTS idx_spare_status ON spare_part_records(status);
CREATE INDEX IF NOT EXISTS idx_spare_temp ON spare_part_records(is_temp_adjusted);
CREATE INDEX IF NOT EXISTS idx_spare_batch ON spare_part_records(batch_id);

CREATE TABLE IF NOT EXISTS page_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_key TEXT NOT NULL UNIQUE,
    reviewer TEXT,
    filters TEXT,
    sort_info TEXT,
    current_record_id INTEGER,
    scroll_pos INTEGER DEFAULT 0,
    active_tab TEXT DEFAULT 'all',
    summary TEXT,
    draft_notes TEXT,
    last_visit_time TEXT NOT NULL,
    create_time TEXT NOT NULL,
    update_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_no_norm TEXT NOT NULL,
    device_no_raw TEXT NOT NULL,
    hit_count INTEGER DEFAULT 1,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    UNIQUE(device_no_norm, device_no_raw)
);
CREATE INDEX IF NOT EXISTS idx_variant_norm ON device_variants(device_no_norm);

CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operator TEXT,
    operate_time TEXT NOT NULL,
    remark TEXT
);
"""


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_SQL)
    conn.commit()
    conn.close()


def row2dict(row):
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}


def now_str():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def log_action(record_id, action, old=None, new=None, operator=None, remark=None):
    query_db(
        "INSERT INTO action_logs(record_id, action, old_value, new_value, operator, operate_time, remark) VALUES(?,?,?,?,?,?,?)",
        (record_id, action, json.dumps(old, ensure_ascii=False) if old else None,
         json.dumps(new, ensure_ascii=False) if new else None, operator, now_str(), remark),
        commit=True
    )


def upsert_device_variant(norm, raw):
    if not norm or not raw:
        return
    existing = query_db(
        "SELECT * FROM device_variants WHERE device_no_norm=? AND device_no_raw=?",
        (norm, raw), one=True
    )
    t = now_str()
    if existing:
        query_db(
            "UPDATE device_variants SET hit_count=hit_count+1, last_seen=? WHERE id=?",
            (t, existing['id']), commit=True
        )
    else:
        query_db(
            "INSERT INTO device_variants(device_no_norm, device_no_raw, first_seen, last_seen) VALUES(?,?,?,?)",
            (norm, raw, t, t), commit=True
        )


# ========== 2. 记录列表/汇总 ==========
@app.route('/api/records', methods=['GET'])
def api_records():
    status = request.args.get('status', '')
    temp_only = request.args.get('temp_only', '0') == '1'
    norm_device = request.args.get('device_no_norm', '')
    keyword = request.args.get('keyword', '')
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 50))
    where = []
    args = []
    tab = request.args.get('tab', '')
    if tab == 'pending':
        where.append("status = ?")
        args.append('待复核')
    elif tab == 'doing':
        where.append("status = ?")
        args.append('处理中')
    elif tab == 'done':
        where.append("status IN (?,?)")
        args.extend(['已通过', '已完成'])
    elif tab == 'temp':
        where.append("is_temp_adjusted = 1")
    if status and not tab:
        where.append("status = ?")
        args.append(status)
    if temp_only and not tab:
        where.append("is_temp_adjusted = 1")
    if norm_device:
        where.append("device_no_norm = ?")
        args.append(norm_device)
    if keyword:
        where.append("(spare_part_name LIKE ? OR remark LIKE ? OR conclusion LIKE ? OR threshold_type LIKE ? OR COALESCE(device_no_raw,'') LIKE ? OR COALESCE(device_no_norm,'') LIKE ?)")
        kw = f"%{keyword}%"
        args.extend([kw, kw, kw, kw, kw, kw])
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    total = query_db(f"SELECT COUNT(*) as c FROM spare_part_records {where_sql}", args, one=True)['c']
    offset = (page - 1) * size
    records = query_db(f"""SELECT * FROM spare_part_records {where_sql}
        ORDER BY is_temp_adjusted DESC, CASE status WHEN '待复核' THEN 0 WHEN '处理中' THEN 1 ELSE 2 END,
        import_time DESC, id DESC LIMIT ? OFFSET ?""", args + [size, offset])
    return jsonify({'ok': True, 'total': total, 'page': page, 'size': size, 'records': [row2dict(r) for r in records]})


@app.route('/api/records/<int:rid>', methods=['GET'])
def api_record_detail(rid):
    r = query_db("SELECT * FROM spare_part_records WHERE id=?", (rid,), one=True)
    if not r:
        return jsonify({'ok': False, 'msg': '记录不存在'}), 404
    d = row2dict(r)
    try:
        d['raw_payload_obj'] = json.loads(d.get('raw_payload') or '{}')
    except Exception:
        d['raw_payload_obj'] = {}
    try:
        d['field_mapping_obj'] = json.loads(d.get('field_mapping') or '{}')
    except Exception:
        d['field_mapping_obj'] = {}
    variants = []
    if d.get('device_no_norm'):
        vs = query_db("SELECT device_no_raw, hit_count FROM device_variants WHERE device_no_norm=? ORDER BY hit_count DESC", (d['device_no_norm'],))
        variants = [row2dict(v) for v in vs]
    d['device_variants'] = variants
    logs = query_db("SELECT * FROM action_logs WHERE record_id=? ORDER BY operate_time DESC", (rid,))
    d['action_logs'] = [row2dict(l) for l in logs]
    d['traceability'] = build_trace(d)
    return jsonify({'ok': True, 'record': d})


def build_trace(record):
    mapping = {}
    raw_headers = []
    raw_values = []
    try:
        rp = json.loads(record.get('raw_payload') or '{}')
        mapping = json.loads(record.get('field_mapping') or '{}')
        raw_headers = rp.get('_raw_headers', [])
        raw_values = rp.get('_raw_values', [])
    except Exception:
        pass
    core_field_trace = {}
    for std in CORE_FIELDS:
        orig_col = mapping.get(std)
        orig_val = None
        if orig_col and orig_col in raw_headers:
            idx = raw_headers.index(orig_col)
            if idx < len(raw_values):
                orig_val = raw_values[idx]
        cur_v = record.get(std)
        core_field_trace[std] = {
            'standard_field': std,
            'original_column': orig_col,
            'original_value': orig_val,
            'current_value': cur_v,
            'consistent': str(orig_val if orig_val is not None else '').strip() == str(cur_v if cur_v is not None else '').strip()
        }
    summary_points = []
    if record.get('is_temp_adjusted'):
        summary_points.append(f"⚠️ 阈值临时调高: {record.get('temp_adjust_reason')}")
    summary_points.append(f"处理状态: {record.get('status')}")
    if record.get('reviewer'):
        summary_points.append(f"复核人: {record.get('reviewer')}")
    if record.get('conclusion'):
        summary_points.append(f"复核结论: {record.get('conclusion')}")
    if record.get('remark'):
        summary_points.append(f"备注: {record.get('remark')}")
    return {'core_fields': core_field_trace, 'summary_points': summary_points,
            'raw_headers': raw_headers, 'raw_values': raw_values}


@app.route('/api/summary', methods=['GET'])
def api_summary():
    total = query_db("SELECT COUNT(*) as c FROM spare_part_records", one=True)['c']
    status_rows = query_db("SELECT status, COUNT(*) as c FROM spare_part_records GROUP BY status")
    status_dist = {r['status']: r['c'] for r in status_rows}
    temp_cnt = query_db("SELECT COUNT(*) as c FROM spare_part_records WHERE is_temp_adjusted=1", one=True)['c']
    device_rows = query_db("""
        SELECT device_no_norm, COUNT(*) as c,
               SUM(CASE WHEN is_temp_adjusted=1 THEN 1 ELSE 0 END) as temp_cnt,
               SUM(CASE WHEN status='待复核' THEN 1 ELSE 0 END) as pending_cnt
        FROM spare_part_records WHERE device_no_norm IS NOT NULL
        GROUP BY device_no_norm ORDER BY c DESC LIMIT 50
    """)
    devices = [row2dict(r) for r in device_rows]
    type_rows = query_db("""
        SELECT threshold_type, COUNT(*) as c,
               SUM(CASE WHEN is_temp_adjusted=1 THEN 1 ELSE 0 END) as temp_cnt
        FROM spare_part_records GROUP BY threshold_type ORDER BY c DESC
    """)
    types = [row2dict(r) for r in type_rows]
    temp_recs = query_db("""
        SELECT id, device_no_norm, device_no_raw, threshold_type, current_value,
               threshold_value, temp_threshold, temp_adjust_reason, status, import_time
        FROM spare_part_records WHERE is_temp_adjusted=1 ORDER BY import_time DESC LIMIT 20
    """)
    temp_details = [row2dict(r) for r in temp_recs]
    pending_device_recs = query_db("""
        SELECT id, device_no_norm, device_no_raw, status, threshold_type, spare_part_name, import_time
        FROM spare_part_records WHERE status='待复核' ORDER BY import_time DESC LIMIT 20
    """)
    pending_details = [row2dict(r) for r in pending_device_recs]
    return jsonify({
        'ok': True, 'total': total, 'temp_adjusted_count': temp_cnt,
        'status_distribution': status_dist, 'devices': devices, 'threshold_types': types,
        'pulled_breakdown': {
            'by_status': status_dist,
            'temp_highlights': temp_details,
            'pending_highlights': pending_details,
            'device_highlights': [d for d in devices if d['temp_cnt'] > 0 or d['pending_cnt'] > 0][:10]
        }
    })


# ========== 3. 更新记录 ==========
@app.route('/api/records/<int:rid>', methods=['PUT'])
def api_update_record(rid):
    r = query_db("SELECT * FROM spare_part_records WHERE id=?", (rid,), one=True)
    if not r:
        return jsonify({'ok': False, 'msg': '记录不存在'}), 404
    data = request.get_json(force=True)
    allowed = ['status', 'remark', 'conclusion', 'reviewer', 'spare_part_name',
               'spare_part_qty', 'spare_part_model', 'is_temp_adjusted', 'temp_adjust_reason',
               'threshold_type', 'current_value', 'threshold_value', 'temp_threshold',
               'device_no_norm']
    updates = {}
    for k in allowed:
        if k in data:
            updates[k] = data[k]
    if not updates:
        return jsonify({'ok': False, 'msg': '无有效更新字段'}), 400
    old = {k: r[k] for k in updates.keys()}
    if 'is_temp_adjusted' in updates and not updates.get('temp_adjust_reason'):
        if updates['is_temp_adjusted'] and not r['temp_adjust_reason']:
            updates['temp_adjust_reason'] = "人工标记为临时阈值调高"
    sets = ", ".join([f"{k}=?" for k in updates.keys()]) + ", update_time=?"
    args = list(updates.values()) + [now_str(), rid]
    query_db(f"UPDATE spare_part_records SET {sets} WHERE id=?", args, commit=True)
    log_action(rid, 'UPDATE', old=old, new=updates, operator=data.get('operator'))
    if 'device_no_norm' in updates and updates['device_no_norm'] != r['device_no_norm']:
        upsert_device_variant(updates['device_no_norm'], r['device_no_raw'])
    return jsonify({'ok': True, 'updated': updates})


# ========== 4. 页面快照 ==========
@app.route('/api/snapshot/<page_key>', methods=['GET'])
def api_get_snapshot(page_key):
    s = query_db("SELECT * FROM page_snapshots WHERE page_key=?", (page_key,), one=True)
    if not s:
        return jsonify({'ok': True, 'snapshot': None})
    d = row2dict(s)
    for k in ['filters', 'sort_info', 'summary', 'draft_notes']:
        try:
            if d.get(k):
                d[k] = json.loads(d[k])
        except Exception:
            pass
    return jsonify({'ok': True, 'snapshot': d})


@app.route('/api/snapshot/<page_key>', methods=['PUT'])
def api_save_snapshot(page_key):
    data = request.get_json(force=True)
    t = now_str()
    exist = query_db("SELECT * FROM page_snapshots WHERE page_key=?", (page_key,), one=True)
    fields_map = {
        'reviewer': data.get('reviewer'),
        'filters': json.dumps(data.get('filters'), ensure_ascii=False) if data.get('filters') is not None else None,
        'sort_info': json.dumps(data.get('sort_info'), ensure_ascii=False) if data.get('sort_info') is not None else None,
        'current_record_id': data.get('current_record_id'),
        'scroll_pos': data.get('scroll_pos', 0),
        'active_tab': data.get('active_tab', 'all'),
        'summary': json.dumps(data.get('summary'), ensure_ascii=False) if data.get('summary') is not None else None,
        'draft_notes': json.dumps(data.get('draft_notes'), ensure_ascii=False) if data.get('draft_notes') is not None else None,
        'last_visit_time': t,
    }
    if exist:
        sets = ", ".join([f"{k}=?" for k in fields_map.keys()]) + ", update_time=?"
        args = list(fields_map.values()) + [t, page_key]
        query_db(f"UPDATE page_snapshots SET {sets} WHERE page_key=?", args, commit=True)
    else:
        cols = ", ".join(list(fields_map.keys()) + ['page_key', 'create_time', 'update_time'])
        qs = ", ".join(['?'] * (len(fields_map) + 3))
        vals = list(fields_map.values()) + [page_key, t, t]
        query_db(f"INSERT INTO page_snapshots({cols}) VALUES({qs})", vals, commit=True)
    return jsonify({'ok': True, 'saved_at': t})


# ========== 5. 导出摘要（含一致性校验） ==========
@app.route('/api/export/summary', methods=['POST'])
def api_export_summary():
    data = request.get_json(force=True) or {}
    record_ids = data.get('record_ids', [])
    if record_ids:
        qmarks = ",".join(['?'] * len(record_ids))
        rows = query_db(f"SELECT * FROM spare_part_records WHERE id IN ({qmarks}) ORDER BY id", record_ids)
    else:
        rows = query_db("SELECT * FROM spare_part_records ORDER BY id")
    output = io.StringIO()
    writer = csv.writer(output)
    headers = ['ID', '归一化设备编号', '原始设备编号', '叶片编号', '阈值类型',
               '当前值', '标准阈值', '临时阈值', '是否临时调高', '调高原因',
               '备件名称', '备件数量', '规格型号', '处理状态', '复核人', '备注',
               '复核结论', '报告日期', '来源', '导入时间',
               '状态一致', '备注一致', '结论一致', '一致性备注',
               '备件清单原话(核心字段)']
    writer.writerow(headers)
    inconsistent_count = 0
    for r in rows:
        d = row2dict(r)
        trace = build_trace(d)
        cf = trace['core_fields']
        status_ok = cf.get('status', {}).get('consistent', True)
        remark_ok = cf.get('remark', {}).get('consistent', True)
        conclusion_ok = cf.get('conclusion', {}).get('consistent', True)
        consistent_all = status_ok and remark_ok and conclusion_ok
        if not consistent_all:
            inconsistent_count += 1
        notes = []
        if not status_ok:
            notes.append(f"状态『{cf['status']['original_value']}』→『{cf['status']['current_value']}』")
        if not remark_ok:
            notes.append(f"备注『{cf['remark']['original_value']}』→『{cf['remark']['current_value']}』")
        if not conclusion_ok:
            notes.append(f"结论『{cf['conclusion']['original_value']}』→『{cf['conclusion']['current_value']}』")
        orig_parts = []
        for std in ['spare_part_name', 'spare_part_qty', 'spare_part_model', 'threshold_type',
                    'current_value', 'threshold_value', 'device_no', 'source']:
            info = cf.get(std) or {}
            if info.get('original_column') and str(info.get('original_value') or '').strip():
                orig_parts.append(f"{info['original_column']}={info['original_value']}")
        row_vals = [
            d['id'], d.get('device_no_norm'), d.get('device_no_raw'), d.get('blade_no'),
            d.get('threshold_type'), d.get('current_value'), d.get('threshold_value'),
            d.get('temp_threshold'), '是' if d.get('is_temp_adjusted') else '否',
            d.get('temp_adjust_reason'), d.get('spare_part_name'), d.get('spare_part_qty'),
            d.get('spare_part_model'), d.get('status'), d.get('reviewer'),
            d.get('remark'), d.get('conclusion'), d.get('report_date'),
            d.get('source'), d.get('import_time'),
            '✓' if status_ok else '✗', '✓' if remark_ok else '✗',
            '✓' if conclusion_ok else '✗', '; '.join(notes),
            '; '.join(orig_parts)
        ]
        writer.writerow([str(v) if v is not None else '' for v in row_vals])
    output.seek(0)
    buf = io.BytesIO()
    buf.write(output.getvalue().encode('utf-8-sig'))
    buf.seek(0)
    filename = f"风机叶片阈值预警摘要_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{len(rows)}条_不一致{inconsistent_count}条.csv"
    return send_file(buf, mimetype='text/csv', as_attachment=True, download_name=filename)


# ========== 6. 交接溯源 ==========
@app.route('/api/handover/trace', methods=['GET'])
def api_handover_trace():
    keyword = request.args.get('keyword', '')
    dev_norm = request.args.get('device_no_norm', '')
    dev_raw = request.args.get('device_no_raw', '')
    if dev_raw and not dev_norm:
        n, _ = normalize_device_no(dev_raw)
        if n:
            dev_norm = n
    where = []
    args = []
    if dev_norm:
        where.append("device_no_norm = ?")
        args.append(dev_norm)
    if keyword:
        where.append("""(spare_part_name LIKE ? OR remark LIKE ? OR conclusion LIKE ?
                        OR COALESCE(raw_payload,'') LIKE ?)""")
        kw = f"%{keyword}%"
        args.extend([kw, kw, kw, kw])
    if not where:
        return jsonify({'ok': True, 'traces': [], 'hint': '请输入设备编号或关键词'})
    sql = f"""SELECT * FROM spare_part_records WHERE {' AND '.join(where)}
              ORDER BY import_time DESC, id DESC LIMIT 100"""
    recs = query_db(sql, args)
    traces = []
    for r in recs:
        d = row2dict(r)
        trace = build_trace(d)
        traces.append({
            'record_id': d['id'], 'device_no_norm': d.get('device_no_norm'),
            'device_no_raw': d.get('device_no_raw'),
            'original_words': extract_original_words(trace),
            'page_summary': trace['summary_points'],
            'conclusion': d.get('conclusion'), 'status': d.get('status'),
            'source': d.get('source'), 'reviewer': d.get('reviewer'),
            'import_time': d.get('import_time'),
            'is_temp': d.get('is_temp_adjusted'),
        })
    variants = []
    if dev_norm:
        vs = query_db("SELECT * FROM device_variants WHERE device_no_norm=? ORDER BY hit_count DESC", (dev_norm,))
        variants = [row2dict(v) for v in vs]
    return jsonify({'ok': True, 'traces': traces, 'device_variants': variants, 'normalized_device_no': dev_norm})


def extract_original_words(trace):
    cf = trace['core_fields']
    raw_lines = []
    for std, info in cf.items():
        if info.get('original_column') and str(info.get('original_value') or '').strip():
            raw_lines.append(f"【{info['original_column']}】{info['original_value']}")
    return '\n'.join(raw_lines)


def _do_import(headers, rows, source='手动导入', reviewer='', batch_id=None):
    batch_id = batch_id or f"B{datetime.now().strftime('%Y%m%d%H%M%S')}"
    if not headers or not rows:
        return {'ok': False, 'msg': '表头和数据不能为空'}, 400
    mapping = build_field_mapping(headers)
    inserted = 0
    skipped = []
    t = now_str()
    for idx, row in enumerate(rows):
        try:
            parsed = parse_row_with_mapping(row, mapping, headers)
            dev_raw = str(parsed.get('device_no') or '').strip()
            dev_norm, _ = normalize_device_no(dev_raw)
            rec = {
                'batch_id': batch_id,
                'source': parsed.get('source') or source,
                'device_no_raw': dev_raw,
                'device_no_norm': dev_norm,
                'blade_no': str(parsed.get('blade_no', '') or ''),
                'threshold_type': str(parsed.get('threshold_type', '') or ''),
                'current_value': None, 'threshold_value': None, 'temp_threshold': None,
                'spare_part_name': str(parsed.get('spare_part_name', '') or ''),
                'spare_part_qty': None,
                'spare_part_model': str(parsed.get('spare_part_model', '') or ''),
                'status': parsed.get('status') or '待复核',
                'reviewer': parsed.get('reviewer') or reviewer or '',
                'remark': str(parsed.get('remark', '') or ''),
                'conclusion': str(parsed.get('conclusion', '') or ''),
                'report_date': str(parsed.get('report_date', '') or ''),
            }
            for k in ['current_value', 'threshold_value', 'temp_threshold', 'spare_part_qty']:
                v = parsed.get(k)
                if v not in (None, ''):
                    try: rec[k] = float(str(v).replace(',', ''))
                    except (ValueError, TypeError): pass
            is_temp, temp_reason = detect_temp_adjusted(rec)
            rec['is_temp_adjusted'] = 1 if is_temp else 0
            rec['temp_adjust_reason'] = temp_reason
            if dev_norm:
                upsert_device_variant(dev_norm, dev_raw)
            query_db("""INSERT INTO spare_part_records(
                batch_id, source, device_no_raw, device_no_norm, blade_no, threshold_type,
                current_value, threshold_value, temp_threshold, is_temp_adjusted, temp_adjust_reason,
                spare_part_name, spare_part_qty, spare_part_model, status, reviewer, remark,
                conclusion, report_date, raw_payload, field_mapping, import_time, update_time
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
                rec['batch_id'], rec['source'], rec['device_no_raw'], rec['device_no_norm'],
                rec['blade_no'], rec['threshold_type'], rec['current_value'], rec['threshold_value'],
                rec['temp_threshold'], rec['is_temp_adjusted'], rec['temp_adjust_reason'],
                rec['spare_part_name'], rec['spare_part_qty'], rec['spare_part_model'],
                rec['status'], rec['reviewer'], rec['remark'], rec['conclusion'], rec['report_date'],
                json.dumps(parsed, ensure_ascii=False),
                json.dumps(mapping, ensure_ascii=False),
                t, t
            ), commit=True)
            inserted += 1
        except Exception as e:
            skipped.append({'row': idx, 'error': str(e)})
    return {'ok': True, 'batch_id': batch_id, 'inserted': inserted,
            'skipped': skipped, 'mapping_used': mapping}, 200


@app.route('/api/import', methods=['POST'])
def api_import():
    data = request.get_json(force=True)
    r, code = _do_import(
        data.get('headers', []), data.get('rows', []),
        data.get('source', '手动导入'), data.get('reviewer', ''),
        data.get('batch_id')
    )
    return jsonify(r), (code if isinstance(code, int) else 200)


# ========== 7. 演示数据 ==========
@app.route('/api/demo/generate', methods=['POST'])
def api_demo_generate():
    headers = ['机组编号', '叶片位置', '预警类型', '实际值', '标准限值', '临时限值',
               '备件名称', '数量', '规格', '数据来源', '处理状态', '复核人', '备注', '复核结论', '日期']
    sample_rows = [
        ['FD#012', 'A叶片', '叶根弯矩', '85.2', '80', '90', '叶根衬套', '2', 'L-200', 'SCADA日报', '待复核', '', '值班长说明本周临时放宽', '', '2026-06-05'],
        ['风机#3', 'B', '挥舞振幅', '12.1', '12', '', '叶片加强筋', '1', 'JB-50', '巡检报告', '待复核', '', '', '', '2026-06-06'],
        ['FD 007', 'C', '叶尖间隙', '28.5', '30', '26', '间隙调整垫片', '5', '0.5mm', '巡检报告', '已通过', '阿敏', '间隙小于原标准，临时阈值更严，放行', '符合要求', '2026-06-07'],
        ['#18', 'A', '叶根弯矩', '88', '80', '95', '叶根螺栓', '8', 'M30x180', 'SCADA日报', '处理中', '阿敏', '临时调高至95，仍在区间内', '', '2026-06-08'],
        ['风机025号', 'B', '温度异常', '72', '70', '', '导热硅脂', '1', 'HT-90', '状态监测', '待复核', '', '', '', '2026-06-09'],
        ['FD-012', 'A', '叶根弯矩', '92', '80', '90', '叶根衬套', '2', 'L-200', 'SCADA日报', '待复核', '阿敏', '超出临时阈值，需更换', '建议停机', '2026-06-09'],
        ['BLD-033', 'C', '前缘腐蚀', '3级', '2级', '', '前缘修复材料', '1', 'EP-400', '无人机巡检', '待复核', '', '已标红', '', '2026-06-10'],
    ]
    batch_id = f"B{datetime.now().strftime('%Y%m%d%H%M%S')}"
    r, _ = _do_import(headers, sample_rows, 'DEMO模拟数据', '阿敏', batch_id)
    return jsonify(r)


# ========== 前端入口 ==========
@app.route('/')
def index():
    return send_file(os.path.join(BASE_DIR, 'static', 'index.html'))


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)
else:
    init_db()
