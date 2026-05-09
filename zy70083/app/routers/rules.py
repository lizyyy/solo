from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models import QualificationRule
from ..schemas import QualificationRuleCreate, QualificationRuleResponse

router = APIRouter(prefix="/api/rules", tags=["资格规则管理"])


@router.post("", response_model=QualificationRuleResponse)
def create_qualification_rule(data: QualificationRuleCreate, db: Session = Depends(get_db)):
    existing = db.query(QualificationRule).filter(
        QualificationRule.rule_name == data.rule_name,
        QualificationRule.is_active == True
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"规则名称 {data.rule_name} 已存在激活版本")

    rule = QualificationRule(
        rule_name=data.rule_name,
        rule_type=data.rule_type,
        description=data.description,
        min_income_threshold=data.min_income_threshold,
        max_income_threshold=data.max_income_threshold,
        min_social_insurance_months=data.min_social_insurance_months,
        max_housing_area_per_person=data.max_housing_area_per_person,
        max_family_housing_area=data.max_family_housing_area
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("", response_model=List[QualificationRuleResponse])
def list_qualification_rules(
    active_only: bool = True,
    rule_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(QualificationRule)
    if active_only:
        query = query.filter(QualificationRule.is_active == True)
    if rule_type:
        query = query.filter(QualificationRule.rule_type == rule_type)
    return query.order_by(QualificationRule.id.desc()).all()


@router.get("/{rule_id}", response_model=QualificationRuleResponse)
def get_qualification_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(QualificationRule).filter(QualificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="资格规则不存在")
    return rule


@router.post("/{rule_id}/deactivate")
def deactivate_qualification_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(QualificationRule).filter(QualificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="资格规则不存在")

    rule.is_active = False
    db.commit()
    db.refresh(rule)
    return {
        "success": True,
        "message": f"规则 {rule.rule_name} 已停用",
        "rule_id": rule.id
    }


@router.post("/{rule_id}/activate")
def activate_qualification_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(QualificationRule).filter(QualificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="资格规则不存在")

    same_name_rules = db.query(QualificationRule).filter(
        QualificationRule.rule_name == rule.rule_name,
        QualificationRule.id != rule_id,
        QualificationRule.is_active == True
    ).all()
    for r in same_name_rules:
        r.is_active = False

    rule.is_active = True
    rule.version += 1
    db.commit()
    db.refresh(rule)
    return {
        "success": True,
        "message": f"规则 {rule.rule_name} 已激活",
        "rule_id": rule.id,
        "version": rule.version
    }
