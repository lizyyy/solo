from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.services import BoundaryRuleService
from app.schemas import BoundaryRule, BoundaryRuleCreate, BoundaryRuleUpdate

router = APIRouter(prefix="/rules", tags=["rules"])


@router.post("/", response_model=BoundaryRule)
def create_rule(rule: BoundaryRuleCreate, db: Session = Depends(get_db)):
    return BoundaryRuleService.create_rule(db=db, rule=rule)


@router.get("/", response_model=List[BoundaryRule])
def list_rules(
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return BoundaryRuleService.list_rules(db=db, is_active=is_active, skip=skip, limit=limit)


@router.get("/{rule_id}", response_model=BoundaryRule)
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = BoundaryRuleService.get_rule(db=db, rule_id=rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule
