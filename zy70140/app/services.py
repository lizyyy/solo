from datetime import datetime
import json
import uuid
from app import db
from app.models import AuditTask, CallbackRecord, StateHistory, ManualReview
from app.constants import AuditStatus, ReviewSource, TransitionError, VALID_TRANSITIONS

class IdempotentResult:
    def __init__(self, success: bool, handled: bool, task: AuditTask = None, reason: str = None, code: str = None):
        self.success = success
        self.handled = handled
        self.task = task
        self.reason = reason
        self.code = code

    def to_dict(self):
        result = {
            'success': self.success,
            'handled': self.handled,
            'reason': self.reason,
            'code': self.code
        }
        if self.task:
            result['task'] = self.task.to_dict()
        return result

def generate_task_id():
    return f'TASK_{uuid.uuid4().hex[:16].upper()}'

def create_audit_task(business_id: str, image_url: str, image_source: str = None, remark: str = None) -> AuditTask:
    task = AuditTask(
        task_id=generate_task_id(),
        business_id=business_id,
        image_url=image_url,
        image_source=image_source,
        current_status=AuditStatus.PENDING,
        max_callback_sequence=0,
        remark=remark
    )
    db.session.add(task)
    db.session.flush()
    
    history = StateHistory(
        task_id=task.task_id,
        from_status='INIT',
        to_status=AuditStatus.PENDING,
        transition_reason='审核任务已创建，等待审核处理',
        operator='SYSTEM'
    )
    db.session.add(history)
    db.session.commit()
    return task

def can_transition(from_status: str, to_status: str) -> tuple:
    if from_status not in VALID_TRANSITIONS:
        return False, f'未知的当前状态: {AuditStatus.get_desc(from_status)}'
    
    valid_next = VALID_TRANSITIONS.get(from_status, [])
    if to_status not in valid_next:
        from_desc = AuditStatus.get_desc(from_status)
        to_desc = AuditStatus.get_desc(to_status)
        if not valid_next:
            return False, f'当前状态【{from_desc}】已处于终态，不允许任何状态变更'
        valid_descs = [AuditStatus.get_desc(s) for s in valid_next]
        return False, f'状态流转非法：不允许从【{from_desc}】直接变更为【{to_desc}】，允许的后续状态为：{", ".join(valid_descs)}'
    
    return True, None

def process_callback(task_id: str, callback_id: str, callback_sequence: int, 
                     review_result: str, review_score: float = None, 
                     risk_category: str = None, risk_detail: str = None,
                     raw_payload: dict = None) -> IdempotentResult:
    task = AuditTask.query.filter_by(task_id=task_id).first()
    if not task:
        return IdempotentResult(False, False, None, f'任务不存在，task_id={task_id}', 'TASK_NOT_FOUND')
    
    existing_callback = CallbackRecord.query.filter_by(callback_id=callback_id).first()
    if existing_callback:
        task_desc = AuditStatus.get_desc(task.current_status)
        seq_desc = f'当前最大序号={task.max_callback_sequence}'
        return IdempotentResult(
            False, False, task,
            f'重复回调已忽略：回调ID【{callback_id}】已处理过。当前任务状态：【{task_desc}】，{seq_desc}',
            'DUPLICATE_CALLBACK'
        )
    
    callback = CallbackRecord(
        callback_id=callback_id,
        task_id=task_id,
        callback_sequence=callback_sequence,
        review_result=review_result,
        review_score=review_score,
        risk_category=risk_category,
        risk_detail=risk_detail,
        raw_payload=json.dumps(raw_payload, ensure_ascii=False) if raw_payload else '{}',
        source=ReviewSource.THIRD_PARTY,
        processed=False
    )
    db.session.add(callback)
    db.session.flush()
    
    if callback_sequence <= task.max_callback_sequence:
        current_desc = AuditStatus.get_desc(task.current_status)
        return IdempotentResult(
            False, False, task,
            f'旧回调已忽略：回调序号{callback_sequence} ≤ 当前最大序号{task.max_callback_sequence}。'
            f'当前状态保持【{current_desc}】不变。建议检查回调时序问题。',
            'OLD_SEQUENCE'
        )
    
    if AuditStatus.is_final_status(task.current_status):
        current_desc = AuditStatus.get_desc(task.current_status)
        return IdempotentResult(
            False, False, task,
            f'终态任务不可变更：当前状态【{current_desc}】已是最终状态，'
            f'不允许新回调覆盖。新回调序号={callback_sequence}，状态={AuditStatus.get_desc(review_result)}',
            'ALREADY_FINAL'
        )
    
    if review_result == task.current_status:
        callback.processed = True
        callback.processed_at = datetime.utcnow()
        task.max_callback_sequence = callback_sequence
        task.latest_callback_id = callback_id
        db.session.commit()
        return IdempotentResult(
            True, True, task,
            f'回调已接收：状态与当前一致【{AuditStatus.get_desc(review_result)}】，无需变更。'
            f'序号已更新为{callback_sequence}。',
            'SAME_STATUS'
        )
    
    can_trans, error_msg = can_transition(task.current_status, review_result)
    if not can_trans:
        return IdempotentResult(
            False, False, task,
            f'状态流转被阻止：{error_msg}',
            'INVALID_TRANSITION'
        )
    
    old_status = task.current_status
    old_desc = AuditStatus.get_desc(old_status)
    new_desc = AuditStatus.get_desc(review_result)
    
    reason = f'第三方审核回调：从【{old_desc}】变更为【{new_desc}】'
    if risk_category:
        reason += f'，风险类型：{risk_category}'
    if risk_detail:
        reason += f'，风险详情：{risk_detail}'
    
    history = StateHistory(
        task_id=task_id,
        from_status=old_status,
        to_status=review_result,
        transition_reason=reason,
        operator='THIRD_PARTY_AUDIT',
        callback_id=callback_id,
        evidence_data=json.dumps({
            'callback_id': callback_id,
            'review_score': review_score,
            'risk_category': risk_category,
            'risk_detail': risk_detail
        }, ensure_ascii=False) if (review_score or risk_category or risk_detail) else None
    )
    
    task.current_status = review_result
    task.max_callback_sequence = callback_sequence
    task.latest_callback_id = callback_id
    callback.processed = True
    callback.processed_at = datetime.utcnow()
    
    db.session.add(history)
    db.session.commit()
    
    return IdempotentResult(
        True, True, task,
        f'状态更新成功：【{old_desc}】→【{new_desc}】',
        'TRANSITION_SUCCESS'
    )

def manual_review(task_id: str, reviewer: str, decision: str, 
                  comment: str = None, evidence_paths: str = None) -> IdempotentResult:
    task = AuditTask.query.filter_by(task_id=task_id).first()
    if not task:
        return IdempotentResult(False, False, None, f'任务不存在，task_id={task_id}', 'TASK_NOT_FOUND')
    
    if task.current_status != AuditStatus.NEED_MANUAL_REVIEW:
        current_desc = AuditStatus.get_desc(task.current_status)
        return IdempotentResult(
            False, False, task,
            f'无法进行人工复审：当前状态为【{current_desc}】，只有【需人工复审】状态的任务才能进行人工处理。',
            'INVALID_STATUS'
        )
    
    if decision not in [AuditStatus.MANUALLY_APPROVED, AuditStatus.MANUALLY_REJECTED]:
        return IdempotentResult(
            False, False, task,
            f'人工复审结果无效：必须选择【人工通过】或【人工拒绝】，不能是【{AuditStatus.get_desc(decision)}】',
            'INVALID_DECISION'
        )
    
    existing = ManualReview.query.filter_by(task_id=task_id).first()
    if existing:
        return IdempotentResult(
            False, False, task,
            f'该任务已完成人工复审，复审人：{existing.reviewer}，结果：{AuditStatus.get_desc(existing.review_decision)}',
            'ALREADY_REVIEWED'
        )
    
    old_desc = AuditStatus.get_desc(task.current_status)
    new_desc = AuditStatus.get_desc(decision)
    
    review = ManualReview(
        task_id=task_id,
        reviewer=reviewer,
        review_decision=decision,
        review_comment=comment,
        evidence_saved=bool(evidence_paths),
        evidence_paths=evidence_paths
    )
    
    reason = f'人工复审【{reviewer}】：从【{old_desc}】变更为【{new_desc}】'
    if comment:
        reason += f'，复核意见：{comment}'
    
    history = StateHistory(
        task_id=task_id,
        from_status=task.current_status,
        to_status=decision,
        transition_reason=reason,
        operator=reviewer,
        evidence_data=json.dumps({
            'reviewer': reviewer,
            'comment': comment,
            'evidence_paths': evidence_paths
        }, ensure_ascii=False) if (comment or evidence_paths) else None
    )
    
    task.current_status = decision
    
    db.session.add(review)
    db.session.add(history)
    db.session.commit()
    
    return IdempotentResult(
        True, True, task,
        f'人工复审完成：【{old_desc}】→【{new_desc}】，复审人：{reviewer}',
        'MANUAL_REVIEW_SUCCESS'
    )

def get_task_detail(task_id: str) -> dict:
    task = AuditTask.query.filter_by(task_id=task_id).first()
    if not task:
        return None
    
    callbacks = CallbackRecord.query.filter_by(task_id=task_id).order_by(CallbackRecord.callback_sequence.desc()).all()
    histories = StateHistory.query.filter_by(task_id=task_id).order_by(StateHistory.created_at.asc()).all()
    manual_review = ManualReview.query.filter_by(task_id=task_id).first()
    
    return {
        'task': task.to_dict(),
        'callbacks': [c.to_dict() for c in callbacks],
        'state_history': [h.to_dict() for h in histories],
        'manual_review': manual_review.to_dict() if manual_review else None
    }

def get_tasks_by_status(status: str = None, page: int = 1, page_size: int = 20) -> dict:
    query = AuditTask.query
    if status:
        query = query.filter_by(current_status=status)
    
    total = query.count()
    tasks = query.order_by(AuditTask.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size,
        'tasks': [t.to_dict() for t in tasks]
    }

def get_statistics() -> dict:
    from sqlalchemy import func
    
    stats = db.session.query(
        AuditTask.current_status,
        func.count(AuditTask.id)
    ).group_by(AuditTask.current_status).all()
    
    result = {
        'total_tasks': 0,
        'by_status': {},
        'by_status_desc': {},
        'summary': []
    }
    
    for status, count in stats:
        desc = AuditStatus.get_desc(status)
        result['by_status'][status] = count
        result['by_status_desc'][desc] = count
        result['total_tasks'] += count
        result['summary'].append({
            'status': status,
            'status_desc': desc,
            'count': count,
            'percentage': round(count / result['total_tasks'] * 100, 2) if result['total_tasks'] > 0 else 0
        })
    
    result['summary'] = sorted(result['summary'], key=lambda x: x['count'], reverse=True)
    return result

def export_for_review(start_date: datetime = None, end_date: datetime = None, status: str = None) -> list:
    query = AuditTask.query
    if start_date:
        query = query.filter(AuditTask.created_at >= start_date)
    if end_date:
        query = query.filter(AuditTask.created_at <= end_date)
    if status:
        query = query.filter_by(current_status=status)
    
    tasks = query.order_by(AuditTask.created_at.asc()).all()
    export_data = []
    
    for task in tasks:
        callbacks = CallbackRecord.query.filter_by(task_id=task.task_id, processed=True).all()
        histories = StateHistory.query.filter_by(task_id=task.task_id).order_by(StateHistory.created_at.asc()).all()
        manual = ManualReview.query.filter_by(task_id=task.task_id).first()
        
        history_summary = ' → '.join([
            f'{AuditStatus.get_desc(h.from_status)}→{AuditStatus.get_desc(h.to_status)}' 
            for h in histories
        ])
        
        export_data.append({
            '任务ID': task.task_id,
            '业务ID': task.business_id,
            '图片链接': task.image_url,
            '当前状态': AuditStatus.get_desc(task.current_status),
            '创建时间': task.created_at.strftime('%Y-%m-%d %H:%M:%S') if task.created_at else '',
            '最后更新时间': task.updated_at.strftime('%Y-%m-%d %H:%M:%S') if task.updated_at else '',
            '最大回调序号': task.max_callback_sequence,
            '状态流转记录': history_summary,
            '回调次数': len(callbacks),
            '人工复审人': manual.reviewer if manual else '',
            '人工复审结果': AuditStatus.get_desc(manual.review_decision) if manual else '',
            '人工复审意见': manual.review_comment if manual else '',
            '备注': task.remark or ''
        })
    
    return export_data
