from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from urllib.parse import quote
from .database import engine, get_db, Base
from . import models, schemas, services, data_import, export


def make_content_disposition(filename: str) -> str:
    ascii_filename = filename.encode("ascii", errors="replace").decode("ascii")
    utf8_filename = quote(filename, safe="")
    return f"attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{utf8_filename}"

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="物流调度扣罚管理系统",
    description="运单CSV导入、轨迹JSON接入、扣罚规则管理、异常记录追踪与处理",
    version="1.0.0",
)


@app.get("/")
def root():
    return {
        "name": "物流调度扣罚管理系统",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.post("/batches", response_model=schemas.Batch, tags=["批次管理"])
def create_batch(batch_in: schemas.BatchCreate, db: Session = Depends(get_db)):
    return services.create_batch(db, batch_in)


@app.get("/batches", response_model=List[schemas.Batch], tags=["批次管理"])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return services.list_batches(db, skip=skip, limit=limit, status=status)


@app.get("/batches/{batch_id}", response_model=schemas.BatchDetail, tags=["批次管理"])
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = services.get_batch_detail(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.put("/batches/{batch_id}/status", response_model=schemas.Batch, tags=["批次管理"])
def update_batch_status(
    batch_id: int,
    status: str = Query(..., description="批次状态: pending/processing/completed"),
    db: Session = Depends(get_db),
):
    batch = services.update_batch_status(db, batch_id, status)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.post("/batches/{batch_id}/waybills/import", response_model=schemas.ImportResult, tags=["数据导入"])
async def import_waybills(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    batch = services.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    content = await file.read()
    csv_content = content.decode("utf-8-sig")
    return data_import.import_waybills_from_csv(db, batch_id, csv_content)


@app.post("/tracking/import", response_model=schemas.ImportResult, tags=["数据导入"])
async def import_tracking(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    json_content = content.decode("utf-8-sig")
    return data_import.import_tracking_from_json(db, json_content)


@app.post("/penalty-rules/import", response_model=schemas.ImportResult, tags=["扣罚规则"])
def import_penalty_rules(
    rules: List[schemas.PenaltyRuleCreate],
    db: Session = Depends(get_db),
):
    return data_import.import_penalty_rules(db, [r.model_dump() for r in rules])


@app.get("/penalty-rules", response_model=List[schemas.PenaltyRule], tags=["扣罚规则"])
def list_penalty_rules(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.PenaltyRule)
    if is_active is not None:
        query = query.filter(models.PenaltyRule.is_active == is_active)
    return query.order_by(models.PenaltyRule.created_at.desc()).all()


@app.post("/penalty-records", response_model=schemas.PenaltyRecord, tags=["扣罚记录"])
def create_penalty_record(
    record_in: schemas.PenaltyRecordCreate,
    db: Session = Depends(get_db),
):
    try:
        return services.create_penalty_record(db, record_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/penalty-records/batch", response_model=List[schemas.PenaltyRecord], tags=["扣罚记录"])
def batch_create_penalty_records(
    records: List[schemas.PenaltyRecordCreate],
    db: Session = Depends(get_db),
):
    created = []
    for record_in in records:
        try:
            record = services.create_penalty_record(db, record_in)
            created.append(record)
        except ValueError:
            continue
    return created


@app.get("/penalty-records/{record_id}", tags=["扣罚记录"])
def get_penalty_record_detail(record_id: int, db: Session = Depends(get_db)):
    detail = services.get_record_detail(db, record_id)
    if not detail:
        raise HTTPException(status_code=404, detail="记录不存在")
    return detail


@app.post("/penalty-records/query", tags=["扣罚记录"])
def query_penalty_records(
    query: schemas.PenaltyQuery,
    skip: int = 0,
    limit: int = 1000,
    db: Session = Depends(get_db),
):
    records, total = services.query_penalty_records(db, query, skip=skip, limit=limit)
    return {
        "total": total,
        "records": records,
    }


@app.post("/penalty-records/process", tags=["处理操作"])
def process_penalty_records(
    request: schemas.ProcessRequest,
    db: Session = Depends(get_db),
):
    try:
        records = services.process_penalty_records(
            db,
            record_ids=request.record_ids,
            action=request.action,
            reason=request.reason,
            operator=request.operator,
        )
        return {
            "processed_count": len(records),
            "records": records,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/penalty-records/{record_id}/history", response_model=List[schemas.ProcessHistory], tags=["处理操作"])
def get_record_history(record_id: int, db: Session = Depends(get_db)):
    return services.get_process_histories(db, record_id)


@app.post("/batches/{batch_id}/analyze", tags=["异常分析"])
def analyze_batch_abnormalities(batch_id: int, db: Session = Depends(get_db)):
    batch = services.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    abnormalities = services.analyze_waybill_abnormalities(db, batch_id)
    return {
        "batch_id": batch_id,
        "batch_no": batch.batch_no,
        "abnormality_count": len(abnormalities),
        "abnormalities": abnormalities,
    }


@app.post("/penalty-records/export", tags=["导出"])
def export_penalty_records(
    query: schemas.PenaltyQuery,
    db: Session = Depends(get_db),
):
    records, total = services.query_penalty_records(db, query, limit=100000)
    if not records:
        raise HTTPException(status_code=404, detail="没有可导出的数据")

    output = export.export_penalty_records_to_excel(db, records)

    filename = f"扣罚明细_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": make_content_disposition(filename),
            "X-Total-Count": str(total),
        },
    )


@app.get("/batches/{batch_id}/export", tags=["导出"])
def export_batch_report(batch_id: int, db: Session = Depends(get_db)):
    batch = services.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    query = schemas.PenaltyQuery(batch_id=batch_id)
    records, total = services.query_penalty_records(db, query, limit=100000)

    output = export.export_batch_report_to_excel(db, batch_id, records)

    filename = f"批次报告_{batch.batch_no}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": make_content_disposition(filename),
            "X-Total-Count": str(total),
        },
    )


@app.get("/penalty-records/{record_id}/export", tags=["导出"])
def export_record_traceability(record_id: int, db: Session = Depends(get_db)):
    record = services.get_penalty_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    output = export.export_record_traceability_to_excel(db, record_id)

    filename = f"记录追溯_{record.waybill_no}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": make_content_disposition(filename),
        },
    )


@app.get("/metadata/transfer-nodes", tags=["元数据"])
def get_transfer_nodes(db: Session = Depends(get_db)):
    return {"nodes": services.get_all_transfer_nodes(db)}


@app.get("/metadata/exception-types", tags=["元数据"])
def get_exception_types(db: Session = Depends(get_db)):
    return {"types": services.get_all_exception_types(db)}
