from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from models.database import get_db
from schemas.api import (
    ModelVersionCreate, ModelVersionResponse, ModelVersionDetail,
    EvaluationCreate, EvaluationResponse,
    ApprovalCreate, ApprovalResponse,
    TrafficSwitch, RollbackRequest,
    StatusHistoryResponse, AuditLogResponse,
    ApiResponse, SummaryResponse, ModelVersionFullDetail
)
from services.workflow import (
    WorkflowError,
    create_model_version, submit_evaluation, submit_approval,
    switch_traffic, rollback_model,
    get_model_summary, get_model_full_detail, list_all_models,
    get_next_step
)

router = APIRouter()


def handle_workflow_error(e: WorkflowError):
    status_code = status.HTTP_409_CONFLICT if e.is_duplicate else status.HTTP_400_BAD_REQUEST
    return HTTPException(
        status_code=status_code,
        detail={
            "success": False,
            "message": e.message,
            "is_duplicate": e.is_duplicate,
            "next_step": e.next_step
        }
    )


@router.get("/summary", response_model=SummaryResponse, summary="获取系统总览")
def get_summary(db: Session = Depends(get_db)):
    """
    获取系统整体状态概览，包括：
    - 各状态模型数量统计
    - 最近操作记录
    """
    data = get_model_summary(db)
    return {
        "total_models": data["total_models"],
        "pending_evaluation": data["pending_evaluation"],
        "pending_approval": data["pending_approval"],
        "in_grayscale": data["in_grayscale"],
        "in_production": data["in_production"],
        "rolled_back": data["rolled_back"],
        "recent_activities": data["recent_activities"]
    }


@router.get("/models", response_model=List[ModelVersionResponse], summary="列出所有模型版本")
def list_models(db: Session = Depends(get_db)):
    """
    列出所有模型版本，按创建时间倒序排列
    """
    return list_all_models(db)


@router.post("/models", response_model=ApiResponse, summary="创建模型版本")
def new_model_version(data: ModelVersionCreate, db: Session = Depends(get_db)):
    """
    从训练产出开始，注册一个新的模型版本。
    
    **注意**：同一个模型名称+版本号只能创建一次。
    """
    try:
        model = create_model_version(db, data)
        return {
            "success": True,
            "message": f"模型版本 {data.model_name} {data.version} 创建成功",
            "data": {"id": model.id, "status": model.current_status},
            "next_step": get_next_step(model.current_status)
        }
    except WorkflowError as e:
        raise handle_workflow_error(e)


@router.get("/models/{model_id}", response_model=ModelVersionFullDetail, summary="获取模型版本详情")
def get_model_detail(model_id: int, db: Session = Depends(get_db)):
    """
    获取模型版本的完整信息，包括：
    - 基本信息和当前状态
    - 评测历史
    - 审批历史
    - 状态变更记录
    - 审计日志
    - 下一步建议
    """
    detail = get_model_full_detail(db, model_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "模型版本不存在"}
        )
    return detail


@router.post("/models/{model_id}/evaluate", response_model=ApiResponse, summary="提交评测结果")
def evaluate_model(model_id: int, data: EvaluationCreate, db: Session = Depends(get_db)):
    """
    提交模型评测结果，推动状态从「待评测」→「评测通过/不通过」。
    
    **状态推进规则**：
    - 综合结论为「通过」→ 状态变为「评测通过」
    - 综合结论为「不通过」→ 状态变为「评测不通过」
    
    **重复调用处理**：
    - 已评测通过且状态已是「评测通过」→ 返回重复提示
    """
    try:
        evaluation, new_status = submit_evaluation(db, model_id, data)
        return {
            "success": True,
            "message": f"评测提交成功，状态已更新为「{new_status}」",
            "data": {"evaluation_id": evaluation.id, "new_status": new_status},
            "next_step": get_next_step(new_status)
        }
    except WorkflowError as e:
        raise handle_workflow_error(e)


@router.post("/models/{model_id}/approve", response_model=ApiResponse, summary="提交审批")
def approve_model(model_id: int, data: ApprovalCreate, db: Session = Depends(get_db)):
    """
    提交审批，包括灰度审批和正式发布审批。
    
    **审批类型**：
    - 灰度审批：评测通过后申请，通过则进入「灰度中」
    - 正式发布审批：灰度观察后申请，通过则进入「已上线」
    
    **重复调用处理**：
    - 已灰度中 → 提示无需重复审批灰度
    - 已上线 → 提示无需重复审批正式发布
    """
    try:
        approval, new_status = submit_approval(db, model_id, data)
        return {
            "success": True,
            "message": f"{data.approval_type}已完成，状态已更新为「{new_status}」",
            "data": {"approval_id": approval.id, "new_status": new_status},
            "next_step": get_next_step(new_status)
        }
    except WorkflowError as e:
        raise handle_workflow_error(e)


@router.post("/models/{model_id}/traffic", response_model=ApiResponse, summary="切换流量")
def adjust_traffic(model_id: int, data: TrafficSwitch, db: Session = Depends(get_db)):
    """
    调整模型的流量比例。
    
    **适用状态**：灰度中 / 已上线
    
    **重复调用处理**：
    - 设置相同流量比例 → 提示无需重复切换
    
    **提示**：流量调至 100% 时会自动标记为正式生产。
    """
    try:
        model = switch_traffic(db, model_id, data)
        msg = f"流量已调整为 {data.traffic_weight}%"
        if data.traffic_weight == 100:
            msg += "，已标记为正式生产"
        return {
            "success": True,
            "message": msg,
            "data": {"traffic_weight": model.traffic_weight, "is_production": model.is_production},
            "next_step": "请监控流量切换后的运行情况"
        }
    except WorkflowError as e:
        raise handle_workflow_error(e)


@router.post("/models/{model_id}/rollback", response_model=ApiResponse, summary="回滚模型")
def rollback(model_id: int, data: RollbackRequest, db: Session = Depends(get_db)):
    """
    回滚模型，适用于发现线上问题时紧急处理。
    
    **适用状态**：灰度中 / 已上线
    
    **回滚效果**：
    - 状态变为「已回滚」
    - 流量归零
    - 标记为非生产
    
    **重复调用处理**：
    - 已回滚的模型 → 提示回滚时间，无需重复操作
    """
    try:
        model = rollback_model(db, model_id, data)
        return {
            "success": True,
            "message": "模型已回滚，流量已归零",
            "data": {"rollback_at": model.rollback_at, "rollback_reason": model.rollback_reason},
            "next_step": "如需重新发布请联系管理员，或创建新版本重新走流程"
        }
    except WorkflowError as e:
        raise handle_workflow_error(e)


@router.get("/models/{model_id}/history", response_model=List[StatusHistoryResponse], summary="获取状态历史")
def get_history(model_id: int, db: Session = Depends(get_db)):
    """
    获取模型版本的状态变更历史记录
    """
    from models.database import StatusHistory
    history = db.query(StatusHistory).filter(
        StatusHistory.model_version_id == model_id
    ).order_by(StatusHistory.changed_at.desc()).all()
    return history


@router.get("/models/{model_id}/audits", response_model=List[AuditLogResponse], summary="获取审计日志")
def get_audits(model_id: int, db: Session = Depends(get_db)):
    """
    获取模型版本的完整审计日志
    """
    from models.database import AuditLog
    audits = db.query(AuditLog).filter(
        AuditLog.model_version_id == model_id
    ).order_by(AuditLog.created_at.desc()).all()
    return audits
