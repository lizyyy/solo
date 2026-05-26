import logging
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status as http_status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from . import services, schemas, models, report as report_module, worker as worker_module
from .database import engine, Base, SessionLocal, get_db
from .models import TaskStatus, Conclusion, Node

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("renovation_acceptance")

_worker_thread: Optional[threading.Thread] = None
_worker_stop = threading.Event()


def _background_worker():
    logger.info("后台 worker 启动")
    while not _worker_stop.is_set():
        db = SessionLocal()
        try:
            rows = db.query(models.AcceptanceBatch).filter(
                models.AcceptanceBatch.status == TaskStatus.PROCESSING
            ).all()
            for batch in rows:
                worker_module.process_batch(batch.id)
        except Exception:
            logger.exception("后台 worker 轮询异常")
        finally:
            db.close()
        _worker_stop.wait(2.0)
    logger.info("后台 worker 退出")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("数据库表已创建")
    global _worker_thread
    _worker_stop.clear()
    _worker_thread = threading.Thread(target=_background_worker, daemon=True, name="ra-worker")
    _worker_thread.start()
    yield
    _worker_stop.set()
    if _worker_thread is not None:
        _worker_thread.join(timeout=5)


app = FastAPI(
    title="装修工程节点验收服务",
    description="装修监理材料提交、节点验收、返工记录、审计复盘、报告导出",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/batches", response_model=schemas.BatchResponse, status_code=201)
def create_batch(req: schemas.CreateBatchRequest, db: Session = Depends(get_db)):
    payload_dict = req.model_dump()
    existing = services.find_existing_batch(db, payload_dict)
    if existing is not None:
        db.commit()
        return services.to_batch_response(existing, duplicated=True)
    batch = services.create_batch(db, req)
    db.commit()
    db.refresh(batch)
    return services.to_batch_response(batch, duplicated=False)


@app.get("/batches", response_model=List[schemas.BatchResponse])
def list_batches(
    status: Optional[TaskStatus] = None,
    node: Optional[Node] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.AcceptanceBatch)
    if status is not None:
        q = q.filter(models.AcceptanceBatch.status == status)
    if node is not None:
        q = q.filter(models.AcceptanceBatch.node == node)
    rows = q.order_by(models.AcceptanceBatch.created_at.desc()).all()
    return [services.to_batch_response(r) for r in rows]


@app.get("/batches/{batch_id}", response_model=schemas.BatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    row = db.query(models.AcceptanceBatch).filter(
        models.AcceptanceBatch.id == batch_id
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    return services.to_batch_response(row)


@app.post("/batches/{batch_id}/confirm", response_model=schemas.BatchResponse)
def confirm_batch(batch_id: int, req: schemas.ConfirmRequest, db: Session = Depends(get_db)):
    row = db.query(models.AcceptanceBatch).filter(
        models.AcceptanceBatch.id == batch_id
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    if row.status not in (TaskStatus.MANUAL_CONFIRM, TaskStatus.FAILED):
        raise HTTPException(
            status_code=400,
            detail=f"当前状态 {row.status.value} 不允许人工确认",
        )
    if req.conclusion == Conclusion.PENDING or req.conclusion == Conclusion.PENDING_EVIDENCE:
        new_status = TaskStatus.FAILED if req.conclusion == Conclusion.PENDING_EVIDENCE else TaskStatus.MANUAL_CONFIRM
    else:
        new_status = TaskStatus.MANUAL_CONFIRM
    services.update_conclusion(
        db, row, operator=req.operator, reason=req.reason,
        new_status=new_status, new_conclusion=req.conclusion,
    )
    db.commit()
    db.refresh(row)
    return services.to_batch_response(row)


@app.post("/batches/{batch_id}/rework", response_model=schemas.BatchResponse)
def mark_rework(batch_id: int, req: schemas.ReworkRequest, db: Session = Depends(get_db)):
    row = db.query(models.AcceptanceBatch).filter(
        models.AcceptanceBatch.id == batch_id
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    services.update_conclusion(
        db, row, operator=req.operator, reason=req.reason,
        new_status=TaskStatus.MANUAL_CONFIRM,
        new_conclusion=Conclusion.REWORK_REQUIRED,
    )
    db.commit()
    db.refresh(row)
    return services.to_batch_response(row)


@app.post("/batches/{batch_id}/export")
def export_batch(batch_id: int, req: schemas.ExportRequest, db: Session = Depends(get_db)):
    row = db.query(models.AcceptanceBatch).filter(
        models.AcceptanceBatch.id == batch_id
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    if row.conclusion in (Conclusion.PENDING, Conclusion.PENDING_EVIDENCE):
        raise HTTPException(status_code=400, detail="结论未确定，不能导出")
    path = report_module.export_report(db, row, req.operator)
    db.commit()
    return {"batch_id": batch_id, "report_path": path}


@app.get("/batches/{batch_id}/report")
def download_report(batch_id: int, db: Session = Depends(get_db)):
    record = db.query(models.ExportRecord).filter(
        models.ExportRecord.batch_id == batch_id
    ).order_by(models.ExportRecord.created_at.desc()).first()
    if record is None:
        raise HTTPException(status_code=404, detail="尚未生成报告，请先调用 /export")
    if not os.path.exists(record.report_path):
        raise HTTPException(status_code=404, detail="报告文件已丢失")
    return FileResponse(
        path=record.report_path,
        filename=os.path.basename(record.report_path),
        media_type="text/csv",
    )


@app.get("/audits", response_model=List[schemas.AuditResponse])
def list_audits(batch_id: Optional[int] = None, db: Session = Depends(get_db)):
    return services.list_audits(db, batch_id=batch_id)


@app.get("/rework-stats", response_model=List[schemas.ReworkStatResponse])
def rework_stats(db: Session = Depends(get_db)):
    return services.rework_stats(db)


@app.get("/raw/{batch_id}")
def get_raw_payload(batch_id: int, db: Session = Depends(get_db)):
    row = db.query(models.AcceptanceBatch).filter(
        models.AcceptanceBatch.id == batch_id
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    import json
    return {
        "batch_id": batch_id,
        "batch_no": row.batch_no,
        "payload_hash": row.payload_hash,
        "raw": json.loads(row.raw_payload),
    }
