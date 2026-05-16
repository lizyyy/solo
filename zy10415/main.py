from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List

from database import get_db, init_db
from services import TranslationMemoryService
from schemas import (
    TranslationEntryCreate,
    TranslationEntryResponse,
    StatusUpdateRequest,
    ManualFixRequest,
    ReportResponse,
    ExportRequest,
    ExportResponse,
    IdempotentResponse,
    ErrorResponse,
    EntryStatus,
    ConflictType
)

app = FastAPI(
    title="翻译记忆版本API",
    description="多语言文案翻译记忆库版本管理与回滚控制系统",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    init_db()

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error_code="HTTP_ERROR",
            message=exc.detail,
            details={"path": request.url.path},
            timestamp=datetime.utcnow()
        ).dict()
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error_code="INTERNAL_SERVER_ERROR",
            message=str(exc),
            details={"path": request.url.path},
            timestamp=datetime.utcnow()
        ).dict()
    )

@app.post("/api/v1/entries", response_model=IdempotentResponse, tags=["翻译词条"])
async def create_entry(
    entry_data: TranslationEntryCreate,
    db: Session = Depends(get_db)
):
    service = TranslationMemoryService(db)
    entry, is_duplicate = service.create_entry(entry_data)
    
    return IdempotentResponse(
        is_duplicate=is_duplicate,
        existing_entry=TranslationEntryResponse.from_orm(entry) if is_duplicate else None,
        message="Entry created successfully" if not is_duplicate else "Duplicate submission detected, entry was not modified"
    )

@app.get("/api/v1/entries", response_model=List[TranslationEntryResponse], tags=["翻译词条"])
async def get_entries(
    entry_key: Optional[str] = None,
    source_language: Optional[str] = None,
    target_language: Optional[str] = None,
    version_batch: Optional[str] = None,
    status: Optional[EntryStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    service = TranslationMemoryService(db)
    entries = service.get_entries(
        entry_key=entry_key,
        source_language=source_language,
        target_language=target_language,
        version_batch=version_batch,
        status=status,
        skip=skip,
        limit=limit
    )
    return [TranslationEntryResponse.from_orm(e) for e in entries]

@app.get("/api/v1/entries/{entry_id}", response_model=TranslationEntryResponse, tags=["翻译词条"])
async def get_entry(
    entry_id: int,
    db: Session = Depends(get_db)
):
    service = TranslationMemoryService(db)
    entry = service.get_entry_by_id(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return TranslationEntryResponse.from_orm(entry)

@app.patch("/api/v1/entries/{entry_id}/status", response_model=TranslationEntryResponse, tags=["翻译词条"])
async def update_entry_status(
    entry_id: int,
    request: StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    service = TranslationMemoryService(db)
    entry = service.update_status(entry_id, request)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return TranslationEntryResponse.from_orm(entry)

@app.patch("/api/v1/entries/{entry_id}/manual-fix", response_model=TranslationEntryResponse, tags=["翻译词条"])
async def manual_fix_entry(
    entry_id: int,
    request: ManualFixRequest,
    db: Session = Depends(get_db)
):
    service = TranslationMemoryService(db)
    entry = service.manual_fix(entry_id, request)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return TranslationEntryResponse.from_orm(entry)

@app.get("/api/v1/reports", response_model=List[ReportResponse], tags=["记忆报告"])
async def get_reports(
    entry_id: Optional[int] = None,
    report_type: Optional[str] = None,
    conflict_type: Optional[ConflictType] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    service = TranslationMemoryService(db)
    reports = service.get_reports(
        entry_id=entry_id,
        report_type=report_type,
        conflict_type=conflict_type,
        skip=skip,
        limit=limit
    )
    return [ReportResponse.from_orm(r) for r in reports]

@app.get("/api/v1/entries/{entry_id}/reports", response_model=List[ReportResponse], tags=["记忆报告"])
async def get_entry_reports(
    entry_id: int,
    db: Session = Depends(get_db)
):
    service = TranslationMemoryService(db)
    entry = service.get_entry_by_id(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    reports = service.get_reports(entry_id=entry_id)
    return [ReportResponse.from_orm(r) for r in reports]

@app.post("/api/v1/export", response_model=ExportResponse, tags=["数据导出"])
async def export_data(
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    service = TranslationMemoryService(db)
    entries, reports = service.export_data(
        version_batch=request.version_batch,
        source_language=request.source_language,
        target_language=request.target_language,
        status=request.status,
        include_reports=request.include_reports
    )
    
    return ExportResponse(
        entries=[TranslationEntryResponse.from_orm(e) for e in entries],
        reports=[ReportResponse.from_orm(r) for r in reports],
        export_time=datetime.utcnow(),
        total_entries=len(entries),
        total_reports=len(reports)
    )

@app.get("/api/v1/health", tags=["系统"])
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}