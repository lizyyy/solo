from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta
import io
import json

from database import SessionLocal, init_db, Incident, SlowRequestSample, IncidentTimeline, TroubleshootRemark, LatencyBucket
from schemas import (
    IncidentCreate, IncidentResponse, IncidentListResponse, IncidentDetailResponse,
    SlowRequestSampleResponse, IncidentTimelineResponse, TroubleshootRemarkResponse,
    TroubleshootRemarkCreate, StatusUpdateRequest, BatchImportRequest
)
from rules import IncidentRulesEngine

app = FastAPI(title="接口延迟事故板 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/api/incidents", response_model=IncidentResponse)
def create_incident(incident_data: IncidentCreate, db: Session = Depends(get_db)):
    rules = IncidentRulesEngine()
    
    slow_ratio = incident_data.slow_requests / max(incident_data.total_requests, 1)
    severity = rules.calculate_severity(incident_data.p99_latency, slow_ratio)
    bucket = rules.get_bucket_for_latency(incident_data.p99_latency)
    initial_status = rules.determine_initial_status(severity)
    
    affected_count, tenant_list = rules.identify_affected_tenants(incident_data.samples)
    incident_id = rules.generate_incident_id()
    
    incident = Incident(
        incident_id=incident_id,
        api_path=incident_data.api_path,
        status=initial_status,
        severity=severity,
        avg_latency=incident_data.avg_latency,
        p95_latency=incident_data.p95_latency,
        p99_latency=incident_data.p99_latency,
        total_requests=incident_data.total_requests,
        slow_requests=incident_data.slow_requests,
        affected_tenants=affected_count,
        tenant_list=tenant_list,
        start_time=incident_data.start_time,
        current_bucket=bucket.bucket_name
    )
    db.add(incident)
    db.flush()
    
    filtered_samples = rules.filter_samples(incident_data.samples)
    for sample_data in filtered_samples:
        sample = SlowRequestSample(
            incident_id=incident_id,
            request_id=sample_data.request_id,
            tenant_id=sample_data.tenant_id,
            latency=sample_data.latency,
            timestamp=sample_data.timestamp,
            http_method=sample_data.http_method,
            status_code=sample_data.status_code,
            user_agent=sample_data.user_agent,
            client_ip=sample_data.client_ip
        )
        db.add(sample)
    
    timeline_event = IncidentTimeline(
        incident_id=incident_id,
        event_type="INCIDENT_DETECTED",
        event_message=rules.get_status_explanation(initial_status, incident),
        to_status=initial_status,
        operator="SYSTEM"
    )
    db.add(timeline_event)
    
    db.commit()
    db.refresh(incident)
    rules.close()
    
    return incident


@app.get("/api/incidents", response_model=IncidentListResponse)
def list_incidents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    api_path: Optional[str] = Query(None),
    start_time_from: Optional[datetime] = Query(None),
    start_time_to: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Incident)
    
    if status:
        query = query.filter(Incident.status == status)
    if severity:
        query = query.filter(Incident.severity == severity)
    if api_path:
        query = query.filter(Incident.api_path.contains(api_path))
    if start_time_from:
        query = query.filter(Incident.start_time >= start_time_from)
    if start_time_to:
        query = query.filter(Incident.start_time <= start_time_to)
    
    total = query.count()
    incidents = query.order_by(Incident.start_time.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {"total": total, "incidents": incidents}


@app.get("/api/incidents/{incident_id}", response_model=IncidentDetailResponse)
def get_incident_detail(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="事故记录不存在")
    
    samples = db.query(SlowRequestSample).filter(SlowRequestSample.incident_id == incident_id).order_by(SlowRequestSample.latency.desc()).all()
    timeline = db.query(IncidentTimeline).filter(IncidentTimeline.incident_id == incident_id).order_by(IncidentTimeline.timestamp).all()
    remarks = db.query(TroubleshootRemark).filter(TroubleshootRemark.incident_id == incident_id).order_by(TroubleshootRemark.timestamp).all()
    
    return {
        "incident": incident,
        "samples": samples,
        "timeline": timeline,
        "remarks": remarks
    }


@app.put("/api/incidents/{incident_id}/status", response_model=IncidentResponse)
def update_incident_status(incident_id: str, status_update: StatusUpdateRequest, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="事故记录不存在")
    
    rules = IncidentRulesEngine()
    old_status = incident.status
    
    if not rules.is_valid_transition(old_status, status_update.new_status):
        raise HTTPException(status_code=400, detail=f"无效的状态转换: {old_status} -> {status_update.new_status}")
    
    incident.status = status_update.new_status
    incident.updated_at = datetime.utcnow()
    
    if status_update.new_status in ["RESOLVED", "FALSE_POSITIVE", "CLOSED"]:
        incident.end_time = datetime.utcnow()
    
    if status_update.notes:
        incident.recovery_notes = status_update.notes
    
    event_message = rules.get_status_explanation(status_update.new_status, incident)
    if status_update.notes:
        event_message += f" | 备注: {status_update.notes}"
    
    timeline_event = IncidentTimeline(
        incident_id=incident_id,
        event_type="STATUS_CHANGE",
        event_message=event_message,
        from_status=old_status,
        to_status=status_update.new_status,
        operator=status_update.operator
    )
    db.add(timeline_event)
    
    db.commit()
    db.refresh(incident)
    rules.close()
    
    return incident


@app.post("/api/incidents/{incident_id}/remarks", response_model=TroubleshootRemarkResponse)
def add_remark(incident_id: str, remark: TroubleshootRemarkCreate, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.incident_id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="事故记录不存在")
    
    db_remark = TroubleshootRemark(
        incident_id=incident_id,
        author=remark.author,
        content=remark.content,
        is_resolution=remark.is_resolution
    )
    db.add(db_remark)
    
    timeline_event = IncidentTimeline(
        incident_id=incident_id,
        event_type="REMARK_ADDED",
        event_message=f"{remark.author} 添加了排查备注: {remark.content[:50]}...",
        operator=remark.author
    )
    db.add(timeline_event)
    
    db.commit()
    db.refresh(db_remark)
    
    return db_remark


@app.post("/api/incidents/batch")
def batch_import(batch_data: BatchImportRequest, db: Session = Depends(get_db)):
    rules = IncidentRulesEngine()
    results = []
    
    for item in batch_data.items:
        slow_ratio = item.slow_requests / max(item.total_requests, 1)
        severity = rules.calculate_severity(item.p99_latency, slow_ratio)
        bucket = rules.get_bucket_for_latency(item.p99_latency)
        initial_status = rules.determine_initial_status(severity)
        
        tenant_list = ",".join(sorted(item.tenant_ids))
        incident_id = rules.generate_incident_id()
        
        incident = Incident(
            incident_id=incident_id,
            api_path=item.api_path,
            status=initial_status,
            severity=severity,
            avg_latency=item.avg_latency,
            p95_latency=item.p95_latency,
            p99_latency=item.p99_latency,
            total_requests=item.total_requests,
            slow_requests=item.slow_requests,
            affected_tenants=len(item.tenant_ids),
            tenant_list=tenant_list,
            start_time=item.start_time,
            current_bucket=bucket.bucket_name
        )
        db.add(incident)
        db.flush()
        
        timeline_event = IncidentTimeline(
            incident_id=incident_id,
            event_type="BATCH_IMPORTED",
            event_message=f"通过批量导入创建事故记录，操作人: {batch_data.operator}",
            to_status=initial_status,
            operator=batch_data.operator
        )
        db.add(timeline_event)
        
        results.append({
            "incident_id": incident_id,
            "api_path": item.api_path,
            "status": initial_status,
            "severity": severity
        })
    
    db.commit()
    rules.close()
    
    return {"imported": len(results), "results": results}


@app.get("/api/incidents/export/report")
def export_report(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    if severity:
        query = query.filter(Incident.severity == severity)
    
    incidents = query.order_by(Incident.start_time.desc()).all()
    rules = IncidentRulesEngine()
    
    report_data = []
    for incident in incidents:
        timeline = db.query(IncidentTimeline).filter(IncidentTimeline.incident_id == incident.incident_id).all()
        remarks = db.query(TroubleshootRemark).filter(TroubleshootRemark.incident_id == incident.incident_id).all()
        
        status_explanation = rules.get_status_explanation(incident.status, incident)
        duration = rules.calculate_duration(incident)
        
        timeline_events = [
            {
                "time": t.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "type": t.event_type,
                "message": t.event_message,
                "operator": t.operator
            }
            for t in timeline
        ]
        
        report_data.append({
            "事故ID": incident.incident_id,
            "接口路径": incident.api_path,
            "当前状态": incident.status,
            "严重程度": incident.severity,
            "状态说明": status_explanation,
            "延迟分桶": incident.current_bucket,
            "平均延迟(ms)": round(incident.avg_latency, 2),
            "P95延迟(ms)": round(incident.p95_latency, 2),
            "P99延迟(ms)": round(incident.p99_latency, 2),
            "总请求数": incident.total_requests,
            "慢请求数": incident.slow_requests,
            "慢请求占比": f"{round(incident.slow_requests / max(incident.total_requests, 1) * 100, 2)}%",
            "受影响租户数": incident.affected_tenants,
            "受影响租户": incident.tenant_list,
            "开始时间": incident.start_time.strftime("%Y-%m-%d %H:%M:%S"),
            "结束时间": incident.end_time.strftime("%Y-%m-%d %H:%M:%S") if incident.end_time else "",
            "持续时间": duration,
            "恢复备注": incident.recovery_notes or "",
            "时间线事件数": len(timeline_events),
            "时间线详情": json.dumps(timeline_events, ensure_ascii=False),
            "排查备注数": len(remarks),
            "创建时间": incident.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "更新时间": incident.updated_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    import pandas as pd
    output = io.BytesIO()
    df = pd.DataFrame(report_data)
    df.to_excel(output, index=False, sheet_name="事故报告", engine='openpyxl')
    output.seek(0)
    
    rules.close()
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=incident_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"}
    )


@app.get("/api/buckets")
def get_latency_buckets(db: Session = Depends(get_db)):
    buckets = db.query(LatencyBucket).order_by(LatencyBucket.min_latency).all()
    return buckets


@app.get("/api/stats/summary")
def get_stats_summary(db: Session = Depends(get_db)):
    total_incidents = db.query(Incident).count()
    open_incidents = db.query(Incident).filter(Incident.status.in_(["DETECTED", "INVESTIGATING", "ESCALATED"])).count()
    today = datetime.utcnow().date()
    today_incidents = db.query(Incident).filter(func.date(Incident.start_time) == today).count()
    
    by_severity = db.query(
        Incident.severity,
        func.count(Incident.id)
    ).group_by(Incident.severity).all()
    
    by_status = db.query(
        Incident.status,
        func.count(Incident.id)
    ).group_by(Incident.status).all()
    
    return {
        "total_incidents": total_incidents,
        "open_incidents": open_incidents,
        "today_incidents": today_incidents,
        "by_severity": {s: c for s, c in by_severity},
        "by_status": {s: c for s, c in by_status}
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
