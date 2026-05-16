from flask import Flask, request, jsonify, Response
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from functools import wraps
import json
import hashlib
import csv
from io import StringIO

from config import Config

app = Flask(__name__)
app.config.from_object(Config)
db = SQLAlchemy(app)


def generate_idempotency_key(data):
    sorted_data = json.dumps(data, sort_keys=True)
    return hashlib.sha256(sorted_data.encode()).hexdigest()[:32]


class SuppressionRecord(db.Model):
    id = db.Column(db.String(32), primary_key=True)
    rule_id = db.Column(db.String(64), nullable=False, index=True)
    rule_name = db.Column(db.String(255), nullable=False)
    scanner_type = db.Column(db.String(64), nullable=False)
    sample_hash = db.Column(db.String(128), nullable=False, index=True)
    sample_content = db.Column(db.Text, nullable=False)
    file_path = db.Column(db.String(512))
    line_number = db.Column(db.Integer)
    reason = db.Column(db.Text, nullable=False)
    suppressor = db.Column(db.String(128), nullable=False)
    reviewer = db.Column(db.String(128))
    state = db.Column(db.String(32), nullable=False, default='pending', index=True)
    conclusion = db.Column(db.String(64))
    comment = db.Column(db.Text)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    idempotency_key = db.Column(db.String(64), unique=True, index=True)
    original_request = db.Column(db.Text)
    error_message = db.Column(db.Text)

    state_history = db.relationship('StateHistory', backref='suppression', lazy=True, cascade='all, delete-orphan')
    samples = db.relationship('HitSample', backref='suppression', lazy=True, cascade='all, delete-orphan')


class StateHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    suppression_id = db.Column(db.String(32), db.ForeignKey('suppression_record.id'), nullable=False)
    from_state = db.Column(db.String(32))
    to_state = db.Column(db.String(32), nullable=False)
    transition_reason = db.Column(db.Text)
    operator = db.Column(db.String(128), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class HitSample(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    suppression_id = db.Column(db.String(32), db.ForeignKey('suppression_record.id'), nullable=False)
    sample_hash = db.Column(db.String(128), nullable=False)
    sample_content = db.Column(db.Text, nullable=False)
    file_path = db.Column(db.String(512))
    line_number = db.Column(db.Integer)
    scanner_output = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ProcessingError(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    endpoint = db.Column(db.String(128), nullable=False)
    suppression_id = db.Column(db.String(32), index=True)
    original_input = db.Column(db.Text, nullable=False)
    error_type = db.Column(db.String(128), nullable=False)
    error_message = db.Column(db.Text, nullable=False)
    processing_conclusion = db.Column(db.String(64))
    handled_by = db.Column(db.String(128))
    handled_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)


class StateMachine:
    @staticmethod
    def can_transition(from_state, to_state):
        allowed = Config.STATE_TRANSITIONS.get(from_state, [])
        return to_state in allowed

    @staticmethod
    def validate_transition(from_state, to_state):
        if not StateMachine.can_transition(from_state, to_state):
            raise ValueError(
                f"Invalid state transition: {from_state} -> {to_state}. "
                f"Allowed transitions from {from_state}: {Config.STATE_TRANSITIONS.get(from_state, [])}"
            )


def validate_request(required_fields):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json()
            if not data:
                return jsonify({'error': 'Request body is required'}), 400
            missing = [field for field in required_fields if field not in data]
            if missing:
                return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def log_error(endpoint, suppression_id=None, original_input=None, error_type=None, error_message=None):
    error = ProcessingError(
        endpoint=endpoint,
        suppression_id=suppression_id,
        original_input=json.dumps(original_input) if original_input else None,
        error_type=error_type,
        error_message=error_message
    )
    db.session.add(error)
    db.session.commit()
    return error.id


@app.route('/api/v1/suppressions', methods=['POST'])
@validate_request(['rule_id', 'rule_name', 'scanner_type', 'sample_content', 'reason', 'suppressor'])
def create_suppression():
    data = request.get_json()
    original_input = data.copy()
    
    try:
        idempotency_key = generate_idempotency_key({
            'rule_id': data['rule_id'],
            'sample_content': data['sample_content'],
            'suppressor': data['suppressor']
        })
        
        existing = SuppressionRecord.query.filter_by(idempotency_key=idempotency_key).first()
        if existing:
            return jsonify({
                'id': existing.id,
                'state': existing.state,
                'message': 'Duplicate request, returning existing record',
                'is_idempotent': True
            }), 200
        
        record_id = generate_idempotency_key({
            'rule_id': data['rule_id'],
            'sample_content': data['sample_content'],
            'timestamp': datetime.utcnow().isoformat()
        })
        
        days = data.get('expires_days', Config.SUPPRESSION_DEFAULT_DAYS)
        days = min(days, Config.SUPPRESSION_MAX_DAYS)
        expires_at = datetime.utcnow() + timedelta(days=days)
        
        sample_hash = generate_idempotency_key({'content': data['sample_content']})
        
        record = SuppressionRecord(
            id=record_id,
            rule_id=data['rule_id'],
            rule_name=data['rule_name'],
            scanner_type=data['scanner_type'],
            sample_hash=sample_hash,
            sample_content=data['sample_content'],
            file_path=data.get('file_path'),
            line_number=data.get('line_number'),
            reason=data['reason'],
            suppressor=data['suppressor'],
            state='pending',
            expires_at=expires_at,
            idempotency_key=idempotency_key,
            original_request=json.dumps(original_input)
        )
        
        sample = HitSample(
            suppression_id=record_id,
            sample_hash=sample_hash,
            sample_content=data['sample_content'],
            file_path=data.get('file_path'),
            line_number=data.get('line_number'),
            scanner_output=json.dumps(data.get('scanner_output', {}))
        )
        
        history = StateHistory(
            suppression_id=record_id,
            from_state=None,
            to_state='pending',
            transition_reason='Initial creation',
            operator=data['suppressor']
        )
        
        db.session.add(record)
        db.session.add(sample)
        db.session.add(history)
        db.session.commit()
        
        return jsonify({
            'id': record.id,
            'state': record.state,
            'expires_at': record.expires_at.isoformat(),
            'created_at': record.created_at.isoformat()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        error_id = log_error(
            endpoint='create_suppression',
            original_input=original_input,
            error_type=type(e).__name__,
            error_message=str(e)
        )
        return jsonify({
            'error': 'Failed to create suppression record',
            'error_id': error_id,
            'details': str(e)
        }), 500


@app.route('/api/v1/suppressions', methods=['GET'])
def list_suppressions():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        state = request.args.get('state')
        rule_id = request.args.get('rule_id')
        suppressor = request.args.get('suppressor')
        expired = request.args.get('expired', type=lambda v: v.lower() == 'true')
        
        query = SuppressionRecord.query
        
        if state:
            query = query.filter_by(state=state)
        if rule_id:
            query = query.filter_by(rule_id=rule_id)
        if suppressor:
            query = query.filter_by(suppressor=suppressor)
        if expired is not None:
            now = datetime.utcnow()
            if expired:
                query = query.filter(SuppressionRecord.expires_at < now)
            else:
                query = query.filter(SuppressionRecord.expires_at >= now)
        
        pagination = query.order_by(SuppressionRecord.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        results = []
        for record in pagination.items:
            results.append({
                'id': record.id,
                'rule_id': record.rule_id,
                'rule_name': record.rule_name,
                'scanner_type': record.scanner_type,
                'state': record.state,
                'suppressor': record.suppressor,
                'reviewer': record.reviewer,
                'conclusion': record.conclusion,
                'expires_at': record.expires_at.isoformat(),
                'is_expired': record.expires_at < datetime.utcnow(),
                'created_at': record.created_at.isoformat(),
                'updated_at': record.updated_at.isoformat()
            })
        
        return jsonify({
            'items': results,
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        })
        
    except Exception as e:
        error_id = log_error(
            endpoint='list_suppressions',
            original_input=dict(request.args),
            error_type=type(e).__name__,
            error_message=str(e)
        )
        return jsonify({
            'error': 'Failed to list suppressions',
            'error_id': error_id,
            'details': str(e)
        }), 500


@app.route('/api/v1/suppressions/<id>', methods=['GET'])
def get_suppression(id):
    try:
        record = SuppressionRecord.query.get(id)
        if not record:
            return jsonify({'error': 'Suppression record not found'}), 404
        
        history = [{
            'from_state': h.from_state,
            'to_state': h.to_state,
            'transition_reason': h.transition_reason,
            'operator': h.operator,
            'created_at': h.created_at.isoformat()
        } for h in record.state_history]
        
        samples = [{
            'sample_hash': s.sample_hash,
            'file_path': s.file_path,
            'line_number': s.line_number,
            'created_at': s.created_at.isoformat()
        } for s in record.samples]
        
        return jsonify({
            'id': record.id,
            'rule_id': record.rule_id,
            'rule_name': record.rule_name,
            'scanner_type': record.scanner_type,
            'sample_hash': record.sample_hash,
            'sample_content': record.sample_content,
            'file_path': record.file_path,
            'line_number': record.line_number,
            'reason': record.reason,
            'suppressor': record.suppressor,
            'reviewer': record.reviewer,
            'state': record.state,
            'conclusion': record.conclusion,
            'comment': record.comment,
            'expires_at': record.expires_at.isoformat(),
            'is_expired': record.expires_at < datetime.utcnow(),
            'created_at': record.created_at.isoformat(),
            'updated_at': record.updated_at.isoformat(),
            'state_history': history,
            'samples': samples,
            'has_error': bool(record.error_message)
        })
        
    except Exception as e:
        error_id = log_error(
            endpoint='get_suppression',
            suppression_id=id,
            error_type=type(e).__name__,
            error_message=str(e)
        )
        return jsonify({
            'error': 'Failed to get suppression record',
            'error_id': error_id,
            'details': str(e)
        }), 500


@app.route('/api/v1/suppressions/<id>/transition', methods=['POST'])
@validate_request(['to_state', 'operator'])
def transition_state(id):
    data = request.get_json()
    original_input = data.copy()
    
    try:
        record = SuppressionRecord.query.get(id)
        if not record:
            return jsonify({'error': 'Suppression record not found'}), 404
        
        to_state = data['to_state']
        from_state = record.state
        
        StateMachine.validate_transition(from_state, to_state)
        
        if to_state in ['approved', 'rejected']:
            if 'conclusion' not in data:
                return jsonify({'error': 'Conclusion is required for approval/rejection'}), 400
            if data['conclusion'] not in Config.REVIEW_CONCLUSIONS.values():
                return jsonify({
                    'error': f'Invalid conclusion. Must be one of: {list(Config.REVIEW_CONCLUSIONS.values())}'
                }), 400
            record.conclusion = data['conclusion']
            record.comment = data.get('comment')
            record.reviewer = data['operator']
        
        record.state = to_state
        record.updated_at = datetime.utcnow()
        
        history = StateHistory(
            suppression_id=id,
            from_state=from_state,
            to_state=to_state,
            transition_reason=data.get('reason', 'State transition'),
            operator=data['operator']
        )
        
        db.session.add(history)
        db.session.commit()
        
        return jsonify({
            'id': record.id,
            'from_state': from_state,
            'to_state': to_state,
            'state': record.state,
            'conclusion': record.conclusion,
            'updated_at': record.updated_at.isoformat()
        })
        
    except ValueError as e:
        db.session.rollback()
        error_id = log_error(
            endpoint='transition_state',
            suppression_id=id,
            original_input=original_input,
            error_type='InvalidStateTransition',
            error_message=str(e)
        )
        return jsonify({
            'error': str(e),
            'error_id': error_id
        }), 400
        
    except Exception as e:
        db.session.rollback()
        error_id = log_error(
            endpoint='transition_state',
            suppression_id=id,
            original_input=original_input,
            error_type=type(e).__name__,
            error_message=str(e)
        )
        return jsonify({
            'error': 'Failed to transition state',
            'error_id': error_id,
            'details': str(e)
        }), 500


@app.route('/api/v1/suppressions/<id>/correct', methods=['PUT'])
@validate_request(['operator'])
def correct_suppression(id):
    data = request.get_json()
    original_input = data.copy()
    
    try:
        record = SuppressionRecord.query.get(id)
        if not record:
            return jsonify({'error': 'Suppression record not found'}), 404
        
        old_values = {
            'reason': record.reason,
            'expires_at': record.expires_at.isoformat(),
            'state': record.state
        }
        
        if 'reason' in data:
            record.reason = data['reason']
        if 'expires_days' in data:
            days = min(data['expires_days'], Config.SUPPRESSION_MAX_DAYS)
            record.expires_at = datetime.utcnow() + timedelta(days=days)
        if 'state' in data:
            record.state = data['state']
        if 'conclusion' in data:
            record.conclusion = data['conclusion']
        if 'comment' in data:
            record.comment = data['comment']
        
        record.updated_at = datetime.utcnow()
        
        history = StateHistory(
            suppression_id=id,
            from_state=old_values['state'],
            to_state=record.state,
            transition_reason=f"Manual correction by {data['operator']}. Changes: {json.dumps(old_values)}",
            operator=data['operator']
        )
        
        db.session.add(history)
        db.session.commit()
        
        return jsonify({
            'id': record.id,
            'state': record.state,
            'conclusion': record.conclusion,
            'expires_at': record.expires_at.isoformat(),
            'updated_at': record.updated_at.isoformat(),
            'message': 'Record corrected successfully'
        })
        
    except Exception as e:
        db.session.rollback()
        error_id = log_error(
            endpoint='correct_suppression',
            suppression_id=id,
            original_input=original_input,
            error_type=type(e).__name__,
            error_message=str(e)
        )
        return jsonify({
            'error': 'Failed to correct suppression record',
            'error_id': error_id,
            'details': str(e)
        }), 500


@app.route('/api/v1/suppressions/export', methods=['GET'])
def export_suppressions():
    try:
        state = request.args.get('state')
        expired = request.args.get('expired', type=lambda v: v.lower() == 'true')
        format_type = request.args.get('format', 'csv')
        
        query = SuppressionRecord.query
        
        if state:
            query = query.filter_by(state=state)
        if expired is not None:
            now = datetime.utcnow()
            if expired:
                query = query.filter(SuppressionRecord.expires_at < now)
            else:
                query = query.filter(SuppressionRecord.expires_at >= now)
        
        records = query.order_by(SuppressionRecord.created_at.desc()).all()
        
        if format_type == 'json':
            export_data = []
            for r in records:
                export_data.append({
                    '压制记录ID': r.id,
                    '扫描规则ID': r.rule_id,
                    '扫描规则名称': r.rule_name,
                    '扫描器类型': r.scanner_type,
                    '样本哈希': r.sample_hash,
                    '文件路径': r.file_path,
                    '行号': r.line_number,
                    '压制理由': r.reason,
                    '提交人': r.suppressor,
                    '复核人': r.reviewer,
                    '当前状态': r.state,
                    '复核结论': r.conclusion,
                    '复核备注': r.comment,
                    '到期时间': r.expires_at.isoformat(),
                    '是否过期': r.expires_at < datetime.utcnow(),
                    '创建时间': r.created_at.isoformat(),
                    '更新时间': r.updated_at.isoformat(),
                    '是否有错误': bool(r.error_message)
                })
            return jsonify(export_data)
        
        else:
            output = StringIO()
            writer = csv.writer(output)
            writer.writerow([
                '压制记录ID', '扫描规则ID', '扫描规则名称', '扫描器类型',
                '样本哈希', '文件路径', '行号', '压制理由',
                '提交人', '复核人', '当前状态', '复核结论',
                '复核备注', '到期时间', '是否过期', '创建时间',
                '更新时间', '是否有错误'
            ])
            
            for r in records:
                writer.writerow([
                    r.id, r.rule_id, r.rule_name, r.scanner_type,
                    r.sample_hash, r.file_path or '', r.line_number or '', r.reason,
                    r.suppressor, r.reviewer or '', r.state, r.conclusion or '',
                    r.comment or '', r.expires_at.isoformat(),
                    '是' if r.expires_at < datetime.utcnow() else '否',
                    r.created_at.isoformat(), r.updated_at.isoformat(),
                    '是' if r.error_message else '否'
                ])
            
            output.seek(0)
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': 'attachment; filename=suppressions.csv'}
            )
        
    except Exception as e:
        error_id = log_error(
            endpoint='export_suppressions',
            original_input=dict(request.args),
            error_type=type(e).__name__,
            error_message=str(e)
        )
        return jsonify({
            'error': 'Failed to export suppressions',
            'error_id': error_id,
            'details': str(e)
        }), 500


@app.route('/api/v1/errors', methods=['GET'])
def list_errors():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        unhandled = request.args.get('unhandled', type=lambda v: v.lower() == 'true')
        
        query = ProcessingError.query
        if unhandled:
            query = query.filter(ProcessingError.handled_at.is_(None))
        
        pagination = query.order_by(ProcessingError.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        results = []
        for error in pagination.items:
            results.append({
                'id': error.id,
                'endpoint': error.endpoint,
                'suppression_id': error.suppression_id,
                'error_type': error.error_type,
                'error_message': error.error_message,
                'processing_conclusion': error.processing_conclusion,
                'handled_by': error.handled_by,
                'handled_at': error.handled_at.isoformat() if error.handled_at else None,
                'created_at': error.created_at.isoformat()
            })
        
        return jsonify({
            'items': results,
            'total': pagination.total,
            'page': page,
            'per_page': per_page
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/errors/<id>/handle', methods=['POST'])
@validate_request(['conclusion', 'handled_by'])
def handle_error(id):
    data = request.get_json()
    
    try:
        error = ProcessingError.query.get(id)
        if not error:
            return jsonify({'error': 'Error record not found'}), 404
        
        error.processing_conclusion = data['conclusion']
        error.handled_by = data['handled_by']
        error.handled_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'id': error.id,
            'conclusion': error.processing_conclusion,
            'handled_by': error.handled_by,
            'handled_at': error.handled_at.isoformat()
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})


def init_db():
    with app.app_context():
        db.create_all()
        print("Database initialized successfully")


if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
