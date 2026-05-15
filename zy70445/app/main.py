from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import engine, get_db, Base
from app.models import (
    Batch, Token, ProcessingRecord, FailedItem, ApprovalItem,
    CandidateList, Report, ProcessingStatus
)
from app.schemas import (
    BatchCreate, BatchResponse, BatchDetailResponse,
    TokenResponse, FailedItemResponse, ProcessingRecordResponse,
    CandidateListCreate, CandidateListResponse,
    ApprovalItemResponse, ReportResponse,
    ReuseResponse, ReviewResponse
)
from app.services import (
    process_batch, create_candidate_list, approve_candidate_list,
    execute_candidate_list, query_batches, generate_report,
    get_batch_review_data, create_approval_item, send_reminder
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Temporary Token Service API", version="1.0.0")


@app.post("/api/batches", response_model=BatchResponse)
def create_batch(batch_create: BatchCreate, db: Session = Depends(get_db)):
    existing_batch = db.query(Batch).filter(Batch.batch_no == batch_create.batch_no).first()
    if existing_batch:
        raise HTTPException(status_code=400, detail="Batch no already exists")

    batch, result_type = process_batch(db, batch_create)

    if result_type == "reused":
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Same content has been processed before",
                "existing_batch_id": batch.id,
                "existing_batch_no": batch.batch_no
            }
        )

    return batch


@app.get("/api/batches/{batch_no}/check-duplicate", response_model=ReuseResponse)
def check_duplicate_batch(batch_no: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.batch_no == batch_no).first()
    if batch:
        return ReuseResponse(
            reused=True,
            message=f"Batch {batch_no} has been processed before",
            existing_batch=batch
        )
    return ReuseResponse(reused=False, message="No duplicate found")


@app.get("/api/batches", response_model=List[BatchResponse])
def list_batches(
    batch_no: Optional[str] = None,
    operator: Optional[str] = None,
    risk_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    return query_batches(db, batch_no, operator, risk_type, status, start_date, end_date)


@app.get("/api/batches/{batch_id}", response_model=BatchDetailResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@app.get("/api/batches/{batch_id}/tokens", response_model=List[TokenResponse])
def get_batch_tokens(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return db.query(Token).filter(Token.batch_id == batch_id).all()


@app.get("/api/failed-items", response_model=List[FailedItemResponse])
def list_failed_items(
    batch_id: Optional[int] = None,
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FailedItem)
    if batch_id:
        query = query.filter(FailedItem.batch_id == batch_id)
    if resolved is not None:
        query = query.filter(FailedItem.resolved == resolved)
    return query.order_by(FailedItem.created_at.desc()).all()


@app.post("/api/failed-items/{item_id}/resolve")
def resolve_failed_item(item_id: int, resolved_by: str, db: Session = Depends(get_db)):
    item = db.query(FailedItem).filter(FailedItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Failed item not found")
    item.resolved = True
    item.resolved_by = resolved_by
    item.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Item resolved successfully"}


@app.get("/api/processing-records", response_model=List[ProcessingRecordResponse])
def list_processing_records(
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ProcessingRecord)
    if batch_id:
        query = query.filter(ProcessingRecord.batch_id == batch_id)
    return query.order_by(ProcessingRecord.created_at.desc()).all()


@app.post("/api/candidate-lists", response_model=CandidateListResponse)
def create_candidate(
    candidate_create: CandidateListCreate,
    created_by: str = Query(...),
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == candidate_create.batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return create_candidate_list(db, candidate_create, created_by)


@app.get("/api/candidate-lists", response_model=List[CandidateListResponse])
def list_candidate_lists(
    batch_id: Optional[int] = None,
    approved: Optional[bool] = None,
    executed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CandidateList)
    if batch_id:
        query = query.filter(CandidateList.batch_id == batch_id)
    if approved is not None:
        query = query.filter(CandidateList.approved == approved)
    if executed is not None:
        query = query.filter(CandidateList.executed == executed)
    return query.order_by(CandidateList.created_at.desc()).all()


@app.post("/api/candidate-lists/{candidate_id}/approve", response_model=CandidateListResponse)
def approve_candidate(candidate_id: int, approved_by: str = Query(...), db: Session = Depends(get_db)):
    candidate = approve_candidate_list(db, candidate_id, approved_by)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate list not found")
    return candidate


@app.post("/api/candidate-lists/{candidate_id}/execute", response_model=CandidateListResponse)
def execute_candidate(candidate_id: int, executed_by: str = Query(...), db: Session = Depends(get_db)):
    candidate = execute_candidate_list(db, candidate_id, executed_by)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate list not found")
    if not candidate.approved:
        raise HTTPException(status_code=400, detail="Candidate list must be approved first")
    return candidate


@app.post("/api/batches/{batch_id}/approval-items", response_model=ApprovalItemResponse)
def create_approval(
    batch_id: int,
    item_key: str = Query(...),
    title: str = Query(...),
    assignee: str = Query(...),
    priority: str = Query("normal"),
    due_days: int = Query(3),
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    content = {"batch_id": batch_id, "item_key": item_key}
    return create_approval_item(db, batch_id, item_key, title, content, assignee, priority, due_days)


@app.get("/api/approval-items", response_model=List[ApprovalItemResponse])
def list_approval_items(
    batch_id: Optional[int] = None,
    assignee: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ApprovalItem)
    if batch_id:
        query = query.filter(ApprovalItem.batch_id == batch_id)
    if assignee:
        query = query.filter(ApprovalItem.assignee == assignee)
    if status:
        query = query.filter(ApprovalItem.status == status)
    return query.order_by(ApprovalItem.created_at.desc()).all()


@app.post("/api/approval-items/{approval_id}/send-reminder", response_model=ApprovalItemResponse)
def send_approval_reminder(approval_id: int, db: Session = Depends(get_db)):
    approval = send_reminder(db, approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval item not found")
    return approval


@app.post("/api/approval-items/{approval_id}/approve", response_model=ApprovalItemResponse)
def approve_item(approval_id: int, approved_by: str = Query(...), db: Session = Depends(get_db)):
    approval = db.query(ApprovalItem).filter(ApprovalItem.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval item not found")
    approval.status = "approved"
    approval.approved_by = approved_by
    approval.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(approval)
    return approval


@app.post("/api/reports/{batch_id}", response_model=ReportResponse)
def create_report(batch_id: int, generated_by: str = Query(...), db: Session = Depends(get_db)):
    try:
        return generate_report(db, batch_id, generated_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/reports", response_model=List[ReportResponse])
def list_reports(batch_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(Report)
    if batch_id:
        query = query.filter(Report.batch_id == batch_id)
    return query.order_by(Report.generated_at.desc()).all()


@app.get("/api/batches/{batch_id}/review", response_model=ReviewResponse)
def get_review_data(batch_id: int, db: Session = Depends(get_db)):
    try:
        return get_batch_review_data(db, batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/tokens/{token_id}", response_model=TokenResponse)
def get_token(token_id: int, db: Session = Depends(get_db)):
    token = db.query(Token).filter(Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    return token


@app.post("/api/tokens/{token_id}/revoke", response_model=TokenResponse)
def revoke_token(token_id: int, db: Session = Depends(get_db)):
    token = db.query(Token).filter(Token.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    token.status = "revoked"
    db.commit()
    db.refresh(token)
    return token


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "temporary-token-service"}
