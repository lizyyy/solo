from flask import request, jsonify
from app.webhook import bp
from datetime import datetime

webhook_logs = []

@bp.route('/simulate', methods=['POST'])
def simulate_webhook():
    data = request.get_json()
    
    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'event': data.get('event', 'UNKNOWN'),
        'data': data.get('data', {}),
        'headers': dict(request.headers)
    }
    
    webhook_logs.append(log_entry)
    
    print(f"[WEBHOOK SIMULATOR] Received webhook: {data.get('event')}")
    print(f"[WEBHOOK SIMULATOR] Data: {data}")
    
    return jsonify({
        'status': 'received',
        'message': 'Webhook received by simulator',
        'received_at': datetime.utcnow().isoformat()
    }), 200

@bp.route('/logs', methods=['GET'])
def get_webhook_logs():
    return jsonify({
        'count': len(webhook_logs),
        'logs': webhook_logs
    })

@bp.route('/logs', methods=['DELETE'])
def clear_webhook_logs():
    global webhook_logs
    webhook_logs = []
    return jsonify({
        'status': 'cleared',
        'message': 'All webhook logs have been cleared'
    }), 200

@bp.route('/test', methods=['GET'])
def test_webhook_endpoint():
    return jsonify({
        'status': 'active',
        'message': 'Webhook simulator endpoint is active',
        'current_time': datetime.utcnow().isoformat()
    })
