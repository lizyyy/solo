from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models import BlastStatus
from app.schemas import (
    BlastPlan, BlastPlanCreate, BlastPlanUpdate, BlastPlanListItem,
    ReceiptCreate, Receipt, ExecutionReportCreate, ExecutionReport,
    ReviewRequest, ArchiveRequest, ApiResponse, BatchSubmitResult,
    ExceptionSplitResult
)
from app.services import crud
from app.services.exporter import report_exporter
from app.services.receipt_tracker import receipt_tracker
from app.exceptions import (
    BlastNoticeException, DuplicateRequestException,
    MissingDataException
)

router = APIRouter()


@router.post("/plans/", response_model=BlastPlan, status_code=status.HTTP_201_CREATED)
def create_plan(plan_data: BlastPlanCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_blast_plan(db, plan_data)
    except DuplicateRequestException as e:
        existing_plan = crud.get_plan_by_business_no(db, plan_data.business_no)
        if existing_plan and existing_plan.status not in {BlastStatus.ARCHIVED, BlastStatus.EXECUTED}:
            raise DuplicateRequestException(
                message=f"业务编号 [{plan_data.business_no}] 已存在，当前状态: {existing_plan.status.value}，可进行补证操作",
                error_details=[f"计划ID: {existing_plan.id}", f"创建时间: {existing_plan.created_at}"]
            )
        raise


@router.get("/plans/", response_model=List[BlastPlanListItem])
def list_plans(
    status: Optional[BlastStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    plans = crud.list_plans(db, status=status, skip=skip, limit=limit)
    result = []
    for plan in plans:
        item = BlastPlanListItem(
            id=plan.id,
            business_no=plan.business_no,
            quarry_name=plan.quarry_name,
            blast_time=plan.blast_time,
            status=plan.status,
            wind_direction=plan.wind_direction,
            wind_speed=plan.wind_speed,
            created_at=plan.created_at,
            notice_count=len([n for n in plan.notices if n.is_active]),
            receipt_count=len(plan.receipts)
        )
        result.append(item)
    return result


@router.get("/plans/{plan_id}", response_model=BlastPlan)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    return crud.get_plan_by_id(db, plan_id)


@router.get("/plans/business/{business_no}", response_model=BlastPlan)
def get_plan_by_business_no(business_no: str, db: Session = Depends(get_db)):
    plan = crud.get_plan_by_business_no(db, business_no)
    if not plan:
        from app.exceptions import NotFoundException
        raise NotFoundException(message=f"业务编号 [{business_no}] 不存在")
    return plan


@router.put("/plans/{plan_id}", response_model=BlastPlan)
def update_plan(
    plan_id: int,
    update_data: BlastPlanUpdate,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.update_blast_plan(db, plan_id, update_data, operator)


@router.post("/plans/{plan_id}/submit", response_model=BlastPlan)
def submit_plan(
    plan_id: int,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.submit_blast_plan(db, plan_id, operator)


@router.post("/plans/batch/submit", response_model=BatchSubmitResult)
def batch_submit_plans(
    plan_ids: List[int],
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    success_count = 0
    failed_count = 0
    results = []

    for plan_id in plan_ids:
        try:
            plan = crud.submit_blast_plan(db, plan_id, operator)
            success_count += 1
            results.append({
                "plan_id": plan_id,
                "business_no": plan.business_no,
                "status": "success",
                "new_status": plan.status.value,
                "message": "提交成功"
            })
        except BlastNoticeException as e:
            failed_count += 1
            results.append({
                "plan_id": plan_id,
                "status": "failed",
                "error_code": e.error_code.value,
                "message": e.message
            })

    return BatchSubmitResult(
        success_count=success_count,
        failed_count=failed_count,
        results=results
    )


@router.get("/exceptions/split", response_model=ExceptionSplitResult)
def split_exceptions(db: Session = Depends(get_db)):
    exception_data = crud.get_exception_plans(db)

    def to_list_item(plan):
        return BlastPlanListItem(
            id=plan.id,
            business_no=plan.business_no,
            quarry_name=plan.quarry_name,
            blast_time=plan.blast_time,
            status=plan.status,
            wind_direction=plan.wind_direction,
            wind_speed=plan.wind_speed,
            created_at=plan.created_at,
            notice_count=len([n for n in plan.notices if n.is_active]),
            receipt_count=len(plan.receipts)
        )

    return ExceptionSplitResult(
        wind_exceptions=[to_list_item(p) for p in exception_data["wind_exceptions"]],
        receipt_exceptions=[to_list_item(p) for p in exception_data["receipt_exceptions"]],
        zone_exceptions=[to_list_item(p) for p in exception_data["zone_exceptions"]],
        normal_plans=[to_list_item(p) for p in exception_data["pending_review"]]
    )


@router.post("/plans/{plan_id}/receipts", response_model=Receipt)
def add_receipt(
    plan_id: int,
    receipt_data: ReceiptCreate,
    db: Session = Depends(get_db)
):
    return crud.add_receipt(db, plan_id, receipt_data)


@router.get("/plans/{plan_id}/receipts/status")
def get_receipt_status(plan_id: int, db: Session = Depends(get_db)):
    crud.get_plan_by_id(db, plan_id)
    return receipt_tracker.get_receipt_summary(db, plan_id)


@router.post("/plans/{plan_id}/review", response_model=BlastPlan)
def review_plan(
    plan_id: int,
    review_data: ReviewRequest,
    db: Session = Depends(get_db)
):
    return crud.review_plan(
        db, plan_id, review_data.operator,
        review_data.approve, review_data.review_comment
    )


@router.post("/plans/{plan_id}/execute", response_model=ExecutionReport)
def execute_plan(
    plan_id: int,
    report_data: ExecutionReportCreate,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.execute_plan(db, plan_id, report_data, operator)


@router.post("/plans/{plan_id}/archive", response_model=BlastPlan)
def archive_plan(
    plan_id: int,
    archive_data: ArchiveRequest,
    db: Session = Depends(get_db)
):
    return crud.archive_plan(
        db, plan_id, archive_data.operator,
        archive_data.archive_remark
    )


@router.get("/plans/{plan_id}/export")
def export_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = crud.get_plan_by_id(db, plan_id)
    excel_file = report_exporter.export_plan_to_excel(db, plan)

    filename = f"爆破计划_{plan.business_no}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/batch")
def export_batch_plans(
    status: Optional[BlastStatus] = None,
    db: Session = Depends(get_db)
):
    plans = crud.list_plans(db, status=status)
    if not plans:
        raise MissingDataException(message="没有可导出的数据")

    excel_file = report_exporter.export_batch_plans_to_excel(db, plans)
    filename = f"爆破计划汇总_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/plans/{plan_id}/audit-trail")
def get_audit_trail(plan_id: int, db: Session = Depends(get_db)):
    plan = crud.get_plan_by_id(db, plan_id)
    return {
        "plan_id": plan_id,
        "business_no": plan.business_no,
        "current_status": plan.status.value,
        "audit_logs": [
            {
                "id": log.id,
                "action": log.action.value,
                "operator": log.operator,
                "old_status": log.old_status,
                "new_status": log.new_status,
                "detail": log.detail,
                "created_at": log.created_at
            }
            for log in plan.audits
        ]
    }
