from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auto_chain_reconcile.db import get_db
from auto_chain_reconcile.models import InventoryBatch, InventoryConsumption, ReconcileResult, WorkOrder
from auto_chain_reconcile.schemas import TracePartOut

router = APIRouter()


@router.get("/part/{part_code}", response_model=list[TracePartOut])
def trace_part(
    part_code: str,
    store_id: Optional[str] = None,
    order_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> list[TracePartOut]:
    q = db.query(InventoryBatch).filter(InventoryBatch.part_code == part_code)
    if store_id:
        q = q.filter(InventoryBatch.store_id == store_id)
    batches = q.order_by(InventoryBatch.inbound_date.asc()).all()
    if not batches:
        raise HTTPException(status_code=404, detail="未找到该配件批次记录")

    # 从实际消耗记录追溯，而非从工单原始 parts 推断
    batch_ids = {b.id for b in batches}
    cons_q = db.query(InventoryConsumption).filter(
        InventoryConsumption.inventory_batch_id.in_(batch_ids)
    )
    if order_id:
        cons_q = cons_q.filter(InventoryConsumption.order_id == order_id)
    consumptions = cons_q.all()

    consumed_by: dict[int, list[str]] = {}
    for c in consumptions:
        consumed_by.setdefault(c.inventory_batch_id, []).append(c.order_id)

    out: list[TracePartOut] = []
    for b in batches:
        out.append(
            TracePartOut(
                part_code=b.part_code,
                part_name=b.part_name,
                batch_no=b.batch_no,
                supplier=b.supplier,
                inbound_date=b.inbound_date,
                store_id=b.store_id,
                initial_qty=b.initial_qty,
                remaining_qty=b.remaining_qty,
                consumed_by_orders=consumed_by.get(b.id, []),
            )
        )
    return out


@router.get("/order/{order_id}")
def trace_order(order_id: str, db: Session = Depends(get_db)):
    work = db.query(WorkOrder).filter(WorkOrder.order_id == order_id).first()
    if work is None:
        raise HTTPException(status_code=404, detail="未找到该工单")
    results = db.query(ReconcileResult).filter(ReconcileResult.order_id == order_id).all()
    import json
    result_data = []
    for r in results:
        consumptions = (
            db.query(InventoryConsumption)
            .filter(InventoryConsumption.result_id == r.id)
            .all()
        )
        result_data.append(
            {
                "status": r.status,
                "reason": r.reason,
                "suggestion": r.suggestion,
                "rules": json.loads(r.rules or "[]"),
                "consumed_batches": [
                    {
                        "part_code": c.part_code,
                        "batch_no": c.batch_no,
                        "qty": c.qty,
                        "inventory_batch_id": c.inventory_batch_id,
                    }
                    for c in consumptions
                ],
            }
        )
    return {
        "order": json.loads(work.raw or "{}"),
        "results": result_data,
    }
