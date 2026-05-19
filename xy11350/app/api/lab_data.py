from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.config.database import get_db
from app.utils.security import get_current_active_user
from app.models.models import LabRecord, PrintBatch, User
from app.schemas.schemas import LabRecordResponse, LabRecordCreate, ImportResult
from app.services.import_service import ImportService

router = APIRouter(prefix="/lab-data", tags=["Lab测色数据"])


@router.get("/", response_model=List[LabRecordResponse])
def get_lab_records(
    batch_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(LabRecord)
    if batch_id:
        query = query.filter(LabRecord.batch_id == batch_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{record_id}", response_model=LabRecordResponse)
def get_lab_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    record = db.query(LabRecord).filter(LabRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Lab记录不存在")
    return record


@router.post("/", response_model=LabRecordResponse)
def create_lab_record(
    record: LabRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    batch = db.query(PrintBatch).filter(PrintBatch.batch_number == record.batch_number).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    lab_record = LabRecord(
        batch_id=batch.id,
        l_value=record.l_value,
        a_value=record.a_value,
        b_value=record.b_value,
        delta_e=record.delta_e,
        measurement_point=record.measurement_point,
        measured_at=record.measured_at,
        operator_id=record.operator_id
    )
    db.add(lab_record)
    db.commit()
    db.refresh(lab_record)
    return lab_record


@router.post("/import/csv", response_model=ImportResult)
async def import_lab_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="必须上传CSV文件")
    
    content = await file.read()
    service = ImportService(db)
    success, errors, session_id = service.import_lab_csv(content, file.filename, current_user.id)
    
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
