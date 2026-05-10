from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.exception import ExceptionRecordResponse, ExceptionRecordCreate
from app.services.exception_service import ExceptionService

router = APIRouter(prefix="/api/v1/exceptions", tags=["异常记录"])


@router.post("/", response_model=ExceptionRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_exception(exception_data: ExceptionRecordCreate, db: AsyncSession = Depends(get_db)):
    """创建异常记录"""
    service = ExceptionService(db)
    exception = await service.create_exception(
        exception_type=exception_data.exception_type,
        title=exception_data.title,
        source_module=exception_data.source_module,
        severity=exception_data.severity,
        description=exception_data.description,
        raw_data=exception_data.raw_data,
        related_record_id=exception_data.related_record_id,
        related_record_type=exception_data.related_record_type,
    )
    await db.commit()
    return exception


@router.get("/", response_model=List[ExceptionRecordResponse])
async def list_exceptions(
    status: Optional[str] = None,
    exception_type: Optional[str] = None,
    severity: Optional[str] = None,
    related_record_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """列出异常记录"""
    service = ExceptionService(db)
    exceptions = await service.list_exceptions(
        status=status,
        exception_type=exception_type,
        severity=severity,
        related_record_id=related_record_id,
        limit=limit,
        offset=offset,
    )
    return exceptions


@router.get("/{exception_id}", response_model=ExceptionRecordResponse)
async def get_exception(exception_id: int, db: AsyncSession = Depends(get_db)):
    """获取单条异常记录"""
    service = ExceptionService(db)
    exception = await service.get_exception(exception_id)
    if not exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="异常记录不存在")
    return exception


@router.post("/{exception_id}/handle", response_model=ExceptionRecordResponse)
async def handle_exception(
    exception_id: int,
    handled_by: str = Query(..., description="处理人"),
    resolution_notes: str = Query(..., description="处理说明"),
    new_status: str = Query("RESOLVED", description="新状态"),
    db: AsyncSession = Depends(get_db),
):
    """处理异常记录"""
    service = ExceptionService(db)
    exception = await service.handle_exception(
        exception_id=exception_id,
        handled_by=handled_by,
        resolution_notes=resolution_notes,
        status=new_status,
    )
    if not exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="异常记录不存在")
    await db.commit()
    return exception


@router.post("/{exception_id}/ignore", response_model=ExceptionRecordResponse)
async def ignore_exception(
    exception_id: int,
    handled_by: str = Query(..., description="处理人"),
    reason: str = Query(..., description="忽略原因"),
    db: AsyncSession = Depends(get_db),
):
    """忽略异常记录"""
    service = ExceptionService(db)
    exception = await service.ignore_exception(
        exception_id=exception_id,
        handled_by=handled_by,
        reason=reason,
    )
    if not exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="异常记录不存在")
    await db.commit()
    return exception


@router.get("/stats")
async def get_exception_stats(
    status: Optional[str] = None,
    exception_type: Optional[str] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """获取异常统计"""
    service = ExceptionService(db)
    count = await service.count_exceptions(
        status=status,
        exception_type=exception_type,
        severity=severity,
    )
    return {
        "filter": {
            "status": status,
            "exception_type": exception_type,
            "severity": severity,
        },
        "count": count,
    }
