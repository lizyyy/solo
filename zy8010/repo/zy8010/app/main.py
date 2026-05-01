from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import init_db, get_db
from app.models import ReviewStatus
from app.schemas import (
    BatchImportRequest, BatchImportResponse,
    ValidationResponse, ReviewStatusUpdate,
    ReviewRecordResponse, ReportResponse,
    PrescriptionResponse, PrescriptionCreate
)
from app.services import ImportService, ValidationService, ReviewService, ReportService


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="药店处方外配复核 API",
    description="门店处方单、医保结算、药品批号库存和退药记录的导入、校验、复核和审计报告服务",
    version="1.0.0",
    lifespan=lifespan
)


@app.post("/api/import/batch", response_model=BatchImportResponse, tags=["导入管理"])
async def batch_import(
    request: BatchImportRequest,
    db: AsyncSession = Depends(get_db)
):
    service = ImportService(db)
    result = await service.batch_import(request)
    return result


@app.post("/api/import/prescription", response_model=PrescriptionResponse, tags=["导入管理"])
async def import_single_prescription(
    data: PrescriptionCreate,
    db: AsyncSession = Depends(get_db)
):
    service = ImportService(db)
    prescription = await service.import_prescription(data)
    return prescription


@app.get("/api/validate/{prescription_no}", response_model=ValidationResponse, tags=["风险校验"])
async def validate_prescription(
    prescription_no: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        service = ValidationService(db)
        result = await service.validate_prescription(prescription_no)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/validate/batch/{batch_no}", tags=["风险校验"])
async def validate_batch(
    batch_no: str,
    db: AsyncSession = Depends(get_db)
):
    service = ValidationService(db)
    results = await service.validate_batch(batch_no)
    return {"batch_no": batch_no, "results": results}


@app.put("/api/review/{prescription_no}/status", response_model=ReviewRecordResponse, tags=["复核管理"])
async def update_review_status(
    prescription_no: str,
    update: ReviewStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    try:
        service = ReviewService(db)
        review = await service.update_status(
            prescription_no=prescription_no,
            status=update.status,
            reviewer=update.reviewer,
            review_comment=update.review_comment,
            rectification_note=update.rectification_note
        )
        return review
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/review/{prescription_no}", response_model=Optional[ReviewRecordResponse], tags=["复核管理"])
async def get_review(
    prescription_no: str,
    db: AsyncSession = Depends(get_db)
):
    service = ReviewService(db)
    review = await service.get_review(prescription_no)
    return review


@app.get("/api/report/markdown", response_class=PlainTextResponse, tags=["审计报告"])
async def get_markdown_report(
    batch_no: Optional[str] = Query(None, description="批次号，不填则生成所有数据的报告"),
    db: AsyncSession = Depends(get_db)
):
    service = ReportService(db)
    markdown = await service.generate_markdown_report(batch_no)
    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown; charset=utf-8"
    )


@app.get("/api/report/stats", response_model=ReportResponse, tags=["审计报告"])
async def get_report_stats(
    batch_no: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    service = ReportService(db)
    stats = await service.get_report_stats(batch_no)
    markdown = await service.generate_markdown_report(batch_no)
    return ReportResponse(
        markdown_content=markdown,
        generated_at=datetime.utcnow(),
        batch_no=batch_no,
        **stats
    )


@app.get("/health", tags=["系统"])
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.get("/", tags=["系统"])
async def root():
    return {
        "name": "药店处方外配复核 API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }
