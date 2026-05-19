from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import ChargingPile
from app.schemas import ChargingPileCreate, ChargingPile as ChargingPileSchema

router = APIRouter(prefix="/charging-piles", tags=["充电桩管理"])


@router.post("/", response_model=ChargingPileSchema, summary="创建充电桩")
def create_charging_pile(pile: ChargingPileCreate, db: Session = Depends(get_db)):
    db_pile = db.query(ChargingPile).filter(ChargingPile.name == pile.name).first()
    if db_pile:
        raise HTTPException(status_code=400, detail="充电桩名称已存在")
    db_pile = ChargingPile(**pile.dict())
    db.add(db_pile)
    db.commit()
    db.refresh(db_pile)
    return db_pile


@router.get("/", response_model=List[ChargingPileSchema], summary="获取所有充电桩")
def get_charging_piles(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ChargingPile).offset(skip).limit(limit).all()


@router.get("/{pile_id}", response_model=ChargingPileSchema, summary="获取单个充电桩")
def get_charging_pile(pile_id: int, db: Session = Depends(get_db)):
    db_pile = db.query(ChargingPile).filter(ChargingPile.id == pile_id).first()
    if not db_pile:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    return db_pile


@router.put("/{pile_id}", response_model=ChargingPileSchema, summary="更新充电桩信息")
def update_charging_pile(pile_id: int, pile: ChargingPileCreate, db: Session = Depends(get_db)):
    db_pile = db.query(ChargingPile).filter(ChargingPile.id == pile_id).first()
    if not db_pile:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    
    for key, value in pile.dict().items():
        setattr(db_pile, key, value)
    
    db.commit()
    db.refresh(db_pile)
    return db_pile


@router.delete("/{pile_id}", summary="删除充电桩")
def delete_charging_pile(pile_id: int, db: Session = Depends(get_db)):
    db_pile = db.query(ChargingPile).filter(ChargingPile.id == pile_id).first()
    if not db_pile:
        raise HTTPException(status_code=404, detail="充电桩不存在")
    
    db.delete(db_pile)
    db.commit()
    return {"message": "删除成功"}
