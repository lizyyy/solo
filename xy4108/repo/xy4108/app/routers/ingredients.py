from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Ingredient, AuditAction, BatchStatus
from ..schemas import (
    IngredientCreate, IngredientUpdate, IngredientResponse, BatchRecallRequest
)
from ..services import AuditService, BatchService

router = APIRouter(prefix="/ingredients", tags=["食材批次"])


@router.get("/", response_model=List[IngredientResponse])
def list_ingredients(
    batch_number: Optional[str] = None,
    status: Optional[BatchStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Ingredient)
    if batch_number:
        query = query.filter(Ingredient.batch_number == batch_number)
    if status:
        query = query.filter(Ingredient.status == status)
    return query.order_by(Ingredient.created_at.desc()).all()


@router.get("/{ingredient_id}", response_model=IngredientResponse)
def get_ingredient(ingredient_id: int, db: Session = Depends(get_db)):
    ingredient = db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()
    if not ingredient:
        raise HTTPException(status_code=404, detail="食材不存在")
    return ingredient


@router.post("/", response_model=IngredientResponse)
def create_ingredient(ingredient: IngredientCreate, db: Session = Depends(get_db)):
    db_ingredient = Ingredient(**ingredient.model_dump())
    db.add(db_ingredient)
    db.commit()
    db.refresh(db_ingredient)
    
    AuditService.log_action(
        db=db,
        action=AuditAction.CREATE,
        entity_type="Ingredient",
        entity_id=db_ingredient.id,
        details={
            "name": db_ingredient.name,
            "batch_number": db_ingredient.batch_number
        }
    )
    
    return db_ingredient


@router.post("/batch", response_model=List[IngredientResponse])
def create_ingredients(items: List[IngredientCreate], db: Session = Depends(get_db)):
    db_items = []
    for item in items:
        db_item = Ingredient(**item.model_dump())
        db.add(db_item)
        db_items.append(db_item)
    
    db.commit()
    for item in db_items:
        db.refresh(item)
    
    AuditService.log_action(
        db=db,
        action=AuditAction.CREATE,
        entity_type="Ingredient",
        details={"batch_count": len(db_items)}
    )
    
    return db_items


@router.put("/{ingredient_id}", response_model=IngredientResponse)
def update_ingredient(
    ingredient_id: int,
    ingredient_update: IngredientUpdate,
    db: Session = Depends(get_db)
):
    ingredient = db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()
    if not ingredient:
        raise HTTPException(status_code=404, detail="食材不存在")
    
    update_data = ingredient_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ingredient, key, value)
    
    db.commit()
    db.refresh(ingredient)
    
    AuditService.log_action(
        db=db,
        action=AuditAction.UPDATE,
        entity_type="Ingredient",
        entity_id=ingredient.id,
        details=update_data
    )
    
    return ingredient


@router.post("/recall")
def recall_batch(
    recall_request: BatchRecallRequest,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = BatchService.recall_batch(
        db=db,
        batch_number=recall_request.batch_number,
        reason=recall_request.reason,
        operator=operator
    )
    
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["message"])
    
    return result


@router.delete("/{ingredient_id}")
def delete_ingredient(ingredient_id: int, db: Session = Depends(get_db)):
    ingredient = db.query(Ingredient).filter(Ingredient.id == ingredient_id).first()
    if not ingredient:
        raise HTTPException(status_code=404, detail="食材不存在")
    
    db.delete(ingredient)
    db.commit()
    
    AuditService.log_action(
        db=db,
        action=AuditAction.DELETE,
        entity_type="Ingredient",
        entity_id=ingredient_id,
        details={
            "name": ingredient.name,
            "batch_number": ingredient.batch_number
        }
    )
    
    return {"success": True, "message": "食材已删除"}
