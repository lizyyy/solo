from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import Rule
from app.schemas.schemas import RuleCreate, RuleResponse

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("/", response_model=List[RuleResponse])
def list_rules(db: Session = Depends(get_db)):
    return db.query(Rule).order_by(Rule.code).all()


@router.post("/", response_model=RuleResponse)
def create_rule(rule: RuleCreate, db: Session = Depends(get_db)):
    existing = db.query(Rule).filter(Rule.code == rule.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="规则编码已存在")

    db_rule = Rule(
        name=rule.name,
        code=rule.code,
        description=rule.description,
        risk_type=rule.risk_type,
        condition=rule.condition,
        version=1,
        is_active=True
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.put("/{rule_id}", response_model=RuleResponse)
def update_rule(rule_id: int, rule_update: RuleCreate, db: Session = Depends(get_db)):
    db_rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    db_rule.name = rule_update.name
    db_rule.description = rule_update.description
    db_rule.risk_type = rule_update.risk_type
    db_rule.condition = rule_update.condition
    db_rule.version += 1

    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    db_rule.is_active = False
    db.commit()
    return {"message": "规则已禁用"}
