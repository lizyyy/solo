from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import WardRule
from ..schemas import WardRuleCreate, WardRuleUpdate, WardRuleResponse

router = APIRouter(prefix="/api/wards", tags=["wards"])


@router.get("", response_model=List[WardRuleResponse])
def get_ward_rules(
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(WardRule)
    
    if is_active is not None:
        query = query.filter(WardRule.is_active == is_active)
    
    return query.order_by(WardRule.ward_name).offset(skip).limit(limit).all()


@router.get("/{ward_name}", response_model=WardRuleResponse)
def get_ward_rule(ward_name: str, db: Session = Depends(get_db)):
    rule = db.query(WardRule).filter(WardRule.ward_name == ward_name).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"病区 {ward_name} 规则不存在")
    return rule


@router.post("", response_model=WardRuleResponse)
def create_ward_rule(rule: WardRuleCreate, db: Session = Depends(get_db)):
    existing = db.query(WardRule).filter(WardRule.ward_name == rule.ward_name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"病区 {rule.ward_name} 规则已存在")
    
    db_rule = WardRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.put("/{ward_name}", response_model=WardRuleResponse)
def update_ward_rule(ward_name: str, rule_update: WardRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(WardRule).filter(WardRule.ward_name == ward_name).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"病区 {ward_name} 规则不存在")
    
    update_data = rule_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{ward_name}")
def delete_ward_rule(ward_name: str, db: Session = Depends(get_db)):
    rule = db.query(WardRule).filter(WardRule.ward_name == ward_name).first()
    if not rule:
        raise HTTPException(status_code=404, detail=f"病区 {ward_name} 规则不存在")
    
    rule.is_active = False
    db.commit()
    return {"message": f"病区 {ward_name} 规则已停用"}
