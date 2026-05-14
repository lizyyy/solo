from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import PauseRule as PauseRuleModel, AdPlan as AdPlanModel
from app.schemas import PauseRule, PauseRuleCreate

router = APIRouter()

@router.get("/{plan_id}", response_model=List[PauseRule])
def get_pause_rules(plan_id: int, db: Session = Depends(get_db)):
    return db.query(PauseRuleModel).filter(
        PauseRuleModel.ad_plan_id == plan_id
    ).order_by(PauseRuleModel.created_at.desc()).all()

@router.post("/", response_model=PauseRule)
def create_pause_rule(rule: PauseRuleCreate, db: Session = Depends(get_db)):
    db_rule = PauseRuleModel(**rule.model_dump())
    db.add(db_rule)
    
    db_plan = db.query(AdPlanModel).filter(AdPlanModel.id == rule.ad_plan_id).first()
    if db_plan:
        db_plan.is_paused = True
        db_plan.version += 1
    
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.put("/{rule_id}/deactivate", response_model=PauseRule)
def deactivate_pause_rule(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(PauseRuleModel).filter(PauseRuleModel.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="暂停规则不存在")
    
    db_rule.is_active = False
    db.commit()
    db.refresh(db_rule)
    return db_rule
