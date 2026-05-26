from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
import io

from app.core.database import get_db
from app import schemas
from app.services import (
    create_batch, list_batches, get_batch,
    process_batch, return_batch,
    parse_add_item_csv, parse_package_json, parse_unit_contract,
    apply_coupon_stack, apply_refund, apply_unit_limit,
    export_records_csv,
)

router = APIRouter(prefix="/batches", tags=["批次"])


@router.post("", response_model=schemas.BatchResp, summary="新增批次")
def api_create_batch(data: schemas.BatchCreate, db: Session = Depends(get_db)):
    batch = create_batch(db, data)
    return batch


@router.get("", response_model=schemas.BatchListResp, summary="查询批次历史")
def api_list_batches(
    status: Optional[str] = None,
    source_type: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
):
    total, items = list_batches(db, status=status, source_type=source_type, skip=skip, limit=limit)
    return {"total": total, "items": items}


@router.get("/{batch_id}", response_model=schemas.BatchResp, summary="批次详情")
def api_get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = get_batch(db, batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")
    return batch


@router.post("/{batch_id}/process", response_model=schemas.BatchResp, summary="标记批次处理完成")
def api_process_batch(batch_id: int, data: schemas.BatchProcess, db: Session = Depends(get_db)):
    batch = process_batch(db, batch_id, data)
    if not batch:
        raise HTTPException(404, "批次不存在")
    return batch


@router.post("/{batch_id}/return", response_model=schemas.BatchResp, summary="退回批次")
def api_return_batch(batch_id: int, data: schemas.BatchReturn, db: Session = Depends(get_db)):
    batch = return_batch(db, batch_id, data)
    if not batch:
        raise HTTPException(404, "批次不存在")
    return batch


@router.post("/{batch_id}/import/add-item", summary="导入加项 CSV")
def api_import_add_item(
    batch_id: int,
    operator: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    batch = get_batch(db, batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")
    content = file.file.read().decode("utf-8-sig")
    parse_add_item_csv(db, batch, content, operator)
    return {"ok": True, "batch": batch.batch_no}


@router.post("/{batch_id}/import/package", summary="导入套餐 JSON")
def api_import_package(
    batch_id: int,
    operator: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    import json
    batch = get_batch(db, batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")
    data_obj = json.loads(file.file.read().decode("utf-8"))
    parse_package_json(db, batch, data_obj, operator)
    return {"ok": True, "batch": batch.batch_no}


@router.post("/{batch_id}/import/contract", summary="导入单位协议 JSON")
def api_import_contract(
    batch_id: int,
    operator: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    import json
    batch = get_batch(db, batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")
    data_obj = json.loads(file.file.read().decode("utf-8"))
    parse_unit_contract(db, batch, data_obj, operator)
    return {"ok": True, "batch": batch.batch_no}


@router.post("/{batch_id}/coupon", summary="券叠加处理")
def api_coupon(
    batch_id: int,
    record_id: int = Form(...),
    coupon_amount: float = Form(...),
    operator: str = Form(...),
    db: Session = Depends(get_db),
):
    batch = get_batch(db, batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")
    from app.services import get_record
    rec = get_record(db, record_id)
    if not rec:
        raise HTTPException(404, "记录不存在")
    apply_coupon_stack(db, rec, coupon_amount, operator)
    return {"ok": True, "record": rec.record_no}


@router.post("/{batch_id}/refund", summary="退项冲正")
def api_refund(
    batch_id: int,
    record_id: int = Form(...),
    refund_amount: float = Form(...),
    reason: str = Form(...),
    operator: str = Form(...),
    db: Session = Depends(get_db),
):
    batch = get_batch(db, batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")
    from app.services import get_record
    rec = get_record(db, record_id)
    if not rec:
        raise HTTPException(404, "记录不存在")
    apply_refund(db, rec, refund_amount, operator, reason)
    return {"ok": True, "record": rec.record_no}


@router.post("/{batch_id}/unit-limit", summary="单位限额")
def api_unit_limit(
    batch_id: int,
    contract_id: str = Form(...),
    limit: float = Form(...),
    operator: str = Form(...),
    db: Session = Depends(get_db),
):
    batch = get_batch(db, batch_id)
    if not batch:
        raise HTTPException(404, "批次不存在")
    apply_unit_limit(db, contract_id, operator, limit)
    return {"ok": True, "contract_id": contract_id}


@router.get("/{batch_id}/export", summary="导出批次明细 CSV")
def api_export(
    batch_id: int,
    db: Session = Depends(get_db),
):
    csv_content = export_records_csv(db, batch_id=batch_id)
    buf = io.BytesIO(csv_content.encode("utf-8-sig"))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=batch_{batch_id}.csv"},
    )
