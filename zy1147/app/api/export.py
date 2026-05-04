import csv
import json
from io import StringIO
from typing import Optional, List
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import DetectionHistory, HitRecord, ReviewRecord
from app.config import settings

router = APIRouter()


@router.get("/report/json")
async def export_json(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    is_sensitive: Optional[bool] = Query(None),
    review_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(DetectionHistory)
    
    if start_date:
        query = query.where(DetectionHistory.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(DetectionHistory.created_at <= datetime.combine(end_date, datetime.max.time()))
    if is_sensitive is not None:
        query = query.where(DetectionHistory.is_sensitive == is_sensitive)
    if review_status:
        query = query.where(DetectionHistory.review_status == review_status)
    
    query = query.order_by(DetectionHistory.created_at.desc())
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    report_data = {
        "report_type": "audit_report",
        "generated_at": datetime.utcnow().isoformat(),
        "filters": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "is_sensitive": is_sensitive,
            "review_status": review_status
        },
        "summary": {
            "total_records": len(records),
            "sensitive_count": sum(1 for r in records if r.is_sensitive),
            "pending_review": sum(1 for r in records if r.review_status == "pending"),
            "false_positives": sum(1 for r in records if r.review_status == "false_positive"),
            "confirmed": sum(1 for r in records if r.review_status == "confirmed")
        },
        "records": []
    }
    
    for record in records:
        hits_result = await db.execute(
            select(HitRecord).where(HitRecord.detection_id == record.id)
        )
        hits = hits_result.scalars().all()
        
        record_data = {
            "id": record.id,
            "request_id": record.request_id,
            "original_text": record.original_text,
            "is_sensitive": record.is_sensitive,
            "highest_severity": record.highest_severity,
            "total_hits": record.total_hits,
            "review_status": record.review_status,
            "reviewed_by": record.reviewed_by,
            "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
            "created_at": record.created_at.isoformat(),
            "hits": [
                {
                    "hit_word": h.hit_word,
                    "matched_word": h.matched_word,
                    "start_position": h.start_position,
                    "end_position": h.end_position,
                    "match_type": h.match_type,
                    "category": h.category,
                    "severity": h.severity,
                    "description": h.description,
                    "suggestion": h.suggestion,
                    "is_false_positive": h.is_false_positive,
                    "false_positive_reason": h.false_positive_reason
                }
                for h in hits
            ]
        }
        report_data["records"].append(record_data)
    
    return JSONResponse(content=report_data)


@router.get("/report/csv")
async def export_csv(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    is_sensitive: Optional[bool] = Query(None),
    review_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(DetectionHistory)
    
    if start_date:
        query = query.where(DetectionHistory.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(DetectionHistory.created_at <= datetime.combine(end_date, datetime.max.time()))
    if is_sensitive is not None:
        query = query.where(DetectionHistory.is_sensitive == is_sensitive)
    if review_status:
        query = query.where(DetectionHistory.review_status == review_status)
    
    query = query.order_by(DetectionHistory.created_at.desc())
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "检测ID", "请求ID", "原始文本", "是否敏感", "最高级别", "命中数量",
        "复核状态", "复核人", "复核时间", "命中词", "匹配词", "位置",
        "匹配类型", "分类", "严重级别", "描述", "建议",
        "是否误报", "误报原因", "创建时间"
    ])
    
    for record in records:
        hits_result = await db.execute(
            select(HitRecord).where(HitRecord.detection_id == record.id)
        )
        hits = hits_result.scalars().all()
        
        if hits:
            for hit in hits:
                writer.writerow([
                    record.id,
                    record.request_id,
                    record.original_text[:100] + "..." if len(record.original_text) > 100 else record.original_text,
                    "是" if record.is_sensitive else "否",
                    record.highest_severity or "",
                    record.total_hits,
                    record.review_status,
                    record.reviewed_by or "",
                    record.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if record.reviewed_at else "",
                    hit.hit_word,
                    hit.matched_word or "",
                    f"{hit.start_position}-{hit.end_position}",
                    hit.match_type,
                    hit.category,
                    hit.severity,
                    hit.description or "",
                    hit.suggestion or "",
                    "是" if hit.is_false_positive else "否",
                    hit.false_positive_reason or "",
                    record.created_at.strftime("%Y-%m-%d %H:%M:%S")
                ])
        else:
            writer.writerow([
                record.id,
                record.request_id,
                record.original_text[:100] + "..." if len(record.original_text) > 100 else record.original_text,
                "是" if record.is_sensitive else "否",
                record.highest_severity or "",
                record.total_hits,
                record.review_status,
                record.reviewed_by or "",
                record.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if record.reviewed_at else "",
                "", "", "", "", "", "", "", "", "",
                record.created_at.strftime("%Y-%m-%d %H:%M:%S")
            ])
    
    output.seek(0)
    csv_content = output.getvalue()
    output.close()
    
    return StreamingResponse(
        iter([csv_content.encode('utf-8-sig')]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=audit_report_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
        }
    )


@router.get("/report/markdown")
async def export_markdown(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    is_sensitive: Optional[bool] = Query(None),
    review_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(DetectionHistory)
    
    if start_date:
        query = query.where(DetectionHistory.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(DetectionHistory.created_at <= datetime.combine(end_date, datetime.max.time()))
    if is_sensitive is not None:
        query = query.where(DetectionHistory.is_sensitive == is_sensitive)
    if review_status:
        query = query.where(DetectionHistory.review_status == review_status)
    
    query = query.order_by(DetectionHistory.created_at.desc())
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    total_records = len(records)
    sensitive_count = sum(1 for r in records if r.is_sensitive)
    pending_review = sum(1 for r in records if r.review_status == "pending")
    false_positives = sum(1 for r in records if r.review_status == "false_positive")
    confirmed = sum(1 for r in records if r.review_status == "confirmed")
    
    severity_counts = {}
    category_counts = {}
    
    for record in records:
        if record.is_sensitive and record.highest_severity:
            severity_counts[record.highest_severity] = severity_counts.get(record.highest_severity, 0) + 1
    
    md_lines = [
        "# 敏感内容审核报告",
        "",
        f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## 一、统计概览",
        "",
        "| 指标 | 数值 |",
        "|------|------|",
        f"| 总检测记录数 | {total_records} |",
        f"| 敏感内容数 | {sensitive_count} |",
        f"| 待复核数 | {pending_review} |",
        f"| 误报数 | {false_positives} |",
        f"| 确认敏感数 | {confirmed} |",
        "",
        "### 严重级别分布",
        "",
        "| 级别 | 数量 |",
        "|------|------|",
    ]
    
    for severity in ['critical', 'high', 'medium', 'low']:
        count = severity_counts.get(severity, 0)
        md_lines.append(f"| {severity} | {count} |")
    
    md_lines.extend([
        "",
        "## 二、详细记录",
        "",
    ])
    
    for idx, record in enumerate(records, 1):
        status_emoji = {
            "pending": "⏳",
            "passed": "✅",
            "false_positive": "⚠️",
            "confirmed": "🔴",
            "needs_review": "❓"
        }.get(record.review_status, "")
        
        md_lines.extend([
            f"### {idx}. 检测记录 #{record.id}",
            "",
            f"- **状态**: {status_emoji} {record.review_status}",
            f"- **是否敏感**: {'是' if record.is_sensitive else '否'}",
            f"- **最高级别**: {record.highest_severity or '无'}",
            f"- **命中数量**: {record.total_hits}",
            f"- **检测时间**: {record.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            f"**原始文本**:",
            "",
            f"> {record.original_text}",
            "",
        ])
        
        hits_result = await db.execute(
            select(HitRecord).where(HitRecord.detection_id == record.id)
        )
        hits = hits_result.scalars().all()
        
        if hits:
            md_lines.append("**命中详情**:")
            md_lines.append("")
            
            for hit_idx, hit in enumerate(hits, 1):
                md_lines.extend([
                    f"#### 命中 {hit_idx}",
                    "",
                    f"- **命中词**: `{hit.hit_word}`",
                    f"- **匹配词**: `{hit.matched_word or '无'}`",
                    f"- **位置**: {hit.start_position}-{hit.end_position}",
                    f"- **匹配类型**: {hit.match_type}",
                    f"- **分类**: {hit.category}",
                    f"- **严重级别**: {hit.severity}",
                    f"- **描述**: {hit.description or '无'}",
                    f"- **建议**: {hit.suggestion or '无'}",
                    "",
                ])
        
        if record.review_status != "pending" and record.review_status != "passed":
            md_lines.extend([
                "**复核信息**:",
                "",
                f"- **复核状态**: {record.review_status}",
                f"- **复核人**: {record.reviewed_by or '无'}",
                f"- **复核时间**: {record.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if record.reviewed_at else '无'}",
                "",
            ])
        
        md_lines.append("---")
        md_lines.append("")
    
    markdown_content = "\n".join(md_lines)
    
    return StreamingResponse(
        iter([markdown_content.encode('utf-8')]),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename=audit_report_{datetime.now().strftime('%Y%m%d%H%M%S')}.md"
        }
    )
