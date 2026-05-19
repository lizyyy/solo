from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
import io

from database import init_db, get_db, SchemaVersion, Consumer, CompatibilityRule, ChangeRequest, InterceptRecord, ImpactReport, StatusHistory
from schemas import (
    SchemaVersionCreate, SchemaVersionResponse,
    ConsumerCreate, ConsumerResponse,
    CompatibilityRuleCreate, CompatibilityRuleResponse,
    ChangeRequestCreate, ChangeRequestResponse, ChangeRequestStatusUpdate,
    InterceptRecordCreate, InterceptRecordResponse, InterceptRecordResolve,
    ImpactReportCreate, ImpactReportResponse,
    CompatibilityCheckResult, ExportRequest, StatusTransitionRequest,
    StatusHistoryResponse
)
from compatibility import check_compatibility
from exporter import export_to_excel, generate_impact_report_export, generate_intercept_records_export

app = FastAPI(title="Schema 兼容门禁 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()
    db = next(get_db())
    if db.query(CompatibilityRule).count() == 0:
        default_rules = [
            CompatibilityRule(rule_name="字段删除检测", rule_type="field_removed", description="检测字段是否被删除", severity="critical"),
            CompatibilityRule(rule_name="类型变更检测", rule_type="type_changed", description="检测字段类型是否变更", severity="error"),
            CompatibilityRule(rule_name="必填字段新增检测", rule_type="required_field_added", description="检测是否新增必填字段", severity="error"),
            CompatibilityRule(rule_name="字段必填属性变更检测", rule_type="field_became_required", description="检测字段是否从可选变为必填", severity="error"),
        ]
        db.add_all(default_rules)
        db.commit()
    db.close()


@app.get("/")
def root():
    return {"message": "Schema 兼容门禁 API 运行中", "docs": "/docs"}


@app.post("/api/schemas", response_model=SchemaVersionResponse)
def create_schema(schema: SchemaVersionCreate, db: Session = Depends(get_db)):
    db_schema = SchemaVersion(**schema.model_dump())
    db.add(db_schema)
    db.commit()
    db.refresh(db_schema)
    return db_schema


@app.get("/api/schemas", response_model=List[SchemaVersionResponse])
def list_schemas(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    schemas = db.query(SchemaVersion).offset(skip).limit(limit).all()
    return schemas


@app.get("/api/schemas/{schema_id}", response_model=SchemaVersionResponse)
def get_schema(schema_id: int, db: Session = Depends(get_db)):
    schema = db.query(SchemaVersion).filter(SchemaVersion.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema 不存在")
    return schema


@app.post("/api/consumers", response_model=ConsumerResponse)
def create_consumer(consumer: ConsumerCreate, db: Session = Depends(get_db)):
    db_consumer = Consumer(**consumer.model_dump())
    db.add(db_consumer)
    db.commit()
    db.refresh(db_consumer)
    return db_consumer


@app.get("/api/consumers", response_model=List[ConsumerResponse])
def list_consumers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    consumers = db.query(Consumer).offset(skip).limit(limit).all()
    return consumers


@app.post("/api/change-requests", response_model=ChangeRequestResponse)
def create_change_request(request: ChangeRequestCreate, db: Session = Depends(get_db)):
    request_id = f"CR-{uuid.uuid4().hex[:8].upper()}"
    
    compatibility_result = check_compatibility(
        db,
        request.old_schema,
        request.new_schema,
        request.schema_id
    )
    
    db_request = ChangeRequest(
        **request.model_dump(),
        request_id=request_id,
        compatibility_result=compatibility_result
    )
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    
    initial_history = StatusHistory(
        change_request_id=db_request.id,
        from_status=None,
        to_status="pending",
        changed_by=request.created_by,
        comments="变更申请创建"
    )
    db.add(initial_history)
    
    if not compatibility_result["is_compatible"]:
        for consumer_data in compatibility_result["affected_consumers"]:
            intercept = InterceptRecord(
                change_request_id=db_request.id,
                consumer_id=consumer_data["consumer_id"],
                reason=f"破坏性变更影响字段: {', '.join([f['field'] for f in consumer_data['affected_fields']])}",
                severity="error",
                failed_sample={
                    "affected_fields": consumer_data["affected_fields"],
                    "breaking_changes": [c for c in compatibility_result["breaking_changes"] if c["field"] in [f["field"] for f in consumer_data["affected_fields"]]]
                }
            )
            db.add(intercept)
    db.commit()
    db.refresh(db_request)
    
    return db_request


@app.get("/api/change-requests", response_model=List[ChangeRequestResponse])
def list_change_requests(
    status: Optional[str] = None,
    schema_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ChangeRequest)
    if status:
        query = query.filter(ChangeRequest.status == status)
    if schema_id:
        query = query.filter(ChangeRequest.schema_id == schema_id)
    requests = query.order_by(ChangeRequest.created_at.desc()).offset(skip).limit(limit).all()
    return requests


@app.get("/api/change-requests/{request_id}", response_model=ChangeRequestResponse)
def get_change_request(request_id: int, db: Session = Depends(get_db)):
    request = db.query(ChangeRequest).filter(ChangeRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="变更申请不存在")
    return request


@app.patch("/api/change-requests/{request_id}/status", response_model=ChangeRequestResponse)
def update_change_request_status(
    request_id: int,
    status_update: ChangeRequestStatusUpdate,
    db: Session = Depends(get_db)
):
    request = db.query(ChangeRequest).filter(ChangeRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="变更申请不存在")
    
    valid_transitions = {
        "pending": ["approved", "rejected", "blocked"],
        "blocked": ["approved", "rejected"],
        "approved": ["deployed"],
        "deployed": ["completed"],
        "rejected": ["pending"]
    }
    
    if request.status not in valid_transitions or status_update.status not in valid_transitions[request.status]:
        raise HTTPException(
            status_code=400,
            detail=f"无效的状态转换: {request.status} -> {status_update.status}"
        )
    
    old_status = request.status
    request.status = status_update.status
    if status_update.approved_by:
        request.approved_by = status_update.approved_by
    if status_update.comments:
        request.comments = status_update.comments
    if status_update.status == "approved":
        request.approved_at = datetime.utcnow()
    
    status_history = StatusHistory(
        change_request_id=request.id,
        from_status=old_status,
        to_status=status_update.status,
        changed_by=status_update.approved_by,
        comments=status_update.comments
    )
    db.add(status_history)
    
    db.commit()
    db.refresh(request)
    return request


@app.get("/api/intercept-records", response_model=List[InterceptRecordResponse])
def list_intercept_records(
    status: Optional[str] = None,
    change_request_id: Optional[int] = None,
    consumer_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(InterceptRecord)
    if status:
        query = query.filter(InterceptRecord.status == status)
    if change_request_id:
        query = query.filter(InterceptRecord.change_request_id == change_request_id)
    if consumer_id:
        query = query.filter(InterceptRecord.consumer_id == consumer_id)
    records = query.order_by(InterceptRecord.intercept_time.desc()).offset(skip).limit(limit).all()
    return records


@app.patch("/api/intercept-records/{record_id}/resolve", response_model=InterceptRecordResponse)
def resolve_intercept_record(
    record_id: int,
    resolve_data: InterceptRecordResolve,
    db: Session = Depends(get_db)
):
    record = db.query(InterceptRecord).filter(InterceptRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="拦截记录不存在")
    
    record.status = "resolved"
    record.resolved_by = resolve_data.resolved_by
    record.resolution_note = resolve_data.resolution_note
    record.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(record)
    return record


@app.post("/api/compatibility/check", response_model=CompatibilityCheckResult)
def check_schema_compatibility(
    old_schema: dict,
    new_schema: dict,
    schema_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    result = check_compatibility(db, old_schema, new_schema, schema_id)
    return result


@app.post("/api/impact-reports", response_model=ImpactReportResponse)
def generate_impact_report(report_request: ImpactReportCreate, db: Session = Depends(get_db)):
    change_request = db.query(ChangeRequest).filter(
        ChangeRequest.id == report_request.change_request_id
    ).first()
    
    if not change_request:
        raise HTTPException(status_code=404, detail="变更申请不存在")
    
    compatibility_result = change_request.compatibility_result or {}
    
    intercept_records = db.query(InterceptRecord).filter(
        InterceptRecord.change_request_id == change_request.id
    ).all()
    
    report = ImpactReport(
        change_request_id=change_request.id,
        report_type=report_request.report_type,
        generated_by=report_request.generated_by,
        affected_consumers=compatibility_result.get("affected_consumers", []),
        breaking_changes=compatibility_result.get("breaking_changes", []),
        recommendations=compatibility_result.get("recommendations", []),
        report_content=f"影响报告 - {change_request.title}"
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@app.get("/api/impact-reports", response_model=List[ImpactReportResponse])
def list_impact_reports(
    change_request_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ImpactReport)
    if change_request_id:
        query = query.filter(ImpactReport.change_request_id == change_request_id)
    reports = query.order_by(ImpactReport.generated_at.desc()).offset(skip).limit(limit).all()
    return reports


@app.post("/api/export/impact-report")
def export_impact_report_endpoint(change_request_id: int, db: Session = Depends(get_db)):
    change_request = db.query(ChangeRequest).filter(ChangeRequest.id == change_request_id).first()
    if not change_request:
        raise HTTPException(status_code=404, detail="变更申请不存在")
    
    intercept_records = db.query(InterceptRecord).filter(
        InterceptRecord.change_request_id == change_request_id
    ).all()
    
    compatibility_result = change_request.compatibility_result or {}
    affected_consumers = compatibility_result.get("affected_consumers", [])
    breaking_changes = compatibility_result.get("breaking_changes", [])
    
    export_data = generate_impact_report_export(
        change_request,
        intercept_records,
        affected_consumers,
        breaking_changes
    )
    
    excel_file = export_to_excel(export_data)
    filename = f"impact-report-{change_request.request_id}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.xlsx"
    
    return StreamingResponse(
        io.BytesIO(excel_file.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/export/intercept-records")
def export_intercept_records_endpoint(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InterceptRecord)
    if status:
        query = query.filter(InterceptRecord.status == status)
    records = query.order_by(InterceptRecord.intercept_time.desc()).all()
    
    export_data = generate_intercept_records_export(records)
    excel_file = export_to_excel(export_data)
    filename = f"intercept-records-{datetime.now().strftime('%Y%m%d-%H%M%S')}.xlsx"
    
    return StreamingResponse(
        io.BytesIO(excel_file.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_schemas = db.query(SchemaVersion).count()
    total_consumers = db.query(Consumer).count()
    total_change_requests = db.query(ChangeRequest).count()
    pending_requests = db.query(ChangeRequest).filter(ChangeRequest.status == "pending").count()
    open_intercepts = db.query(InterceptRecord).filter(InterceptRecord.status == "open").count()
    resolved_intercepts = db.query(InterceptRecord).filter(InterceptRecord.status == "resolved").count()
    
    recent_changes = db.query(ChangeRequest).order_by(ChangeRequest.created_at.desc()).limit(5).all()
    
    return {
        "total_schemas": total_schemas,
        "total_consumers": total_consumers,
        "total_change_requests": total_change_requests,
        "pending_requests": pending_requests,
        "open_intercepts": open_intercepts,
        "resolved_intercepts": resolved_intercepts,
        "recent_changes": [
            {
                "id": c.id,
                "request_id": c.request_id,
                "title": c.title,
                "status": c.status,
                "created_at": c.created_at
            }
            for c in recent_changes
        ]
    }


@app.get("/api/change-requests/{request_id}/status-history", response_model=List[StatusHistoryResponse])
def get_change_request_status_history(
    request_id: int,
    db: Session = Depends(get_db)
):
    request = db.query(ChangeRequest).filter(ChangeRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="变更申请不存在")
    
    history = db.query(StatusHistory).filter(
        StatusHistory.change_request_id == request_id
    ).order_by(StatusHistory.changed_at.desc()).all()
    
    return history


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
