from datetime import datetime
import random
import string
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import MedicalOrder, Pet, OrderStatus
from app.schemas import MedicalOrder as MedicalOrderSchema, MedicalOrderCreate, MedicalOrderUpdate

router = APIRouter()


def generate_order_number() -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"MO-{timestamp}-{random_suffix}"


@router.post("/", response_model=MedicalOrderSchema, status_code=status.HTTP_201_CREATED)
def create_medical_order(order: MedicalOrderCreate, db: Session = Depends(get_db)):
    pet = db.query(Pet).filter(Pet.id == order.pet_id).first()
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"宠物ID {order.pet_id} 不存在"
        )
    
    order_number = generate_order_number()
    
    existing_order = db.query(MedicalOrder).filter(
        MedicalOrder.pet_id == order.pet_id,
        MedicalOrder.status.in_([OrderStatus.PENDING, OrderStatus.IN_PROGRESS])
    ).first()
    
    if existing_order:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"该宠物已有进行中的住院医嘱 (编号: {existing_order.order_number})"
        )
    
    db_order = MedicalOrder(
        **order.model_dump(),
        order_number=order_number
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


@router.get("/", response_model=List[MedicalOrderSchema])
def get_medical_orders(
    skip: int = 0,
    limit: int = 100,
    pet_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(MedicalOrder)
    
    if pet_id:
        query = query.filter(MedicalOrder.pet_id == pet_id)
    
    if status:
        query = query.filter(MedicalOrder.status == status)
    
    return query.order_by(MedicalOrder.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{order_id}", response_model=MedicalOrderSchema)
def get_medical_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(MedicalOrder).filter(MedicalOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院医嘱ID {order_id} 不存在"
        )
    return order


@router.put("/{order_id}", response_model=MedicalOrderSchema)
def update_medical_order(order_id: int, order_update: MedicalOrderUpdate, db: Session = Depends(get_db)):
    order = db.query(MedicalOrder).filter(MedicalOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院医嘱ID {order_id} 不存在"
        )
    
    if order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"已完成或已取消的医嘱无法修改"
        )
    
    update_data = order_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(order, key, value)
    
    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medical_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(MedicalOrder).filter(MedicalOrder.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"住院医嘱ID {order_id} 不存在"
        )
    
    if order.hospitalizations:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"该医嘱有关联的住院记录，无法删除"
        )
    
    db.delete(order)
    db.commit()
