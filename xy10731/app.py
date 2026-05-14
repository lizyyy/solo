from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime
import hashlib

app = Flask(__name__)
CORS(app)

DATA_DIR = 'data'
os.makedirs(DATA_DIR, exist_ok=True)

def load_json(filename):
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def generate_id():
    return hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:8]

def mask_sensitive(value):
    if not value or len(value) <= 4:
        return '****'
    return value[:2] + '****' + value[-2:]

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/projects', methods=['GET'])
def get_projects():
    projects = load_json('projects.json')
    return jsonify(list(projects.values()))

@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json
    projects = load_json('projects.json')
    project_id = generate_id()
    project = {
        'id': project_id,
        'name': data['name'],
        'description': data.get('description', ''),
        'created_at': datetime.now().isoformat(),
        'envs': {}
    }
    projects[project_id] = project
    save_json('projects.json', projects)
    return jsonify(project)

@app.route('/api/projects/<project_id>/envs', methods=['POST'])
def add_env(project_id):
    data = request.json
    projects = load_json('projects.json')
    if project_id not in projects:
        return jsonify({'error': 'Project not found'}), 404
    
    env_name = data['name']
    env_id = generate_id()
    env = {
        'id': env_id,
        'name': env_name,
        'variables': data.get('variables', {}),
        'created_at': datetime.now().isoformat()
    }
    projects[project_id]['envs'][env_id] = env
    save_json('projects.json', projects)
    
    drift_records = load_json('drift_records.json')
    baseline_changes = load_json('baseline_changes.json')
    recalculate_drifts(project_id, env_id, drift_records, baseline_changes)
    save_json('drift_records.json', drift_records)
    save_json('baseline_changes.json', baseline_changes)
    
    return jsonify(env)

@app.route('/api/projects/<project_id>/envs/<env_id>/baseline', methods=['PUT'])
def update_baseline(project_id, env_id):
    data = request.json
    projects = load_json('projects.json')
    if project_id not in projects or env_id not in projects[project_id]['envs']:
        return jsonify({'error': 'Env not found'}), 404
    
    old_vars = projects[project_id]['envs'][env_id]['variables'].copy()
    new_vars = data['variables']
    
    change_id = generate_id()
    change = {
        'id': change_id,
        'project_id': project_id,
        'env_id': env_id,
        'old_vars': old_vars,
        'new_vars': new_vars,
        'created_at': datetime.now().isoformat()
    }
    baseline_changes = load_json('baseline_changes.json')
    baseline_changes[change_id] = change
    save_json('baseline_changes.json', baseline_changes)
    
    projects[project_id]['envs'][env_id]['variables'] = new_vars
    save_json('projects.json', projects)
    
    drift_records = load_json('drift_records.json')
    recalculate_drifts(project_id, env_id, drift_records, baseline_changes)
    save_json('drift_records.json', drift_records)
    
    return jsonify({'success': True})

def recalculate_drifts(project_id, env_id, drift_records, baseline_changes):
    for record_id in drift_records:
        record = drift_records[record_id]
        if record['project_id'] == project_id and record['env_id'] == env_id:
            projects = load_json('projects.json')
            current_baseline = projects[project_id]['envs'][env_id]['variables']
            actual_vars = record['actual_variables']
            
            drifted_vars = {}
            for key in set(list(current_baseline.keys()) + list(actual_vars.keys())):
                baseline_val = current_baseline.get(key)
                actual_val = actual_vars.get(key)
                if baseline_val != actual_val:
                    drifted_vars[key] = {
                        'baseline': baseline_val,
                        'actual': actual_val,
                        'masked_baseline': mask_sensitive(str(baseline_val)),
                        'masked_actual': mask_sensitive(str(actual_val))
                    }
            
            record['drifted_variables'] = drifted_vars
            record['drift_count'] = len(drifted_vars)

@app.route('/api/detect', methods=['POST'])
def detect_drift():
    data = request.json
    project_id = data['project_id']
    env_id = data['env_id']
    actual_variables = data['actual_variables']
    
    projects = load_json('projects.json')
    if project_id not in projects or env_id not in projects[project_id]['envs']:
        return jsonify({'error': 'Env not found'}), 404
    
    baseline = projects[project_id]['envs'][env_id]['variables']
    
    drifted_vars = {}
    mask_failures = []
    for key in set(list(baseline.keys()) + list(actual_variables.keys())):
        baseline_val = baseline.get(key)
        actual_val = actual_variables.get(key)
        
        is_sensitive = key.lower() in ['password', 'secret', 'token', 'key', 'credential']
        
        if baseline_val != actual_val:
            drifted_vars[key] = {
                'baseline': baseline_val,
                'actual': actual_val,
                'masked_baseline': mask_sensitive(str(baseline_val)) if is_sensitive else str(baseline_val),
                'masked_actual': mask_sensitive(str(actual_val)) if is_sensitive else str(actual_val),
                'is_sensitive': is_sensitive
            }
            
            if is_sensitive:
                masked_actual = mask_sensitive(str(actual_val))
                if masked_actual == str(actual_val) or len(masked_actual.replace('*', '')) > 4:
                    mask_failures.append({
                        'key': key,
                        'value': actual_val,
                        'masked_value': masked_actual
                    })
    
    record_id = generate_id()
    record = {
        'id': record_id,
        'project_id': project_id,
        'env_id': env_id,
        'actual_variables': actual_variables,
        'drifted_variables': drifted_vars,
        'drift_count': len(drifted_vars),
        'status': 'pending',
        'mask_failures': mask_failures,
        'repair_request': None,
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat(),
        'timeline': [{
            'action': 'detected',
            'message': f'检测到 {len(drifted_vars)} 个变量漂移，{len(mask_failures)} 个敏感值遮罩失败',
            'created_at': datetime.now().isoformat()
        }]
    }
    
    drift_records = load_json('drift_records.json')
    drift_records[record_id] = record
    save_json('drift_records.json', drift_records)
    
    if mask_failures:
        return jsonify({
            'record_id': record_id,
            'warning': '检测到敏感值遮罩失败，请申请修复',
            'mask_failures': mask_failures,
            'drift_count': len(drifted_vars)
        })
    
    return jsonify({'record_id': record_id, 'drift_count': len(drifted_vars)})

@app.route('/api/drifts', methods=['GET'])
def get_drifts():
    records = load_json('drift_records.json')
    return jsonify(list(records.values()))

@app.route('/api/drifts/<record_id>', methods=['GET'])
def get_drift(record_id):
    records = load_json('drift_records.json')
    if record_id not in records:
        return jsonify({'error': 'Record not found'}), 404
    return jsonify(records[record_id])

@app.route('/api/drifts/<record_id>/approve', methods=['POST'])
def approve_drift(record_id):
    records = load_json('drift_records.json')
    if record_id not in records:
        return jsonify({'error': 'Record not found'}), 404
    
    if records[record_id]['status'] != 'pending':
        return jsonify({'error': 'Only pending records can be approved'}), 400
    
    records[record_id]['status'] = 'approved'
    records[record_id]['updated_at'] = datetime.now().isoformat()
    records[record_id]['timeline'].append({
        'action': 'approved',
        'message': '漂移已批准，允许继续推进',
        'created_at': datetime.now().isoformat()
    })
    save_json('drift_records.json', records)
    
    return jsonify({'success': True})

@app.route('/api/drifts/<record_id>/reject', methods=['POST'])
def reject_drift(record_id):
    records = load_json('drift_records.json')
    if record_id not in records:
        return jsonify({'error': 'Record not found'}), 404
    
    if records[record_id]['status'] != 'pending':
        return jsonify({'error': 'Only pending records can be rejected'}), 400
    
    data = request.json or {}
    reason = data.get('reason', '未提供理由')
    
    records[record_id]['status'] = 'rejected'
    records[record_id]['updated_at'] = datetime.now().isoformat()
    records[record_id]['timeline'].append({
        'action': 'rejected',
        'message': f'漂移被拒绝，理由：{reason}',
        'created_at': datetime.now().isoformat()
    })
    save_json('drift_records.json', records)
    
    return jsonify({'success': True})

@app.route('/api/drifts/<record_id>/repair-request', methods=['POST'])
def create_repair_request(record_id):
    records = load_json('drift_records.json')
    if record_id not in records:
        return jsonify({'error': 'Record not found'}), 404
    
    data = request.json
    records[record_id]['repair_request'] = {
        'reason': data['reason'],
        'status': 'pending',
        'handler': None,
        'handling_reason': None,
        'handled_at': None,
        'created_at': datetime.now().isoformat()
    }
    records[record_id]['updated_at'] = datetime.now().isoformat()
    records[record_id]['timeline'].append({
        'action': 'repair_requested',
        'message': f"提交修复申请：{data['reason']}",
        'created_at': datetime.now().isoformat()
    })
    save_json('drift_records.json', records)
    
    return jsonify({'success': True})

@app.route('/api/drifts/<record_id>/repair-request/handle', methods=['POST'])
def handle_repair_request(record_id):
    records = load_json('drift_records.json')
    if record_id not in records:
        return jsonify({'error': 'Record not found'}), 404
    
    if not records[record_id]['repair_request']:
        return jsonify({'error': 'No repair request found'}), 400
    
    data = request.json
    records[record_id]['repair_request']['status'] = data['status']
    records[record_id]['repair_request']['handler'] = data.get('handler', '系统管理员')
    records[record_id]['repair_request']['handling_reason'] = data.get('handling_reason', '')
    records[record_id]['repair_request']['handled_at'] = datetime.now().isoformat()
    records[record_id]['updated_at'] = datetime.now().isoformat()
    
    action = 'repair_approved' if data['status'] == 'approved' else 'repair_rejected'
    records[record_id]['timeline'].append({
        'action': action,
        'message': f"修复申请已{data['status'] == 'approved' and '通过' or '拒绝'}，处理理由：{data.get('handling_reason', '未提供')}",
        'created_at': datetime.now().isoformat()
    })
    save_json('drift_records.json', records)
    
    return jsonify({'success': True})

@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    records = load_json('drift_records.json')
    records_list = list(records.values())
    
    total = len(records_list)
    pending = sum(1 for r in records_list if r['status'] == 'pending')
    approved = sum(1 for r in records_list if r['status'] == 'approved')
    rejected = sum(1 for r in records_list if r['status'] == 'rejected')
    total_drifts = sum(r['drift_count'] for r in records_list)
    repair_requests = sum(1 for r in records_list if r['repair_request'])
    mask_failures = sum(len(r.get('mask_failures', [])) for r in records_list)
    
    return jsonify({
        'total_records': total,
        'pending': pending,
        'approved': approved,
        'rejected': rejected,
        'total_drifts': total_drifts,
        'repair_requests': repair_requests,
        'mask_failures': mask_failures
    })

@app.route('/api/baseline-changes', methods=['GET'])
def get_baseline_changes():
    changes = load_json('baseline_changes.json')
    return jsonify(list(changes.values()))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
