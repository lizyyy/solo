from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Child, AuditAction
from ..schemas import (
    ChildCreate, ChildUpdate, ChildResponse
)
from ..services import AuditService

router = APIRouter(prefix="/children", tags=["儿童档案"])


@router.get("/", response_model=List[ChildResponse])
def list_children(
    class_name: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Child)
    if class_name:
        query = query.filter(Child.class_name == class_name)
    if is_active is not None:
        query = query.filter(Child.is_active == is_active)
    return query.all()


@router.get("/{child_id}", response_model=ChildResponse)
def get_child(child_id: int, db: Session = Depends(get_db)):
    child = db.query(Child).filter(Child.id == child_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="儿童档案不存在")
    return child


@router.post("/", response_model=ChildResponse)
def create_child(child: ChildCreate, db: Session = Depends(get_db)):
    existing = db.query(Child).filter(Child.student_id == child.student_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"学号 {child.student_id} 已存在")
    
    db_child = Child(**child.model_dump())
    db.add(db_child)
    db.commit()
    db.refresh(db_child)
    
    AuditService.log_action(
        db=db,
        action=AuditAction.CREATE,
        entity_type="Child",
        entity_id=db_child.id,
        details={"name": db_child.name, "student_id": db_child.student_id}
    )
    
    return db_child


@router.put("/{child_id}", response_model=ChildResponse)
def update_child(
    child_id: int,
    child_update: ChildUpdate,
    db: Session = Depends(get_db)
):
    child = db.query(Child).filter(Child.id == child_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="儿童档案不存在")
    
    update_data = child_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(child, key, value)
    
    db.commit()
    db.refresh(child)
    
    AuditService.log_action(
        db=db,
        action=AuditAction.UPDATE,
        entity_type="Child",
        entity_id=child.id,
        details=update_data
    )
    
    return child


@router.delete("/{child_id}")
def delete_child(child_id: int, db: Session = Depends(get_db)):
    child = db.query(Child).filter(Child.id == child_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="儿童档案不存在")
    
    child.is_active = False
    db.commit()
    
    AuditService.log_action(
        db=db,
        action=AuditAction.DELETE,
        entity_type="Child",
        entity_id=child.id,
        details={"name": child.name, "student_id": child.student_id}
    )
    
    return {"success": True, "message": "儿童档案已停用"}
