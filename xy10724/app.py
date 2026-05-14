import json
import hashlib
import hmac
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from models import db, CallbackEvent, CallbackLog, RollbackHistory

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///callback_compensation.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
CORS(app)

SECRET_KEY = 'your-secret-key-for-signature'


def generate_signature(data, secret):
    data_str = json.dumps(data, sort_keys=True)
    return hmac.new(secret.encode(), data_str.encode(), hashlib.sha256).hexdigest()


def verify_signature(data, signature, secret):
    expected_signature = generate_signature(data, secret)
    return hmac.compare_digest(expected_signature, signature)


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/api/events', methods=['GET'])
def get_events():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    partner_code = request.args.get('partner_code')
    manual_only = request.args.get('manual_only', 'false').lower() == 'true'
    
    query = CallbackEvent.query
    
    if status:
        query = query.filter(CallbackEvent.status == status)
    if partner_code:
        query = query.filter(CallbackEvent.partner_code == partner_code)
    if manual_only:
        query = query.filter(CallbackEvent.manual_confirmation == True)
    
    pagination = query.order_by(CallbackEvent.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'events': [e.to_dict() for e in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@app.route('/api/events/<event_id>', methods=['GET'])
def get_event(event_id):
    event = CallbackEvent.query.filter_by(event_id=event_id).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    
    logs = CallbackLog.query.filter_by(event_id=event_id).order_by(CallbackLog.created_at.desc()).all()
    
    return jsonify({
        'event': event.to_dict(),
        'logs': [l.to_dict() for l in logs]
    })


@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.get_json()
    
    existing_event = CallbackEvent.query.filter_by(event_id=data['event_id']).first()
    if existing_event:
        return jsonify({
            'error': 'Duplicate event_id',
            'event': existing_event.to_dict()
        }), 409
    
    signature_valid = verify_signature(json.loads(data['request_data']), data['signature'], SECRET_KEY)
    
    event = CallbackEvent(
        partner_code=data['partner_code'],
        event_id=data['event_id'],
        event_type=data['event_type'],
        callback_url=data['callback_url'],
        request_data=data['request_data'],
        signature=data['signature'],
        status='pending' if signature_valid else 'signature_invalid',
        max_retries=data.get('max_retries', 3),
        reconcile_summary=data.get('reconcile_summary', '')
    )
    
    if not signature_valid:
        event.error_message = 'Signature verification failed'
        event.manual_confirmation = True
    
    db.session.add(event)
    db.session.commit()
    
    return jsonify(event.to_dict()), 201


@app.route('/api/events/<event_id>/compensate', methods=['POST'])
def compensate_event(event_id):
    event = CallbackEvent.query.filter_by(event_id=event_id).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    
    if event.status == 'success':
        return jsonify({'error': 'Event already succeeded, cannot compensate'}), 400
    
    if event.retry_count >= event.max_retries and not event.manual_confirmation:
        return jsonify({
            'error': 'Max retries exceeded, requires manual confirmation',
            'current_retries': event.retry_count,
            'max_retries': event.max_retries
        }), 400
    
    event.retry_count += 1
    event.last_retry_at = datetime.utcnow()
    
    attempt = CallbackLog(
        event_id=event_id,
        attempt_number=event.retry_count,
        request_data=event.request_data
    )
    
    try:
        import requests
        response = requests.post(event.callback_url, json=json.loads(event.request_data), timeout=10)
        
        attempt.response_status = response.status_code
        attempt.response_data = response.text
        
        if response.status_code == 200:
            event.status = 'success'
            event.error_message = None
            attempt.success = True
        else:
            event.status = 'failed'
            event.error_message = f'HTTP {response.status_code}: {response.text}'
            attempt.success = False
            
            if event.retry_count >= event.max_retries:
                event.manual_confirmation = True
                event.status = 'needs_manual'
                
    except Exception as e:
        event.status = 'failed'
        event.error_message = str(e)
        attempt.success = False
        
        if event.retry_count >= event.max_retries:
            event.manual_confirmation = True
            event.status = 'needs_manual'
    
    if event.retry_count < event.max_retries and event.status != 'success':
        event.next_retry_at = datetime.utcnow() + timedelta(minutes=5 * event.retry_count)
    
    db.session.add(attempt)
    db.session.commit()
    
    return jsonify({
        'event': event.to_dict(),
        'attempt': attempt.to_dict()
    })


@app.route('/api/events/<event_id>/confirm', methods=['POST'])
def confirm_event(event_id):
    event = CallbackEvent.query.filter_by(event_id=event_id).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    
    data = request.get_json()
    confirmed_by = data.get('confirmed_by', 'system')
    
    event.manual_confirmation = True
    event.confirmed_by = confirmed_by
    event.confirmed_at = datetime.utcnow()
    event.retry_count = 0
    event.status = 'pending'
    event.next_retry_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify(event.to_dict())


@app.route('/api/events/<event_id>/rollback', methods=['POST'])
def rollback_event(event_id):
    event = CallbackEvent.query.filter_by(event_id=event_id).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    
    data = request.get_json()
    rollback_reason = data.get('reason', 'Manual rollback')
    rolled_back_by = data.get('rolled_back_by', 'system')
    
    previous_status = event.status
    
    rollback = RollbackHistory(
        event_id=event_id,
        rollback_reason=rollback_reason,
        rolled_back_by=rolled_back_by,
        previous_status=previous_status,
        new_status='rolled_back'
    )
    
    event.status = 'rolled_back'
    
    db.session.add(rollback)
    db.session.commit()
    
    return jsonify({
        'event': event.to_dict(),
        'rollback': rollback.to_dict()
    })


@app.route('/api/events/<event_id>/fix', methods=['PUT'])
def fix_event(event_id):
    event = CallbackEvent.query.filter_by(event_id=event_id).first()
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    
    data = request.get_json()
    
    if 'request_data' in data:
        event.request_data = json.dumps(data['request_data'])
        event.signature = generate_signature(data['request_data'], SECRET_KEY)
    if 'callback_url' in data:
        event.callback_url = data['callback_url']
    if 'reconcile_summary' in data:
        event.reconcile_summary = data['reconcile_summary']
    
    event.status = 'pending'
    event.retry_count = 0
    
    db.session.commit()
    
    return jsonify(event.to_dict())


@app.route('/api/batch/import', methods=['POST'])
def batch_import():
    data = request.get_json()
    events = data.get('events', [])
    
    results = {
        'success': [],
        'failed': [],
        'duplicates': []
    }
    
    for event_data in events:
        try:
            existing = CallbackEvent.query.filter_by(event_id=event_data['event_id']).first()
            if existing:
                results['duplicates'].append({
                    'event_id': event_data['event_id'],
                    'reason': 'Duplicate event_id'
                })
                continue
            
            signature_valid = verify_signature(
                event_data['request_data'] if isinstance(event_data['request_data'], dict) else json.loads(event_data['request_data']),
                event_data['signature'],
                SECRET_KEY
            )
            
            event = CallbackEvent(
                partner_code=event_data['partner_code'],
                event_id=event_data['event_id'],
                event_type=event_data['event_type'],
                callback_url=event_data['callback_url'],
                request_data=json.dumps(event_data['request_data']) if isinstance(event_data['request_data'], dict) else event_data['request_data'],
                signature=event_data['signature'],
                status='pending' if signature_valid else 'signature_invalid',
                reconcile_summary=event_data.get('reconcile_summary', '')
            )
            
            if not signature_valid:
                event.error_message = 'Signature verification failed on import'
                event.manual_confirmation = True
            
            db.session.add(event)
            results['success'].append(event_data['event_id'])
        except Exception as e:
            results['failed'].append({
                'event_id': event_data.get('event_id', 'unknown'),
                'reason': str(e)
            })
    
    db.session.commit()
    
    return jsonify(results)


@app.route('/api/stats', methods=['GET'])
def get_stats():
    total = CallbackEvent.query.count()
    success = CallbackEvent.query.filter_by(status='success').count()
    failed = CallbackEvent.query.filter_by(status='failed').count()
    needs_manual = CallbackEvent.query.filter_by(status='needs_manual').count()
    pending = CallbackEvent.query.filter_by(status='pending').count()
    rolled_back = CallbackEvent.query.filter_by(status='rolled_back').count()
    signature_invalid = CallbackEvent.query.filter_by(status='signature_invalid').count()
    manual_confirmation_count = CallbackEvent.query.filter_by(manual_confirmation=True).count()
    
    return jsonify({
        'total': total,
        'success': success,
        'failed': failed,
        'needs_manual': needs_manual,
        'pending': pending,
        'rolled_back': rolled_back,
        'signature_invalid': signature_invalid,
        'manual_confirmation_required': manual_confirmation_count
    })


@app.route('/api/partners', methods=['GET'])
def get_partners():
    partners = db.session.query(CallbackEvent.partner_code).distinct().all()
    return jsonify([p[0] for p in partners])


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
