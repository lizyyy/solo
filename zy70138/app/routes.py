
import os
import csv
import json
from datetime import datetime, timedelta
from io import StringIO
from flask import Blueprint, request, jsonify, Response
from sqlalchemy.exc import IntegrityError

from app.models import db, Experiment, ExperimentVersion, Treatment, UserAssignment
from app.models import ExperimentMetric, OperationLog, VersionConflict
from app.services import BucketingService, VersionFreezeService, ConflictDetectionService
from app.services import RetryPolicy, AttributionService
from config import Config

api = Blueprint('api', __name__)


def _log_operation(operation_type, resource_type, resource_id, operator, 
                   old_value=None, new_value=None):
    log = OperationLog(
        operation_type=operation_type,
        resource_type=resource_type,
        resource_id=str(resource_id),
        old_value=json.dumps(old_value) if old_value else None,
        new_value=json.dumps(new_value) if new_value else None,
        operator=operator,
        status='pending'
    )
    db.session.add(log)
    db.session.flush()
    return log


@api.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})


# ----------------------
# 实验配置管理
# ----------------------

@api.route('/experiments', methods=['GET'])
def list_experiments():
    status = request.args.get('status')
    query = Experiment.query
    if status:
        query = query.filter_by(status=status)
    experiments = query.order_by(Experiment.updated_at.desc()).all()
    return jsonify([e.to_dict() for e in experiments])


@api.route('/experiments', methods=['POST'])
def create_experiment():
    data = request.get_json() or {}
    
    if not data.get('id'):
        return jsonify({'error': '缺少必需字段: id'}), 400
    if not data.get('name'):
        return jsonify({'error': '缺少必需字段: name'}), 400
    
    try:
        experiment = Experiment(
            id=data['id'],
            name=data['name'],
            description=data.get('description'),
            status=data.get('status', 'draft'),
            created_by=data.get('created_by')
        )
        db.session.add(experiment)
        
        _log_operation('create_experiment', 'experiment', data['id'], 
                      data.get('created_by'), new_value=data)
        
        db.session.commit()
        
        logs = OperationLog.query.filter_by(
            resource_type='experiment',
            resource_id=data['id']
        ).order_by(OperationLog.created_at.desc()).all()
        for log in logs:
            log.status = 'success'
            log.completed_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(experiment.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': f'实验ID {data["id"]} 已存在'}), 409


@api.route('/experiments/<experiment_id>', methods=['GET'])
def get_experiment(experiment_id):
    experiment = Experiment.query.get(experiment_id)
    if not experiment:
        return jsonify({'error': '实验不存在'}), 404
    
    result = experiment.to_dict()
    result['versions'] = [v.to_dict() for v in experiment.versions]
    return jsonify(result)


# ----------------------
# 版本管理
# ----------------------

@api.route('/experiments/<experiment_id>/versions', methods=['POST'])
def create_version(experiment_id):
    experiment = Experiment.query.get(experiment_id)
    if not experiment:
        return jsonify({'error': '实验不存在'}), 404
    
    data = request.get_json() or {}
    
    latest_version = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id
    ).order_by(ExperimentVersion.version_number.desc()).first()
    
    new_version_number = 1 if not latest_version else latest_version.version_number + 1
    
    old_version = latest_version
    old_treatments = []
    if old_version:
        old_treatments = [t.to_dict() for t in old_version.treatments]
    
    effective_start_str = data.get('effective_start')
    if effective_start_str:
        effective_start = datetime.fromisoformat(effective_start_str.replace('Z', '+00:00'))
    else:
        effective_start = datetime.utcnow()
    
    version = ExperimentVersion(
        experiment_id=experiment_id,
        version_number=new_version_number,
        bucket_strategy=data.get('bucket_strategy', 'hash_mod'),
        bucket_key=data.get('bucket_key', 'user_id'),
        bucket_count=data.get('bucket_count', Config.BUCKET_COUNT),
        treatment_config=json.dumps(data.get('treatments', [])),
        effective_start=effective_start,
        effective_end=None,
        created_by=data.get('created_by')
    )
    db.session.add(version)
    db.session.flush()
    
    new_treatments = data.get('treatments', [])
    for t_data in new_treatments:
        treatment = Treatment(
            version_id=version.id,
            name=t_data['name'],
            label=t_data.get('label'),
            bucket_start=t_data['bucket_start'],
            bucket_end=t_data['bucket_end'],
            traffic_percent=t_data['traffic_percent'],
            parameters=json.dumps(t_data.get('parameters')) if t_data.get('parameters') else None,
            is_control=t_data.get('is_control', False)
        )
        db.session.add(treatment)
    
    new_treatments_dict = [
        {
            'name': t['name'],
            'bucket_start': t['bucket_start'],
            'bucket_end': t['bucket_end'],
            'traffic_percent': t['traffic_percent'],
            'is_control': t.get('is_control', False)
        }
        for t in new_treatments
    ]
    
    if old_version:
        conflict_result = ConflictDetectionService.check_version_conflict(
            version, old_version, new_treatments_dict, old_treatments
        )
        
        if conflict_result['has_conflicts']:
            conflict = VersionConflict(
                experiment_id=experiment_id,
                version_id=version.id,
                conflict_type='version_upgrade',
                conflict_description=json.dumps(conflict_result['conflicts']),
                affected_users_count=UserAssignment.query.filter_by(
                    version_id=old_version.id
                ).count(),
                affected_metrics_count=ExperimentMetric.query.filter_by(
                    version_id=old_version.id
                ).count(),
                status='open'
            )
            db.session.add(conflict)
    
    _log_operation('create_version', 'version', f'{experiment_id}:{new_version_number}',
                  data.get('created_by'), new_value=data)
    
    db.session.commit()
    
    logs = OperationLog.query.filter_by(
        resource_type='version',
        resource_id=f'{experiment_id}:{new_version_number}'
    ).order_by(OperationLog.created_at.desc()).all()
    for log in logs:
        log.status = 'success'
        log.completed_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(version.to_dict()), 201


@api.route('/experiments/<experiment_id>/versions/<int:version_number>', methods=['GET'])
def get_version(experiment_id, version_number):
    version = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id,
        version_number=version_number
    ).first()
    
    if not version:
        return jsonify({'error': '版本不存在'}), 404
    
    result = version.to_dict()
    result['treatments'] = [t.to_dict() for t in version.treatments]
    return jsonify(result)


# ----------------------
# 版本冻结
# ----------------------

@api.route('/experiments/<experiment_id>/versions/<int:version_number>/freeze', methods=['POST'])
def freeze_version(experiment_id, version_number):
    version = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id,
        version_number=version_number
    ).first()
    
    if not version:
        return jsonify({'error': '版本不存在'}), 404
    
    data = request.get_json() or {}
    operator = data.get('operator')
    
    assignments_count = UserAssignment.query.filter_by(version_id=version.id).count()
    freeze_check = VersionFreezeService.validate_freeze_ready(version, assignments_count)
    
    log = _log_operation('freeze_version', 'version', 
                        f'{experiment_id}:{version_number}', operator)
    
    if not freeze_check['ready']:
        log.status = 'failed'
        log.message = json.dumps({'issues': freeze_check['issues']})
        log.completed_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            'error': '版本不满足冻结条件',
            'issues': freeze_check['issues'],
            'existing_assignments': freeze_check['existing_assignments']
        }), 400
    
    version.is_frozen = True
    version.frozen_at = datetime.utcnow()
    version.frozen_by = operator
    
    log.status = 'success'
    log.completed_at = datetime.utcnow()
    
    experiment = Experiment.query.get(experiment_id)
    if experiment and experiment.status == 'draft':
        experiment.status = 'running'
        experiment.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({
        'version': version.to_dict(),
        'frozen_at': version.frozen_at.isoformat(),
        'existing_assignments': assignments_count
    })


@api.route('/experiments/<experiment_id>/versions/<int:version_number>/unfreeze', methods=['POST'])
def unfreeze_version(experiment_id, version_number):
    version = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id,
        version_number=version_number
    ).first()
    
    if not version:
        return jsonify({'error': '版本不存在'}), 404
    
    data = request.get_json() or {}
    operator = data.get('operator')
    reason = data.get('reason', '')
    
    log = _log_operation('unfreeze_version', 'version',
                        f'{experiment_id}:{version_number}', operator)
    
    assignments_count = UserAssignment.query.filter_by(version_id=version.id).count()
    elapsed_hours = 0
    if version.frozen_at:
        elapsed = datetime.utcnow() - version.frozen_at
        elapsed_hours = elapsed.total_seconds() / 3600
    
    unfreeze_check = VersionFreezeService.can_unfreeze(version, elapsed_hours, assignments_count)
    
    if not unfreeze_check['can_unfreeze']:
        log.status = 'failed'
        log.message = json.dumps({'issues': unfreeze_check['issues']})
        log.completed_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            'error': '无法撤销冻结',
            'issues': unfreeze_check['issues']
        }), 400
    
    affected_assignments = UserAssignment.query.filter_by(version_id=version.id).all()
    affected_user_ids = [ua.user_id for ua in affected_assignments]
    
    version.is_frozen = False
    version.frozen_at = None
    version.frozen_by = None
    
    for ua in affected_assignments:
        db.session.delete(ua)
    
    conflict = VersionConflict(
        experiment_id=experiment_id,
        version_id=version.id,
        conflict_type='unfreeze_rollback',
        conflict_description=f'撤销冻结原因: {reason}',
        affected_users_count=assignments_count,
        affected_metrics_count=ExperimentMetric.query.filter_by(
            version_id=version.id
        ).count(),
        status='resolved',
        resolution=json.dumps({
            'action': 'unfreeze',
            'reason': reason,
            'elapsed_hours': elapsed_hours,
            'affected_users': affected_user_ids[:100]
        }),
        resolved_at=datetime.utcnow()
    )
    db.session.add(conflict)
    
    log.status = 'success'
    log.completed_at = datetime.utcnow()
    log.message = json.dumps({
        'reason': reason,
        'elapsed_hours': elapsed_hours,
        'cleared_assignments': assignments_count
    })
    
    db.session.commit()
    
    return jsonify({
        'version': version.to_dict(),
        'unfrozen_at': datetime.utcnow().isoformat(),
        'cleared_assignments': assignments_count
    })


# ----------------------
# 分桶查询
# ----------------------

@api.route('/experiments/<experiment_id>/assign', methods=['POST'])
def assign_user(experiment_id):
    data = request.get_json() or {}
    user_id = data.get('user_id')
    operator = data.get('operator')
    
    if not user_id:
        return jsonify({'error': '缺少必需字段: user_id'}), 400
    
    active_version = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id,
        is_frozen=True
    ).order_by(ExperimentVersion.version_number.desc()).first()
    
    if not active_version:
        return jsonify({'error': '没有已冻结的版本可用于分桶'}), 400
    
    existing = UserAssignment.query.filter_by(
        version_id=active_version.id,
        user_id=user_id
    ).first()
    
    if existing:
        return jsonify({
            'experiment_id': experiment_id,
            'user_id': user_id,
            'treatment_name': existing.treatment_name,
            'bucket_number': existing.bucket_number,
            'version_number': active_version.version_number,
            'assigned_at': existing.assigned_at.isoformat(),
            'is_new_assignment': False
        })
    
    bucket = BucketingService.compute_bucket(user_id, experiment_id)
    
    treatments = [t.to_dict() for t in active_version.treatments]
    treatment = BucketingService.get_treatment_for_bucket(bucket, treatments)
    
    if not treatment:
        return jsonify({
            'error': '用户未落入任何实验分组',
            'bucket': bucket
        }), 404
    
    assignment = UserAssignment(
        version_id=active_version.id,
        user_id=user_id,
        bucket_number=bucket,
        treatment_name=treatment['name'],
        assignment_source='real_time',
        assigned_at=datetime.utcnow()
    )
    db.session.add(assignment)
    db.session.commit()
    
    return jsonify({
        'experiment_id': experiment_id,
        'user_id': user_id,
        'treatment_name': assignment.treatment_name,
        'bucket_number': assignment.bucket_number,
        'version_number': active_version.version_number,
        'assigned_at': assignment.assigned_at.isoformat(),
        'is_new_assignment': True
    })


@api.route('/experiments/<experiment_id>/assign/batch', methods=['POST'])
def batch_assign_users(experiment_id):
    data = request.get_json() or {}
    user_ids = data.get('user_ids', [])
    operator = data.get('operator')
    
    if not user_ids:
        return jsonify({'error': '缺少必需字段: user_ids'}), 400
    
    active_version = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id,
        is_frozen=True
    ).order_by(ExperimentVersion.version_number.desc()).first()
    
    if not active_version:
        return jsonify({'error': '没有已冻结的版本可用于分桶'}), 400
    
    existing_assignments = {
        ua.user_id: ua
        for ua in UserAssignment.query.filter(
            UserAssignment.version_id == active_version.id,
            UserAssignment.user_id.in_(user_ids)
        ).all()
    }
    
    treatments = [t.to_dict() for t in active_version.treatments]
    results = []
    new_assignments = []
    
    for user_id in user_ids:
        if user_id in existing_assignments:
            existing = existing_assignments[user_id]
            results.append({
                'user_id': user_id,
                'treatment_name': existing.treatment_name,
                'bucket_number': existing.bucket_number,
                'is_new': False
            })
        else:
            bucket = BucketingService.compute_bucket(user_id, experiment_id)
            treatment = BucketingService.get_treatment_for_bucket(bucket, treatments)
            
            if treatment:
                assignment = UserAssignment(
                    version_id=active_version.id,
                    user_id=user_id,
                    bucket_number=bucket,
                    treatment_name=treatment['name'],
                    assignment_source='batch',
                    assigned_at=datetime.utcnow()
                )
                new_assignments.append(assignment)
                results.append({
                    'user_id': user_id,
                    'treatment_name': treatment['name'],
                    'bucket_number': bucket,
                    'is_new': True
                })
            else:
                results.append({
                    'user_id': user_id,
                    'error': '未落入任何分组',
                    'bucket': bucket,
                    'is_new': False
                })
    
    if new_assignments:
        db.session.bulk_save_objects(new_assignments)
        db.session.commit()
    
    return jsonify({
        'version_number': active_version.version_number,
        'total': len(user_ids),
        'new_assignments': len(new_assignments),
        'results': results
    })


# ----------------------
# 回溯查询
# ----------------------

@api.route('/experiments/<experiment_id>/backfill', methods=['POST'])
def backfill_assignment(experiment_id):
    data = request.get_json() or {}
    user_id = data.get('user_id')
    event_time_str = data.get('event_time')
    
    if not user_id or not event_time_str:
        return jsonify({'error': '缺少必需字段: user_id, event_time'}), 400
    
    try:
        event_time = datetime.fromisoformat(event_time_str.replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'error': 'event_time 格式错误，请使用 ISO 格式'}), 400
    
    versions = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id
    ).order_by(ExperimentVersion.version_number.desc()).all()
    
    attribution = AttributionService.attribute_metric(user_id, event_time, versions)
    
    if attribution:
        return jsonify({
            'experiment_id': experiment_id,
            'user_id': user_id,
            'event_time': event_time_str,
            **attribution
        })
    
    return jsonify({
        'error': '无法找到匹配的版本进行归因',
        'experiment_id': experiment_id,
        'user_id': user_id,
        'event_time': event_time_str
    }), 404


@api.route('/experiments/<experiment_id>/users/<user_id>/history', methods=['GET'])
def get_user_assignment_history(experiment_id, user_id):
    versions = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id
    ).all()
    
    version_ids = [v.id for v in versions]
    
    assignments = UserAssignment.query.filter(
        UserAssignment.version_id.in_(version_ids),
        UserAssignment.user_id == user_id
    ).all()
    
    version_map = {v.id: v.version_number for v in versions}
    
    history = []
    for ua in assignments:
        history.append({
            'version_number': version_map.get(ua.version_id),
            'treatment_name': ua.treatment_name,
            'bucket_number': ua.bucket_number,
            'assigned_at': ua.assigned_at.isoformat(),
            'assignment_source': ua.assignment_source
        })
    
    return jsonify({
        'experiment_id': experiment_id,
        'user_id': user_id,
        'history': sorted(history, key=lambda x: x['version_number'])
    })


# ----------------------
# 指标归因
# ----------------------

@api.route('/experiments/<experiment_id>/metrics', methods=['POST'])
def record_metric(experiment_id):
    data = request.get_json() or {}
    user_id = data.get('user_id')
    metric_name = data.get('metric_name')
    metric_value = data.get('metric_value')
    event_time_str = data.get('event_time')
    
    if not all([user_id, metric_name, event_time_str]):
        return jsonify({'error': '缺少必需字段'}), 400
    
    try:
        event_time = datetime.fromisoformat(event_time_str.replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'error': 'event_time 格式错误'}), 400
    
    versions = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id
    ).order_by(ExperimentVersion.version_number.desc()).all()
    
    attribution = AttributionService.attribute_metric(user_id, event_time, versions)
    
    if not attribution:
        return jsonify({
            'error': '无法归因到任何实验版本',
            'suggestion': '请检查版本生效时间范围'
        }), 404
    
    metric = ExperimentMetric(
        version_id=attribution['version_id'],
        user_id=user_id,
        metric_name=metric_name,
        metric_value=float(metric_value),
        treatment_name=attribution['treatment_name'],
        attribution_version=attribution['version_number'],
        event_time=event_time,
        attributed_at=datetime.utcnow()
    )
    db.session.add(metric)
    db.session.commit()
    
    return jsonify({
        'metric_id': metric.id,
        **attribution,
        'metric_name': metric_name,
        'metric_value': metric_value,
        'event_time': event_time_str,
        'attributed_at': metric.attributed_at.isoformat()
    })


@api.route('/experiments/<experiment_id>/metrics/<metric_name>/aggregate', methods=['GET'])
def aggregate_metrics(experiment_id, metric_name):
    start_str = request.args.get('start')
    end_str = request.args.get('end')
    version_num = request.args.get('version')
    
    query = ExperimentVersion.query.filter_by(experiment_id=experiment_id)
    if version_num:
        query = query.filter_by(version_number=int(version_num))
    else:
        query = query.filter_by(is_frozen=True)
    
    versions = query.all()
    
    if not versions:
        return jsonify({'error': '没有找到符合条件的版本'}), 404
    
    results = {}
    for version in versions:
        treatment_stats = {}
        
        metrics_query = ExperimentMetric.query.filter_by(
            version_id=version.id,
            metric_name=metric_name
        )
        
        if start_str:
            try:
                start = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                metrics_query = metrics_query.filter(ExperimentMetric.event_time >= start)
            except ValueError:
                pass
        
        if end_str:
            try:
                end = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
                metrics_query = metrics_query.filter(ExperimentMetric.event_time <= end)
            except ValueError:
                pass
        
        metrics = metrics_query.all()
        
        for m in metrics:
            t = m.treatment_name
            if t not in treatment_stats:
                treatment_stats[t] = {
                    'count': 0,
                    'sum': 0.0,
                    'values': []
                }
            treatment_stats[t]['count'] += 1
            treatment_stats[t]['sum'] += m.metric_value
            treatment_stats[t]['values'].append(m.metric_value)
        
        version_result = {}
        for treatment, stats in treatment_stats.items():
            version_result[treatment] = {
                'count': stats['count'],
                'sum': stats['sum'],
                'mean': stats['sum'] / stats['count'] if stats['count'] > 0 else 0,
                'min': min(stats['values']) if stats['values'] else 0,
                'max': max(stats['values']) if stats['values'] else 0
            }
        
        results[str(version.version_number)] = version_result
    
    return jsonify({
        'experiment_id': experiment_id,
        'metric_name': metric_name,
        'results': results
    })


# ----------------------
# 差异报告
# ----------------------

@api.route('/experiments/<experiment_id>/diff/<int:v1>/<int:v2>', methods=['GET'])
def version_diff(experiment_id, v1, v2):
    version1 = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id, version_number=v1
    ).first()
    version2 = ExperimentVersion.query.filter_by(
        experiment_id=experiment_id, version_number=v2
    ).first()
    
    if not version1 or not version2:
        return jsonify({'error': '版本不存在'}), 404
    
    conflict_result = ConflictDetectionService.check_version_conflict(
        version2, version1,
        [t.to_dict() for t in version2.treatments],
        [t.to_dict() for t in version1.treatments]
    )
    
    v1_users = UserAssignment.query.filter_by(version_id=version1.id).count()
    v2_users = UserAssignment.query.filter_by(version_id=version2.id).count()
    
    v1_assignments = {ua.user_id: ua for ua in UserAssignment.query.filter_by(
        version_id=version1.id
    ).all()}
    v2_assignments = {ua.user_id: ua for ua in UserAssignment.query.filter_by(
        version_id=version2.id
    ).all()}
    
    common_users = set(v1_assignments.keys()) & set(v2_assignments.keys())
    changed_users = []
    for user_id in common_users:
        if v1_assignments[user_id].treatment_name != v2_assignments[user_id].treatment_name:
            changed_users.append({
                'user_id': user_id,
                'from_treatment': v1_assignments[user_id].treatment_name,
                'to_treatment': v2_assignments[user_id].treatment_name
            })
    
    return jsonify({
        'experiment_id': experiment_id,
        'version_from': v1,
        'version_to': v2,
        'conflicts': conflict_result,
        'user_migration': {
            'v1_total': v1_users,
            'v2_total': v2_users,
            'common_users': len(common_users),
            'changed_users_count': len(changed_users),
            'changed_samples': changed_users[:50]
        }
    })


# ----------------------
# 导出功能
# ----------------------

@api.route('/experiments/<experiment_id>/export', methods=['GET'])
def export_experiment_data(experiment_id):
    export_type = request.args.get('type', 'assignments')
    version_num = request.args.get('version')
    
    experiment = Experiment.query.get(experiment_id)
    if not experiment:
        return jsonify({'error': '实验不存在'}), 404
    
    if version_num:
        version = ExperimentVersion.query.filter_by(
            experiment_id=experiment_id,
            version_number=int(version_num)
        ).first()
        if not version:
            return jsonify({'error': '版本不存在'}), 404
        versions = [version]
    else:
        versions = ExperimentVersion.query.filter_by(
            experiment_id=experiment_id
        ).all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    if export_type == 'assignments':
        writer.writerow([
            '实验ID', '实验名称', '版本号', '用户ID', '分桶号',
            '分组名称', '分配时间', '分配来源'
        ])
        
        for v in versions:
            assignments = UserAssignment.query.filter_by(version_id=v.id).all()
            for ua in assignments:
                writer.writerow([
                    experiment_id,
                    experiment.name,
                    v.version_number,
                    ua.user_id,
                    ua.bucket_number,
                    ua.treatment_name,
                    ua.assigned_at.isoformat(),
                    ua.assignment_source
                ])
    
    elif export_type == 'metrics':
        metric_name = request.args.get('metric')
        writer.writerow([
            '实验ID', '实验名称', '版本号', '用户ID', '指标名称',
            '指标值', '分组名称', '事件时间', '归因时间'
        ])
        
        for v in versions:
            query = ExperimentMetric.query.filter_by(version_id=v.id)
            if metric_name:
                query = query.filter_by(metric_name=metric_name)
            metrics = query.all()
            for m in metrics:
                writer.writerow([
                    experiment_id,
                    experiment.name,
                    v.version_number,
                    m.user_id,
                    m.metric_name,
                    m.metric_value,
                    m.treatment_name,
                    m.event_time.isoformat(),
                    m.attributed_at.isoformat()
                ])
    
    elif export_type == 'versions':
        writer.writerow([
            '实验ID', '实验名称', '版本号', '分组名称', '分桶范围',
            '流量占比', '是否对照组', '是否冻结', '生效开始', '生效结束'
        ])
        
        for v in versions:
            for t in v.treatments:
                writer.writerow([
                    experiment_id,
                    experiment.name,
                    v.version_number,
                    t.name,
                    f'{t.bucket_start}-{t.bucket_end}',
                    t.traffic_percent,
                    '是' if t.is_control else '否',
                    '是' if v.is_frozen else '否',
                    v.effective_start.isoformat() if v.effective_start else '',
                    v.effective_end.isoformat() if v.effective_end else ''
                ])
    
    else:
        return jsonify({'error': '不支持的导出类型'}), 400
    
    output.seek(0)
    csv_content = output.getvalue()
    
    return Response(
        csv_content,
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename={experiment_id}_{export_type}_{datetime.utcnow().strftime("%Y%m%d")}.csv'
        }
    )


# ----------------------
# 操作记录与冲突
# ----------------------

@api.route('/operations', methods=['GET'])
def list_operations():
    resource_type = request.args.get('resource_type')
    status = request.args.get('status')
    limit = int(request.args.get('limit', 100))
    
    query = OperationLog.query.order_by(OperationLog.created_at.desc())
    
    if resource_type:
        query = query.filter_by(resource_type=resource_type)
    if status:
        query = query.filter_by(status=status)
    
    logs = query.limit(limit).all()
    return jsonify([log.to_dict() for log in logs])


@api.route('/operations/<int:log_id>/retry', methods=['POST'])
def retry_operation(log_id):
    log = OperationLog.query.get(log_id)
    if not log:
        return jsonify({'error': '操作记录不存在'}), 404
    
    if log.status == 'success':
        return jsonify({'error': '操作已成功，无需重试'}), 400
    
    if not RetryPolicy.should_retry(log.status, log.retry_count):
        return jsonify({
            'error': '已达到最大重试次数',
            'max_attempts': Config.RETRY_MAX_ATTEMPTS,
            'current_attempts': log.retry_count
        }), 400
    
    log.retry_count += 1
    log.status = 'pending'
    log.next_retry_at = datetime.utcnow() + timedelta(
        seconds=RetryPolicy.get_next_retry_delay(log.retry_count)
    )
    db.session.commit()
    
    return jsonify({
        'log_id': log.id,
        'retry_count': log.retry_count,
        'next_retry_at': log.next_retry_at.isoformat(),
        'status': 'pending'
    })


@api.route('/experiments/<experiment_id>/conflicts', methods=['GET'])
def list_conflicts(experiment_id):
    status = request.args.get('status')
    
    query = VersionConflict.query.filter_by(
        experiment_id=experiment_id
    ).order_by(VersionConflict.detected_at.desc())
    
    if status:
        query = query.filter_by(status=status)
    
    conflicts = query.all()
    return jsonify([c.to_dict() for c in conflicts])


@api.route('/conflicts/<int:conflict_id>/resolve', methods=['POST'])
def resolve_conflict(conflict_id):
    conflict = VersionConflict.query.get(conflict_id)
    if not conflict:
        return jsonify({'error': '冲突记录不存在'}), 404
    
    data = request.get_json() or {}
    resolution = data.get('resolution')
    operator = data.get('operator')
    
    if not resolution:
        return jsonify({'error': '缺少必需字段: resolution'}), 400
    
    conflict.resolution = json.dumps({
        'decision': resolution,
        'resolved_by': operator,
        'resolved_at': datetime.utcnow().isoformat()
    })
    conflict.resolved_at = datetime.utcnow()
    conflict.status = 'resolved'
    
    db.session.commit()
    
    return jsonify(conflict.to_dict())
