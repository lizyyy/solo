from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
import os
import sqlite3
import pandas as pd
from datetime import datetime
import json
import hashlib

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'csv', 'xlsx', 'xls'}
app.config['DATABASE'] = 'community_bus.db'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('exports', exist_ok=True)


def get_db():
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inspection_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_row_number INTEGER,
            import_batch_id TEXT,
            import_time TIMESTAMP,
            point_id TEXT,
            point_name TEXT,
            address TEXT,
            longitude REAL,
            latitude REAL,
            street TEXT,
            community TEXT,
            inspector TEXT,
            inspection_time TIMESTAMP,
            original_conclusion TEXT,
            current_conclusion TEXT,
            status TEXT DEFAULT 'pending',
            is_boundary_point INTEGER DEFAULT 0,
            is_duplicate INTEGER DEFAULT 0,
            manual_edits TEXT DEFAULT '[]',
            construction_notice TEXT,
            reviewer TEXT,
            review_time TIMESTAMP,
            review_comment TEXT,
            data_hash TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS import_batches (
            batch_id TEXT PRIMARY KEY,
            filename TEXT,
            import_time TIMESTAMP,
            total_records INTEGER,
            duplicate_count INTEGER,
            boundary_count INTEGER,
            imported_by TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS change_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER,
            field_name TEXT,
            old_value TEXT,
            new_value TEXT,
            changed_by TEXT,
            change_time TIMESTAMP,
            change_reason TEXT
        )
    ''')

    conn.commit()
    conn.close()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']


def generate_data_hash(row_data):
    data_str = '|'.join(str(v) for v in row_data.values())
    return hashlib.md5(data_str.encode()).hexdigest()


def detect_boundary_point(address, street):
    boundary_keywords = ['交界', '边界', '路口', '交叉口', '转角', '边']
    address_lower = (address or '').lower()
    for keyword in boundary_keywords:
        if keyword in address_lower:
            return True
    if street and '、' in street:
        return True
    return False


def self_check_records(records_df, batch_id):
    issues = []
    seen_hashes = set()
    street_boundary = []

    for idx, row in records_df.iterrows():
        row_hash = generate_data_hash(row.to_dict())

        if row_hash in seen_hashes:
            issues.append({
                'row': idx + 2,
                'type': 'duplicate',
                'message': '该记录与已导入记录重复'
            })
        seen_hashes.add(row_hash)

        if detect_boundary_point(row.get('地址', ''), row.get('街道', '')):
            issues.append({
                'row': idx + 2,
                'type': 'boundary',
                'message': '点位位于两个街道边界，需项目经理复核'
            })
            street_boundary.append(idx)

    return issues


def process_import(file_path, filename):
    check_path = file_path or filename
    file_ext = os.path.splitext(check_path)[1].lower()
    if file_ext == '.csv':
        df = pd.read_csv(file_path)
    else:
        df = pd.read_excel(file_path, engine='openpyxl')

    batch_id = datetime.now().strftime('%Y%m%d%H%M%S')
    import_time = datetime.now()

    issues = self_check_records(df, batch_id)

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO import_batches 
        (batch_id, filename, import_time, total_records, duplicate_count, boundary_count, imported_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        batch_id,
        filename,
        import_time,
        len(df),
        sum(1 for i in issues if i['type'] == 'duplicate'),
        sum(1 for i in issues if i['type'] == 'boundary'),
        'system'
    ))

    seen_hashes = set()
    for idx, row in df.iterrows():
        row_data = row.to_dict()
        data_hash = generate_data_hash(row_data)
        is_duplicate = 1 if data_hash in seen_hashes else 0
        is_boundary = 1 if detect_boundary_point(row.get('地址', ''), row.get('街道', '')) else 0

        seen_hashes.add(data_hash)

        status = 'pending'
        if is_duplicate:
            status = 'duplicate'
        elif is_boundary:
            status = 'needs_review'

        cursor.execute('''
            INSERT INTO inspection_records
            (original_row_number, import_batch_id, import_time, point_id, point_name, address,
             longitude, latitude, street, community, inspector, inspection_time,
             original_conclusion, current_conclusion, status, is_boundary_point, is_duplicate, data_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            idx + 2,
            batch_id,
            import_time,
            row.get('点位编号', ''),
            row.get('点位名称', ''),
            row.get('地址', ''),
            row.get('经度', 0),
            row.get('纬度', 0),
            row.get('街道', ''),
            row.get('社区', ''),
            row.get('巡查员', ''),
            row.get('巡查时间', ''),
            row.get('巡查结论', ''),
            row.get('巡查结论', ''),
            status,
            is_boundary,
            is_duplicate,
            data_hash
        ))

    conn.commit()
    conn.close()

    return {
        'batch_id': batch_id,
        'total_records': len(df),
        'issues': issues,
        'duplicate_count': sum(1 for i in issues if i['type'] == 'duplicate'),
        'boundary_count': sum(1 for i in issues if i['type'] == 'boundary')
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/import', methods=['POST'])
def import_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400

    if file and allowed_file(file.filename):
        original_filename = file.filename
        file_ext = os.path.splitext(original_filename)[1].lower()
        safe_name = secure_filename(original_filename) or 'upload'
        if not os.path.splitext(safe_name)[1]:
            safe_name += file_ext
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], safe_name)
        file.save(filepath)

        result = process_import(filepath, original_filename)
        return jsonify(result)

    return jsonify({'error': '不支持的文件格式'}), 400


@app.route('/api/records', methods=['GET'])
def get_records():
    status = request.args.get('status', '')
    batch_id = request.args.get('batch_id', '')

    conn = get_db()
    cursor = conn.cursor()

    query = 'SELECT * FROM inspection_records WHERE 1=1'
    params = []

    if status:
        query += ' AND status = ?'
        params.append(status)
    if batch_id:
        query += ' AND import_batch_id = ?'
        params.append(batch_id)

    query += ' ORDER BY id DESC'

    cursor.execute(query, params)
    records = [dict(row) for row in cursor.fetchall()]

    for record in records:
        record['manual_edits'] = json.loads(record.get('manual_edits', '[]'))

    conn.close()
    return jsonify(records)


@app.route('/api/records/<int:record_id>', methods=['PUT'])
def update_record(record_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT * FROM inspection_records WHERE id = ?', (record_id,))
    record = cursor.fetchone()
    if not record:
        conn.close()
        return jsonify({'error': '记录不存在'}), 404

    record_dict = dict(record)
    manual_edits = json.loads(record_dict.get('manual_edits', '[]'))
    change_time = datetime.now().isoformat()

    update_fields = []
    update_params = []

    if 'current_conclusion' in data:
        old_val = record_dict['current_conclusion']
        new_val = data['current_conclusion']
        if old_val != new_val:
            manual_edits.append({
                'field': 'current_conclusion',
                'old_value': old_val,
                'new_value': new_val,
                'time': change_time,
                'user': data.get('user', 'unknown')
            })
            update_fields.append('current_conclusion = ?')
            update_params.append(new_val)

            cursor.execute('''
                INSERT INTO change_logs (record_id, field_name, old_value, new_value, changed_by, change_time, change_reason)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (record_id, 'current_conclusion', old_val, new_val,
                  data.get('user', 'unknown'), change_time, data.get('reason', '')))

    if 'construction_notice' in data:
        update_fields.append('construction_notice = ?')
        update_params.append(data['construction_notice'])
        manual_edits.append({
            'field': 'construction_notice',
            'new_value': data['construction_notice'],
            'time': change_time,
            'user': data.get('user', 'unknown')
        })

    if 'status' in data:
        update_fields.append('status = ?')
        update_params.append(data['status'])
        if data['status'] == 'reviewed':
            update_fields.append('reviewer = ?')
            update_params.append(data.get('user', 'unknown'))
            update_fields.append('review_time = ?')
            update_params.append(change_time)
            update_fields.append('review_comment = ?')
            update_params.append(data.get('review_comment', ''))

    if update_fields:
        update_fields.append('manual_edits = ?')
        update_params.append(json.dumps(manual_edits, ensure_ascii=False))
        update_params.append(record_id)

        cursor.execute(
            f'UPDATE inspection_records SET {", ".join(update_fields)} WHERE id = ?',
            update_params
        )
        conn.commit()

    conn.close()
    return jsonify({'success': True})


@app.route('/api/batches', methods=['GET'])
def get_batches():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM import_batches ORDER BY import_time DESC')
    batches = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(batches)


@app.route('/api/export', methods=['GET'])
def export_records():
    batch_id = request.args.get('batch_id', '')
    conn = get_db()

    query = '''
        SELECT 
            original_row_number as 原始行号,
            point_id as 点位编号,
            point_name as 点位名称,
            address as 地址,
            street as 街道,
            community as 社区,
            inspector as 巡查员,
            inspection_time as 巡查时间,
            original_conclusion as 原始结论,
            current_conclusion as 当前结论,
            status as 处理状态,
            is_boundary_point as 边界点位,
            is_duplicate as 重复记录,
            construction_notice as 施工告示,
            reviewer as 复核人,
            review_time as 复核时间,
            review_comment as 复核意见
        FROM inspection_records
    '''
    params = []
    if batch_id:
        query += ' WHERE import_batch_id = ?'
        params.append(batch_id)

    df = pd.read_sql_query(query, conn)

    export_time = datetime.now().strftime('%Y%m%d%H%M%S')
    export_path = f'exports/社区微循环公交_巡查表_{export_time}.xlsx'
    df.to_excel(export_path, index=False)

    conn.close()
    return send_file(export_path, as_attachment=True, download_name=f'社区微循环公交_巡查表_{export_time}.xlsx')


@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) as total FROM inspection_records')
    total = cursor.fetchone()['total']

    cursor.execute("SELECT COUNT(*) as pending FROM inspection_records WHERE status = 'pending'")
    pending = cursor.fetchone()['pending']

    cursor.execute("SELECT COUNT(*) as needs_review FROM inspection_records WHERE status = 'needs_review'")
    needs_review = cursor.fetchone()['needs_review']

    cursor.execute("SELECT COUNT(*) as reviewed FROM inspection_records WHERE status = 'reviewed'")
    reviewed = cursor.fetchone()['reviewed']

    cursor.execute("SELECT COUNT(*) as duplicate FROM inspection_records WHERE is_duplicate = 1")
    duplicate = cursor.fetchone()['duplicate']

    cursor.execute("SELECT COUNT(*) as boundary FROM inspection_records WHERE is_boundary_point = 1")
    boundary = cursor.fetchone()['boundary']

    conn.close()

    return jsonify({
        'total': total,
        'pending': pending,
        'needs_review': needs_review,
        'reviewed': reviewed,
        'duplicate': duplicate,
        'boundary': boundary
    })


@app.route('/api/records/<int:record_id>/changes', methods=['GET'])
def get_record_changes(record_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM change_logs WHERE record_id = ? ORDER BY change_time DESC', (record_id,))
    changes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(changes)


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
