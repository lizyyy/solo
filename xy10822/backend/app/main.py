from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import List, Optional
import io
import pandas as pd

from . import models, schemas, crud, reconciliation
from .database import engine, get_db
from .models import ReconciliationStatus

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="支付对账接口台", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "支付对账接口台 API", "version": "1.0.0"}


@app.get("/api/batches", response_model=List[schemas.ReconciliationBatch])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    status: Optional[ReconciliationStatus] = None,
    channel: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_batches(db, skip=skip, limit=limit, status=status, channel=channel)


@app.get("/api/batches/{batch_id}", response_model=schemas.ReconciliationBatchDetail)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.post("/api/batches", response_model=schemas.ReconciliationBatch)
def create_batch(batch: schemas.ReconciliationBatchCreate, db: Session = Depends(get_db)):
    existing = crud.get_batch_by_no(db, batch.batch_no)
    if existing:
        raise HTTPException(status_code=400, detail="批次号已存在")
    return crud.create_batch(db, batch)


@app.post("/api/batches/{batch_id}/reconcile")
def reconcile_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if batch.status == ReconciliationStatus.PROCESSING:
        raise HTTPException(status_code=400, detail="批次正在处理中，请稍候")
    
    matched, discrepancy = reconciliation.reconcile_transactions(db, batch_id)
    return {
        "success": True,
        "batch_id": batch_id,
        "matched_count": matched,
        "discrepancy_count": discrepancy
    }


@app.post("/api/batches/generate-mock")
def generate_mock(
    batch_no: str = f"BATCH-{date.today().strftime('%Y%m%d')}-001",
    channel: str = "alipay",
    channel_count: int = 20,
    internal_count: int = 20,
    discrepancy_rate: float = 0.2,
    db: Session = Depends(get_db)
):
    batch, error = reconciliation.generate_mock_data(
        db, batch_no, channel, datetime.utcnow(),
        channel_count, internal_count, discrepancy_rate
    )
    if error:
        raise HTTPException(status_code=400, detail=error)
    return {
        "success": True,
        "batch_no": batch_no,
        "batch_id": batch.id,
        "message": f"模拟数据已生成，渠道流水 {channel_count} 笔，内部订单 {internal_count} 笔"
    }


@app.get("/api/batches/{batch_id}/export")
def export_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        channel_data = [{
            "交易ID": t.transaction_id,
            "渠道": t.channel,
            "订单号": t.order_no,
            "金额": t.amount,
            "交易时间": t.transaction_time,
            "状态": t.status
        } for t in batch.channel_transactions]
        if channel_data:
            pd.DataFrame(channel_data).to_excel(writer, sheet_name='渠道流水', index=False)
        
        internal_data = [{
            "订单号": o.order_no,
            "金额": o.amount,
            "状态": o.status,
            "支付方式": o.payment_method,
            "创建时间": o.created_time,
            "支付时间": o.paid_time
        } for o in batch.internal_orders]
        if internal_data:
            pd.DataFrame(internal_data).to_excel(writer, sheet_name='内部订单', index=False)
        
        discrepancy_data = [{
            "差异类型": d.discrepancy_type.value,
            "描述": d.description,
            "预期金额": d.expected_amount,
            "实际金额": d.actual_amount,
            "状态": d.status.value,
            "创建时间": d.created_at
        } for d in batch.discrepancies]
        if discrepancy_data:
            pd.DataFrame(discrepancy_data).to_excel(writer, sheet_name='差异记录', index=False)
    
    output.seek(0)
    crud.create_history_record(
        db, models.ActionType.EXPORT, "success",
        f"导出对账结果: {batch.batch_no}",
        batch_id=batch_id
    )
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=reconciliation_{batch.batch_no}.xlsx"}
    )


@app.get("/api/discrepancies", response_model=List[schemas.Discrepancy])
def list_discrepancies(
    skip: int = 0,
    limit: int = 100,
    status: Optional[ReconciliationStatus] = None,
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return crud.get_discrepancies(db, skip=skip, limit=limit, status=status, batch_id=batch_id)


@app.get("/api/discrepancies/{discrepancy_id}", response_model=schemas.Discrepancy)
def get_discrepancy(discrepancy_id: int, db: Session = Depends(get_db)):
    discrepancy = crud.get_discrepancy(db, discrepancy_id)
    if not discrepancy:
        raise HTTPException(status_code=404, detail="差异记录不存在")
    return discrepancy


@app.post("/api/discrepancies/{discrepancy_id}/resolve", response_model=schemas.Discrepancy)
def resolve_discrepancy(
    discrepancy_id: int,
    resolve_data: schemas.DiscrepancyResolve,
    db: Session = Depends(get_db)
):
    discrepancy = crud.get_discrepancy(db, discrepancy_id)
    if not discrepancy:
        raise HTTPException(status_code=404, detail="差异记录不存在")
    if discrepancy.status == ReconciliationStatus.RESOLVED:
        raise HTTPException(status_code=400, detail="差异已处理，请勿重复操作")
    
    return crud.resolve_discrepancy(
        db, discrepancy_id, resolve_data.resolved_note, resolve_data.operator
    )


@app.get("/api/history", response_model=List[schemas.ProcessingHistory])
def list_history(
    skip: int = 0,
    limit: int = 100,
    batch_id: Optional[int] = None,
    discrepancy_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    return crud.get_history(db, skip=skip, limit=limit, batch_id=batch_id, discrepancy_id=discrepancy_id)


@app.get("/api/statistics/batches")
def get_batch_statistics(db: Session = Depends(get_db)):
    return crud.get_batch_statistics(db)


@app.get("/api/statistics/discrepancies")
def get_discrepancy_statistics(db: Session = Depends(get_db)):
    return crud.get_discrepancy_statistics(db)


@app.post("/api/import/channel")
async def import_channel_transactions(
    batch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    batch = crud.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        count = 0
        for _, row in df.iterrows():
            txn_create = schemas.ChannelTransactionCreate(
                transaction_id=str(row.get("交易ID", row.get("transaction_id", ""))),
                channel=str(row.get("渠道", row.get("channel", "unknown"))),
                amount=float(row.get("金额", row.get("amount", 0))),
                transaction_time=pd.to_datetime(row.get("交易时间", row.get("transaction_time", datetime.utcnow()))),
                status=str(row.get("状态", row.get("status", "success"))),
                order_no=str(row.get("订单号", row.get("order_no", ""))),
                raw_data=row.to_json()
            )
            crud.create_channel_transaction(db, txn_create, batch_id)
            count += 1
        
        crud.create_history_record(
            db, models.ActionType.IMPORT, "success",
            f"导入渠道流水 {count} 笔",
            batch_id=batch_id
        )
        
        return {"success": True, "count": count, "message": f"成功导入 {count} 笔渠道流水"}
    except Exception as e:
        crud.create_history_record(
            db, models.ActionType.IMPORT, "failed",
            f"导入渠道流水失败: {str(e)}",
            batch_id=batch_id,
            error_message=str(e)
        )
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
