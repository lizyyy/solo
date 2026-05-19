from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import os
import pandas as pd

from database import get_db, init_db, QualityRecord, PaperBatch, ReworkRecord, ImportErrorLog, OperationLog
import schemas
from data_import import import_lab_csv, import_order_json, import_rework_notes, calculate_delta_e

app = FastAPI(
    title="印刷车间品控管理系统",
    description="管理印刷车间的Lab数值、纸张批次和返工记录",
    version="1.0.0"
)


@app.on_event("startup")
def startup_event():
    init_db()
    if not os.path.exists("temp_uploads"):
        os.makedirs("temp_uploads")
    if not os.path.exists("exports"):
        os.makedirs("exports")


def log_operation(db: Session, operation_type: str, operator: str = None,
                  target_table: str = None, target_id: int = None,
                  old_value: str = None, new_value: str = None, notes: str = None):
    log = OperationLog(
        operation_type=operation_type,
        operator=operator,
        target_table=target_table,
        target_id=target_id,
        old_value=old_value,
        new_value=new_value,
        notes=notes
    )
    db.add(log)
    db.commit()


@app.get("/")
def root():
    return {"message": "印刷车间品控管理系统 API", "docs": "/docs"}


@app.post("/api/paper-batches/", response_model=schemas.PaperBatch)
def create_paper_batch(batch: schemas.PaperBatchCreate, db: Session = Depends(get_db)):
    db_batch = db.query(PaperBatch).filter(PaperBatch.batch_number == batch.batch_number).first()
    if db_batch:
        raise HTTPException(status_code=400, detail="批次号已存在")
    
    db_batch = PaperBatch(**batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    
    log_operation(db, "CREATE", target_table="paper_batches", target_id=db_batch.id, new_value=str(batch.model_dump()))
    
    return db_batch


@app.get("/api/paper-batches/", response_model=List[schemas.PaperBatch])
def list_paper_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(PaperBatch).offset(skip).limit(limit).all()


@app.get("/api/paper-batches/{batch_id}", response_model=schemas.PaperBatch)
def get_paper_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = db.query(PaperBatch).filter(PaperBatch.id == batch_id).first()
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@app.put("/api/paper-batches/{batch_id}", response_model=schemas.PaperBatch)
def update_paper_batch(batch_id: int, batch: schemas.PaperBatchUpdate, db: Session = Depends(get_db)):
    db_batch = db.query(PaperBatch).filter(PaperBatch.id == batch_id).first()
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    old_value = str({col.name: getattr(db_batch, col.name) for col in db_batch.__table__.columns})
    
    for key, value in batch.model_dump(exclude_unset=True).items():
        setattr(db_batch, key, value)
    
    db.commit()
    db.refresh(db_batch)
    
    log_operation(db, "UPDATE", target_table="paper_batches", target_id=batch_id, old_value=old_value, new_value=str(batch.model_dump()))
    
    return db_batch


@app.post("/api/quality-records/", response_model=schemas.QualityRecord)
def create_quality_record(record: schemas.QualityRecordCreate, db: Session = Depends(get_db)):
    if record.standard_l is not None and record.standard_a is not None and record.standard_b is not None:
        delta_e = calculate_delta_e(record.lab_l, record.lab_a, record.lab_b,
                                    record.standard_l, record.standard_a, record.standard_b)
        record.delta_e = delta_e
        record.is_qualified = delta_e <= 2.0
    
    db_record = QualityRecord(**record.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    log_operation(db, "CREATE", operator=record.inspector, target_table="quality_records", target_id=db_record.id, new_value=str(record.model_dump()))
    
    return db_record


@app.get("/api/quality-records/", response_model=List[schemas.QualityRecordWithRework])
def list_quality_records(
    skip: int = 0,
    limit: int = 100,
    inspector: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    is_qualified: Optional[bool] = None,
    rework_type: Optional[str] = None,
    batch_id: Optional[str] = None,
    order_number: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(QualityRecord)
    
    if inspector:
        query = query.filter(QualityRecord.inspector == inspector)
    if start_time:
        query = query.filter(QualityRecord.inspection_time >= start_time)
    if end_time:
        query = query.filter(QualityRecord.inspection_time <= end_time)
    if is_qualified is not None:
        query = query.filter(QualityRecord.is_qualified == is_qualified)
    if batch_id:
        query = query.filter(QualityRecord.batch_id.like(f"%{batch_id}%"))
    if order_number:
        query = query.filter(QualityRecord.order_number.like(f"%{order_number}%"))
    if rework_type:
        query = query.join(ReworkRecord).filter(ReworkRecord.rework_type == rework_type)
    
    records = query.offset(skip).limit(limit).all()
    
    for record in records:
        record.rework_records = db.query(ReworkRecord).filter(ReworkRecord.quality_record_id == record.id).all()
    
    return records


@app.get("/api/quality-records/{record_id}", response_model=schemas.QualityRecordWithRework)
def get_quality_record(record_id: int, db: Session = Depends(get_db)):
    db_record = db.query(QualityRecord).filter(QualityRecord.id == record_id).first()
    if db_record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    db_record.rework_records = db.query(ReworkRecord).filter(ReworkRecord.quality_record_id == record_id).all()
    
    return db_record


@app.put("/api/quality-records/{record_id}", response_model=schemas.QualityRecord)
def update_quality_record(record_id: int, record: schemas.QualityRecordUpdate, db: Session = Depends(get_db)):
    db_record = db.query(QualityRecord).filter(QualityRecord.id == record_id).first()
    if db_record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    old_value = str({col.name: getattr(db_record, col.name) for col in db_record.__table__.columns})
    
    update_data = record.model_dump(exclude_unset=True)
    
    if 'standard_l' in update_data or 'standard_a' in update_data or 'standard_b' in update_data or 'lab_l' in update_data or 'lab_a' in update_data or 'lab_b' in update_data:
        lab_l = update_data.get('lab_l', db_record.lab_l)
        lab_a = update_data.get('lab_a', db_record.lab_a)
        lab_b = update_data.get('lab_b', db_record.lab_b)
        standard_l = update_data.get('standard_l', db_record.standard_l)
        standard_a = update_data.get('standard_a', db_record.standard_a)
        standard_b = update_data.get('standard_b', db_record.standard_b)
        
        if standard_l is not None and standard_a is not None and standard_b is not None:
            delta_e = calculate_delta_e(lab_l, lab_a, lab_b, standard_l, standard_a, standard_b)
            update_data['delta_e'] = delta_e
            update_data['is_qualified'] = delta_e <= 2.0
    
    for key, value in update_data.items():
        setattr(db_record, key, value)
    
    db.commit()
    db.refresh(db_record)
    
    log_operation(db, "UPDATE", operator=db_record.inspector, target_table="quality_records", target_id=record_id, old_value=old_value, new_value=str(update_data))
    
    return db_record


@app.post("/api/rework-records/", response_model=schemas.ReworkRecord)
def create_rework_record(record: schemas.ReworkRecordCreate, db: Session = Depends(get_db)):
    quality_record = db.query(QualityRecord).filter(QualityRecord.id == record.quality_record_id).first()
    if quality_record is None:
        raise HTTPException(status_code=404, detail="品控记录不存在")
    
    db_record = ReworkRecord(**record.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    log_operation(db, "CREATE", operator=record.rework_operator, target_table="rework_records", target_id=db_record.id, new_value=str(record.model_dump()))
    
    return db_record


@app.get("/api/rework-records/", response_model=List[schemas.ReworkRecord])
def list_rework_records(
    skip: int = 0,
    limit: int = 100,
    rework_operator: Optional[str] = None,
    rework_type: Optional[str] = None,
    is_successful: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ReworkRecord)
    
    if rework_operator:
        query = query.filter(ReworkRecord.rework_operator == rework_operator)
    if rework_type:
        query = query.filter(ReworkRecord.rework_type == rework_type)
    if is_successful is not None:
        query = query.filter(ReworkRecord.is_successful == is_successful)
    
    return query.offset(skip).limit(limit).all()


@app.post("/api/import/lab-csv/", response_model=schemas.ImportResult)
async def import_lab_csv_endpoint(file: UploadFile = File(...), db: Session = Depends(get_db)):
    temp_path = f"temp_uploads/{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    success_count, error_count, errors = import_lab_csv(db, temp_path, file.filename)
    
    os.remove(temp_path)
    
    return schemas.ImportResult(success_count=success_count, error_count=error_count, errors=errors)


@app.post("/api/import/order-json/", response_model=schemas.ImportResult)
async def import_order_json_endpoint(file: UploadFile = File(...), db: Session = Depends(get_db)):
    temp_path = f"temp_uploads/{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    success_count, error_count, errors = import_order_json(db, temp_path, file.filename)
    
    os.remove(temp_path)
    
    return schemas.ImportResult(success_count=success_count, error_count=error_count, errors=errors)


@app.post("/api/import/rework-notes/", response_model=schemas.ImportResult)
async def import_rework_notes_endpoint(file: UploadFile = File(...), db: Session = Depends(get_db)):
    temp_path = f"temp_uploads/{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
    
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    success_count, error_count, errors = import_rework_notes(db, temp_path, file.filename)
    
    os.remove(temp_path)
    
    return schemas.ImportResult(success_count=success_count, error_count=error_count, errors=errors)


@app.get("/api/import-errors/", response_model=List[schemas.ImportErrorLog])
def list_import_errors(
    skip: int = 0,
    limit: int = 100,
    import_type: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ImportErrorLog)
    
    if import_type:
        query = query.filter(ImportErrorLog.import_type == import_type)
    if is_resolved is not None:
        query = query.filter(ImportErrorLog.is_resolved == is_resolved)
    
    return query.offset(skip).limit(limit).all()


@app.put("/api/import-errors/{error_id}", response_model=schemas.ImportErrorLog)
def resolve_import_error(error_id: int, error_update: schemas.ImportErrorLogUpdate, db: Session = Depends(get_db)):
    db_error = db.query(ImportErrorLog).filter(ImportErrorLog.id == error_id).first()
    if db_error is None:
        raise HTTPException(status_code=404, detail="错误记录不存在")
    
    for key, value in error_update.model_dump(exclude_unset=True).items():
        setattr(db_error, key, value)
    
    if error_update.is_resolved and not db_error.resolved_at:
        db_error.resolved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_error)
    
    return db_error


@app.get("/api/export/quality-records/")
def export_quality_records(
    inspector: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    is_qualified: Optional[bool] = None,
    rework_type: Optional[str] = None,
    batch_id: Optional[str] = None,
    order_number: Optional[str] = None,
    format: str = Query("xlsx", description="导出格式: xlsx 或 csv"),
    db: Session = Depends(get_db)
):
    query = db.query(QualityRecord)
    
    if inspector:
        query = query.filter(QualityRecord.inspector == inspector)
    if start_time:
        query = query.filter(QualityRecord.inspection_time >= start_time)
    if end_time:
        query = query.filter(QualityRecord.inspection_time <= end_time)
    if is_qualified is not None:
        query = query.filter(QualityRecord.is_qualified == is_qualified)
    if batch_id:
        query = query.filter(QualityRecord.batch_id.like(f"%{batch_id}%"))
    if order_number:
        query = query.filter(QualityRecord.order_number.like(f"%{order_number}%"))
    if rework_type:
        query = query.join(ReworkRecord).filter(ReworkRecord.rework_type == rework_type)
    
    records = query.all()
    
    data = []
    for record in records:
        rework_records = db.query(ReworkRecord).filter(ReworkRecord.quality_record_id == record.id).all()
        rework_info = "; ".join([f"{r.rework_type}: {r.rework_reason}" for r in rework_records]) if rework_records else ""
        
        data.append({
            "ID": record.id,
            "批次号": record.batch_id,
            "订单号": record.order_number or "",
            "采样点": record.sample_point or "",
            "Lab_L": record.lab_l,
            "Lab_a": record.lab_a,
            "Lab_b": record.lab_b,
            "标准L": record.standard_l or "",
            "标准a": record.standard_a or "",
            "标准b": record.standard_b or "",
            "色差ΔE": record.delta_e or "",
            "是否合格": "是" if record.is_qualified else "否",
            "质检员": record.inspector or "",
            "检测时间": record.inspection_time.strftime("%Y-%m-%d %H:%M:%S"),
            "返工信息": rework_info,
            "备注": record.notes or ""
        })
    
    df = pd.DataFrame(data)
    
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f"quality_records_{timestamp}"
    
    if format.lower() == "csv":
        filepath = f"exports/{filename}.csv"
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
        media_type = "text/csv"
    else:
        filepath = f"exports/{filename}.xlsx"
        df.to_excel(filepath, index=False, engine='openpyxl')
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    
    return FileResponse(filepath, media_type=media_type, filename=os.path.basename(filepath))


@app.get("/api/statistics/")
def get_statistics(db: Session = Depends(get_db)):
    total_records = db.query(QualityRecord).count()
    qualified_records = db.query(QualityRecord).filter(QualityRecord.is_qualified == True).count()
    unqualified_records = total_records - qualified_records
    rework_records = db.query(ReworkRecord).count()
    import_errors = db.query(ImportErrorLog).filter(ImportErrorLog.is_resolved == False).count()
    paper_batches = db.query(PaperBatch).count()
    
    avg_delta_e = db.query(func.avg(QualityRecord.delta_e)).filter(QualityRecord.delta_e.isnot(None)).scalar()
    
    inspectors = db.query(QualityRecord.inspector).filter(QualityRecord.inspector.isnot(None)).distinct().all()
    inspector_list = [i[0] for i in inspectors]
    
    return {
        "total_records": total_records,
        "qualified_records": qualified_records,
        "unqualified_records": unqualified_records,
        "qualified_rate": round(qualified_records / total_records * 100, 2) if total_records > 0 else 0,
        "rework_records": rework_records,
        "pending_import_errors": import_errors,
        "paper_batches": paper_batches,
        "average_delta_e": round(avg_delta_e, 4) if avg_delta_e else None,
        "inspectors": inspector_list
    }


@app.get("/api/operation-logs/", response_model=List[schemas.OperationLog])
def list_operation_logs(
    skip: int = 0,
    limit: int = 100,
    operation_type: Optional[str] = None,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(OperationLog)
    
    if operation_type:
        query = query.filter(OperationLog.operation_type == operation_type)
    if operator:
        query = query.filter(OperationLog.operator == operator)
    
    return query.order_by(OperationLog.operation_time.desc()).offset(skip).limit(limit).all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
