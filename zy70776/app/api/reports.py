from typing import List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.report import CheckReportResponse, ManualFixRequest, OwnerSummary
from app.services.report_service import (
    get_report,
    manual_fix_report_item,
    summarize_by_owner,
    export_report_to_text,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{report_id}", response_model=CheckReportResponse)
def get_single_report(report_id: int, db: Session = Depends(get_db)):
    report = get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.patch("/{report_id}/items/fix", response_model=CheckReportResponse)
def fix_report_item(
    report_id: int,
    fix_request: ManualFixRequest,
    db: Session = Depends(get_db),
):
    report = get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        manual_fix_report_item(
            db,
            report_id,
            fix_request.item_id,
            fix_request.fixed,
            fix_request.fixed_by,
            fix_request.fix_note,
        )
        db.refresh(report)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{report_id}/summary-by-owner", response_model=List[OwnerSummary])
def get_owner_summary_endpoint(report_id: int, db: Session = Depends(get_db)):
    return summarize_by_owner(db, report_id)


@router.get("/{report_id}/export")
def export_report(report_id: int, db: Session = Depends(get_db)):
    report = get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    content = export_report_to_text(db, report_id)
    return Response(
        content=content,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={report.report_no}.txt"},
    )
