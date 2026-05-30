import io
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import get_db, CollateralBatch, CollateralRecord, ExportSnapshot
from schemas import (
    BatchUploadResponse, RecordResponse, StatusHistoryResponse,
    ManualNoteRequest, ManualNoteResponse, BatchInfoResponse,
    ExceptionSummary, ExportResponse, ReviewCheckResponse
)
from services import (
    process_batch, add_manual_note, get_record_history, get_record_notes,
    prepare_export_data, create_export_snapshot, get_review_checklist,
    EXCEPTION_CODES
)

app = FastAPI(title="质押品折扣回看系统")


@app.get("/")
def root():
    return FileResponse("static/index.html")


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.post("/api/batch/upload", response_model=BatchUploadResponse)
async def upload_batch(
    file: UploadFile = File(...),
    batch_date: str = Query(..., description="批次日期，格式YYYY-MM-DD"),
    operator: str = Query(default="system"),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="仅支持Excel或CSV文件")

    try:
        contents = await file.read()
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        column_mapping = {
            "质押品代码": "collateral_code",
            "质押品名称": "collateral_name",
            "质押品类型": "collateral_type",
            "市值": "market_value",
            "面值": "face_value",
            "折扣率": "discount_rate",
        }
        df = df.rename(columns={k: v for k, v in column_mapping.items() if k in df.columns})

        required_columns = ["collateral_code", "market_value", "discount_rate"]
        for col in required_columns:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"缺少必要列: {col}")

        records = df.where(pd.notnull(df), None).to_dict("records")
        result = process_batch(db, batch_date, file.filename, records, operator)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/batches", response_model=List[BatchInfoResponse])
def get_batches(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    batches = db.query(CollateralBatch).order_by(
        CollateralBatch.created_at.desc()
    ).offset(skip).limit(limit).all()
    return batches


@app.get("/api/batch/{batch_id}/records", response_model=List[RecordResponse])
def get_batch_records(
    batch_id: str,
    status: Optional[str] = None,
    only_exception: bool = False,
    only_manual: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(CollateralRecord).filter(CollateralRecord.batch_id == batch_id)

    if status:
        query = query.filter(CollateralRecord.status == status)
    if only_exception:
        query = query.filter(CollateralRecord.is_exception == True)
    if only_manual:
        query = query.filter(CollateralRecord.has_manual_note == True)

    records = query.order_by(CollateralRecord.collateral_code).all()
    return records


@app.get("/api/record/{record_key}/history", response_model=List[StatusHistoryResponse])
def get_history(record_key: str, db: Session = Depends(get_db)):
    return get_record_history(db, record_key)


@app.get("/api/record/{record_key}/notes")
def get_notes(record_key: str, db: Session = Depends(get_db)):
    return get_record_notes(db, record_key)


@app.post("/api/record/note", response_model=ManualNoteResponse)
def add_note(request: ManualNoteRequest, db: Session = Depends(get_db)):
    result = add_manual_note(
        db,
        request.record_key,
        request.batch_id,
        request.note_content,
        request.operator,
        request.new_final_discount,
        request.new_status
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/api/exceptions/summary", response_model=List[ExceptionSummary])
def get_exception_summary(batch_id: str, db: Session = Depends(get_db)):
    from sqlalchemy import func
    results = db.query(
        CollateralRecord.exception_code,
        func.count(CollateralRecord.exception_code)
    ).filter(
        CollateralRecord.batch_id == batch_id,
        CollateralRecord.is_exception == True
    ).group_by(CollateralRecord.exception_code).all()

    summary = []
    for code, count in results:
        if code and code in EXCEPTION_CODES:
            summary.append({
                "exception_code": code,
                "count": count,
                "description": EXCEPTION_CODES[code]["description"],
                "suggestion": EXCEPTION_CODES[code]["suggestion"]
            })
    return summary


@app.get("/api/batch/{batch_id}/review-check", response_model=ReviewCheckResponse)
def review_check(batch_id: str, db: Session = Depends(get_db)):
    return get_review_checklist(db, batch_id)


@app.post("/api/batch/export", response_model=ExportResponse)
def export_batch(
    batch_id: str,
    export_type: str = "review",
    operator: str = "system",
    db: Session = Depends(get_db)
):
    result = create_export_snapshot(db, batch_id, export_type, operator)
    return result


@app.get("/api/batch/{batch_id}/download")
def download_batch(
    batch_id: str,
    db: Session = Depends(get_db)
):
    export_data, export_hash = prepare_export_data(db, batch_id)

    df = pd.DataFrame(export_data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="复核清单")
    output.seek(0)

    filename = f"质押品折扣复核清单_{batch_id}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/batch/{batch_id}/snapshots")
def get_snapshots(batch_id: str, db: Session = Depends(get_db)):
    snapshots = db.query(ExportSnapshot).filter(
        ExportSnapshot.batch_id == batch_id
    ).order_by(ExportSnapshot.created_at.desc()).all()

    return [
        {
            "snapshot_id": s.snapshot_id,
            "export_type": s.export_type,
            "record_count": s.record_count,
            "export_hash": s.export_hash,
            "exported_by": s.exported_by,
            "created_at": s.created_at,
            "remark": s.remark
        }
        for s in snapshots
    ]


@app.get("/api/exception-codes")
def get_exception_codes():
    return EXCEPTION_CODES


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
