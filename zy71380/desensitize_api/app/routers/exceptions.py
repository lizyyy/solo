from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models import ExceptionCreate, ExceptionUpdate, ExceptionResponse
from app.engine import exception_manager

router = APIRouter(prefix="/api/exceptions", tags=["exceptions"])


@router.post("", response_model=ExceptionResponse)
def create_exception(body: ExceptionCreate):
    data = body.model_dump()
    exc = exception_manager.create_exception(data)
    return exc


@router.get("", response_model=list[ExceptionResponse])
def list_exceptions(status: Optional[str] = Query(default=None)):
    return exception_manager.list_exceptions(status)


@router.get("/expired", response_model=list[ExceptionResponse])
def list_expired():
    return exception_manager.list_exceptions(status_filter="expired")


@router.get("/{exc_id}", response_model=ExceptionResponse)
def get_exception(exc_id: int):
    exc = exception_manager.get_exception(exc_id)
    if not exc:
        raise HTTPException(status_code=404, detail=f"Exception {exc_id} not found")
    return exc


@router.put("/{exc_id}", response_model=ExceptionResponse)
def update_exception(exc_id: int, body: ExceptionUpdate):
    data = body.model_dump(exclude_none=True)
    exc = exception_manager.update_exception(exc_id, data)
    if not exc:
        raise HTTPException(status_code=404, detail=f"Exception {exc_id} not found")
    return exc


@router.post("/{exc_id}/check", response_model=ExceptionResponse)
def check_exception_status(exc_id: int):
    exc = exception_manager.check_exception_status(exc_id)
    if not exc:
        raise HTTPException(status_code=404, detail=f"Exception {exc_id} not found")
    return exc
