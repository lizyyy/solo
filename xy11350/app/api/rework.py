from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.config.database import get_db
from app.utils.security import get_current_active_user
from app.models.models import ReworkRecord, PrintBatch, User
from app.schemas.schemas import ReworkRecordResponse, ReworkRecordCreate, ImportResult
from app.services.import_service import ImportService

router = APIRouter(prefix="/rework", tags=["返工记录"])


@router.get("/", response_model=List[ReworkRecordResponse])
def get_rework_records(
    batch_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(ReworkRecord)
    if batch_id:
        query = query.filter(ReworkRecord.batch_id == batch_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{record_id}", response_model=ReworkRecordResponse)
def get_rework_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    record = db.query(ReworkRecord).filter(ReworkRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="返工记录不存在")
    return record


@router.post("/", response_model=ReworkRecordResponse)
def create_rework_record(
    record: ReworkRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    batch = db.query(PrintBatch).filter(PrintBatch.batch_number == record.batch_number).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    rework = ReworkRecord(
        batch_id=batch.id,
        reason=record.reason,
        rework_type=record.rework_type,
        operator_id=record.operator_id,
        notes=record.notes
    )
    db.add(rework)
    db.commit()
    db.refresh(rework)
    return rework


@router.post("/import/text", response_model=ImportResult)
async def import_rework_text(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not (file.filename.endswith('.txt') or file.filename.endswith('.md')):
        raise HTTPException(status_code=400, detail="必须上传文本文件")
    
    content = await file.read()
    service = ImportService(db)
    success, errors, session_id = service.import_rework_text(content, file.filename, current_user.id)
    
    message = f"导入完成: 成功 {success} 条, 失败 {errors} 条"
    if errors > 0:
        message += f"，请查看错误记录进行处理"
    
    return {
        "session_id": session_id,
        "total_records": success + errors,
        "success_count": success,
        "error_count": errors,
        "message": message
    }
