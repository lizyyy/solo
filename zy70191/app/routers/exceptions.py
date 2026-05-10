from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ExceptionType
from app.schemas import ExceptionRecord, ExceptionRecordCreate
from app.services.exception_service import ExceptionService

router = APIRouter(prefix="/api/exceptions", tags=["异常记录"])


@router.post("", response_model=ExceptionRecord, status_code=status.HTTP_201_CREATED)
def record_exception(
    exception_data: ExceptionRecordCreate,
    db: Session = Depends(get_db)
):
    service = ExceptionService(db)
    return service.record_exception(
        exception_type=exception_data.exception_type,
        description=exception_data.description,
        detail=exception_data.detail,
        switch_request_id=exception_data.switch_request_id
    )


@router.get("", response_model=List[ExceptionRecord])
def list_exceptions(
    is_resolved: Optional[bool] = Query(None, description="是否已解决"),
    exception_type: Optional[ExceptionType] = Query(None, description="异常类型"),
    db: Session = Depends(get_db)
):
    service = ExceptionService(db)
    return service.get_all_exceptions(is_resolved, exception_type)


@router.get("/pending", response_model=List[ExceptionRecord])
def list_pending_exceptions(db: Session = Depends(get_db)):
    service = ExceptionService(db)
    return service.get_pending_exceptions()


@router.get("/{exception_id}", response_model=ExceptionRecord)
def get_exception(exception_id: int, db: Session = Depends(get_db)):
    service = ExceptionService(db)
    exception = service.get_exception(exception_id)
    if not exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="异常记录不存在"
        )
    return exception


@router.post("/{exception_id}/resolve", response_model=ExceptionRecord)
def resolve_exception(
    exception_id: int,
    resolved_by: str = Query(..., description="处理人"),
    resolution_detail: Optional[str] = Query(None, description="处理说明"),
    db: Session = Depends(get_db)
):
    service = ExceptionService(db)
    exception = service.resolve_exception(exception_id, resolved_by, resolution_detail)
    if not exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="异常记录不存在"
        )
    return exception


@router.get("/switch-request/{switch_request_id}", response_model=List[ExceptionRecord])
def list_exceptions_by_request(switch_request_id: int, db: Session = Depends(get_db)):
    service = ExceptionService(db)
    return service.get_exceptions_by_request(switch_request_id)


@router.get("/statistics")
def get_exception_statistics(db: Session = Depends(get_db)):
    service = ExceptionService(db)
    return service.get_exception_statistics()
