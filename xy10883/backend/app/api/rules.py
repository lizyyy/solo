from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AnomalyRule
from app.schemas import AnomalyRuleCreate, AnomalyRuleUpdate, AnomalyRule as AnomalyRuleSchema

router = APIRouter()


@router.post("/", response_model=AnomalyRuleSchema)
async def create_rule(rule: AnomalyRuleCreate, db: Session = Depends(get_db)):
    db_rule = AnomalyRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/", response_model=List[AnomalyRuleSchema])
async def get_rules(enabled: bool = None, db: Session = Depends(get_db)):
    query = db.query(AnomalyRule)
    if enabled is not None:
        query = query.filter(AnomalyRule.enabled == enabled)
    return query.all()


@router.get("/{rule_id}", response_model=AnomalyRuleSchema)
async def get_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(AnomalyRule).filter(AnomalyRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    return rule


@router.put("/{rule_id}", response_model=AnomalyRuleSchema)
async def update_rule(rule_id: int, rule_update: AnomalyRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(AnomalyRule).filter(AnomalyRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    for field, value in rule_update.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)

    rule.updated_at = db.query(AnomalyRule).filter(AnomalyRule.id == rule_id).first().updated_at
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}")
async def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(AnomalyRule).filter(AnomalyRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    db.delete(rule)
    db.commit()
    return {"message": "规则已删除"}
