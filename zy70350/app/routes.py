from flask import Blueprint, request, jsonify
from app import db
from app.models import Dataset, QualityRule, CheckTask, CheckResult, AnomalySample, DailyReport
from app.utils import generate_task_hash, validate_threshold_config, success_response, error_response
from app.check_engine import CheckEngine
from datetime import datetime, date, timedelta
import json

api_bp = Blueprint('api', __name__)
check_engine = CheckEngine()

@api_bp.route('/datasets', methods=['GET'])
def list_datasets():
    datasets = Dataset.query.all()
    return success_response([d.to_dict() for d in datasets])

@api_bp.route('/datasets', methods=['POST'])
def create_dataset():
    data = request.get_json()
    
    required_fields = ['name', 'source_type', 'connection_info', 'table_name']
    for field in required_fields:
        if field not in data:
            return error_response(f"缺少必填字段: {field}")
    
    dataset = Dataset(
        name=data['name'],
        description=data.get('description', ''),
        source_type=data['source_type'],
        connection_info=data['connection_info'],
        table_name=data['table_name']
    )
    
    db.session.add(dataset)
    db.session.commit()
    
    return success_response(dataset.to_dict(), "数据集创建成功")

@api_bp.route('/datasets/<int:dataset_id>', methods=['GET'])
def get_dataset(dataset_id):
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return error_response("数据集不存在", code=404)
    return success_response(dataset.to_dict())

@api_bp.route('/datasets/<int:dataset_id>', methods=['PUT'])
def update_dataset(dataset_id):
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return error_response("数据集不存在", code=404)
    
    data = request.get_json()
    
    if 'name' in data:
        dataset.name = data['name']
    if 'description' in data:
        dataset.description = data['description']
    if 'source_type' in data:
        dataset.source_type = data['source_type']
    if 'connection_info' in data:
        dataset.connection_info = data['connection_info']
    if 'table_name' in data:
        dataset.table_name = data['table_name']
    
    db.session.commit()
    return success_response(dataset.to_dict(), "数据集更新成功")

@api_bp.route('/datasets/<int:dataset_id>', methods=['DELETE'])
def delete_dataset(dataset_id):
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return error_response("数据集不存在", code=404)
    
    db.session.delete(dataset)
    db.session.commit()
    return success_response(message="数据集删除成功")

@api_bp.route('/datasets/<int:dataset_id>/rules', methods=['GET'])
def list_dataset_rules(dataset_id):
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return error_response("数据集不存在", code=404)
    
    rules = QualityRule.query.filter_by(dataset_id=dataset_id).all()
    return success_response([r.to_dict() for r in rules])

@api_bp.route('/rules', methods=['POST'])
def create_rule():
    data = request.get_json()
    
    required_fields = ['dataset_id', 'rule_name', 'rule_type', 'threshold_config']
    for field in required_fields:
        if field not in data:
            return error_response(f"缺少必填字段: {field}")
    
    if data['rule_type'] not in QualityRule.RULE_TYPES:
        return error_response(f"无效的规则类型: {data['rule_type']}")
    
    is_valid, msg = validate_threshold_config(data['rule_type'], data['threshold_config'])
    if not is_valid:
        return error_response(msg)
    
    rule = QualityRule(
        dataset_id=data['dataset_id'],
        rule_name=data['rule_name'],
        rule_type=data['rule_type'],
        column_name=data.get('column_name'),
        threshold_config=data['threshold_config'],
        is_active=data.get('is_active', True),
        target_dataset_id=data.get('target_dataset_id'),
        target_column_name=data.get('target_column_name'),
        join_condition=data.get('join_condition')
    )
    
    db.session.add(rule)
    db.session.commit()
    
    return success_response(rule.to_dict(), "规则创建成功")

@api_bp.route('/rules/<int:rule_id>', methods=['GET'])
def get_rule(rule_id):
    rule = QualityRule.query.get(rule_id)
    if not rule:
        return error_response("规则不存在", code=404)
    return success_response(rule.to_dict())

@api_bp.route('/rules/<int:rule_id>', methods=['PUT'])
def update_rule(rule_id):
    rule = QualityRule.query.get(rule_id)
    if not rule:
        return error_response("规则不存在", code=404)
    
    data = request.get_json()
    
    if 'rule_name' in data:
        rule.rule_name = data['rule_name']
    if 'rule_type' in data:
        if data['rule_type'] not in QualityRule.RULE_TYPES:
            return error_response(f"无效的规则类型: {data['rule_type']}")
        rule.rule_type = data['rule_type']
    if 'column_name' in data:
        rule.column_name = data['column_name']
    if 'threshold_config' in data:
        is_valid, msg = validate_threshold_config(rule.rule_type, data['threshold_config'])
        if not is_valid:
            return error_response(msg)
        rule.threshold_config = data['threshold_config']
    if 'is_active' in data:
        rule.is_active = data['is_active']
    if 'target_dataset_id' in data:
        rule.target_dataset_id = data['target_dataset_id']
    if 'target_column_name' in data:
        rule.target_column_name = data['target_column_name']
    if 'join_condition' in data:
        rule.join_condition = data['join_condition']
    
    db.session.commit()
    return success_response(rule.to_dict(), "规则更新成功")

@api_bp.route('/rules/<int:rule_id>', methods=['DELETE'])
def delete_rule(rule_id):
    rule = QualityRule.query.get(rule_id)
    if not rule:
        return error_response("规则不存在", code=404)
    
    db.session.delete(rule)
    db.session.commit()
    return success_response(message="规则删除成功")

@api_bp.route('/check-tasks', methods=['POST'])
def create_check_task():
    data = request.get_json()
    
    required_fields = ['dataset_id']
    for field in required_fields:
        if field not in data:
            return error_response(f"缺少必填字段: {field}")
    
    dataset_id = data['dataset_id']
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return error_response("数据集不存在", code=404)
    
    rule_ids = data.get('rule_ids', [])
    if not rule_ids:
        active_rules = QualityRule.query.filter_by(dataset_id=dataset_id, is_active=True).all()
        rule_ids = [r.id for r in active_rules]
    else:
        rules = QualityRule.query.filter(QualityRule.id.in_(rule_ids), QualityRule.dataset_id == dataset_id).all()
        rule_ids = [r.id for r in rules]
    
    if not rule_ids:
        return error_response("没有可执行的规则")
    
    check_date = data.get('check_date', date.today().isoformat())
    task_hash = generate_task_hash(dataset_id, rule_ids, check_date)
    
    existing_task = CheckTask.query.filter_by(task_hash=task_hash).first()
    if existing_task:
        return success_response({
            'task_id': existing_task.id,
            'status': existing_task.status,
            'is_duplicate': True
        }, "任务已存在，返回已有的任务")
    
    task = CheckTask(
        dataset_id=dataset_id,
        task_hash=task_hash,
        status='pending'
    )
    
    db.session.add(task)
    db.session.commit()
    
    check_engine.run_check_async(task.id, rule_ids)
    
    return success_response({
        'task_id': task.id,
        'status': task.status,
        'is_duplicate': False
    }, "检查任务已创建")

@api_bp.route('/check-tasks/<int:task_id>', methods=['GET'])
def get_check_task(task_id):
    task = CheckTask.query.get(task_id)
    if not task:
        return error_response("任务不存在", code=404)
    
    results = CheckResult.query.filter_by(task_id=task_id).all()
    results_data = []
    for r in results:
        result_dict = r.to_dict()
        sample_count = AnomalySample.query.filter_by(result_id=r.id).count()
        result_dict['sample_count'] = sample_count
        results_data.append(result_dict)
    
    return success_response({
        'task': task.to_dict(),
        'results': results_data
    })

@api_bp.route('/check-tasks', methods=['GET'])
def list_check_tasks():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    dataset_id = request.args.get('dataset_id', type=int)
    status = request.args.get('status')
    
    query = CheckTask.query
    if dataset_id:
        query = query.filter_by(dataset_id=dataset_id)
    if status:
        query = query.filter_by(status=status)
    
    pagination = query.order_by(CheckTask.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return success_response({
        'tasks': [t.to_dict() for t in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page
    })

@api_bp.route('/check-results/<int:result_id>/samples', methods=['GET'])
def list_anomaly_samples(result_id):
    result = CheckResult.query.get(result_id)
    if not result:
        return error_response("检查结果不存在", code=404)
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    pagination = AnomalySample.query.filter_by(result_id=result_id).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return success_response({
        'samples': [s.to_dict() for s in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page
    })

@api_bp.route('/anomaly-samples/<int:sample_id>/confirm', methods=['POST'])
def confirm_anomaly_sample(sample_id):
    sample = AnomalySample.query.get(sample_id)
    if not sample:
        return error_response("异常样本不存在", code=404)
    
    data = request.get_json()
    
    if 'confirmation_status' not in data:
        return error_response("缺少必填字段: confirmation_status")
    
    if data['confirmation_status'] not in ['true_positive', 'false_positive']:
        return error_response("无效的确认状态")
    
    sample.confirmation_status = data['confirmation_status']
    sample.confirmed_by = data.get('confirmed_by', 'system')
    sample.confirmed_at = datetime.utcnow()
    sample.confirmation_note = data.get('note', '')
    
    db.session.commit()
    return success_response(sample.to_dict(), "确认成功")

@api_bp.route('/quality-stats', methods=['GET'])
def get_quality_stats():
    dataset_id = request.args.get('dataset_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not dataset_id:
        return error_response("缺少必填参数: dataset_id")
    
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return error_response("数据集不存在", code=404)
    
    query = DailyReport.query.filter_by(dataset_id=dataset_id)
    
    if start_date:
        query = query.filter(DailyReport.report_date >= start_date)
    if end_date:
        query = query.filter(DailyReport.report_date <= end_date)
    
    reports = query.order_by(DailyReport.report_date.desc()).all()
    
    if reports:
        latest = reports[0]
        trends = []
        for r in reports[:7]:
            trends.append({
                'date': r.report_date.isoformat(),
                'score': r.quality_score
            })
        
        failed_rules = []
        active_rules = QualityRule.query.filter_by(dataset_id=dataset_id, is_active=True).all()
        for rule in active_rules:
            latest_result = CheckResult.query.filter_by(rule_id=rule.id).order_by(CheckResult.checked_at.desc()).first()
            if latest_result and latest_result.result_type != 'passed':
                failed_rules.append({
                    'rule': rule.to_dict(),
                    'latest_result': latest_result.to_dict()
                })
        
        evidence = []
        for r in reports[:1]:
            for result in CheckResult.query.filter(
                CheckResult.task.has(dataset_id=dataset_id),
                CheckResult.result_type != 'passed'
            ).order_by(CheckResult.checked_at.desc()).limit(5).all():
                samples = AnomalySample.query.filter_by(result_id=result.id).limit(3).all()
                evidence.append({
                    'result': result.to_dict(),
                    'samples': [s.to_dict() for s in samples]
                })
        
        return success_response({
            'dataset': dataset.to_dict(),
            'current_score': latest.quality_score,
            'failed_rules': failed_rules,
            'evidence': evidence,
            'trends': trends,
            'latest_report': latest.to_dict()
        })
    else:
        return success_response({
            'dataset': dataset.to_dict(),
            'current_score': None,
            'failed_rules': [],
            'evidence': [],
            'trends': [],
            'latest_report': None
        }, "暂无质量数据")

@api_bp.route('/daily-reports', methods=['GET'])
def list_daily_reports():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    dataset_id = request.args.get('dataset_id', type=int)
    
    query = DailyReport.query
    if dataset_id:
        query = query.filter_by(dataset_id=dataset_id)
    
    pagination = query.order_by(DailyReport.report_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return success_response({
        'reports': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page
    })

@api_bp.route('/daily-reports/<int:report_id>/export', methods=['GET'])
def export_daily_report(report_id):
    report = DailyReport.query.get(report_id)
    if not report:
        return error_response("日报不存在", code=404)
    
    export_data = {
        'report_info': report.to_dict(),
        'dataset': Dataset.query.get(report.dataset_id).to_dict() if report.dataset_id else None,
        'failed_rules_details': [],
        'anomaly_samples': []
    }
    
    active_rules = QualityRule.query.filter_by(dataset_id=report.dataset_id).all()
    for rule in active_rules:
        result = CheckResult.query.filter(
            CheckResult.rule_id == rule.id,
            CheckResult.checked_at >= datetime.combine(report.report_date, datetime.min.time()),
            CheckResult.checked_at <= datetime.combine(report.report_date, datetime.max.time())
        ).first()
        
        if result and result.result_type != 'passed':
            export_data['failed_rules_details'].append({
                'rule': rule.to_dict(),
                'result': result.to_dict()
            })
    
    all_results = CheckResult.query.filter(
        CheckResult.task.has(dataset_id=report.dataset_id),
        CheckResult.result_type != 'passed',
        CheckResult.checked_at >= datetime.combine(report.report_date, datetime.min.time()),
        CheckResult.checked_at <= datetime.combine(report.report_date, datetime.max.time())
    ).all()
    
    for result in all_results:
        samples = AnomalySample.query.filter_by(result_id=result.id).all()
        for sample in samples:
            export_data['anomaly_samples'].append(sample.to_dict())
    
    response = jsonify(export_data)
    response.headers['Content-Disposition'] = f'attachment; filename=daily_report_{report.report_date.isoformat()}_{report.dataset_id}.json'
    response.headers['Content-Type'] = 'application/json'
    return response

@api_bp.route('/daily-reports/generate', methods=['POST'])
def generate_daily_report():
    data = request.get_json()
    dataset_id = data.get('dataset_id')
    report_date = data.get('report_date', date.today().isoformat())
    
    if not dataset_id:
        return error_response("缺少必填参数: dataset_id")
    
    dataset = Dataset.query.get(dataset_id)
    if not dataset:
        return error_response("数据集不存在", code=404)
    
    try:
        report_date_obj = datetime.fromisoformat(report_date).date()
    except:
        return error_response("无效的日期格式")
    
    start_dt = datetime.combine(report_date_obj, datetime.min.time())
    end_dt = datetime.combine(report_date_obj, datetime.max.time())
    
    rules = QualityRule.query.filter_by(dataset_id=dataset_id, is_active=True).all()
    total_rules = len(rules)
    
    results = CheckResult.query.filter(
        CheckResult.task.has(dataset_id=dataset_id),
        CheckResult.checked_at >= start_dt,
        CheckResult.checked_at <= end_dt
    ).all()
    
    passed_rules = sum(1 for r in results if r.result_type == 'passed')
    failed_rules = sum(1 for r in results if r.result_type == 'failed')
    config_errors = sum(1 for r in results if r.result_type == 'config_error')
    
    sample_ids = []
    for result in results:
        samples = AnomalySample.query.filter_by(result_id=result.id).all()
        sample_ids.extend([s.id for s in samples])
    
    total_anomalies = len(sample_ids)
    confirmed_true = 0
    confirmed_false = 0
    pending_confirmation = 0
    recurrence_count = 0
    
    if sample_ids:
        confirmed_true = AnomalySample.query.filter(
            AnomalySample.id.in_(sample_ids),
            AnomalySample.confirmation_status == 'true_positive'
        ).count()
        
        confirmed_false = AnomalySample.query.filter(
            AnomalySample.id.in_(sample_ids),
            AnomalySample.confirmation_status == 'false_positive'
        ).count()
        
        pending_confirmation = AnomalySample.query.filter(
            AnomalySample.id.in_(sample_ids),
            AnomalySample.confirmation_status == 'pending'
        ).count()
        
        recurrence_count = AnomalySample.query.filter(
            AnomalySample.id.in_(sample_ids),
            AnomalySample.is_recurrence == True
        ).count()
    
    quality_score = 0.0
    if total_rules > 0:
        valid_rules = passed_rules + failed_rules
        if valid_rules > 0:
            quality_score = (passed_rules / valid_rules) * 100
    
    existing_report = DailyReport.query.filter_by(
        dataset_id=dataset_id,
        report_date=report_date_obj
    ).first()
    
    if existing_report:
        existing_report.quality_score = quality_score
        existing_report.total_rules = total_rules
        existing_report.passed_rules = passed_rules
        existing_report.failed_rules = failed_rules
        existing_report.config_errors = config_errors
        existing_report.total_anomalies = total_anomalies
        existing_report.confirmed_true = confirmed_true
        existing_report.confirmed_false = confirmed_false
        existing_report.pending_confirmation = pending_confirmation
        existing_report.recurrence_count = recurrence_count
        report = existing_report
    else:
        report = DailyReport(
            report_date=report_date_obj,
            dataset_id=dataset_id,
            quality_score=quality_score,
            total_rules=total_rules,
            passed_rules=passed_rules,
            failed_rules=failed_rules,
            config_errors=config_errors,
            total_anomalies=total_anomalies,
            confirmed_true=confirmed_true,
            confirmed_false=confirmed_false,
            pending_confirmation=pending_confirmation,
            recurrence_count=recurrence_count
        )
        db.session.add(report)
    
    db.session.commit()
    return success_response(report.to_dict(), "日报生成成功")
