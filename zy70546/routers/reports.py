from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import io
import pandas as pd
from database import get_db
from models import (
    Notification, NotificationStatus, ImpactReport,
    NotificationBatch, BloodlineRelation
)
from schemas import ImpactReportResponse, ErrorResponse, generate_id

router = APIRouter()

@router.post("/generate", response_model=ImpactReportResponse)
def generate_impact_report(
    batch_id: Optional[str] = Query(None),
    team_name: Optional[str] = Query(None),
    report_type: str = Query("custom", description="报告类型: team, batch, custom"),
    generated_by: Optional[str] = Query("system"),
    db: Session = Depends(get_db)
):
    report_id = f"report_{generate_id()}"
    
    query = db.query(Notification)
    filters_applied = []
    
    if batch_id:
        query = query.filter(Notification.batch_id == batch_id)
        filters_applied.append(f"批次: {batch_id}")
    if team_name:
        query = query.filter(Notification.team_name == team_name)
        filters_applied.append(f"团队: {team_name}")
    
    notifications = query.all()
    
    summary = {
        "total_notifications": len(notifications),
        "status_summary": {},
        "team_distribution": {},
        "generated_at": datetime.now().isoformat(),
        "filters": filters_applied
    }
    
    for n in notifications:
        status_key = n.status.value
        summary["status_summary"][status_key] = summary["status_summary"].get(status_key, 0) + 1
        
        team_key = n.team_name or "unknown"
        summary["team_distribution"][team_key] = summary["team_distribution"].get(team_key, 0) + 1
    
    details = []
    for n in notifications:
        bloodline = db.query(BloodlineRelation).filter(BloodlineRelation.id == n.bloodline_relation_id).first()
        details.append({
            "notification_id": n.id,
            "team_name": n.team_name,
            "status": n.status.value,
            "match_reason": n.match_reason,
            "filter_reason": n.filter_reason,
            "field_name": bloodline.field_name if bloodline else None,
            "upstream_table": bloodline.upstream_table if bloodline else None,
            "downstream_report": bloodline.downstream_report if bloodline else None,
            "change_type": bloodline.change_type if bloodline else None,
            "created_at": n.created_at.isoformat() if n.created_at else None
        })
    
    report_content = {
        "summary": summary,
        "details": details
    }
    
    report = ImpactReport(
        report_id=report_id,
        batch_id=batch_id,
        team_name=team_name,
        report_type=report_type,
        report_content=report_content,
        generated_by=generated_by,
        exported_count=0
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report

@router.get("/", response_model=list[ImpactReportResponse])
def list_reports(
    batch_id: Optional[str] = Query(None),
    team_name: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(ImpactReport)
    if batch_id:
        query = query.filter(ImpactReport.batch_id == batch_id)
    if team_name:
        query = query.filter(ImpactReport.team_name == team_name)
    return query.order_by(ImpactReport.generated_at.desc()).offset(skip).limit(limit).all()

@router.get("/{report_id}")
def get_report(
    report_id: str,
    db: Session = Depends(get_db)
):
    report = db.query(ImpactReport).filter(ImpactReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND",
            "error_message": f"报告ID {report_id} 不存在"
        })
    return report

@router.get("/{report_id}/export/excel")
def export_report_excel(
    report_id: str,
    db: Session = Depends(get_db)
):
    report = db.query(ImpactReport).filter(ImpactReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND",
            "error_message": f"报告ID {report_id} 不存在"
        })
    
    report_content = report.report_content or {}
    details = report_content.get("details", [])
    summary = report_content.get("summary", {})
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        if details:
            df_details = pd.DataFrame(details)
            df_details.to_excel(writer, sheet_name='通知明细', index=False)
        
        summary_data = []
        for k, v in summary.items():
            if isinstance(v, dict):
                for sub_k, sub_v in v.items():
                    summary_data.append({"分类": k, "子项": sub_k, "数值": sub_v})
            else:
                summary_data.append({"分类": k, "子项": "", "数值": v})
        
        if summary_data:
            df_summary = pd.DataFrame(summary_data)
            df_summary.to_excel(writer, sheet_name='统计汇总', index=False)
    
    output.seek(0)
    
    report.exported_count += 1
    db.commit()
    
    filename = f"impact_report_{report_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/export/notifications/excel")
def export_notifications_excel(
    batch_id: Optional[str] = Query(None),
    team_name: Optional[str] = Query(None),
    status: Optional[NotificationStatus] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Notification)
    if batch_id:
        query = query.filter(Notification.batch_id == batch_id)
    if team_name:
        query = query.filter(Notification.team_name == team_name)
    if status:
        query = query.filter(Notification.status == status)
    
    notifications = query.all()
    
    data = []
    for n in notifications:
        bloodline = db.query(BloodlineRelation).filter(BloodlineRelation.id == n.bloodline_relation_id).first()
        data.append({
            "通知ID": n.id,
            "批次ID": n.batch_id,
            "团队名称": n.team_name,
            "状态": n.status.value,
            "匹配原因": n.match_reason,
            "过滤原因": n.filter_reason,
            "字段名称": bloodline.field_name if bloodline else None,
            "上游表": bloodline.upstream_table if bloodline else None,
            "下游报表": bloodline.downstream_report if bloodline else None,
            "变更类型": bloodline.change_type if bloodline else None,
            "确认人": n.confirmed_by,
            "确认时间": n.confirmed_at.isoformat() if n.confirmed_at else None,
            "创建时间": n.created_at.isoformat() if n.created_at else None
        })
    
    output = io.BytesIO()
    if data:
        df = pd.DataFrame(data)
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='通知列表', index=False)
    output.seek(0)
    
    filename = f"notifications_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
