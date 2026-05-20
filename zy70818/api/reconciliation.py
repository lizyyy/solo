from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional
from datetime import date
from pydantic import BaseModel

from models.reconciliation import ReconciliationResult, ReviewAction
from services.reconciliation_service import reconciliation_engine, review_service
from utils.storage import store

router = APIRouter(tags=["对账核对"])


class ReconciliationRequest(BaseModel):
    name: str
    start_date: date
    end_date: date
    store_filter: Optional[List[str]] = None


class ReviewRequest(BaseModel):
    action: ReviewAction
    notes: str
    reviewed_by: str
    adjustment_quantity: Optional[int] = None


@router.post("/run", summary="执行对账")
async def run_reconciliation(request: ReconciliationRequest):
    try:
        result = reconciliation_engine.run_reconciliation(
            name=request.name,
            start_date=request.start_date,
            end_date=request.end_date,
            store_filter=request.store_filter
        )
        return {
            "success": True,
            "reconciliation_id": result.id,
            "summary": {
                "total_inventory": result.total_inventory_count,
                "total_consumption": result.total_consumption_count,
                "total_discrepancies": result.discrepancy_count,
                "unresolved": result.unresolved_discrepancy_count,
                "recalled_count": result.recalled_batch_count,
                "near_expiry_count": result.near_expiry_count,
                "expired_count": result.expired_count,
                "transfer_count": result.transfer_count
            },
            "message": "对账完成"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", summary="获取对账任务列表")
async def get_reconciliations(status: Optional[str] = None):
    items = store.get_all('reconciliation', ReconciliationResult)
    if status:
        items = [i for i in items if i.status == status]
    return {"count": len(items), "items": [i.model_dump() for i in items]}


@router.get("/{reconciliation_id}", summary="获取对账详情")
async def get_reconciliation(reconciliation_id: str):
    item = store.get('reconciliation', reconciliation_id, ReconciliationResult)
    if not item:
        raise HTTPException(status_code=404, detail="对账任务不存在")
    return item.model_dump()


@router.get("/{reconciliation_id}/discrepancies", summary="获取差异列表")
async def get_discrepancies(reconciliation_id: str):
    reconciliation = store.get('reconciliation', reconciliation_id, ReconciliationResult)
    if not reconciliation:
        raise HTTPException(status_code=404, detail="对账任务不存在")
    return {
        "count": len(reconciliation.discrepancies),
        "discrepancies": [d.model_dump() for d in reconciliation.discrepancies]
    }


@router.post("/{reconciliation_id}/discrepancies/{discrepancy_id}/review", summary="复核差异")
async def review_discrepancy(reconciliation_id: str, discrepancy_id: str, request: ReviewRequest):
    success, message = review_service.review_discrepancy(
        reconciliation_id=reconciliation_id,
        discrepancy_id=discrepancy_id,
        action=request.action,
        notes=request.notes,
        reviewed_by=request.reviewed_by,
        adjustment_quantity=request.adjustment_quantity
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"success": True, "message": message}


@router.delete("/{reconciliation_id}", summary="删除对账任务")
async def delete_reconciliation(reconciliation_id: str):
    if store.delete('reconciliation', reconciliation_id):
        return {"message": "删除成功"}
    raise HTTPException(status_code=404, detail="对账任务不存在")
