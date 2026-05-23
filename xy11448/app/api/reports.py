from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import os
import pandas as pd

from app.database import get_db
from app.auth import get_current_active_user, allow_reviewer, allow_supervisor
from app.models import User
from app.services import ReportService

router = APIRouter()


@router.get("/monthly", dependencies=[Depends(allow_reviewer)])
def get_monthly_report(
    year: int,
    month: int,
    area: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    report_data = ReportService.get_monthly_report(db, year, month, area)
    
    return {
        "success": True,
        "data": {
            "year": year,
            "month": month,
            "area": area,
            "generated_at": datetime.now(),
            "total_piles": len(report_data),
            "items": report_data
        }
    }


@router.get("/monthly/export", dependencies=[Depends(allow_reviewer)])
def export_monthly_report(
    year: int,
    month: int,
    area: Optional[str] = None,
    format: str = "excel",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    report_data = ReportService.get_monthly_report(db, year, month, area)
    
    if not os.path.exists("exports"):
        os.makedirs("exports")
    
    filename = f"exports/monthly_report_{year}_{month}_{area or 'all'}.xlsx"
    
    df = pd.DataFrame(report_data)
    df.columns = [
        "充电桩ID", "充电桩编号", "充电桩名称", "片区", "故障次数",
        "总故障时长(分钟)", "平均故障时长(分钟)", "离线次数", "异常次数",
        "投诉次数", "工单数", "告警ID列表"
    ]
    
    df.to_excel(filename, index=False, engine="openpyxl")
    
    return FileResponse(
        filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=os.path.basename(filename)
    )


@router.get("/trace/{record_type}/{record_id}", dependencies=[Depends(allow_reviewer)])
def trace_record(
    record_type: str,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    trace_data = ReportService.trace_record(db, record_type, record_id)
    
    if "error" in trace_data:
        raise HTTPException(status_code=404, detail=trace_data["error"])
    
    return {
        "success": True,
        "data": trace_data
    }


@router.get("/dashboard", dependencies=[Depends(allow_reviewer)])
def get_dashboard_data(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from sqlalchemy import func, and_
    from app.models import PileAlert, WorkOrder, CustomerComplaint, DataQuality, AlertStatus, WorkOrderStatus
    
    if not start_date:
        start_date = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if not end_date:
        end_date = datetime.now()
    
    alert_query = db.query(PileAlert).filter(
        and_(PileAlert.start_time >= start_date, PileAlert.start_time <= end_date)
    )
    total_alerts = alert_query.count()
    valid_alerts = alert_query.filter(PileAlert.data_quality == DataQuality.VALID).count()
    recovered_alerts = alert_query.filter(PileAlert.status == AlertStatus.RECOVERED).count()
    
    work_order_query = db.query(WorkOrder).filter(
        and_(WorkOrder.created_at >= start_date, WorkOrder.created_at <= end_date)
    )
    total_work_orders = work_order_query.count()
    completed_work_orders = work_order_query.filter(WorkOrder.status == WorkOrderStatus.COMPLETED).count()
    pending_work_orders = work_order_query.filter(WorkOrder.status.in_([WorkOrderStatus.PENDING, WorkOrderStatus.PROCESSING])).count()
    
    complaint_query = db.query(CustomerComplaint).filter(
        and_(CustomerComplaint.complaint_time >= start_date, CustomerComplaint.complaint_time <= end_date)
    )
    total_complaints = complaint_query.count()
    
    alert_type_stats = db.query(
        PileAlert.alert_type,
        func.count(PileAlert.id)
    ).filter(
        and_(PileAlert.start_time >= start_date, PileAlert.start_time <= end_date)
    ).group_by(PileAlert.alert_type).all()
    
    return {
        "success": True,
        "data": {
            "time_range": {
                "start_date": start_date,
                "end_date": end_date
            },
            "alerts": {
                "total": total_alerts,
                "valid": valid_alerts,
                "recovered": recovered_alerts
            },
            "work_orders": {
                "total": total_work_orders,
                "completed": completed_work_orders,
                "pending": pending_work_orders
            },
            "complaints": {
                "total": total_complaints
            },
            "alert_type_distribution": {alert_type: count for alert_type, count in alert_type_stats}
        }
    }
