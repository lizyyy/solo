from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.repair_receipts import (
    RepairReceipt,
    RepairReceiptCreate,
    RepairReceiptUpdate,
    RepairReceiptQuery,
)
from app.schemas.base import ResponseModel, PaginatedResponse
from app.services.repair_receipt_service import RepairReceiptService

router = APIRouter(prefix="/repair-receipts", tags=["repair-receipts"])


@router.get("", response_model=PaginatedResponse[RepairReceipt])
def list_receipts(
    dispatch_id: int = Query(None),
    worker_id: int = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    service = RepairReceiptService(db)
    query_params = RepairReceiptQuery(
        dispatch_id=dispatch_id,
        worker_id=worker_id,
        status=status,
        page=page,
        page_size=page_size,
    )
    receipts, total = service.list(query_params)
    return PaginatedResponse(
        data=[RepairReceipt.model_validate(r) for r in receipts],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{receipt_id}", response_model=ResponseModel[RepairReceipt])
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    service = RepairReceiptService(db)
    receipt = service.get_by_id(receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="维修回执不存在")
    return ResponseModel(data=RepairReceipt.model_validate(receipt))


@router.post("", response_model=ResponseModel[RepairReceipt])
def create_receipt(data: RepairReceiptCreate, db: Session = Depends(get_db)):
    service = RepairReceiptService(db)
    receipt = service.create(data)
    return ResponseModel(data=RepairReceipt.model_validate(receipt), message="维修回执创建成功")


@router.put("/{receipt_id}", response_model=ResponseModel[RepairReceipt])
def update_receipt(receipt_id: int, data: RepairReceiptUpdate, db: Session = Depends(get_db)):
    service = RepairReceiptService(db)
    receipt = service.update(receipt_id, data)
    if not receipt:
        raise HTTPException(status_code=404, detail="维修回执不存在")
    return ResponseModel(data=RepairReceipt.model_validate(receipt), message="维修回执更新成功")


@router.delete("/{receipt_id}", response_model=ResponseModel)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    service = RepairReceiptService(db)
    if not service.delete(receipt_id):
        raise HTTPException(status_code=404, detail="维修回执不存在")
    return ResponseModel(message="维修回执删除成功")


@router.post("/{receipt_id}/complete", response_model=ResponseModel[RepairReceipt])
def complete_receipt(
    receipt_id: int,
    store_feedback: Optional[str] = None,
    store_rating: Optional[int] = None,
    db: Session = Depends(get_db),
):
    service = RepairReceiptService(db)
    receipt = service.complete_receipt(receipt_id, store_feedback, store_rating)
    if not receipt:
        raise HTTPException(status_code=404, detail="维修回执不存在")
    return ResponseModel(data=RepairReceipt.model_validate(receipt), message="维修回执完成")
