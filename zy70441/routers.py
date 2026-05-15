from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db
from schemas import (
    WorkOrder, WorkOrderCreate, WorkOrderDetail, WorkOrderJudge,
    RuleVersion, RuleVersionCreate,
    OperationLog,
    CleanCandidate, CleanCandidateCreate,
    PaginatedResponse
)
from services import (
    WorkOrderService, RuleService, OperationLogService, CleanService
)

router = APIRouter()


@router.post("/work-orders/", response_model=WorkOrder, summary="创建工单")
def create_work_order(order_data: WorkOrderCreate, db: Session = Depends(get_db)):
    return WorkOrderService.create_work_order(db, order_data)


@router.get("/work-orders/{order_id}", response_model=WorkOrderDetail, summary="获取工单详情")
def get_work_order(order_id: int, db: Session = Depends(get_db)):
    work_order = WorkOrderService.get_by_id(db, order_id)
    if not work_order:
        raise HTTPException(status_code=404, detail="工单不存在")
    return work_order


@router.get("/work-orders/", response_model=PaginatedResponse, summary="查询工单列表")
def list_work_orders(
    batch_no: Optional[str] = None,
    operator: Optional[str] = None,
    risk_type: Optional[str] = None,
    source_system: Optional[str] = None,
    status: Optional[str] = None,
    is_abnormal: Optional[bool] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query_params = {
        "batch_no": batch_no,
        "operator": operator,
        "risk_type": risk_type,
        "source_system": source_system,
        "status": status,
        "is_abnormal": is_abnormal,
        "start_time": start_time,
        "end_time": end_time,
        "page": page,
        "page_size": page_size
    }
    return WorkOrderService.query_work_orders(db, query_params)


@router.post("/work-orders/{order_id}/manual-correct", response_model=WorkOrder, summary="人工修正工单判断")
def manual_correct(order_id: int, judge_data: WorkOrderJudge, db: Session = Depends(get_db)):
    try:
        return WorkOrderService.manual_correct(db, order_id, judge_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/rules/", response_model=RuleVersion, summary="创建规则版本")
def create_rule(rule_data: RuleVersionCreate, db: Session = Depends(get_db)):
    return RuleService.create_rule(db, rule_data.model_dump())


@router.get("/rules/active", response_model=Optional[RuleVersion], summary="获取当前生效规则")
def get_active_rule(db: Session = Depends(get_db)):
    return RuleService.get_active_rule(db)


@router.get("/rules/", response_model=List[RuleVersion], summary="获取所有规则版本")
def list_rules(db: Session = Depends(get_db)):
    from models import RuleVersion
    return db.query(RuleVersion).order_by(RuleVersion.effective_time.desc()).all()


@router.get("/operation-logs/", response_model=PaginatedResponse, summary="查询操作日志")
def list_operation_logs(
    work_order_id: Optional[int] = None,
    batch_no: Optional[str] = None,
    operator: Optional[str] = None,
    source_system: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return OperationLogService.query_logs(
        db, work_order_id=work_order_id, batch_no=batch_no,
        operator=operator, source_system=source_system,
        page=page, page_size=page_size
    )


@router.get("/work-orders/{order_id}/logs", response_model=List[OperationLog], summary="获取工单操作日志")
def get_work_order_logs(order_id: int, db: Session = Depends(get_db)):
    result = OperationLogService.query_logs(db, work_order_id=order_id, page_size=1000)
    return result["items"]


@router.post("/clean-candidates/", response_model=CleanCandidate, summary="生成清理候选清单")
def generate_clean_candidate(
    batch_no: Optional[str] = None,
    risk_type: Optional[str] = None,
    is_abnormal: Optional[bool] = None,
    days_old: Optional[int] = None,
    generated_by: str = "admin",
    db: Session = Depends(get_db)
):
    filters = {
        "batch_no": batch_no,
        "risk_type": risk_type,
        "is_abnormal": is_abnormal,
        "days_old": days_old
    }
    return CleanService.generate_candidates(db, filters, generated_by)


@router.get("/clean-candidates/", response_model=List[CleanCandidate], summary="获取清理候选清单")
def list_clean_candidates(db: Session = Depends(get_db)):
    from models import CleanCandidate
    return db.query(CleanCandidate).order_by(CleanCandidate.created_at.desc()).all()


@router.post("/clean-candidates/{candidate_id}/execute", summary="执行批量清理")
def execute_clean(candidate_id: int, operator: str = "admin", db: Session = Depends(get_db)):
    try:
        return CleanService.execute_clean(db, candidate_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
