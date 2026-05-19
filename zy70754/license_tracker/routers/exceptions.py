from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..database import get_db, LicenseException, ExceptionStatus
from ..schemas import (
    LicenseException as SchemaLicenseException,
    LicenseExceptionCreate,
    LicenseExceptionUpdate,
    ExpiringExceptionAlert,
    ErrorCode,
    ErrorResponse,
    LicenseExceptionNotFound,
    InvalidStatusTransition,
    NeedsManualReview,
    AlreadyProcessed,
    MissingField,
)
from ..services import ExceptionService

router = APIRouter()


@router.post("/", response_model=SchemaLicenseException)
async def create_exception(
    exception: LicenseExceptionCreate,
    db: Session = Depends(get_db)
):
    return ExceptionService.create_exception(db, exception)


@router.get("/", response_model=List[SchemaLicenseException])
async def list_exceptions(
    status: Optional[ExceptionStatus] = None,
    dependency_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(LicenseException)
    if status:
        query = query.filter(LicenseException.status == status)
    if dependency_name:
        query = query.filter(LicenseException.dependency_name.contains(dependency_name))
    return query.offset(skip).limit(limit).all()


@router.get("/expiring", response_model=List[ExpiringExceptionAlert])
async def get_expiring_exceptions(
    days: int = 30,
    db: Session = Depends(get_db)
):
    exceptions = ExceptionService.get_expiring_exceptions(db, days)
    alerts = []
    now = datetime.utcnow()
    for exc in exceptions:
        days_until = (exc.expires_at - now).days
        alerts.append(ExpiringExceptionAlert(
            exception_id=exc.id,
            dependency_name=exc.dependency_name,
            license_name=exc.license_name,
            expires_at=exc.expires_at,
            days_until_expiry=days_until,
            status=exc.status
        ))
    return alerts


@router.get("/{exception_id}", response_model=SchemaLicenseException)
async def get_exception(exception_id: int, db: Session = Depends(get_db)):
    exc = db.query(LicenseException).filter(LicenseException.id == exception_id).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exc


@router.put("/{exception_id}", response_model=SchemaLicenseException)
async def update_exception(
    exception_id: int,
    update: LicenseExceptionUpdate,
    reviewer: str,
    db: Session = Depends(get_db)
):
    return ExceptionService.update_exception_status(db, exception_id, update, reviewer)


@router.post("/mark-expired")
async def mark_expired_exceptions(db: Session = Depends(get_db)):
    count = ExceptionService.mark_expired_exceptions(db)
    return {"success": True, "marked_expired": count}


@router.delete("/{exception_id}")
async def delete_exception(exception_id: int, db: Session = Depends(get_db)):
    exc = db.query(LicenseException).filter(LicenseException.id == exception_id).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")
    db.delete(exc)
    db.commit()
    return {"success": True}
