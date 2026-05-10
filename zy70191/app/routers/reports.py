from typing import List, Optional
import json
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import SwitchReport
from app.services.report_service import ReportService

router = APIRouter(prefix="/api/reports", tags=["切换报告"])


@router.post("/switch-request/{switch_request_id}", response_model=SwitchReport, status_code=status.HTTP_201_CREATED)
def generate_switch_report(
    switch_request_id: int,
    generated_by: Optional[str] = Query(None, description="报告生成人"),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    report = service.generate_switch_report(switch_request_id, generated_by)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="切换申请不存在"
        )
    return report


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    service = ReportService(db)
    report = service.get_report(report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="报告不存在"
        )
    return {
        "id": report.id,
        "report_no": report.report_no,
        "switch_request_id": report.switch_request_id,
        "generated_by": report.generated_by,
        "created_at": report.created_at,
        "content": json.loads(report.content)
    }


@router.get("/switch-request/{switch_request_id}", response_model=List[SwitchReport])
def list_reports_by_request(switch_request_id: int, db: Session = Depends(get_db)):
    service = ReportService(db)
    return service.get_reports_by_request(switch_request_id)


@router.get("/{report_id}/export/excel")
def export_report_to_excel(report_id: int, db: Session = Depends(get_db)):
    service = ReportService(db)
    output = service.export_report_to_excel(report_id)
    
    if not output:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="报告不存在或导出失败"
        )
    
    report = service.get_report(report_id)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=supplier_switch_report_{report.report_no}.xlsx"
        }
    )


@router.get("/statistics")
def get_report_statistics(db: Session = Depends(get_db)):
    service = ReportService(db)
    return service.get_report_statistics()
