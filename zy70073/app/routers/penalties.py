from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.schemas import PenaltyRecordResponse
from app.services.penalty_service import PenaltyService

router = APIRouter(prefix="/penalties", tags=["penalties"])


@router.get("", response_model=List[PenaltyRecordResponse])
def list_penalties(
    contract_id: Optional[int] = None,
    unsettled_only: bool = False,
    db: Session = Depends(get_db),
):
    service = PenaltyService(db)
    if unsettled_only:
        return service.get_unsettled_penalties(contract_id)
    if contract_id:
        return service.get_contract_penalties(contract_id)
    return service.get_unsettled_penalties()


@router.post("/process-all")
def process_all_penalties(db: Session = Depends(get_db)):
    service = PenaltyService(db)
    count, amount = service.process_all_penalties()
    return {
        "processed_count": count,
        "total_amount": float(amount),
    }


@router.post("/delivery/{delivery_plan_id}/process")
def process_delivery_penalties(delivery_plan_id: int, db: Session = Depends(get_db)):
    service = PenaltyService(db)
    penalties = service.process_delivery_penalties(delivery_plan_id)
    return {
        "processed_count": len(penalties),
        "total_amount": float(sum(p.penalty_amount for p in penalties)),
    }


@router.post("/{penalty_id}/settle", response_model=PenaltyRecordResponse)
def settle_penalty(penalty_id: int, db: Session = Depends(get_db)):
    service = PenaltyService(db)
    penalty = service.settle_penalty(penalty_id)
    if not penalty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"违约金记录 {penalty_id} 不存在",
        )
    return penalty


@router.post("/contract/{contract_id}/settle-all")
def settle_all_penalties(contract_id: int, db: Session = Depends(get_db)):
    service = PenaltyService(db)
    count = service.settle_all_penalties(contract_id)
    return {"settled_count": count}
