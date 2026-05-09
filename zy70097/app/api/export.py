from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from typing import Optional, List
from datetime import datetime
import os

from app.core.database import get_db
from sqlalchemy.orm import Session
from app.schemas import ExportRequest
from app.services import ExportService

router = APIRouter(prefix="/api/export", tags=["数据导出"])


@router.post("/baseline")
def export_baseline(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    """导出基线报告"""
    try:
        filepath = ExportService.export_baseline_report(
            db=db,
            equipment_ids=request.equipment_ids,
            group_ids=request.group_ids,
            file_format=request.file_format
        )
        
        filename = os.path.basename(filepath)
        
        return FileResponse(
            path=filepath,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if request.file_format == 'xlsx' else 'text/csv',
            filename=filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.post("/saving")
def export_saving(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    """导出节能收益报告"""
    try:
        filepath = ExportService.export_saving_report(
            db=db,
            period_start=request.period_start,
            period_end=request.period_end,
            equipment_ids=request.equipment_ids,
            group_ids=request.group_ids,
            baseline_id=request.baseline_id,
            file_format=request.file_format
        )
        
        filename = os.path.basename(filepath)
        
        return FileResponse(
            path=filepath,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if request.file_format == 'xlsx' else 'text/csv',
            filename=filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.post("/energy-data")
def export_energy_data(
    request: ExportRequest,
    include_outliers: bool = True,
    db: Session = Depends(get_db)
):
    """导出能耗数据"""
    try:
        filepath = ExportService.export_energy_data(
            db=db,
            equipment_ids=request.equipment_ids,
            start_date=request.period_start,
            end_date=request.period_end,
            include_outliers=include_outliers,
            file_format=request.file_format
        )
        
        filename = os.path.basename(filepath)
        
        return FileResponse(
            path=filepath,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if request.file_format == 'xlsx' else 'text/csv',
            filename=filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.post("/production-data")
def export_production_data(
    request: ExportRequest,
    include_outliers: bool = True,
    db: Session = Depends(get_db)
):
    """导出产量数据"""
    try:
        filepath = ExportService.export_production_data(
            db=db,
            equipment_ids=request.equipment_ids,
            start_date=request.period_start,
            end_date=request.period_end,
            include_outliers=include_outliers,
            file_format=request.file_format
        )
        
        filename = os.path.basename(filepath)
        
        return FileResponse(
            path=filepath,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if request.file_format == 'xlsx' else 'text/csv',
            filename=filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )


@router.post("/audit")
def export_audit_log(
    request: ExportRequest,
    target_type: Optional[str] = None,
    action: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """导出审计日志"""
    try:
        filepath = ExportService.export_audit_log(
            db=db,
            start_date=request.period_start,
            end_date=request.period_end,
            target_type=target_type,
            action=action,
            file_format=request.file_format
        )
        
        filename = os.path.basename(filepath)
        
        return FileResponse(
            path=filepath,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' if request.file_format == 'xlsx' else 'text/csv',
            filename=filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )
