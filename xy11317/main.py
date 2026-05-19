from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import init_db, get_db, ComplaintService
from models import (
    ParentComplaint, GPSRecord, DriverCheckin,
    ComplaintWithDetails, DecisionRecord, ComplaintStatus
)
from reports import ReportGenerator
from security import SensitiveDataMasker

init_db()

app = FastAPI(title="校车调度迟到责任判定系统", version="1.0.0")

def get_complaint_service(db: Session = Depends(get_db)):
    return ComplaintService(db)

class MergeRequest(BaseModel):
    target_complaint_id: int
    source_complaint_ids: List[int]

class DecisionUpdateRequest(BaseModel):
    responsibility: str
    final_decision: str
    operator: str

class RejectRequest(BaseModel):
    reason: str
    operator: str

@app.post("/api/complaints", response_model=dict, summary="创建申诉")
def create_complaint(complaint: ParentComplaint, service: ComplaintService = Depends(get_complaint_service)):
    try:
        result = service.create_complaint(complaint)
        return {"id": result.id, "complaint_no": result.complaint_no, "status": result.status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/complaints", response_model=List[dict], summary="获取申诉列表")
def list_complaints(
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    bus_no: Optional[str] = None,
    service: ComplaintService = Depends(get_complaint_service)
):
    complaints = service.list_complaints(status, start_date, end_date, bus_no)
    return [
        {
            "id": c.id,
            "complaint_no": c.complaint_no,
            "parent_name": c.parent_name,
            "student_name": c.student_name,
            "bus_no": c.bus_no,
            "route_no": c.route_no,
            "delay_minutes": c.delay_minutes,
            "status": c.status,
            "responsibility": c.responsibility,
            "created_at": c.created_at
        } for c in complaints
    ]

@app.get("/api/complaints/{complaint_id}", summary="获取申诉详情")
def get_complaint(complaint_id: int, service: ComplaintService = Depends(get_complaint_service)):
    complaint = service.get_complaint(complaint_id)
    if not complaint:
        raise HTTPException(status_code=404, detail="申诉不存在")
    
    decision_records = service.get_decision_records(complaint_id)
    
    return {
        "id": complaint.id,
        "complaint_no": complaint.complaint_no,
        "parent_name": complaint.parent_name,
        "student_name": complaint.student_name,
        "school_name": complaint.school_name,
        "route_no": complaint.route_no,
        "bus_no": complaint.bus_no,
        "scheduled_arrival": complaint.scheduled_arrival,
        "actual_arrival": complaint.actual_arrival,
        "delay_minutes": complaint.delay_minutes,
        "complaint_reason": complaint.complaint_reason,
        "status": complaint.status,
        "responsibility": complaint.responsibility,
        "final_decision": complaint.final_decision,
        "gps_status": complaint.gps_status,
        "cross_site": complaint.cross_site,
        "gps_gap_minutes": complaint.gps_gap_minutes,
        "site_count": complaint.site_count,
        "decided_by": complaint.decided_by,
        "decided_at": complaint.decided_at,
        "decision_records": [
            {
                "rule_name": dr.rule_name,
                "result": dr.rule_result,
                "reason": dr.reason,
                "is_blocked": dr.is_blocked
            } for dr in decision_records
        ]
    }

@app.post("/api/complaints/{complaint_id}/process", summary="处理申诉")
def process_complaint(complaint_id: int, operator: str = "system", service: ComplaintService = Depends(get_complaint_service)):
    try:
        return service.process_complaint(complaint_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/complaints/merge", summary="合并申诉")
def merge_complaints(request: MergeRequest, operator: str = "system", service: ComplaintService = Depends(get_complaint_service)):
    try:
        return service.merge_complaints(request.target_complaint_id, request.source_complaint_ids, operator)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.put("/api/complaints/{complaint_id}/decision", summary="更新申诉判定")
def update_decision(complaint_id: int, request: DecisionUpdateRequest, service: ComplaintService = Depends(get_complaint_service)):
    try:
        result = service.update_complaint_decision(complaint_id, request.responsibility, request.final_decision, request.operator)
        return {
            "id": result.id,
            "complaint_no": result.complaint_no,
            "status": result.status,
            "responsibility": result.responsibility,
            "final_decision": result.final_decision
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.put("/api/complaints/{complaint_id}/reject", summary="驳回申诉")
def reject_complaint(complaint_id: int, request: RejectRequest, service: ComplaintService = Depends(get_complaint_service)):
    try:
        result = service.reject_complaint(complaint_id, request.reason, request.operator)
        return {
            "id": result.id,
            "complaint_no": result.complaint_no,
            "status": result.status,
            "final_decision": result.final_decision
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/api/gps", summary="批量添加GPS记录")
def add_gps_records(bus_no: str, records: List[GPSRecord], service: ComplaintService = Depends(get_complaint_service)):
    count = service.add_gps_records(bus_no, records)
    return {"added_count": count, "bus_no": bus_no}

@app.post("/api/checkins", summary="批量添加打卡记录")
def add_checkin_records(records: List[DriverCheckin], service: ComplaintService = Depends(get_complaint_service)):
    count = service.add_checkin_records(records)
    return {"added_count": count}

@app.get("/api/statistics", summary="获取统计数据")
def get_statistics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    service: ComplaintService = Depends(get_complaint_service)
):
    return service.get_statistics(start_date, end_date)

@app.get("/api/logs", summary="获取操作日志")
def get_operation_logs(
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    operator: Optional[str] = None,
    limit: int = 100,
    service: ComplaintService = Depends(get_complaint_service)
):
    logs = service.get_operation_logs(target_type, target_id, operator, limit)
    return [
        {
            "id": log.id,
            "operator": log.operator,
            "operation": log.operation,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "created_at": log.created_at
        } for log in logs
    ]

@app.get("/api/reports/monthly", summary="生成月度报告")
def get_monthly_report(year: int, month: int, service: ComplaintService = Depends(get_complaint_service)):
    generator = ReportGenerator(service)
    return generator.generate_monthly_report(year, month)

@app.get("/api/exports/complaints", summary="导出申诉数据CSV")
def export_complaints(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    include_sensitive: bool = False,
    service: ComplaintService = Depends(get_complaint_service)
):
    complaints = service.list_complaints(
        start_date=start_date,
        end_date=end_date,
        mask_sensitive=False
    )
    
    generator = ReportGenerator(service)
    csv_content = generator.export_complaints_to_csv(complaints, include_sensitive)
    
    filename = f"complaints_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/complaints/{complaint_id}/report", summary="获取申诉详细报告")
def get_complaint_report(complaint_id: int, service: ComplaintService = Depends(get_complaint_service)):
    try:
        generator = ReportGenerator(service)
        return generator.generate_complaint_detail_report(complaint_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/", summary="系统健康检查")
def root():
    return {
        "status": "ok",
        "service": "校车调度迟到责任判定系统",
        "version": "1.0.0",
        "docs": "/docs",
        "api_docs": "/redoc"
    }
