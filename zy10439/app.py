from datetime import datetime, timedelta
from enum import Enum
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
import json
import csv
from io import StringIO

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///key_reminder.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


class ReminderStatus(Enum):
    PENDING = 'pending'
    REMINDER_SENT = 'reminder_sent'
    ESCALATED = 'escalated'
    TRANSFERRED = 'transferred'
    PROCESSED = 'processed'
    EXPIRED = 'expired'
    ERROR = 'error'


class ExpiryLevel(Enum):
    LEVEL_30_DAYS = 'level_30_days'
    LEVEL_15_DAYS = 'level_15_days'
    LEVEL_7_DAYS = 'level_7_days'
    LEVEL_3_DAYS = 'level_3_days'
    LEVEL_EXPIRED = 'level_expired'


class SystemAccount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    account_name = db.Column(db.String(100), nullable=False, unique=True)
    system_name = db.Column(db.String(100), nullable=False)
    environment = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)


class KeyInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey('system_account.id'), nullable=False)
    key_name = db.Column(db.String(100), nullable=False)
    key_purpose = db.Column(db.Text, nullable=False)
    expiry_date = db.Column(db.DateTime, nullable=False)
    owner = db.Column(db.String(100), nullable=False)
    backup_owner = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    account = db.relationship('SystemAccount', backref=db.backref('keys', lazy=True))


class ReminderRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key_id = db.Column(db.Integer, db.ForeignKey('key_info.id'), nullable=False)
    expiry_level = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), nullable=False, default=ReminderStatus.PENDING.value)
    current_owner = db.Column(db.String(100), nullable=False)
    reminder_count = db.Column(db.Integer, default=0)
    last_reminder_at = db.Column(db.DateTime)
    escalated_to = db.Column(db.String(100))
    raw_input = db.Column(db.Text)
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    key = db.relationship('KeyInfo', backref=db.backref('reminders', lazy=True))


class ProcessingConclusion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reminder_id = db.Column(db.Integer, db.ForeignKey('reminder_record.id'), nullable=False)
    conclusion_type = db.Column(db.String(50), nullable=False)
    conclusion = db.Column(db.Text, nullable=False)
    processed_by = db.Column(db.String(100), nullable=False)
    processed_at = db.Column(db.DateTime, default=datetime.utcnow)
    follow_up_action = db.Column(db.Text)
    next_review_date = db.Column(db.DateTime)
    
    reminder = db.relationship('ReminderRecord', backref=db.backref('conclusions', lazy=True))


class StatusTransition(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    reminder_id = db.Column(db.Integer, db.ForeignKey('reminder_record.id'), nullable=False)
    from_status = db.Column(db.String(50), nullable=False)
    to_status = db.Column(db.String(50), nullable=False)
    transition_reason = db.Column(db.Text, nullable=False)
    operator = db.Column(db.String(100), nullable=False)
    transition_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    reminder = db.relationship('ReminderRecord', backref=db.backref('transitions', lazy=True))


def get_expiry_level(expiry_date):
    now = datetime.utcnow()
    days_left = (expiry_date - now).days
    
    if days_left < 0:
        return ExpiryLevel.LEVEL_EXPIRED
    elif days_left <= 3:
        return ExpiryLevel.LEVEL_3_DAYS
    elif days_left <= 7:
        return ExpiryLevel.LEVEL_7_DAYS
    elif days_left <= 15:
        return ExpiryLevel.LEVEL_15_DAYS
    elif days_left <= 30:
        return ExpiryLevel.LEVEL_30_DAYS
    else:
        return None


def check_duplicate_reminder(key_id, expiry_level):
    existing = ReminderRecord.query.filter(
        ReminderRecord.key_id == key_id,
        ReminderRecord.expiry_level == expiry_level,
        ReminderRecord.status.in_([
            ReminderStatus.PENDING.value,
            ReminderStatus.REMINDER_SENT.value,
            ReminderStatus.ESCALATED.value
        ])
    ).first()
    return existing is not None


def can_transition_status(from_status, to_status):
    valid_transitions = {
        ReminderStatus.PENDING.value: [
            ReminderStatus.REMINDER_SENT.value,
            ReminderStatus.ERROR.value
        ],
        ReminderStatus.REMINDER_SENT.value: [
            ReminderStatus.ESCALATED.value,
            ReminderStatus.TRANSFERRED.value,
            ReminderStatus.PROCESSED.value,
            ReminderStatus.ERROR.value
        ],
        ReminderStatus.ESCALATED.value: [
            ReminderStatus.TRANSFERRED.value,
            ReminderStatus.PROCESSED.value,
            ReminderStatus.EXPIRED.value,
            ReminderStatus.ERROR.value
        ],
        ReminderStatus.TRANSFERRED.value: [
            ReminderStatus.PROCESSED.value,
            ReminderStatus.EXPIRED.value,
            ReminderStatus.ERROR.value
        ],
        ReminderStatus.PROCESSED.value: [],
        ReminderStatus.EXPIRED.value: [],
        ReminderStatus.ERROR.value: [
            ReminderStatus.PENDING.value,
            ReminderStatus.PROCESSED.value
        ]
    }
    return to_status in valid_transitions.get(from_status, [])


def record_status_transition(reminder_id, from_status, to_status, reason, operator):
    transition = StatusTransition(
        reminder_id=reminder_id,
        from_status=from_status,
        to_status=to_status,
        transition_reason=reason,
        operator=operator
    )
    db.session.add(transition)


@app.route('/api/accounts', methods=['POST'])
def create_account():
    data = request.get_json()
    try:
        account = SystemAccount(
            account_name=data['account_name'],
            system_name=data['system_name'],
            environment=data['environment']
        )
        db.session.add(account)
        db.session.commit()
        return jsonify({'id': account.id, 'message': 'Account created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'raw_input': json.dumps(data)}), 400


@app.route('/api/accounts', methods=['GET'])
def list_accounts():
    accounts = SystemAccount.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': a.id,
        'account_name': a.account_name,
        'system_name': a.system_name,
        'environment': a.environment
    } for a in accounts])


@app.route('/api/keys', methods=['POST'])
def create_key():
    data = request.get_json()
    try:
        expiry_date = datetime.fromisoformat(data['expiry_date'].replace('Z', '+00:00'))
        key = KeyInfo(
            account_id=data['account_id'],
            key_name=data['key_name'],
            key_purpose=data['key_purpose'],
            expiry_date=expiry_date,
            owner=data['owner'],
            backup_owner=data.get('backup_owner')
        )
        db.session.add(key)
        db.session.commit()
        return jsonify({'id': key.id, 'message': 'Key created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'raw_input': json.dumps(data)}), 400


@app.route('/api/keys', methods=['GET'])
def list_keys():
    keys = KeyInfo.query.filter_by(is_active=True).all()
    return jsonify([{
        'id': k.id,
        'account_name': k.account.account_name,
        'key_name': k.key_name,
        'key_purpose': k.key_purpose,
        'expiry_date': k.expiry_date.isoformat(),
        'owner': k.owner,
        'backup_owner': k.backup_owner,
        'days_left': (k.expiry_date - datetime.utcnow()).days
    } for k in keys])


@app.route('/api/reminders/generate', methods=['POST'])
def generate_reminders():
    data = request.get_json() or {}
    operator = data.get('operator', 'system')
    generated = []
    errors = []
    
    keys = KeyInfo.query.filter_by(is_active=True).all()
    
    for key in keys:
        try:
            expiry_level = get_expiry_level(key.expiry_date)
            if not expiry_level:
                continue
            
            if check_duplicate_reminder(key.id, expiry_level.value):
                continue
            
            reminder = ReminderRecord(
                key_id=key.id,
                expiry_level=expiry_level.value,
                current_owner=key.owner,
                raw_input=json.dumps({
                    'key_id': key.id,
                    'key_name': key.key_name,
                    'expiry_date': key.expiry_date.isoformat(),
                    'owner': key.owner,
                    'expiry_level': expiry_level.value
                })
            )
            db.session.add(reminder)
            db.session.flush()
            
            record_status_transition(
                reminder.id,
                'none',
                ReminderStatus.PENDING.value,
                f'Generated reminder for {expiry_level.value}',
                operator
            )
            
            generated.append({
                'reminder_id': reminder.id,
                'key_name': key.key_name,
                'expiry_level': expiry_level.value,
                'owner': key.owner
            })
        except Exception as e:
            errors.append({
                'key_id': key.id,
                'key_name': key.key_name,
                'error': str(e),
                'raw_input': json.dumps({
                    'key_id': key.id,
                    'expiry_date': key.expiry_date.isoformat()
                })
            })
    
    db.session.commit()
    return jsonify({
        'generated_count': len(generated),
        'generated': generated,
        'error_count': len(errors),
        'errors': errors
    })


@app.route('/api/reminders', methods=['GET'])
def list_reminders():
    status_filter = request.args.get('status')
    query = ReminderRecord.query
    
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    reminders = query.order_by(ReminderRecord.created_at.desc()).all()
    
    return jsonify([{
        'id': r.id,
        'key_name': r.key.key_name,
        'key_purpose': r.key.key_purpose,
        'expiry_date': r.key.expiry_date.isoformat(),
        'expiry_level': r.expiry_level,
        'status': r.status,
        'current_owner': r.current_owner,
        'reminder_count': r.reminder_count,
        'last_reminder_at': r.last_reminder_at.isoformat() if r.last_reminder_at else None,
        'escalated_to': r.escalated_to,
        'error_message': r.error_message
    } for r in reminders])


@app.route('/api/reminders/<int:reminder_id>/send', methods=['POST'])
def send_reminder(reminder_id):
    data = request.get_json() or {}
    operator = data.get('operator', 'system')
    
    reminder = ReminderRecord.query.get(reminder_id)
    if not reminder:
        return jsonify({'error': 'Reminder not found'}), 404
    
    if reminder.status not in [ReminderStatus.PENDING.value, ReminderStatus.REMINDER_SENT.value]:
        return jsonify({'error': f'Cannot send reminder from status: {reminder.status}'}), 400
    
    try:
        old_status = reminder.status
        reminder.reminder_count += 1
        reminder.last_reminder_at = datetime.utcnow()
        reminder.status = ReminderStatus.REMINDER_SENT.value
        
        record_status_transition(
            reminder.id,
            old_status,
            ReminderStatus.REMINDER_SENT.value,
            f'Reminder sent to {reminder.current_owner}',
            operator
        )
        
        db.session.commit()
        return jsonify({
            'id': reminder.id,
            'status': reminder.status,
            'reminder_count': reminder.reminder_count,
            'message': 'Reminder sent successfully'
        })
    except Exception as e:
        db.session.rollback()
        reminder.status = ReminderStatus.ERROR.value
        reminder.error_message = str(e)
        db.session.commit()
        return jsonify({
            'error': str(e),
            'raw_input': json.dumps(data),
            'reminder_id': reminder_id
        }), 500


@app.route('/api/reminders/<int:reminder_id>/escalate', methods=['POST'])
def escalate_reminder(reminder_id):
    data = request.get_json()
    if not data or 'escalated_to' not in data:
        return jsonify({'error': 'escalated_to is required'}), 400
    
    operator = data.get('operator', 'system')
    
    reminder = ReminderRecord.query.get(reminder_id)
    if not reminder:
        return jsonify({'error': 'Reminder not found'}), 404
    
    if reminder.status != ReminderStatus.REMINDER_SENT.value:
        return jsonify({'error': f'Cannot escalate from status: {reminder.status}'}), 400
    
    try:
        old_status = reminder.status
        reminder.escalated_to = data['escalated_to']
        reminder.status = ReminderStatus.ESCALATED.value
        
        record_status_transition(
            reminder.id,
            old_status,
            ReminderStatus.ESCALATED.value,
            f'Escalated to {data["escalated_to"]}',
            operator
        )
        
        db.session.commit()
        return jsonify({
            'id': reminder.id,
            'status': reminder.status,
            'escalated_to': reminder.escalated_to,
            'message': 'Reminder escalated successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': str(e),
            'raw_input': json.dumps(data)
        }), 500


@app.route('/api/reminders/<int:reminder_id>/transfer', methods=['POST'])
def transfer_owner(reminder_id):
    data = request.get_json()
    if not data or 'new_owner' not in data:
        return jsonify({'error': 'new_owner is required'}), 400
    
    operator = data.get('operator', 'system')
    transfer_reason = data.get('reason', 'Owner on leave')
    
    reminder = ReminderRecord.query.get(reminder_id)
    if not reminder:
        return jsonify({'error': 'Reminder not found'}), 404
    
    if reminder.status not in [ReminderStatus.REMINDER_SENT.value, ReminderStatus.ESCALATED.value]:
        return jsonify({'error': f'Cannot transfer from status: {reminder.status}'}), 400
    
    try:
        old_status = reminder.status
        old_owner = reminder.current_owner
        reminder.current_owner = data['new_owner']
        reminder.status = ReminderStatus.TRANSFERRED.value
        
        record_status_transition(
            reminder.id,
            old_status,
            ReminderStatus.TRANSFERRED.value,
            f'Transferred from {old_owner} to {data["new_owner"]}. Reason: {transfer_reason}',
            operator
        )
        
        db.session.commit()
        return jsonify({
            'id': reminder.id,
            'status': reminder.status,
            'current_owner': reminder.current_owner,
            'previous_owner': old_owner,
            'message': 'Owner transferred successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': str(e),
            'raw_input': json.dumps(data)
        }), 500


@app.route('/api/reminders/<int:reminder_id>/process', methods=['POST'])
def process_reminder(reminder_id):
    data = request.get_json()
    if not data or 'conclusion_type' not in data or 'conclusion' not in data:
        return jsonify({'error': 'conclusion_type and conclusion are required'}), 400
    
    operator = data.get('processed_by', 'unknown')
    
    reminder = ReminderRecord.query.get(reminder_id)
    if not reminder:
        return jsonify({'error': 'Reminder not found'}), 404
    
    if reminder.status in [ReminderStatus.PROCESSED.value, ReminderStatus.EXPIRED.value]:
        return jsonify({'error': f'Reminder already in final status: {reminder.status}'}), 400
    
    try:
        old_status = reminder.status
        reminder.status = ReminderStatus.PROCESSED.value
        
        conclusion = ProcessingConclusion(
            reminder_id=reminder_id,
            conclusion_type=data['conclusion_type'],
            conclusion=data['conclusion'],
            processed_by=operator,
            follow_up_action=data.get('follow_up_action'),
            next_review_date=datetime.fromisoformat(data['next_review_date'].replace('Z', '+00:00')) if data.get('next_review_date') else None
        )
        db.session.add(conclusion)
        
        record_status_transition(
            reminder.id,
            old_status,
            ReminderStatus.PROCESSED.value,
            f'Processed with conclusion: {data["conclusion_type"]}',
            operator
        )
        
        db.session.commit()
        return jsonify({
            'id': reminder.id,
            'status': reminder.status,
            'conclusion_id': conclusion.id,
            'message': 'Reminder processed successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': str(e),
            'raw_input': json.dumps(data)
        }), 500


@app.route('/api/reminders/<int:reminder_id>/correct', methods=['POST'])
def manual_correction(reminder_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Correction data is required'}), 400
    
    operator = data.get('operator', 'admin')
    reason = data.get('reason', 'Manual correction')
    
    reminder = ReminderRecord.query.get(reminder_id)
    if not reminder:
        return jsonify({'error': 'Reminder not found'}), 404
    
    try:
        old_status = reminder.status
        changes = []
        
        if 'new_status' in data:
            new_status = data['new_status']
            reminder.status = new_status
            changes.append(f'status: {old_status} -> {new_status}')
        
        if 'new_owner' in data:
            old_owner = reminder.current_owner
            reminder.current_owner = data['new_owner']
            changes.append(f'owner: {old_owner} -> {data["new_owner"]}')
        
        if 'error_message' in data:
            reminder.error_message = data['error_message']
        
        record_status_transition(
            reminder.id,
            old_status,
            reminder.status,
            f'Manual correction. Changes: {"; ".join(changes)}. Reason: {reason}',
            operator
        )
        
        db.session.commit()
        return jsonify({
            'id': reminder.id,
            'status': reminder.status,
            'current_owner': reminder.current_owner,
            'changes': changes,
            'message': 'Manual correction applied successfully'
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': str(e),
            'raw_input': json.dumps(data)
        }), 500


@app.route('/api/reminders/<int:reminder_id>/transitions', methods=['GET'])
def get_transitions(reminder_id):
    transitions = StatusTransition.query.filter_by(reminder_id=reminder_id).order_by(StatusTransition.transition_at).all()
    return jsonify([{
        'id': t.id,
        'from_status': t.from_status,
        'to_status': t.to_status,
        'transition_reason': t.transition_reason,
        'operator': t.operator,
        'transition_at': t.transition_at.isoformat()
    } for t in transitions])


@app.route('/api/reminders/<int:reminder_id>/conclusions', methods=['GET'])
def get_conclusions(reminder_id):
    conclusions = ProcessingConclusion.query.filter_by(reminder_id=reminder_id).order_by(ProcessingConclusion.processed_at).all()
    return jsonify([{
        'id': c.id,
        'conclusion_type': c.conclusion_type,
        'conclusion': c.conclusion,
        'processed_by': c.processed_by,
        'processed_at': c.processed_at.isoformat(),
        'follow_up_action': c.follow_up_action,
        'next_review_date': c.next_review_date.isoformat() if c.next_review_date else None
    } for c in conclusions])


@app.route('/api/export/reminders', methods=['GET'])
def export_reminders():
    status_filter = request.args.get('status')
    query = ReminderRecord.query
    
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    reminders = query.order_by(ReminderRecord.created_at.desc()).all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        '催办记录ID',
        '系统账号',
        '密钥名称',
        '密钥用途',
        '到期时间',
        '到期分级',
        '当前状态',
        '当前负责人',
        '催办次数',
        '上次催办时间',
        '已转交给',
        '处理结论类型',
        '处理结论',
        '处理人',
        '处理时间',
        '后续行动',
        '下次复核时间',
        '错误信息',
        '原始输入'
    ])
    
    for r in reminders:
        conclusion = ProcessingConclusion.query.filter_by(reminder_id=r.id).first()
        writer.writerow([
            r.id,
            r.key.account.account_name,
            r.key.key_name,
            r.key.key_purpose,
            r.key.expiry_date.strftime('%Y-%m-%d %H:%M:%S'),
            r.expiry_level,
            r.status,
            r.current_owner,
            r.reminder_count,
            r.last_reminder_at.strftime('%Y-%m-%d %H:%M:%S') if r.last_reminder_at else '',
            r.escalated_to or '',
            conclusion.conclusion_type if conclusion else '',
            conclusion.conclusion if conclusion else '',
            conclusion.processed_by if conclusion else '',
            conclusion.processed_at.strftime('%Y-%m-%d %H:%M:%S') if conclusion else '',
            conclusion.follow_up_action if conclusion and conclusion.follow_up_action else '',
            conclusion.next_review_date.strftime('%Y-%m-%d') if conclusion and conclusion.next_review_date else '',
            r.error_message or '',
            r.raw_input or ''
        ])
    
    output.seek(0)
    return jsonify({
        'filename': f'reminder_export_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv',
        'content': output.getvalue()
    })


@app.route('/api/export/status-transitions', methods=['GET'])
def export_transitions():
    transitions = StatusTransition.query.order_by(StatusTransition.transition_at.desc()).all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        '流转记录ID',
        '催办记录ID',
        '密钥名称',
        '源状态',
        '目标状态',
        '流转原因',
        '操作人',
        '操作时间'
    ])
    
    for t in transitions:
        writer.writerow([
            t.id,
            t.reminder_id,
            t.reminder.key.key_name,
            t.from_status,
            t.to_status,
            t.transition_reason,
            t.operator,
            t.transition_at.strftime('%Y-%m-%d %H:%M:%S')
        ])
    
    output.seek(0)
    return jsonify({
        'filename': f'status_transitions_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv',
        'content': output.getvalue()
    })


with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
