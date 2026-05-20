import uuid
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from .models import (
    ReleaseOrder, Approval, CheckItem, ReleaseToken, 
    RollbackRecord, TimelineEvent, ReleaseStatus, CheckItemStatus
)
from .schemas import (
    ReleaseOrderCreate, ReleaseOrderUpdate, StatusTransition,
    CheckItemUpdate, ReleaseTokenCreate, RollbackRecordCreate,
    ReleaseOrderFilter, BatchImportItem, BatchImportResponse
)


class ReleaseStateMachine:
    VALID_TRANSITIONS = {
        ReleaseStatus.DRAFT: [ReleaseStatus.PENDING_APPROVAL, ReleaseStatus.REJECTED],
        ReleaseStatus.PENDING_APPROVAL: [ReleaseStatus.APPROVED, ReleaseStatus.REJECTED, ReleaseStatus.DRAFT],
        ReleaseStatus.APPROVED: [ReleaseStatus.DEPLOYING, ReleaseStatus.REJECTED, ReleaseStatus.TIMEOUT],
        ReleaseStatus.DEPLOYING: [ReleaseStatus.DEPLOYED, ReleaseStatus.ROLLED_BACK],
        ReleaseStatus.DEPLOYED: [ReleaseStatus.ROLLED_BACK],
        ReleaseStatus.ROLLED_BACK: [],
        ReleaseStatus.REJECTED: [ReleaseStatus.DRAFT],
        ReleaseStatus.TIMEOUT: [ReleaseStatus.DRAFT],
    }

    @classmethod
    def can_transition(cls, current: ReleaseStatus, target: ReleaseStatus) -> bool:
        return target in cls.VALID_TRANSITIONS.get(current, [])


def create_timeline_event(db: Session, release_order_id: int, event_type: str, description: str, created_by: str = None):
    event = TimelineEvent(
        release_order_id=release_order_id,
        event_type=event_type,
        description=description,
        created_by=created_by
    )
    db.add(event)
    db.commit()
    return event


def get_release_orders(db: Session, skip: int = 0, limit: int = 100, filter_params: ReleaseOrderFilter = None):
    query = db.query(ReleaseOrder)
    
    if filter_params:
        if filter_params.status:
            query = query.filter(ReleaseOrder.status == filter_params.status)
        if filter_params.environment:
            query = query.filter(ReleaseOrder.environment == filter_params.environment)
        if filter_params.created_by:
            query = query.filter(ReleaseOrder.created_by == filter_params.created_by)
        if filter_params.search:
            query = query.filter(
                or_(
                    ReleaseOrder.title.contains(filter_params.search),
                    ReleaseOrder.description.contains(filter_params.search),
                    ReleaseOrder.version.contains(filter_params.search)
                )
            )
    
    return query.order_by(ReleaseOrder.created_at.desc()).offset(skip).limit(limit).all()


def get_release_order(db: Session, release_order_id: int):
    return db.query(ReleaseOrder).filter(ReleaseOrder.id == release_order_id).first()


def create_release_order(db: Session, release_order: ReleaseOrderCreate):
    db_release = ReleaseOrder(
        title=release_order.title,
        description=release_order.description,
        version=release_order.version,
        environment=release_order.environment,
        created_by=release_order.created_by,
        scheduled_at=release_order.scheduled_at,
        timeout_hours=release_order.timeout_hours
    )
    db.add(db_release)
    db.flush()
    
    for check_item in release_order.check_items:
        db_check = CheckItem(
            release_order_id=db_release.id,
            name=check_item.name,
            description=check_item.description
        )
        db.add(db_check)
    
    for approver in release_order.approvers:
        db_approval = Approval(
            release_order_id=db_release.id,
            approver=approver
        )
        db.add(db_approval)
    
    db.commit()
    db.refresh(db_release)
    
    create_timeline_event(db, db_release.id, "CREATED", f"发布单已创建", release_order.created_by)
    
    return db_release


def update_release_order_status(db: Session, release_order_id: int, transition: StatusTransition):
    db_release = get_release_order(db, release_order_id)
    if not db_release:
        return None, "发布单不存在"
    
    if not ReleaseStateMachine.can_transition(db_release.status, transition.target_status):
        return None, f"无法从 {db_release.status} 转换到 {transition.target_status}"
    
    if transition.target_status == ReleaseStatus.APPROVED:
        pending_approvals = [a for a in db_release.approvals if not a.approved]
        if pending_approvals:
            return None, "存在未完成的审批"
        
        non_passed_checks = [c for c in db_release.check_items if c.status != CheckItemStatus.PASSED]
        if non_passed_checks:
            non_passed_names = [c.name for c in non_passed_checks]
            return None, f"存在未通过的检查项: {', '.join(non_passed_names)}。所有检查项必须标记为 '通过' 才能放行"
    
    previous_status = db_release.status
    db_release.status = transition.target_status
    db_release.updated_at = datetime.utcnow()
    
    if transition.target_status == ReleaseStatus.DEPLOYED:
        db_release.deployed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_release)
    
    create_timeline_event(
        db, release_order_id, "STATUS_CHANGE",
        f"状态从 {previous_status} 变更为 {transition.target_status}",
        transition.operator
    )
    
    return db_release, None


def update_check_item(db: Session, check_item_id: int, update: CheckItemUpdate):
    db_check = db.query(CheckItem).filter(CheckItem.id == check_item_id).first()
    if not db_check:
        return None, "检查项不存在"
    
    db_check.status = update.status
    db_check.checked_by = update.checked_by
    db_check.checked_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_check)
    
    create_timeline_event(
        db, db_check.release_order_id, "CHECK_ITEM",
        f"检查项 '{db_check.name}' 状态更新为 {update.status}",
        update.checked_by
    )
    
    return db_check, None


def submit_approval(db: Session, approval_id: int, approved: bool, comment: str = None, operator: str = None):
    db_approval = db.query(Approval).filter(Approval.id == approval_id).first()
    if not db_approval:
        return None, "审批不存在"
    
    db_approval.approved = approved
    db_approval.comment = comment
    db_approval.approved_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_approval)
    
    status_text = "通过" if approved else "拒绝"
    create_timeline_event(
        db, db_approval.release_order_id, "APPROVAL",
        f"{db_approval.approver} {status_text}了审批",
        operator or db_approval.approver
    )
    
    return db_approval, None


def create_release_token(db: Session, release_order_id: int, token_create: ReleaseTokenCreate):
    db_release = get_release_order(db, release_order_id)
    if not db_release:
        return None, "发布单不存在"
    
    if db_release.status != ReleaseStatus.APPROVED:
        return None, "只有已批准的发布单才能创建令牌"
    
    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=token_create.expires_hours)
    
    db_token = ReleaseToken(
        release_order_id=release_order_id,
        token=token,
        issued_by=token_create.issued_by,
        expires_at=expires_at
    )
    db.add(db_token)
    db.commit()
    db.refresh(db_token)
    
    create_timeline_event(
        db, release_order_id, "TOKEN_ISSUED",
        f"放行令牌已签发，有效期 {token_create.expires_hours} 小时",
        token_create.issued_by
    )
    
    return db_token, None


def validate_release_token(db: Session, release_order_id: int, token: str):
    db_token = db.query(ReleaseToken).filter(
        and_(
            ReleaseToken.release_order_id == release_order_id,
            ReleaseToken.token == token
        )
    ).first()
    
    if not db_token:
        return False, "令牌不存在"
    
    if db_token.used:
        return False, "令牌已使用"
    
    if datetime.utcnow() > db_token.expires_at:
        return False, "令牌已过期"
    
    return True, None


def use_release_token(db: Session, release_order_id: int, token: str, operator: str):
    is_valid, error = validate_release_token(db, release_order_id, token)
    if not is_valid:
        return False, error
    
    db_token = db.query(ReleaseToken).filter(
        and_(
            ReleaseToken.release_order_id == release_order_id,
            ReleaseToken.token == token
        )
    ).first()
    
    db_token.used = True
    db_token.used_at = datetime.utcnow()
    db.commit()
    
    create_timeline_event(
        db, release_order_id, "TOKEN_USED",
        "放行令牌已使用",
        operator
    )
    
    return True, None


def create_rollback_record(db: Session, release_order_id: int, rollback: RollbackRecordCreate):
    db_release = get_release_order(db, release_order_id)
    if not db_release:
        return None, "发布单不存在"
    
    if db_release.status not in [ReleaseStatus.DEPLOYED, ReleaseStatus.DEPLOYING]:
        return None, "只能回滚已部署或正在部署的发布单"
    
    db_rollback = RollbackRecord(
        release_order_id=release_order_id,
        reason=rollback.reason,
        rolled_back_by=rollback.rolled_back_by,
        previous_version=rollback.previous_version
    )
    db.add(db_rollback)
    
    db_release.status = ReleaseStatus.ROLLED_BACK
    db_release.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_rollback)
    
    create_timeline_event(
        db, release_order_id, "ROLLBACK",
        f"发布已回滚，原因: {rollback.reason}",
        rollback.rolled_back_by
    )
    
    return db_rollback, None


def check_timeout_release_orders(db: Session):
    now = datetime.utcnow()
    approved_orders = db.query(ReleaseOrder).filter(
        and_(
            ReleaseOrder.status == ReleaseStatus.APPROVED,
            ReleaseOrder.scheduled_at.isnot(None)
        )
    ).all()
    
    timeout_orders = []
    for order in approved_orders:
        if order.scheduled_at + timedelta(hours=order.timeout_hours) < now:
            timeout_orders.append(order)
    
    for order in timeout_orders:
        order.status = ReleaseStatus.TIMEOUT
        order.updated_at = now
        create_timeline_event(
            db, order.id, "TIMEOUT",
            "发布单超时未执行，已自动撤回",
            "system"
        )
    
    db.commit()
    return len(timeout_orders)


def batch_import_release_orders(db: Session, items: List[BatchImportItem]) -> BatchImportResponse:
    success_count = 0
    failed_count = 0
    errors = []
    created_ids = []
    
    for idx, item in enumerate(items):
        try:
            release_order_create = ReleaseOrderCreate(
                title=item.title,
                description=item.description,
                version=item.version,
                environment=item.environment,
                created_by=item.created_by,
                check_items=item.check_items,
                approvers=item.approvers
            )
            db_release = create_release_order(db, release_order_create)
            created_ids.append(db_release.id)
            success_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(f"第 {idx + 1} 项: {str(e)}")
    
    return BatchImportResponse(
        success_count=success_count,
        failed_count=failed_count,
        errors=errors,
        created_ids=created_ids
    )
