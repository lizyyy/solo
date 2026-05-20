from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import pandas as pd
import io
import json

from app.database import engine, get_db, Base
from app import models, schemas, crud
from app.models import ProcessStatus, ExceptionType

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="司法社工记录追踪系统",
    description="用于管理签到记录、请假记录、定位摘要的后端服务",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "司法社工记录追踪系统",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/api/batches/", response_model=schemas.BatchResponse)
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    db_batch = crud.get_batch_by_no(db, batch_no=batch.batch_no)
    if db_batch:
        raise HTTPException(status_code=400, detail="批次号已存在")
    return crud.create_batch(db=db, batch=batch)


@app.get("/api/batches/", response_model=List[schemas.BatchResponse])
def read_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = crud.get_batches(db, skip=skip, limit=limit)
    return batches


@app.get("/api/batches/{batch_id}", response_model=schemas.BatchResponse)
def read_batch(batch_id: int, db: Session = Depends(get_db)):
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@app.put("/api/batches/{batch_id}/process", response_model=schemas.BatchResponse)
def process_batch(batch_id: int, update: schemas.BatchUpdate, db: Session = Depends(get_db)):
    db_batch = crud.update_batch_status(db, batch_id=batch_id, update=update)
    if db_batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@app.post("/api/checkins/import/csv")
async def import_checkin_csv(
    batch_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV文件")
    
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        
        required_columns = ['object_name', 'object_id_card', 'object_level', 'checkin_time']
        for col in required_columns:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"CSV缺少必要列: {col}")
        
        checkins = []
        for _, row in df.iterrows():
            checkin_data = {
                "batch_id": batch_id,
                "object_name": str(row['object_name']),
                "object_id_card": str(row['object_id_card']),
                "object_level": str(row['object_level']),
                "checkin_time": pd.to_datetime(row['checkin_time']).to_pydatetime(),
                "checkin_location": str(row.get('checkin_location', '')) if pd.notna(row.get('checkin_location')) else None
            }
            checkins.append(schemas.CheckinRecordCreate(**checkin_data))
        
        created = crud.create_checkin_records_bulk(db, checkins)
        return {
            "message": f"成功导入 {len(created)} 条签到记录",
            "count": len(created),
            "batch_id": batch_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@app.post("/api/leaves/import/json")
async def import_leave_json(
    batch_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON文件")
    
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    try:
        contents = await file.read()
        data = json.loads(contents)
        
        if not isinstance(data, list):
            data = [data]
        
        leaves = []
        for item in data:
            leave_data = {
                "batch_id": batch_id,
                "object_name": item['object_name'],
                "object_id_card": item['object_id_card'],
                "object_level": item['object_level'],
                "leave_start_time": datetime.fromisoformat(item['leave_start_time']),
                "leave_end_time": datetime.fromisoformat(item['leave_end_time']),
                "leave_scope": item['leave_scope'],
                "leave_reason": item['leave_reason'],
                "approver": item['approver'],
                "approve_time": datetime.fromisoformat(item['approve_time'])
            }
            leaves.append(schemas.LeaveRecordCreate(**leave_data))
        
        created = crud.create_leave_records_bulk(db, leaves)
        return {
            "message": f"成功导入 {len(created)} 条请假记录",
            "count": len(created),
            "batch_id": batch_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@app.post("/api/locations/import/json")
async def import_location_json(
    batch_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON文件")
    
    db_batch = crud.get_batch(db, batch_id=batch_id)
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    try:
        contents = await file.read()
        data = json.loads(contents)
        
        if not isinstance(data, list):
            data = [data]
        
        locations = []
        for item in data:
            loc_data = {
                "batch_id": batch_id,
                "object_name": item['object_name'],
                "object_id_card": item['object_id_card'],
                "object_level": item['object_level'],
                "start_time": datetime.fromisoformat(item['start_time']),
                "end_time": datetime.fromisoformat(item['end_time']),
                "locations": item['locations'],
                "has_gap": item.get('has_gap', False),
                "gap_details": item.get('gap_details')
            }
            locations.append(schemas.LocationSummaryCreate(**loc_data))
        
        created = crud.create_location_summaries_bulk(db, locations)
        return {
            "message": f"成功导入 {len(created)} 条定位摘要",
            "count": len(created),
            "batch_id": batch_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@app.post("/api/checkins/query", response_model=List[schemas.CheckinRecordResponse])
def query_checkins(
    params: schemas.QueryParams,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_checkin_records(db, params, skip=skip, limit=limit)


@app.post("/api/leaves/query", response_model=List[schemas.LeaveRecordResponse])
def query_leaves(
    params: schemas.QueryParams,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_leave_records(db, params, skip=skip, limit=limit)


@app.post("/api/locations/query", response_model=List[schemas.LocationSummaryResponse])
def query_locations(
    params: schemas.QueryParams,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_location_summaries(db, params, skip=skip, limit=limit)


@app.put("/api/checkins/{record_id}/process", response_model=schemas.CheckinRecordResponse)
def process_checkin(
    record_id: int,
    process: schemas.ProcessRecordRequest,
    db: Session = Depends(get_db)
):
    db_record = crud.process_checkin_record(db, record_id, process)
    if not db_record:
        raise HTTPException(status_code=404, detail="签到记录不存在")
    return db_record


@app.put("/api/leaves/{record_id}/process", response_model=schemas.LeaveRecordResponse)
def process_leave(
    record_id: int,
    process: schemas.ProcessRecordRequest,
    db: Session = Depends(get_db)
):
    db_record = crud.process_leave_record(db, record_id, process)
    if not db_record:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    return db_record


@app.put("/api/locations/{record_id}/process", response_model=schemas.LocationSummaryResponse)
def process_location(
    record_id: int,
    process: schemas.ProcessRecordRequest,
    db: Session = Depends(get_db)
):
    db_record = crud.process_location_summary(db, record_id, process)
    if not db_record:
        raise HTTPException(status_code=404, detail="定位摘要不存在")
    return db_record


@app.put("/api/checkins/{record_id}/mark-exception")
def mark_checkin_exception(
    record_id: int,
    exception_type: ExceptionType,
    reason: str,
    db: Session = Depends(get_db)
):
    db_record = crud.mark_exception_checkin(db, record_id, exception_type, reason)
    if not db_record:
        raise HTTPException(status_code=404, detail="签到记录不存在")
    return {
        "message": "异常标记成功",
        "exception_type": exception_type,
        "reason": reason
    }


@app.put("/api/leaves/{record_id}/mark-exception")
def mark_leave_exception(
    record_id: int,
    exception_type: ExceptionType,
    reason: str,
    db: Session = Depends(get_db)
):
    db_record = crud.mark_exception_leave(db, record_id, exception_type, reason)
    if not db_record:
        raise HTTPException(status_code=404, detail="请假记录不存在")
    return {
        "message": "异常标记成功",
        "exception_type": exception_type,
        "reason": reason
    }


@app.put("/api/locations/{record_id}/mark-exception")
def mark_location_exception(
    record_id: int,
    exception_type: ExceptionType,
    reason: str,
    db: Session = Depends(get_db)
):
    db_record = crud.mark_exception_location(db, record_id, exception_type, reason)
    if not db_record:
        raise HTTPException(status_code=404, detail="定位摘要不存在")
    return {
        "message": "异常标记成功",
        "exception_type": exception_type,
        "reason": reason
    }


@app.post("/api/export/checkins")
def export_checkins(
    params: schemas.QueryParams,
    db: Session = Depends(get_db)
):
    records = crud.get_checkin_records(db, params, limit=10000)
    data = []
    for record in records:
        item = {
            "id": record.id,
            "batch_id": record.batch_id,
            "对象姓名": record.object_name,
            "对象身份证": record.object_id_card,
            "对象等级": record.object_level.value,
            "签到时间": record.checkin_time.isoformat(),
            "签到地点": record.checkin_location,
            "是否超时": "是" if record.is_overtime else "否",
            "状态": record.status.value,
            "异常类型": record.exception_type.value,
            "异常原因": record.exception_reason,
            "处理人": record.processed_by,
            "处理时间": record.processed_at.isoformat() if record.processed_at else None,
            "处理说明": record.process_note,
            "可读说明": record.readable_explanation
        }
        data.append(item)
    
    return schemas.ExportResponse(
        total_count=len(data),
        exported_count=len(data),
        data=data,
        message=f"成功导出 {len(data)} 条签到记录，导出数量与查询结果一致"
    )


@app.post("/api/export/leaves")
def export_leaves(
    params: schemas.QueryParams,
    db: Session = Depends(get_db)
):
    records = crud.get_leave_records(db, params, limit=10000)
    data = []
    for record in records:
        item = {
            "id": record.id,
            "batch_id": record.batch_id,
            "对象姓名": record.object_name,
            "对象身份证": record.object_id_card,
            "对象等级": record.object_level.value,
            "请假开始时间": record.leave_start_time.isoformat(),
            "请假结束时间": record.leave_end_time.isoformat(),
            "请假范围": record.leave_scope.value,
            "请假原因": record.leave_reason,
            "审批人": record.approver,
            "审批时间": record.approve_time.isoformat(),
            "状态": record.status.value,
            "异常类型": record.exception_type.value,
            "异常原因": record.exception_reason,
            "处理人": record.processed_by,
            "处理时间": record.processed_at.isoformat() if record.processed_at else None,
            "处理说明": record.process_note,
            "可读说明": record.readable_explanation
        }
        data.append(item)
    
    return schemas.ExportResponse(
        total_count=len(data),
        exported_count=len(data),
        data=data,
        message=f"成功导出 {len(data)} 条请假记录，导出数量与查询结果一致"
    )


@app.post("/api/export/locations")
def export_locations(
    params: schemas.QueryParams,
    db: Session = Depends(get_db)
):
    records = crud.get_location_summaries(db, params, limit=10000)
    data = []
    for record in records:
        item = {
            "id": record.id,
            "batch_id": record.batch_id,
            "对象姓名": record.object_name,
            "对象身份证": record.object_id_card,
            "对象等级": record.object_level.value,
            "定位开始时间": record.start_time.isoformat(),
            "定位结束时间": record.end_time.isoformat(),
            "定位轨迹": record.locations,
            "是否有缺口": "是" if record.has_gap else "否",
            "缺口详情": record.gap_details,
            "状态": record.status.value,
            "异常类型": record.exception_type.value,
            "异常原因": record.exception_reason,
            "处理人": record.processed_by,
            "处理时间": record.processed_at.isoformat() if record.processed_at else None,
            "处理说明": record.process_note,
            "可读说明": record.readable_explanation
        }
        data.append(item)
    
    return schemas.ExportResponse(
        total_count=len(data),
        exported_count=len(data),
        data=data,
        message=f"成功导出 {len(data)} 条定位摘要，导出数量与查询结果一致"
    )


@app.get("/api/audit-logs/", response_model=List[schemas.AuditLogResponse])
def get_audit_logs(
    batch_id: Optional[int] = None,
    record_type: Optional[str] = None,
    record_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return crud.get_audit_logs(db, record_type=record_type, record_id=record_id, batch_id=batch_id)
