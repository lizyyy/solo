from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from io import StringIO
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db
from app.models import PlanStatus
from app.validations import validate_plan
from app.exports import export_markdown_notification, export_csv_risk_list, export_json_audit_package

router = APIRouter(prefix="/api/plans", tags=["改线方案管理"])


@router.post("/", response_model=schemas.RouteChangePlan, status_code=status.HTTP_201_CREATED)
def create_plan(plan: schemas.RouteChangePlanCreate, db: Session = Depends(get_db)):
    db_plan = crud.create_route_change_plan(db=db, plan=plan)
    
    crud.create_audit_log(
        db=db,
        action="创建方案",
        actor=plan.created_by or "系统",
        plan_id=db_plan.id,
        details=f"创建改线方案: {plan.title}",
    )
    
    return crud.get_route_change_plan(db, plan_id=db_plan.id)


@router.get("/", response_model=List[schemas.RouteChangePlan])
def read_plans(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = Query(None, description="按状态筛选"),
    db: Session = Depends(get_db)
):
    plans = crud.get_route_change_plans(db, skip=skip, limit=limit, status=status)
    return plans


@router.get("/{plan_id}", response_model=schemas.RouteChangePlan)
def read_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    return plan


@router.put("/{plan_id}", response_model=schemas.RouteChangePlan)
def update_plan(
    plan_id: int,
    plan: schemas.RouteChangePlanUpdate,
    db: Session = Depends(get_db)
):
    db_plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    if db_plan.status not in [PlanStatus.DRAFT, PlanStatus.SUBMITTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"当前状态 {db_plan.status.value} 不允许修改"
        )
    
    for key, value in plan.model_dump(exclude_unset=True).items():
        setattr(db_plan, key, value)
    
    db.commit()
    db.refresh(db_plan)
    
    crud.create_audit_log(
        db=db,
        action="修改方案",
        actor="系统",
        plan_id=db_plan.id,
        details=f"修改改线方案: {db_plan.title}",
    )
    
    return crud.get_route_change_plan(db, plan_id=plan_id)


@router.post("/{plan_id}/submit", response_model=schemas.RouteChangePlan)
def submit_plan(
    plan_id: int,
    actor: str = "调度员",
    db: Session = Depends(get_db)
):
    db_plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    if db_plan.status != PlanStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"只能提交草稿状态的方案，当前状态: {db_plan.status.value}"
        )
    
    db_plan = crud.update_plan_status(
        db=db,
        plan_id=plan_id,
        new_status=PlanStatus.SUBMITTED,
        actor=actor,
    )
    
    crud.create_audit_log(
        db=db,
        action="提交方案",
        actor=actor,
        plan_id=db_plan.id,
        details=f"提交改线方案审核: {db_plan.title}",
    )
    
    return db_plan


@router.post("/{plan_id}/validate", response_model=schemas.ValidationResult)
def validate_plan_endpoint(
    plan_id: int,
    db: Session = Depends(get_db)
):
    db_plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    result = validate_plan(db, db_plan)
    
    crud.create_audit_log(
        db=db,
        action="校验方案",
        actor="系统",
        plan_id=db_plan.id,
        details=f"方案校验结果: {'通过' if result.valid else '发现风险'}, {result.summary}",
    )
    
    return result


@router.post("/{plan_id}/approve", response_model=schemas.RouteChangePlan)
def approve_plan(
    plan_id: int,
    actor: str = "审批人",
    db: Session = Depends(get_db)
):
    db_plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    if db_plan.status != PlanStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"只能审批已提交的方案，当前状态: {db_plan.status.value}"
        )
    
    db_plan = crud.update_plan_status(
        db=db,
        plan_id=plan_id,
        new_status=PlanStatus.APPROVED,
        actor=actor,
    )
    
    crud.create_audit_log(
        db=db,
        action="审批通过",
        actor=actor,
        plan_id=db_plan.id,
        details=f"审批通过改线方案: {db_plan.title}",
    )
    
    return db_plan


@router.post("/{plan_id}/publish", response_model=schemas.RouteChangePlan)
def publish_plan(
    plan_id: int,
    actor: str = "发布人",
    db: Session = Depends(get_db)
):
    db_plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    if db_plan.status not in [PlanStatus.APPROVED, PlanStatus.SUBMITTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"只能发布已审批或已提交的方案，当前状态: {db_plan.status.value}"
        )
    
    db_plan = crud.update_plan_status(
        db=db,
        plan_id=plan_id,
        new_status=PlanStatus.PUBLISHED,
        actor=actor,
    )
    
    crud.create_audit_log(
        db=db,
        action="发布方案",
        actor=actor,
        plan_id=db_plan.id,
        details=f"发布改线方案: {db_plan.title}",
    )
    
    return db_plan


@router.post("/{plan_id}/withdraw", response_model=schemas.RouteChangePlan)
def withdraw_plan(
    plan_id: int,
    actor: str = "撤回人",
    db: Session = Depends(get_db)
):
    db_plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    if db_plan.status not in [PlanStatus.SUBMITTED, PlanStatus.APPROVED, PlanStatus.PUBLISHED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"当前状态 {db_plan.status.value} 不允许撤回"
        )
    
    db_plan = crud.update_plan_status(
        db=db,
        plan_id=plan_id,
        new_status=PlanStatus.WITHDRAWN,
        actor=actor,
    )
    
    crud.create_audit_log(
        db=db,
        action="撤回方案",
        actor=actor,
        plan_id=db_plan.id,
        details=f"撤回改线方案: {db_plan.title}",
    )
    
    return db_plan


@router.get("/{plan_id}/risks", response_model=List[schemas.RiskReport])
def get_plan_risks(
    plan_id: int,
    db: Session = Depends(get_db)
):
    plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    risks = crud.get_plan_risk_reports(db, plan_id=plan_id)
    return risks


@router.get("/{plan_id}/audit-logs", response_model=List[schemas.AuditLog])
def get_plan_audit_logs(
    plan_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    logs = crud.get_audit_logs(db, plan_id=plan_id, skip=skip, limit=limit)
    return logs


@router.get("/{plan_id}/export/markdown")
def export_plan_markdown(
    plan_id: int,
    db: Session = Depends(get_db)
):
    db_plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    markdown_content = export_markdown_notification(db, db_plan)
    
    crud.create_audit_log(
        db=db,
        action="导出通知单",
        actor="系统",
        plan_id=db_plan.id,
        details=f"导出改线方案通知单 (Markdown): {db_plan.title}",
    )
    
    return StreamingResponse(
        iter([markdown_content]),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=plan_{db_plan.plan_no}_notification.md"
        }
    )


@router.get("/{plan_id}/export/csv-risks")
def export_plan_csv_risks(
    plan_id: int,
    db: Session = Depends(get_db)
):
    db_plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    csv_content = export_csv_risk_list(db, db_plan)
    
    crud.create_audit_log(
        db=db,
        action="导出风险清单",
        actor="系统",
        plan_id=db_plan.id,
        details=f"导出改线方案风险清单 (CSV): {db_plan.title}",
    )
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=plan_{db_plan.plan_no}_risks.csv"
        }
    )


@router.get("/{plan_id}/export/json-audit")
def export_plan_json_audit(
    plan_id: int,
    db: Session = Depends(get_db)
):
    db_plan = crud.get_route_change_plan(db, plan_id=plan_id)
    if db_plan is None:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    json_content = export_json_audit_package(db, db_plan)
    
    crud.create_audit_log(
        db=db,
        action="导出审计包",
        actor="系统",
        plan_id=db_plan.id,
        details=f"导出改线方案审计包 (JSON): {db_plan.title}",
    )
    
    return StreamingResponse(
        iter([json_content]),
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=plan_{db_plan.plan_no}_audit.json"
        }
    )


@router.get("/audit-logs/all", response_model=List[schemas.AuditLog])
def get_all_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    logs = crud.get_audit_logs(db, skip=skip, limit=limit)
    return logs
