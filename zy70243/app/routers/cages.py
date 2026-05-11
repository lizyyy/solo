from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Cage, Pet, MedicalOrder
from app.schemas import Cage as CageSchema, CageCreate, CageUpdate
from app.rules_engine import CageRulesEngine

router = APIRouter()


@router.post("/", response_model=CageSchema, status_code=status.HTTP_201_CREATED)
def create_cage(cage: CageCreate, db: Session = Depends(get_db)):
    existing_cage = db.query(Cage).filter(Cage.cage_number == cage.cage_number).first()
    if existing_cage:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"笼位编号 {cage.cage_number} 已存在"
        )
    
    db_cage = Cage(**cage.model_dump())
    db.add(db_cage)
    db.commit()
    db.refresh(db_cage)
    return db_cage


@router.get("/", response_model=List[CageSchema])
def get_cages(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    is_isolation: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Cage)
    
    if status:
        query = query.filter(Cage.status == status)
    
    if is_isolation is not None:
        query = query.filter(Cage.is_isolation == is_isolation)
    
    return query.offset(skip).limit(limit).all()


@router.get("/{cage_id}", response_model=CageSchema)
def get_cage(cage_id: int, db: Session = Depends(get_db)):
    cage = db.query(Cage).filter(Cage.id == cage_id).first()
    if not cage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"笼位ID {cage_id} 不存在"
        )
    return cage


@router.get("/suitable/{pet_id}/{medical_order_id}")
def get_suitable_cages(
    pet_id: int,
    medical_order_id: int,
    db: Session = Depends(get_db)
):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"宠物ID {pet_id} 不存在"
        )
    
    medical_order = db.query(MedicalOrder).filter(MedicalOrder.id == medical_order_id).first()
    if not medical_order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院医嘱ID {medical_order_id} 不存在"
        )
    
    if medical_order.pet_id != pet_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"住院医嘱不属于该宠物"
        )
    
    all_cages = db.query(Cage).all()
    suitable_cages = CageRulesEngine.find_suitable_cages(all_cages, pet, medical_order)
    
    return {
        "total_available": len(suitable_cages),
        "pet_info": {
            "id": pet.id,
            "name": pet.name,
            "species": pet.species.value
        },
        "medical_order_info": {
            "id": medical_order.id,
            "diagnosis": medical_order.diagnosis,
            "infection_risk": medical_order.infection_risk.value
        },
        "recommended_cages": [
            {
                "id": item["cage"].id,
                "cage_number": item["cage"].cage_number,
                "location": item["cage"].location,
                "is_isolation": item["cage"].is_isolation,
                "compatibility_score": item["compatibility_score"],
                "warnings": item["warnings"]
            }
            for item in suitable_cages
        ]
    }


@router.put("/{cage_id}", response_model=CageSchema)
def update_cage(cage_id: int, cage_update: CageUpdate, db: Session = Depends(get_db)):
    cage = db.query(Cage).filter(Cage.id == cage_id).first()
    if not cage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"笼位ID {cage_id} 不存在"
        )
    
    update_data = cage_update.model_dump(exclude_unset=True)
    
    if "cage_number" in update_data:
        existing = db.query(Cage).filter(
            Cage.cage_number == update_data["cage_number"],
            Cage.id != cage_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"笼位编号 {update_data['cage_number']} 已存在"
            )
    
    for key, value in update_data.items():
        setattr(cage, key, value)
    
    db.commit()
    db.refresh(cage)
    return cage


@router.delete("/{cage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cage(cage_id: int, db: Session = Depends(get_db)):
    cage = db.query(Cage).filter(Cage.id == cage_id).first()
    if not cage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"笼位ID {cage_id} 不存在"
        )
    
    if cage.current_pet_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"笼位 {cage.cage_number} 当前有宠物入住，无法删除"
        )
    
    db.delete(cage)
    db.commit()
