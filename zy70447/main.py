from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db, engine
import models
from schemas import (
    BatchProcessRequest, BatchProcessResult,
    TaskBatchResponse, WatermarkRecordResponse,
    FailedItemResponse, RollbackCandidateResponse,
    ManualCorrectionCreate, ManualCorrectionResponse,
    ProcessReportResponse
)
from services import WatermarkBatchService, RollbackService, ManualCorrectionService

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="任务批次水印服务", version="1.0.0")


@app.post("/api/batch/process", response_model=BatchProcessResult, summary="处理批次水印")
def process_batch(request: BatchProcessRequest, db: Session = Depends(get_db)):
    service = WatermarkBatchService(db)
    try:
        result = service.process_batch(request)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/batch/{batch_id}", response_model=TaskBatchResponse, summary="获取批次信息")
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(models.TaskBatch).filter(models.TaskBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.get("/api/batch/{batch_id}/records", response_model=List[WatermarkRecordResponse], summary="获取批次所有记录")
def get_batch_records(batch_id: int, db: Session = Depends(get_db)):
    records = db.query(models.WatermarkRecord).filter(models.WatermarkRecord.batch_id == batch_id).all()
    return records


@app.get("/api/batch/{batch_id}/failed", response_model=List[FailedItemResponse], summary="获取批次失败项")
def get_batch_failed_items(batch_id: int, db: Session = Depends(get_db)):
    items = db.query(models.FailedItem).filter(models.FailedItem.batch_id == batch_id).all()
    return items


@app.post("/api/batch/{batch_id}/rollback/candidates", response_model=List[RollbackCandidateResponse], summary="生成回滚候选清单")
def generate_rollback_candidates(batch_id: int, operation_type: str, created_by: str, db: Session = Depends(get_db)):
    service = RollbackService(db)
    try:
        candidates = service.generate_candidate_list(batch_id, operation_type, created_by)
        return candidates
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/batch/{batch_id}/rollback/candidates", response_model=List[RollbackCandidateResponse], summary="获取回滚候选清单")
def get_rollback_candidates(batch_id: int, db: Session = Depends(get_db)):
    candidates = db.query(models.RollbackCandidate).filter(models.RollbackCandidate.batch_id == batch_id).all()
    return candidates


@app.post("/api/rollback/candidates/{candidate_id}/approve", response_model=RollbackCandidateResponse, summary="审批回滚候选")
def approve_rollback_candidate(candidate_id: int, approved_by: str, approve: bool = True, db: Session = Depends(get_db)):
    service = RollbackService(db)
    try:
        candidate = service.approve_candidate(candidate_id, approved_by, approve)
        return candidate
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/rollback/candidates/{candidate_id}/execute", response_model=RollbackCandidateResponse, summary="执行回滚")
def execute_rollback(candidate_id: int, db: Session = Depends(get_db)):
    service = RollbackService(db)
    try:
        candidate = service.execute_rollback(candidate_id)
        return candidate
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/correction", response_model=ManualCorrectionResponse, summary="创建人工修正备注")
def create_manual_correction(request: ManualCorrectionCreate, db: Session = Depends(get_db)):
    service = ManualCorrectionService(db)
    correction = service.create_correction(request)
    return correction


@app.get("/api/correction/ticket/{ticket_id}", response_model=List[ManualCorrectionResponse], summary="根据工单号查询修正记录")
def get_correction_by_ticket(ticket_id: str, db: Session = Depends(get_db)):
    service = ManualCorrectionService(db)
    corrections = service.get_correction_by_ticket(ticket_id)
    return corrections


@app.get("/api/batch/{batch_id}/report", response_model=ProcessReportResponse, summary="获取批次处理报告")
def get_batch_report(batch_id: int, db: Session = Depends(get_db)):
    report = db.query(models.ProcessReport).filter(models.ProcessReport.batch_id == batch_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return report


@app.get("/api/batches", response_model=List[TaskBatchResponse], summary="获取所有批次列表")
def list_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = db.query(models.TaskBatch).offset(skip).limit(limit).all()
    return batches


@app.get("/api/health", summary="健康检查")
def health_check():
    return {"status": "ok", "service": "任务批次水印服务"}
