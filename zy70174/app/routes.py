from flask import Blueprint, request, jsonify
from app import db
from app.models import (
    EvaluationSet,
    EvaluationItem,
    DetectionTask,
    PollutionMatch,
    ExemptionRecord,
    DetectionReport
)
from app.services.detection_service import (
    DetectionService,
    FingerprintService,
    DuplicateSubmissionError
)
from app.services.state_manager import StateManager, StateTransitionError

api_bp = Blueprint('api', __name__)


def make_response(success: bool, data=None, message: str = None, code: int = 200, details: dict = None):
    response = {
        'success': success,
        'message': message,
        'data': data,
        'details': details
    }
    return jsonify(response), code


@api_bp.route('/health', methods=['GET'])
def health():
    return make_response(True, {'status': 'ok'})


@api_bp.route('/evaluation-sets', methods=['POST'])
def create_evaluation_set():
    data = request.get_json()
    
    if not data.get('name') or not data.get('version'):
        return make_response(False, message='name 和 version 是必填字段', code=400)
    
    existing = EvaluationSet.query.filter_by(name=data['name'], version=data['version']).first()
    if existing:
        return make_response(
            False,
            message=f'评测集 {data["name"]} 版本 {data["version"]} 已存在',
            data={'existing_id': existing.id},
            code=409
        )
    
    eval_set = EvaluationSet(
        name=data['name'],
        version=data['version'],
        description=data.get('description'),
        created_by=data.get('created_by')
    )
    db.session.add(eval_set)
    db.session.flush()
    
    items = data.get('items', [])
    for item_data in items:
        if not item_data.get('item_id') or not item_data.get('content'):
            db.session.rollback()
            return make_response(
                False,
                message='每个评测项必须包含 item_id 和 content',
                code=400
            )
        
        fingerprint = item_data.get('fingerprint') or FingerprintService.compute_fingerprint(item_data['content'])
        
        item = EvaluationItem(
            evaluation_set_id=eval_set.id,
            item_id=item_data['item_id'],
            content=item_data['content'],
            fingerprint=fingerprint
        )
        db.session.add(item)
    
    db.session.commit()
    
    return make_response(
        True,
        data=eval_set.to_dict(),
        message=f'评测集创建成功，包含 {len(items)} 个评测项',
        code=201
    )


@api_bp.route('/evaluation-sets', methods=['GET'])
def list_evaluation_sets():
    sets = EvaluationSet.query.all()
    return make_response(
        True,
        data=[s.to_dict() for s in sets]
    )


@api_bp.route('/evaluation-sets/<int:set_id>', methods=['GET'])
def get_evaluation_set(set_id):
    eval_set = EvaluationSet.query.get(set_id)
    if not eval_set:
        return make_response(False, message='评测集不存在', code=404)
    
    data = eval_set.to_dict()
    data['items'] = [item.to_dict() for item in eval_set.items]
    return make_response(True, data=data)


@api_bp.route('/detection-tasks', methods=['POST'])
def create_detection_task():
    data = request.get_json()
    
    if not data.get('evaluation_set_id') or not data.get('training_data_signature'):
        return make_response(
            False,
            message='evaluation_set_id 和 training_data_signature 是必填字段',
            code=400
        )
    
    eval_set = EvaluationSet.query.get(data['evaluation_set_id'])
    if not eval_set:
        return make_response(False, message='评测集不存在', code=404)
    
    try:
        task, is_new = DetectionService.create_task(
            evaluation_set_id=data['evaluation_set_id'],
            training_data_signature=data['training_data_signature'],
            training_data_description=data.get('training_data_description'),
            created_by=data.get('created_by'),
            force=data.get('force', False)
        )
        
        if data.get('training_data'):
            DetectionService.add_training_fingerprints(task, data['training_data'])
        
        db.session.commit()
        
        return make_response(
            True,
            data=task.to_dict(),
            message='任务创建成功' if is_new else '使用现有任务',
            code=201 if is_new else 200
        )
        
    except DuplicateSubmissionError as e:
        return make_response(
            False,
            message=str(e),
            data={
                'existing_task_id': e.existing_task.id,
                'existing_task_status': e.existing_task.status
            },
            code=409
        )


@api_bp.route('/detection-tasks/<int:task_id>/run', methods=['POST'])
def run_detection(task_id):
    task = DetectionTask.query.get(task_id)
    if not task:
        return make_response(False, message='检测任务不存在', code=404)
    
    try:
        matches = DetectionService.run_detection(task)
        
        return make_response(
            True,
            data={
                'task': task.to_dict(),
                'matches_count': len(matches),
                'matches': [m.to_dict() for m in matches]
            },
            message=f'检测完成，发现 {len(matches)} 个潜在匹配'
        )
        
    except StateTransitionError as e:
        return make_response(
            False,
            message=str(e),
            details={
                'from_status': e.from_status,
                'to_status': e.to_status,
                'next_allowed_states': e.next_steps
            },
            code=400
        )
    except Exception as e:
        return make_response(
            False,
            message=f'检测失败: {str(e)}',
            code=500
        )


@api_bp.route('/detection-tasks/<int:task_id>', methods=['GET'])
def get_detection_task(task_id):
    task = DetectionTask.query.get(task_id)
    if not task:
        return make_response(False, message='检测任务不存在', code=404)
    
    summary = DetectionService.get_task_summary(task)
    
    return make_response(
        True,
        data=summary
    )


@api_bp.route('/detection-tasks', methods=['GET'])
def list_detection_tasks():
    status_filter = request.args.get('status')
    query = DetectionTask.query.order_by(DetectionTask.updated_at.desc())
    
    if status_filter:
        query = query.filter_by(status=status_filter)
    
    tasks = query.all()
    
    return make_response(
        True,
        data=[DetectionService.get_task_summary(t) for t in tasks]
    )


@api_bp.route('/detection-tasks/<int:task_id>/confirm', methods=['POST'])
def confirm_match(task_id):
    data = request.get_json()
    
    if data.get('match_id') is None or data.get('is_polluted') is None:
        return make_response(
            False,
            message='match_id 和 is_polluted 是必填字段',
            code=400
        )
    
    task = DetectionTask.query.get(task_id)
    if not task:
        return make_response(False, message='检测任务不存在', code=404)
    
    try:
        task, reason = DetectionService.confirm_match(
            task=task,
            match_id=data['match_id'],
            is_polluted=data['is_polluted'],
            confirmed_by=data.get('confirmed_by', 'anonymous'),
            comment=data.get('comment')
        )
        
        return make_response(
            True,
            data={
                'task': task.to_dict(),
                'next_allowed_states': StateManager.get_next_allowed_states(task.status)
            },
            message=reason
        )
        
    except StateTransitionError as e:
        return make_response(
            False,
            message=str(e),
            details={
                'from_status': e.from_status,
                'to_status': e.to_status,
                'next_allowed_states': e.next_steps
            },
            code=400
        )
    except ValueError as e:
        return make_response(False, message=str(e), code=400)


@api_bp.route('/detection-tasks/<int:task_id>/exempt', methods=['POST'])
def create_exemption(task_id):
    data = request.get_json()
    
    if not data.get('reason') or not data.get('justification'):
        return make_response(
            False,
            message='reason 和 justification 是必填字段',
            code=400
        )
    
    task = DetectionTask.query.get(task_id)
    if not task:
        return make_response(False, message='检测任务不存在', code=404)
    
    try:
        exemption = DetectionService.create_exemption(
            task=task,
            reason=data['reason'],
            justification=data['justification'],
            exempted_by=data.get('exempted_by', 'anonymous'),
            match_id=data.get('match_id')
        )
        
        return make_response(
            True,
            data={
                'exemption': exemption.to_dict(),
                'task': task.to_dict(),
                'next_allowed_states': StateManager.get_next_allowed_states(task.status)
            },
            message='豁免创建成功',
            code=201
        )
        
    except StateTransitionError as e:
        return make_response(
            False,
            message=str(e),
            details={
                'from_status': e.from_status,
                'to_status': e.to_status,
                'next_allowed_states': e.next_steps
            },
            code=400
        )
    except ValueError as e:
        return make_response(False, message=str(e), code=400)


@api_bp.route('/detection-tasks/<int:task_id>/report', methods=['POST'])
def generate_report(task_id):
    task = DetectionTask.query.get(task_id)
    if not task:
        return make_response(False, message='检测任务不存在', code=404)
    
    data = request.get_json() or {}
    
    report = DetectionService.generate_report(
        task=task,
        report_type=data.get('report_type', 'summary'),
        generated_by=data.get('generated_by')
    )
    
    return make_response(
        True,
        data=report.to_dict(),
        message='报告生成成功',
        code=201
    )


@api_bp.route('/detection-tasks/<int:task_id>/report', methods=['GET'])
def get_reports(task_id):
    task = DetectionTask.query.get(task_id)
    if not task:
        return make_response(False, message='检测任务不存在', code=404)
    
    reports = DetectionReport.query.filter_by(task_id=task_id).order_by(
        DetectionReport.generated_at.desc()
    ).all()
    
    return make_response(
        True,
        data=[r.to_dict() for r in reports]
    )


@api_bp.route('/detection-tasks/<int:task_id>/matches', methods=['GET'])
def get_matches(task_id):
    task = DetectionTask.query.get(task_id)
    if not task:
        return make_response(False, message='检测任务不存在', code=404)
    
    matches = PollutionMatch.query.filter_by(task_id=task_id).all()
    exemptions = ExemptionRecord.query.filter_by(task_id=task_id).all()
    exempted_match_ids = {e.match_id for e in exemptions if e.match_id is not None}
    
    result = []
    for match in matches:
        match_dict = match.to_dict()
        match_dict['is_exempted'] = match.id in exempted_match_ids
        result.append(match_dict)
    
    return make_response(True, data=result)


@api_bp.route('/detection-tasks/<int:task_id>/exemptions', methods=['GET'])
def get_exemptions(task_id):
    task = DetectionTask.query.get(task_id)
    if not task:
        return make_response(False, message='检测任务不存在', code=404)
    
    exemptions = ExemptionRecord.query.filter_by(task_id=task_id).all()
    return make_response(True, data=[e.to_dict() for e in exemptions])


@api_bp.route('/detection-tasks/<int:task_id>/history', methods=['GET'])
def get_history(task_id):
    task = DetectionTask.query.get(task_id)
    if not task:
        return make_response(False, message='检测任务不存在', code=404)
    
    history = [h.to_dict() for h in task.history]
    return make_response(True, data=history)
