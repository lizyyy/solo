from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from io import BytesIO

from app.database import get_db
from app import services, export
from app.models import PackageType

router = APIRouter(prefix="/export", tags=["数据导出"])


@router.get("/deposit-orders")
def export_deposit_orders(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    orders = services.list_deposit_orders(
        db, customer_id=customer_id, status=status,
        start_date=start_date, end_date=end_date,
        skip=0, limit=10000
    )

    if not orders:
        raise HTTPException(status_code=404, detail="没有可导出的数据")

    data = export.export_deposit_orders(db, orders)
    buffer = BytesIO(data)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="押金单汇总_{datetime.now().strftime("%Y%m%d%H%M%S")}.xlsx"'
        }
    )


@router.get("/scan-records")
def export_scan_records(
    deposit_order_id: Optional[int] = None,
    is_reversed: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    records = services.get_scan_records(
        db, deposit_order_id=deposit_order_id, is_reversed=is_reversed
    )

    if not records:
        raise HTTPException(status_code=404, detail="没有可导出的数据")

    data = export.export_scan_records(db, records)
    buffer = BytesIO(data)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="扫码归还记录_{datetime.now().strftime("%Y%m%d%H%M%S")}.xlsx"'
        }
    )


@router.get("/damage-records")
def export_damage_records(
    deposit_order_id: Optional[int] = None,
    is_reversed: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    records = services.get_damage_records(
        db, deposit_order_id=deposit_order_id, is_reversed=is_reversed
    )

    if not records:
        raise HTTPException(status_code=404, detail="没有可导出的数据")

    data = export.export_damage_records(db, records)
    buffer = BytesIO(data)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="损坏扣减记录_{datetime.now().strftime("%Y%m%d%H%M%S")}.xlsx"'
        }
    )


@router.get("/refund-orders")
def export_refund_orders(
    deposit_order_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    records = services.list_refund_orders(
        db, deposit_order_id=deposit_order_id, status=status
    )

    if not records:
        raise HTTPException(status_code=404, detail="没有可导出的数据")

    data = export.export_refund_orders(db, records)
    buffer = BytesIO(data)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="退款订单_{datetime.now().strftime("%Y%m%d%H%M%S")}.xlsx"'
        }
    )


@router.get("/history")
def export_operation_history(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    entity_no: Optional[str] = None,
    operation_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    records = services.get_operation_history(
        db, entity_type=entity_type, entity_id=entity_id,
        entity_no=entity_no, operation_type=operation_type, limit=10000
    )

    if not records:
        raise HTTPException(status_code=404, detail="没有可导出的数据")

    data = export.export_operation_history(db, records)
    buffer = BytesIO(data)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="操作历史_{datetime.now().strftime("%Y%m%d%H%M%S")}.xlsx"'
        }
    )


@router.get("/reconciliation/{batch_id}")
def export_reconciliation_batch(
    batch_id: int,
    db: Session = Depends(get_db),
):
    batches = services.get_reconciliation_batches(db, skip=0, limit=10000)
    batch = next((b for b in batches if b.id == batch_id), None)

    if not batch:
        raise HTTPException(status_code=404, detail="对账批次不存在")

    data = export.export_reconciliation_batch(db, batch)
    buffer = BytesIO(data)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="财务对账_{batch.batch_no}.xlsx"'
        }
    )
