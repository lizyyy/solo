from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import date, datetime

from app.database import get_db
from app.models import KilnSession, Work, KilnLoading, FiringResult
from app.schemas import (
    KilnSessionCreate,
    KilnSessionUpdate,
    KilnSessionResponse,
    KilnSessionListResponse,
    KilnLoadingCreate,
    KilnLoadingResponse,
    FiringRecordUpdate,
    ValidationResponse,
)
from app.validators import KilnValidator

router = APIRouter(prefix="/kiln-sessions", tags=["窑次管理"])


@router.post("", response_model=KilnSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_kiln_session(
    session_data: KilnSessionCreate,
    db: AsyncSession = Depends(get_db)
):
    new_session = KilnSession(**session_data.model_dump())
    db.add(new_session)
    await db.commit()
    
    result = await db.execute(
        select(KilnSession)
        .options(selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work))
        .where(KilnSession.id == new_session.id)
    )
    new_session = result.scalar_one()
    
    return new_session


@router.get("", response_model=KilnSessionListResponse)
async def list_kiln_sessions(
    is_fired: Optional[bool] = Query(None, description="是否已烧成"),
    target_temperature_zone: Optional[str] = Query(None, description="目标温区筛选"),
    scheduled_date_from: Optional[date] = Query(None, description="计划日期起始"),
    scheduled_date_to: Optional[date] = Query(None, description="计划日期截止"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db)
):
    query = select(KilnSession)
    
    if is_fired is not None:
        query = query.where(KilnSession.is_fired == is_fired)
    
    if target_temperature_zone:
        query = query.where(KilnSession.target_temperature_zone == target_temperature_zone)
    
    if scheduled_date_from:
        query = query.where(KilnSession.scheduled_firing_date >= scheduled_date_from)
    
    if scheduled_date_to:
        query = query.where(KilnSession.scheduled_firing_date <= scheduled_date_to)
    
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()
    
    offset = (page - 1) * page_size
    query = query.order_by(KilnSession.scheduled_firing_date.asc()).offset(offset).limit(page_size)
    query = query.options(selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work))
    
    result = await db.execute(query)
    sessions = result.scalars().unique().all()
    
    return KilnSessionListResponse(total=total, items=list(sessions))


@router.get("/{session_id}", response_model=KilnSessionResponse)
async def get_kiln_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KilnSession)
        .options(selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work))
        .where(KilnSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"窑次 ID {session_id} 不存在"
        )
    
    return session


@router.put("/{session_id}", response_model=KilnSessionResponse)
async def update_kiln_session(
    session_id: int,
    session_data: KilnSessionUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KilnSession)
        .options(selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work))
        .where(KilnSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"窑次 ID {session_id} 不存在"
        )
    
    if session.is_fired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已完成烧成的窑次不能修改"
        )
    
    update_data = session_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(session, key, value)
    
    await db.commit()
    await db.refresh(session)
    
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kiln_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(KilnSession).where(KilnSession.id == session_id))
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"窑次 ID {session_id} 不存在"
        )
    
    if session.is_fired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已完成烧成的窑次不能删除"
        )
    
    await db.delete(session)
    await db.commit()


@router.post("/{session_id}/validate", response_model=ValidationResponse)
async def validate_kiln_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KilnSession)
        .options(selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work))
        .where(KilnSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"窑次 ID {session_id} 不存在"
        )
    
    validation_result = KilnValidator.validate_session_consolidation(session)
    return validation_result


@router.post("/load-work", response_model=KilnLoadingResponse, status_code=status.HTTP_201_CREATED)
async def load_work_to_session(
    loading_data: KilnLoadingCreate,
    validate: bool = Query(True, description="是否执行校验"),
    db: AsyncSession = Depends(get_db)
):
    session_result = await db.execute(
        select(KilnSession)
        .options(selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work))
        .where(KilnSession.id == loading_data.kiln_session_id)
    )
    session = session_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"窑次 ID {loading_data.kiln_session_id} 不存在"
        )
    
    if session.is_fired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已完成烧成的窑次不能装载作品"
        )
    
    work_result = await db.execute(select(Work).where(Work.id == loading_data.work_id))
    work = work_result.scalar_one_or_none()
    
    if not work:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"作品 ID {loading_data.work_id} 不存在"
        )
    
    existing_loading = await db.execute(
        select(KilnLoading).where(
            KilnLoading.work_id == loading_data.work_id,
            KilnLoading.kiln_session_id == loading_data.kiln_session_id
        )
    )
    if existing_loading.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"作品 ID {loading_data.work_id} 已在该窑次中"
        )
    
    if validate:
        all_sessions_result = await db.execute(
            select(KilnSession)
            .where(
                KilnSession.is_fired == False,
                KilnSession.id != session.id
            )
        )
        all_sessions = all_sessions_result.scalars().all()
        
        validation = KilnValidator.validate_adding_work(session, work, all_sessions)
        
        if not validation.is_valid:
            error_messages = "; ".join([e.message for e in validation.errors])
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "校验失败",
                    "errors": [e.model_dump() for e in validation.errors],
                    "warnings": [w.model_dump() for w in validation.warnings]
                }
            )
    
    new_loading = KilnLoading(
        work_id=loading_data.work_id,
        kiln_session_id=loading_data.kiln_session_id,
        position_notes=loading_data.position_notes,
        loading_order=loading_data.loading_order or 0
    )
    db.add(new_loading)
    await db.commit()
    
    result = await db.execute(
        select(KilnLoading)
        .options(selectinload(KilnLoading.work))
        .where(KilnLoading.id == new_loading.id)
    )
    new_loading = result.scalar_one()
    
    return new_loading


@router.delete("/loadings/{loading_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unload_work(
    loading_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KilnLoading)
        .options(selectinload(KilnLoading.kiln_session))
        .where(KilnLoading.id == loading_id)
    )
    loading = result.scalar_one_or_none()
    
    if not loading:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"装载记录 ID {loading_id} 不存在"
        )
    
    if loading.kiln_session and loading.kiln_session.is_fired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已完成烧成的窑次不能卸载作品"
        )
    
    await db.delete(loading)
    await db.commit()


@router.post("/{session_id}/start-firing", response_model=KilnSessionResponse)
async def start_firing(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KilnSession)
        .options(selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work))
        .where(KilnSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"窑次 ID {session_id} 不存在"
        )
    
    if session.is_fired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该窑次已经开始烧成"
        )
    
    if session.current_load == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="窑次为空，不能开始烧成"
        )
    
    validation = KilnValidator.validate_session_consolidation(session)
    if not validation.is_valid:
        error_messages = "; ".join([e.message for e in validation.errors])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "烧成前校验失败",
                "errors": [e.model_dump() for e in validation.errors]
            }
        )
    
    session.firing_start_time = datetime.utcnow()
    await db.commit()
    await db.refresh(session)
    
    return session


@router.post("/{session_id}/complete-firing", response_model=KilnSessionResponse)
async def complete_firing(
    session_id: int,
    result_data: FiringRecordUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(KilnSession)
        .options(selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work))
        .where(KilnSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"窑次 ID {session_id} 不存在"
        )
    
    if session.is_fired:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该窑次已经完成烧成"
        )
    
    if not session.firing_start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="窑次尚未开始烧成，请先调用 start-firing"
        )
    
    session.is_fired = True
    session.firing_end_time = datetime.utcnow()
    session.firing_result = result_data.firing_result
    if result_data.notes:
        session.notes = result_data.notes
    
    await db.commit()
    await db.refresh(session)
    
    return session
