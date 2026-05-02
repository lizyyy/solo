from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.audit import AuditService
from hazardous_gate.models.schemas import (
    ApiResponse,
    BatchCreate,
    BatchRead,
    BatchUpdate,
    ReagentCreate,
    ReagentRead,
    ReagentUpdate,
)
from hazardous_gate.storage import BatchCRUD, ReagentCRUD, get_async_session

router = APIRouter(prefix="/reagents", tags=["试剂管理"])

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]


@router.post("", response_model=ReagentRead, status_code=status.HTTP_201_CREATED)
async def create_reagent(
    reagent_in: ReagentCreate,
    db: SessionDep,
) -> ReagentRead:
    existing = await ReagentCRUD.get_by_cas(db, reagent_in.cas_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"CAS号 {reagent_in.cas_number} 已存在",
        )

    reagent = await ReagentCRUD.create(db, reagent_in)

    audit_service = AuditService(db)
    await audit_service.log_reagent_create(
        reagent_id=reagent.id,
        reagent_name=reagent.name,
        cas_number=reagent.cas_number,
    )

    return reagent


@router.get("", response_model=list[ReagentRead])
async def list_reagents(
    db: SessionDep,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    hazard_level: Optional[str] = Query(None),
    storage_group: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
) -> list[ReagentRead]:
    reagents = await ReagentCRUD.get_all(
        db,
        skip=skip,
        limit=limit,
        hazard_level=hazard_level,
        storage_group=storage_group,
        keyword=keyword,
    )
    return list(reagents)


@router.get("/count", response_model=dict)
async def count_reagents(
    db: SessionDep,
    hazard_level: Optional[str] = Query(None),
    storage_group: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
) -> dict:
    count = await ReagentCRUD.count(
        db,
        hazard_level=hazard_level,
        storage_group=storage_group,
        keyword=keyword,
    )
    return {"count": count}


@router.get("/{reagent_id}", response_model=ReagentRead)
async def get_reagent(
    reagent_id: int,
    db: SessionDep,
) -> ReagentRead:
    reagent = await ReagentCRUD.get_by_id(db, reagent_id)
    if not reagent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"试剂ID {reagent_id} 不存在",
        )
    return reagent


@router.put("/{reagent_id}", response_model=ReagentRead)
async def update_reagent(
    reagent_id: int,
    reagent_in: ReagentUpdate,
    db: SessionDep,
) -> ReagentRead:
    reagent = await ReagentCRUD.get_by_id(db, reagent_id)
    if not reagent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"试剂ID {reagent_id} 不存在",
        )

    updated = await ReagentCRUD.update(db, reagent, reagent_in)

    audit_service = AuditService(db)
    changes = reagent_in.model_dump(exclude_unset=True)
    await audit_service.log_reagent_update(
        reagent_id=reagent_id,
        changes=changes,
    )

    return updated


@router.delete("/{reagent_id}", response_model=ApiResponse)
async def delete_reagent(
    reagent_id: int,
    db: SessionDep,
) -> ApiResponse:
    reagent = await ReagentCRUD.get_by_id(db, reagent_id)
    if not reagent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"试剂ID {reagent_id} 不存在",
        )

    batches = await BatchCRUD.get_by_reagent(db, reagent_id, only_active=False)
    if batches:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"该试剂下存在{len(batches)}个批次，无法删除",
        )

    reagent_name = reagent.name
    cas_number = reagent.cas_number

    deleted = await ReagentCRUD.delete(db, reagent_id)

    if deleted:
        audit_service = AuditService(db)
        await audit_service.log_reagent_delete(
            reagent_id=reagent_id,
            reagent_name=reagent_name,
            cas_number=cas_number,
        )

    return ApiResponse(
        success=deleted,
        message="删除成功" if deleted else "删除失败",
    )


@router.get("/{reagent_id}/batches", response_model=list[BatchRead])
async def get_reagent_batches(
    reagent_id: int,
    db: SessionDep,
    only_active: bool = Query(True),
) -> list[BatchRead]:
    reagent = await ReagentCRUD.get_by_id(db, reagent_id)
    if not reagent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"试剂ID {reagent_id} 不存在",
        )

    batches = await BatchCRUD.get_by_reagent(db, reagent_id, only_active=only_active)
    return list(batches)
