from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
import json

from models import Lease, ReleaseLog, AuditLog, LeaseStatus, OperationType
from schemas import (
    LeaseCreate, LeaseUpdate, LeaseRelease, LeaseManualCorrect,
    LeaseQueryParams
)


def is_lease_expired(lease: Lease) -> bool:
    return datetime.now() > lease.lease_end and lease.status == LeaseStatus.ACTIVE


def update_lease_status_if_expired(db: Session, lease: Lease) -> Lease:
    if is_lease_expired(lease):
        lease.status = LeaseStatus.EXPIRED
        db.commit()
        db.refresh(lease)
    return lease


def create_audit_log(
    db: Session,
    operation: OperationType,
    raw_input: Any,
    conclusion: str,
    success: bool,
    operator: Optional[str] = None
) -> AuditLog:
    audit_log = AuditLog(
        operation=operation,
        raw_input=json.dumps(raw_input, default=str, ensure_ascii=False),
        conclusion=conclusion,
        success=success,
        operator=operator
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log


def check_env_availability(
    db: Session,
    env_id: str,
    lease_start: datetime,
    lease_end: datetime,
    exclude_lease_id: Optional[int] = None
) -> bool:
    query = db.query(Lease).filter(
        Lease.env_id == env_id,
        Lease.status.in_([LeaseStatus.ACTIVE, LeaseStatus.EXPIRED]),
        or_(
            and_(Lease.lease_start <= lease_start, Lease.lease_end >= lease_start),
            and_(Lease.lease_start <= lease_end, Lease.lease_end >= lease_end),
            and_(Lease.lease_start >= lease_start, Lease.lease_end <= lease_end)
        )
    )
    if exclude_lease_id:
        query = query.filter(Lease.id != exclude_lease_id)
    conflicting = query.first()
    return conflicting is None


def get_lease_by_request_id(db: Session, request_id: str) -> Optional[Lease]:
    return db.query(Lease).filter(Lease.request_id == request_id).first()


def create_lease(db: Session, lease_data: LeaseCreate) -> Dict[str, Any]:
    if lease_data.request_id:
        existing = get_lease_by_request_id(db, lease_data.request_id)
        if existing:
            create_audit_log(
                db, OperationType.CREATE, lease_data.model_dump(),
                f"幂等请求：已存在租约ID={existing.id}", True, lease_data.assignee
            )
            return {"lease": existing, "is_idempotent": True}

    if lease_data.lease_end <= lease_data.lease_start:
        create_audit_log(
            db, OperationType.CREATE, lease_data.model_dump(),
            "租约结束时间必须晚于开始时间", False, lease_data.assignee
        )
        raise ValueError("租约结束时间必须晚于开始时间")

    if not check_env_availability(db, lease_data.env_id, lease_data.lease_start, lease_data.lease_end):
        create_audit_log(
            db, OperationType.CREATE, lease_data.model_dump(),
            f"环境 {lease_data.env_id} 在该时间段内已被占用", False, lease_data.assignee
        )
        raise ValueError(f"环境 {lease_data.env_id} 在该时间段内已被占用")

    db_lease = Lease(**lease_data.model_dump())
    db.add(db_lease)
    db.commit()
    db.refresh(db_lease)

    create_audit_log(
        db, OperationType.CREATE, lease_data.model_dump(),
        f"成功创建租约ID={db_lease.id}", True, lease_data.assignee
    )

    return {"lease": db_lease, "is_idempotent": False}


def get_lease(db: Session, lease_id: int) -> Optional[Lease]:
    lease = db.query(Lease).filter(Lease.id == lease_id).first()
    if lease:
        lease = update_lease_status_if_expired(db, lease)
    return lease


def query_leases(db: Session, params: LeaseQueryParams) -> List[Lease]:
    query = db.query(Lease)

    if params.branch_name:
        query = query.filter(Lease.branch_name.contains(params.branch_name))
    if params.env_id:
        query = query.filter(Lease.env_id == params.env_id)
    if params.assignee:
        query = query.filter(Lease.assignee.contains(params.assignee))
    if params.status:
        query = query.filter(Lease.status == params.status)
    elif params.only_active:
        query = query.filter(Lease.status == LeaseStatus.ACTIVE)

    leases = query.all()
    for lease in leases:
        update_lease_status_if_expired(db, lease)

    return leases


def renew_lease(db: Session, lease_id: int, update_data: LeaseUpdate) -> Lease:
    lease = get_lease(db, lease_id)
    if not lease:
        create_audit_log(
            db, OperationType.RENEW, {"lease_id": lease_id, **update_data.model_dump()},
            f"租约ID={lease_id}不存在", False
        )
        raise ValueError(f"租约ID={lease_id}不存在")

    if lease.status == LeaseStatus.RELEASED:
        create_audit_log(
            db, OperationType.RENEW, {"lease_id": lease_id, **update_data.model_dump()},
            f"租约ID={lease_id}已释放，无法续租", False, lease.assignee
        )
        raise ValueError(f"租约ID={lease_id}已释放，无法续租")

    new_end = update_data.lease_end or lease.lease_end
    if new_end <= lease.lease_start:
        create_audit_log(
            db, OperationType.RENEW, {"lease_id": lease_id, **update_data.model_dump()},
            "续租结束时间必须晚于租约开始时间", False, lease.assignee
        )
        raise ValueError("续租结束时间必须晚于租约开始时间")

    if not check_env_availability(db, lease.env_id, lease.lease_start, new_end, lease.id):
        create_audit_log(
            db, OperationType.RENEW, {"lease_id": lease_id, **update_data.model_dump()},
            f"环境 {lease.env_id} 在续租时间段内存在冲突", False, lease.assignee
        )
        raise ValueError(f"环境 {lease.env_id} 在续租时间段内存在冲突")

    if update_data.lease_end:
        lease.lease_end = update_data.lease_end
    if update_data.renew_reason:
        lease.renew_reason = update_data.renew_reason
    if update_data.assignee:
        lease.assignee = update_data.assignee
    if update_data.status:
        lease.status = update_data.status

    db.commit()
    db.refresh(lease)

    create_audit_log(
        db, OperationType.RENEW, {"lease_id": lease_id, **update_data.model_dump()},
        f"成功续租租约ID={lease_id}", True, lease.assignee
    )

    return lease


def release_lease(db: Session, lease_id: int, release_data: LeaseRelease) -> Lease:
    lease = get_lease(db, lease_id)
    if not lease:
        create_audit_log(
            db, OperationType.RELEASE, {"lease_id": lease_id, **release_data.model_dump()},
            f"租约ID={lease_id}不存在", False, release_data.released_by
        )
        raise ValueError(f"租约ID={lease_id}不存在")

    if lease.status == LeaseStatus.RELEASED:
        create_audit_log(
            db, OperationType.RELEASE, {"lease_id": lease_id, **release_data.model_dump()},
            f"租约ID={lease_id}已释放", True, release_data.released_by
        )
        return lease

    if not release_data.force and lease.status == LeaseStatus.ACTIVE and not is_lease_expired(lease):
        if lease.assignee != release_data.released_by:
            create_audit_log(
                db, OperationType.RELEASE, {"lease_id": lease_id, **release_data.model_dump()},
                f"非占用人释放需要强制释放权限", False, release_data.released_by
            )
            raise ValueError("非占用人释放需要强制释放权限")

    lease.status = LeaseStatus.RELEASED
    db.commit()

    release_log = ReleaseLog(
        lease_id=lease_id,
        released_by=release_data.released_by,
        release_reason=release_data.release_reason,
        is_forced=release_data.force
    )
    db.add(release_log)
    db.commit()
    db.refresh(lease)

    op_type = OperationType.FORCE_RELEASE if release_data.force else OperationType.RELEASE
    create_audit_log(
        db, op_type, {"lease_id": lease_id, **release_data.model_dump()},
        f"成功{'强制' if release_data.force else ''}释放租约ID={lease_id}", True, release_data.released_by
    )

    return lease


def manual_correct_lease(db: Session, lease_id: int, correct_data: LeaseManualCorrect) -> Lease:
    lease = get_lease(db, lease_id)
    if not lease:
        create_audit_log(
            db, OperationType.MANUAL_CORRECT, {"lease_id": lease_id, **correct_data.model_dump()},
            f"租约ID={lease_id}不存在", False, correct_data.operator
        )
        raise ValueError(f"租约ID={lease_id}不存在")

    changes = []
    if correct_data.branch_name:
        lease.branch_name = correct_data.branch_name
        changes.append(f"branch_name={correct_data.branch_name}")
    if correct_data.env_id:
        lease.env_id = correct_data.env_id
        changes.append(f"env_id={correct_data.env_id}")
    if correct_data.assignee:
        lease.assignee = correct_data.assignee
        changes.append(f"assignee={correct_data.assignee}")
    if correct_data.lease_start:
        lease.lease_start = correct_data.lease_start
        changes.append(f"lease_start={correct_data.lease_start}")
    if correct_data.lease_end:
        lease.lease_end = correct_data.lease_end
        changes.append(f"lease_end={correct_data.lease_end}")
    if correct_data.renew_reason is not None:
        lease.renew_reason = correct_data.renew_reason
        changes.append("renew_reason updated")
    if correct_data.status:
        lease.status = correct_data.status
        changes.append(f"status={correct_data.status}")

    db.commit()
    db.refresh(lease)

    conclusion = f"人工修正租约ID={lease_id}，变更: {', '.join(changes) if changes else '无'}。理由: {correct_data.reason}"
    create_audit_log(
        db, OperationType.MANUAL_CORRECT, {"lease_id": lease_id, **correct_data.model_dump()},
        conclusion, True, correct_data.operator
    )

    return lease


def recalculate_statuses(db: Session, operator: str) -> Dict[str, int]:
    leases = db.query(Lease).filter(Lease.status == LeaseStatus.ACTIVE).all()
    expired_count = 0

    for lease in leases:
        if is_lease_expired(lease):
            lease.status = LeaseStatus.EXPIRED
            expired_count += 1

    db.commit()

    create_audit_log(
        db, OperationType.MANUAL_CORRECT, {"action": "bulk_recalculate"},
        f"批量重新计算租约状态，标记过期 {expired_count} 个", True, operator
    )

    return {
        "checked": len(leases),
        "marked_expired": expired_count
    }


def get_occupancy_report(db: Session) -> Dict[str, Any]:
    leases = db.query(Lease).all()
    for lease in leases:
        update_lease_status_if_expired(db, lease)

    by_env: Dict[str, Dict[str, int]] = {}
    by_assignee: Dict[str, Dict[str, int]] = {}

    for lease in leases:
        if lease.env_id not in by_env:
            by_env[lease.env_id] = {"total": 0, "active": 0, "expired": 0, "released": 0}
        by_env[lease.env_id]["total"] += 1
        by_env[lease.env_id][lease.status] += 1

        if lease.assignee not in by_assignee:
            by_assignee[lease.assignee] = {"active": 0, "total": 0}
        by_assignee[lease.assignee]["total"] += 1
        if lease.status == LeaseStatus.ACTIVE:
            by_assignee[lease.assignee]["active"] += 1

    total_active = sum(1 for l in leases if l.status == LeaseStatus.ACTIVE)
    total_expired = sum(1 for l in leases if l.status == LeaseStatus.EXPIRED)

    return {
        "by_environment": [
            {
                "env_id": env_id,
                "total_leases": data["total"],
                "active_leases": data["active"],
                "expired_leases": data["expired"],
                "released_leases": data["released"]
            }
            for env_id, data in by_env.items()
        ],
        "by_assignee": [
            {
                "assignee": assignee,
                "active_leases": data["active"],
                "total_leases": data["total"]
            }
            for assignee, data in by_assignee.items()
        ],
        "total_environments": len(by_env),
        "total_active_leases": total_active,
        "total_expired_leases": total_expired,
        "generated_at": datetime.now()
    }


def get_audit_logs(db: Session, limit: int = 100) -> List[AuditLog]:
    return db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
