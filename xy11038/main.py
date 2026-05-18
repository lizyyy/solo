from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import uuid

from database import get_db, engine, Base
from models import ImportBatch, ImportBadRow, ImportRecordStatus, WaitlistRecord, AuditLog
from schemas import (
    WaitlistImportRow, ImportResponse, BadRowResponse,
    WaitlistRecordResponse, AuditLogResponse, ReviewRequest,
    SampleDataGenerator
)
from crud import process_waitlist_import, review_bad_row, create_audit_log

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="瑜伽教室团课候补转正API",
    description="支持批量导入候补转正记录，保留每一步变化的审计日志，坏行处理带原始字段、原因和处理建议",
    version="1.0.0"
)


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "suggestion": "请检查配置是否正确，如DATABASE_URL环境变量是否设置"
        }
    )


@app.post("/api/waitlist/import", response_model=ImportResponse)
async def import_waitlist_records(
    records: List[WaitlistImportRow],
    operator: str = "system",
    db: Session = Depends(get_db)
):
    batch_no = f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"

    batch = ImportBatch(
        batch_no=batch_no,
        file_name="API导入",
        total_count=len(records),
        success_count=0,
        failed_count=0,
        review_count=0,
        operator=operator
    )
    db.add(batch)
    db.commit()

    success_count = 0
    failed_count = 0
    review_count = 0

    for idx, record in enumerate(records, 1):
        record_dict = record.dict()
        success, status = process_waitlist_import(db, record_dict, idx, batch_no, operator)

        if success:
            success_count += 1
        elif status == ImportRecordStatus.NEEDS_REVIEW:
            review_count += 1
        else:
            failed_count += 1

    batch.success_count = success_count
    batch.failed_count = failed_count
    batch.review_count = review_count
    batch.status = "completed"
    db.commit()

    bad_rows = db.query(ImportBadRow).filter(ImportBadRow.import_batch_no == batch_no).all()
    bad_rows_response = [
        BadRowResponse(
            row_number=row.row_number,
            original_data=row.original_data,
            error_reason=row.error_reason.value,
            error_detail=row.error_detail,
            suggestion=row.suggestion
        ) for row in bad_rows
    ]

    create_audit_log(
        db, "IMPORT_BATCH_COMPLETED", "import_batches", batch.id,
        operator=operator,
        new_value=f"成功{success_count}，失败{failed_count}，待审核{review_count}"
    )

    return ImportResponse(
        batch_no=batch_no,
        total_count=len(records),
        success_count=success_count,
        failed_count=failed_count,
        review_count=review_count,
        bad_rows=bad_rows_response,
        import_time=batch.import_time
    )


@app.get("/api/samples/valid")
async def get_valid_samples():
    return SampleDataGenerator.generate_valid_sample()


@app.get("/api/samples/mixed")
async def get_mixed_samples():
    return SampleDataGenerator.generate_mixed_sample()


@app.get("/api/waitlist/records", response_model=List[WaitlistRecordResponse])
async def get_waitlist_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    records = db.query(WaitlistRecord).offset(skip).limit(limit).all()
    return [
        WaitlistRecordResponse(
            id=r.id,
            waitlist_no=r.waitlist_no,
            waitlist_order=r.waitlist_order,
            status=r.status.value,
            apply_time=r.apply_time,
            member_name=r.member.member_name,
            class_name=r.class_schedule.class_name,
            instructor=r.class_schedule.instructor,
            manual_remark=r.manual_remark
        ) for r in records
    ]


@app.get("/api/audit/logs", response_model=List[AuditLogResponse])
async def get_audit_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.operation_time.desc()).offset(skip).limit(limit).all()
    return logs


@app.post("/api/bad-rows/review")
async def review_bad_row_endpoint(request: ReviewRequest, db: Session = Depends(get_db)):
    bad_row, message = review_bad_row(db, request.bad_row_id, request.manual_remark, request.operator)
    if not bad_row:
        raise HTTPException(status_code=404, detail=message)
    return {
        "bad_row_id": bad_row.id,
        "status": bad_row.status.value,
        "manual_remark": bad_row.manual_remark,
        "reviewed_by": bad_row.reviewed_by,
        "reviewed_at": bad_row.reviewed_at,
        "message": message
    }


@app.get("/api/bad-rows")
async def get_bad_rows(status: str = None, batch_no: str = None, db: Session = Depends(get_db)):
    query = db.query(ImportBadRow)
    if status:
        query = query.filter(ImportBadRow.status == status)
    if batch_no:
        query = query.filter(ImportBadRow.import_batch_no == batch_no)
    rows = query.order_by(ImportBadRow.created_at.desc()).all()
    return [
        {
            "id": row.id,
            "batch_no": row.import_batch_no,
            "row_number": row.row_number,
            "original_data": row.original_data,
            "error_reason": row.error_reason.value,
            "error_detail": row.error_detail,
            "suggestion": row.suggestion,
            "status": row.status.value,
            "manual_remark": row.manual_remark,
            "reviewed_by": row.reviewed_by,
            "reviewed_at": row.reviewed_at
        } for row in rows
    ]


@app.get("/")
async def root():
    return {
        "message": "瑜伽教室团课候补转正API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "导入记录": "POST /api/waitlist/import",
            "获取有效样例": "GET /api/samples/valid",
            "获取混合样例": "GET /api/samples/mixed",
            "获取候补记录": "GET /api/waitlist/records",
            "获取审计日志": "GET /api/audit/logs",
            "获取坏行记录": "GET /api/bad-rows",
            "审核坏行": "POST /api/bad-rows/review"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
