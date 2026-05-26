from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from app.database import get_db
from app.services.data_parser import DataParser
from app.services.batch_service import BatchService
from app.models.models import Blacklist
from app.schemas.schemas import BatchInfo, BlacklistCreate, BatchProcessResponse

router = APIRouter()

@router.post("/upload/registration", response_model=BatchProcessResponse)
async def upload_registration(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    file_hash = DataParser.calculate_file_hash(content)
    
    batch_service = BatchService(db)
    success, message, batch = batch_service.create_batch(
        file_name=file.filename,
        file_hash=file_hash,
        data_type="registration"
    )
    
    if not success and batch:
        return BatchProcessResponse(
            batch_no=batch.batch_no,
            total_count=batch.total_count,
            success_count=batch.success_count,
            pending_count=batch.pending_count,
            failed_count=batch.failed_count,
            success_items=[],
            pending_items=[],
            failed_items=[{"status": "skipped", "record_type": "duplicate_batch", "original_data": {"error": message}, "error_message": message, "suggestion": "可使用原批次号查询处理结果"}]
        )
    
    try:
        if file.filename.endswith('.csv'):
            records = DataParser.parse_csv(content)
        elif file.filename.endswith('.json'):
            records = DataParser.parse_json(content)
        else:
            raise HTTPException(status_code=400, detail="仅支持 CSV 和 JSON 格式文件")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")
    
    result = batch_service.process_records(batch, records, "registration")
    return BatchProcessResponse(**result)

@router.post("/upload/waitlist", response_model=BatchProcessResponse)
async def upload_waitlist(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    file_hash = DataParser.calculate_file_hash(content)
    
    batch_service = BatchService(db)
    success, message, batch = batch_service.create_batch(
        file_name=file.filename,
        file_hash=file_hash,
        data_type="waitlist"
    )
    
    if not success and batch:
        return BatchProcessResponse(
            batch_no=batch.batch_no,
            total_count=batch.total_count,
            success_count=batch.success_count,
            pending_count=batch.pending_count,
            failed_count=batch.failed_count,
            success_items=[],
            pending_items=[],
            failed_items=[{"status": "skipped", "record_type": "duplicate_batch", "original_data": {"error": message}, "error_message": message, "suggestion": "可使用原批次号查询处理结果"}]
        )
    
    try:
        if file.filename.endswith('.csv'):
            records = DataParser.parse_csv(content)
        elif file.filename.endswith('.json'):
            records = DataParser.parse_json(content)
        else:
            raise HTTPException(status_code=400, detail="仅支持 CSV 和 JSON 格式文件")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")
    
    result = batch_service.process_records(batch, records, "waitlist")
    return BatchProcessResponse(**result)

@router.post("/upload/checkin", response_model=BatchProcessResponse)
async def upload_checkin(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    file_hash = DataParser.calculate_file_hash(content)
    
    batch_service = BatchService(db)
    success, message, batch = batch_service.create_batch(
        file_name=file.filename,
        file_hash=file_hash,
        data_type="checkin"
    )
    
    if not success and batch:
        return BatchProcessResponse(
            batch_no=batch.batch_no,
            total_count=batch.total_count,
            success_count=batch.success_count,
            pending_count=batch.pending_count,
            failed_count=batch.failed_count,
            success_items=[],
            pending_items=[],
            failed_items=[{"status": "skipped", "record_type": "duplicate_batch", "original_data": {"error": message}, "error_message": message, "suggestion": "可使用原批次号查询处理结果"}]
        )
    
    try:
        if file.filename.endswith('.csv'):
            records = DataParser.parse_csv(content)
        elif file.filename.endswith('.json'):
            records = DataParser.parse_json(content)
        else:
            raise HTTPException(status_code=400, detail="仅支持 CSV 和 JSON 格式文件")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")
    
    result = batch_service.process_records(batch, records, "checkin")
    return BatchProcessResponse(**result)

@router.post("/upload/json", response_model=BatchProcessResponse)
async def upload_json_data(
    data_type: str = Query(..., description="数据类型: registration, waitlist, checkin"),
    data: List[dict] = Body(...),
    db: Session = Depends(get_db)
):
    if data_type not in ["registration", "waitlist", "checkin"]:
        raise HTTPException(status_code=400, detail="data_type 必须是 registration, waitlist, checkin 之一")
    
    content = json.dumps(data, ensure_ascii=False).encode('utf-8')
    file_hash = DataParser.calculate_file_hash(content)
    
    batch_service = BatchService(db)
    success, message, batch = batch_service.create_batch(
        file_name=f"{data_type}_json.json",
        file_hash=file_hash,
        data_type=data_type,
        source_type="api"
    )
    
    if not success and batch:
        return BatchProcessResponse(
            batch_no=batch.batch_no,
            total_count=batch.total_count,
            success_count=batch.success_count,
            pending_count=batch.pending_count,
            failed_count=batch.failed_count,
            success_items=[],
            pending_items=[],
            failed_items=[{"status": "skipped", "record_type": "duplicate_batch", "original_data": {"error": message}, "error_message": message, "suggestion": "可使用原批次号查询处理结果"}]
        )
    
    records = [DataParser._normalize_keys(r) for r in data]
    result = batch_service.process_records(batch, records, data_type)
    return BatchProcessResponse(**result)

@router.get("/batches", response_model=List[BatchInfo])
async def list_batches(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    batch_service = BatchService(db)
    batches = batch_service.list_batches(skip, limit)
    return batches

@router.get("/batches/{batch_no}")
async def get_batch_result(
    batch_no: str,
    status: Optional[str] = Query(None, description="筛选状态: success, pending, failed"),
    db: Session = Depends(get_db)
):
    batch_service = BatchService(db)
    batch = batch_service.get_batch_info(batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    records = batch_service.get_batch_records(batch_no, status)
    result_records = []
    for r in records:
        result_records.append({
            "id": r.id,
            "record_type": r.record_type,
            "status": r.status,
            "phone": r.phone,
            "name": r.name,
            "activity_name": r.activity_name,
            "activity_session": r.activity_session,
            "original_data": json.loads(r.original_data) if r.original_data else {},
            "error_message": r.error_message,
            "suggestion": r.suggestion,
            "created_at": r.created_at
        })
    
    return {
        "batch_info": {
            "batch_no": batch.batch_no,
            "file_name": batch.file_name,
            "upload_time": batch.upload_time,
            "status": batch.status,
            "total_count": batch.total_count,
            "success_count": batch.success_count,
            "pending_count": batch.pending_count,
            "failed_count": batch.failed_count,
            "data_type": batch.data_type
        },
        "records": result_records
    }

@router.post("/blacklist")
async def add_to_blacklist(
    blacklist_data: BlacklistCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(Blacklist).filter(
        (Blacklist.phone == blacklist_data.phone) | 
        (Blacklist.id_card == blacklist_data.id_card)
    ).first()
    
    if existing:
        existing.is_active = True
        existing.reason = blacklist_data.reason
        db.commit()
        return {"message": "黑名单已更新", "phone": existing.phone}
    
    blacklist = Blacklist(
        phone=blacklist_data.phone,
        name=blacklist_data.name,
        id_card=blacklist_data.id_card,
        reason=blacklist_data.reason,
        is_active=True
    )
    db.add(blacklist)
    db.commit()
    return {"message": "已添加到黑名单", "phone": blacklist.phone}

@router.get("/blacklist")
async def get_blacklist(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    records = db.query(Blacklist).filter(Blacklist.is_active == True).offset(skip).limit(limit).all()
    return records
