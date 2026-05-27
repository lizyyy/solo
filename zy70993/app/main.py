import json
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import SessionLocal, engine, get_db
from app.reconcile import compute_idempotency_key, parse_and_validate, run_reconciliation

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="困难学生补贴 · 刷卡/退款月度核对 API",
    version="0.1.0",
    description="将刷卡 CSV、补贴名单 JSON、退款表按月核对，输出正常/待确认/失败三类。",
)


def _read_upload(file: UploadFile, max_bytes: int = 10 * 1024 * 1024) -> bytes:
    data = file.file.read()
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"文件超过 {max_bytes} 字节")
    return data


@app.get("/")
def index():
    return {"name": "subsidy-reconcile", "version": "0.1.0"}


@app.post("/batches/upload", response_model=schemas.UploadResponse)
def upload_batch(
    name: str = Form(...),
    month: str = Form(..., regex=r"^\d{4}-\d{2}$"),
    swipe_file: UploadFile = File(..., description="刷卡 CSV"),
    subsidy_file: UploadFile = File(..., description="补贴名单 JSON"),
    refund_file: UploadFile = File(..., description="退款表 CSV/TSV/JSON"),
    refund_format: str = Form("csv", pattern="^(csv|tsv|json)$"),
    note: Optional[str] = Form(""),
    db: Session = Depends(get_db),
):
    swipe_bytes = _read_upload(swipe_file)
    subsidy_bytes = _read_upload(subsidy_file)
    refund_bytes = _read_upload(refund_file)

    key = compute_idempotency_key(name, month, swipe_bytes, subsidy_bytes, refund_bytes)

    existing = db.query(models.Batch).filter(models.Batch.idempotency_key == key).first()
    if existing:
        return schemas.UploadResponse(
            batch=schemas.BatchOut.model_validate(existing),
            existing=True,
            message="同一批材料已存在，未重复生效",
        )

    try:
        swipe_csv = swipe_bytes.decode("utf-8-sig")
        subsidy_json = subsidy_bytes.decode("utf-8-sig")
        refund_text = refund_bytes.decode("utf-8-sig")
        swipes, subsidies, refunds = parse_and_validate(swipe_csv, subsidy_json, refund_text, refund_format)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"解析失败: {e}")

    batch = models.Batch(
        name=name,
        month=month,
        idempotency_key=key,
        swipe_count=len(swipes),
        subsidy_count=len(subsidies),
        refund_count=len(refunds),
        status="uploaded",
        note=note or "",
    )
    db.add(batch)
    db.flush()

    for item in swipes:
        raw = json.dumps(item.model_dump(), ensure_ascii=False, default=str)
        db.add(models.SwipeRecord(
            batch_id=batch.id,
            student_id=item.student_id,
            student_name=item.student_name or "",
            swipe_time=item.swipe_time,
            meal_type=item.meal_type,
            amount=item.amount,
            device=item.device or "",
            raw=raw,
        ))
    for item in subsidies:
        db.add(models.SubsidyRecord(
            batch_id=batch.id,
            student_id=item.student_id,
            student_name=item.student_name or "",
            monthly_limit=item.monthly_limit,
            subsidy_type=item.subsidy_type or "",
            effective_month=item.effective_month,
            note=item.note or "",
        ))
    for item in refunds:
        raw = json.dumps(item.model_dump(), ensure_ascii=False, default=str)
        db.add(models.RefundRecord(
            batch_id=batch.id,
            student_id=item.student_id,
            refund_time=item.refund_time,
            refund_amount=item.refund_amount,
            related_meal_type=item.related_meal_type or "",
            reason=item.reason or "",
            raw=raw,
        ))

    db.commit()
    db.refresh(batch)

    return schemas.UploadResponse(
        batch=schemas.BatchOut.model_validate(batch),
        existing=False,
        message="上传成功，待核对",
    )


@app.get("/batches", response_model=list[schemas.BatchOut])
def list_batches(db: Session = Depends(get_db)):
    return db.query(models.Batch).order_by(models.Batch.id.desc()).all()


@app.get("/batches/{batch_id}", response_model=schemas.BatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    b = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="批次不存在")
    return b


@app.post("/batches/{batch_id}/reconcile", response_model=schemas.ReconcileReport)
def reconcile(batch_id: int, db: Session = Depends(get_db)):
    b = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="批次不存在")
    try:
        report = run_reconciliation(batch_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"核对失败: {e}")
    return report


@app.get("/batches/{batch_id}/report", response_model=schemas.ReconcileReport)
def get_report(batch_id: int, db: Session = Depends(get_db)):
    b = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="批次不存在")
    if b.status != "reconciled":
        raise HTTPException(status_code=409, detail="尚未核对，请先调用 reconcile")
    results = db.query(models.ReconciliationResult).filter(
        models.ReconciliationResult.batch_id == batch_id
    ).all()
    return {
        "batch_id": b.id,
        "month": b.month,
        "total": len(results),
        "normal_count": sum(1 for r in results if r.status == "normal"),
        "pending_count": sum(1 for r in results if r.status == "pending"),
        "failed_count": sum(1 for r in results if r.status == "failed"),
        "normal": [r for r in results if r.status == "normal"],
        "pending": [r for r in results if r.status == "pending"],
        "failed": [r for r in results if r.status == "failed"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
