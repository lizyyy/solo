from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.checklist import ChecklistStatus
from app.schemas.checklist import (
    ReleaseChecklistCreate,
    ReleaseChecklistResponse,
    ReleaseChecklistUpdate,
)
from app.schemas.report import CheckReportResponse, OwnerSummary
from app.services.checklist_service import (
    create_checklist,
    get_checklist,
    get_checklists,
    update_checklist_status,
    update_checklist,
    withdraw_checklist,
    close_checklist,
    InvalidStatusTransitionError,
    parse_checklist_text,
    apply_parsed_checklist,
)
from app.services.report_service import (
    generate_check_report,
    get_reports_by_checklist,
    summarize_by_owner,
)

router = APIRouter(prefix="/checklists", tags=["checklists"])


@router.post("/", response_model=ReleaseChecklistResponse, status_code=201)
def create_new_checklist(checklist_data: ReleaseChecklistCreate, db: Session = Depends(get_db)):
    return create_checklist(db, checklist_data)


@router.get("/", response_model=List[ReleaseChecklistResponse])
def list_checklists(
    skip: int = 0,
    limit: int = 100,
    status: Optional[ChecklistStatus] = None,
    db: Session = Depends(get_db),
):
    return get_checklists(db, skip=skip, limit=limit, status=status)


@router.get("/{checklist_id}", response_model=ReleaseChecklistResponse)
def get_single_checklist(checklist_id: int, db: Session = Depends(get_db)):
    checklist = get_checklist(db, checklist_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return checklist


@router.put("/{checklist_id}", response_model=ReleaseChecklistResponse)
def update_existing_checklist(
    checklist_id: int,
    update_data: ReleaseChecklistUpdate,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db),
):
    checklist = update_checklist(db, checklist_id, update_data, operator)
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return checklist


@router.patch("/{checklist_id}/status", response_model=ReleaseChecklistResponse)
def change_status(
    checklist_id: int,
    new_status: ChecklistStatus,
    operator: str = Query(..., description="操作人"),
    conclusion: Optional[str] = Query(None, description="处理结论"),
    db: Session = Depends(get_db),
):
    checklist = get_checklist(db, checklist_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    try:
        return update_checklist_status(db, checklist_id, new_status, operator, conclusion)
    except InvalidStatusTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{checklist_id}/parse", response_model=ReleaseChecklistResponse)
def parse_and_update_checklist(
    checklist_id: int,
    operator: str = Query(..., description="操作人"),
    db: Session = Depends(get_db),
):
    checklist = get_checklist(db, checklist_id)
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    if not checklist.raw_input:
        raise HTTPException(status_code=400, detail="No raw_input available for parsing")
    
    parsed_data = parse_checklist_text(checklist.raw_input)
    updated_checklist = apply_parsed_checklist(db, checklist_id, parsed_data, operator)
    return updated_checklist


@router.post("/{checklist_id}/withdraw", response_model=ReleaseChecklistResponse)
def withdraw(
    checklist_id: int,
    operator: str = Query(..., description="操作人"),
    reason: str = Query(..., description="撤回原因"),
    db: Session = Depends(get_db),
):
    checklist = withdraw_checklist(db, checklist_id, operator, reason)
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return checklist


@router.post("/{checklist_id}/close", response_model=ReleaseChecklistResponse)
def close(
    checklist_id: int,
    operator: str = Query(..., description="操作人"),
    reason: str = Query(..., description="关闭原因"),
    db: Session = Depends(get_db),
):
    checklist = close_checklist(db, checklist_id, operator, reason)
    if not checklist:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return checklist


@router.post("/{checklist_id}/reports", response_model=CheckReportResponse, status_code=201)
def create_report(
    checklist_id: int,
    generated_by: str = Query(..., description="生成人"),
    db: Session = Depends(get_db),
):
    try:
        return generate_check_report(db, checklist_id, generated_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{checklist_id}/reports", response_model=List[CheckReportResponse])
def list_reports(checklist_id: int, db: Session = Depends(get_db)):
    return get_reports_by_checklist(db, checklist_id)


@router.get("/{checklist_id}/reports/summary-by-owner", response_model=List[OwnerSummary])
def get_owner_summary(checklist_id: int, report_id: int, db: Session = Depends(get_db)):
    return summarize_by_owner(db, report_id)
