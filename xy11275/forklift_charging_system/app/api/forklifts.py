from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Forklift
from app.schemas import ForkliftCreate, Forklift as ForkliftSchema

router = APIRouter(prefix="/forklifts", tags=["叉车管理"])


@router.post("/", response_model=ForkliftSchema, summary="创建叉车")
def create_forklift(forklift: ForkliftCreate, db: Session = Depends(get_db)):
    db_forklift = db.query(Forklift).filter(Forklift.name == forklift.name).first()
    if db_forklift:
        raise HTTPException(status_code=400, detail="叉车名称已存在")
    db_forklift = Forklift(**forklift.dict())
    db.add(db_forklift)
    db.commit()
    db.refresh(db_forklift)
    return db_forklift


@router.get("/", response_model=List[ForkliftSchema], summary="获取所有叉车")
def get_forklifts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Forklift).offset(skip).limit(limit).all()


@router.get("/{forklift_id}", response_model=ForkliftSchema, summary="获取单个叉车")
def get_forklift(forklift_id: int, db: Session = Depends(get_db)):
    db_forklift = db.query(Forklift).filter(Forklift.id == forklift_id).first()
    if not db_forklift:
        raise HTTPException(status_code=404, detail="叉车不存在")
    return db_forklift


@router.put("/{forklift_id}", response_model=ForkliftSchema, summary="更新叉车信息")
def update_forklift(forklift_id: int, forklift: ForkliftCreate, db: Session = Depends(get_db)):
    db_forklift = db.query(Forklift).filter(Forklift.id == forklift_id).first()
    if not db_forklift:
        raise HTTPException(status_code=404, detail="叉车不存在")
    
    for key, value in forklift.dict().items():
        setattr(db_forklift, key, value)
    
    db.commit()
    db.refresh(db_forklift)
    return db_forklift


@router.delete("/{forklift_id}", summary="删除叉车")
def delete_forklift(forklift_id: int, db: Session = Depends(get_db)):
    db_forklift = db.query(Forklift).filter(Forklift.id == forklift_id).first()
    if not db_forklift:
        raise HTTPException(status_code=404, detail="叉车不存在")
    
    db.delete(db_forklift)
    db.commit()
    return {"message": "删除成功"}
