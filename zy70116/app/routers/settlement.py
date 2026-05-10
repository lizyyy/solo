from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.settlement import StoreSettlement
from ..schemas import SettlementCreate, SettlementResponse
from ..services.settlement_service import SettlementService

router = APIRouter(prefix="/api/settlements", tags=["settlements"])


@router.post("", response_model=SettlementResponse)
def create_settlement(data: SettlementCreate, db: Session = Depends(get_db)):
    try:
        settlement = SettlementService.calculate_store_settlement(
            db=db,
            store_id=data.store_id,
            settlement_period=data.settlement_period,
            operator=data.operator
        )
        db.commit()
        db.refresh(settlement)
        return settlement
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[SettlementResponse])
def list_settlements(store_id: int = None, db: Session = Depends(get_db)):
    query = db.query(StoreSettlement)
    if store_id:
        query = query.filter(StoreSettlement.store_id == store_id)
    return query.order_by(StoreSettlement.id.desc()).all()


@router.get("/{settlement_id}", response_model=SettlementResponse)
def get_settlement(settlement_id: int, db: Session = Depends(get_db)):
    settlement = db.query(StoreSettlement).filter(StoreSettlement.id == settlement_id).first()
    if not settlement:
        raise HTTPException(status_code=404, detail="结算单不存在")
    return settlement
