from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, allow_reviewer
from app.models import User
from app.schemas import ApiResponse, ExportRequest
from app.services import ExportService

router = APIRouter()


@router.post("/records", response_model=ApiResponse, dependencies=[Depends(allow_reviewer)])
def export_records(
    export_format: str = Query("excel", description="导出格式: excel/csv"),
    include_bad_data: bool = Query(False, description="是否包含坏数据"),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    export_req = ExportRequest(
        format=export_format,
        include_bad_data=include_bad_data,
        start_date=start_date,
        end_date=end_date
    )
    result = ExportService.export_records(db, export_req)
    return ApiResponse(
        data=result,
        message=f"数据导出成功，共导出 {result['exported_records']} 条记录"
    )


@router.post("/failed-records", response_model=ApiResponse, dependencies=[Depends(allow_reviewer)])
def export_failed_records(
    export_format: str = Query("excel", description="导出格式: excel/csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    export_req = ExportRequest(format=export_format)
    result = ExportService.export_failed_records(db, export_req)
    return ApiResponse(
        data=result,
        message=f"失败记录导出成功，共导出 {result['exported_records']} 条记录"
    )


@router.post("/report", response_model=ApiResponse, dependencies=[Depends(allow_reviewer)])
def generate_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = ExportService.generate_report(db)
    return ApiResponse(
        data=result,
        message="报告生成成功"
    )
