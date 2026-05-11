from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import io
import csv

from fastapi.responses import StreamingResponse

from app.database import get_db
from app.models import Filter, FilterPrediction, ReplacementReport
from app.schemas import ReplacementReportCreate, ReplacementReportResponse

router = APIRouter()

@router.post("/", response_model=ReplacementReportResponse)
def create_replacement_report(report_data: ReplacementReportCreate, db: Session = Depends(get_db)):
    filter_obj = db.query(Filter).filter(Filter.filter_id == report_data.filter_id).first()
    if not filter_obj:
        raise HTTPException(status_code=404, detail="滤芯不存在")
    
    db_report = ReplacementReport(**report_data.dict())
    db.add(db_report)
    
    filter_obj.status = 'replaced'
    db.commit()
    db.refresh(db_report)
    
    return db_report

@router.get("/", response_model=List[ReplacementReportResponse])
def list_replacement_reports(
    filter_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ReplacementReport)
    
    if filter_id:
        query = query.filter(ReplacementReport.filter_id == filter_id)
    if status:
        query = query.filter(ReplacementReport.status == status)
    if start_date:
        query = query.filter(ReplacementReport.report_date >= start_date)
    if end_date:
        query = query.filter(ReplacementReport.report_date <= end_date)
    
    return query.order_by(ReplacementReport.report_date.desc()).offset(skip).limit(limit).all()

@router.get("/{report_id}", response_model=ReplacementReportResponse)
def get_replacement_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(ReplacementReport).filter(ReplacementReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="更换报告不存在")
    return report

@router.get("/export/csv")
def export_replacement_reports_csv(
    filter_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ReplacementReport)
    
    if filter_id:
        query = query.filter(ReplacementReport.filter_id == filter_id)
    
    reports = query.order_by(ReplacementReport.report_date.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '滤芯ID', '报告日期', '旧滤芯状况', '更换原因', '关联预测ID',
        '技术人员', '备注', '状态', '影响后续预测'
    ])
    
    for r in reports:
        writer.writerow([
            r.filter_id,
            r.report_date.strftime('%Y-%m-%d %H:%M:%S'),
            r.old_filter_condition,
            r.replacement_reason,
            r.prediction_id or '',
            r.technician or '',
            r.notes or '',
            r.status,
            '是' if r.affected_next_prediction else '否'
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=replacement_reports_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )

@router.get("/stats/summary")
def get_replacement_stats(db: Session = Depends(get_db)):
    total_reports = db.query(ReplacementReport).count()
    completed_reports = db.query(ReplacementReport).filter(
        ReplacementReport.status == 'completed'
    ).count()
    
    replaced_filters = db.query(Filter).filter(Filter.status == 'replaced').count()
    
    reasons = db.query(ReplacementReport.replacement_reason).all()
    reason_counts = {}
    for (reason,) in reasons:
        reason_counts[reason] = reason_counts.get(reason, 0) + 1
    
    return {
        "total_replacement_reports": total_reports,
        "completed_reports": completed_reports,
        "replaced_filters": replaced_filters,
        "replacement_reasons": reason_counts
    }

@router.post("/complete-replacement")
def complete_filter_replacement(
    filter_id: str,
    new_install_date: datetime,
    technician: Optional[str] = None,
    db: Session = Depends(get_db)
):
    old_filter = db.query(Filter).filter(Filter.filter_id == filter_id).first()
    if not old_filter:
        raise HTTPException(status_code=404, detail="滤芯不存在")
    
    if old_filter.status == 'replaced':
        raise HTTPException(status_code=400, detail="该滤芯已被替换")
    
    latest_prediction = db.query(FilterPrediction).filter(
        FilterPrediction.filter_id == filter_id
    ).order_by(FilterPrediction.prediction_date.desc()).first()
    
    replacement_report = ReplacementReport(
        filter_id=filter_id,
        report_date=datetime.utcnow(),
        prediction_id=latest_prediction.id if latest_prediction else None,
        old_filter_condition=f"已使用 {(datetime.utcnow() - old_filter.install_date).days} 天",
        replacement_reason=latest_prediction.recommendation if latest_prediction else "定期更换",
        technician=technician,
        notes="滤芯更换完成，已更新滤芯状态"
    )
    db.add(replacement_report)
    
    old_filter.status = 'replaced'
    
    new_filter = Filter(
        filter_id=f"{filter_id}_R{datetime.now().strftime('%Y%m%d')}",
        station_name=old_filter.station_name,
        filter_type=old_filter.filter_type,
        install_date=new_install_date,
        max_lifespan_days=old_filter.max_lifespan_days,
        max_lifespan_liters=old_filter.max_lifespan_liters,
        status='active'
    )
    db.add(new_filter)
    
    db.commit()
    db.refresh(replacement_report)
    db.refresh(new_filter)
    
    return {
        "message": "滤芯更换完成",
        "old_filter_id": filter_id,
        "new_filter_id": new_filter.filter_id,
        "replacement_report_id": replacement_report.id,
        "new_filter": new_filter
    }
