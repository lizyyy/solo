from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.store import Store
from ..models.deposit import DepositOrder
from ..models.consume import ConsumeOrder
from ..schemas import DepositCreate, DepositResponse, ConsumeCreate, ConsumeResponse
from ..services.account_service import AccountService, DepositService, ConsumeService

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.post("/deposit", response_model=DepositResponse)
def create_deposit(data: DepositCreate, db: Session = Depends(get_db)):
    account = AccountService.get_account_by_no(db, data.account_no)
    if not account:
        raise HTTPException(status_code=404, detail="账户不存在")
    
    store = db.query(Store).filter(Store.id == data.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    
    try:
        order = DepositService.create_deposit(
            db=db,
            account=account,
            store_id=data.store_id,
            deposit_amount=data.deposit_amount,
            operator=data.operator,
            remark=data.remark
        )
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/consume", response_model=ConsumeResponse)
def create_consume(data: ConsumeCreate, db: Session = Depends(get_db)):
    account = AccountService.get_account_by_no(db, data.account_no)
    if not account:
        raise HTTPException(status_code=404, detail="账户不存在")
    
    store = db.query(Store).filter(Store.id == data.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="门店不存在")
    
    try:
        order = ConsumeService.create_consume(
            db=db,
            account=account,
            store_id=data.store_id,
            total_amount=data.total_amount,
            operator=data.operator,
            remark=data.remark
        )
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/deposits", response_model=List[DepositResponse])
def list_deposits(account_no: str = None, db: Session = Depends(get_db)):
    query = db.query(DepositOrder)
    if account_no:
        account = AccountService.get_account_by_no(db, account_no)
        if account:
            query = query.filter(DepositOrder.account_id == account.id)
    return query.order_by(DepositOrder.id.desc()).all()


@router.get("/consumes", response_model=List[ConsumeResponse])
def list_consumes(account_no: str = None, db: Session = Depends(get_db)):
    query = db.query(ConsumeOrder)
    if account_no:
        account = AccountService.get_account_by_no(db, account_no)
        if account:
            query = query.filter(ConsumeOrder.account_id == account.id)
    return query.order_by(ConsumeOrder.id.desc()).all()
