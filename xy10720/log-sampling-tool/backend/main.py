from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import os

from database import engine, get_db
import models
import schemas
import services
import export_service

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="日志采样检索工具 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/records", response_model=schemas.LogSamplingRecordResponse, status_code=201)
def create_record(record: schemas.LogSamplingRecordCreate, db: Session = Depends(get_db)):
    db_record, created = services.create_log_sampling_record(db, record)
    if not created:
        return db_record
    return db_record


@app.get("/api/records", response_model=schemas.PaginatedResponse)
def list_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    service_name: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    total, records = services.get_records(db, skip, limit, service_name, status)
    return {"total": total, "items": records}


@app.get("/api/records/{record_id}", response_model=schemas.LogSamplingRecordResponse)
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = services.get_record_by_id(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.put("/api/records/{record_id}", response_model=schemas.LogSamplingRecordResponse)
def update_record(
    record_id: int,
    update_data: schemas.LogSamplingRecordUpdate,
    db: Session = Depends(get_db),
):
    record = services.update_log_sampling_record(db, record_id, update_data)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.post("/api/records/{record_id}/confirm", response_model=schemas.LogSamplingRecordResponse)
def confirm_record(
    record_id: int,
    confirmed_by: str = Query(...),
    db: Session = Depends(get_db),
):
    update_data = schemas.LogSamplingRecordUpdate(
        is_manually_confirmed=True,
        confirmed_by=confirmed_by,
        change_reason="人工确认",
        changed_by=confirmed_by,
    )
    record = services.update_log_sampling_record(db, record_id, update_data)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.get("/api/records/{record_id}/versions", response_model=list[schemas.LogSamplingVersionResponse])
def list_versions(record_id: int, db: Session = Depends(get_db)):
    versions = services.get_record_versions(db, record_id)
    return versions


@app.post("/api/records/{record_id}/rollback/{version_number}", response_model=schemas.LogSamplingRecordResponse)
def rollback_record(
    record_id: int,
    version_number: int,
    rolled_back_by: str = Query(...),
    db: Session = Depends(get_db),
):
    record = services.rollback_to_version(db, record_id, version_number, rolled_back_by)
    if not record:
        raise HTTPException(status_code=404, detail="记录或版本不存在")
    return record


@app.post("/api/records/{record_id}/analyze-error")
def analyze_error(record_id: int, db: Session = Depends(get_db)):
    record = services.get_record_by_id(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    analysis = services.analyze_error_fragment(record.error_fragment)

    update_data = schemas.LogSamplingRecordUpdate(
        error_fragment_status=analysis["status"],
        change_reason="错误片段分析",
        changed_by="system",
    )
    services.update_log_sampling_record(db, record_id, update_data)

    return analysis


@app.post("/api/export/excel")
def export_excel(
    export_request: schemas.ExportRequest,
    db: Session = Depends(get_db),
):
    records = export_service.get_export_records(
        db,
        record_ids=export_request.record_ids,
        start_date=export_request.start_date,
        end_date=export_request.end_date,
        service_name=export_request.service_name,
    )

    excel_file = export_service.export_to_excel(records)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"日志采样记录_{timestamp}.xlsx"

    return StreamingResponse(
        iter([excel_file.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/api/export/summary")
def get_export_summary(
    record_ids: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    service_name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    ids_list = [int(x.strip()) for x in record_ids.split(",")] if record_ids else None
    records = export_service.get_export_records(
        db,
        record_ids=ids_list,
        start_date=start_date,
        end_date=end_date,
        service_name=service_name,
    )
    return export_service.generate_export_summary(records)


@app.post("/api/saved-queries", response_model=schemas.SavedQueryResponse, status_code=201)
def create_saved_query(query: schemas.SavedQueryCreate, db: Session = Depends(get_db)):
    return services.create_saved_query(db, query)


@app.get("/api/saved-queries", response_model=list[schemas.SavedQueryResponse])
def list_saved_queries(db: Session = Depends(get_db)):
    return services.get_saved_queries(db)


@app.delete("/api/saved-queries/{query_id}", status_code=204)
def delete_saved_query(query_id: int, db: Session = Depends(get_db)):
    if not services.delete_saved_query(db, query_id):
        raise HTTPException(status_code=404, detail="查询不存在")
    return None


@app.get("/api/idempotency/check/{idempotency_key}")
def check_idempotency(idempotency_key: str, db: Session = Depends(get_db)):
    record = services.check_idempotency(db, idempotency_key)
    return {"exists": record is not None, "record": record}


@app.post("/api/idempotency/generate")
def generate_idempotency_key(data: dict):
    key = services.generate_idempotency_key(data)
    return {"idempotency_key": key}


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", 8000)))
