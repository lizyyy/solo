from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Ranking, RankingType
from app.schemas import RankingResponse, RankingReplayRequest
from app.services.metrics_service import MetricsService

router = APIRouter(prefix="/api/rankings", tags=["榜单管理"])


@router.get("", response_model=List[RankingResponse])
async def list_rankings(
    ranking_type: RankingType = Query(RankingType.DAILY, description="榜单类型"),
    metric_name: str = Query(..., description="指标名称"),
    ranking_date: datetime = Query(..., description="榜单日期"),
    is_latest_only: bool = Query(True, description="只查最新版本"),
    top_n: Optional[int] = Query(None, description="返回前N名"),
    db: AsyncSession = Depends(get_db)
):
    """
    查询榜单
    
    注意：默认只返回最新版本（is_latest=True），与指标快照保持一致。
    如果需要查看历史版本（如回放前后对比），设置 is_latest_only=False。
    """
    ranking_date = ranking_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    conditions = [
        Ranking.ranking_type == ranking_type,
        Ranking.metric_name == metric_name,
        Ranking.ranking_date == ranking_date
    ]
    if is_latest_only:
        conditions.append(Ranking.is_latest == True)

    stmt = select(Ranking).where(and_(*conditions)).order_by(Ranking.rank)
    if top_n:
        stmt = stmt.limit(top_n)
    
    result = await db.execute(stmt)
    rankings = list(result.scalars().all())
    return rankings


@router.get("/history/{ranking_type}/{metric_name}/{ranking_date}", response_model=List[RankingResponse])
async def get_ranking_history(
    ranking_type: RankingType,
    metric_name: str,
    ranking_date: datetime,
    db: AsyncSession = Depends(get_db)
):
    """查询某个榜单的所有历史版本（用于对比回放前后变化）"""
    ranking_date = ranking_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    stmt = select(Ranking).where(
        and_(
            Ranking.ranking_type == ranking_type,
            Ranking.metric_name == metric_name,
            Ranking.ranking_date == ranking_date
        )
    ).order_by(Ranking.version.desc(), Ranking.rank)
    
    result = await db.execute(stmt)
    rankings = list(result.scalars().all())
    return rankings


@router.post("/replay")
async def replay_ranking(
    request: RankingReplayRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    回放榜单（兜底机制）
    
    说明：
    1. 通常情况下，迟到事件修正会自动触发榜单回放
    2. 此接口用于手动触发回放（如修复后需要重新计算排名）
    3. 会基于最新的指标快照重新计算排名
    4. 旧版本会被归档（is_latest=False），新版本会被标记为最新
    """
    result = await MetricsService.replay_ranking(
        db, 
        request.ranking_type, 
        request.metric_name, 
        request.ranking_date
    )
    return result


@router.get("/compare/{ranking_type}/{metric_name}/{ranking_date}")
async def compare_ranking_versions(
    ranking_type: RankingType,
    metric_name: str,
    ranking_date: datetime,
    db: AsyncSession = Depends(get_db)
):
    """对比榜单的不同版本，查看哪些实体排名发生了变化"""
    ranking_date = ranking_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    stmt = select(Ranking).where(
        and_(
            Ranking.ranking_type == ranking_type,
            Ranking.metric_name == metric_name,
            Ranking.ranking_date == ranking_date
        )
    ).order_by(Ranking.version, Ranking.rank)
    
    result = await db.execute(stmt)
    all_rankings = list(result.scalars().all())
    
    if not all_rankings:
        return {"versions": [], "changes": []}
    
    versions = {}
    for r in all_rankings:
        if r.version not in versions:
            versions[r.version] = {}
        versions[r.version][r.entity_id] = {"rank": r.rank, "value": r.value}
    
    version_list = sorted(versions.keys())
    changes = []
    
    if len(version_list) >= 2:
        for entity_id in set(versions[version_list[-1]].keys()) | set(versions[version_list[-2]].keys()):
            old_info = versions[version_list[-2]].get(entity_id)
            new_info = versions[version_list[-1]].get(entity_id)
            
            if old_info and new_info:
                if old_info["rank"] != new_info["rank"] or old_info["value"] != new_info["value"]:
                    changes.append({
                        "entity_id": entity_id,
                        "old_rank": old_info["rank"],
                        "new_rank": new_info["rank"],
                        "rank_change": old_info["rank"] - new_info["rank"],
                        "old_value": old_info["value"],
                        "new_value": new_info["value"],
                        "value_change": new_info["value"] - old_info["value"]
                    })
            elif old_info and not new_info:
                changes.append({
                    "entity_id": entity_id,
                    "old_rank": old_info["rank"],
                    "new_rank": None,
                    "rank_change": None,
                    "old_value": old_info["value"],
                    "new_value": None,
                    "value_change": None,
                    "status": "removed"
                })
            elif not old_info and new_info:
                changes.append({
                    "entity_id": entity_id,
                    "old_rank": None,
                    "new_rank": new_info["rank"],
                    "rank_change": None,
                    "old_value": None,
                    "new_value": new_info["value"],
                    "value_change": None,
                    "status": "added"
                })
    
    return {
        "versions": version_list,
        "version_count": len(version_list),
        "changes": sorted(changes, key=lambda x: abs(x.get("rank_change") or 999), reverse=True)
    }
