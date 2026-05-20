from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db, engine
from app.models import Base, Batch, MorningCheckRecord
from app.schemas import (
    BatchCreate, BatchResponse, MorningCheckRecordResponse,
    ProcessingLogResponse, RecordProcessRequest, ExportRequest,
    RecordWithLogsResponse
)
from app.import_service import (
    create_batch, import_class_list_csv,
    import_medication_json, import_morning_check_csv
)
from app.business_service import (
    validate_record, process_record, get_records_by_filters,
    export_records_to_csv, get_record_with_logs
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="晨检管理系统", description="处理晨检记录、用药授权和班级名单的后端服务")


@app.post("/api/batches", response_model=BatchResponse, tags=["批次管理"])
def create_new_batch(batch_data: BatchCreate, db: Session = Depends(get_db)):
    """创建新的晨检批次"""
    db_batch = create_batch(db, batch_data.name, batch_data.created_by)
    return db_batch


@app.post("/api/batches/{batch_id}/import/class-list", tags=["数据导入"])
async def import_class_list(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入班级名单CSV"""
    db_batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    count = import_class_list_csv(db, batch_id, csv_content)
    
    return {"message": f"成功导入 {count} 条班级记录", "count": count}


@app.post("/api/batches/{batch_id}/import/medication", tags=["数据导入"])
async def import_medication(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入用药授权JSON"""
    db_batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    content = await file.read()
    json_content = content.decode('utf-8')
    count = import_medication_json(db, batch_id, json_content)
    
    return {"message": f"成功导入 {count} 条用药授权记录", "count": count}


@app.post("/api/batches/{batch_id}/import/morning-check", tags=["数据导入"])
async def import_morning_check(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """导入晨检CSV"""
    db_batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    count = import_morning_check_csv(db, batch_id, csv_content)
    
    return {"message": f"成功导入 {count} 条晨检记录", "count": count}


@app.get("/api/batches/{batch_id}/records", response_model=List[MorningCheckRecordResponse], tags=["记录查询"])
def get_batch_records(
    batch_id: int,
    class_teacher: Optional[str] = None,
    parent_signature: Optional[str] = None,
    need_isolation: Optional[bool] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """按条件查询批次记录"""
    records = get_records_by_filters(
        db, class_teacher, parent_signature, need_isolation, status, batch_id
    )
    return records


@app.get("/api/records/search", response_model=List[MorningCheckRecordResponse], tags=["记录查询"])
def search_records(
    class_teacher: Optional[str] = None,
    parent_signature: Optional[str] = None,
    need_isolation: Optional[bool] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """跨批次历史记录查询"""
    records = get_records_by_filters(
        db, class_teacher, parent_signature, need_isolation, status
    )
    return records


@app.get("/api/records/{record_id}/validate", tags=["记录处理"])
def validate_single_record(record_id: int, db: Session = Depends(get_db)):
    """校验单条记录的问题"""
    record = db.query(MorningCheckRecord).filter(MorningCheckRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    issues = validate_record(db, record)
    return {"record_id": record_id, "issues": issues}


@app.post("/api/records/{record_id}/process", tags=["记录处理"])
def process_single_record(
    record_id: int,
    request: RecordProcessRequest,
    db: Session = Depends(get_db)
):
    """处理记录：批准、退回、隔离等"""
    result = process_record(
        db, record_id, request.action,
        request.reason, request.handler, request.details
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    record, log = result
    return {
        "message": "处理成功",
        "record_id": record_id,
        "new_status": record.status,
        "log_id": log.id
    }


@app.get("/api/records/{record_id}/logs", response_model=RecordWithLogsResponse, tags=["记录查询"])
def get_record_processing_logs(record_id: int, db: Session = Depends(get_db)):
    """获取记录的完整处理轨迹"""
    result = get_record_with_logs(db, record_id)
    if not result:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    record, logs = result
    return {"record": record, "processing_logs": logs}


@app.post("/api/records/export", tags=["导出"])
def export_records(
    export_request: ExportRequest,
    db: Session = Depends(get_db)
):
    """按条件导出记录为CSV"""
    records = get_records_by_filters(
        db,
        export_request.class_teacher,
        export_request.parent_signature,
        export_request.need_isolation,
        export_request.status
    )
    
    csv_content = export_records_to_csv(records, db)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=morning_check_export_{len(records)}_records.csv"}
    )


@app.get("/api/batches", response_model=List[BatchResponse], tags=["批次管理"])
def list_batches(db: Session = Depends(get_db)):
    """获取所有批次列表"""
    batches = db.query(Batch).order_by(Batch.created_at.desc()).all()
    return batches


@app.get("/api/batches/{batch_id}", response_model=BatchResponse, tags=["批次管理"])
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    """获取单个批次详情"""
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
