from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from io import BytesIO

from app.models import get_db, RecordStatus
from app.services import ReportService

router = APIRouter()


@router.get("/summary", response_model=Dict[str, Any])
async def get_summary_report(
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取对账汇总报告"""
    try:
        service = ReportService(db)
        summary = service.generate_summary_report(batch_id)
        
        return {
            "success": True,
            "data": summary
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/details", response_model=Dict[str, Any])
async def get_detailed_records(
    batch_id: Optional[str] = None,
    status: Optional[RecordStatus] = None,
    db: Session = Depends(get_db)
):
    """获取对账明细记录"""
    try:
        service = ReportService(db)
        details = service.generate_detailed_records(
            batch_id=batch_id,
            status=status.value if status else None
        )
        
        return {
            "success": True,
            "total": len(details),
            "data": details
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/discrepancies", response_model=Dict[str, Any])
async def get_discrepancy_report(
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取差异分析报告"""
    try:
        service = ReportService(db)
        report = service.generate_discrepancy_report(batch_id)
        
        return {
            "success": True,
            "data": report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/excel")
async def export_excel(
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """导出Excel对账报告"""
    try:
        service = ReportService(db)
        excel_data = service.export_to_excel(batch_id)
        
        output = BytesIO(excel_data)
        
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=vaccine_reconciliation_report.xlsx"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
