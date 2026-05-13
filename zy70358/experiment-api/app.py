from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import hashlib
import json
from collections import defaultdict

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///experiments.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)


class Experiment(db.Model):
    id = db.Column(db.String(100), primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(50), default='draft')  # draft, running, paused, stopped
    traffic_ratio = db.Column(db.Float, default=0.0)  # 0-100
    traffic_ratio_version = db.Column(db.Integer, default=1)
    groups = db.Column(db.Text, nullable=False)  # JSON: [{"name": "A", "ratio": 50}, {"name": "B", "ratio": 50}]
    mutex_group = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    stopped_at = db.Column(db.DateTime, nullable=True)
    description = db.Column(db.Text, nullable=True)


class UserAssignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), nullable=False, index=True)
    experiment_id = db.Column(db.String(100), db.ForeignKey('experiment.id'), nullable=False, index=True)
    group_name = db.Column(db.String(100), nullable=False)
    traffic_ratio_version = db.Column(db.Integer, default=1)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    mutex_conflict = db.Column(db.Boolean, default=False)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'experiment_id', name='unique_user_experiment'),
    )


class MetricReport(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(100), nullable=False, index=True)
    experiment_id = db.Column(db.String(100), db.ForeignKey('experiment.id'), nullable=False, index=True)
    group_name = db.Column(db.String(100), nullable=False)
    metric_name = db.Column(db.String(200), nullable=False)
    metric_value = db.Column(db.Float, nullable=False)
    reported_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'experiment_id', 'metric_name', name='unique_user_experiment_metric'),
    )


class ExperimentEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    experiment_id = db.Column(db.String(100), db.ForeignKey('experiment.id'), nullable=False, index=True)
    event_type = db.Column(db.String(100), nullable=False)  # created, started, paused, stopped, traffic_updated
    event_data = db.Column(db.Text, nullable=True)  # JSON
    event_at = db.Column(db.DateTime, default=datetime.utcnow)


with app.app_context():
    db.create_all()


def hash_user_to_bucket(user_id, salt, num_buckets=10000):
    """将用户ID哈希到0-9999的bucket"""
    hash_input = f"{user_id}:{salt}".encode('utf-8')
    hash_value = int(hashlib.md5(hash_input).hexdigest(), 16)
    return hash_value % num_buckets


def get_user_group_from_bucket(bucket, groups, traffic_ratio):
    """根据bucket和流量比例分配实验组"""
    traffic_threshold = (traffic_ratio / 100) * 10000
    
    if bucket >= traffic_threshold:
        return None  # 用户不在实验流量中
    
    ratio_in_experiment = bucket / traffic_threshold * 100
    
    cumulative_ratio = 0
    for group in groups:
        cumulative_ratio += group['ratio']
        if ratio_in_experiment <= cumulative_ratio:
            return group['name']
    
    return groups[-1]['name']


def check_mutex_conflict(user_id, experiment):
    """检查用户是否在同一互斥组的其他运行中实验中"""
    if not experiment.mutex_group:
        return False
    
    other_assignments = UserAssignment.query.filter(
        UserAssignment.user_id == user_id,
        UserAssignment.experiment_id != experiment.id,
        UserAssignment.mutex_conflict == False
    ).all()
    
    for assignment in other_assignments:
        other_exp = Experiment.query.get(assignment.experiment_id)
        if other_exp and other_exp.mutex_group == experiment.mutex_group and other_exp.status == 'running':
            return True
    
    return False


@app.route('/experiments', methods=['POST'])
def create_experiment():
    data = request.get_json()
    
    if not data.get('id') or not data.get('name') or not data.get('groups'):
        return jsonify({'error': 'Missing required fields: id, name, groups'}), 400
    
    existing = Experiment.query.get(data['id'])
    if existing:
        return jsonify({'error': 'Experiment ID already exists'}), 400
    
    groups = data['groups']
    total_ratio = sum(g['ratio'] for g in groups)
    if total_ratio != 100:
        return jsonify({'error': 'Group ratios must sum to 100'}), 400
    
    experiment = Experiment(
        id=data['id'],
        name=data['name'],
        groups=json.dumps(groups),
        traffic_ratio=data.get('traffic_ratio', 0),
        mutex_group=data.get('mutex_group'),
        description=data.get('description')
    )
    
    db.session.add(experiment)
    
    event = ExperimentEvent(
        experiment_id=experiment.id,
        event_type='created',
        event_data=json.dumps({
            'name': experiment.name,
            'groups': groups,
            'traffic_ratio': experiment.traffic_ratio,
            'mutex_group': experiment.mutex_group
        })
    )
    db.session.add(event)
    
    db.session.commit()
    
    return jsonify({
        'id': experiment.id,
        'name': experiment.name,
        'status': experiment.status,
        'traffic_ratio': experiment.traffic_ratio,
        'groups': groups,
        'mutex_group': experiment.mutex_group
    }), 201


@app.route('/experiments/<exp_id>/start', methods=['POST'])
def start_experiment(exp_id):
    experiment = Experiment.query.get(exp_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    if experiment.status != 'draft':
        return jsonify({'error': 'Only draft experiments can be started'}), 400
    
    if experiment.traffic_ratio <= 0:
        return jsonify({'error': 'Traffic ratio must be > 0 to start experiment'}), 400
    
    experiment.status = 'running'
    experiment.started_at = datetime.utcnow()
    
    event = ExperimentEvent(
        experiment_id=experiment.id,
        event_type='started',
        event_data=json.dumps({'traffic_ratio': experiment.traffic_ratio})
    )
    db.session.add(event)
    db.session.commit()
    
    return jsonify({
        'id': experiment.id,
        'status': experiment.status,
        'started_at': experiment.started_at.isoformat()
    }), 200


@app.route('/experiments/<exp_id>/traffic', methods=['PUT'])
def update_traffic(exp_id):
    experiment = Experiment.query.get(exp_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    if experiment.status != 'running':
        return jsonify({'error': 'Only running experiments can have traffic updated'}), 400
    
    data = request.get_json()
    new_ratio = data.get('traffic_ratio')
    
    if new_ratio is None or new_ratio < 0 or new_ratio > 100:
        return jsonify({'error': 'traffic_ratio must be between 0 and 100'}), 400
    
    old_ratio = experiment.traffic_ratio
    experiment.traffic_ratio = new_ratio
    experiment.traffic_ratio_version += 1
    
    event = ExperimentEvent(
        experiment_id=experiment.id,
        event_type='traffic_updated',
        event_data=json.dumps({
            'old_ratio': old_ratio,
            'new_ratio': new_ratio,
            'version': experiment.traffic_ratio_version
        })
    )
    db.session.add(event)
    db.session.commit()
    
    return jsonify({
        'id': experiment.id,
        'traffic_ratio': experiment.traffic_ratio,
        'traffic_ratio_version': experiment.traffic_ratio_version
    }), 200


@app.route('/experiments/<exp_id>/assign', methods=['POST'])
def assign_user(exp_id):
    experiment = Experiment.query.get(exp_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    data = request.get_json()
    user_id = data.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
    
    existing = UserAssignment.query.filter_by(
        user_id=user_id,
        experiment_id=exp_id
    ).first()
    
    if existing:
        return jsonify({
            'experiment_id': exp_id,
            'user_id': user_id,
            'group_name': existing.group_name,
            'assigned_at': existing.assigned_at.isoformat(),
            'is_new': False,
            'mutex_conflict': existing.mutex_conflict
        }), 200
    
    if experiment.status == 'stopped':
        return jsonify({
            'experiment_id': exp_id,
            'user_id': user_id,
            'group_name': None,
            'reason': 'experiment_stopped',
            'is_new': False,
            'mutex_conflict': False
        }), 200
    
    if experiment.status != 'running':
        return jsonify({
            'experiment_id': exp_id,
            'user_id': user_id,
            'group_name': None,
            'reason': 'experiment_not_running',
            'is_new': False,
            'mutex_conflict': False
        }), 200
    
    if check_mutex_conflict(user_id, experiment):
        conflict_assignment = UserAssignment(
            user_id=user_id,
            experiment_id=exp_id,
            group_name=None,
            traffic_ratio_version=experiment.traffic_ratio_version,
            mutex_conflict=True
        )
        db.session.add(conflict_assignment)
        db.session.commit()
        
        return jsonify({
            'experiment_id': exp_id,
            'user_id': user_id,
            'group_name': None,
            'reason': 'mutex_conflict',
            'is_new': True,
            'mutex_conflict': True
        }), 200
    
    bucket = hash_user_to_bucket(user_id, exp_id)
    groups = json.loads(experiment.groups)
    group_name = get_user_group_from_bucket(bucket, groups, experiment.traffic_ratio)
    
    if group_name is None:
        assignment = UserAssignment(
            user_id=user_id,
            experiment_id=exp_id,
            group_name=None,
            traffic_ratio_version=experiment.traffic_ratio_version,
            mutex_conflict=False
        )
        db.session.add(assignment)
        db.session.commit()
        
        return jsonify({
            'experiment_id': exp_id,
            'user_id': user_id,
            'group_name': None,
            'reason': 'not_in_traffic',
            'is_new': True,
            'mutex_conflict': False
        }), 200
    
    assignment = UserAssignment(
        user_id=user_id,
        experiment_id=exp_id,
        group_name=group_name,
        traffic_ratio_version=experiment.traffic_ratio_version,
        mutex_conflict=False
    )
    db.session.add(assignment)
    db.session.commit()
    
    return jsonify({
        'experiment_id': exp_id,
        'user_id': user_id,
        'group_name': group_name,
        'assigned_at': assignment.assigned_at.isoformat(),
        'is_new': True,
        'mutex_conflict': False
    }), 200


@app.route('/experiments/<exp_id>/metrics', methods=['POST'])
def report_metric(exp_id):
    experiment = Experiment.query.get(exp_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    data = request.get_json()
    user_id = data.get('user_id')
    metric_name = data.get('metric_name')
    metric_value = data.get('metric_value')
    
    if not all([user_id, metric_name, metric_value is not None]):
        return jsonify({'error': 'Missing required fields: user_id, metric_name, metric_value'}), 400
    
    assignment = UserAssignment.query.filter_by(
        user_id=user_id,
        experiment_id=exp_id
    ).first()
    
    if not assignment or not assignment.group_name:
        return jsonify({
            'error': 'User is not assigned to a valid group in this experiment'
        }), 400
    
    try:
        metric_value = float(metric_value)
    except (TypeError, ValueError):
        return jsonify({'error': 'metric_value must be a number'}), 400
    
    existing = MetricReport.query.filter_by(
        user_id=user_id,
        experiment_id=exp_id,
        metric_name=metric_name
    ).first()
    
    if existing:
        return jsonify({
            'experiment_id': exp_id,
            'user_id': user_id,
            'metric_name': metric_name,
            'metric_value': existing.metric_value,
            'reported_at': existing.reported_at.isoformat(),
            'is_new': False
        }), 200
    
    report = MetricReport(
        user_id=user_id,
        experiment_id=exp_id,
        group_name=assignment.group_name,
        metric_name=metric_name,
        metric_value=metric_value
    )
    db.session.add(report)
    db.session.commit()
    
    return jsonify({
        'experiment_id': exp_id,
        'user_id': user_id,
        'metric_name': metric_name,
        'metric_value': report.metric_value,
        'reported_at': report.reported_at.isoformat(),
        'is_new': True
    }), 201


@app.route('/experiments/<exp_id>/pause', methods=['POST'])
def pause_experiment(exp_id):
    experiment = Experiment.query.get(exp_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    if experiment.status != 'running':
        return jsonify({'error': 'Only running experiments can be paused'}), 400
    
    experiment.status = 'paused'
    
    event = ExperimentEvent(
        experiment_id=experiment.id,
        event_type='paused'
    )
    db.session.add(event)
    db.session.commit()
    
    return jsonify({
        'id': experiment.id,
        'status': experiment.status
    }), 200


@app.route('/experiments/<exp_id>/resume', methods=['POST'])
def resume_experiment(exp_id):
    experiment = Experiment.query.get(exp_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    if experiment.status != 'paused':
        return jsonify({'error': 'Only paused experiments can be resumed'}), 400
    
    experiment.status = 'running'
    
    event = ExperimentEvent(
        experiment_id=experiment.id,
        event_type='started'
    )
    db.session.add(event)
    db.session.commit()
    
    return jsonify({
        'id': experiment.id,
        'status': experiment.status
    }), 200


@app.route('/experiments/<exp_id>/stop', methods=['POST'])
def stop_experiment(exp_id):
    experiment = Experiment.query.get(exp_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    if experiment.status in ['stopped', 'draft']:
        return jsonify({'error': 'Experiment is already stopped or not started'}), 400
    
    data = request.get_json() or {}
    is_early_stop = data.get('early_stop', False)
    
    experiment.status = 'stopped'
    experiment.stopped_at = datetime.utcnow()
    
    event = ExperimentEvent(
        experiment_id=experiment.id,
        event_type='stopped',
        event_data=json.dumps({'early_stop': is_early_stop})
    )
    db.session.add(event)
    db.session.commit()
    
    return jsonify({
        'id': experiment.id,
        'status': experiment.status,
        'stopped_at': experiment.stopped_at.isoformat(),
        'early_stop': is_early_stop
    }), 200


@app.route('/experiments/<exp_id>/results', methods=['GET'])
def get_experiment_results(exp_id):
    experiment = Experiment.query.get(exp_id)
    if not experiment:
        return jsonify({'error': 'Experiment not found'}), 404
    
    groups = json.loads(experiment.groups)
    group_names = [g['name'] for g in groups]
    
    total_users = UserAssignment.query.filter_by(experiment_id=exp_id).count()
    assigned_users = UserAssignment.query.filter(
        UserAssignment.experiment_id == exp_id,
        UserAssignment.group_name.isnot(None)
    ).count()
    conflict_users = UserAssignment.query.filter_by(
        experiment_id=exp_id,
        mutex_conflict=True
    ).count()
    
    group_stats = {}
    for group_name in group_names:
        users_in_group = UserAssignment.query.filter_by(
            experiment_id=exp_id,
            group_name=group_name
        ).count()
        
        metrics_in_group = MetricReport.query.filter_by(
            experiment_id=exp_id,
            group_name=group_name
        ).all()
        
        metric_summary = defaultdict(lambda: {'count': 0, 'sum': 0, 'avg': 0, 'min': None, 'max': None})
        
        for metric in metrics_in_group:
            m = metric_summary[metric.metric_name]
            m['count'] += 1
            m['sum'] += metric.metric_value
            if m['min'] is None or metric.metric_value < m['min']:
                m['min'] = metric.metric_value
            if m['max'] is None or metric.metric_value > m['max']:
                m['max'] = metric.metric_value
        
        for name in metric_summary:
            m = metric_summary[name]
            m['avg'] = m['sum'] / m['count'] if m['count'] > 0 else 0
        
        metric_gap = users_in_group - sum(m['count'] for m in metric_summary.values()) if metric_summary else users_in_group
        
        group_stats[group_name] = {
            'users': users_in_group,
            'metrics': dict(metric_summary),
            'metric_gap': metric_gap
        }
    
    events = ExperimentEvent.query.filter_by(experiment_id=exp_id).order_by(ExperimentEvent.event_at).all()
    timeline = [
        {
            'event_type': e.event_type,
            'event_at': e.event_at.isoformat(),
            'event_data': json.loads(e.event_data) if e.event_data else None
        }
        for e in events
    ]
    
    return jsonify({
        'experiment_id': experiment.id,
        'experiment_name': experiment.name,
        'status': experiment.status,
        'traffic_ratio': experiment.traffic_ratio,
        'created_at': experiment.created_at.isoformat() if experiment.created_at else None,
        'started_at': experiment.started_at.isoformat() if experiment.started_at else None,
        'stopped_at': experiment.stopped_at.isoformat() if experiment.stopped_at else None,
        'groups': groups,
        'summary': {
            'total_users_seen': total_users,
            'assigned_users': assigned_users,
            'mutex_conflicts': conflict_users,
            'unassigned_users': total_users - assigned_users - conflict_users
        },
        'group_stats': group_stats,
        'timeline': timeline
    }), 200


@app.route('/experiments', methods=['GET'])
def list_experiments():
    experiments = Experiment.query.order_by(Experiment.created_at.desc()).all()
    return jsonify([
        {
            'id': exp.id,
            'name': exp.name,
            'status': exp.status,
            'traffic_ratio': exp.traffic_ratio,
            'mutex_group': exp.mutex_group,
            'created_at': exp.created_at.isoformat(),
            'started_at': exp.started_at.isoformat() if exp.started_at else None,
            'stopped_at': exp.stopped_at.isoformat() if exp.stopped_at else None
        }
        for exp in experiments
    ]), 200


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
