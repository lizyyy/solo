from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)

DATA_FILE = 'data.json'

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        'sessions': [],
        'events': [],
        'appeals': [],
        'reports': []
    }

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def calculate_abnormal_level(session_id, events):
    session_events = [e for e in events if e['session_id'] == session_id]
    screen_switch_count = len([e for e in session_events if e['event_type'] == 'screen_switch'])
    camera_off_duration = sum([e.get('duration', 0) for e in session_events if e['event_type'] == 'camera_off'])
    
    if screen_switch_count >= 5 or camera_off_duration >= 120:
        return 'critical'
    elif screen_switch_count >= 3 or camera_off_duration >= 60:
        return 'warning'
    elif screen_switch_count >= 1:
        return 'notice'
    return 'normal'

def recalculate_session_status(session_id):
    data = load_data()
    level = calculate_abnormal_level(session_id, data['events'])
    
    for session in data['sessions']:
        if session['id'] == session_id:
            session['abnormal_level'] = level
            session['status'] = 'failed' if level == 'critical' else 'warning' if level == 'warning' else 'normal'
            session['updated_at'] = datetime.now().isoformat()
            break
    
    save_data(data)

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    data = load_data()
    return jsonify(data['sessions'])

@app.route('/api/sessions', methods=['POST'])
def create_session():
    data = load_data()
    session_data = request.json
    session = {
        'id': str(uuid.uuid4()),
        'exam_id': session_data.get('exam_id'),
        'student_id': session_data.get('student_id'),
        'student_name': session_data.get('student_name'),
        'start_time': datetime.now().isoformat(),
        'status': 'ongoing',
        'abnormal_level': 'normal',
        'camera_status': 'on',
        'screen_switch_count': 0,
        'handler': None,
        'handled_at': None,
        'handle_reason': None,
        'updated_at': datetime.now().isoformat()
    }
    data['sessions'].append(session)
    save_data(data)
    return jsonify(session), 201

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    data = load_data()
    session = next((s for s in data['sessions'] if s['id'] == session_id), None)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    return jsonify(session)

@app.route('/api/sessions/<session_id>/events', methods=['GET'])
def get_session_events(session_id):
    data = load_data()
    events = [e for e in data['events'] if e['session_id'] == session_id]
    return jsonify(events)

@app.route('/api/events', methods=['POST'])
def add_event():
    data = load_data()
    event_data = request.json
    event = {
        'id': str(uuid.uuid4()),
        'session_id': event_data.get('session_id'),
        'event_type': event_data.get('event_type'),
        'timestamp': datetime.now().isoformat(),
        'description': event_data.get('description'),
        'duration': event_data.get('duration', 0)
    }
    data['events'].append(event)
    
    session = next((s for s in data['sessions'] if s['id'] == event['session_id']), None)
    if session:
        if event['event_type'] == 'screen_switch':
            session['screen_switch_count'] += 1
        elif event['event_type'] == 'camera_off':
            session['camera_status'] = 'off'
        elif event['event_type'] == 'camera_on':
            session['camera_status'] = 'on'
    
    save_data(data)
    recalculate_session_status(event['session_id'])
    
    return jsonify(event), 201

@app.route('/api/sessions/<session_id>/handle', methods=['POST'])
def handle_session(session_id):
    data = load_data()
    handle_data = request.json
    
    session = next((s for s in data['sessions'] if s['id'] == session_id), None)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    session['handler'] = handle_data.get('handler')
    session['handled_at'] = datetime.now().isoformat()
    session['handle_reason'] = handle_data.get('reason')
    session['status'] = 'handled'
    session['updated_at'] = datetime.now().isoformat()
    
    save_data(data)
    return jsonify(session)

@app.route('/api/appeals', methods=['POST'])
def create_appeal():
    data = load_data()
    appeal_data = request.json
    
    appeal = {
        'id': str(uuid.uuid4()),
        'session_id': appeal_data.get('session_id'),
        'student_id': appeal_data.get('student_id'),
        'student_name': appeal_data.get('student_name'),
        'content': appeal_data.get('content'),
        'status': 'pending',
        'created_at': datetime.now().isoformat(),
        'handler': None,
        'handled_at': None,
        'handle_result': None,
        'handle_reason': None
    }
    data['appeals'].append(appeal)
    save_data(data)
    return jsonify(appeal), 201

@app.route('/api/appeals', methods=['GET'])
def get_appeals():
    data = load_data()
    return jsonify(data['appeals'])

@app.route('/api/appeals/<appeal_id>/handle', methods=['POST'])
def handle_appeal(appeal_id):
    data = load_data()
    handle_data = request.json
    
    appeal = next((a for a in data['appeals'] if a['id'] == appeal_id), None)
    if not appeal:
        return jsonify({'error': 'Appeal not found'}), 404
    
    appeal['handler'] = handle_data.get('handler')
    appeal['handled_at'] = datetime.now().isoformat()
    appeal['handle_result'] = handle_data.get('result')
    appeal['handle_reason'] = handle_data.get('reason')
    appeal['status'] = 'handled'
    save_data(data)
    return jsonify(appeal)

@app.route('/api/reports', methods=['POST'])
def generate_report():
    data = load_data()
    report_data = request.json
    session_id = report_data.get('session_id')
    
    session = next((s for s in data['sessions'] if s['id'] == session_id), None)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    events = [e for e in data['events'] if e['session_id'] == session_id]
    appeals = [a for a in data['appeals'] if a['session_id'] == session_id]
    
    report = {
        'id': str(uuid.uuid4()),
        'session_id': session_id,
        'student_name': session['student_name'],
        'student_id': session['student_id'],
        'exam_id': session['exam_id'],
        'abnormal_level': session['abnormal_level'],
        'screen_switch_count': session['screen_switch_count'],
        'events_count': len(events),
        'events': events,
        'appeals': appeals,
        'handler': session['handler'],
        'handled_at': session['handled_at'],
        'handle_reason': session['handle_reason'],
        'generated_at': datetime.now().isoformat()
    }
    data['reports'].append(report)
    save_data(data)
    return jsonify(report), 201

@app.route('/api/reports/<report_id>', methods=['GET'])
def get_report(report_id):
    data = load_data()
    report = next((r for r in data['reports'] if r['id'] == report_id), None)
    if not report:
        return jsonify({'error': 'Report not found'}), 404
    return jsonify(report)

@app.route('/api/sessions/<session_id>/recalculate', methods=['POST'])
def recalculate(session_id):
    recalculate_session_status(session_id)
    data = load_data()
    session = next((s for s in data['sessions'] if s['id'] == session_id), None)
    return jsonify(session)

def init_sample_data():
    if os.path.exists(DATA_FILE):
        return
    
    data = load_data()
    
    sample_sessions = [
        {
            'id': 'sess-001',
            'exam_id': 'exam-2024-001',
            'student_id': 'stu-1001',
            'student_name': '张三',
            'start_time': '2024-05-14T09:00:00',
            'status': 'failed',
            'abnormal_level': 'critical',
            'camera_status': 'off',
            'screen_switch_count': 7,
            'handler': '监考老师A',
            'handled_at': '2024-05-14T09:45:00',
            'handle_reason': '频繁切屏且摄像头长时间关闭，判定为作弊行为',
            'updated_at': '2024-05-14T09:45:00'
        },
        {
            'id': 'sess-002',
            'exam_id': 'exam-2024-001',
            'student_id': 'stu-1002',
            'student_name': '李四',
            'start_time': '2024-05-14T09:05:00',
            'status': 'warning',
            'abnormal_level': 'warning',
            'camera_status': 'on',
            'screen_switch_count': 3,
            'handler': None,
            'handled_at': None,
            'handle_reason': None,
            'updated_at': '2024-05-14T09:30:00'
        },
        {
            'id': 'sess-003',
            'exam_id': 'exam-2024-001',
            'student_id': 'stu-1003',
            'student_name': '王五',
            'start_time': '2024-05-14T09:10:00',
            'status': 'normal',
            'abnormal_level': 'normal',
            'camera_status': 'on',
            'screen_switch_count': 0,
            'handler': None,
            'handled_at': None,
            'handle_reason': None,
            'updated_at': '2024-05-14T09:10:00'
        }
    ]
    
    sample_events = [
        {'id': 'evt-001', 'session_id': 'sess-001', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:15:00', 'description': '切屏到其他应用', 'duration': 0},
        {'id': 'evt-002', 'session_id': 'sess-001', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:20:00', 'description': '切屏到其他应用', 'duration': 0},
        {'id': 'evt-003', 'session_id': 'sess-001', 'event_type': 'camera_off', 'timestamp': '2024-05-14T09:25:00', 'description': '摄像头关闭', 'duration': 180},
        {'id': 'evt-004', 'session_id': 'sess-001', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:28:00', 'description': '切屏到其他应用', 'duration': 0},
        {'id': 'evt-005', 'session_id': 'sess-001', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:32:00', 'description': '切屏到其他应用', 'duration': 0},
        {'id': 'evt-006', 'session_id': 'sess-001', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:35:00', 'description': '切屏到其他应用', 'duration': 0},
        {'id': 'evt-007', 'session_id': 'sess-001', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:38:00', 'description': '切屏到其他应用', 'duration': 0},
        {'id': 'evt-008', 'session_id': 'sess-001', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:40:00', 'description': '切屏到其他应用', 'duration': 0},
        {'id': 'evt-009', 'session_id': 'sess-002', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:18:00', 'description': '切屏到其他应用', 'duration': 0},
        {'id': 'evt-010', 'session_id': 'sess-002', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:22:00', 'description': '切屏到其他应用', 'duration': 0},
        {'id': 'evt-011', 'session_id': 'sess-002', 'event_type': 'screen_switch', 'timestamp': '2024-05-14T09:26:00', 'description': '切屏到其他应用', 'duration': 0}
    ]
    
    sample_appeals = [
        {
            'id': 'appeal-001',
            'session_id': 'sess-001',
            'student_id': 'stu-1001',
            'student_name': '张三',
            'content': '我只是不小心切屏了，摄像头关闭是因为电脑自动休眠，我没有作弊',
            'status': 'handled',
            'created_at': '2024-05-14T10:00:00',
            'handler': '巡考主任',
            'handled_at': '2024-05-14T10:30:00',
            'handle_result': '部分认可',
            'handle_reason': '经核实，摄像头关闭确为电脑休眠导致，但切屏次数过多，给予警告处理，成绩有效'
        }
    ]
    
    data['sessions'] = sample_sessions
    data['events'] = sample_events
    data['appeals'] = sample_appeals
    save_data(data)

if __name__ == '__main__':
    init_sample_data()
    app.run(debug=True, port=5000)
