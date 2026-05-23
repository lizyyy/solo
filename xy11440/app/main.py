import os
from datetime import timedelta
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .database import engine, get_db, Base
from .models import User, UserRole, BatchStatus, RecordType, DirtyType
from .schemas import (
    Token, BatchCreate, BatchUpdate, BatchSummary, BatchDetail,
    RecordCreate, RecordUpdate, RecordResponse, AttachmentResponse,
    StatusTrailResponse, CorrectionTrailResponse, StatusChangeRequest,
    BatchExportResponse
)
from .auth import (
    authenticate_user, create_access_token, get_current_user,
    require_roles, ACCESS_TOKEN_EXPIRE_MINUTES, create_initial_users
)
from .services import (
    BatchService, RecordService, AttachmentService,
    StatusTrailService, CorrectionTrailService
)
from .export_service import ExportService

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="生鲜分拣损耗异常回执状态机 API",
    description="处理供应商送货单、称重记录、退筐照片和外部回执的状态机服务，支持批次创建、附件补传、复核改判、冻结结算、撤回归档等功能",
    version="1.0.0"
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.on_event("startup")
def startup_event():
    db = next(get_db())
    create_initial_users(db)
    db.close()


@app.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}


@app.post("/batches", response_model=BatchDetail)
def create_batch(
    batch_data: BatchCreate,
    current_user: User = Depends(require_roles(UserRole.ENTRY, UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return BatchService.create_batch(db, batch_data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/batches", response_model=List[BatchSummary])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    status: Optional[BatchStatus] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return BatchService.list_batches(db, skip, limit, status)


@app.get("/batches/{batch_id}", response_model=BatchDetail)
def get_batch(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    batch = BatchService.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.put("/batches/{batch_id}", response_model=BatchDetail)
def update_batch(
    batch_id: int,
    update_data: BatchUpdate,
    current_user: User = Depends(require_roles(UserRole.ENTRY, UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return BatchService.update_batch(db, batch_id, update_data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/batches/{batch_id}/submit", response_model=BatchDetail)
def submit_for_review(
    batch_id: int,
    request: StatusChangeRequest,
    current_user: User = Depends(require_roles(UserRole.ENTRY, UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return BatchService.transition_status(
            db, batch_id, BatchStatus.PENDING_REVIEW, current_user.id, request.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/batches/{batch_id}/review", response_model=BatchDetail)
def review_batch(
    batch_id: int,
    request: StatusChangeRequest,
    current_user: User = Depends(require_roles(UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return BatchService.transition_status(
            db, batch_id, BatchStatus.REVIEWED, current_user.id, request.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/batches/{batch_id}/reject", response_model=BatchDetail)
def reject_batch(
    batch_id: int,
    request: StatusChangeRequest,
    current_user: User = Depends(require_roles(UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return BatchService.transition_status(
            db, batch_id, BatchStatus.REJECTED, current_user.id, request.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/batches/{batch_id}/freeze", response_model=BatchDetail)
def freeze_batch(
    batch_id: int,
    request: StatusChangeRequest,
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        batch = BatchService.transition_status(
            db, batch_id, BatchStatus.FROZEN, current_user.id, request.reason
        )
        if request.reason:
            batch.freeze_reason = request.reason
            db.commit()
            db.refresh(batch)
        return batch
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/batches/{batch_id}/unfreeze", response_model=BatchDetail)
def unfreeze_batch(
    batch_id: int,
    request: StatusChangeRequest,
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return BatchService.transition_status(
            db, batch_id, BatchStatus.REVIEWED, current_user.id, request.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/batches/{batch_id}/archive", response_model=BatchDetail)
def archive_batch(
    batch_id: int,
    request: StatusChangeRequest,
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return BatchService.transition_status(
            db, batch_id, BatchStatus.ARCHIVED, current_user.id, request.reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/batches/{batch_id}/trails", response_model=List[StatusTrailResponse])
def get_batch_trails(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return StatusTrailService.get_trails_by_batch(db, batch_id)


@app.post("/records", response_model=RecordResponse)
def create_record(
    record_data: RecordCreate,
    current_user: User = Depends(require_roles(UserRole.ENTRY, UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return RecordService.create_record(db, record_data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/batches/{batch_id}/records", response_model=List[RecordResponse])
def list_batch_records(
    batch_id: int,
    include_dirty: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return RecordService.list_records_by_batch(db, batch_id, include_dirty)


@app.get("/records/{record_id}", response_model=RecordResponse)
def get_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = RecordService.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.put("/records/{record_id}", response_model=RecordResponse)
def update_record(
    record_id: int,
    update_data: RecordUpdate,
    current_user: User = Depends(require_roles(UserRole.ENTRY, UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return RecordService.update_record(db, record_id, update_data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/records/{record_id}/reprocess", response_model=RecordResponse)
def reprocess_record(
    record_id: int,
    current_user: User = Depends(require_roles(UserRole.ENTRY, UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    try:
        return RecordService.reprocess_record(db, record_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/records/{record_id}/corrections", response_model=List[CorrectionTrailResponse])
def get_record_corrections(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return CorrectionTrailService.get_trails_by_record(db, record_id)


@app.post("/records/{record_id}/attachments", response_model=AttachmentResponse)
async def upload_attachment(
    record_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(UserRole.ENTRY, UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    record = RecordService.get_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    
    file_path = os.path.join(UPLOAD_DIR, f"{record_id}_{file.filename}")
    content = await file.read()
    
    with open(file_path, "wb") as f:
        f.write(content)
    
    try:
        return AttachmentService.add_attachment(
            db, record_id, file.filename, file_path,
            file.content_type or "application/octet-stream",
            len(content), current_user.id
        )
    except ValueError as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/records/{record_id}/attachments", response_model=List[AttachmentResponse])
def list_record_attachments(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return AttachmentService.list_attachments_by_record(db, record_id)


@app.get("/export/batches", response_model=BatchExportResponse)
def export_batches_json(
    batch_id: Optional[int] = None,
    current_user: User = Depends(require_roles(UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    return ExportService.get_batch_export_data(db, batch_id)


@app.get("/export/batches/excel")
def export_batches_excel(
    batch_id: Optional[int] = None,
    current_user: User = Depends(require_roles(UserRole.REVIEW, UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    excel_file = ExportService.export_to_excel(db, batch_id)
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=batch_export.xlsx"}
    )


@app.get("/manager/dashboard")
def manager_dashboard(
    current_user: User = Depends(require_roles(UserRole.SUPERVISOR)),
    db: Session = Depends(get_db)
):
    return ExportService.get_manager_dashboard(db)


@app.get("/roles")
def list_roles(current_user: User = Depends(get_current_user)):
    return {
        "current_role": current_user.role.value,
        "available_roles": [r.value for r in UserRole],
        "permissions": {
            UserRole.ENTRY.value: ["创建批次", "添加记录", "上传附件", "提交复核"],
            UserRole.REVIEW.value: ["创建批次", "添加记录", "上传附件", "复核通过", "复核拒绝", "导出"],
            UserRole.SUPERVISOR.value: ["全部权限", "冻结结算", "撤回归档", "管理看板"],
            UserRole.READONLY.value: ["只读查询"]
        }
    }
