from fastapi import APIRouter, Depends, Query, Header
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.models.models import FaultStatus
from app.schemas.schemas import FaultCreate, FaultUpdate, FaultResponse
from app.services.fault_service import FaultService
from app.utils.exceptions import BusinessException, handle_business_exception
from app.utils.idempotent import IdempotentManager

router = APIRouter(prefix="/api/faults", tags=["Faults"])


@router.post("", response_model=FaultResponse, status_code=201)
def create_fault(
    fault_data: FaultCreate,
    idempotent_key: Optional[str] = Header(None),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = FaultService(db)
    
    if idempotent_key:
        idempotent_mgr = IdempotentManager(db)
        existing = idempotent_mgr.check_and_get(idempotent_key, "create_fault")
        if existing:
            return service.get_fault(existing.resource_id)
        
        try:
            fault = service.create_fault(fault_data, operator)
            idempotent_mgr.record(idempotent_key, "create_fault", fault.id)
            return fault
        except BusinessException as e:
            raise handle_business_exception(e)
    
    try:
        return service.create_fault(fault_data, operator)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.get("", response_model=List[FaultResponse])
def list_faults(
    status: Optional[FaultStatus] = Query(None),
    machine_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = FaultService(db)
    return service.list_faults(status, machine_id)


@router.get("/{fault_id}", response_model=FaultResponse)
def get_fault(fault_id: str, db: Session = Depends(get_db)):
    service = FaultService(db)
    try:
        return service.get_fault(fault_id)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.patch("/{fault_id}", response_model=FaultResponse)
def update_fault(
    fault_id: str,
    update_data: FaultUpdate,
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = FaultService(db)
    try:
        return service.update_fault(fault_id, update_data, operator)
    except BusinessException as e:
        raise handle_business_exception(e)


@router.post("/{fault_id}/resolve", response_model=FaultResponse)
def resolve_fault(
    fault_id: str,
    resolution_notes: str = Query(...),
    operator: str = Query("system"),
    db: Session = Depends(get_db)
):
    service = FaultService(db)
    try:
        return service.resolve_fault(fault_id, resolution_notes, operator)
    except BusinessException as e:
        raise handle_business_exception(e)
