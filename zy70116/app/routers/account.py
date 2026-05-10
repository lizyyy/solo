from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.account import PrepaidAccount, BonusRule
from ..schemas import AccountCreate, AccountResponse, BonusRuleCreate, BonusRuleResponse
from ..services.account_service import AccountService

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.post("", response_model=AccountResponse)
def create_account(data: AccountCreate, db: Session = Depends(get_db)):
    account = AccountService.create_account(
        db=db,
        member_id=data.member_id,
        member_name=data.member_name
    )
    db.commit()
    db.refresh(account)
    return account


@router.get("/{account_no}", response_model=AccountResponse)
def get_account(account_no: str, db: Session = Depends(get_db)):
    account = AccountService.get_account_by_no(db, account_no)
    if not account:
        raise HTTPException(status_code=404, detail="账户不存在")
    return account


@router.get("", response_model=List[AccountResponse])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(PrepaidAccount).order_by(PrepaidAccount.id.asc()).all()


@router.post("/bonus-rules", response_model=BonusRuleResponse)
def create_bonus_rule(data: BonusRuleCreate, db: Session = Depends(get_db)):
    rule = BonusRule(
        rule_name=data.rule_name,
        min_deposit_amount=data.min_deposit_amount,
        max_deposit_amount=data.max_deposit_amount,
        bonus_amount=data.bonus_amount,
        bonus_rate=data.bonus_rate,
        is_percentage=data.is_percentage,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=True
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/bonus-rules", response_model=List[BonusRuleResponse])
def list_bonus_rules(db: Session = Depends(get_db)):
    return db.query(BonusRule).order_by(BonusRule.min_deposit_amount.asc()).all()
