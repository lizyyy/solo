from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FilterCondition
from app.schemas import (
    FilterConditionCreate,
    FilterConditionResponse
)
from app.services.question_bank import FilterConditionService

router = APIRouter(prefix="/filter-conditions", tags=["筛选条件"])


@router.get("/", response_model=List[FilterConditionResponse])
def list_conditions(
    user_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return db.query(FilterCondition).filter(
        FilterCondition.user_id == user_id
    ).order_by(FilterCondition.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/current", response_model=Optional[FilterConditionResponse])
def get_current_condition(user_id: str, db: Session = Depends(get_db)):
    service = FilterConditionService(db)
    return service.get_current_condition(user_id)


@router.get("/{condition_id}", response_model=FilterConditionResponse)
def get_condition(condition_id: int, db: Session = Depends(get_db)):
    service = FilterConditionService(db)
    condition = service.get_condition(condition_id)
    if not condition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CONDITION_NOT_FOUND",
                "message": f"筛选条件ID {condition_id} 不存在",
                "suggestion": "请检查条件ID是否正确",
                "contact_person": "系统管理员"
            }
        )
    return condition


@router.post("/", response_model=FilterConditionResponse, status_code=status.HTTP_201_CREATED)
def save_condition(condition_data: FilterConditionCreate, db: Session = Depends(get_db)):
    service = FilterConditionService(db)
    return service.save_condition(
        user_id=condition_data.user_id,
        condition_json=condition_data.condition_json,
        condition_name=condition_data.condition_name
    )


@router.put("/{condition_id}/set-current", response_model=FilterConditionResponse)
def set_current_condition(condition_id: int, db: Session = Depends(get_db)):
    condition = db.query(FilterCondition).filter(FilterCondition.id == condition_id).first()
    if not condition:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "CONDITION_NOT_FOUND",
                "message": f"筛选条件ID {condition_id} 不存在",
                "suggestion": "请检查条件ID是否正确",
                "contact_person": "系统管理员"
            }
        )

    db.query(FilterCondition).filter(
        FilterCondition.user_id == condition.user_id,
        FilterCondition.is_current == True
    ).update({"is_current": False})

    condition.is_current = True
    db.commit()
    db.refresh(condition)
    return condition
