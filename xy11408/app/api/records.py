from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
import shutil
import uuid

from app.core.database import get_db
from app.core.security import (
    get_current_user,
    allow_data_entry,
    allow_reviewer,
    allow_supervisor,
    allow_all_authenticated
)
from app.models import User
from app.schemas import (
    AcceptanceRecordCreate,
    AcceptanceRecordUpdate,
    AcceptanceRecordResponse,
    StatusChangeRequest,
    ApiResponse,
    PaginatedResponse,
    RecordQuery,
    FailedRecordResponse,
    StatusLogResponse,
    AttachmentResponse
)
from app.services import AuditService

router = APIRouter()


@router.post("", response_model=ApiResponse[AcceptanceRecordResponse], dependencies=[Depends(allow_data_entry)])
def create_record(
    record_in: AcceptanceRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing = AuditService.get_record_by_no(db, record_in.record_no)
    if existing:
        raise HTTPException(status_code=400, detail=f"记录编号 {record_in.record_no} 已存在")

    record = AuditService.create_record(db, record_in, current_user.id)
    record = AuditService.enhance_record_with_user_info(record, db)
    return ApiResponse(data=AcceptanceRecordResponse.model_validate(record), message="创建成功")


@router.get("", response_model=ApiResponse[PaginatedResponse[AcceptanceRecordResponse]], dependencies=[Depends(allow_all_authenticated)])
def list_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    pharmacy_name: Optional[str] = None,
    pharmacy_region: Optional[str] = None,
    status: Optional[str] = None,
    medicine_name: Optional[str] = None,
    is_bad_data: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    from app.models.audit import RecordStatus
    query = RecordQuery(
        pharmacy_name=pharmacy_name,
        pharmacy_region=pharmacy_region,
        status=RecordStatus(status) if status else None,
        medicine_name=medicine_name,
        is_bad_data=is_bad_data
    )

    skip = (page - 1) * page_size
    records, total = AuditService.list_records(db, query, skip=skip, limit=page_size)

    enhanced_records = []
    for record in records:
        record = AuditService.enhance_record_with_user_info(record, db)
        enhanced_records.append(AcceptanceRecordResponse.model_validate(record))

    return ApiResponse(
        data=PaginatedResponse(
            items=enhanced_records,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size
        ),
        message="查询成功"
    )


@router.get("/{record_id}", response_model=ApiResponse[AcceptanceRecordResponse], dependencies=[Depends(allow_all_authenticated)])
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = AuditService.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    record = AuditService.enhance_record_with_user_info(record, db)
    return ApiResponse(data=AcceptanceRecordResponse.model_validate(record), message="查询成功")


@router.put("/{record_id}", response_model=ApiResponse[AcceptanceRecordResponse], dependencies=[Depends(allow_data_entry)])
def update_record(
    record_id: int,
    record_in: AcceptanceRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    record = AuditService.update_record(db, record_id, record_in, current_user.id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    record = AuditService.enhance_record_with_user_info(record, db)
    return ApiResponse(data=AcceptanceRecordResponse.model_validate(record), message="更新成功")


@router.post("/{record_id}/status", response_model=ApiResponse[AcceptanceRecordResponse], dependencies=[Depends(allow_reviewer)])
def change_status(
    record_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    record = AuditService.change_status(db, record_id, request.new_status, request.reason, current_user.id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    record = AuditService.enhance_record_with_user_info(record, db)
    return ApiResponse(data=AcceptanceRecordResponse.model_validate(record), message="状态更新成功")


@router.post("/{record_id}/attachments", response_model=ApiResponse[AttachmentResponse], dependencies=[Depends(allow_data_entry)])
async def upload_attachment(
    record_id: int,
    file: UploadFile = File(...),
    description: str = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    record = AuditService.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    from app.core.config import settings
    import os

    file_ext = os.path.splitext(file.filename)[1]
    new_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = settings.ATTACHMENT_DIR / new_filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size

    attachment = AuditService.add_attachment(
        db,
        record_id=record_id,
        file_name=file.filename,
        file_path=str(file_path),
        file_type=file.content_type,
        file_size=file_size,
        user_id=current_user.id,
        description=description
    )

    return ApiResponse(data=AttachmentResponse.model_validate(attachment), message="附件上传成功")


@router.get("/failed", response_model=ApiResponse[PaginatedResponse[FailedRecordResponse]], dependencies=[Depends(allow_reviewer)])
def list_failed_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    records, total = AuditService.list_failed_records(db, resolved=resolved, skip=skip, limit=page_size)

    return ApiResponse(
        data=PaginatedResponse(
            items=[FailedRecordResponse.model_validate(r) for r in records],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size
        ),
        message="查询成功"
    )


@router.post("/failed/{failed_id}/resolve", response_model=ApiResponse[FailedRecordResponse], dependencies=[Depends(allow_supervisor)])
def resolve_failed_record(
    failed_id: int,
    resolution_notes: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    failed = AuditService.resolve_failed_record(db, failed_id, resolution_notes, current_user.id)
    if not failed:
        raise HTTPException(status_code=404, detail="失败记录不存在")
    return ApiResponse(data=FailedRecordResponse.model_validate(failed), message="人工改判成功")
