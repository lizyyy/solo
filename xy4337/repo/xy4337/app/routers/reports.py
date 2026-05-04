from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from datetime import date, timedelta, datetime
from fastapi.responses import PlainTextResponse

from app.database import get_db
from app.models import Work, KilnSession, KilnLoading, FiringResult, DrynessStatus
from app.schemas import DelayedWorkResponse, WorkResponse
from app.config import settings

router = APIRouter(prefix="/reports", tags=["报告管理"])


@router.get("/delayed-works", response_model=List[DelayedWorkResponse])
async def get_delayed_works(
    include_fired: bool = Query(False, description="是否包含已烧成的作品"),
    db: AsyncSession = Depends(get_db)
):
    today = date.today()
    
    query = select(Work).where(Work.expected_pickup_date < today)
    
    if not include_fired:
        loaded_works_subquery = select(KilnLoading.work_id).where(
            KilnLoading.kiln_session_id.in_(
                select(KilnSession.id).where(KilnSession.is_fired == True)
            )
        )
        query = query.where(Work.id.not_in(loaded_works_subquery))
    
    query = query.order_by(Work.expected_pickup_date.asc())
    result = await db.execute(query)
    works = result.scalars().all()
    
    delayed_works = []
    for work in works:
        delay_days = (today - work.expected_pickup_date).days
        
        latest_session_query = select(KilnSession).join(
            KilnLoading, KilnLoading.kiln_session_id == KilnSession.id
        ).where(
            KilnLoading.work_id == work.id,
            KilnSession.is_fired == False
        ).order_by(KilnSession.scheduled_firing_date.desc()).limit(1)
        
        latest_result = await db.execute(latest_session_query)
        latest_session = latest_result.scalar_one_or_none()
        
        delayed_work = DelayedWorkResponse(
            id=work.id,
            student_name=work.student_name,
            work_description=work.work_description,
            dryness_status=work.dryness_status,
            glaze_type=work.glaze_type,
            expected_pickup_date=work.expected_pickup_date,
            temperature_zone=work.temperature_zone,
            is_dry=work.is_dry,
            is_delayed=work.is_delayed,
            created_at=work.created_at,
            updated_at=work.updated_at,
            delay_days=delay_days,
            latest_session_date=latest_session.scheduled_firing_date if latest_session else None
        )
        delayed_works.append(delayed_work)
    
    return delayed_works


@router.get("/handover", response_class=PlainTextResponse)
async def generate_handover_report(
    date: Optional[date] = Query(None, description="交接报告日期，默认为今天"),
    include_past_sessions: bool = Query(False, description="是否包含过去已完成的窑次"),
    db: AsyncSession = Depends(get_db)
):
    report_date = date or date.today()
    
    lines = []
    lines.append(f"# 陶艺工作室烧窑交接报告")
    lines.append(f"")
    lines.append(f"**报告日期**: {report_date.strftime('%Y年%m月%d日')}")
    lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")
    
    lines.append(f"## 一、今日统计")
    lines.append(f"")
    
    works_count_result = await db.execute(select(func.count()).select_from(Work))
    total_works = works_count_result.scalar_one()
    
    not_dry_result = await db.execute(
        select(func.count()).select_from(Work).where(
            Work.dryness_status != DrynessStatus.DRY
        )
    )
    not_dry_count = not_dry_result.scalar_one()
    
    today_plus_7 = report_date + timedelta(days=7)
    upcoming_pickup_result = await db.execute(
        select(func.count()).select_from(Work).where(
            Work.expected_pickup_date >= report_date,
            Work.expected_pickup_date <= today_plus_7
        )
    )
    upcoming_pickup_count = upcoming_pickup_result.scalar_one()
    
    delayed_result = await db.execute(
        select(func.count()).select_from(Work).where(
            Work.expected_pickup_date < report_date
        )
    )
    delayed_count = delayed_result.scalar_one()
    
    lines.append(f"- **总作品数**: {total_works} 件")
    lines.append(f"- **未干透作品**: {not_dry_count} 件")
    lines.append(f"- **未来7天待取件**: {upcoming_pickup_count} 件")
    lines.append(f"- **已延期作品**: {delayed_count} 件")
    lines.append(f"")
    
    lines.append(f"---")
    lines.append(f"")
    
    lines.append(f"## 二、待安排窑次")
    lines.append(f"")
    
    pending_sessions_query = select(KilnSession).where(
        KilnSession.is_fired == False
    ).order_by(KilnSession.scheduled_firing_date.asc())
    pending_sessions_query = pending_sessions_query.options(
        selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work)
    )
    pending_result = await db.execute(pending_sessions_query)
    pending_sessions = pending_result.scalars().unique().all()
    
    if pending_sessions:
        for session in pending_sessions:
            status_emoji = "✅" if session.is_ready_to_fire else ("⚠️" if session.is_overloaded else "⏳")
            lines.append(f"### {status_emoji} 窑次: {session.session_name}")
            lines.append(f"")
            lines.append(f"- **ID**: {session.id}")
            lines.append(f"- **目标温区**: {session.target_temperature_zone}")
            lines.append(f"- **计划烧成日期**: {session.scheduled_firing_date.strftime('%Y-%m-%d')}")
            lines.append(f"- **当前装载量**: {session.current_load} / {session.max_capacity} 件")
            
            if session.current_load > 0:
                lines.append(f"- **装载作品**:")
                for loading in sorted(session.kiln_loadings, key=lambda x: x.loading_order):
                    work = loading.work
                    dry_status = "✅已干透" if work.is_dry else f"⚠️{work.dryness_status.value}"
                    lines.append(f"  - #{work.id} {work.student_name} - {work.glaze_type} ({dry_status})")
            
            lines.append(f"")
    else:
        lines.append(f"暂无待安排的窑次。")
        lines.append(f"")
    
    lines.append(f"---")
    lines.append(f"")
    
    lines.append(f"## 三、延期作品名单")
    lines.append(f"")
    
    delayed_works = await get_delayed_works(include_fired=False, db=db)
    
    if delayed_works:
        lines.append(f"| 作品ID | 学员姓名 | 期望取件日 | 延期天数 | 干燥状态 | 温区 | 安排状态 |")
        lines.append(f"|--------|----------|------------|----------|----------|------|----------|")
        
        for work in delayed_works:
            scheduled = "已安排" if work.latest_session_date else "未安排"
            lines.append(
                f"| {work.id} | {work.student_name} | {work.expected_pickup_date.strftime('%Y-%m-%d')} | "
                f"{work.delay_days}天 | {work.dryness_status.value} | {work.temperature_zone} | {scheduled} |"
            )
    else:
        lines.append(f"暂无延期作品。")
    
    lines.append(f"")
    
    lines.append(f"---")
    lines.append(f"")
    
    lines.append(f"## 四、未干透作品")
    lines.append(f"")
    
    not_dry_query = select(Work).where(
        Work.dryness_status != DrynessStatus.DRY
    ).order_by(Work.created_at.asc())
    not_dry_result = await db.execute(not_dry_query)
    not_dry_works = not_dry_result.scalars().all()
    
    if not_dry_works:
        lines.append(f"| 作品ID | 学员姓名 | 干燥状态 | 温区 | 期望取件日 |")
        lines.append(f"|--------|----------|----------|------|------------|")
        
        for work in not_dry_works:
            lines.append(
                f"| {work.id} | {work.student_name} | {work.dryness_status.value} | "
                f"{work.temperature_zone} | {work.expected_pickup_date.strftime('%Y-%m-%d')} |"
            )
    else:
        lines.append(f"所有作品均已干透。")
    
    lines.append(f"")
    
    lines.append(f"---")
    lines.append(f"")
    
    lines.append(f"## 五、近期已完成窑次")
    lines.append(f"")
    
    recent_fired_query = select(KilnSession).where(
        KilnSession.is_fired == True
    ).order_by(KilnSession.firing_end_time.desc()).limit(5)
    recent_fired_query = recent_fired_query.options(
        selectinload(KilnSession.kiln_loadings).selectinload(KilnLoading.work)
    )
    recent_fired_result = await db.execute(recent_fired_query)
    recent_fired_sessions = recent_fired_result.scalars().unique().all()
    
    if recent_fired_sessions:
        for session in recent_fired_sessions:
            result_emoji = {
                FiringResult.SUCCESS: "✅",
                FiringResult.PARTIAL_SUCCESS: "⚠️",
                FiringResult.FAILURE: "❌"
            }.get(session.firing_result, "❓")
            
            result_text = {
                FiringResult.SUCCESS: "成功",
                FiringResult.PARTIAL_SUCCESS: "部分成功",
                FiringResult.FAILURE: "失败"
            }.get(session.firing_result, "未知")
            
            lines.append(f"### {result_emoji} 窑次: {session.session_name}")
            lines.append(f"")
            lines.append(f"- **烧成结果**: {result_text}")
            lines.append(f"- **温区**: {session.target_temperature_zone}")
            lines.append(f"- **作品数**: {session.current_load} 件")
            if session.notes:
                lines.append(f"- **备注**: {session.notes}")
            lines.append(f"")
    else:
        lines.append(f"暂无已完成的窑次记录。")
        lines.append(f"")
    
    lines.append(f"---")
    lines.append(f"")
    lines.append(f"*此报告由系统自动生成*")
    
    return "\n".join(lines)
