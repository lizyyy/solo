from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import LatencyWindow
from app.schemas import LatencyWindowCreate, LatencyWindowResponse

router = APIRouter(prefix="/api/latency-windows", tags=["迟到窗口配置"])


@router.get("", response_model=List[LatencyWindowResponse])
async def list_windows(
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    查询迟到窗口配置
    
    迟到窗口定义：
    - ingest_time - event_time > window_seconds 判定为迟到事件
    - 迟到事件会触发修正流程
    """
    conditions = []
    if is_active is not None:
        conditions.append(LatencyWindow.is_active == is_active)
    
    stmt = select(LatencyWindow)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(LatencyWindow.metric_name)
    
    result = await db.execute(stmt)
    windows = list(result.scalars().all())
    return windows


@router.post("", response_model=LatencyWindowResponse)
async def create_window(
    window_data: LatencyWindowCreate,
    db: AsyncSession = Depends(get_db)
):
    """创建迟到窗口配置"""
    stmt = select(LatencyWindow).where(LatencyWindow.metric_name == window_data.metric_name)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"指标 {window_data.metric_name} 的迟到窗口已存在，使用 PUT 更新"
        )
    
    window = LatencyWindow(
        metric_name=window_data.metric_name,
        window_seconds=window_data.window_seconds,
        description=window_data.description,
        is_active=True
    )
    db.add(window)
    await db.commit()
    await db.refresh(window)
    return window


@router.put("/{metric_name}", response_model=LatencyWindowResponse)
async def update_window(
    metric_name: str,
    window_data: LatencyWindowCreate,
    db: AsyncSession = Depends(get_db)
):
    """更新迟到窗口配置"""
    stmt = select(LatencyWindow).where(LatencyWindow.metric_name == metric_name)
    result = await db.execute(stmt)
    window = result.scalar_one_or_none()
    
    if not window:
        raise HTTPException(status_code=404, detail="迟到窗口配置不存在")
    
    window.window_seconds = window_data.window_seconds
    if window_data.description:
        window.description = window_data.description
    
    await db.commit()
    await db.refresh(window)
    return window


@router.post("/{metric_name}/activate")
async def activate_window(
    metric_name: str,
    db: AsyncSession = Depends(get_db)
):
    """启用迟到窗口"""
    stmt = select(LatencyWindow).where(LatencyWindow.metric_name == metric_name)
    result = await db.execute(stmt)
    window = result.scalar_one_or_none()
    
    if not window:
        raise HTTPException(status_code=404, detail="迟到窗口配置不存在")
    
    window.is_active = True
    await db.commit()
    
    return {"metric_name": metric_name, "is_active": True}


@router.post("/{metric_name}/deactivate")
async def deactivate_window(
    metric_name: str,
    db: AsyncSession = Depends(get_db)
):
    """停用迟到窗口（使用系统默认值）"""
    stmt = select(LatencyWindow).where(LatencyWindow.metric_name == metric_name)
    result = await db.execute(stmt)
    window = result.scalar_one_or_none()
    
    if not window:
        raise HTTPException(status_code=404, detail="迟到窗口配置不存在")
    
    window.is_active = False
    await db.commit()
    
    return {"metric_name": metric_name, "is_active": False}
