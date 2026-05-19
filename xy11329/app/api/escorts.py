from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import EscortCreate, Escort as EscortSchema
from app.services import EscortService

router = APIRouter(prefix="/escorts", tags=["escorts"])


@router.post("/", response_model=EscortSchema)
def create_escort(escort_data: EscortCreate, db: Session = Depends(get_db)):
    service = EscortService(db)
    escort, status = service.create_escort(
        name=escort_data.name,
        phone=escort_data.phone,
        employee_id=escort_data.employee_id,
    )
    if status == "duplicate":
        raise HTTPException(status_code=400, detail="Escort with this employee ID already exists")
    return escort


@router.get("/{escort_id}", response_model=EscortSchema)
def get_escort(escort_id: int, db: Session = Depends(get_db)):
    service = EscortService(db)
    escort = service.get_escort(escort_id)
    if not escort:
        raise HTTPException(status_code=404, detail="Escort not found")
    return escort


@router.get("/", response_model=List[EscortSchema])
def list_escorts(active_only: bool = True, db: Session = Depends(get_db)):
    service = EscortService(db)
    return service.list_escorts(active_only=active_only)


@router.put("/{escort_id}", response_model=EscortSchema)
def update_escort(
    escort_id: int,
    escort_data: EscortCreate,
    db: Session = Depends(get_db),
):
    service = EscortService(db)
    escort, status = service.update_escort(
        escort_id=escort_id,
        name=escort_data.name,
        phone=escort_data.phone,
    )
    if not escort:
        raise HTTPException(status_code=404, detail="Escort not found")
    return escort


@router.post("/{escort_id}/deactivate", response_model=EscortSchema)
def deactivate_escort(escort_id: int, db: Session = Depends(get_db)):
    service = EscortService(db)
    escort, status = service.deactivate_escort(escort_id)
    if not escort:
        raise HTTPException(status_code=404, detail="Escort not found")
    return escort


@router.post("/{escort_id}/activate", response_model=EscortSchema)
def activate_escort(escort_id: int, db: Session = Depends(get_db)):
    service = EscortService(db)
    escort, status = service.activate_escort(escort_id)
    if not escort:
        raise HTTPException(status_code=404, detail="Escort not found")
    return escort
