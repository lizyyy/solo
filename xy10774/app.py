from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import json
import os
import pandas as pd
from io import BytesIO

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

DATA_DIR = 'data'
DB_FILE = os.path.join(DATA_DIR, 'database.json')
EXPORT_DIR = os.path.join(DATA_DIR, 'exports')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)


def load_database():
    if os.path.exists(DB_FILE):
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        'tasks': [],
        'rollback_history': [],
        'audit_logs': []
    }


def save_database(db):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=2)


def init_sample_data():
    db = load_database()
    if len(db['tasks']) > 0:
        return
    
    sample_tasks = [
        {
            'id': 'TASK-001',
            'name': '首页Chrome兼容性测试',
            'target_url': 'https://example.com/home',
            'browser_matrix': ['Chrome-118', 'Firefox-119', 'Safari-17'],
            'status': 'diff_detected',
            'original_input': '<html><head><title>Home</title></head><body>Home Content</body></html>',
            'processed_result': '<html><head><title>Home</title></head><body>Modified Content</body></html>',
            'diff_regions': [
                {
                    'region_id': 'R001',
                    'selector': '.header-nav',
                    'description': '导航栏高度不一致，Chrome比Firefox高2px',
                    'severity': 'high',
                    'intercepted': True,
                    'human_confirmed': False
                },
                {
                    'region_id': 'R002',
                    'selector': '.footer-links',
                    'description': '底部链接颜色差异',
                    'severity': 'low',
                    'intercepted': False,
                    'human_confirmed': True,
                    'confirmed_by': 'admin',
                    'confirmed_at': '2024-05-10 14:30:00'
                }
            ],
            'report_id': 'REP-001',
            'created_at': '2024-05-14 10:00:00',
            'error_reason': None,
            'rollback_count': 0
        },
        {
            'id': 'TASK-002',
            'name': '商品页面Safari布局测试',
            'target_url': 'https://example.com/products',
            'browser_matrix': ['Safari-16', 'Safari-17'],
            'status': 'success',
            'original_input': '<html><body>Products</body></html>',
            'processed_result': '<html><body>Products</body></html>',
            'diff_regions': [],
            'report_id': 'REP-002',
            'created_at': '2024-05-13 09:00:00',
            'error_reason': None,
            'rollback_count': 1
        },
        {
            'id': 'TASK-003',
            'name': '登录页脏数据测试',
            'target_url': 'https://example.com/login',
            'browser_matrix': ['Chrome-118', 'Edge-118'],
            'status': 'error',
            'original_input': '<html><body>Login {{invalid_template</body></html>',
            'processed_result': None,
            'diff_regions': [],
            'report_id': None,
            'created_at': '2024-05-12 15:00:00',
            'error_reason': 'HTML模板解析失败：语法错误，未闭合的模板标签',
            'rollback_count': 0
        },
        {
            'id': 'TASK-004',
            'name': '结算页多浏览器测试',
            'target_url': 'https://example.com/checkout',
            'browser_matrix': ['Chrome-118', 'Firefox-119', 'Safari-17', 'Edge-118'],
            'status': 'pending_manual',
            'original_input': '<html><body>Checkout Form</body></html>',
            'processed_result': '<html><body>Checkout Form Modified</body></html>',
            'diff_regions': [
                {
                    'region_id': 'R003',
                    'selector': '.payment-button',
                    'description': '支付按钮在Safari下宽度异常',
                    'severity': 'critical',
                    'intercepted': True,
                    'human_confirmed': False
                }
            ],
            'report_id': 'REP-003',
            'created_at': '2024-05-14 11:00:00',
            'error_reason': None,
            'rollback_count': 0
        }
    ]
    
    sample_rollbacks = [
        {
            'id': 'RB-001',
            'task_id': 'TASK-002',
            'operator': 'admin',
            'reason': '布局回归测试失败',
            'timestamp': '2024-05-13 10:30:00'
        }
    ]
    
    sample_audits = [
        {
            'id': 'AUD-001',
            'action': 'manual_confirm',
            'task_id': 'TASK-001',
            'region_id': 'R002',
            'operator': 'admin',
            'timestamp': '2024-05-10 14:30:00',
            'details': '确认底部链接颜色差异为预期设计变更'
        }
    ]
    
    db['tasks'] = sample_tasks
    db['rollback_history'] = sample_rollbacks
    db['audit_logs'] = sample_audits
    save_database(db)


init_sample_data()


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    db = load_database()
    status_filter = request.args.get('status')
    tasks = db['tasks']
    if status_filter:
        tasks = [t for t in tasks if t['status'] == status_filter]
    return jsonify({'success': True, 'data': tasks})


@app.route('/api/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    db = load_database()
    task = next((t for t in db['tasks'] if t['id'] == task_id), None)
    if not task:
        return jsonify({'success': False, 'error': 'Task not found'}), 404
    return jsonify({'success': True, 'data': task})


@app.route('/api/tasks/<task_id>/retry', methods=['POST'])
def retry_task(task_id):
    db = load_database()
    task = next((t for t in db['tasks'] if t['id'] == task_id), None)
    if not task:
        return jsonify({'success': False, 'error': 'Task not found'}), 404
    
    task['status'] = 'processing'
    task['error_reason'] = None
    save_database(db)
    
    audit_log = {
        'id': f'AUD-{len(db["audit_logs"]) + 1:03d}',
        'action': 'retry',
        'task_id': task_id,
        'operator': 'system',
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'details': '任务重试启动'
    }
    db['audit_logs'].append(audit_log)
    save_database(db)
    
    return jsonify({'success': True, 'data': task})


@app.route('/api/tasks/<task_id>/rollback', methods=['POST'])
def rollback_task(task_id):
    data = request.get_json()
    operator = data.get('operator', 'unknown')
    reason = data.get('reason', '')
    
    db = load_database()
    task = next((t for t in db['tasks'] if t['id'] == task_id), None)
    if not task:
        return jsonify({'success': False, 'error': 'Task not found'}), 404
    
    task['status'] = 'rolled_back'
    task['rollback_count'] = task.get('rollback_count', 0) + 1
    
    rollback_record = {
        'id': f'RB-{len(db["rollback_history"]) + 1:03d}',
        'task_id': task_id,
        'operator': operator,
        'reason': reason,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    db['rollback_history'].append(rollback_record)
    
    audit_log = {
        'id': f'AUD-{len(db["audit_logs"]) + 1:03d}',
        'action': 'rollback',
        'task_id': task_id,
        'operator': operator,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'details': f'回滚原因: {reason}'
    }
    db['audit_logs'].append(audit_log)
    
    save_database(db)
    
    return jsonify({'success': True, 'data': rollback_record})


@app.route('/api/tasks/<task_id>/confirm', methods=['POST'])
def confirm_diff(task_id):
    data = request.get_json()
    region_id = data.get('region_id')
    operator = data.get('operator', 'unknown')
    notes = data.get('notes', '')
    
    db = load_database()
    task = next((t for t in db['tasks'] if t['id'] == task_id), None)
    if not task:
        return jsonify({'success': False, 'error': 'Task not found'}), 404
    
    region = next((r for r in task['diff_regions'] if r['region_id'] == region_id), None)
    if not region:
        return jsonify({'success': False, 'error': 'Region not found'}), 404
    
    region['human_confirmed'] = True
    region['confirmed_by'] = operator
    region['confirmed_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    region['notes'] = notes
    
    all_confirmed = all(r.get('human_confirmed', False) for r in task['diff_regions'])
    if all_confirmed:
        task['status'] = 'confirmed'
    
    audit_log = {
        'id': f'AUD-{len(db["audit_logs"]) + 1:03d}',
        'action': 'manual_confirm',
        'task_id': task_id,
        'region_id': region_id,
        'operator': operator,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'details': notes
    }
    db['audit_logs'].append(audit_log)
    
    save_database(db)
    
    return jsonify({'success': True, 'data': task})


@app.route('/api/rollbacks', methods=['GET'])
def get_rollbacks():
    db = load_database()
    return jsonify({'success': True, 'data': db['rollback_history']})


@app.route('/api/audit', methods=['GET'])
def get_audit_logs():
    db = load_database()
    return jsonify({'success': True, 'data': db['audit_logs']})


@app.route('/api/reconcile', methods=['GET'])
def reconcile():
    db = load_database()
    tasks = db['tasks']
    
    stats = {
        'total': len(tasks),
        'success': len([t for t in tasks if t['status'] == 'success']),
        'diff_detected': len([t for t in tasks if t['status'] == 'diff_detected']),
        'error': len([t for t in tasks if t['status'] == 'error']),
        'rolled_back': len([t for t in tasks if t['status'] == 'rolled_back']),
        'pending_manual': len([t for t in tasks if t['status'] == 'pending_manual']),
        'confirmed': len([t for t in tasks if t['status'] == 'confirmed']),
    }
    
    diff_regions_count = sum(len(t.get('diff_regions', [])) for t in tasks)
    intercepted_count = sum(
        1 for t in tasks for r in t.get('diff_regions', [])
        if r.get('intercepted', False)
    )
    confirmed_count = sum(
        1 for t in tasks for r in t.get('diff_regions', [])
        if r.get('human_confirmed', False)
    )
    
    stats['diff_regions_total'] = diff_regions_count
    stats['diff_regions_intercepted'] = intercepted_count
    stats['diff_regions_confirmed'] = confirmed_count
    
    return jsonify({'success': True, 'data': stats})


@app.route('/api/export', methods=['GET'])
def export_report():
    db = load_database()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'compatibility_report_{timestamp}.xlsx'
    filepath = os.path.join(EXPORT_DIR, filename)
    
    tasks_df = pd.DataFrame(db['tasks'])
    rollbacks_df = pd.DataFrame(db['rollback_history'])
    audits_df = pd.DataFrame(db['audit_logs'])
    
    diff_regions = []
    for task in db['tasks']:
        for region in task.get('diff_regions', []):
            region['task_id'] = task['id']
            region['task_name'] = task['name']
            diff_regions.append(region)
    diffs_df = pd.DataFrame(diff_regions) if diff_regions else pd.DataFrame()
    
    with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
        tasks_df.to_excel(writer, sheet_name='Tasks', index=False)
        diffs_df.to_excel(writer, sheet_name='Diff Regions', index=False)
        rollbacks_df.to_excel(writer, sheet_name='Rollbacks', index=False)
        audits_df.to_excel(writer, sheet_name='Audit Logs', index=False)
    
    return jsonify({
        'success': True,
        'data': {
            'filename': filename,
            'download_url': f'/download/{filename}'
        }
    })


@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    return send_from_directory(EXPORT_DIR, filename, as_attachment=True)


if __name__ == '__main__':
    app.run(debug=True, port=5001)
