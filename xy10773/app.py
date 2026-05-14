from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
import json
import os
from datetime import datetime
from collections import defaultdict
import io
import csv

app = Flask(__name__)
CORS(app)

DATA_FILE = 'data.json'

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        'offline_queue': [],
        'cache_resources': [],
        'sync_conflicts': [],
        'retry_strategies': [],
        'user_hints': [],
        'sync_logs': []
    }

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    return send_file('index.html')

@app.route('/api/data', methods=['GET'])
def get_all_data():
    data = load_data()
    return jsonify(data)

@app.route('/api/offline-queue', methods=['GET'])
def get_offline_queue():
    data = load_data()
    search = request.args.get('search', '')
    queue = data['offline_queue']
    if search:
        queue = [q for q in queue if search.lower() in q.get('data', '').lower() or search.lower() in q.get('type', '').lower()]
    return jsonify(queue)

@app.route('/api/offline-queue', methods=['POST'])
def add_to_queue():
    data = load_data()
    items = request.json
    if not isinstance(items, list):
        items = [items]
    
    for item in items:
        item['id'] = len(data['offline_queue']) + 1
        item['status'] = 'pending'
        item['created_at'] = datetime.now().isoformat()
        data['offline_queue'].append(item)
    
    save_data(data)
    return jsonify({'success': True, 'count': len(items)})

@app.route('/api/validate-queue', methods=['POST'])
def validate_queue():
    data = load_data()
    queue_ids = request.json.get('ids', [])
    
    validated = []
    for item in data['offline_queue']:
        if item['id'] in queue_ids or not queue_ids:
            item['validated'] = True
            item['validated_at'] = datetime.now().isoformat()
            validated.append(item['id'])
    
    save_data(data)
    return jsonify({'success': True, 'validated_ids': validated})

@app.route('/api/sync-conflicts', methods=['GET'])
def get_sync_conflicts():
    data = load_data()
    return jsonify(data['sync_conflicts'])

@app.route('/api/sync-conflicts/<int:conflict_id>/resolve', methods=['POST'])
def resolve_conflict(conflict_id):
    data = load_data()
    resolution = request.json.get('resolution', 'server')
    
    for conflict in data['sync_conflicts']:
        if conflict['id'] == conflict_id:
            conflict['status'] = 'resolved'
            conflict['resolution'] = resolution
            conflict['resolved_at'] = datetime.now().isoformat()
            
            log_entry = {
                'id': len(data['sync_logs']) + 1,
                'type': 'conflict_resolved',
                'conflict_id': conflict_id,
                'resolution': resolution,
                'timestamp': datetime.now().isoformat(),
                'owner': request.json.get('owner', 'unknown')
            }
            data['sync_logs'].append(log_entry)
            break
    
    save_data(data)
    return jsonify({'success': True})

@app.route('/api/retry-strategies', methods=['GET'])
def get_retry_strategies():
    data = load_data()
    return jsonify(data['retry_strategies'])

@app.route('/api/retry', methods=['POST'])
def retry_item():
    data = load_data()
    queue_id = request.json.get('queue_id')
    reason = request.json.get('reason', '')
    
    for item in data['offline_queue']:
        if item['id'] == queue_id:
            item['retry_count'] = item.get('retry_count', 0) + 1
            item['last_retry_at'] = datetime.now().isoformat()
            item['last_failure_reason'] = reason
            
            strategy = {
                'id': len(data['retry_strategies']) + 1,
                'queue_id': queue_id,
                'retry_count': item['retry_count'],
                'failure_reason': reason,
                'timestamp': datetime.now().isoformat(),
                'next_retry_at': (datetime.fromisoformat(datetime.now().isoformat()) + __import__('datetime').timedelta(minutes=5)).isoformat()
            }
            data['retry_strategies'].append(strategy)
            break
    
    save_data(data)
    return jsonify({'success': True})

@app.route('/api/user-hints', methods=['GET'])
def get_user_hints():
    data = load_data()
    return jsonify(data['user_hints'])

@app.route('/api/user-hints', methods=['POST'])
def add_user_hint():
    data = load_data()
    hint = request.json
    hint['id'] = len(data['user_hints']) + 1
    hint['created_at'] = datetime.now().isoformat()
    hint['read'] = False
    data['user_hints'].append(hint)
    save_data(data)
    return jsonify({'success': True, 'hint': hint})

@app.route('/api/sync-logs', methods=['GET'])
def get_sync_logs():
    data = load_data()
    return jsonify(data['sync_logs'])

@app.route('/api/sync-logs/export', methods=['GET'])
def export_logs():
    data = load_data()
    logs = data['sync_logs']
    conflicts = data['sync_conflicts']
    
    conflict_map = {c['id']: c for c in conflicts}
    
    grouped = defaultdict(lambda: defaultdict(list))
    for log in logs:
        owner = log.get('owner', 'unknown')
        conflict_id = log.get('conflict_id')
        conflict = conflict_map.get(conflict_id, {})
        date = log.get('timestamp', '').split('T')[0]
        grouped[owner][date].append({
            'log_id': log['id'],
            'type': log.get('type'),
            'conflict_id': conflict_id,
            'conflict_type': conflict.get('type', ''),
            'resolution': log.get('resolution'),
            'timestamp': log.get('timestamp')
        })
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['负责人', '日期', '同步冲突ID', '冲突类型', '操作类型', '解决方式', '时间'])
    
    for owner, dates in grouped.items():
        for date, items in dates.items():
            for item in items:
                writer.writerow([
                    owner,
                    date,
                    item['conflict_id'],
                    item['conflict_type'],
                    item['type'],
                    item['resolution'],
                    item['timestamp']
                ])
    
    output.seek(0)
    mem = io.BytesIO()
    mem.write(output.getvalue().encode('utf-8-sig'))
    mem.seek(0)
    
    return send_file(
        mem,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'sync_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    )

@app.route('/api/cache-resources', methods=['GET'])
def get_cache_resources():
    data = load_data()
    return jsonify(data['cache_resources'])

@app.route('/api/init', methods=['POST'])
def init_data():
    initial_data = {
        'offline_queue': [
            {'id': 1, 'type': 'user_update', 'data': '{"name": "张三", "email": "zhang@example.com"}', 'status': 'pending', 'created_at': datetime.now().isoformat(), 'owner': '前端A'},
            {'id': 2, 'type': 'order_create', 'data': '{"product": "手机", "quantity": 2}', 'status': 'failed', 'created_at': datetime.now().isoformat(), 'owner': '前端B', 'retry_count': 1, 'last_failure_reason': '网络超时'},
            {'id': 3, 'type': 'profile_update', 'data': '{"avatar": "base64..."}', 'status': 'pending', 'created_at': datetime.now().isoformat(), 'owner': '前端A'},
        ],
        'cache_resources': [
            {'id': 1, 'url': '/static/js/app.js', 'size': 102400, 'cached_at': datetime.now().isoformat(), 'status': 'valid'},
            {'id': 2, 'url': '/static/css/style.css', 'size': 51200, 'cached_at': datetime.now().isoformat(), 'status': 'valid'},
            {'id': 3, 'url': '/api/config', 'size': 2048, 'cached_at': datetime.now().isoformat(), 'status': 'stale'},
        ],
        'sync_conflicts': [
            {'id': 1, 'type': 'data_version_conflict', 'queue_id': 1, 'server_version': 2, 'client_version': 1, 'status': 'pending', 'created_at': datetime.now().isoformat(), 'owner': '前端A'},
            {'id': 2, 'type': 'merge_conflict', 'queue_id': 3, 'server_data': '{}', 'client_data': '{}', 'status': 'pending', 'created_at': datetime.now().isoformat(), 'owner': '前端B'},
        ],
        'retry_strategies': [
            {'id': 1, 'queue_id': 2, 'retry_count': 1, 'failure_reason': '网络超时', 'timestamp': datetime.now().isoformat(), 'next_retry_at': (datetime.now() + __import__('datetime').timedelta(minutes=5)).isoformat()},
        ],
        'user_hints': [
            {'id': 1, 'message': '您有2个同步冲突需要处理', 'type': 'warning', 'created_at': datetime.now().isoformat(), 'read': False},
            {'id': 2, 'message': '离线队列中有3个项目等待同步', 'type': 'info', 'created_at': datetime.now().isoformat(), 'read': False},
        ],
        'sync_logs': [
            {'id': 1, 'type': 'conflict_resolved', 'conflict_id': 1, 'resolution': 'server', 'timestamp': datetime.now().isoformat(), 'owner': '前端A'},
            {'id': 2, 'type': 'sync_success', 'queue_id': 3, 'timestamp': datetime.now().isoformat(), 'owner': '前端B'},
            {'id': 3, 'type': 'sync_failed', 'queue_id': 2, 'timestamp': datetime.now().isoformat(), 'owner': '前端A'},
        ]
    }
    
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(initial_data, f, ensure_ascii=False, indent=2)
    
    return jsonify({'success': True})

@app.route('/api/blocked-operation', methods=['POST'])
def blocked_operation():
    rule = request.json.get('rule', '')
    return jsonify({
        'success': False,
        'blocked': True,
        'reason': f'操作被规则阻挡: {rule}',
        'rule': rule
    }), 403

if __name__ == '__main__':
    app.run(debug=True, port=5000)
