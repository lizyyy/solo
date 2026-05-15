from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.models.database import get_db
from app.services.budget_allocator import BudgetAllocatorService
from app.schemas.schemas import (
    AllocationRequest, CorrectionRequest, FreezeRequest,
    QueryFilter, ApprovalOrderCreate, ApprovalOrder
)

router = APIRouter()


@router.post("/orders/", response_model=ApprovalOrder)
def create_order(order: ApprovalOrderCreate, db: Session = Depends(get_db)):
    from app.models.database import ApprovalOrder as ApprovalOrderModel
    from datetime import datetime
    db_order = ApprovalOrderModel(
        **order.model_dump(),
        status="pending",
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


@router.get("/orders/", response_model=List[ApprovalOrder])
def list_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    from app.models.database import ApprovalOrder as ApprovalOrderModel
    orders = db.query(ApprovalOrderModel).offset(skip).limit(limit).all()
    return orders


@router.post("/allocate/")
def allocate_budget(request: AllocationRequest, db: Session = Depends(get_db)):
    service = BudgetAllocatorService(db)
    try:
        result = service.allocate_budget(request)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/correct/")
def apply_correction(request: CorrectionRequest, db: Session = Depends(get_db)):
    service = BudgetAllocatorService(db)
    try:
        result = service.apply_manual_correction(request)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/freeze/")
def freeze_version(request: FreezeRequest, db: Session = Depends(get_db)):
    service = BudgetAllocatorService(db)
    try:
        result = service.freeze_version(request)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query/")
def query_results(query_filter: QueryFilter = None, db: Session = Depends(get_db)):
    service = BudgetAllocatorService(db)
    try:
        results = service.query_allocation_results(query_filter)
        return {"success": True, "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/review/{order_id}")
def get_review_trace(order_id: int, db: Session = Depends(get_db)):
    service = BudgetAllocatorService(db)
    try:
        trace = service.get_review_trace(order_id)
        return {"success": True, "data": trace}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
