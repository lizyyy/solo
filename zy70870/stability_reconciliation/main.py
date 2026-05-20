from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os

from stability_reconciliation.models.database import (
    get_db, init_db, TestProtocol, Sample, ChamberRecord
)
from stability_reconciliation.schemas.reconciliation import (
    TestProtocolResponse, SampleResponse, ChamberRecordResponse,
    ReconciliationRecordResponse, ReconciliationReviewRequest,
    ReportResponse, ReportGenerateRequest, TraceResponse,
    TraceRecord, ReconciliationBatchResponse
)
from stability_reconciliation.services.import_service import DataImportService
from stability_reconciliation.services.reconciliation_engine import ReconciliationEngine
from stability_reconciliation.services.review_service import ReviewService
from stability_reconciliation.services.report_service import ReportService

app = FastAPI(
    title="药企稳定性试验对账服务",
    description="用于药企QA核对样品数据、试验方案和环境箱记录的对账服务",
    version="1.0.0"
)


@app.on_event("startup")
def startup_event():
    init_db()
    os.makedirs("stability_reconciliation/data", exist_ok=True)


@app.get("/")
def root():
    return {
        "message": "药企稳定性试验对账服务",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/api/import/protocol", response_model=TestProtocolResponse)
async def import_protocol(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        import_service = DataImportService(db)
        protocol, _ = import_service.import_test_protocol_json(content.decode('utf-8'))
        return protocol
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/import/samples/{protocol_id}", response_model=List[SampleResponse])
async def import_samples(protocol_id: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        import_service = DataImportService(db)
        samples = import_service.import_samples_csv(content.decode('utf-8'), protocol_id)
        return samples
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/import/chamber-records", response_model=List[ChamberRecordResponse])
async def import_chamber_records(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        import_service = DataImportService(db)
        records = import_service.import_chamber_records_csv(content.decode('utf-8'))
        return records
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/import/template/{template_type}")
def get_import_template(template_type: str):
    from io import StringIO
    from fastapi.responses import Response
    
    db = next(get_db())
    import_service = DataImportService(db)
    template = import_service.get_import_template(template_type)
    
    if template_type in ["samples", "chamber"]:
        return Response(
            content=template,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={template_type}_template.csv"}
        )
    else:
        return Response(
            content=template,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=protocol_template.json"}
        )


@app.post("/api/reconciliation/run/{protocol_id}")
def run_reconciliation(protocol_id: str, db: Session = Depends(get_db)):
    try:
        engine = ReconciliationEngine(db)
        batch_id, records, summary = engine.run_reconciliation(protocol_id)
        
        return {
            "batch_id": batch_id,
            "protocol_id": protocol_id,
            "summary": summary,
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/reconciliation/batch/{batch_id}", response_model=ReconciliationBatchResponse)
def get_reconciliation_batch(batch_id: str, db: Session = Depends(get_db)):
    from stability_reconciliation.models.database import ReconciliationRecord
    
    records = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.reconciliation_batch_id == batch_id
    ).all()
    
    if not records:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    protocol_id = records[0].protocol_id
    
    results = []
    for record in records:
        sample = db.query(Sample).filter(Sample.id == record.sample_id).first()
        discrepancies = []
        if record.discrepancy_type:
            discrepancies.append({
                "type": record.discrepancy_type,
                "source": record.discrepancy_source or "",
                "description": record.discrepancy_description or "",
                "severity": "medium",
                "evidence": {}
            })
        
        results.append({
            "reconciliation_id": record.id,
            "sample_id": sample.sample_id if sample else "",
            "sampling_point": sample.sampling_point if sample else "",
            "status": record.status,
            "discrepancies": discrepancies,
            "calculation_summary": record.calculation_details or {}
        })
    
    total = len(records)
    matched = sum(1 for r in records if r.status == "matched")
    discrepancy = sum(1 for r in records if r.status == "discrepancy")
    resolved = sum(1 for r in records if r.is_resolved)
    
    return {
        "batch_id": batch_id,
        "protocol_id": protocol_id,
        "total_samples": total,
        "matched_samples": matched,
        "discrepancy_count": discrepancy,
        "resolved_count": resolved,
        "results": results,
        "generated_at": datetime.utcnow()
    }


@app.get("/api/reconciliation/{reconciliation_id}", response_model=ReconciliationRecordResponse)
def get_reconciliation(reconciliation_id: str, db: Session = Depends(get_db)):
    from stability_reconciliation.models.database import ReconciliationRecord
    
    record = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.id == reconciliation_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Reconciliation record not found")
    
    return record


@app.post("/api/reconciliation/review", response_model=ReconciliationRecordResponse)
def review_reconciliation(request: ReconciliationReviewRequest, db: Session = Depends(get_db)):
    try:
        review_service = ReviewService(db)
        record = review_service.review_reconciliation(
            reconciliation_id=request.reconciliation_id,
            review_comment=request.review_comment,
            is_resolved=request.is_resolved,
            resolution_note=request.resolution_note,
            updated_calculations=request.updated_calculations,
            reviewer=request.reviewer
        )
        return record
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/reconciliation/recalculate/{reconciliation_id}")
def recalculate_reconciliation(reconciliation_id: str, db: Session = Depends(get_db)):
    try:
        engine = ReconciliationEngine(db)
        record = engine.recalculate_reconciliation(reconciliation_id, {})
        return {
            "message": "Recalculation completed",
            "reconciliation_id": record.id,
            "new_status": record.status
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/audit/history/{reconciliation_id}")
def get_audit_history(reconciliation_id: str, limit: int = 100, db: Session = Depends(get_db)):
    review_service = ReviewService(db)
    logs = review_service.get_audit_history(reconciliation_id=reconciliation_id, limit=limit)
    
    return {
        "reconciliation_id": reconciliation_id,
        "total": len(logs),
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "field_changed": log.field_changed,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "performed_by": log.performed_by,
                "performed_at": log.performed_at,
                "comment": log.comment
            }
            for log in logs
        ]
    }


@app.post("/api/reports/generate", response_model=ReportResponse)
def generate_report(request: ReportGenerateRequest, db: Session = Depends(get_db)):
    try:
        report_service = ReportService(db)
        report = report_service.generate_reconciliation_report(
            protocol_id=request.protocol_id,
            reconciliation_batch_id=request.reconciliation_batch_id,
            report_type=request.report_type,
            generated_by=request.generated_by
        )
        return report
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/reports", response_model=List[ReportResponse])
def get_report_list(protocol_id: Optional[str] = None, report_type: Optional[str] = None,
                    limit: int = 50, db: Session = Depends(get_db)):
    report_service = ReportService(db)
    reports = report_service.get_report_list(protocol_id=protocol_id, report_type=report_type, limit=limit)
    return reports


@app.get("/api/reports/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_db)):
    report_service = ReportService(db)
    try:
        return report_service.get_report_content(report_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/reports/{report_id}/download")
def download_report(report_id: str, db: Session = Depends(get_db)):
    from stability_reconciliation.models.database import Report
    
    report = db.query(Report).filter(Report.id == report_id).first()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Report file not found")
    
    filename = os.path.basename(report.file_path)
    return FileResponse(
        report.file_path,
        media_type="application/octet-stream",
        filename=filename
    )


@app.get("/api/trace/sample/{sample_id}", response_model=TraceResponse)
def trace_sample(sample_id: str, db: Session = Depends(get_db)):
    from stability_reconciliation.models.database import ReconciliationRecord, AuditLog
    
    sample = db.query(Sample).filter(Sample.id == sample_id).first()
    
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    trace_path = []
    
    trace_path.append(TraceRecord(
        level="sample",
        type="sample",
        id=sample.id,
        description=f"样品记录: {sample.sample_id}",
        timestamp=sample.created_at,
        details={
            "sample_id": sample.sample_id,
            "sampling_point": sample.sampling_point,
            "planned_sampling_date": sample.planned_sampling_date.isoformat() if sample.planned_sampling_date else None,
            "actual_sampling_date": sample.actual_sampling_date.isoformat() if sample.actual_sampling_date else None,
            "condition": sample.condition,
            "storage_location": sample.storage_location
        }
    ))
    
    protocol = db.query(TestProtocol).filter(TestProtocol.id == sample.protocol_id).first()
    if protocol:
        trace_path.append(TraceRecord(
            level="protocol",
            type="test_protocol",
            id=protocol.id,
            description=f"试验方案: {protocol.protocol_name}",
            timestamp=protocol.created_at,
            details={
                "protocol_name": protocol.protocol_name,
                "product_name": protocol.product_name,
                "batch_number": protocol.batch_number
            }
        ))
    
    chamber_records = db.query(ChamberRecord).filter(
        ChamberRecord.chamber_name == sample.storage_location
    ).order_by(ChamberRecord.record_time.desc()).limit(10).all()
    
    for cr in chamber_records:
        trace_path.append(TraceRecord(
            level="chamber",
            type="chamber_record",
            id=cr.id,
            description=f"箱体记录: {cr.chamber_name} - {cr.temperature}°C",
            timestamp=cr.record_time,
            details={
                "chamber_id": cr.chamber_id,
                "temperature": cr.temperature,
                "humidity": cr.humidity,
                "target_temperature": cr.target_temperature,
                "target_humidity": cr.target_humidity,
                "is_alert": cr.is_alert,
                "alert_type": cr.alert_type
            }
        ))
    
    reconciliation_records = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.sample_id == sample_id
    ).all()
    
    for rr in reconciliation_records:
        trace_path.append(TraceRecord(
            level="reconciliation",
            type="reconciliation_record",
            id=rr.id,
            description=f"对账记录: {rr.status}",
            timestamp=rr.created_at,
            details={
                "status": rr.status,
                "discrepancy_type": rr.discrepancy_type,
                "discrepancy_source": rr.discrepancy_source,
                "discrepancy_description": rr.discrepancy_description,
                "is_resolved": rr.is_resolved,
                "resolution_note": rr.resolution_note,
                "batch_id": rr.reconciliation_batch_id
            }
        ))
        
        audit_logs = db.query(AuditLog).filter(
            AuditLog.reconciliation_id == rr.id
        ).order_by(AuditLog.performed_at.desc()).all()
        
        for al in audit_logs:
            trace_path.append(TraceRecord(
                level="audit",
                type="audit_log",
                id=al.id,
                description=f"操作日志: {al.action} - {al.performed_by}",
                timestamp=al.performed_at,
                details={
                    "action": al.action,
                    "field_changed": al.field_changed,
                    "old_value": al.old_value,
                    "new_value": al.new_value,
                    "performed_by": al.performed_by,
                    "comment": al.comment
                }
            ))
    
    trace_path.sort(key=lambda x: x.timestamp, reverse=True)
    
    return TraceResponse(
        sample_id=sample_id,
        trace_path=trace_path
    )


@app.get("/api/protocols", response_model=List[TestProtocolResponse])
def list_protocols(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    protocols = db.query(TestProtocol).offset(skip).limit(limit).all()
    return protocols


@app.get("/api/samples/{protocol_id}", response_model=List[SampleResponse])
def list_samples(protocol_id: str, db: Session = Depends(get_db)):
    samples = db.query(Sample).filter(Sample.protocol_id == protocol_id).all()
    return samples


@app.get("/api/chamber-records/{chamber_name}", response_model=List[ChamberRecordResponse])
def list_chamber_records(chamber_name: str, start_date: Optional[datetime] = None,
                         end_date: Optional[datetime] = None, limit: int = 100,
                         db: Session = Depends(get_db)):
    from sqlalchemy import and_
    
    query = db.query(ChamberRecord).filter(ChamberRecord.chamber_name == chamber_name)
    
    if start_date:
        query = query.filter(ChamberRecord.record_time >= start_date)
    if end_date:
        query = query.filter(ChamberRecord.record_time <= end_date)
    
    records = query.order_by(ChamberRecord.record_time.desc()).limit(limit).all()
    return records


@app.get("/api/statistics/review")
def get_review_statistics(batch_id: Optional[str] = None, protocol_id: Optional[str] = None,
                          db: Session = Depends(get_db)):
    review_service = ReviewService(db)
    return review_service.get_review_statistics(batch_id=batch_id, protocol_id=protocol_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
