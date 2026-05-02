from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.audit import AuditService
from hazardous_gate.models.schemas import (
    ApiResponse,
    BatchCreate,
    BatchRead,
    BatchUpdate,
)
from hazardous_gate.storage import BatchCRUD, ReagentCRUD, get_async_session

router = APIRouter(prefix="/batches", tags=["批次库存管理"])

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post("", response_model=BatchRead, status_code=status.HTTP_201_CREATED)
async def create_batch(
    batch_in: BatchCreate,
    db: SessionDep,
) -> BatchRead:
    reagent = await ReagentCRUD.get_by_id(db, batch_in.reagent_id)
    if not reagent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"试剂ID {batch_in.reagent_id} 不存在",
        )

    existing = await BatchCRUD.get_by_number(db, batch_in.batch_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"批号 {batch_in.batch_number} 已存在",
        )

    batch = await BatchCRUD.create(db, batch_in)

    audit_service = AuditService(db)
    await audit_service.log_batch_create(
        batch_id=batch.id,
        batch_number=batch.batch_number,
        reagent_id=batch.reagent_id,
        initial_quantity=float(batch.initial_quantity),
    )

    result = await BatchCRUD.get_by_id(db, batch.id, load_reagent=True)
    return result


@router.get("", response_model=list[BatchRead])
async def list_batches(
    db: SessionDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    reagent_id: Optional[int] = Query(None),
    only_active: bool = Query(True),
    expiring_soon: Optional[int] = Query(None, ge=1, le=365),
    keyword: Optional[str] = Query(None),
) -> list[BatchRead]:
    batches = await BatchCRUD.get_all(
        db,
        skip=skip,
        limit=limit,
        reagent_id=reagent_id,
        only_active=only_active,
        expiring_soon=expiring_soon,
        keyword=keyword,
    )
    return list(batches)


@router.get("/count", response_model=dict)
async def count_batches(
    db: SessionDep,
    reagent_id: Optional[int] = Query(None),
    only_active: bool = Query(True),
    keyword: Optional[str] = Query(None),
) -> dict:
    count = await BatchCRUD.count(
        db,
        reagent_id=reagent_id,
        only_active=only_active,
        keyword=keyword,
    )
    return {"count": count}


@router.get("/{batch_id}", response_model=BatchRead)
async def get_batch(
    batch_id: int,
    db: SessionDep,
) -> BatchRead:
    batch = await BatchCRUD.get_by_id(db, batch_id, load_reagent=True)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次ID {batch_id} 不存在",
        )
    return batch


@router.put("/{batch_id}", response_model=BatchRead)
async def update_batch(
    batch_id: int,
    batch_in: BatchUpdate,
    db: SessionDep,
) -> BatchRead:
    batch = await BatchCRUD.get_by_id(db, batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次ID {batch_id} 不存在",
        )

    if batch_in.current_quantity is not None and batch_in.current_quantity != batch.current_quantity:
        audit_service = AuditService(db)
        await audit_service.log_batch_quantity_change(
            batch_id=batch_id,
            batch_number=batch.batch_number,
            old_quantity=float(batch.current_quantity),
            new_quantity=float(batch_in.current_quantity),
            reason="手动更新",
        )

    updated = await BatchCRUD.update(db, batch, batch_in)

    result = await BatchCRUD.get_by_id(db, updated.id, load_reagent=True)
    return result


@router.delete("/{batch_id}", response_model=ApiResponse)
async def deactivate_batch(
    batch_id: int,
    db: SessionDep,
) -> ApiResponse:
    batch = await BatchCRUD.get_by_id(db, batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"批次ID {batch_id} 不存在",
        )

    deactivated = await BatchCRUD.deactivate(db, batch_id)

    return ApiResponse(
        success=deactivated is not None,
        message="批次已停用" if deactivated else "操作失败",
    )
