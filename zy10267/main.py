from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import pandas as pd
import os

from database import init_db, get_db, TransactionType, TransactionStatus
from services import (
    ResidentService, FamilyService, PointService, ServiceRecordService,
    InventoryService, TransactionService
)
from pydantic import BaseModel, Field

app = FastAPI(title="社区积分兑换 API", description="社区志愿积分管理系统")


@app.on_event("startup")
def startup_event():
    init_db()


class ResidentCreate(BaseModel):
    name: str
    id_card: str
    phone: Optional[str] = None
    family_id: Optional[int] = None


class FamilyCreate(BaseModel):
    family_name: str
    family_number: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None


class FamilyMerge(BaseModel):
    target_family_id: int
    source_account_ids: List[int]
    operator_id: Optional[str] = None


class ServiceRecordCreate(BaseModel):
    resident_id: int
    service_type: str
    service_date: datetime
    service_hours: float = 0
    points_earned: int = 0
    description: Optional[str] = None
    operator_id: Optional[str] = None


class ServiceRecordBatchImport(BaseModel):
    records: List[ServiceRecordCreate]
    import_batch_id: Optional[str] = None


class EarnPoints(BaseModel):
    account_id: int
    amount: int
    service_record_id: Optional[int] = None
    description: Optional[str] = None
    operator_id: Optional[str] = None
    needs_review: bool = False


class ExchangePoints(BaseModel):
    account_id: int
    item_id: int
    quantity: int = 1
    operator_id: Optional[str] = None


class RevokeServiceRecord(BaseModel):
    service_record_id: int
    reason: str
    operator_id: Optional[str] = None


class RevokeExchangeOrder(BaseModel):
    order_id: int
    reason: str
    operator_id: Optional[str] = None


class InventoryItemCreate(BaseModel):
    item_name: str
    points_required: int
    item_code: Optional[str] = None
    category: Optional[str] = None
    stock_quantity: int = 0
    unit: str = "份"
    description: Optional[str] = None


class ReviewTransaction(BaseModel):
    transaction_id: int
    approved: bool
    review_note: str
    reviewer_id: str


@app.post("/residents/", tags=["居民管理"], summary="创建居民")
def create_resident(resident_data: ResidentCreate, db: Session = Depends(get_db)):
    try:
        resident, account = ResidentService.create_resident(
            db, resident_data.name, resident_data.id_card,
            resident_data.phone, resident_data.family_id
        )
        return {
            "code": 0,
            "message": "创建成功",
            "data": {
                "resident_id": resident.id,
                "resident_number": resident.resident_number,
                "name": resident.name,
                "account_id": account.id,
                "account_number": account.account_number
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/residents/{resident_id}", tags=["居民管理"], summary="获取居民信息")
def get_resident(resident_id: int, db: Session = Depends(get_db)):
    resident = ResidentService.get_resident(db, resident_id=resident_id)
    if not resident:
        raise HTTPException(status_code=404, detail="居民不存在")
    return {
        "code": 0,
        "data": {
            "resident_id": resident.id,
            "resident_number": resident.resident_number,
            "name": resident.name,
            "id_card": resident.id_card,
            "phone": resident.phone,
            "family_id": resident.family_id,
            "total_points": resident.total_points,
            "account_id": resident.point_account.id if resident.point_account else None
        }
    }


@app.get("/residents/", tags=["居民管理"], summary="获取居民列表")
def list_residents(family_id: Optional[int] = None, db: Session = Depends(get_db)):
    residents = ResidentService.list_residents(db, family_id=family_id)
    return {
        "code": 0,
        "data": [
            {
                "resident_id": r.id,
                "resident_number": r.resident_number,
                "name": r.name,
                "total_points": r.total_points
            }
            for r in residents
        ]
    }


@app.post("/families/", tags=["家庭管理"], summary="创建家庭")
def create_family(family_data: FamilyCreate, db: Session = Depends(get_db)):
    try:
        family, account = FamilyService.create_family(
            db, family_data.family_name, family_data.family_number,
            family_data.address, family_data.contact_phone
        )
        return {
            "code": 0,
            "message": "创建成功",
            "data": {
                "family_id": family.id,
                "family_number": family.family_number,
                "family_name": family.family_name,
                "account_id": account.id,
                "account_number": account.account_number
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/families/add-resident", tags=["家庭管理"], summary="添加居民到家庭")
def add_resident_to_family(family_id: int, resident_id: int, db: Session = Depends(get_db)):
    try:
        FamilyService.add_resident_to_family(db, family_id, resident_id)
        return {"code": 0, "message": "添加成功"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/families/merge-accounts", tags=["家庭管理"], summary="合并家庭积分账户")
def merge_family_accounts(merge_data: FamilyMerge, db: Session = Depends(get_db)):
    try:
        result = FamilyService.merge_family_accounts(
            db, merge_data.target_family_id,
            merge_data.source_account_ids, merge_data.operator_id
        )
        return {"code": 0, "message": "合并成功", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/service-records/", tags=["服务记录"], summary="创建服务记录")
def create_service_record(record_data: ServiceRecordCreate, db: Session = Depends(get_db)):
    try:
        record = ServiceRecordService.create_service_record(
            db, record_data.resident_id, record_data.service_type,
            record_data.service_date, record_data.service_hours,
            record_data.points_earned, record_data.description,
            record_data.operator_id
        )
        return {
            "code": 0,
            "message": "创建成功",
            "data": {
                "record_id": record.id,
                "record_number": record.record_number
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/service-records/batch-import", tags=["服务记录"], summary="批量导入服务记录")
def batch_import_service_records(import_data: ServiceRecordBatchImport, db: Session = Depends(get_db)):
    records = [r.dict() for r in import_data.records]
    result = ServiceRecordService.batch_import_service_records(
        db, records, import_data.import_batch_id
    )
    return {"code": 0, "message": "导入完成", "data": result}


@app.post("/points/earn", tags=["积分管理"], summary="积分入账")
def earn_points(earn_data: EarnPoints, db: Session = Depends(get_db)):
    try:
        transaction = PointService.earn_points(
            db, earn_data.account_id, earn_data.amount,
            earn_data.service_record_id, earn_data.description,
            earn_data.operator_id, earn_data.needs_review
        )
        return {
            "code": 0,
            "message": "积分入账成功",
            "data": {
                "transaction_id": transaction.id,
                "transaction_number": transaction.transaction_number,
                "amount": transaction.amount,
                "balance_after": transaction.balance_after
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/points/exchange", tags=["积分管理"], summary="积分兑换")
def exchange_points(exchange_data: ExchangePoints, db: Session = Depends(get_db)):
    try:
        order, transaction = PointService.exchange_points(
            db, exchange_data.account_id, exchange_data.item_id,
            exchange_data.quantity, exchange_data.operator_id
        )
        return {
            "code": 0,
            "message": "兑换成功",
            "data": {
                "order_id": order.id,
                "order_number": order.order_number,
                "points_used": order.points_used,
                "balance_after": transaction.balance_after
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/points/revoke-service", tags=["积分管理"], summary="撤销服务记录并回滚积分")
def revoke_service_record(revoke_data: RevokeServiceRecord, db: Session = Depends(get_db)):
    try:
        record, transaction = PointService.revoke_service_record(
            db, revoke_data.service_record_id, revoke_data.reason,
            revoke_data.operator_id
        )
        return {
            "code": 0,
            "message": "撤销成功",
            "data": {
                "revoked_points": abs(transaction.amount),
                "balance_after": transaction.balance_after
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/points/revoke-exchange", tags=["积分管理"], summary="撤销兑换订单并回滚积分")
def revoke_exchange_order(revoke_data: RevokeExchangeOrder, db: Session = Depends(get_db)):
    try:
        order, transaction = PointService.revoke_exchange_order(
            db, revoke_data.order_id, revoke_data.reason,
            revoke_data.operator_id
        )
        return {
            "code": 0,
            "message": "撤销成功",
            "data": {
                "returned_points": transaction.amount,
                "balance_after": transaction.balance_after
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/inventory/", tags=["库存管理"], summary="创建兑换物品")
def create_inventory_item(item_data: InventoryItemCreate, db: Session = Depends(get_db)):
    try:
        item = InventoryService.create_item(
            db, item_data.item_name, item_data.points_required,
            item_data.item_code, item_data.category, item_data.stock_quantity,
            item_data.unit, item_data.description
        )
        return {
            "code": 0,
            "message": "创建成功",
            "data": {
                "item_id": item.id,
                "item_code": item.item_code,
                "item_name": item.item_name
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/inventory/", tags=["库存管理"], summary="获取物品列表")
def list_inventory(db: Session = Depends(get_db)):
    from database import InventoryItem
    items = db.query(InventoryItem).filter(InventoryItem.is_active == True).all()
    return {
        "code": 0,
        "data": [
            {
                "item_id": item.id,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "category": item.category,
                "points_required": item.points_required,
                "stock_quantity": item.stock_quantity,
                "unit": item.unit
            }
            for item in items
        ]
    }


@app.get("/accounts/{account_id}/balance", tags=["账户查询"], summary="查询账户余额")
def get_account_balance(account_id: int, db: Session = Depends(get_db)):
    try:
        balance = TransactionService.get_account_balance(db, account_id)
        return {"code": 0, "data": balance}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/accounts/{account_id}/balance-history", tags=["账户查询"], summary="查询余额变更历史")
def get_balance_history(account_id: int, db: Session = Depends(get_db)):
    history = TransactionService.get_balance_history(db, account_id)
    return {"code": 0, "data": history}


@app.get("/transactions/", tags=["交易流水"], summary="查询交易流水")
def list_transactions(
    account_id: Optional[int] = None,
    transaction_type: Optional[TransactionType] = None,
    needs_review: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    transactions = TransactionService.list_transactions(
        db, account_id, transaction_type, None, needs_review,
        None, None, skip, limit
    )
    return {
        "code": 0,
        "data": [
            {
                "transaction_id": tx.id,
                "transaction_number": tx.transaction_number,
                "transaction_type": tx.transaction_type.value,
                "amount": tx.amount,
                "balance_before": tx.balance_before,
                "balance_after": tx.balance_after,
                "status": tx.status.value,
                "needs_review": tx.needs_review,
                "description": tx.description,
                "created_at": tx.created_at
            }
            for tx in transactions
        ]
    }


@app.get("/transactions/pending-review", tags=["交易流水"], summary="获取待复核交易")
def get_pending_review_transactions(db: Session = Depends(get_db)):
    transactions = TransactionService.export_pending_review_transactions(db)
    return {"code": 0, "data": transactions}


@app.post("/transactions/review", tags=["交易流水"], summary="复核交易")
def review_transaction(review_data: ReviewTransaction, db: Session = Depends(get_db)):
    try:
        transaction = TransactionService.review_transaction(
            db, review_data.transaction_id, review_data.approved,
            review_data.review_note, review_data.reviewer_id
        )
        return {
            "code": 0,
            "message": "复核完成",
            "data": {
                "transaction_id": transaction.id,
                "status": transaction.status.value
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/export/pending-review", tags=["导出"], summary="导出待复核交易Excel")
def export_pending_review(db: Session = Depends(get_db)):
    transactions = TransactionService.export_pending_review_transactions(db)
    if not transactions:
        raise HTTPException(status_code=404, detail="没有待复核的交易")

    df = pd.DataFrame(transactions)
    filename = f"pending_review_transactions_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    filepath = os.path.join(os.getcwd(), filename)
    df.to_excel(filepath, index=False, engine='openpyxl')

    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
