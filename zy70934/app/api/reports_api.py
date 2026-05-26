from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.database import get_db
from app.services.report_service import ReportService
from app.schemas.schemas import ReportRequest

router = APIRouter(prefix="/api/reports", tags=["报告管理"])


@router.post("/download")
def download_report(request: ReportRequest, db: Session = Depends(get_db)):
    service = ReportService(db)
    try:
        if request.report_format == "excel":
            output = service.generate_excel_report(
                request.reconciliation_result_id,
                request.include_details
            )
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"对账报告_{request.reconciliation_result_id}.xlsx"
        elif request.report_format == "csv":
            output = service.generate_csv_report(
                request.reconciliation_result_id,
                request.include_details
            )
            media_type = "text/csv"
            filename = f"对账报告_{request.reconciliation_result_id}.csv"
        else:
            raise HTTPException(status_code=400, detail="不支持的报告格式")
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"报告生成失败: {str(e)}")


@router.get("/audit-trail/{detail_id}")
def get_audit_trail(detail_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    service = ReportService(db)
    try:
        return service.get_detail_audit_trail(detail_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
