from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ReportGenerateRequest, ReportResponse, APIResponse
from app.services import ReportService

router = APIRouter(prefix="/api/reports", tags=["报告管理"])

@router.post("/generate", response_model=APIResponse)
def generate_report(request: ReportGenerateRequest, db: Session = Depends(get_db)):
    try:
        report = ReportService.generate_merge_report(
            db,
            request.merge_no,
            request.report_type,
            request.operator
        )
        return APIResponse(
            success=True,
            code="REPORT_GENERATED",
            message=f"报告 {report.report_no} 生成完成",
            data=ReportResponse.model_validate(report).model_dump()
        )
    except ValueError as e:
        return APIResponse(
            success=False,
            code="REPORT_FAILED",
            message=str(e),
            data=None
        )

@router.get("/{report_no}", response_model=APIResponse)
def get_report(report_no: str, db: Session = Depends(get_db)):
    report = ReportService.get_report(db, report_no)
    if not report:
        return APIResponse(
            success=False,
            code="REPORT_NOT_FOUND",
            message=f"报告 {report_no} 不存在",
            data=None
        )
    return APIResponse(
        success=True,
        code="OK",
        message="查询成功",
        data=ReportResponse.model_validate(report).model_dump()
    )

@router.get("/{report_no}/download")
def download_report(report_no: str, db: Session = Depends(get_db)):
    report = ReportService.get_report(db, report_no)
    if not report:
        return APIResponse(
            success=False,
            code="REPORT_NOT_FOUND",
            message=f"报告 {report_no} 不存在",
            data=None
        )
    if report.status != "completed":
        return APIResponse(
            success=False,
            code="REPORT_NOT_READY",
            message=f"报告尚未完成生成",
            data=None
        )
    
    return PlainTextResponse(
        content=report.content or "",
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=merge_report_{report_no}.txt"
        }
    )
