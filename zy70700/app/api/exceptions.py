from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import ExceptionStatus
from app.schemas import (
    ExceptionRecord,
    ExceptionRecordCreate,
    ExceptionRecordUpdate,
    ExceptionReviewRequest,
)
from app.services import ExceptionService

router = APIRouter(prefix="/exceptions", tags=["exceptions"])


@router.post("/", response_model=ExceptionRecord)
def create_exception(
    exception: ExceptionRecordCreate, db: Session = Depends(get_db)
):
    return ExceptionService.create_exception(db, exception)


@router.get("/", response_model=List[ExceptionRecord])
def get_exceptions(
    status: Optional[ExceptionStatus] = None,
    batch_id: Optional[int] = None,
    tool_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    if batch_id:
        return ExceptionService.get_exceptions_by_batch(db, batch_id)
    if tool_id:
        return ExceptionService.get_exceptions_by_tool(db, tool_id)
    return ExceptionService.get_all_exceptions(db, status)


@router.get("/{exception_id}", response_model=ExceptionRecord)
def get_exception(exception_id: int, db: Session = Depends(get_db)):
    exception = ExceptionService.get_exception(db, exception_id)
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exception


@router.put("/{exception_id}", response_model=ExceptionRecord)
def update_exception(
    exception_id: int,
    exception_update: ExceptionRecordUpdate,
    db: Session = Depends(get_db),
):
    exception = ExceptionService.update_exception(
        db, exception_id, exception_update
    )
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exception


@router.post("/{exception_id}/review", response_model=ExceptionRecord)
def review_exception(
    exception_id: int,
    request: ExceptionReviewRequest,
    db: Session = Depends(get_db),
):
    exception = ExceptionService.review_exception(
        db,
        exception_id,
        request.status,
        request.handler,
        request.handling_conclusion,
        request.handling_notes,
    )
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exception


@router.post("/{exception_id}/resolve", response_model=ExceptionRecord)
def resolve_exception(
    exception_id: int,
    request: ExceptionReviewRequest,
    db: Session = Depends(get_db),
):
    exception = ExceptionService.resolve_exception(
        db,
        exception_id,
        request.handler,
        request.handling_conclusion,
        request.handling_notes,
    )
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exception


@router.post("/{exception_id}/dismiss", response_model=ExceptionRecord)
def dismiss_exception(
    exception_id: int,
    request: ExceptionReviewRequest,
    db: Session = Depends(get_db),
):
    exception = ExceptionService.dismiss_exception(
        db,
        exception_id,
        request.handler,
        request.handling_conclusion,
        request.handling_notes,
    )
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exception
