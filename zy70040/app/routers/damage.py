from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import schemas, services

router = APIRouter(prefix="/damage-records", tags=["损坏扣减"])


@router.post("", response_model=schemas.DamageRecordResponse)
def record_damage(
    data: schemas.DamageRecordCreate,
    db: Session = Depends(get_db),
):
    try:
        return services.record_damage(db, data.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[schemas.DamageRecordResponse])
def list_damage_records(
    deposit_order_id: int = None,
    is_reversed: bool = None,
    db: Session = Depends(get_db),
):
    return services.get_damage_records(db, deposit_order_id=deposit_order_id, is_reversed=is_reversed)


@router.post("/{damage_id}/reverse", response_model=schemas.DamageRecordResponse)
def reverse_damage(
    damage_id: int,
    data: schemas.ReverseOperation,
    db: Session = Depends(get_db),
):
    try:
        return services.reverse_damage_record(
            db, damage_id, data.reason, data.operator_id, data.operator_name
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
