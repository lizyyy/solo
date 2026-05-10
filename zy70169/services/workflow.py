from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from datetime import datetime

from models.database import (
    ModelVersion, Evaluation, Approval, StatusHistory, AuditLog
)
from schemas.api import (
    ModelVersionCreate, EvaluationCreate, ApprovalCreate,
    TrafficSwitch, RollbackRequest
)


class WorkflowError(Exception):
    def __init__(self, message: str, is_duplicate: bool = False, next_step: str = None):
        self.message = message
        self.is_duplicate = is_duplicate
        self.next_step = next_step
        super().__init__(message)


STATUS_FLOW = {
    "待评测": ["评测通过", "评测不通过"],
    "评测不通过": ["待评测"],
    "评测通过": ["灰度中", "待灰度审批"],
    "待灰度审批": ["灰度中", "审批驳回"],
    "审批驳回": ["待灰度审批"],
    "灰度中": ["待正式审批", "已回滚"],
    "待正式审批": ["已上线", "审批驳回"],
    "已上线": ["已回滚"],
    "已回滚": []
}


def get_next_step(current_status: str, is_rolled_back: bool = False) -> Optional[str]:
    if is_rolled_back:
        return "模型已回滚，如需重新发布请联系管理员"
    
    step_map = {
        "待评测": "请先提交评测结果",
        "评测不通过": "请根据评测问题修复后重新提交评测",
        "评测通过": "请申请灰度审批",
        "待灰度审批": "请等待灰度审批，或查看审批进度",
        "审批驳回": "请根据审批意见调整后重新申请审批",
        "灰度中": "灰度观察中，确认稳定后请申请正式发布审批",
        "待正式审批": "请等待正式发布审批",
        "已上线": "模型已正式上线，请监控运行状态"
    }
    return step_map.get(current_status, "请查看历史记录了解当前状态")


def add_status_history(
    db: Session,
    model_version_id: int,
    from_status: Optional[str],
    to_status: str,
    operator: str,
    reason: Optional[str] = None
):
    history = StatusHistory(
        model_version_id=model_version_id,
        from_status=from_status,
        to_status=to_status,
        operator=operator,
        reason=reason
    )
    db.add(history)


def add_audit_log(
    db: Session,
    model_version_id: int,
    action: str,
    operator: str,
    details: Optional[str],
    result: str
):
    audit = AuditLog(
        model_version_id=model_version_id,
        action=action,
        operator=operator,
        details=details,
        result=result
    )
    db.add(audit)


def create_model_version(db: Session, data: ModelVersionCreate) -> ModelVersion:
    existing = db.query(ModelVersion).filter(
        ModelVersion.model_name == data.model_name,
        ModelVersion.version == data.version
    ).first()
    
    if existing:
        raise WorkflowError(
            message=f"模型版本 {data.model_name} {data.version} 已存在",
            is_duplicate=True,
            next_step=f"请直接查询该版本的详细信息"
        )
    
    model = ModelVersion(
        model_name=data.model_name,
        version=data.version,
        description=data.description
    )
    db.add(model)
    db.flush()
    
    add_status_history(db, model.id, None, "待评测", "系统", f"创建模型版本 {data.version}")
    add_audit_log(db, model.id, "创建模型版本", "系统", 
                  f"模型: {data.model_name}, 版本: {data.version}", "成功")
    
    db.commit()
    db.refresh(model)
    return model


def submit_evaluation(
    db: Session,
    model_version_id: int,
    data: EvaluationCreate
) -> Tuple[Evaluation, str]:
    model = db.query(ModelVersion).filter(ModelVersion.id == model_version_id).first()
    if not model:
        raise WorkflowError(message="模型版本不存在")
    
    if model.is_rolled_back:
        raise WorkflowError(
            message="模型已回滚，无法提交评测",
            next_step="如需重新发布请联系管理员"
        )
    
    if model.current_status in ["灰度中", "待正式审批", "已上线"]:
        raise WorkflowError(
            message=f"当前状态「{model.current_status}」不允许再提交评测",
            next_step=get_next_step(model.current_status)
        )
    
    existing_eval = db.query(Evaluation).filter(
        Evaluation.model_version_id == model_version_id
    ).order_by(Evaluation.evaluated_at.desc()).first()
    
    if existing_eval and existing_eval.overall_result == "通过" and model.current_status == "评测通过":
        raise WorkflowError(
            message="该模型版本已完成评测且结论为通过，无需重复评测",
            is_duplicate=True,
            next_step="请申请灰度审批"
        )
    
    old_status = model.current_status
    
    if data.overall_result == "通过":
        new_status = "评测通过"
    else:
        new_status = "评测不通过"
    
    if old_status == new_status and existing_eval and existing_eval.overall_result == data.overall_result:
        raise WorkflowError(
            message=f"评测已完成，当前状态已是「{new_status}」，本次评测未改变状态",
            is_duplicate=True,
            next_step=get_next_step(new_status)
        )
    
    evaluation = Evaluation(
        model_version_id=model_version_id,
        evaluator=data.evaluator,
        accuracy_score=data.accuracy_score,
        performance_score=data.performance_score,
        stability_score=data.stability_score,
        overall_result=data.overall_result,
        findings=data.findings
    )
    db.add(evaluation)
    
    model.current_status = new_status
    add_status_history(
        db, model.id, old_status, new_status,
        data.evaluator, f"评测结论: {data.overall_result}"
    )
    add_audit_log(
        db, model.id, "提交评测", data.evaluator,
        f"准确率: {data.accuracy_score}, 性能: {data.performance_score}, 稳定性: {data.stability_score}",
        f"评测{data.overall_result}"
    )
    
    db.commit()
    db.refresh(evaluation)
    return evaluation, new_status


def submit_approval(
    db: Session,
    model_version_id: int,
    data: ApprovalCreate
) -> Tuple[Approval, str]:
    model = db.query(ModelVersion).filter(ModelVersion.id == model_version_id).first()
    if not model:
        raise WorkflowError(message="模型版本不存在")
    
    if model.is_rolled_back:
        raise WorkflowError(
            message="模型已回滚，无法提交审批",
            next_step="如需重新发布请联系管理员"
        )
    
    valid_transitions = {
        "灰度审批": {"from": ["评测通过", "审批驳回"], "to_approve": "灰度中", "to_reject": "审批驳回"},
        "正式发布审批": {"from": ["灰度中"], "to_approve": "已上线", "to_reject": "审批驳回"}
    }
    
    if data.approval_type not in valid_transitions:
        raise WorkflowError(
            message=f"未知的审批类型: {data.approval_type}",
            next_step="请使用: 灰度审批 / 正式发布审批"
        )
    
    rules = valid_transitions[data.approval_type]
    
    if model.current_status not in rules["from"]:
        if data.approval_type == "灰度审批":
            if model.current_status == "灰度中":
                raise WorkflowError(
                    message="该模型版本已在灰度中，无需重复审批",
                    is_duplicate=True,
                    next_step="灰度观察中，确认稳定后可申请正式发布审批"
                )
            elif model.current_status == "待灰度审批":
                pass
            else:
                raise WorkflowError(
                    message=f"当前状态「{model.current_status}」不允许灰度审批",
                    next_step="请先完成评测并确保评测通过"
                )
        elif data.approval_type == "正式发布审批":
            if model.current_status == "已上线":
                raise WorkflowError(
                    message="该模型版本已正式上线，无需重复审批",
                    is_duplicate=True,
                    next_step="请监控上线后的运行状态"
                )
            else:
                raise WorkflowError(
                    message=f"当前状态「{model.current_status}」不允许正式发布审批",
                    next_step="请先完成灰度审批并经过灰度观察"
                )
    
    approval = Approval(
        model_version_id=model_version_id,
        approver=data.approver,
        approval_type=data.approval_type,
        decision=data.decision,
        comments=data.comments
    )
    db.add(approval)
    
    old_status = model.current_status
    if data.decision == "通过":
        new_status = rules["to_approve"]
    else:
        new_status = rules["to_reject"]
    
    model.current_status = new_status
    add_status_history(
        db, model.id, old_status, new_status,
        data.approver, f"{data.approval_type}结论: {data.decision}"
    )
    add_audit_log(
        db, model.id, data.approval_type, data.approver,
        data.comments or "无审批意见",
        f"审批{data.decision}"
    )
    
    db.commit()
    db.refresh(approval)
    return approval, new_status


def switch_traffic(
    db: Session,
    model_version_id: int,
    data: TrafficSwitch
) -> ModelVersion:
    model = db.query(ModelVersion).filter(ModelVersion.id == model_version_id).first()
    if not model:
        raise WorkflowError(message="模型版本不存在")
    
    if model.is_rolled_back:
        raise WorkflowError(
            message="模型已回滚，无法切换流量",
            next_step="如需重新发布请联系管理员"
        )
    
    if model.traffic_weight == data.traffic_weight:
        raise WorkflowError(
            message=f"当前流量比例已是 {data.traffic_weight}%，无需重复切换",
            is_duplicate=True,
            next_step="如需调整流量，请设置不同的比例"
        )
    
    if model.current_status not in ["灰度中", "已上线"]:
        raise WorkflowError(
            message=f"当前状态「{model.current_status}」不允许调整流量",
            next_step="请先完成灰度审批后再调整流量"
        )
    
    old_weight = model.traffic_weight
    model.traffic_weight = data.traffic_weight
    
    if data.traffic_weight == 100:
        model.is_production = True
    
    add_audit_log(
        db, model.id, "切换流量", data.operator,
        f"流量从 {old_weight}% 调整为 {data.traffic_weight}%，原因: {data.reason}",
        "成功"
    )
    
    db.commit()
    db.refresh(model)
    return model


def rollback_model(
    db: Session,
    model_version_id: int,
    data: RollbackRequest
) -> ModelVersion:
    model = db.query(ModelVersion).filter(ModelVersion.id == model_version_id).first()
    if not model:
        raise WorkflowError(message="模型版本不存在")
    
    if model.is_rolled_back:
        raise WorkflowError(
            message=f"该模型版本已于 {model.rollback_at} 回滚，无需重复操作",
            is_duplicate=True,
            next_step="如需重新发布请联系管理员"
        )
    
    if model.current_status not in ["灰度中", "已上线"]:
        raise WorkflowError(
            message=f"当前状态「{model.current_status}」不允许回滚",
            next_step="只有灰度中或已上线的模型才能回滚"
        )
    
    old_status = model.current_status
    model.current_status = "已回滚"
    model.is_rolled_back = True
    model.rollback_reason = data.reason
    model.rollback_at = datetime.utcnow()
    model.traffic_weight = 0
    model.is_production = False
    
    add_status_history(
        db, model.id, old_status, "已回滚",
        data.operator, f"回滚原因: {data.reason}"
    )
    add_audit_log(
        db, model.id, "回滚模型", data.operator,
        data.reason,
        "已回滚"
    )
    
    db.commit()
    db.refresh(model)
    return model


def get_model_summary(db: Session) -> dict:
    all_models = db.query(ModelVersion).all()
    
    summary = {
        "total_models": len(all_models),
        "pending_evaluation": 0,
        "pending_approval": 0,
        "in_grayscale": 0,
        "in_production": 0,
        "rolled_back": 0
    }
    
    for m in all_models:
        if m.is_rolled_back:
            summary["rolled_back"] += 1
        elif m.current_status == "待评测" or m.current_status == "评测不通过":
            summary["pending_evaluation"] += 1
        elif m.current_status in ["待灰度审批", "待正式审批", "审批驳回"]:
            summary["pending_approval"] += 1
        elif m.current_status == "灰度中":
            summary["in_grayscale"] += 1
        elif m.current_status == "已上线":
            summary["in_production"] += 1
    
    recent_audits = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(10).all()
    summary["recent_activities"] = recent_audits
    
    return summary


def get_model_full_detail(db: Session, model_version_id: int) -> Optional[dict]:
    model = db.query(ModelVersion).filter(ModelVersion.id == model_version_id).first()
    if not model:
        return None
    
    evaluations = db.query(Evaluation).filter(
        Evaluation.model_version_id == model_version_id
    ).order_by(Evaluation.evaluated_at.desc()).all()
    
    approvals = db.query(Approval).filter(
        Approval.model_version_id == model_version_id
    ).order_by(Approval.approved_at.desc()).all()
    
    history = db.query(StatusHistory).filter(
        StatusHistory.model_version_id == model_version_id
    ).order_by(StatusHistory.changed_at.desc()).all()
    
    audits = db.query(AuditLog).filter(
        AuditLog.model_version_id == model_version_id
    ).order_by(AuditLog.created_at.desc()).all()
    
    return {
        "basic_info": model,
        "evaluations": evaluations,
        "approvals": approvals,
        "history": history,
        "audits": audits,
        "next_step": get_next_step(model.current_status, model.is_rolled_back)
    }


def list_all_models(db: Session) -> List[ModelVersion]:
    return db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()
