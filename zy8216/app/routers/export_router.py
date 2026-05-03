from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from io import StringIO
import csv

from app.database import get_db
from app.models import Anomaly, Animal, Cage, CageOccupancy, CageScan, AnomalyStatus
from app.schemas import AnomalyResponse

router = APIRouter(prefix="/export", tags=["报告导出"])


def generate_anomaly_report_markdown(
    anomalies: List[Anomaly],
    include_resolved: bool = False,
    title: str = "异常报告"
) -> str:
    lines = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    pending = [a for a in anomalies if a.status == AnomalyStatus.PENDING.value]
    reviewed = [a for a in anomalies if a.status == AnomalyStatus.REVIEWED.value]
    resolved = [a for a in anomalies if a.status == AnomalyStatus.RESOLVED.value]
    dismissed = [a for a in anomalies if a.status == AnomalyStatus.DISMISSED.value]
    
    lines.append("## 统计概览")
    lines.append("")
    lines.append("| 状态 | 数量 |")
    lines.append("|------|------|")
    lines.append(f"| 待处理 | {len(pending)} |")
    lines.append(f"| 已复核 | {len(reviewed)} |")
    lines.append(f"| 已解决 | {len(resolved)} |")
    lines.append(f"| 已忽略 | {len(dismissed)} |")
    lines.append(f"| **总计** | **{len(anomalies)}** |")
    lines.append("")
    
    from collections import defaultdict
    type_counts = defaultdict(int)
    for a in anomalies:
        type_counts[a.anomaly_type] += 1
    
    lines.append("## 按类型统计")
    lines.append("")
    lines.append("| 异常类型 | 数量 |")
    lines.append("|----------|------|")
    for anomaly_type, count in sorted(type_counts.items()):
        lines.append(f"| {anomaly_type} | {count} |")
    lines.append("")
    
    lines.append("## 详细记录")
    lines.append("")
    
    status_order = [
        (AnomalyStatus.PENDING.value, "待处理"),
        (AnomalyStatus.REVIEWED.value, "已复核"),
        (AnomalyStatus.RESOLVED.value, "已解决"),
        (AnomalyStatus.DISMISSED.value, "已忽略"),
    ]
    
    for status_value, status_name in status_order:
        status_anomalies = [a for a in anomalies if a.status == status_value]
        if not status_anomalies:
            continue
            
        lines.append(f"### {status_name} ({len(status_anomalies)})")
        lines.append("")
        
        for i, anomaly in enumerate(status_anomalies, 1):
            lines.append(f"#### {i}. 异常 ID: {anomaly.id}")
            lines.append("")
            lines.append(f"- **类型**: {anomaly.anomaly_type}")
            lines.append(f"- **检测时间**: {anomaly.detected_at.strftime('%Y-%m-%d %H:%M:%S') if anomaly.detected_at else 'N/A'}")
            lines.append(f"- **描述**: {anomaly.description or '无描述'}")
            if anomaly.reviewed_at:
                lines.append(f"- **复核时间**: {anomaly.reviewed_at.strftime('%Y-%m-%d %H:%M:%S')}")
            if anomaly.reviewed_by:
                lines.append(f"- **复核人**: {anomaly.reviewed_by}")
            if anomaly.review_notes:
                lines.append(f"- **复核备注**: {anomaly.review_notes}")
            lines.append("")
    
    return "\n".join(lines)


def generate_anomaly_report_csv(
    anomalies: List[Anomaly]
) -> StringIO:
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "ID", "异常类型", "描述", "状态", "检测时间",
        "复核人", "复核时间", "复核备注", "扫码事件ID", "动物ID", "笼位ID"
    ])
    
    for anomaly in anomalies:
        writer.writerow([
            anomaly.id,
            anomaly.anomaly_type,
            anomaly.description or "",
            anomaly.status,
            anomaly.detected_at.strftime('%Y-%m-%d %H:%M:%S') if anomaly.detected_at else "",
            anomaly.reviewed_by or "",
            anomaly.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if anomaly.reviewed_at else "",
            anomaly.review_notes or "",
            anomaly.scan_event_id or "",
            anomaly.animal_id or "",
            anomaly.cage_id or ""
        ])
    
    output.seek(0)
    return output


def generate_cage_status_report_markdown(
    cages: List[Cage],
    db: Session
) -> str:
    lines = []
    lines.append("# 笼位状态报告")
    lines.append("")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    total_cages = len(cages)
    occupied_cages = 0
    quarantine_cages = 0
    over_capacity = 0
    
    for cage in cages:
        occupancy_count = db.query(CageOccupancy).filter(
            CageOccupancy.cage_id == cage.id,
            CageOccupancy.is_active == True
        ).count()
        
        if occupancy_count > 0:
            occupied_cages += 1
        if cage.is_quarantine:
            quarantine_cages += 1
        if occupancy_count > cage.max_capacity:
            over_capacity += 1
    
    lines.append("## 统计概览")
    lines.append("")
    lines.append("| 指标 | 数量 |")
    lines.append("|------|------|")
    lines.append(f"| 总笼位数 | {total_cages} |")
    lines.append(f"| 已占用笼位 | {occupied_cages} |")
    lines.append(f"| 隔离笼位 | {quarantine_cages} |")
    lines.append(f"| 容量超限笼位 | {over_capacity} |")
    lines.append("")
    
    lines.append("## 笼位详情")
    lines.append("")
    lines.append("| 笼位ID | 位置 | 容量 | 当前占用 | 隔离笼位 | 状态 |")
    lines.append("|--------|------|------|----------|----------|------|")
    
    for cage in cages:
        occupancy_count = db.query(CageOccupancy).filter(
            CageOccupancy.cage_id == cage.id,
            CageOccupancy.is_active == True
        ).count()
        
        status = "正常"
        if occupancy_count > cage.max_capacity:
            status = "超限"
        elif occupancy_count == 0:
            status = "空闲"
        
        lines.append(
            f"| {cage.cage_id} | {cage.location or '-'} | {cage.max_capacity} | "
            f"{occupancy_count} | {'是' if cage.is_quarantine else '否'} | {status} |"
        )
    
    lines.append("")
    return "\n".join(lines)


@router.get("/anomalies/markdown")
def export_anomalies_markdown(
    anomaly_type: Optional[str] = None,
    status: Optional[str] = None,
    include_resolved: bool = Query(False, description="包含已解决和已忽略的异常"),
    db: Session = Depends(get_db)
):
    query = db.query(Anomaly)
    
    if anomaly_type:
        query = query.filter(Anomaly.anomaly_type == anomaly_type)
    
    if not include_resolved and not status:
        query = query.filter(
            Anomaly.status.in_([
                AnomalyStatus.PENDING.value,
                AnomalyStatus.REVIEWED.value
            ])
        )
    elif status:
        query = query.filter(Anomaly.status == status)
    
    anomalies = query.order_by(Anomaly.detected_at.desc()).all()
    
    markdown = generate_anomaly_report_markdown(
        anomalies,
        include_resolved=include_resolved,
        title="异常检测报告"
    )
    
    return StreamingResponse(
        iter([markdown]),
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=anomaly_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        }
    )


@router.get("/anomalies/csv")
def export_anomalies_csv(
    anomaly_type: Optional[str] = None,
    status: Optional[str] = None,
    include_resolved: bool = Query(False, description="包含已解决和已忽略的异常"),
    db: Session = Depends(get_db)
):
    query = db.query(Anomaly)
    
    if anomaly_type:
        query = query.filter(Anomaly.anomaly_type == anomaly_type)
    
    if not include_resolved and not status:
        query = query.filter(
            Anomaly.status.in_([
                AnomalyStatus.PENDING.value,
                AnomalyStatus.REVIEWED.value
            ])
        )
    elif status:
        query = query.filter(Anomaly.status == status)
    
    anomalies = query.order_by(Anomaly.detected_at.desc()).all()
    
    csv_buffer = generate_anomaly_report_csv(anomalies)
    
    return StreamingResponse(
        iter([csv_buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=anomaly_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@router.get("/cage-status/markdown")
def export_cage_status_markdown(
    is_quarantine: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Cage)
    
    if is_quarantine is not None:
        query = query.filter(Cage.is_quarantine == is_quarantine)
    
    cages = query.order_by(Cage.cage_id).all()
    
    markdown = generate_cage_status_report_markdown(cages, db)
    
    return StreamingResponse(
        iter([markdown]),
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=cage_status_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        }
    )


@router.get("/summary")
def get_export_summary(
    db: Session = Depends(get_db)
):
    from sqlalchemy import func
    
    animal_count = db.query(func.count(Animal.id)).scalar() or 0
    cage_count = db.query(func.count(Cage.id)).scalar() or 0
    scan_count = db.query(func.count(CageScan.id)).scalar() or 0
    anomaly_count = db.query(func.count(Anomaly.id)).scalar() or 0
    
    pending_anomalies = db.query(func.count(Anomaly.id)).filter(
        Anomaly.status == AnomalyStatus.PENDING.value
    ).scalar() or 0
    
    occupied_cages = db.query(func.count(CageOccupancy.id.distinct())).filter(
        CageOccupancy.is_active == True
    ).scalar() or 0
    
    return {
        "animals": {
            "total": animal_count
        },
        "cages": {
            "total": cage_count,
            "occupied": occupied_cages
        },
        "scans": {
            "total": scan_count
        },
        "anomalies": {
            "total": anomaly_count,
            "pending": pending_anomalies
        },
        "available_exports": [
            {
                "name": "异常报告 (Markdown)",
                "endpoint": "/export/anomalies/markdown",
                "format": "markdown"
            },
            {
                "name": "异常报告 (CSV)",
                "endpoint": "/export/anomalies/csv",
                "format": "csv"
            },
            {
                "name": "笼位状态报告 (Markdown)",
                "endpoint": "/export/cage-status/markdown",
                "format": "markdown"
            }
        ]
    }
