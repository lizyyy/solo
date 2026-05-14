from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models import AdPlan as AdPlanModel, StatusLog as StatusLogModel
from app.schemas import AdPlan, AdPlanCreate, AdPlanUpdate, AdPlanDetail

router = APIRouter()

@router.get("/", response_model=List[AdPlan])
def get_ad_plans(
    channel: Optional[str] = None,
    review_status: Optional[str] = None,
    spend_status: Optional[str] = None,
    is_paused: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AdPlanModel)
    if channel:
        query = query.filter(AdPlanModel.channel == channel)
    if review_status:
        query = query.filter(AdPlanModel.review_status == review_status)
    if spend_status:
        query = query.filter(AdPlanModel.spend_status == spend_status)
    if is_paused is not None:
        query = query.filter(AdPlanModel.is_paused == is_paused)
    return query.order_by(AdPlanModel.created_at.desc()).all()

@router.get("/{plan_id}", response_model=AdPlanDetail)
def get_ad_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(AdPlanModel).filter(AdPlanModel.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="广告计划不存在")
    return plan

@router.post("/", response_model=AdPlan)
def create_ad_plan(plan: AdPlanCreate, db: Session = Depends(get_db)):
    db_plan = AdPlanModel(**plan.model_dump())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan

@router.put("/{plan_id}", response_model=AdPlan)
def update_ad_plan(
    plan_id: int,
    plan_update: AdPlanUpdate,
    change_reason: str = "",
    operator: str = "system",
    db: Session = Depends(get_db)
):
    db_plan = db.query(AdPlanModel).filter(AdPlanModel.id == plan_id).first()
    if not db_plan:
        raise HTTPException(status_code=404, detail="广告计划不存在")
    
    update_data = plan_update.model_dump(exclude_unset=True)
    
    for field, new_value in update_data.items():
        old_value = getattr(db_plan, field)
        if old_value != new_value:
            status_log = StatusLogModel(
                ad_plan_id=plan_id,
                field_name=field,
                old_value=str(old_value),
                new_value=str(new_value),
                change_reason=change_reason,
                operator=operator
            )
            db.add(status_log)
    
    for key, value in update_data.items():
        setattr(db_plan, key, value)
    
    db_plan.version += 1
    db.commit()
    db.refresh(db_plan)
    return db_plan
