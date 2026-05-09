from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from app.database import get_db
from app.models.user import User
from app.models.audit import FailedTask, AuditLog, ImportExportLog
from app.models.inventory import (
    PriceChange, PriceChangeHistory,
    InventoryTransfer, InventoryTransferHistory
)
from app.schemas.inventory import (
    PriceChangeCreate, PriceChangeUpdate, PriceChangeResponse, PriceChangeHistoryResponse,
    InventoryTransferCreate, InventoryTransferUpdate, InventoryTransferResponse,
    TransferItemResponse,
    FailedTaskResponse, AuditLogResponse, ImportExportLogResponse
)
from app.schemas.common import PaginatedRequest, PaginatedResponse, BatchOperationRequest, BatchOperationResult
from app.services.auth_service import get_current_user
from app.services.inventory_service import PriceChangeService, InventoryTransferService
from app.services.import_export_service import ImportExportService
from app.services.retry_service import get_failed_tasks_for_retry, manual_retry_task

router = APIRouter(prefix="/price-changes", tags=["价格调整"])


@router.post("", response_model=List[PriceChangeResponse])
def create_price_changes(
    price_change_in: PriceChangeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = []
    for item in price_change_in.items:
        price_change = PriceChangeService.create_price_change(
            db=db,
            store_id=price_change_in.store_id,
            product_id=item.product_id,
            new_cost_price=item.new_cost_price,
            new_sale_price=item.new_sale_price,
            reason=price_change_in.reason or "",
            user_id=current_user.id,
            effective_date=price_change_in.effective_date
        )
        result.append(price_change)
    return result


@router.get("", response_model=PaginatedResponse[PriceChangeResponse])
def list_price_changes(
    params: PaginatedRequest = Depends(),
    store_id: Optional[int] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(PriceChange).filter(PriceChange.is_deleted == False)

    if store_id:
        query = query.filter(PriceChange.store_id == store_id)
    if status:
        query = query.filter(PriceChange.status == status)
    if start_date:
        query = query.filter(PriceChange.created_at >= start_date)
    if end_date:
        query = query.filter(PriceChange.created_at <= end_date)

    total = query.count()
    price_changes = query.order_by(PriceChange.created_at.desc()).offset(
        (params.page - 1) * params.page_size
    ).limit(params.page_size).all()

    return {
        "code": 200,
        "message": "success",
        "data": price_changes,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size
    }


@router.get("/{price_change_id}", response_model=PriceChangeResponse)
def get_price_change(
    price_change_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    price_change = db.query(PriceChange).filter(
        PriceChange.id == price_change_id,
        PriceChange.is_deleted == False
    ).first()
    if not price_change:
        raise HTTPException(status_code=404, detail="改价单不存在")
    return price_change


@router.put("/{price_change_id}/status")
def update_price_change_status(
    price_change_id: int,
    update_data: PriceChangeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not update_data.status:
        raise HTTPException(status_code=400, detail="状态不能为空")

    price_change = PriceChangeService.update_status(
        db=db,
        price_change_id=price_change_id,
        new_status=update_data.status,
        user_id=current_user.id,
        note=update_data.reason
    )
    return {"code": 200, "message": "状态更新成功", "data": {"status": price_change.status}}


@router.post("/{price_change_id}/execute")
def execute_price_change(
    price_change_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    price_change = PriceChangeService.execute_price_change(db, price_change_id, current_user.id)
    return {"code": 200, "message": "执行成功", "data": {"price_change_id": price_change.id}}


@router.post("/{price_change_id}/retry")
def retry_price_change(
    price_change_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    price_change = PriceChangeService.retry_price_change(db, price_change_id, current_user.id)
    return {"code": 200, "message": "重试成功", "data": {"price_change_id": price_change.id}}


@router.get("/{price_change_id}/history", response_model=List[PriceChangeHistoryResponse])
def get_price_change_history(
    price_change_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(PriceChangeHistory).filter(
        PriceChangeHistory.price_change_id == price_change_id
    ).order_by(PriceChangeHistory.created_at.asc()).all()


transfer_router = APIRouter(prefix="/transfers", tags=["库存调拨"])


@transfer_router.post("", response_model=InventoryTransferResponse)
def create_transfer(
    transfer_in: InventoryTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items_dict = [{"product_id": item.product_id, "quantity": item.quantity} for item in transfer_in.items]
    return InventoryTransferService.create_transfer(
        db=db,
        source_store_id=transfer_in.source_store_id,
        target_store_id=transfer_in.target_store_id,
        items=items_dict,
        reason=transfer_in.reason or "",
        user_id=current_user.id,
        expected_arrival_date=transfer_in.expected_arrival_date
    )


@transfer_router.get("", response_model=PaginatedResponse[InventoryTransferResponse])
def list_transfers(
    params: PaginatedRequest = Depends(),
    source_store_id: Optional[int] = None,
    target_store_id: Optional[int] = None,
    status: Optional[str] = None,
    is_compensating: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(InventoryTransfer).filter(InventoryTransfer.is_deleted == False)

    if source_store_id:
        query = query.filter(InventoryTransfer.source_store_id == source_store_id)
    if target_store_id:
        query = query.filter(InventoryTransfer.target_store_id == target_store_id)
    if status:
        query = query.filter(InventoryTransfer.status == status)
    if is_compensating is not None:
        query = query.filter(InventoryTransfer.is_compensating == is_compensating)

    total = query.count()
    transfers = query.order_by(InventoryTransfer.created_at.desc()).offset(
        (params.page - 1) * params.page_size
    ).limit(params.page_size).all()

    return {
        "code": 200,
        "message": "success",
        "data": transfers,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size
    }


@transfer_router.get("/{transfer_id}", response_model=InventoryTransferResponse)
def get_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transfer = db.query(InventoryTransfer).filter(
        InventoryTransfer.id == transfer_id,
        InventoryTransfer.is_deleted == False
    ).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="调拨单不存在")
    return transfer


@transfer_router.put("/{transfer_id}/status")
def update_transfer_status(
    transfer_id: int,
    update_data: InventoryTransferUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not update_data.status:
        raise HTTPException(status_code=400, detail="状态不能为空")

    transfer = InventoryTransferService.update_status(
        db=db,
        transfer_id=transfer_id,
        new_status=update_data.status,
        user_id=current_user.id,
        note=update_data.reason
    )
    return {"code": 200, "message": "状态更新成功", "data": {"status": transfer.status}}


@transfer_router.post("/{transfer_id}/execute")
def execute_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transfer = InventoryTransferService.execute_transfer(db, transfer_id, current_user.id)
    return {"code": 200, "message": "执行成功", "data": {"transfer_id": transfer.id}}


@transfer_router.post("/{transfer_id}/retry")
def retry_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transfer = InventoryTransferService.retry_transfer(db, transfer_id, current_user.id)
    return {"code": 200, "message": "重试成功", "data": {"transfer_id": transfer.id}}


@transfer_router.post("/{transfer_id}/compensate")
def create_compensating_transfer(
    transfer_id: int,
    reason: str = Query("补偿调拨"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    transfer = InventoryTransferService.create_compensating_transfer(
        db=db,
        transfer_id=transfer_id,
        user_id=current_user.id,
        reason=reason
    )
    return {"code": 200, "message": "补偿调拨创建成功", "data": {"transfer_id": transfer.id}}


@transfer_router.get("/{transfer_id}/history")
def get_transfer_history(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(InventoryTransferHistory).filter(
        InventoryTransferHistory.transfer_id == transfer_id
    ).order_by(InventoryTransferHistory.created_at.asc()).all()


import_export_router = APIRouter(prefix="/import-export", tags=["导入导出"])


@import_export_router.post("/inventory/import")
def import_inventory(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = ImportExportService.import_inventory(db, file, current_user.id)
    return {"code": 200, "message": "导入完成", "data": result}


@import_export_router.post("/products/import")
def import_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = ImportExportService.import_products(db, file, current_user.id)
    return {"code": 200, "message": "导入完成", "data": result}


@import_export_router.get("/inventory/export")
def export_inventory(
    store_ids: Optional[List[int]] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data = ImportExportService.export_inventory(db, store_ids, "inventory")
    filename = f"inventory_export_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@import_export_router.get("/template/{module}")
def get_import_template(
    module: str,
    current_user: User = Depends(get_current_user)
):
    data = ImportExportService.get_import_export_template(module)
    filename = f"{module}_template.xlsx"
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@import_export_router.get("/logs", response_model=PaginatedResponse[ImportExportLogResponse])
def list_import_export_logs(
    params: PaginatedRequest = Depends(),
    log_type: Optional[str] = None,
    module: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ImportExportLog).filter(ImportExportLog.is_deleted == False)

    if log_type:
        query = query.filter(ImportExportLog.log_type == log_type)
    if module:
        query = query.filter(ImportExportLog.module == module)
    if status:
        query = query.filter(ImportExportLog.status == status)

    total = query.count()
    logs = query.order_by(ImportExportLog.created_at.desc()).offset(
        (params.page - 1) * params.page_size
    ).limit(params.page_size).all()

    return {
        "code": 200,
        "message": "success",
        "data": logs,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size
    }


audit_router = APIRouter(prefix="/audit", tags=["审计日志"])


@audit_router.get("/logs", response_model=PaginatedResponse[AuditLogResponse])
def list_audit_logs(
    params: PaginatedRequest = Depends(),
    user_id: Optional[int] = None,
    module: Optional[str] = None,
    action: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(AuditLog).filter(AuditLog.is_deleted == False)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if module:
        query = query.filter(AuditLog.module == module)
    if action:
        query = query.filter(AuditLog.action == action)
    if status:
        query = query.filter(AuditLog.status == status)

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset(
        (params.page - 1) * params.page_size
    ).limit(params.page_size).all()

    return {
        "code": 200,
        "message": "success",
        "data": logs,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size
    }


failed_task_router = APIRouter(prefix="/failed-tasks", tags=["失败任务"])


@failed_task_router.get("", response_model=PaginatedResponse[FailedTaskResponse])
def list_failed_tasks(
    params: PaginatedRequest = Depends(),
    task_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(FailedTask).filter(FailedTask.is_deleted == False)

    if task_type:
        query = query.filter(FailedTask.task_type == task_type)
    if status:
        query = query.filter(FailedTask.status == status)

    total = query.count()
    tasks = query.order_by(FailedTask.created_at.desc()).offset(
        (params.page - 1) * params.page_size
    ).limit(params.page_size).all()

    return {
        "code": 200,
        "message": "success",
        "data": tasks,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "total_pages": (total + params.page_size - 1) // params.page_size
    }


@failed_task_router.post("/{task_id}/retry")
def retry_failed_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = manual_retry_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"code": 200, "message": "已标记为可重试"}


@failed_task_router.post("/retry-pending")
def retry_pending_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tasks = get_failed_tasks_for_retry(db)
    count = len(tasks)
    for task in tasks:
        manual_retry_task(db, task.id)
    return {"code": 200, "message": f"已标记 {count} 个任务为可重试", "data": {"count": count}}
