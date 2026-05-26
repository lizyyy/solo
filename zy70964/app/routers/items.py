from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    MarkProcessedRequest,
    ReturnRequest,
    SecondReviewRequest,
    ApproveRequest,
    RejectRequest,
    CancelDeductionRequest,
    ScoreWritebackRequest,
    QueryRequest,
    QueryResponse,
    QCItemBrief,
    QCItemTrace,
    QCEventBrief,
    AppealBrief,
    Message,
)
from app import services

router = APIRouter(prefix="/api/v1/items", tags=["items"])


@router.post("/query", response_model=QueryResponse)
def query_items(req: QueryRequest, db: Session = Depends(get_db)):
    total = services.count_items(db, req)
    items = services.query_items(db, req)
    return QueryResponse(total=total, items=[QCItemBrief.model_validate(i) for i in items])


@router.get("/{item_id}", response_model=QCItemBrief)
def get_item(item_id: int, db: Session = Depends(get_db)):
    try:
        data = services.get_item_trace(db, item_id)
        return QCItemBrief.model_validate(data["item"])
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{item_id}/trace", response_model=QCItemTrace)
def get_item_trace(item_id: int, db: Session = Depends(get_db)):
    try:
        data = services.get_item_trace(db, item_id)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return QCItemTrace(
        item=data["item"],
        events=[QCEventBrief.model_validate(e) for e in data["events"]],
        appeals=[AppealBrief.model_validate(a) for a in data["appeals"]],
    )


def _run(action, db, item_id, req) -> QCItemBrief:
    try:
        item = action(db, item_id, req)
        db.commit()
        return QCItemBrief.model_validate(item)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{item_id}/mark-processing", response_model=QCItemBrief)
def mark_processing(item_id: int, req: MarkProcessedRequest, db: Session = Depends(get_db)):
    return _run(services.mark_processing, db, item_id, req)


@router.post("/{item_id}/return", response_model=QCItemBrief)
def return_item(item_id: int, req: ReturnRequest, db: Session = Depends(get_db)):
    return _run(services.return_item, db, item_id, req)


@router.post("/{item_id}/second-review", response_model=QCItemBrief)
def second_review(item_id: int, req: SecondReviewRequest, db: Session = Depends(get_db)):
    return _run(services.second_review, db, item_id, req)


@router.post("/{item_id}/approve", response_model=QCItemBrief)
def approve_item(item_id: int, req: ApproveRequest, db: Session = Depends(get_db)):
    return _run(services.approve_item, db, item_id, req)


@router.post("/{item_id}/reject", response_model=QCItemBrief)
def reject_item(item_id: int, req: RejectRequest, db: Session = Depends(get_db)):
    return _run(services.reject_item, db, item_id, req)


@router.post("/{item_id}/cancel-deduction", response_model=QCItemBrief)
def cancel_deduction(item_id: int, req: CancelDeductionRequest, db: Session = Depends(get_db)):
    return _run(services.cancel_deduction, db, item_id, req)


@router.post("/{item_id}/score-writeback", response_model=QCItemBrief)
def score_writeback(item_id: int, req: ScoreWritebackRequest, db: Session = Depends(get_db)):
    return _run(services.score_writeback, db, item_id, req)
