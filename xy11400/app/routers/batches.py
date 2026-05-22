from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.auth import get_current_active_user, allow_data_entry, allow_reviewer, allow_supervisor, allow_all_authenticated
from app import models, schemas
from app.crud.batch_crud import batch_crud, StateMachine
from app.crud.attachment_crud import attachment_crud
from app.crud.dirty_record_crud import dirty_record_crud
from app.crud.note_crud import note_crud
from app.models import BatchStatus, AttachmentType

router = APIRouter(prefix="/batches", tags=["批次管理"])


@router.get("/", response_model=schemas.BatchList)
async def list_batches(
    status: Optional[BatchStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_authenticated)
):
    skip = (page - 1) * page_size
    batches, total = batch_crud.get_batches(
        db, status=status, start_date=start_date, end_date=end_date,
        search=search, skip=skip, limit=page_size
    )
    return {"batches": batches, "total": total, "page": page, "page_size": page_size}


@router.post("/", response_model=schemas.Batch)
async def create_batch(
    batch_in: schemas.BatchCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_data_entry)
):
    existing = batch_crud.get_batch_by_no(db, batch_in.batch_no)
    if existing:
        raise HTTPException(status_code=400, detail="批次号已存在")

    batch = batch_crud.create_batch(db, batch_in, creator_id=current_user.id)

    if batch_in.departure_date and batch_in.arrival_date:
        dirty_record_crud.detect_cross_day_signature(
            db, batch.id, batch_in.departure_date, batch_in.arrival_date
        )

    required_fields = ["transport_order_no", "origin", "destination", "departure_date", "arrival_date"]
    dirty_record_crud.detect_missing_fields(
        db, batch.id, batch_in.model_dump(), required_fields
    )

    return batch


@router.get("/{batch_id}", response_model=schemas.BatchDetail)
async def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_authenticated)
):
    batch = batch_crud.get_batch_with_relations(db, batch_id, current_user.role)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@router.put("/{batch_id}", response_model=schemas.Batch)
async def update_batch(
    batch_id: int,
    batch_in: schemas.BatchUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_data_entry)
):
    batch = batch_crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    updated = batch_crud.update_batch(db, batch_id, batch_in)

    if batch_in.departure_date and batch_in.arrival_date:
        dirty_record_crud.detect_cross_day_signature(
            db, batch_id, batch_in.departure_date, batch_in.arrival_date
        )

    return updated


@router.post("/{batch_id}/status", response_model=schemas.Batch)
async def change_status(
    batch_id: int,
    request: schemas.StatusChangeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_reviewer)
):
    batch = batch_crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    try:
        updated = batch_crud.transition_status(
            db, batch_id, request.target_status, current_user.id, request.reason
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{batch_id}/valid-transitions")
async def get_valid_transitions(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_authenticated)
):
    batch = batch_crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return {"valid_transitions": StateMachine.get_valid_transitions(batch.current_status)}


@router.post("/{batch_id}/attachments", response_model=schemas.Attachment)
async def upload_attachment(
    batch_id: int,
    file_type: AttachmentType = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_data_entry)
):
    batch = batch_crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    file_content = await file.read()
    file_path = attachment_crud.save_uploaded_file(
        file_content, file.filename, batch.batch_no, file_type
    )

    attachment_in = schemas.AttachmentCreate(
        file_type=file_type,
        file_name=file.filename,
        file_path=file_path,
        file_size=len(file_content),
        uploader_id=current_user.id,
        description=description
    )

    attachment = attachment_crud.create_attachment(db, batch_id, attachment_in)

    has_all_types = set(at.file_type for at in batch.attachments + [attachment])
    required_types = {AttachmentType.DRIVER_PHOTO, AttachmentType.WMS_BOX_TABLE, AttachmentType.TEMPERATURE_LOG}
    if required_types.issubset(has_all_types) and batch.current_status == BatchStatus.CREATED:
        batch_crud.transition_status(
            db, batch_id, BatchStatus.ATTACHMENTS_UPLOADED, current_user.id, "附件上传完成"
        )

    return attachment


@router.get("/{batch_id}/attachments", response_model=list[schemas.Attachment])
async def list_attachments(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_authenticated)
):
    return attachment_crud.get_attachments_by_batch(db, batch_id)


@router.delete("/{batch_id}/attachments/{attachment_id}")
async def delete_attachment(
    batch_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_data_entry)
):
    attachment = attachment_crud.get_attachment(db, attachment_id)
    if not attachment or attachment.batch_id != batch_id:
        raise HTTPException(status_code=404, detail="附件不存在")

    success = attachment_crud.delete_attachment(db, attachment_id)
    return {"success": success}


@router.post("/{batch_id}/box-items", response_model=schemas.BoxItem)
async def add_box_item(
    batch_id: int,
    box_item: schemas.BoxItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_data_entry)
):
    batch = batch_crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if box_item.original_box_no and box_item.original_box_no != box_item.box_no:
        dirty_record_crud.detect_box_rename(
            db, batch_id, box_item.original_box_no, box_item.box_no, box_item.model_dump()
        )

    return batch_crud.add_box_item(db, batch_id, box_item)


@router.get("/{batch_id}/dirty-records", response_model=list[schemas.DirtyRecord])
async def list_dirty_records(
    batch_id: int,
    include_resolved: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_authenticated)
):
    return dirty_record_crud.get_dirty_records_by_batch(db, batch_id, include_resolved)


@router.post("/{batch_id}/dirty-records/{record_id}/resolve", response_model=schemas.DirtyRecord)
async def resolve_dirty_record(
    batch_id: int,
    record_id: int,
    request: schemas.DirtyRecordResolve,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_reviewer)
):
    record = dirty_record_crud.get_dirty_record(db, record_id)
    if not record or record.batch_id != batch_id:
        raise HTTPException(status_code=404, detail="异常记录不存在")

    resolved = dirty_record_crud.resolve_dirty_record(
        db, record_id, current_user.id, request.resolution_note
    )

    dirty_record_crud.reaggregate_after_resolve(db, batch_id)

    return resolved


@router.post("/{batch_id}/notes", response_model=schemas.SupervisorNote)
async def add_note(
    batch_id: int,
    note_in: schemas.SupervisorNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_supervisor)
):
    batch = batch_crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    return note_crud.create_note(db, batch_id, note_in, current_user.id)


@router.get("/{batch_id}/notes", response_model=list[schemas.SupervisorNote])
async def list_notes(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_all_authenticated)
):
    return note_crud.get_notes_by_batch(db, batch_id)


@router.delete("/{batch_id}/notes/{note_id}")
async def delete_note(
    batch_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(allow_supervisor)
):
    note = note_crud.get_note(db, note_id)
    if not note or note.batch_id != batch_id:
        raise HTTPException(status_code=404, detail="批注不存在")

    success = note_crud.delete_note(db, note_id)
    return {"success": success}
