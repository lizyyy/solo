from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Pet
from app.schemas import Pet as PetSchema, PetCreate, PetUpdate

router = APIRouter()


@router.post("/", response_model=PetSchema, status_code=status.HTTP_201_CREATED)
def create_pet(pet: PetCreate, db: Session = Depends(get_db)):
    existing_pet = db.query(Pet).filter(
        Pet.name == pet.name,
        Pet.owner_phone == pet.owner_phone
    ).first()
    
    if existing_pet:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"同名宠物已存在于主人 {pet.owner_name} 的记录中，请检查是否重复录入"
        )
    
    db_pet = Pet(**pet.model_dump())
    db.add(db_pet)
    db.commit()
    db.refresh(db_pet)
    return db_pet


@router.get("/", response_model=List[PetSchema])
def get_pets(
    skip: int = 0,
    limit: int = 100,
    species: Optional[str] = None,
    owner_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Pet)
    
    if species:
        query = query.filter(Pet.species == species)
    
    if owner_name:
        query = query.filter(Pet.owner_name.ilike(f"%{owner_name}%"))
    
    return query.offset(skip).limit(limit).all()


@router.get("/{pet_id}", response_model=PetSchema)
def get_pet(pet_id: int, db: Session = Depends(get_db)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"宠物ID {pet_id} 不存在"
        )
    return pet


@router.put("/{pet_id}", response_model=PetSchema)
def update_pet(pet_id: int, pet_update: PetUpdate, db: Session = Depends(get_db)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"宠物ID {pet_id} 不存在"
        )
    
    update_data = pet_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pet, key, value)
    
    db.commit()
    db.refresh(pet)
    return pet


@router.delete("/{pet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pet(pet_id: int, db: Session = Depends(get_db)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"宠物ID {pet_id} 不存在"
        )
    
    if pet.hospitalizations:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"该宠物有关联的住院记录，无法删除"
        )
    
    db.delete(pet)
    db.commit()
