from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime
from typing import Dict, List, Optional

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

SESSIONS_FILE = os.path.join(DATA_DIR, 'sessions.json')
TICKETS_FILE = os.path.join(DATA_DIR, 'tickets.json')
PROCESS_HISTORY_FILE = os.path.join(DATA_DIR, 'process_history.json')


def load_json(filename: str) -> List:
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_json(filename: str, data: List) -> None:
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def generate_id(prefix: str) -> str:
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    return f'{prefix}{timestamp}'


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    sessions = load_json(SESSIONS_FILE)
    return jsonify({'success': True, 'data': sessions})


@app.route('/api/sessions', methods=['POST'])
def create_session():
    data = request.json
    sessions = load_json(SESSIONS_FILE)
    
    session = {
        'id': generate_id('S'),
        'summary': data.get('summary', ''),
        'customer_name': data.get('customer_name', ''),
        'customer_phone': data.get('customer_phone', ''),
        'customer_identity': data.get('customer_identity', 'unknown'),
        'status': 'pending',
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }
    
    sessions.append(session)
    save_json(SESSIONS_FILE, sessions)
    
    return jsonify({'success': True, 'data': session})


@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    sessions = load_json(SESSIONS_FILE)
    session = next((s for s in sessions if s['id'] == session_id), None)
    
    if not session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404
    
    return jsonify({'success': True, 'data': session})


@app.route('/api/sessions/<session_id>/check-identity', methods=['POST'])
def check_customer_identity(session_id):
    sessions = load_json(SESSIONS_FILE)
    session = next((s for s in sessions if s['id'] == session_id), None)
    
    if not session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404
    
    data = request.json
    identity_verified = data.get('identity_verified', False)
    
    if identity_verified:
        session['customer_identity'] = 'verified'
        session['status'] = 'ready_for_ticket'
        session['can_proceed'] = True
    else:
        session['customer_identity'] = 'unverified'
        session['status'] = 'identity_failed'
        session['can_proceed'] = False
    
    session['updated_at'] = datetime.now().isoformat()
    save_json(SESSIONS_FILE, sessions)
    
    return jsonify({'success': True, 'data': session})


@app.route('/api/sessions/<session_id>/convert-ticket', methods=['POST'])
def convert_to_ticket(session_id):
    sessions = load_json(SESSIONS_FILE)
    session = next((s for s in sessions if s['id'] == session_id), None)
    
    if not session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404
    
    if session.get('can_proceed') is not True:
        return jsonify({'success': False, 'error': 'Cannot proceed without identity verification'}), 400
    
    tickets = load_json(TICKETS_FILE)
    
    ticket = {
        'id': generate_id('T'),
        'session_id': session_id,
        'title': session['summary'][:50],
        'description': session['summary'],
        'customer_name': session['customer_name'],
        'customer_phone': session['customer_phone'],
        'status': 'open',
        'created_at': datetime.now().isoformat()
    }
    
    tickets.append(ticket)
    save_json(TICKETS_FILE, tickets)
    
    session['status'] = 'converted'
    session['ticket_id'] = ticket['id']
    session['updated_at'] = datetime.now().isoformat()
    save_json(SESSIONS_FILE, sessions)
    
    return jsonify({'success': True, 'data': ticket})


@app.route('/api/tickets', methods=['GET'])
def get_tickets():
    tickets = load_json(TICKETS_FILE)
    return jsonify({'success': True, 'data': tickets})


@app.route('/api/process-history', methods=['GET'])
def get_process_history():
    history = load_json(PROCESS_HISTORY_FILE)
    return jsonify({'success': True, 'data': history})


@app.route('/api/sessions/<session_id>/process', methods=['POST'])
def process_session(session_id):
    sessions = load_json(SESSIONS_FILE)
    session = next((s for s in sessions if s['id'] == session_id), None)
    
    if not session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404
    
    data = request.json
    history = load_json(PROCESS_HISTORY_FILE)
    
    process_record = {
        'id': generate_id('P'),
        'session_id': session_id,
        'handler': data.get('handler', '系统管理员'),
        'action': data.get('action', 'manual_intervention'),
        'reason': data.get('reason', ''),
        'previous_status': session['status'],
        'new_status': data.get('new_status', 'processing'),
        'processed_at': datetime.now().isoformat()
    }
    
    history.append(process_record)
    save_json(PROCESS_HISTORY_FILE, history)
    
    session['status'] = process_record['new_status']
    session['updated_at'] = datetime.now().isoformat()
    save_json(SESSIONS_FILE, sessions)
    
    return jsonify({'success': True, 'data': process_record})


@app.route('/api/sessions/<session_id>/fix-duplicate', methods=['POST'])
def fix_duplicate_identity(session_id):
    sessions = load_json(SESSIONS_FILE)
    session = next((s for s in sessions if s['id'] == session_id), None)
    
    if not session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404
    
    data = request.json
    history = load_json(PROCESS_HISTORY_FILE)
    
    fix_record = {
        'id': generate_id('P'),
        'session_id': session_id,
        'handler': data.get('handler', '系统管理员'),
        'action': 'fix_duplicate',
        'reason': data.get('reason', '重复识别修正'),
        'previous_status': session['status'],
        'new_status': 'ready_for_ticket',
        'previous_identity': session['customer_identity'],
        'new_identity': data.get('new_identity', 'verified'),
        'processed_at': datetime.now().isoformat()
    }
    
    history.append(fix_record)
    save_json(PROCESS_HISTORY_FILE, history)
    
    session['customer_identity'] = fix_record['new_identity']
    session['status'] = 'ready_for_ticket'
    session['can_proceed'] = True
    session['updated_at'] = datetime.now().isoformat()
    save_json(SESSIONS_FILE, sessions)
    
    return jsonify({'success': True, 'data': fix_record})


@app.route('/api/sessions/<session_id>/recalculate', methods=['POST'])
def recalculate_session(session_id):
    sessions = load_json(SESSIONS_FILE)
    session = next((s for s in sessions if s['id'] == session_id), None)
    
    if not session:
        return jsonify({'success': False, 'error': 'Session not found'}), 404
    
    data = request.json
    new_identity = data.get('new_identity', session['customer_identity'])
    
    history = load_json(PROCESS_HISTORY_FILE)
    
    recalc_record = {
        'id': generate_id('P'),
        'session_id': session_id,
        'handler': data.get('handler', '系统'),
        'action': 'recalculate',
        'reason': data.get('reason', '客户身份变更重新计算'),
        'previous_status': session['status'],
        'previous_identity': session['customer_identity'],
        'new_identity': new_identity,
        'processed_at': datetime.now().isoformat()
    }
    
    if new_identity == 'verified':
        recalc_record['new_status'] = 'ready_for_ticket'
        session['can_proceed'] = True
    else:
        recalc_record['new_status'] = 'identity_failed'
        session['can_proceed'] = False
    
    history.append(recalc_record)
    save_json(PROCESS_HISTORY_FILE, history)
    
    session['customer_identity'] = new_identity
    session['status'] = recalc_record['new_status']
    session['updated_at'] = datetime.now().isoformat()
    save_json(SESSIONS_FILE, sessions)
    
    return jsonify({'success': True, 'data': recalc_record})


@app.route('/api/statistics', methods=['GET'])
def get_statistics():
    sessions = load_json(SESSIONS_FILE)
    tickets = load_json(TICKETS_FILE)
    history = load_json(PROCESS_HISTORY_FILE)
    
    total_sessions = len(sessions)
    converted_count = len([s for s in sessions if s['status'] == 'converted'])
    identity_failed_count = len([s for s in sessions if s['status'] == 'identity_failed'])
    pending_count = len([s for s in sessions if s['status'] == 'pending'])
    
    conversion_rate = (converted_count / total_sessions * 100) if total_sessions > 0 else 0
    
    status_distribution = {
        'pending': pending_count,
        'identity_failed': identity_failed_count,
        'ready_for_ticket': len([s for s in sessions if s['status'] == 'ready_for_ticket']),
        'converted': converted_count,
        'processing': len([s for s in sessions if s['status'] == 'processing'])
    }
    
    intervention_count = len([h for h in history if h['action'] == 'manual_intervention'])
    fix_count = len([h for h in history if h['action'] == 'fix_duplicate'])
    
    return jsonify({
        'success': True,
        'data': {
            'total_sessions': total_sessions,
            'converted_count': converted_count,
            'identity_failed_count': identity_failed_count,
            'conversion_rate': round(conversion_rate, 2),
            'status_distribution': status_distribution,
            'intervention_count': intervention_count,
            'fix_count': fix_count,
            'total_tickets': len(tickets)
        }
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
