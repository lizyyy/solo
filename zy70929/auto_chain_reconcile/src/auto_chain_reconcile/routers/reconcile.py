from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from auto_chain_reconcile.db import get_db
from auto_chain_reconcile.models import (
    InventoryBatch,
    Package,
    ReconcileBatch,
    ReconcileResult,
    WorkOrder,
)
from auto_chain_reconcile.parsers import (
    parse_inventory_csv,
    parse_packages_csv,
    parse_work_orders_json,
)
from auto_chain_reconcile.rules import evaluate_order
from auto_chain_reconcile.schemas import (
    ReconcileOrderOut,
    ReconcileResponse,
)

router = APIRouter()


def _build_response(batch: ReconcileBatch, db: Session) -> ReconcileResponse:
    rows = (
        db.query(ReconcileResult)
        .filter(ReconcileResult.batch_id == batch.id)
        .all()
    )
    normal, pending, failed = [], [], []
    for r in rows:
        out = ReconcileOrderOut(
            order_id=r.order_id,
            status=r.status,
            reason=r.reason,
            suggestion=r.suggestion,
            matched_package_id=r.package_id or None,
            raw=json.loads(r.raw or "{}"),
            rules=json.loads(r.rules or "[]"),
        )
        if r.status == "normal":
            normal.append(out)
        elif r.status == "pending":
            pending.append(out)
        else:
            failed.append(out)
    return ReconcileResponse(
        batch_key=batch.batch_key,
        store_id=json.loads(batch.source_summary or "{}").get("store_id", ""),
        summary={"normal": len(normal), "pending": len(pending), "failed": len(failed)},
        normal=normal,
        pending=pending,
        failed=failed,
    )


@router.post("/multipart", response_model=ReconcileResponse)
async def reconcile_multipart(
    batch_key: str = Form(...),
    store_id: str = Form(...),
    packages_file: UploadFile | None = File(default=None, description="套餐 CSV"),
    work_orders_file: UploadFile | None = File(default=None, description="工单 JSON"),
    inventory_file: UploadFile | None = File(default=None, description="配件库存 CSV"),
    db: Session = Depends(get_db),
) -> ReconcileResponse:
    pkg_rows: list[dict[str, Any]] = []
    wo_rows: list[dict[str, Any]] = []
    inv_rows: list[dict[str, Any]] = []
    if packages_file is not None:
        pkg_rows = parse_packages_csv((await packages_file.read()).decode("utf-8"))
    if work_orders_file is not None:
        wo_rows = parse_work_orders_json((await work_orders_file.read()).decode("utf-8"))
    if inventory_file is not None:
        inv_rows = parse_inventory_csv((await inventory_file.read()).decode("utf-8"))
    return _run_reconcile(batch_key, store_id, pkg_rows, wo_rows, inv_rows, db)


@router.post("/json", response_model=ReconcileResponse)
async def reconcile_json(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
) -> ReconcileResponse:
    batch_key = str(payload.get("batch_key", "")).strip()
    store_id = str(payload.get("store_id", "")).strip()
    if not batch_key or not store_id:
        raise HTTPException(status_code=400, detail="batch_key 和 store_id 必填")
    return _run_reconcile(
        batch_key,
        store_id,
        list(payload.get("packages") or []),
        list(payload.get("work_orders") or []),
        list(payload.get("inventory") or []),
        db,
    )


def _run_reconcile(
    batch_key: str,
    store_id: str,
    pkg_rows: list[dict[str, Any]],
    wo_rows: list[dict[str, Any]],
    inv_rows: list[dict[str, Any]],
    db: Session,
) -> ReconcileResponse:
    existing = db.query(ReconcileBatch).filter(ReconcileBatch.batch_key == batch_key).first()
    if existing is not None:
        return _build_response(existing, db)

    batch = ReconcileBatch(
        batch_key=batch_key,
        source_summary=json.dumps(
            {
                "store_id": store_id,
                "packages": len(pkg_rows),
                "work_orders": len(wo_rows),
                "inventory": len(inv_rows),
            },
            ensure_ascii=False,
        ),
        status="processing",
    )
    db.add(batch)
    db.flush()

    packages: list[Package] = []
    for p in pkg_rows:
        pkg = Package(
            package_id=str(p.get("package_id") or ""),
            customer_id=str(p.get("customer_id") or ""),
            customer_name=str(p.get("customer_name") or ""),
            item_code=str(p.get("item_code") or ""),
            item_name=str(p.get("item_name") or ""),
            allowed_store=str(p.get("allowed_store") or "*"),
            total_qty=int(p.get("total_qty") or 1),
            used_qty=int(p.get("used_qty") or 0),
            batch_id=batch.id,
            raw=json.dumps(p, ensure_ascii=False),
        )
        db.add(pkg)
        packages.append(pkg)

    work_orders: list[WorkOrder] = []
    for o in wo_rows:
        w = WorkOrder(
            order_id=str(o.get("order_id") or ""),
            customer_id=str(o.get("customer_id") or ""),
            store_id=str(o.get("store_id") or store_id),
            item_code=str(o.get("item_code") or ""),
            item_name=str(o.get("item_name") or ""),
            qty=int(o.get("qty") or 1),
            parts=json.dumps(o.get("parts") or [], ensure_ascii=False),
            batch_id=batch.id,
            raw=json.dumps(o, ensure_ascii=False),
        )
        db.add(w)
        work_orders.append(w)

    inventory: list[InventoryBatch] = []
    for inv in inv_rows:
        ib = InventoryBatch(
            part_code=str(inv.get("part_code") or ""),
            part_name=str(inv.get("part_name") or ""),
            batch_no=str(inv.get("batch_no") or ""),
            supplier=str(inv.get("supplier") or ""),
            inbound_date=str(inv.get("inbound_date") or ""),
            store_id=str(inv.get("store_id") or store_id),
            initial_qty=int(inv.get("initial_qty") or 0),
            remaining_qty=int(inv.get("remaining_qty") or inv.get("initial_qty") or 0),
            batch_id=batch.id,
            raw=json.dumps(inv, ensure_ascii=False),
        )
        db.add(ib)
        inventory.append(ib)
    db.flush()

    # 按工单逐条评估
    for order in work_orders:
        order_dict = json.loads(order.raw or "{}")
        decision = evaluate_order(order_dict, store_id, packages, inventory)
        row = decision.to_result_row(batch.id)
        if decision.package_to_consume is not None and decision.status != "failed":
            decision.package_to_consume.used_qty += decision.package_used_qty_delta
        for inv_id, delta in (decision.inventory_delta or {}).items():
            if delta:
                invb = next((x for x in inventory if x.id == inv_id), None)
                if invb is not None:
                    invb.remaining_qty += delta
        db.add(row)

    batch.status = "done"
    db.commit()
    return _build_response(batch, db)
