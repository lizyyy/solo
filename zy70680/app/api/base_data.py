from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import schemas, crud

router = APIRouter()


@router.post("/transactions", response_model=schemas.PaymentTransaction)
def create_transaction(transaction: schemas.PaymentTransactionCreate, db: Session = Depends(get_db)):
    db_transaction = crud.get_transaction_by_id(db, transaction_id=transaction.transaction_id)
    if db_transaction:
        raise HTTPException(status_code=409, detail="支付流水已存在")
    return crud.create_transaction(db=db, transaction=transaction)


@router.get("/transactions/{transaction_id}", response_model=schemas.PaymentTransaction)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)):
    db_transaction = crud.get_transaction_by_id(db, transaction_id=transaction_id)
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="支付流水不存在")
    return db_transaction


@router.post("/users", response_model=schemas.UserAccount)
def create_user(user: schemas.UserAccountCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_id(db, user_id=user.user_id)
    if db_user:
        raise HTTPException(status_code=409, detail="用户已存在")
    return crud.create_user(db=db, user=user)


@router.get("/users/{user_id}", response_model=schemas.UserAccount)
def get_user(user_id: str, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_id(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    return db_user


@router.post("/handlers", response_model=schemas.Handler)
def create_handler(handler: schemas.HandlerCreate, db: Session = Depends(get_db)):
    db_handler = crud.get_handler_by_id(db, handler_id=handler.handler_id)
    if db_handler:
        raise HTTPException(status_code=409, detail="处理人已存在")
    return crud.create_handler(db=db, handler=handler)


@router.get("/handlers/{handler_id}", response_model=schemas.Handler)
def get_handler(handler_id: str, db: Session = Depends(get_db)):
    db_handler = crud.get_handler_by_id(db, handler_id=handler_id)
    if db_handler is None:
        raise HTTPException(status_code=404, detail="处理人不存在")
    return db_handler


@router.post("/vouchers", response_model=schemas.CompensationVoucher)
def create_voucher(voucher: schemas.CompensationVoucherCreate, db: Session = Depends(get_db)):
    db_voucher = crud.get_voucher_by_code(db, voucher_code=voucher.voucher_code)
    if db_voucher:
        raise HTTPException(status_code=409, detail="补偿券已存在")
    return crud.create_voucher(db=db, voucher=voucher)


@router.get("/vouchers/{voucher_id}", response_model=schemas.CompensationVoucher)
def get_voucher(voucher_id: int, db: Session = Depends(get_db)):
    db_voucher = crud.get_voucher_by_id(db, voucher_id=voucher_id)
    if db_voucher is None:
        raise HTTPException(status_code=404, detail="补偿券不存在")
    return db_voucher


@router.get("/orders", response_model=List[schemas.OrderDraft])
def list_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_orders(db, skip=skip, limit=limit)


@router.get("/orders/{order_no}", response_model=schemas.OrderDraft)
def get_order(order_no: str, db: Session = Depends(get_db)):
    db_order = crud.get_order_by_no(db, order_no=order_no)
    if db_order is None:
        raise HTTPException(status_code=404, detail="订单不存在")
    return db_order
