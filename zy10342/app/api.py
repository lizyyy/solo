from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import (
    FaultEvent, FaultEventCreate, FaultEventUpdate,
    Interface, InterfaceCreate, Customer, CustomerCreate,
    Version, VersionCreate, ImpactCalculationResult,
    PublishRequest, StatusUpdateRequest, ResolutionConfirmRequest
)
from app.services import FaultEventService, IdempotencyService
from app.exceptions import APIException
from app.models import FaultStatus

router = APIRouter()

@router.post("/events", response_model=FaultEvent, status_code=201)
async def create_event(
    event_data: FaultEventCreate,
    db: Session = Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None)
):
    try:
        if x_idempotency_key:
            request_hash = IdempotencyService.generate_request_hash(event_data.model_dump(mode='json'))
            cached = IdempotencyService.check_idempotency(db, x_idempotency_key, request_hash)
            if cached:
                return cached
        
        event = FaultEventService.create_event(db, event_data)
        
        if x_idempotency_key:
            request_hash = IdempotencyService.generate_request_hash(event_data.model_dump(mode='json'))
            response_data = FaultEvent.model_validate(event).model_dump(mode='json')
            IdempotencyService.store_idempotency(db, x_idempotency_key, request_hash, response_data)
        
        return event
    except ValueError as e:
        raise APIException(status_code=400, error_code="BAD_REQUEST", message=str(e))

@router.get("/events", response_model=List[FaultEvent])
async def list_events(
    status: Optional[FaultStatus] = None,
    customer_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return FaultEventService.list_events(db, status=status, customer_id=customer_id, skip=skip, limit=limit)

@router.get("/events/{event_id}", response_model=FaultEvent)
async def get_event(event_id: str, db: Session = Depends(get_db)):
    event = FaultEventService.get_event_by_event_id(db, event_id)
    if not event:
        raise APIException(status_code=404, error_code="NOT_FOUND", message=f"Event {event_id} not found")
    return event

@router.get("/events/{event_id}/impact", response_model=ImpactCalculationResult)
async def calculate_impact(event_id: str, db: Session = Depends(get_db)):
    try:
        return FaultEventService.calculate_impact(db, event_id)
    except ValueError as e:
        raise APIException(status_code=404, error_code="NOT_FOUND", message=str(e))

@router.post("/events/{event_id}/publish", response_model=FaultEvent)
async def publish_event(event_id: str, publish_data: PublishRequest, db: Session = Depends(get_db)):
    try:
        return FaultEventService.publish_event(db, event_id, publish_data)
    except ValueError as e:
        raise APIException(status_code=400, error_code="BAD_REQUEST", message=str(e))

@router.patch("/events/{event_id}/status", response_model=FaultEvent)
async def update_status(event_id: str, status_data: StatusUpdateRequest, db: Session = Depends(get_db)):
    try:
        return FaultEventService.update_status(db, event_id, status_data)
    except ValueError as e:
        raise APIException(status_code=400, error_code="BAD_REQUEST", message=str(e))

@router.post("/events/{event_id}/versions", response_model=Version, status_code=201)
async def create_version(event_id: str, version_data: VersionCreate, db: Session = Depends(get_db)):
    try:
        return FaultEventService.create_new_version(db, event_id, version_data)
    except ValueError as e:
        raise APIException(status_code=400, error_code="BAD_REQUEST", message=str(e))

@router.post("/events/{event_id}/resolve", response_model=FaultEvent)
async def confirm_resolution(event_id: str, confirm_data: ResolutionConfirmRequest, db: Session = Depends(get_db)):
    try:
        return FaultEventService.confirm_resolution(db, event_id, confirm_data)
    except ValueError as e:
        raise APIException(status_code=400, error_code="BAD_REQUEST", message=str(e))

@router.get("/events/{event_id}/history")
async def get_event_history(event_id: str, db: Session = Depends(get_db)):
    try:
        return FaultEventService.get_event_history(db, event_id)
    except ValueError as e:
        raise APIException(status_code=404, error_code="NOT_FOUND", message=str(e))

@router.post("/events/{event_id}/interfaces", response_model=List[Interface], status_code=201)
async def add_interfaces(event_id: str, interfaces: List[InterfaceCreate], db: Session = Depends(get_db)):
    try:
        return FaultEventService.add_interfaces(db, event_id, interfaces)
    except ValueError as e:
        raise APIException(status_code=400, error_code="BAD_REQUEST", message=str(e))

@router.post("/events/{event_id}/customers", response_model=List[Customer], status_code=201)
async def add_customers(event_id: str, customers: List[CustomerCreate], db: Session = Depends(get_db)):
    try:
        return FaultEventService.add_customers(db, event_id, customers)
    except ValueError as e:
        raise APIException(status_code=400, error_code="BAD_REQUEST", message=str(e))
