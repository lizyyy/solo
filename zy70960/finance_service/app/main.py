from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from io import BytesIO

from .database import engine, get_db, Base
from . import models, schemas, services
from .parser import export_records_to_excel, export_records_to_csv

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="区域财务对账系统 API",
    description="处理缴存CSV、销售JSON、备用金流水，生成可追踪的财务记录",
    version="1.0.0"
)


@app.post("/api/batches", response_model=schemas.BatchResponse, tags=["批次管理"])
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    try:
        return services.create_batch(db, batch)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/batches/{batch_id}/upload", tags=["批次管理"])
async def upload_batch_file(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    try:
        batch, count = services.upload_batch_file(db, batch_id, content, file.filename)
        return {
            "batch_id": batch.id,
            "batch_no": batch.batch_no,
            "record_count": count,
            "status": batch.status
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/batches/{batch_id}/detect-anomalies", tags=["异常检测"])
def detect_anomalies(batch_id: int, db: Session = Depends(get_db)):
    anomalies = services.detect_anomalies(db, batch_id)
    return {
        "batch_id": batch_id,
        "anomaly_count": len(anomalies),
        "anomalies": anomalies
    }


@app.post("/api/batches/{batch_id}/reconcile", tags=["对账处理"])
def reconcile_batch(batch_id: int, db: Session = Depends(get_db)):
    results = services.reconcile_deposits_with_sales(db, batch_id)
    return {
        "batch_id": batch_id,
        "mismatch_count": len(results),
        "results": results
    }


@app.post("/api/records/process", tags=["记录处理"])
def process_records(request: schemas.ProcessActionRequest, db: Session = Depends(get_db)):
    processed = services.process_records(db, request)
    return {
        "processed_count": processed,
        "action": request.action
    }


@app.post("/api/batches/{batch_id}/return", tags=["批次管理"])
def return_batch(
    batch_id: int,
    reason: str,
    handled_by: str,
    remarks: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        batch = services.return_batch(db, batch_id, reason, handled_by, remarks)
        return {
            "batch_id": batch.id,
            "batch_no": batch.batch_no,
            "status": batch.status,
            "reason": reason
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/batches", tags=["查询"])
def list_batches(
    store_code: Optional[str] = None,
    batch_no: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 100,
    db: Session = Depends(get_db)
):
    params = schemas.QueryParams(
        store_code=store_code,
        batch_no=batch_no,
        status=status,
        page=page,
        page_size=page_size
    )
    batches, total = services.query_batches(db, params)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": batches
    }


@app.get("/api/batches/{batch_id}", response_model=schemas.BatchDetailResponse, tags=["查询"])
def get_batch_detail(batch_id: int, db: Session = Depends(get_db)):
    batch = services.get_batch_detail(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.get("/api/deposit-records", tags=["查询"])
def list_deposit_records(
    store_code: Optional[str] = None,
    batch_no: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 100,
    db: Session = Depends(get_db)
):
    params = schemas.QueryParams(
        store_code=store_code,
        batch_no=batch_no,
        status=status,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size
    )
    records, total = services.query_records(db, params)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": records
    }


@app.get("/api/petty-cash-records", tags=["查询"])
def list_petty_cash_records(
    store_code: Optional[str] = None,
    account_no: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 100,
    db: Session = Depends(get_db)
):
    params = schemas.QueryParams(
        store_code=store_code,
        account_no=account_no,
        status=status,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size
    )
    records, total = services.query_petty_cash(db, params)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": records
    }


@app.get("/api/process-logs", tags=["查询"])
def get_process_logs(
    batch_id: Optional[int] = None,
    deposit_record_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    logs = services.get_process_logs(db, batch_id, deposit_record_id)
    return {"count": len(logs), "data": logs}


@app.get("/api/export/deposit-records", tags=["导出"])
def export_deposit_records(
    store_code: Optional[str] = None,
    batch_no: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    format: str = Query("excel", pattern="^(excel|csv)$"),
    db: Session = Depends(get_db)
):
    params = schemas.QueryParams(
        store_code=store_code,
        batch_no=batch_no,
        status=status,
        start_date=start_date,
        end_date=end_date,
        page=1,
        page_size=100000
    )
    records, total = services.query_records(db, params)
    records_dict = [services.record_to_dict(r) for r in records]

    if format == "excel":
        content = export_records_to_excel(records_dict, "缴存记录")
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"deposit_records_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    else:
        content = export_records_to_csv(records_dict)
        media_type = "text/csv"
        filename = f"deposit_records_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"

    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/export/petty-cash-records", tags=["导出"])
def export_petty_cash_records(
    store_code: Optional[str] = None,
    account_no: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    format: str = Query("excel", pattern="^(excel|csv)$"),
    db: Session = Depends(get_db)
):
    params = schemas.QueryParams(
        store_code=store_code,
        account_no=account_no,
        status=status,
        start_date=start_date,
        end_date=end_date,
        page=1,
        page_size=100000
    )
    records, total = services.query_petty_cash(db, params)
    records_dict = [services.record_to_dict(r) for r in records]

    if format == "excel":
        content = export_records_to_excel(records_dict, "备用金流水")
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"petty_cash_records_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    else:
        content = export_records_to_csv(records_dict)
        media_type = "text/csv"
        filename = f"petty_cash_records_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"

    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/export/batches/{batch_id}", tags=["导出"])
def export_batch_detail(
    batch_id: int,
    format: str = Query("excel", pattern="^(excel|csv)$"),
    db: Session = Depends(get_db)
):
    batch = services.get_batch_detail(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    records_dict = []
    record_type = ""

    if batch.batch_type == "deposit":
        records = batch.deposit_records
        records_dict = [services.record_to_dict(r) for r in records]
        record_type = "缴存记录"
    elif batch.batch_type == "sales":
        records = batch.sales_records
        records_dict = [services.record_to_dict(r) for r in records]
        record_type = "销售记录"
    elif batch.batch_type == "petty_cash":
        records = batch.petty_cash_records
        records_dict = [services.record_to_dict(r) for r in records]
        record_type = "备用金流水"

    if format == "excel":
        content = export_records_to_excel(records_dict, record_type)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{batch.batch_no}_{record_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    else:
        content = export_records_to_csv(records_dict)
        media_type = "text/csv"
        filename = f"{batch.batch_no}_{record_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"

    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/health", tags=["系统"])
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
