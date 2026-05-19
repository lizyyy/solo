from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["报告导出"])


@router.get("/tasks", summary="导出任务报告")
def export_tasks_report(
    requested_by: Optional[str] = Query(None, description="按负责人筛选"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    shift: Optional[str] = Query(None, description="按班次筛选"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    output = service.export_tasks_report(
        requested_by=requested_by,
        status=status,
        shift=shift,
        start_time=start_time,
        end_time=end_time
    )
    
    filename = f"充电任务报告_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/logs", summary="导出操作日志报告")
def export_logs_report(
    operator: Optional[str] = Query(None, description="按操作人筛选"),
    status: Optional[str] = Query(None, description="按状态筛选"),
    operation_type: Optional[str] = Query(None, description="按操作类型筛选"),
    start_time: Optional[datetime] = Query(None, description="开始时间"),
    end_time: Optional[datetime] = Query(None, description="结束时间"),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    output = service.export_logs_report(
        operator=operator,
        status=status,
        operation_type=operation_type,
        start_time=start_time,
        end_time=end_time
    )
    
    filename = f"操作日志报告_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
