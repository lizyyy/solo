import uuid
import time
import json
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse, Response, FileResponse
from sqlalchemy.orm import Session
from typing import List
from database import init_db, get_db
from models import Batch, RecordingRecord, CompensationResult, ManualCorrection, ProcessingReport
from schemas import (
    BatchCreate, BatchResponse, PreviewResult, ProcessingReportResponse,
    ManualCorrectionCreate, BatchStatus, SourceType
)
from service import (
    calculate_content_hash, generate_sample_cross_day_data,
    process_single_record, generate_report, generate_markdown_report
)
from datetime import datetime

app = FastAPI(title="批量补偿后端服务", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    init_db()

@app.post("/api/batches/preview", response_model=PreviewResult)
async def preview_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    records_dicts = [r.model_dump() for r in batch_data.records]
    content_hash = calculate_content_hash(records_dicts)
    
    existing_batch = db.query(Batch).filter(Batch.content_hash == content_hash).first()
    if existing_batch:
        raise HTTPException(
            status_code=409,
            detail=f"该批次内容已存在，批次号: {existing_batch.batch_no}"
        )
    
    total_compensation = 0
    affected_customers = set()
    mixed_count = 0
    preview_records = []
    
    for record in batch_data.records:
        if record.is_mixed_source:
            mixed_count += 1
            comp = 50.0
        else:
            rules = {
                "refund_delay": 100.0,
                "quality_issue": 80.0,
                "miscommunication": 30.0,
                "billing_error": 150.0,
                "delivery_delay": 20.0
            }
            comp = rules.get(record.issue_type, 0.0)
        
        total_compensation += comp
        affected_customers.add(record.customer_id)
        preview_records.append({
            "recording_id": record.recording_id,
            "issue_type": record.issue_type,
            "estimated_compensation": comp,
            "is_mixed_source": record.is_mixed_source
        })
    
    return PreviewResult(
        batch_no=batch_data.batch_no,
        total_records=len(batch_data.records),
        estimated_compensation=total_compensation,
        affected_customers=len(affected_customers),
        mixed_source_count=mixed_count,
        records_preview=preview_records
    )

@app.post("/api/batches/execute", response_model=BatchResponse)
async def execute_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    start_time = time.time()
    
    records_dicts = [r.model_dump() for r in batch_data.records]
    content_hash = calculate_content_hash(records_dicts)
    
    existing_batch = db.query(Batch).filter(Batch.content_hash == content_hash).first()
    if existing_batch:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "该批次内容已存在，复用旧结论",
                "existing_batch_no": existing_batch.batch_no
            }
        )
    
    batch_id = str(uuid.uuid4())
    batch = Batch(
        id=batch_id,
        batch_no=batch_data.batch_no,
        source_type=batch_data.source_type.value,
        status=BatchStatus.PROCESSING.value,
        content_hash=content_hash
    )
    db.add(batch)
    db.flush()
    
    for record_data in batch_data.records:
        record = RecordingRecord(
            id=str(uuid.uuid4()),
            batch_id=batch_id,
            **record_data.model_dump()
        )
        db.add(record)
    
    db.flush()
    
    records = db.query(RecordingRecord).filter(RecordingRecord.batch_id == batch_id).all()
    for record in records:
        result = process_single_record(record, db)
        db.add(result)
    
    db.flush()
    
    total_execution_time = int((time.time() - start_time) * 1000)
    report = generate_report(batch, db, total_execution_time)
    db.add(report)
    
    batch.status = BatchStatus.COMPLETED.value
    
    db.commit()
    
    total_comp = sum(r.compensation_amount for r in records)
    return BatchResponse(
        id=batch.id,
        batch_no=batch.batch_no,
        source_type=batch.source_type,
        status=batch.status,
        created_at=batch.created_at,
        total_records=len(records),
        total_compensation=total_comp
    )

@app.get("/api/batches/{batch_no}/report/json", response_model=ProcessingReportResponse)
async def get_report_json(batch_no: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    report = db.query(ProcessingReport).filter(ProcessingReport.batch_id == batch.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    return ProcessingReportResponse(
        batch_no=report.batch_no,
        total_records=report.total_records,
        success_count=report.success_count,
        failed_count=report.failed_count,
        total_execution_time_ms=report.total_execution_time_ms,
        before_summary=json.loads(report.before_summary),
        after_summary=json.loads(report.after_summary),
        next_steps=json.loads(report.next_steps),
        created_at=report.created_at
    )

@app.get("/api/batches/{batch_no}/report/markdown")
async def get_report_markdown(batch_no: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    report = db.query(ProcessingReport).filter(ProcessingReport.batch_id == batch.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    records = db.query(RecordingRecord).filter(RecordingRecord.batch_id == batch.id).all()
    corrections = db.query(ManualCorrection).filter(ManualCorrection.batch_id == batch.id).all()
    
    md_content = generate_markdown_report(report, records, corrections, batch)
    return Response(content=md_content, media_type="text/markdown")

@app.get("/api/batches/{batch_no}/report/download")
async def download_report(batch_no: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    report = db.query(ProcessingReport).filter(ProcessingReport.batch_id == batch.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    records = db.query(RecordingRecord).filter(RecordingRecord.batch_id == batch.id).all()
    corrections = db.query(ManualCorrection).filter(ManualCorrection.batch_id == batch.id).all()
    
    md_content = generate_markdown_report(report, records, corrections, batch)
    
    filename = f"compensation_report_{batch_no}.md"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(md_content)
    
    return FileResponse(
        path=filename,
        filename=filename,
        media_type="text/markdown"
    )

@app.post("/api/batches/{batch_no}/corrections")
async def add_manual_correction(
    batch_no: str,
    correction: ManualCorrectionCreate,
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    correction_record = ManualCorrection(
        id=str(uuid.uuid4()),
        batch_id=batch.id,
        **correction.model_dump()
    )
    db.add(correction_record)
    db.commit()
    
    return {"message": "人工修正记录已添加", "correction_id": correction_record.id}

@app.get("/api/batches/sample/cross-day")
async def get_sample_cross_day_data():
    return {
        "batch_no": "BATCH-SAMPLE-001",
        "source_type": "cross_day_after_sales",
        "records": generate_sample_cross_day_data()
    }

@app.get("/api/batches")
async def list_batches(db: Session = Depends(get_db)):
    batches = db.query(Batch).all()
    result = []
    for batch in batches:
        records = db.query(RecordingRecord).filter(RecordingRecord.batch_id == batch.id).all()
        total_comp = sum(r.compensation_amount for r in records)
        result.append({
            "id": batch.id,
            "batch_no": batch.batch_no,
            "source_type": batch.source_type,
            "status": batch.status,
            "created_at": batch.created_at,
            "total_records": len(records),
            "total_compensation": total_comp
        })
    return result

@app.get("/api/batches/{batch_no}/records")
async def get_batch_records(batch_no: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    records = db.query(RecordingRecord).filter(RecordingRecord.batch_id == batch.id).all()
    corrections = db.query(ManualCorrection).filter(ManualCorrection.batch_id == batch.id).all()
    
    return {
        "batch_no": batch_no,
        "records": [
            {
                "recording_id": r.recording_id,
                "customer_id": r.customer_id,
                "issue_type": r.issue_type,
                "original_status": r.original_status,
                "compensated_status": r.compensated_status,
                "compensation_amount": r.compensation_amount,
                "is_mixed_source": r.is_mixed_source,
                "content_summary": r.content_summary
            }
            for r in records
        ],
        "manual_corrections": [
            {
                "batch_no": batch_no,
                "operator": c.operator,
                "correction_type": c.correction_type,
                "original_value": c.original_value,
                "corrected_value": c.corrected_value,
                "reason": c.reason,
                "created_at": c.created_at
            }
            for c in corrections
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
