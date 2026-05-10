from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.export_service import ExportService

router = APIRouter(prefix="/api/v1/export", tags=["公示导出"])


@router.get("/public-results/{race_id}")
async def export_public_results(
    race_id: int,
    format_type: str = Query("CSV", description="导出格式: CSV 或 JSON"),
    include_rank: bool = Query(True, description="包含名次"),
    include_category: bool = Query(True, description="包含组别"),
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """导出公示成绩"""
    service = ExportService(db)
    result = await service.export_public_results(
        race_id=race_id,
        format_type=format_type,
        include_rank=include_rank,
        include_category=include_category,
        category=category,
    )

    if not result.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)

    if format_type == "CSV":
        return Response(
            content=result["content"],
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="race_{race_id}_results.csv"',
            },
        )

    return result


@router.get("/publication-report/{race_id}")
async def generate_publication_report(race_id: int, db: AsyncSession = Depends(get_db)):
    """生成发布报告"""
    service = ExportService(db)
    report = await service.generate_publication_report(race_id)
    return report


@router.get("/audit-trail/{race_id}")
async def get_audit_trail(
    race_id: int,
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """获取审计追踪"""
    service = ExportService(db)
    trail = await service.get_audit_trail(race_id, limit=limit)
    return trail
