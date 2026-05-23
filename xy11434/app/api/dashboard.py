from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.database import get_db
from app.models import (
    User, RoleEnum, ConsumableRecord, WorkflowStatus, RecordType,
    WorkflowLog, DirtyRecord, DirtyType
)
from app.schemas import DashboardStats
from app.security import RoleChecker

router = APIRouter(prefix="/dashboard", tags=["学院秘书视图"])


@router.get("/statistics", response_model=DashboardStats)
def get_dashboard_statistics(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SECRETARY, RoleEnum.SUPERVISOR]))
):
    query = db.query(ConsumableRecord)
    if start_date:
        query = query.filter(ConsumableRecord.created_at >= start_date)
    if end_date:
        query = query.filter(ConsumableRecord.created_at <= end_date)

    total_records = query.count()
    draft_count = query.filter(ConsumableRecord.status == WorkflowStatus.DRAFT).count()
    submitted_count = query.filter(ConsumableRecord.status == WorkflowStatus.SUBMITTED).count()
    approved_count = query.filter(ConsumableRecord.status.in_([
        WorkflowStatus.APPROVED, WorkflowStatus.AUDITED
    ])).count()
    rejected_count = query.filter(ConsumableRecord.status == WorkflowStatus.REJECTED).count()
    dirty_count = query.filter(ConsumableRecord.is_dirty == True).count()

    total_amount = db.query(func.sum(ConsumableRecord.total_amount)).filter(
        ConsumableRecord.id.in_([r.id for r in query.all()])
    ).scalar() or 0.0

    records_by_type = {}
    type_counts = query.with_entities(
        ConsumableRecord.record_type, func.count(ConsumableRecord.id)
    ).group_by(ConsumableRecord.record_type).all()
    for record_type, count in type_counts:
        records_by_type[record_type.value] = count

    records_by_department = {}
    dept_counts = query.with_entities(
        ConsumableRecord.department, func.count(ConsumableRecord.id)
    ).group_by(ConsumableRecord.department).all()
    for dept, count in dept_counts:
        if dept:
            records_by_department[dept] = count

    return DashboardStats(
        total_records=total_records,
        draft_count=draft_count,
        submitted_count=submitted_count,
        approved_count=approved_count,
        rejected_count=rejected_count,
        dirty_count=dirty_count,
        total_amount=float(total_amount),
        records_by_type=records_by_type,
        records_by_department=records_by_department
    )


@router.get("/role-views")
def get_role_views(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SECRETARY, RoleEnum.SUPERVISOR]))
):
    role_stats = {}
    for role in RoleEnum:
        users = db.query(User).filter(User.role == role).all()
        user_ids = [u.id for u in users]

        created_records = db.query(ConsumableRecord).filter(
            ConsumableRecord.created_by.in_(user_ids)
        ).count() if user_ids else 0

        reviewed_records = db.query(ConsumableRecord).filter(
            ConsumableRecord.reviewed_by.in_(user_ids)
        ).count() if user_ids else 0

        role_stats[role.value] = {
            "user_count": len(users),
            "users": [{"id": u.id, "name": u.real_name, "username": u.username} for u in users],
            "created_records": created_records,
            "reviewed_records": reviewed_records
        }

    return role_stats


@router.get("/change-reasons")
def get_change_reasons(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SECRETARY, RoleEnum.SUPERVISOR]))
):
    start_date = datetime.now() - timedelta(days=days)

    logs = db.query(WorkflowLog).filter(
        WorkflowLog.change_reason.isnot(None),
        WorkflowLog.created_at >= start_date
    ).order_by(WorkflowLog.created_at.desc()).all()

    reason_stats = {}
    for log in logs:
        reason = log.change_reason or "未说明"
        if reason not in reason_stats:
            reason_stats[reason] = {
                "count": 0,
                "records": []
            }
        reason_stats[reason]["count"] += 1
        reason_stats[reason]["records"].append({
            "record_id": log.record_id,
            "operator": log.operator_name,
            "action": log.action,
            "time": log.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return {
        "period_days": days,
        "total_changes": len(logs),
        "change_reason_summary": [
            {"reason": k, "count": v["count"]}
            for k, v in sorted(reason_stats.items(), key=lambda x: x[1]["count"], reverse=True)
        ],
        "recent_changes": [
            {
                "record_id": log.record_id,
                "action": log.action,
                "from_status": log.from_status.value if log.from_status else None,
                "to_status": log.to_status.value if log.to_status else None,
                "operator": log.operator_name,
                "operator_role": log.operator_role.value if log.operator_role else None,
                "change_reason": log.change_reason,
                "changed_fields": log.changed_fields,
                "time": log.created_at.strftime("%Y-%m-%d %H:%M")
            }
            for log in logs[:50]
        ]
    }


@router.get("/sensitive-field-changes")
def get_sensitive_field_changes(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SECRETARY, RoleEnum.SUPERVISOR]))
):
    start_date = datetime.now() - timedelta(days=days)
    sensitive_fields = ["teacher_name", "quantity", "total_amount", "unit_price", "supplier"]

    logs = db.query(WorkflowLog).filter(
        WorkflowLog.changed_fields.isnot(None),
        WorkflowLog.created_at >= start_date
    ).order_by(WorkflowLog.created_at.desc()).all()

    sensitive_changes = []
    for log in logs:
        if log.changed_fields:
            for field, change in log.changed_fields.items():
                if field in sensitive_fields:
                    sensitive_changes.append({
                        "record_id": log.record_id,
                        "field": field,
                        "old_value": change.get("old"),
                        "new_value": change.get("new"),
                        "operator": log.operator_name,
                        "operator_role": log.operator_role.value if log.operator_role else None,
                        "change_reason": log.change_reason,
                        "time": log.created_at.strftime("%Y-%m-%d %H:%M")
                    })

    return {
        "period_days": days,
        "total_sensitive_changes": len(sensitive_changes),
        "sensitive_fields_tracked": sensitive_fields,
        "changes": sensitive_changes
    }


@router.get("/dirty-record-analysis")
def get_dirty_record_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SECRETARY, RoleEnum.SUPERVISOR]))
):
    total_dirty = db.query(DirtyRecord).count()
    resolved = db.query(DirtyRecord).filter(DirtyRecord.is_resolved == True).count()
    unresolved = total_dirty - resolved

    by_type = {}
    type_counts = db.query(
        DirtyRecord.dirty_type,
        func.count(DirtyRecord.id),
        func.sum(func.case((DirtyRecord.is_resolved == True, 1), else_=0))
    ).group_by(DirtyRecord.dirty_type).all()

    for dirty_type, total, resolved_count in type_counts:
        by_type[dirty_type.value] = {
            "total": total,
            "resolved": resolved_count,
            "unresolved": total - resolved_count
        }

    recent_unresolved = db.query(DirtyRecord).filter(
        DirtyRecord.is_resolved == False
    ).order_by(DirtyRecord.created_at.desc()).limit(20).all()

    return {
        "summary": {
            "total_dirty_records": total_dirty,
            "resolved": resolved,
            "unresolved": unresolved,
            "resolution_rate": round(resolved / total_dirty * 100, 2) if total_dirty > 0 else 0
        },
        "by_dirty_type": by_type,
        "recent_unresolved": [
            {
                "id": dr.id,
                "original_record_id": dr.original_record_id,
                "dirty_type": dr.dirty_type.value,
                "field_name": dr.field_name,
                "conflict_description": dr.conflict_description,
                "created_at": dr.created_at.strftime("%Y-%m-%d %H:%M")
            }
            for dr in recent_unresolved
        ]
    }


@router.get("/audit-trail-summary")
def get_audit_trail_summary(
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SECRETARY, RoleEnum.SUPERVISOR]))
):
    from app.models import AuditLog
    start_date = datetime.now() - timedelta(days=days)

    daily_stats = []
    for i in range(days):
        day = datetime.now() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)

        day_logs = db.query(AuditLog).filter(
            AuditLog.created_at >= day_start,
            AuditLog.created_at <= day_end
        ).count()

        daily_stats.append({
            "date": day.strftime("%Y-%m-%d"),
            "action_count": day_logs
        })

    daily_stats.reverse()

    top_actions = db.query(
        AuditLog.action, func.count(AuditLog.id)
    ).filter(
        AuditLog.created_at >= start_date
    ).group_by(AuditLog.action).order_by(func.count(AuditLog.id).desc()).limit(10).all()

    top_users = db.query(
        AuditLog.real_name, func.count(AuditLog.id)
    ).filter(
        AuditLog.created_at >= start_date
    ).group_by(AuditLog.real_name).order_by(func.count(AuditLog.id).desc()).limit(10).all()

    return {
        "period_days": days,
        "daily_activity": daily_stats,
        "top_actions": [{"action": a, "count": c} for a, c in top_actions],
        "top_active_users": [{"user": u, "count": c} for u, c in top_users if u]
    }
