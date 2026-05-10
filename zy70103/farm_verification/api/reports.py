from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import os
from ..database import get_db
from ..schemas.report import (
    VerificationReportCreate, VerificationReportResponse,
    ReportListResponse, ReportStatusEnum, ReportExportRequest
)
from ..schemas.common import StandardResponse
from ..services.report_service import report_service
from ..models.report import ReportStatus


router = APIRouter(prefix="/api/reports", tags=["病斑报告管理"])


@router.post("", response_model=StandardResponse[VerificationReportResponse])
def generate_report(
    request: VerificationReportCreate,
    db: Session = Depends(get_db)
):
    try:
        report = report_service.generate_batch_report(
            db=db,
            batch_code=request.batch_code,
            generated_by=request.generated_by,
            report_name=request.report_name
        )
        
        return StandardResponse(
            success=True,
            code=200,
            message=f"报告【{report.report_name}】生成成功，包含{report.total_lesion_count}个病斑记录，核验完成率{report.verification_rate}%",
            data=report
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.get("/{report_code}", response_model=StandardResponse[VerificationReportResponse])
def get_report(report_code: str, db: Session = Depends(get_db)):
    report = report_service.get_report_by_code(db, report_code)
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"报告【{report_code}】不存在"
        )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"查找到报告【{report.report_name}】，疑似病斑总数：{report.total_lesion_count}，确认病斑：{report.confirmed_count}，误报：{report.false_positive_count}",
        data=report
    )


@router.get("", response_model=StandardResponse[ReportListResponse])
def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    batch_code: Optional[str] = Query(None),
    status: Optional[ReportStatusEnum] = Query(None),
    generated_by: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    result = report_service.list_reports(
        db=db,
        page=page,
        page_size=page_size,
        batch_code=batch_code,
        status=ReportStatus(status.value) if status else None,
        generated_by=generated_by
    )
    
    return StandardResponse(
        success=True,
        code=200,
        message=f"共找到{result['total']}份报告",
        data=result
    )


@router.post("/export", response_model=StandardResponse[dict])
def export_report(
    request: ReportExportRequest,
    db: Session = Depends(get_db)
):
    try:
        result = report_service.export_report_to_excel(
            db=db,
            report_code=request.report_code,
            output_dir=request.output_dir
        )
        
        return StandardResponse(
            success=True,
            code=200,
            message=result["business_message"],
            data=result
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


@router.get("/download/{report_code}")
def download_report_file(
    report_code: str,
    db: Session = Depends(get_db)
):
    report = report_service.get_report_by_code(db, report_code)
    if not report:
        raise HTTPException(
            status_code=404,
            detail=f"报告【{report_code}】不存在"
        )
    
    if not report.export_file_path or not os.path.exists(report.export_file_path):
        raise HTTPException(
            status_code=404,
            detail=f"报告【{report_code}】尚未导出或文件已删除，请先调用导出接口"
        )
    
    return FileResponse(
        path=report.export_file_path,
        filename=report.export_file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
