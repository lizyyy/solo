"""导入路由：上传缴存 CSV、销售 JSON、备用金 CSV，触发对账。"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..services.deps import repo
from ..services.importers import (
    parse_deposit_csv,
    parse_pettycash_csv,
    parse_sales_json,
)
from ..services.reconciler import run_reconciliation


router = APIRouter()


@router.post("/deposits")
async def import_deposits(
    batch_id: UUID = Form(...),
    file: UploadFile = File(...),
    auto_reconcile: bool = Form(True),
) -> dict:
    batch = repo.get(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    text = (await file.read()).decode("utf-8-sig")
    try:
        records = parse_deposit_csv(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    batch.deposits.extend(records)
    if auto_reconcile:
        run_reconciliation(batch)
    repo.save(batch)
    return {"ok": True, "imported": len(records), "status": batch.status.value}


@router.post("/sales")
async def import_sales(
    batch_id: UUID = Form(...),
    file: UploadFile = File(...),
    auto_reconcile: bool = Form(True),
) -> dict:
    batch = repo.get(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    text = (await file.read()).decode("utf-8-sig")
    try:
        records = parse_sales_json(text)
    except (ValueError, Exception) as exc:
        raise HTTPException(status_code=400, detail=f"销售 JSON 解析失败: {exc}")
    batch.sales.extend(records)
    if auto_reconcile:
        run_reconciliation(batch)
    repo.save(batch)
    return {"ok": True, "imported": len(records), "status": batch.status.value}


@router.post("/petty-cash")
async def import_petty_cash(
    batch_id: UUID = Form(...),
    file: UploadFile = File(...),
    auto_reconcile: bool = Form(True),
) -> dict:
    batch = repo.get(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    text = (await file.read()).decode("utf-8-sig")
    try:
        records = parse_pettycash_csv(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    batch.petty_cash.extend(records)
    if auto_reconcile:
        run_reconciliation(batch)
    repo.save(batch)
    return {"ok": True, "imported": len(records), "status": batch.status.value}


@router.post("/run-reconciliation/{batch_id}")
def run_recon(batch_id: UUID) -> dict:
    batch = repo.get(batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="批次不存在")
    run_reconciliation(batch)
    repo.save(batch)
    return {"ok": True, "discrepancies": len(batch.discrepancies), "status": batch.status.value}
