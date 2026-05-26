from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auto_chain_reconcile.db import get_db
from auto_chain_reconcile.models import InventoryBatch, ReconcileResult, WorkOrder
from auto_chain_reconcile.schemas import TracePartOut

router = APIRouter()


@router.get("/part/{part_code}", response_model=list[TracePartOut])
def trace_part(
    part_code: str,
    store_id: str | None = None,
    order_id: str | None = None,
    db: Session = Depends(get_db),
) -> list[TracePartOut]:
    q = db.query(InventoryBatch).filter(InventoryBatch.part_code == part_code)
    if store_id:
        q = q.filter(InventoryBatch.store_id == store_id)
    batches = q.order_by(InventoryBatch.inbound_date.asc()).all()
    if not batches:
        raise HTTPException(status_code=404, detail="未找到该配件批次记录")

    consumed_by: dict[str, list[str]] = {}
    if order_id:
        work = db.query(WorkOrder).filter(WorkOrder.order_id == order_id).first()
        if work is None:
            raise HTTPException(status_code=404, detail="未找到该工单")
        results = (
            db.query(ReconcileResult)
            .filter(ReconcileResult.order_id == order_id, ReconcileResult.status == "normal")
            .all()
        )
        for r in results:
            import json
            raw = json.loads(r.raw or "{}")
            for p in raw.get("parts") or []:
                if p.get("part_code") == part_code:
                    for b in batches:
                        key = f"{b.part_code}|{b.batch_no}|{b.store_id}"
                        consumed_by.setdefault(key, []).append(order_id)

    out: list[TracePartOut] = []
    for b in batches:
        key = f"{b.part_code}|{b.batch_no}|{b.store_id}"
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
                consumed_by_orders=consumed_by.get(key, []),
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
    return {
        "order": json.loads(work.raw or "{}"),
        "results": [
            {
                "status": r.status,
                "reason": r.reason,
                "suggestion": r.suggestion,
                "rules": json.loads(r.rules or "[]"),
            }
            for r in results
        ],
    }
