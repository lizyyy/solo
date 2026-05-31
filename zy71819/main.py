from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pathlib import Path

from database import engine, Base, get_db
from models import Bill, ReviewRecord, HistoryRecord, UploadFile as UploadFileModel
from schemas import (
    BillResponse, BillUpdate, BillWithDetails,
    ReviewCreate, ReviewResponse, HistoryResponse,
    UploadResponse, StatisticsResponse
)
from services.import_service import ImportService
from services.review_service import ReviewService
from services.revise_service import ReviseService
from services.export_service import ExportService
from services.anomaly_detector import AnomalyDetector

Base.metadata.create_all(bind=engine)

app = FastAPI(title="票据到期提醒系统", description="票据到期提醒 - 导入、复核、修正、历史、导出全流程")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


@app.get("/")
async def root():
    return FileResponse(str(static_dir / "index.html"))


@app.get("/api/statistics", response_model=StatisticsResponse)
async def get_statistics(db: Session = Depends(get_db)):
    export_service = ExportService(db)
    return export_service.get_statistics()


@app.get("/api/bills", response_model=List[BillResponse])
async def get_bills(
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    bill_type: Optional[str] = None,
    keyword: Optional[str] = None,
    due_date_start: Optional[date] = None,
    due_date_end: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Bill)

    if status:
        query = query.filter(Bill.status == status)
    if anomaly_type:
        query = query.filter(Bill.anomaly_type == anomaly_type)
    if bill_type:
        query = query.filter(Bill.bill_type == bill_type)
    if keyword:
        query = query.filter(
            (Bill.bill_no.contains(keyword)) |
            (Bill.serial_no.contains(keyword)) |
            (Bill.payer.contains(keyword)) |
            (Bill.payee.contains(keyword))
        )
    if due_date_start:
        query = query.filter(Bill.due_date >= due_date_start)
    if due_date_end:
        query = query.filter(Bill.due_date <= due_date_end)

    bills = query.order_by(Bill.due_date.asc()).offset(skip).limit(limit).all()
    return bills


@app.get("/api/bills/{bill_id}", response_model=BillWithDetails)
async def get_bill_detail(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="票据不存在")
    return bill


@app.post("/api/upload/invoice", response_model=UploadResponse)
async def upload_invoice(
    file: UploadFile = File(...),
    operator: str = Form("operator"),
    db: Session = Depends(get_db)
):
    try:
        import_service = ImportService(db)
        file_id, bills, errors = import_service.import_bills(file, "invoice", operator)
        return UploadResponse(
            file_id=file_id,
            file_name=file.filename,
            record_count=len(bills),
            message=f"成功导入{len(bills)}条票据记录" + (f"，{len(errors)}条失败" if errors else "")
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/upload/statement", response_model=UploadResponse)
async def upload_statement(
    file: UploadFile = File(...),
    operator: str = Form("operator"),
    db: Session = Depends(get_db)
):
    try:
        import_service = ImportService(db)
        file_id, bills, errors = import_service.import_bills(file, "statement", operator)
        return UploadResponse(
            file_id=file_id,
            file_name=file.filename,
            record_count=len(bills),
            message=f"成功导入{len(bills)}条对账单记录" + (f"，{len(errors)}条失败" if errors else "")
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/match")
async def match_records(db: Session = Depends(get_db)):
    import_service = ImportService(db)
    matched = import_service.match_invoice_with_statement()
    return {"matched_count": matched, "message": f"成功匹配{matched}条票据与对账单"}


@app.post("/api/review/confirm")
async def review_confirm(
    review: ReviewCreate,
    db: Session = Depends(get_db)
):
    try:
        review_service = ReviewService(db)
        bill = review_service.confirm_bill(
            review.bill_id,
            review.review_reason,
            review.review_evidence,
            review.reviewed_by
        )
        return {"status": "success", "bill_id": bill.id, "new_status": bill.status}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/review/dispute")
async def review_dispute(
    review: ReviewCreate,
    db: Session = Depends(get_db)
):
    try:
        if not review.review_reason:
            raise HTTPException(status_code=400, detail="争议原因必填")
        review_service = ReviewService(db)
        bill = review_service.mark_disputed(
            review.bill_id,
            review.review_reason,
            review.review_evidence,
            review.reviewed_by
        )
        return {"status": "success", "bill_id": bill.id, "new_status": bill.status}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/review/pending")
async def review_pending(
    review: ReviewCreate,
    db: Session = Depends(get_db)
):
    try:
        if not review.review_reason:
            raise HTTPException(status_code=400, detail="待确认原因必填")
        review_service = ReviewService(db)
        bill = review_service.mark_pending(
            review.bill_id,
            review.review_reason,
            review.review_evidence,
            review.reviewed_by
        )
        return {"status": "success", "bill_id": bill.id, "new_status": bill.status}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/review/batch")
async def review_batch(
    bill_ids: List[int],
    action: str = Query(..., description="confirm/dispute/pending"),
    review_reason: Optional[str] = None,
    review_evidence: Optional[str] = None,
    reviewed_by: str = "operator",
    db: Session = Depends(get_db)
):
    try:
        review_service = ReviewService(db)
        results = review_service.batch_review(
            bill_ids, action, review_reason, review_evidence, reviewed_by
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/bills/{bill_id}/reviews", response_model=List[ReviewResponse])
async def get_bill_reviews(bill_id: int, db: Session = Depends(get_db)):
    review_service = ReviewService(db)
    return review_service.get_review_history(bill_id)


@app.put("/api/bills/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: int,
    update_data: BillUpdate,
    db: Session = Depends(get_db)
):
    try:
        revise_service = ReviseService(db)
        update_dict = update_data.model_dump(exclude_unset=True)
        operator = update_dict.pop("operator", "operator")
        revise_reason = update_dict.pop("revise_reason", None)

        bill = revise_service.revise_bill(bill_id, update_dict, operator, revise_reason)
        return bill
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/history")
async def get_history(
    bill_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    revise_service = ReviseService(db)
    histories = revise_service.get_history(bill_id, limit)
    return [HistoryResponse.model_validate(h) for h in histories]


@app.get("/api/export")
async def export_bills(
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    due_soon_only: bool = False,
    include_history: bool = True,
    db: Session = Depends(get_db)
):
    try:
        export_service = ExportService(db)
        file_path = export_service.export_to_excel(
            status=status,
            anomaly_type=anomaly_type,
            start_date=start_date,
            end_date=end_date,
            due_soon_only=due_soon_only,
            include_history=include_history
        )
        return FileResponse(
            path=str(file_path),
            filename=file_path.name,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/uploads", response_model=List[dict])
async def get_upload_history(db: Session = Depends(get_db)):
    uploads = db.query(UploadFileModel).order_by(UploadFileModel.upload_time.desc()).all()
    return [
        {
            "id": u.id,
            "file_name": u.file_name,
            "file_type": u.file_type,
            "upload_time": u.upload_time,
            "record_count": u.record_count,
            "processed": u.processed
        }
        for u in uploads
    ]


@app.post("/api/redetect")
async def redetect_anomalies(db: Session = Depends(get_db)):
    detector = AnomalyDetector(db)
    bills = db.query(Bill).all()
    updated = 0
    for bill in bills:
        old_type = bill.anomaly_type
        bill = detector.analyze_and_mark(bill)
        if bill.anomaly_type != old_type:
            updated += 1
    db.commit()
    return {"updated_count": updated, "message": f"重新检测完成，更新{updated}条记录"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
