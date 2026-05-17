from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from enum import Enum
import json
import csv
from io import StringIO
from flask import make_response

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///env_occupancy.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


class OccupancyStatus(Enum):
    PENDING = 'pending'
    ACTIVE = 'active'
    RELEASING = 'releasing'
    COMPLETED = 'completed'
    CANCELLED = 'cancelled'
    EXCEPTION = 'exception'


class Environment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(500))
    current_occupancy_id = db.Column(db.Integer, db.ForeignKey('occupancy.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Occupancy(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    env_id = db.Column(db.Integer, db.ForeignKey('environment.id'), nullable=False)
    team = db.Column(db.String(100), nullable=False)
    test_batch = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(50), default=OccupancyStatus.PENDING.value)
    lease_duration_hours = db.Column(db.Integer, default=4)
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    started_at = db.Column(db.DateTime)
    estimated_release_at = db.Column(db.DateTime)
    actual_release_at = db.Column(db.DateTime)
    snapshot_id = db.Column(db.Integer, db.ForeignKey('data_snapshot.id'))
    release_plan = db.Column(db.Text)
    raw_request = db.Column(db.Text)
    exception_info = db.Column(db.Text)
    resolved_by = db.Column(db.String(100))
    resolved_at = db.Column(db.DateTime)
    resolution_notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    priority = db.Column(db.Integer, default=0)
    queue_position = db.Column(db.Integer)


class DataSnapshot(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    env_id = db.Column(db.Integer, db.ForeignKey('environment.id'), nullable=False)
    occupancy_id = db.Column(db.Integer, db.ForeignKey('occupancy.id'))
    snapshot_name = db.Column(db.String(200), nullable=False)
    snapshot_type = db.Column(db.String(50))
    snapshot_path = db.Column(db.String(500))
    snapshot_metadata = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(100))


class OccupancyAudit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    occupancy_id = db.Column(db.Integer, db.ForeignKey('occupancy.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    previous_status = db.Column(db.String(50))
    new_status = db.Column(db.String(50))
    operator = db.Column(db.String(100))
    notes = db.Column(db.Text)
    raw_input = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


@app.route('/api/environments', methods=['POST'])
def create_environment():
    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': '环境名称不能为空'}), 400
    if Environment.query.filter_by(name=name).first():
        return jsonify({'error': '环境已存在'}), 409
    env = Environment(name=name, description=data.get('description', ''))
    db.session.add(env)
    db.session.commit()
    return jsonify({'id': env.id, 'name': env.name, 'description': env.description}), 201


@app.route('/api/environments', methods=['GET'])
def list_environments():
    envs = Environment.query.all()
    result = []
    for env in envs:
        current = Occupancy.query.get(env.current_occupancy_id) if env.current_occupancy_id else None
        result.append({
            'id': env.id,
            'name': env.name,
            'description': env.description,
            'status': 'occupied' if current else 'available',
            'current_occupancy': _occupancy_to_dict(current) if current else None
        })
    return jsonify(result)


@app.route('/api/occupancies', methods=['POST'])
def create_occupancy():
    raw_input = json.dumps(request.get_json())
    data = request.get_json()
    env_name = data.get('env_name')
    team = data.get('team')
    test_batch = data.get('test_batch')
    lease_hours = data.get('lease_duration_hours', 4)
    if not all([env_name, team, test_batch]):
        return jsonify({'error': '环境名称、团队、测试批次为必填字段'}), 400
    env = Environment.query.filter_by(name=env_name).first()
    if not env:
        return jsonify({'error': '环境不存在'}), 404
    existing = Occupancy.query.filter_by(
        env_id=env.id,
        team=team,
        test_batch=test_batch
    ).filter(Occupancy.status.in_([
        OccupancyStatus.PENDING.value,
        OccupancyStatus.ACTIVE.value,
        OccupancyStatus.RELEASING.value
    ])).first()
    if existing:
        return jsonify({'error': '该团队此批次已在占用队列中', 'occupancy_id': existing.id}), 409
    active_count = Occupancy.query.filter_by(env_id=env.id, status=OccupancyStatus.ACTIVE.value).count()
    queue_pending = Occupancy.query.filter(
        Occupancy.env_id == env.id,
        Occupancy.status == OccupancyStatus.PENDING.value
    ).count()
    occupancy = Occupancy(
        env_id=env.id,
        team=team,
        test_batch=test_batch,
        lease_duration_hours=lease_hours,
        raw_request=raw_input,
        queue_position=queue_pending + 1
    )
    if active_count == 0 and queue_pending == 0:
        occupancy.status = OccupancyStatus.ACTIVE.value
        occupancy.started_at = datetime.utcnow()
        occupancy.estimated_release_at = datetime.utcnow() + timedelta(hours=lease_hours)
    db.session.add(occupancy)
    db.session.flush()
    if occupancy.status == OccupancyStatus.ACTIVE.value:
        env.current_occupancy_id = occupancy.id
        db.session.flush()
    _create_audit(occupancy.id, 'CREATE', None, occupancy.status, data.get('operator', 'system'), '创建占用请求', raw_input)
    db.session.commit()
    return jsonify(_occupancy_to_dict(occupancy)), 201


@app.route('/api/occupancies', methods=['GET'])
def list_occupancies():
    env_name = request.args.get('env_name')
    team = request.args.get('team')
    status = request.args.get('status')
    query = Occupancy.query
    if env_name:
        env = Environment.query.filter_by(name=env_name).first()
        if env:
            query = query.filter_by(env_id=env.id)
    if team:
        query = query.filter_by(team=team)
    if status:
        query = query.filter_by(status=status)
    occupancies = query.order_by(Occupancy.created_at.desc()).all()
    return jsonify([_occupancy_to_dict(o) for o in occupancies])


@app.route('/api/occupancies/<int:occupancy_id>', methods=['GET'])
def get_occupancy(occupancy_id):
    occ = Occupancy.query.get(occupancy_id)
    if not occ:
        return jsonify({'error': '占用记录不存在'}), 404
    return jsonify(_occupancy_to_dict(occ, detail=True))


@app.route('/api/occupancies/<int:occupancy_id>/start', methods=['POST'])
def start_occupancy(occupancy_id):
    raw_input = json.dumps(request.get_json())
    data = request.get_json() or {}
    occ = Occupancy.query.get(occupancy_id)
    if not occ:
        return jsonify({'error': '占用记录不存在'}), 404
    if occ.status != OccupancyStatus.PENDING.value:
        return jsonify({'error': '只有待处理状态可以启动'}), 400
    env = Environment.query.get(occ.env_id)
    active_other = Occupancy.query.filter(
        Occupancy.env_id == occ.env_id,
        Occupancy.status == OccupancyStatus.ACTIVE.value,
        Occupancy.id != occupancy_id
    ).first()
    if active_other:
        return jsonify({'error': '环境正被其他占用使用', 'active_occupancy_id': active_other.id}), 409
    prev_status = occ.status
    occ.status = OccupancyStatus.ACTIVE.value
    occ.started_at = datetime.utcnow()
    occ.estimated_release_at = datetime.utcnow() + timedelta(hours=occ.lease_duration_hours)
    env.current_occupancy_id = occ.id
    _update_queue_positions(env.id)
    _create_audit(occupancy_id, 'START', prev_status, occ.status, data.get('operator', 'system'), '启动占用', raw_input)
    db.session.commit()
    return jsonify(_occupancy_to_dict(occ))


@app.route('/api/occupancies/<int:occupancy_id>/prepare-release', methods=['POST'])
def prepare_release(occupancy_id):
    raw_input = json.dumps(request.get_json())
    data = request.get_json() or {}
    occ = Occupancy.query.get(occupancy_id)
    if not occ:
        return jsonify({'error': '占用记录不存在'}), 404
    if occ.status != OccupancyStatus.ACTIVE.value:
        return jsonify({'error': '只有活跃状态可以准备释放'}), 400
    prev_status = occ.status
    occ.status = OccupancyStatus.RELEASING.value
    occ.release_plan = data.get('release_plan', '')
    _create_audit(occupancy_id, 'PREPARE_RELEASE', prev_status, occ.status, data.get('operator', 'system'), '准备释放环境', raw_input)
    db.session.commit()
    return jsonify(_occupancy_to_dict(occ))


@app.route('/api/occupancies/<int:occupancy_id>/confirm-release', methods=['POST'])
def confirm_release(occupancy_id):
    raw_input = json.dumps(request.get_json())
    data = request.get_json() or {}
    occ = Occupancy.query.get(occupancy_id)
    if not occ:
        return jsonify({'error': '占用记录不存在'}), 404
    if occ.status != OccupancyStatus.RELEASING.value:
        return jsonify({'error': '只有释放中状态可以确认释放'}), 400
    env = Environment.query.get(occ.env_id)
    prev_status = occ.status
    occ.status = OccupancyStatus.COMPLETED.value
    occ.actual_release_at = datetime.utcnow()
    env.current_occupancy_id = None
    _activate_next_in_queue(env.id)
    _create_audit(occupancy_id, 'CONFIRM_RELEASE', prev_status, occ.status, data.get('operator', 'system'), '确认释放环境', raw_input)
    db.session.commit()
    return jsonify(_occupancy_to_dict(occ))


@app.route('/api/occupancies/<int:occupancy_id>/exception', methods=['POST'])
def mark_exception(occupancy_id):
    raw_input = json.dumps(request.get_json())
    data = request.get_json()
    occ = Occupancy.query.get(occupancy_id)
    if not occ:
        return jsonify({'error': '占用记录不存在'}), 404
    exception_info = data.get('exception_info')
    if not exception_info:
        return jsonify({'error': '异常信息不能为空'}), 400
    prev_status = occ.status
    occ.status = OccupancyStatus.EXCEPTION.value
    occ.exception_info = exception_info
    _create_audit(occupancy_id, 'MARK_EXCEPTION', prev_status, occ.status, data.get('operator', 'system'), f'标记异常: {exception_info}', raw_input)
    db.session.commit()
    return jsonify(_occupancy_to_dict(occ))


@app.route('/api/occupancies/<int:occupancy_id>/resolve', methods=['POST'])
def resolve_exception(occupancy_id):
    raw_input = json.dumps(request.get_json())
    data = request.get_json()
    occ = Occupancy.query.get(occupancy_id)
    if not occ:
        return jsonify({'error': '占用记录不存在'}), 404
    if occ.status != OccupancyStatus.EXCEPTION.value:
        return jsonify({'error': '只有异常状态可以处理'}), 400
    resolution = data.get('resolution')
    target_status = data.get('target_status', OccupancyStatus.CANCELLED.value)
    operator = data.get('operator')
    if not all([resolution, operator]):
        return jsonify({'error': '处理方案和操作人为必填字段'}), 400
    if target_status not in [OccupancyStatus.ACTIVE.value, OccupancyStatus.CANCELLED.value, OccupancyStatus.PENDING.value]:
        return jsonify({'error': '目标状态不合法'}), 400
    prev_status = occ.status
    occ.status = target_status
    occ.resolved_by = operator
    occ.resolved_at = datetime.utcnow()
    occ.resolution_notes = resolution
    if target_status == OccupancyStatus.CANCELLED.value:
        env = Environment.query.get(occ.env_id)
        if env.current_occupancy_id == occupancy_id:
            env.current_occupancy_id = None
            occ.actual_release_at = datetime.utcnow()
            _activate_next_in_queue(env.id)
    _create_audit(occupancy_id, 'RESOLVE', prev_status, target_status, operator, f'人工处理: {resolution}', raw_input)
    db.session.commit()
    return jsonify(_occupancy_to_dict(occ))


@app.route('/api/occupancies/<int:occupancy_id>/snapshot', methods=['POST'])
def create_snapshot(occupancy_id):
    raw_input = json.dumps(request.get_json())
    data = request.get_json()
    occ = Occupancy.query.get(occupancy_id)
    if not occ:
        return jsonify({'error': '占用记录不存在'}), 404
    snapshot_name = data.get('snapshot_name')
    if not snapshot_name:
        return jsonify({'error': '快照名称不能为空'}), 400
    snapshot = DataSnapshot(
        env_id=occ.env_id,
        occupancy_id=occupancy_id,
        snapshot_name=snapshot_name,
        snapshot_type=data.get('snapshot_type', 'manual'),
        snapshot_path=data.get('snapshot_path', ''),
        snapshot_metadata=json.dumps(data.get('metadata', {})),
        created_by=data.get('created_by', 'system')
    )
    db.session.add(snapshot)
    occ.snapshot_id = snapshot.id
    _create_audit(occupancy_id, 'SNAPSHOT', occ.status, occ.status, data.get('created_by', 'system'), f'创建快照: {snapshot_name}', raw_input)
    db.session.commit()
    return jsonify({
        'id': snapshot.id,
        'snapshot_name': snapshot.snapshot_name,
        'created_at': snapshot.created_at.isoformat()
    }), 201


@app.route('/api/report/occupancies', methods=['GET'])
def export_report():
    format_type = request.args.get('format', 'json')
    env_name = request.args.get('env_name')
    team = request.args.get('team')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    query = Occupancy.query
    if env_name:
        env = Environment.query.filter_by(name=env_name).first()
        if env:
            query = query.filter_by(env_id=env.id)
    if team:
        query = query.filter_by(team=team)
    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            query = query.filter(Occupancy.created_at >= start)
        except ValueError:
            pass
    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            query = query.filter(Occupancy.created_at <= end)
        except ValueError:
            pass
    occupancies = query.order_by(Occupancy.created_at.desc()).all()
    if format_type == 'csv':
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', '环境', '团队', '测试批次', '状态', '请求时间', '启动时间', '预计释放', '实际释放', '租约时长', '异常信息'])
        for occ in occupancies:
            env = Environment.query.get(occ.env_id)
            writer.writerow([
                occ.id, env.name, occ.team, occ.test_batch,
                occ.status,
                occ.requested_at.isoformat() if occ.requested_at else '',
                occ.started_at.isoformat() if occ.started_at else '',
                occ.estimated_release_at.isoformat() if occ.estimated_release_at else '',
                occ.actual_release_at.isoformat() if occ.actual_release_at else '',
                occ.lease_duration_hours,
                occ.exception_info or ''
            ])
        response = make_response(output.getvalue())
        response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        response.headers['Content-Disposition'] = 'attachment; filename=occupancy_report.csv'
        return response
    else:
        return jsonify([_occupancy_to_dict(o) for o in occupancies])


@app.route('/api/occupancies/<int:occupancy_id>/manual-fix', methods=['POST'])
def manual_fix(occupancy_id):
    raw_input = json.dumps(request.get_json())
    data = request.get_json()
    occ = Occupancy.query.get(occupancy_id)
    if not occ:
        return jsonify({'error': '占用记录不存在'}), 404
    operator = data.get('operator')
    fields = data.get('fields', {})
    reason = data.get('reason', '')
    if not operator:
        return jsonify({'error': '操作人不能为空'}), 400
    allowed_fields = ['status', 'lease_duration_hours', 'estimated_release_at', 'team', 'test_batch']
    changes = []
    prev_status = occ.status
    for field, value in fields.items():
        if field in allowed_fields:
            old_val = getattr(occ, field)
            setattr(occ, field, value)
            changes.append(f'{field}: {old_val} -> {value}')
    _create_audit(occupancy_id, 'MANUAL_FIX', prev_status, occ.status, operator, f'人工修正: {reason}; 变更: {"; ".join(changes)}', raw_input)
    db.session.commit()
    return jsonify(_occupancy_to_dict(occ))


def _occupancy_to_dict(occ, detail=False):
    if not occ:
        return None
    env = Environment.query.get(occ.env_id)
    result = {
        'id': occ.id,
        'env_name': env.name if env else None,
        'team': occ.team,
        'test_batch': occ.test_batch,
        'status': occ.status,
        'lease_duration_hours': occ.lease_duration_hours,
        'requested_at': occ.requested_at.isoformat() if occ.requested_at else None,
        'started_at': occ.started_at.isoformat() if occ.started_at else None,
        'estimated_release_at': occ.estimated_release_at.isoformat() if occ.estimated_release_at else None,
        'actual_release_at': occ.actual_release_at.isoformat() if occ.actual_release_at else None,
        'queue_position': occ.queue_position,
        'priority': occ.priority,
        'resolved_by': occ.resolved_by,
        'resolved_at': occ.resolved_at.isoformat() if occ.resolved_at else None,
        'resolution_notes': occ.resolution_notes
    }
    if detail:
        result.update({
            'release_plan': occ.release_plan,
            'exception_info': occ.exception_info,
            'raw_request': occ.raw_request
        })
        snapshots = DataSnapshot.query.filter_by(occupancy_id=occ.id).all()
        result['snapshots'] = [{
            'id': s.id,
            'name': s.snapshot_name,
            'created_at': s.created_at.isoformat()
        } for s in snapshots]
        audits = OccupancyAudit.query.filter_by(occupancy_id=occ.id).order_by(OccupancyAudit.created_at).all()
        result['audit_log'] = [{
            'action': a.action,
            'prev_status': a.previous_status,
            'new_status': a.new_status,
            'operator': a.operator,
            'notes': a.notes,
            'created_at': a.created_at.isoformat()
        } for a in audits]
    return result


def _create_audit(occupancy_id, action, prev_status, new_status, operator, notes, raw_input):
    audit = OccupancyAudit(
        occupancy_id=occupancy_id,
        action=action,
        previous_status=prev_status,
        new_status=new_status,
        operator=operator,
        notes=notes,
        raw_input=raw_input
    )
    db.session.add(audit)


def _update_queue_positions(env_id):
    pending = Occupancy.query.filter_by(
        env_id=env_id,
        status=OccupancyStatus.PENDING.value
    ).order_by(Occupancy.created_at, Occupancy.priority.desc()).all()
    for idx, occ in enumerate(pending, 1):
        occ.queue_position = idx


def _activate_next_in_queue(env_id):
    pending = Occupancy.query.filter_by(
        env_id=env_id,
        status=OccupancyStatus.PENDING.value
    ).order_by(Occupancy.created_at, Occupancy.priority.desc()).first()
    env = Environment.query.get(env_id)
    if pending and env:
        pending.status = OccupancyStatus.ACTIVE.value
        pending.started_at = datetime.utcnow()
        pending.estimated_release_at = datetime.utcnow() + timedelta(hours=pending.lease_duration_hours)
        env.current_occupancy_id = pending.id
        _update_queue_positions(env_id)
        _create_audit(pending.id, 'AUTO_ACTIVATE', OccupancyStatus.PENDING.value, pending.status, 'system', '队列自动激活下一个占用', '')


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': '服务器内部错误', 'details': str(error)}), 500


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)
