from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.reconciliation_service import ReconciliationService
from app.schemas import ReconciliationResult
from app.models import Order

router = APIRouter(prefix="/api/reconciliation", tags=["对账管理"])


@router.post("/{order_id}", response_model=ReconciliationResult)
def reconcile_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"订单 {order_id} 不存在")

    service = ReconciliationService(db)
    result = service.reconcile_order(order_id)
    return result


@router.post("/batch")
def reconcile_batch(order_ids: list[str], db: Session = Depends(get_db)):
    results = []
    service = ReconciliationService(db)

    for order_id in order_ids:
        try:
            result = service.reconcile_order(order_id)
            results.append({
                "order_id": order_id,
                "is_balanced": result.is_balanced,
                "needs_review": result.needs_review,
                "final_balance": result.cost_summary.final_deposit_balance
            })
        except Exception as e:
            results.append({
                "order_id": order_id,
                "error": str(e)
            })

    return {"results": results}


@router.get("/{order_id}/summary")
def get_reconciliation_summary(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail=f"订单 {order_id} 不存在")

    service = ReconciliationService(db)
    result = service.reconcile_order(order_id)

    return {
        "order_id": order_id,
        "order_no": order.order_no,
        "tenant_name": order.tenant_name,
        "room_no": order.room_no,
        "electricity_cost": result.cost_summary.electricity_cost,
        "water_cost": result.cost_summary.water_cost,
        "utility_total": result.cost_summary.utility_total,
        "deduction_total": result.cost_summary.deduction_total,
        "deposit_refund": result.cost_summary.deposit_refund,
        "final_balance": result.cost_summary.final_deposit_balance,
        "is_balanced": result.is_balanced,
        "needs_review": result.needs_review,
        "difference_count": len(result.differences)
    }