from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
import uuid
from datetime import datetime
from collections import defaultdict

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
BUILD_VERSIONS_FILE = os.path.join(DATA_DIR, 'build_versions.json')
INSPECTION_RECORDS_FILE = os.path.join(DATA_DIR, 'inspection_records.json')
TIMELINE_FILE = os.path.join(DATA_DIR, 'timeline.json')

os.makedirs(DATA_DIR, exist_ok=True)

def load_json(file_path, default=None):
    if default is None:
        default = []
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return default

def save_json(file_path, data):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def generate_id():
    return str(uuid.uuid4())[:8]

def get_current_time():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/build-versions', methods=['GET'])
def get_build_versions():
    versions = load_json(BUILD_VERSIONS_FILE)
    return jsonify(versions)

@app.route('/api/build-versions', methods=['POST'])
def create_build_version():
    data = request.json
    versions = load_json(BUILD_VERSIONS_FILE)
    
    build_id = generate_id()
    new_version = {
        'id': build_id,
        'version': data.get('version', ''),
        'project': data.get('project', ''),
        'buildTime': data.get('buildTime', get_current_time()),
        'assetSize': float(data.get('assetSize', 0)),
        'jsSize': float(data.get('jsSize', 0)),
        'cssSize': float(data.get('cssSize', 0)),
        'hasSourceMap': data.get('hasSourceMap', False),
        'status': 'pending',
        'createdAt': get_current_time(),
        'lockVersion': 0
    }
    
    versions.insert(0, new_version)
    save_json(BUILD_VERSIONS_FILE, versions)
    
    add_timeline(build_id, '版本录入', f'构建版本 {new_version["version"]} 已录入系统')
    
    return jsonify(new_version), 201

@app.route('/api/build-versions/<build_id>', methods=['PUT'])
def update_build_version(build_id):
    data = request.json
    versions = load_json(BUILD_VERSIONS_FILE)
    
    for version in versions:
        if version['id'] == build_id:
            if 'lockVersion' in data and data['lockVersion'] != version.get('lockVersion', 0):
                return jsonify({'error': '版本冲突，请刷新后重试'}), 409
            
            if 'status' in data:
                version['status'] = data['status']
            if 'hasSourceMap' in data:
                version['hasSourceMap'] = data['hasSourceMap']
            if 'cacheStrategy' in data:
                version['cacheStrategy'] = data['cacheStrategy']
            if 'rollbackReason' in data:
                version['rollbackReason'] = data['rollbackReason']
            if 'correctionPath' in data:
                version['correctionPath'] = data['correctionPath']
            
            version['lockVersion'] = version.get('lockVersion', 0) + 1
            version['updatedAt'] = get_current_time()
            
            save_json(BUILD_VERSIONS_FILE, versions)
            return jsonify(version)
    
    return jsonify({'error': '版本不存在'}), 404

@app.route('/api/build-versions/<build_id>/check-sourcemap', methods=['POST'])
def check_sourcemap(build_id):
    versions = load_json(BUILD_VERSIONS_FILE)
    
    for version in versions:
        if version['id'] == build_id:
            js_size = version.get('jsSize', 0)
            should_have_sourcemap = js_size > 500
            
            result = {
                'buildId': build_id,
                'jsSize': js_size,
                'shouldHaveSourceMap': should_have_sourcemap,
                'hasSourceMap': version.get('hasSourceMap', False),
                'passed': not should_have_sourcemap or version.get('hasSourceMap', False)
            }
            
            if result['passed']:
                version['status'] = 'sourcemap_checked'
                add_timeline(build_id, 'Source Map 检查通过', '资源体积符合要求，可继续推进')
            else:
                version['status'] = 'sourcemap_failed'
                add_timeline(build_id, 'Source Map 检查失败', 'JS资源体积较大但缺少Source Map')
            
            version['lockVersion'] = version.get('lockVersion', 0) + 1
            save_json(BUILD_VERSIONS_FILE, versions)
            
            return jsonify(result)
    
    return jsonify({'error': '版本不存在'}), 404

@app.route('/api/build-versions/<build_id>/check-cache', methods=['POST'])
def check_cache_strategy(build_id):
    versions = load_json(BUILD_VERSIONS_FILE)
    
    for version in versions:
        if version['id'] == build_id:
            cache_strategy = version.get('cacheStrategy', {})
            has_hash = cache_strategy.get('hasHash', False)
            cache_control = cache_strategy.get('cacheControl', '')
            
            cache_failed = not has_hash or 'max-age' not in cache_control
            
            if cache_failed:
                version['status'] = 'cache_failed'
                version['cacheStrategy']['failed'] = True
                add_timeline(build_id, '缓存策略检查失败', '缺少文件哈希或Cache-Control配置不当')
            else:
                version['status'] = 'cache_checked'
                add_timeline(build_id, '缓存策略检查通过', '缓存配置符合最佳实践')
            
            version['lockVersion'] = version.get('lockVersion', 0) + 1
            save_json(BUILD_VERSIONS_FILE, versions)
            
            return jsonify({
                'buildId': build_id,
                'cacheFailed': cache_failed,
                'hasHash': has_hash,
                'cacheControl': cache_control
            })
    
    return jsonify({'error': '版本不存在'}), 404

@app.route('/api/build-versions/<build_id>/rollback', methods=['POST'])
def rollback_build(build_id):
    data = request.json
    versions = load_json(BUILD_VERSIONS_FILE)
    
    for version in versions:
        if version['id'] == build_id:
            version['status'] = 'rolled_back'
            version['rollbackReason'] = data.get('reason', '')
            version['rollbackTime'] = get_current_time()
            version['lockVersion'] = version.get('lockVersion', 0) + 1
            
            save_json(BUILD_VERSIONS_FILE, versions)
            add_timeline(build_id, '回滚包介入', f'执行回滚，原因: {data.get("reason", "未说明")}')
            
            return jsonify(version)
    
    return jsonify({'error': '版本不存在'}), 404

@app.route('/api/build-versions/<build_id>/correct', methods=['POST'])
def correct_cache_issue(build_id):
    data = request.json
    versions = load_json(BUILD_VERSIONS_FILE)
    
    for version in versions:
        if version['id'] == build_id:
            version['status'] = 'corrected'
            version['correctionPath'] = {
                'action': data.get('action', ''),
                'description': data.get('description', ''),
                'appliedAt': get_current_time()
            }
            version['lockVersion'] = version.get('lockVersion', 0) + 1
            
            save_json(BUILD_VERSIONS_FILE, versions)
            add_timeline(build_id, '缓存问题修正', f'已应用修正方案: {data.get("action", "")}')
            
            return jsonify(version)
    
    return jsonify({'error': '版本不存在'}), 404

@app.route('/api/inspection-records', methods=['GET'])
def get_inspection_records():
    records = load_json(INSPECTION_RECORDS_FILE)
    return jsonify(records)

@app.route('/api/inspection-records', methods=['POST'])
def create_inspection_record():
    data = request.json
    records = load_json(INSPECTION_RECORDS_FILE)
    
    build_id = data.get('buildId')
    versions = load_json(BUILD_VERSIONS_FILE)
    version_info = next((v for v in versions if v['id'] == build_id), None)
    
    record_id = generate_id()
    new_record = {
        'id': record_id,
        'buildId': build_id,
        'version': version_info.get('version', '') if version_info else '',
        'project': version_info.get('project', '') if version_info else '',
        'inspector': data.get('inspector', ''),
        'result': data.get('result', ''),
        'issues': data.get('issues', []),
        'comments': data.get('comments', ''),
        'createdAt': get_current_time()
    }
    
    records.insert(0, new_record)
    save_json(INSPECTION_RECORDS_FILE, records)
    
    for version in versions:
        if version['id'] == build_id:
            version['status'] = 'inspected'
            version['lockVersion'] = version.get('lockVersion', 0) + 1
            save_json(BUILD_VERSIONS_FILE, versions)
            break
    
    add_timeline(build_id, '巡检完成', f'巡检人: {new_record["inspector"]}, 结果: {new_record["result"]}')
    
    return jsonify(new_record), 201

@app.route('/api/timeline/<build_id>', methods=['GET'])
def get_timeline(build_id):
    timelines = load_json(TIMELINE_FILE, {})
    return jsonify(timelines.get(build_id, []))

def add_timeline(build_id, event_type, description):
    timelines = load_json(TIMELINE_FILE, {})
    if build_id not in timelines:
        timelines[build_id] = []
    
    timelines[build_id].insert(0, {
        'id': generate_id(),
        'type': event_type,
        'description': description,
        'time': get_current_time()
    })
    
    save_json(TIMELINE_FILE, timelines)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    versions = load_json(BUILD_VERSIONS_FILE)
    records = load_json(INSPECTION_RECORDS_FILE)
    
    status_counts = defaultdict(int)
    for v in versions:
        status_counts[v['status']] += 1
    
    return jsonify({
        'totalBuilds': len(versions),
        'totalInspections': len(records),
        'statusCounts': dict(status_counts),
        'recentBuilds': versions[:5]
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
