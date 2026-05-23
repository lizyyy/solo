from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_active_user, allow_data_entry, allow_supervisor
from app.models import User, ChargingPile
from app.schemas import ChargingPileCreate, ChargingPileUpdate, ChargingPile as ChargingPileSchema

router = APIRouter()


@router.post("/", response_model=ChargingPileSchema, dependencies=[Depends(allow_data_entry)])
def create_pile(
    pile: ChargingPileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_pile = db.query(ChargingPile).filter(ChargingPile.pile_code == pile.pile_code).first()
    if db_pile:
        raise HTTPException(status_code=400, detail="充电桩编号已存在")
    
    db_pile = ChargingPile(**pile.model_dump())
    db.add(db_pile)
    db.commit()
    db.refresh(db_pile)
    return db_pile


@router.get("/", response_model=list[ChargingPileSchema])
def list_piles(
    skip: int = 0,
    limit: int = 100,
    area: Optional[str] = None,
    is_online: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(ChargingPile)
    if area:
        query = query.filter(ChargingPile.area == area)
    if is_online is not None:
        query = query.filter(ChargingPile.is_online == is_online)
    
    piles = query.offset(skip).limit(limit).all()
    return piles


@router.get("/{pile_id}", response_model=ChargingPileSchema)
def get_pile(
    pile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    pile = db.query(ChargingPile).filter(ChargingPile.id == pile_id).first()
    if not pile:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    return pile


@router.put("/{pile_id}", response_model=ChargingPileSchema, dependencies=[Depends(allow_data_entry)])
def update_pile(
    pile_id: int,
    pile_update: ChargingPileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_pile = db.query(ChargingPile).filter(ChargingPile.id == pile_id).first()
    if not db_pile:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    
    for field, value in pile_update.model_dump(exclude_unset=True).items():
        setattr(db_pile, field, value)
    
    db.commit()
    db.refresh(db_pile)
    return db_pile


@router.delete("/{pile_id}", dependencies=[Depends(allow_supervisor)])
def delete_pile(
    pile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_pile = db.query(ChargingPile).filter(ChargingPile.id == pile_id).first()
    if not db_pile:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    
    db.delete(db_pile)
    db.commit()
    return {"success": True, "message": "删除成功"}
