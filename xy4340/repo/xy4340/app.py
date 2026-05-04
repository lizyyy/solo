from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import sqlite3
import json
import csv
import os
from datetime import datetime
from io import StringIO, BytesIO

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

DATABASE = 'observations.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS observation_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            type TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT,
            ra TEXT,
            dec TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(name, ra, dec)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS exposure_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            observation_point_id INTEGER,
            device_id INTEGER,
            target_id INTEGER,
            observation_date TEXT NOT NULL,
            observation_time TEXT NOT NULL,
            cloud_cover REAL DEFAULT 0.0,
            seeing REAL DEFAULT 5.0,
            device_battery REAL DEFAULT 100.0,
            exposure_plan TEXT,
            actual_files TEXT,
            status TEXT DEFAULT 'pending',
            risk_flags TEXT,
            notes TEXT,
            reviewed_by TEXT,
            reviewed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (observation_point_id) REFERENCES observation_points (id),
            FOREIGN KEY (device_id) REFERENCES devices (id),
            FOREIGN KEY (target_id) REFERENCES targets (id)
        )
    ''')
    
    conn.commit()
    conn.close()

RISK_CONFIG = {
    'max_cloud_cover': 30.0,
    'min_battery': 20.0,
}

def detect_risks(batch_data, existing_batches=None):
    risks = []
    
    if batch_data.get('cloud_cover', 0) > RISK_CONFIG['max_cloud_cover']:
        risks.append({
            'type': 'cloud_cover_exceeded',
            'message': f"云量超标: {batch_data.get('cloud_cover', 0)}% > {RISK_CONFIG['max_cloud_cover']}%",
            'severity': 'high'
        })
    
    if batch_data.get('device_battery', 100) < RISK_CONFIG['min_battery']:
        risks.append({
            'type': 'battery_low',
            'message': f"设备电量不足: {batch_data.get('device_battery', 100)}% < {RISK_CONFIG['min_battery']}%",
            'severity': 'medium'
        })
    
    if existing_batches:
        target_id = batch_data.get('target_id')
        if target_id:
            same_target_batches = [b for b in existing_batches if b['target_id'] == target_id]
            if len(same_target_batches) > 0:
                risks.append({
                    'type': 'duplicate_target',
                    'message': f"目标重复拍摄: 已存在 {len(same_target_batches)} 条相同目标记录",
                    'severity': 'low'
                })
    
    actual_files = batch_data.get('actual_files', '')
    if not actual_files or actual_files.strip() == '':
        risks.append({
            'type': 'files_missing',
            'message': "实际拍摄文件缺失",
            'severity': 'high'
        })
    
    return risks

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/observation-points', methods=['GET', 'POST'])
def observation_points():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        try:
            cursor.execute(
                'INSERT INTO observation_points (name, description) VALUES (?, ?)',
                (data.get('name'), data.get('description'))
            )
            conn.commit()
            point_id = cursor.lastrowid
            conn.close()
            return jsonify({'id': point_id, 'name': data.get('name')}), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': '观测点名称已存在'}), 400
    
    cursor.execute('SELECT * FROM observation_points ORDER BY name')
    points = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(points)

@app.route('/api/devices', methods=['GET', 'POST'])
def devices():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        try:
            cursor.execute(
                'INSERT INTO devices (name, type, description) VALUES (?, ?, ?)',
                (data.get('name'), data.get('type'), data.get('description'))
            )
            conn.commit()
            device_id = cursor.lastrowid
            conn.close()
            return jsonify({'id': device_id, 'name': data.get('name')}), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': '设备名称已存在'}), 400
    
    cursor.execute('SELECT * FROM devices ORDER BY name')
    devices_list = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(devices_list)

@app.route('/api/targets', methods=['GET', 'POST'])
def targets():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        try:
            cursor.execute(
                'INSERT INTO targets (name, type, ra, dec, description) VALUES (?, ?, ?, ?, ?)',
                (data.get('name'), data.get('type'), data.get('ra'), data.get('dec'), data.get('description'))
            )
            conn.commit()
            target_id = cursor.lastrowid
            conn.close()
            return jsonify({'id': target_id, 'name': data.get('name')}), 201
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': '目标已存在'}), 400
    
    cursor.execute('SELECT * FROM targets ORDER BY name')
    targets_list = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(targets_list)

@app.route('/api/exposure-batches', methods=['GET', 'POST'])
def exposure_batches():
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'POST':
        data = request.json
        
        cursor.execute('SELECT id, target_id FROM exposure_batches')
        existing_batches = [dict(row) for row in cursor.fetchall()]
        
        risks = detect_risks(data, existing_batches)
        risk_flags = json.dumps(risks, ensure_ascii=False) if risks else None
        
        cursor.execute('''
            INSERT INTO exposure_batches 
            (observation_point_id, device_id, target_id, observation_date, observation_time,
             cloud_cover, seeing, device_battery, exposure_plan, actual_files, status, risk_flags, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('observation_point_id'),
            data.get('device_id'),
            data.get('target_id'),
            data.get('observation_date'),
            data.get('observation_time'),
            data.get('cloud_cover'),
            data.get('seeing'),
            data.get('device_battery'),
            data.get('exposure_plan'),
            data.get('actual_files'),
            'pending',
            risk_flags,
            data.get('notes')
        ))
        conn.commit()
        batch_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': batch_id, 'risks': risks}), 201
    
    cursor.execute('''
        SELECT eb.*, 
               op.name as observation_point_name,
               d.name as device_name,
               t.name as target_name, t.ra as target_ra, t.dec as target_dec
        FROM exposure_batches eb
        LEFT JOIN observation_points op ON eb.observation_point_id = op.id
        LEFT JOIN devices d ON eb.device_id = d.id
        LEFT JOIN targets t ON eb.target_id = t.id
        ORDER BY eb.observation_date DESC, eb.observation_time DESC
    ''')
    batches = [dict(row) for row in cursor.fetchall()]
    
    for batch in batches:
        if batch.get('risk_flags'):
            try:
                batch['risk_flags'] = json.loads(batch['risk_flags'])
            except:
                batch['risk_flags'] = None
    
    conn.close()
    return jsonify(batches)

@app.route('/api/exposure-batches/<int:batch_id>', methods=['PUT', 'GET'])
def update_batch(batch_id):
    conn = get_db()
    cursor = conn.cursor()
    
    if request.method == 'GET':
        cursor.execute('''
            SELECT eb.*, 
                   op.name as observation_point_name,
                   d.name as device_name,
                   t.name as target_name, t.ra as target_ra, t.dec as target_dec
            FROM exposure_batches eb
            LEFT JOIN observation_points op ON eb.observation_point_id = op.id
            LEFT JOIN devices d ON eb.device_id = d.id
            LEFT JOIN targets t ON eb.target_id = t.id
            WHERE eb.id = ?
        ''', (batch_id,))
        batch = cursor.fetchone()
        if batch:
            batch = dict(batch)
            if batch.get('risk_flags'):
                try:
                    batch['risk_flags'] = json.loads(batch['risk_flags'])
                except:
                    batch['risk_flags'] = None
            conn.close()
            return jsonify(batch)
        conn.close()
        return jsonify({'error': '记录不存在'}), 404
    
    data = request.json
    
    cursor.execute('SELECT id, target_id FROM exposure_batches WHERE id != ?', (batch_id,))
    existing_batches = [dict(row) for row in cursor.fetchall()]
    
    risks = detect_risks(data, existing_batches)
    risk_flags = json.dumps(risks, ensure_ascii=False) if risks else None
    
    update_fields = []
    update_values = []
    
    field_mapping = {
        'observation_point_id': 'observation_point_id',
        'device_id': 'device_id',
        'target_id': 'target_id',
        'observation_date': 'observation_date',
        'observation_time': 'observation_time',
        'cloud_cover': 'cloud_cover',
        'seeing': 'seeing',
        'device_battery': 'device_battery',
        'exposure_plan': 'exposure_plan',
        'actual_files': 'actual_files',
        'status': 'status',
        'notes': 'notes',
        'reviewed_by': 'reviewed_by'
    }
    
    for key, db_field in field_mapping.items():
        if key in data:
            update_fields.append(f'{db_field} = ?')
            update_values.append(data[key])
    
    update_fields.append('risk_flags = ?')
    update_values.append(risk_flags)
    
    if 'status' in data:
        update_fields.append('reviewed_at = ?')
        update_values.append(datetime.now().isoformat())
    
    update_values.append(batch_id)
    
    query = f'UPDATE exposure_batches SET {", ".join(update_fields)} WHERE id = ?'
    cursor.execute(query, update_values)
    conn.commit()
    
    affected = cursor.rowcount
    conn.close()
    
    if affected > 0:
        return jsonify({'success': True, 'risks': risks})
    return jsonify({'error': '记录不存在'}), 404

@app.route('/api/import/csv', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': '未上传文件'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400
    
    if not file.filename.endswith('.csv'):
        return jsonify({'error': '请上传CSV文件'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        stream = StringIO(file.read().decode('utf-8-sig'))
        reader = csv.DictReader(stream)
        
        imported_count = 0
        errors = []
        
        for row_num, row in enumerate(reader, start=2):
            try:
                op_name = row.get('观测点名称', '').strip()
                if op_name:
                    cursor.execute('SELECT id FROM observation_points WHERE name = ?', (op_name,))
                    op_result = cursor.fetchone()
                    if op_result:
                        observation_point_id = op_result[0]
                    else:
                        cursor.execute('INSERT INTO observation_points (name) VALUES (?)', (op_name,))
                        observation_point_id = cursor.lastrowid
                else:
                    observation_point_id = None
                
                device_name = row.get('设备名称', '').strip()
                if device_name:
                    cursor.execute('SELECT id FROM devices WHERE name = ?', (device_name,))
                    d_result = cursor.fetchone()
                    if d_result:
                        device_id = d_result[0]
                    else:
                        cursor.execute('INSERT INTO devices (name) VALUES (?)', (device_name,))
                        device_id = cursor.lastrowid
                else:
                    device_id = None
                
                target_name = row.get('目标名称', '').strip()
                target_ra = row.get('目标赤经', '').strip()
                target_dec = row.get('目标赤纬', '').strip()
                
                if target_name:
                    cursor.execute('''
                        SELECT id FROM targets WHERE name = ? AND ra = ? AND dec = ?
                    ''', (target_name, target_ra, target_dec))
                    t_result = cursor.fetchone()
                    if t_result:
                        target_id = t_result[0]
                    else:
                        cursor.execute('''
                            INSERT INTO targets (name, ra, dec) VALUES (?, ?, ?)
                        ''', (target_name, target_ra, target_dec))
                        target_id = cursor.lastrowid
                else:
                    target_id = None
                
                observation_date = row.get('观测日期', '').strip()
                observation_time = row.get('观测时间', '').strip()
                
                try:
                    cloud_cover = float(row.get('云量(%)', 0))
                except:
                    cloud_cover = 0.0
                
                try:
                    seeing = float(row.get('视宁度', 5.0))
                except:
                    seeing = 5.0
                
                try:
                    device_battery = float(row.get('设备电量(%)', 100))
                except:
                    device_battery = 100.0
                
                exposure_plan = row.get('曝光计划', '').strip()
                actual_files = row.get('实际文件路径', '').strip()
                notes = row.get('备注', '').strip()
                
                cursor.execute('SELECT id, target_id FROM exposure_batches')
                existing_batches = [dict(r) for r in cursor.fetchall()]
                
                batch_data = {
                    'observation_point_id': observation_point_id,
                    'device_id': device_id,
                    'target_id': target_id,
                    'observation_date': observation_date,
                    'observation_time': observation_time,
                    'cloud_cover': cloud_cover,
                    'seeing': seeing,
                    'device_battery': device_battery,
                    'exposure_plan': exposure_plan,
                    'actual_files': actual_files,
                    'notes': notes
                }
                
                risks = detect_risks(batch_data, existing_batches)
                risk_flags = json.dumps(risks, ensure_ascii=False) if risks else None
                
                cursor.execute('''
                    INSERT INTO exposure_batches 
                    (observation_point_id, device_id, target_id, observation_date, observation_time,
                     cloud_cover, seeing, device_battery, exposure_plan, actual_files, status, risk_flags, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    observation_point_id, device_id, target_id, observation_date, observation_time,
                    cloud_cover, seeing, device_battery, exposure_plan, actual_files, 'pending', risk_flags, notes
                ))
                
                imported_count += 1
            except Exception as e:
                errors.append(f'第 {row_num} 行: {str(e)}')
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'imported_count': imported_count,
            'errors': errors
        })
        
    except Exception as e:
        conn.close()
        return jsonify({'error': f'导入失败: {str(e)}'}), 500

@app.route('/api/export/markdown', methods=['GET'])
def export_markdown():
    conn = get_db()
    cursor = conn.cursor()
    
    status_filter = request.args.get('status', 'all')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    
    query = '''
        SELECT eb.*, 
               op.name as observation_point_name,
               d.name as device_name,
               t.name as target_name, t.ra as target_ra, t.dec as target_dec
        FROM exposure_batches eb
        LEFT JOIN observation_points op ON eb.observation_point_id = op.id
        LEFT JOIN devices d ON eb.device_id = d.id
        LEFT JOIN targets t ON eb.target_id = t.id
        WHERE 1=1
    '''
    params = []
    
    if status_filter != 'all':
        query += ' AND eb.status = ?'
        params.append(status_filter)
    
    if date_from:
        query += ' AND eb.observation_date >= ?'
        params.append(date_from)
    
    if date_to:
        query += ' AND eb.observation_date <= ?'
        params.append(date_to)
    
    query += ' ORDER BY eb.observation_date DESC, eb.observation_time DESC'
    
    cursor.execute(query, params)
    batches = [dict(row) for row in cursor.fetchall()]
    
    for batch in batches:
        if batch.get('risk_flags'):
            try:
                batch['risk_flags'] = json.loads(batch['risk_flags'])
            except:
                batch['risk_flags'] = None
    
    conn.close()
    
    status_names = {
        'pending': '待复核',
        'approved': '已通过',
        'rejected': '已驳回',
        'needs_review': '需重新复核'
    }
    
    risk_severity = {
        'high': '高',
        'medium': '中',
        'low': '低'
    }
    
    markdown = f'''# 夜巡观测简报

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 统计概览

- 总记录数: {len(batches)}
- 待复核: {len([b for b in batches if b['status'] == 'pending'])}
- 已通过: {len([b for b in batches if b['status'] == 'approved'])}
- 已驳回: {len([b for b in batches if b['status'] == 'rejected'])}
- 需重新复核: {len([b for b in batches if b['status'] == 'needs_review'])}

---

## 观测记录详情

'''
    
    for i, batch in enumerate(batches, 1):
        markdown += f'''### 记录 {i}: {batch.get('target_name', '未知目标')}

| 项目 | 内容 |
|------|------|
| 观测日期 | {batch.get('observation_date', '-')} |
| 观测时间 | {batch.get('observation_time', '-')} |
| 观测点 | {batch.get('observation_point_name', '-')} |
| 设备 | {batch.get('device_name', '-')} |
| 目标 | {batch.get('target_name', '-')} |
| 赤经 | {batch.get('target_ra', '-')} |
| 赤纬 | {batch.get('target_dec', '-')} |
| 云量 | {batch.get('cloud_cover', 0)}% |
| 视宁度 | {batch.get('seeing', '-')} |
| 设备电量 | {batch.get('device_battery', 0)}% |
| 状态 | {status_names.get(batch.get('status', 'pending'), '未知')} |

'''
        
        if batch.get('exposure_plan'):
            markdown += f'''**曝光计划:**
{batch['exposure_plan']}

'''
        
        if batch.get('actual_files'):
            markdown += f'''**实际文件路径:**
{batch['actual_files']}

'''
        
        risks = batch.get('risk_flags')
        if risks:
            markdown += '**风险提示:**\n\n'
            for risk in risks:
                severity = risk_severity.get(risk.get('severity'), '未知')
                markdown += f'- **[{severity}风险]** {risk.get("message")}\n'
            markdown += '\n'
        
        if batch.get('notes'):
            markdown += f'**备注:** {batch["notes"]}\n\n'
        
        if batch.get('reviewed_by'):
            markdown += f'**复核人:** {batch["reviewed_by"]}\n'
        if batch.get('reviewed_at'):
            markdown += f'**复核时间:** {batch["reviewed_at"]}\n'
        
        markdown += '\n---\n\n'
    
    buffer = BytesIO()
    buffer.write(markdown.encode('utf-8'))
    buffer.seek(0)
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'夜巡观测简报_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md',
        mimetype='text/markdown'
    )

@app.route('/api/export/json', methods=['GET'])
def export_json():
    conn = get_db()
    cursor = conn.cursor()
    
    status_filter = request.args.get('status', 'all')
    date_from = request.args.get('date_from', '')
    date_to = request.args.get('date_to', '')
    
    query = '''
        SELECT eb.*, 
               op.name as observation_point_name,
               d.name as device_name,
               t.name as target_name, t.ra as target_ra, t.dec as target_dec
        FROM exposure_batches eb
        LEFT JOIN observation_points op ON eb.observation_point_id = op.id
        LEFT JOIN devices d ON eb.device_id = d.id
        LEFT JOIN targets t ON eb.target_id = t.id
        WHERE 1=1
    '''
    params = []
    
    if status_filter != 'all':
        query += ' AND eb.status = ?'
        params.append(status_filter)
    
    if date_from:
        query += ' AND eb.observation_date >= ?'
        params.append(date_from)
    
    if date_to:
        query += ' AND eb.observation_date <= ?'
        params.append(date_to)
    
    query += ' ORDER BY eb.observation_date DESC, eb.observation_time DESC'
    
    cursor.execute(query, params)
    batches = [dict(row) for row in cursor.fetchall()]
    
    for batch in batches:
        if batch.get('risk_flags'):
            try:
                batch['risk_flags'] = json.loads(batch['risk_flags'])
            except:
                batch['risk_flags'] = None
    
    cursor.execute('SELECT * FROM observation_points ORDER BY name')
    observation_points = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute('SELECT * FROM devices ORDER BY name')
    devices = [dict(row) for row in cursor.fetchall()]
    
    cursor.execute('SELECT * FROM targets ORDER BY name')
    targets = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    
    audit_data = {
        'export_time': datetime.now().isoformat(),
        'export_version': '1.0',
        'metadata': {
            'total_records': len(batches),
            'status_filter': status_filter,
            'date_from': date_from,
            'date_to': date_to
        },
        'reference_data': {
            'observation_points': observation_points,
            'devices': devices,
            'targets': targets
        },
        'exposure_batches': batches
    }
    
    json_content = json.dumps(audit_data, ensure_ascii=False, indent=2)
    
    buffer = BytesIO()
    buffer.write(json_content.encode('utf-8'))
    buffer.seek(0)
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'夜巡审计包_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
        mimetype='application/json'
    )

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) as count FROM observation_points')
    op_count = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM devices')
    device_count = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM targets')
    target_count = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count, status FROM exposure_batches GROUP BY status')
    status_counts = {row['status']: row['count'] for row in cursor.fetchall()}
    
    cursor.execute('''
        SELECT COUNT(*) as count FROM exposure_batches 
        WHERE risk_flags IS NOT NULL AND risk_flags != '[]'
    ''')
    risky_count = cursor.fetchone()['count']
    
    conn.close()
    
    return jsonify({
        'observation_points': op_count,
        'devices': device_count,
        'targets': target_count,
        'exposure_batches': {
            'total': sum(status_counts.values()),
            'pending': status_counts.get('pending', 0),
            'approved': status_counts.get('approved', 0),
            'rejected': status_counts.get('rejected', 0),
            'needs_review': status_counts.get('needs_review', 0),
            'with_risks': risky_count
        }
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=8080)
