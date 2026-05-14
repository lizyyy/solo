from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
import os
from database import get_db, init_db
from schemas import (
    UserPreferenceCreate, UserPreferenceUpdate, UserPreferenceResponse,
    SendReceiptCreate, SendReceiptUpdate, SendReceiptResponse,
    RetryRecordCreate, RetryConfirm, RetryRecordResponse,
    VersionHistoryResponse, ExportRequest, ExportResponse,
    PaginatedResponse
)
from services import (
    PreferenceService, ReceiptService, RetryService,
    ExportService, IdempotentService
)

app = FastAPI(title="通知中心偏好管理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/")
async def root():
    return {"message": "通知中心偏好管理系统 API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/preferences", response_model=UserPreferenceResponse)
async def create_preference(preference_data: UserPreferenceCreate, db: Session = Depends(get_db)):
    try:
        result = PreferenceService.create_preference(db, preference_data)
        if isinstance(result, dict) and result.get("is_duplicate"):
            raise HTTPException(status_code=409, detail="Duplicate request")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/preferences/{preference_id}", response_model=UserPreferenceResponse)
async def update_preference(
    preference_id: int,
    update_data: UserPreferenceUpdate,
    db: Session = Depends(get_db)
):
    try:
        result = PreferenceService.update_preference(db, preference_id, update_data)
        if isinstance(result, dict) and result.get("is_duplicate"):
            raise HTTPException(status_code=409, detail="Duplicate request")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/preferences/{preference_id}/rollback/{version_number}", response_model=UserPreferenceResponse)
async def rollback_preference(
    preference_id: int,
    version_number: int,
    changed_by: str = Query(..., description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        return PreferenceService.rollback_preference(db, preference_id, version_number, changed_by)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/preferences", response_model=PaginatedResponse)
async def get_preferences(
    user_id: Optional[str] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    result = PreferenceService.get_preferences(db, user_id, channel, status, page, page_size)
    return result


@app.get("/api/preferences/{preference_id}", response_model=UserPreferenceResponse)
async def get_preference(preference_id: int, db: Session = Depends(get_db)):
    preference = PreferenceService.get_preference_by_id(db, preference_id)
    if not preference:
        raise HTTPException(status_code=404, detail="Preference not found")
    return preference


@app.get("/api/preferences/{preference_id}/versions", response_model=list[VersionHistoryResponse])
async def get_version_history(preference_id: int, db: Session = Depends(get_db)):
    return PreferenceService.get_version_history(db, preference_id)


@app.post("/api/receipts", response_model=SendReceiptResponse)
async def create_receipt(receipt_data: SendReceiptCreate, db: Session = Depends(get_db)):
    try:
        result = ReceiptService.create_receipt(db, receipt_data)
        if isinstance(result, dict) and result.get("is_duplicate"):
            raise HTTPException(status_code=409, detail="Duplicate request")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/receipts/{receipt_id}", response_model=SendReceiptResponse)
async def update_receipt(
    receipt_id: int,
    update_data: SendReceiptUpdate,
    db: Session = Depends(get_db)
):
    try:
        return ReceiptService.update_receipt(db, receipt_id, update_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/receipts", response_model=PaginatedResponse)
async def get_receipts(
    user_id: Optional[str] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    has_error: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    result = ReceiptService.get_receipts(db, user_id, channel, status, has_error, page, page_size)
    return result


@app.get("/api/receipts/abnormal", response_model=PaginatedResponse)
async def get_abnormal_receipts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return ReceiptService.get_abnormal_receipts(db, page, page_size)


@app.post("/api/retry-records", response_model=RetryRecordResponse)
async def create_retry_record(retry_data: RetryRecordCreate, db: Session = Depends(get_db)):
    return RetryService.create_retry_record(db, retry_data)


@app.post("/api/retry-records/{retry_id}/confirm", response_model=RetryRecordResponse)
async def confirm_retry(
    retry_id: int,
    confirm_data: RetryConfirm,
    db: Session = Depends(get_db)
):
    try:
        return RetryService.confirm_retry(db, retry_id, confirm_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/retry-records/{retry_id}/execute", response_model=RetryRecordResponse)
async def execute_retry(retry_id: int, db: Session = Depends(get_db)):
    try:
        return RetryService.execute_retry(db, retry_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/retry-records", response_model=PaginatedResponse)
async def get_retry_records(
    receipt_id: Optional[int] = None,
    status: Optional[str] = None,
    manual_confirmed: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return RetryService.get_retry_records(db, receipt_id, status, manual_confirmed, page, page_size)


@app.post("/api/exports", response_model=ExportResponse)
async def create_export(export_data: ExportRequest, db: Session = Depends(get_db)):
    export_record = ExportService.create_export_task(db, export_data)
    ExportService.execute_export(db, export_record.export_id)
    db.refresh(export_record)
    return export_record


@app.get("/api/exports", response_model=PaginatedResponse)
async def get_exports(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return ExportService.get_export_records(db, status, page, page_size)


@app.get("/api/exports/{export_id}/download")
async def download_export(export_id: str, db: Session = Depends(get_db)):
    try:
        file_path = ExportService.get_export_file_path(db, export_id)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(file_path, filename=os.path.basename(file_path))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/idempotent/{request_id}")
async def check_idempotent(request_id: str, db: Session = Depends(get_db)):
    result = IdempotentService.check_idempotent(db, request_id)
    if result:
        return {"exists": True, **result}
    return {"exists": False}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)