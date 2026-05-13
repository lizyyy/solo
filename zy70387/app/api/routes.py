from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models import get_db
from app.schemas import (
    TaskLogCreate, TaskLogResponse, LogWriteResult,
    SamplingRuleCreate, SamplingRuleResponse, SamplingRuleUpdate,
    LogReport
)
from app.services import LogService, RuleService, ReportService, CleanupService

router = APIRouter(prefix="/api/v1")


@router.post("/logs", response_model=LogWriteResult, tags=["日志"])
def write_log(
    log_data: TaskLogCreate,
    db: Session = Depends(get_db)
):
    service = LogService(db)
    return service.write_log(log_data)


@router.get("/logs", response_model=List[TaskLogResponse], tags=["日志"])
def get_logs(
    tenant_id: Optional[str] = None,
    task_type: Optional[str] = None,
    task_id: Optional[str] = None,
    is_sampled: Optional[bool] = None,
    is_failure: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    service = LogService(db)
    logs, total = service.get_logs(
        tenant_id=tenant_id,
        task_type=task_type,
        task_id=task_id,
        is_sampled=is_sampled,
        is_failure=is_failure,
        page=page,
        page_size=page_size
    )
    return logs


@router.get("/logs/failure-context/{failure_log_id}", tags=["日志"])
def get_failure_context(
    failure_log_id: int,
    db: Session = Depends(get_db)
):
    service = LogService(db)
    contexts = service.get_failure_context(failure_log_id)
    return {
        "failure_log_id": failure_log_id,
        "context_count": len(contexts),
        "contexts": [
            {
                "id": ctx.id,
                "message": ctx.message,
                "timestamp": ctx.timestamp,
                "log_level": ctx.log_level
            }
            for ctx in contexts
        ]
    }


@router.post("/rules", response_model=SamplingRuleResponse, tags=["采样规则"])
def create_rule(
    rule_data: SamplingRuleCreate,
    db: Session = Depends(get_db)
):
    service = RuleService(db)
    try:
        return service.create_rule(rule_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/rules", response_model=List[SamplingRuleResponse], tags=["采样规则"])
def get_rules(
    only_active: bool = False,
    db: Session = Depends(get_db)
):
    service = RuleService(db)
    return service.get_all_rules(only_active=only_active)


@router.get("/rules/{rule_id}", response_model=SamplingRuleResponse, tags=["采样规则"])
def get_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    service = RuleService(db)
    rule = service.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule


@router.put("/rules/{rule_id}", response_model=SamplingRuleResponse, tags=["采样规则"])
def update_rule(
    rule_id: int,
    update_data: SamplingRuleUpdate,
    db: Session = Depends(get_db)
):
    service = RuleService(db)
    rule = service.update_rule(rule_id, update_data)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule


@router.delete("/rules/{rule_id}", tags=["采样规则"])
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    service = RuleService(db)
    if not service.delete_rule(rule_id):
        raise HTTPException(status_code=404, detail="规则不存在")
    return {"message": "规则已删除"}


@router.post("/rules/{rule_id}/activate", response_model=SamplingRuleResponse, tags=["采样规则"])
def activate_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    service = RuleService(db)
    rule = service.activate_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule


@router.post("/rules/{rule_id}/deactivate", response_model=SamplingRuleResponse, tags=["采样规则"])
def deactivate_rule(
    rule_id: int,
    db: Session = Depends(get_db)
):
    service = RuleService(db)
    rule = service.deactivate_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule


@router.get("/reports", response_model=LogReport, tags=["报告"])
def get_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    tenant_id: Optional[str] = None,
    task_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    return service.generate_report(
        start_date=start_date,
        end_date=end_date,
        tenant_id=tenant_id,
        task_type=task_type
    )


@router.post("/cleanup", tags=["清理"])
def run_cleanup(
    dry_run: bool = True,
    limit: Optional[int] = None,
    db: Session = Depends(get_db)
):
    service = CleanupService(db)
    return service.run_full_cleanup(dry_run=dry_run, limit=limit)


@router.get("/cleanup/summary", tags=["清理"])
def get_cleanup_summary(
    db: Session = Depends(get_db)
):
    service = CleanupService(db)
    return service.get_cleanup_summary()


@router.post("/cleanup/logs", tags=["清理"])
def cleanup_logs(
    dry_run: bool = True,
    limit: Optional[int] = None,
    db: Session = Depends(get_db)
):
    service = CleanupService(db)
    return service.cleanup_expired_logs(dry_run=dry_run, limit=limit)


@router.post("/cleanup/statistics", tags=["清理"])
def cleanup_statistics(
    retention_days: int = 90,
    dry_run: bool = True,
    db: Session = Depends(get_db)
):
    service = CleanupService(db)
    return service.cleanup_old_statistics(retention_days=retention_days, dry_run=dry_run)


@router.post("/cleanup/dropped-logs", tags=["清理"])
def cleanup_dropped_logs(
    retention_days: int = 30,
    dry_run: bool = True,
    db: Session = Depends(get_db)
):
    service = CleanupService(db)
    return service.cleanup_old_dropped_logs(retention_days=retention_days, dry_run=dry_run)
