from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from .models import (
    Store, InspectionItem, Inspection, InspectionRecord, Rectification,
    PhotoEvidence, RectificationEvent, DeductionRule,
    InspectionStatus, RectificationStatus, PhotoType
)


class BusinessRuleError(Exception):
    def __init__(self, message: str, code: str = None):
        self.message = message
        self.code = code
        super().__init__(message)


class ConflictError(BusinessRuleError):
    def __init__(self, message: str):
        super().__init__(message, code="conflict")


def create_event(db: Session, rectification_id: int, event_type: str,
                 from_status: RectificationStatus, to_status: RectificationStatus,
                 actor: str = None, description: str = None):
    event = RectificationEvent(
        rectification_id=rectification_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        actor=actor,
        description=description
    )
    db.add(event)
    db.flush()
    return event


def calculate_deduction(db: Session, item_category: str, level: int,
                        is_overdue: bool, retry_count: int) -> float:
    rule = db.query(DeductionRule).filter(
        DeductionRule.item_category == item_category,
        DeductionRule.level == level,
        DeductionRule.is_active == True
    ).first()

    if not rule:
        rule = db.query(DeductionRule).filter(
            DeductionRule.item_category.is_(None),
            DeductionRule.level == 1,
            DeductionRule.is_active == True
        ).first()

    if not rule:
        return 0.0

    deduction = rule.base_deduction

    if is_overdue:
        deduction *= rule.overdue_multiplier

    deduction += retry_count * rule.retry_penalty

    return deduction


def can_transition_status(current_status: RectificationStatus, target_status: RectificationStatus) -> bool:
    valid_transitions = {
        RectificationStatus.ASSIGNED: {
            RectificationStatus.RECTIFYING,
            RectificationStatus.CANCELLED
        },
        RectificationStatus.RECTIFYING: {
            RectificationStatus.SUBMITTED,
            RectificationStatus.OVERDUE,
            RectificationStatus.CANCELLED
        },
        RectificationStatus.SUBMITTED: {
            RectificationStatus.RECHECKING
        },
        RectificationStatus.RECHECKING: {
            RectificationStatus.PASSED,
            RectificationStatus.REJECTED
        },
        RectificationStatus.REJECTED: {
            RectificationStatus.RECTIFYING
        },
        RectificationStatus.OVERDUE: {
            RectificationStatus.RECTIFYING,
            RectificationStatus.CANCELLED
        },
        RectificationStatus.PASSED: set(),
        RectificationStatus.CANCELLED: set()
    }
    return target_status in valid_transitions.get(current_status, set())


def check_conflict(db: Session, rectification_id: int,
                   expected_status: RectificationStatus) -> Rectification:
    rect = db.query(Rectification).filter(
        Rectification.id == rectification_id
    ).with_for_update().first()

    if not rect:
        raise BusinessRuleError("整改任务不存在", code="not_found")

    if rect.status != expected_status:
        raise ConflictError(
            f"状态冲突：当前状态为 {rect.status.value}，期望状态为 {expected_status.value}"
        )

    return rect


def check_overdue(db: Session, rect: Rectification) -> bool:
    if rect.status in [RectificationStatus.PASSED, RectificationStatus.CANCELLED]:
        return False

    now = datetime.utcnow()
    if now > rect.deadline and rect.status != RectificationStatus.OVERDUE:
        from_status = rect.status
        rect.status = RectificationStatus.OVERDUE
        create_event(
            db=db,
            rectification_id=rect.id,
            event_type="overdue",
            from_status=from_status,
            to_status=RectificationStatus.OVERDUE,
            description="任务已逾期"
        )
        db.flush()
        return True
    return rect.status == RectificationStatus.OVERDUE


def start_rectification(db: Session, rect_id: int, actor: str = None):
    rect = check_conflict(db, rect_id, RectificationStatus.ASSIGNED)
    rect.status = RectificationStatus.RECTIFYING
    create_event(
        db=db,
        rectification_id=rect.id,
        event_type="start",
        from_status=RectificationStatus.ASSIGNED,
        to_status=RectificationStatus.RECTIFYING,
        actor=actor,
        description="开始整改"
    )
    db.flush()
    return rect


def submit_rectification(db: Session, rect_id: int, description: str,
                         photo_paths: list = None, actor: str = None):
    rect = check_conflict(db, rect_id, RectificationStatus.RECTIFYING)

    if not description.strip():
        raise BusinessRuleError("整改描述不能为空", code="invalid_input")

    rect.rectification_description = description
    rect.rectification_at = datetime.utcnow()
    rect.status = RectificationStatus.SUBMITTED

    if photo_paths:
        for path in photo_paths:
            photo = PhotoEvidence(
                rectification_id=rect.id,
                photo_type=PhotoType.RECTIFICATION,
                file_path=path,
                uploaded_by=actor
            )
            db.add(photo)

    create_event(
        db=db,
        rectification_id=rect.id,
        event_type="submit",
        from_status=RectificationStatus.RECTIFYING,
        to_status=RectificationStatus.SUBMITTED,
        actor=actor,
        description=f"提交整改：{description[:100]}"
    )
    db.flush()
    return rect


def start_recheck(db: Session, rect_id: int, rechecker: str):
    rect = check_conflict(db, rect_id, RectificationStatus.SUBMITTED)
    rect.status = RectificationStatus.RECHECKING
    rect.rechecker = rechecker

    create_event(
        db=db,
        rectification_id=rect.id,
        event_type="start_recheck",
        from_status=RectificationStatus.SUBMITTED,
        to_status=RectificationStatus.RECHECKING,
        actor=rechecker,
        description="开始复查"
    )
    db.flush()
    return rect


def complete_recheck(db: Session, rect_id: int, passed: bool,
                     result: str, remark: str = None,
                     photo_paths: list = None, level: int = 1):
    rect = check_conflict(db, rect_id, RectificationStatus.RECHECKING)

    record = db.query(InspectionRecord).filter(
        InspectionRecord.id == rect.record_id
    ).first()

    item = db.query(InspectionItem).filter(
        InspectionItem.id == record.item_id
    ).first() if record else None

    if passed:
        rect.status = RectificationStatus.PASSED
        rect.recheck_result = "通过"
        rect.recheck_remark = remark
        rect.recheck_at = datetime.utcnow()

        is_overdue = check_overdue(db, rect)
        final_deduction = calculate_deduction(
            db=db,
            item_category=item.category if item else None,
            level=level,
            is_overdue=is_overdue,
            retry_count=rect.retry_count
        )

        rect.final_score = (item.base_score if item else 10.0) - final_deduction
        rect.final_deduction = final_deduction

        if photo_paths:
            for path in photo_paths:
                photo = PhotoEvidence(
                    rectification_id=rect.id,
                    photo_type=PhotoType.RECHECK,
                    file_path=path,
                    uploaded_by=rect.rechecker
                )
                db.add(photo)

        create_event(
            db=db,
            rectification_id=rect.id,
            event_type="pass",
            from_status=RectificationStatus.RECHECKING,
            to_status=RectificationStatus.PASSED,
            actor=rect.rechecker,
            description=f"复查通过，扣分：{final_deduction}"
        )
    else:
        rect.status = RectificationStatus.REJECTED
        rect.recheck_result = "不通过"
        rect.recheck_remark = remark
        rect.recheck_at = datetime.utcnow()

        create_event(
            db=db,
            rectification_id=rect.id,
            event_type="reject",
            from_status=RectificationStatus.RECHECKING,
            to_status=RectificationStatus.REJECTED,
            actor=rect.rechecker,
            description=f"复查不通过：{result}"
        )

    db.flush()
    return rect


def retry_rectification(db: Session, rect_id: int, new_deadline: datetime,
                        new_assignee: str = None, actor: str = None):
    rect = db.query(Rectification).filter(Rectification.id == rect_id).first()

    if not rect:
        raise BusinessRuleError("整改任务不存在", code="not_found")

    if rect.status not in [RectificationStatus.REJECTED, RectificationStatus.OVERDUE]:
        raise BusinessRuleError(
            f"当前状态 {rect.status.value} 不允许重试",
            code="invalid_status"
        )

    new_rect = Rectification(
        record_id=rect.record_id,
        assignee=new_assignee or rect.assignee,
        status=RectificationStatus.ASSIGNED,
        deadline=new_deadline,
        retry_count=rect.retry_count + 1,
        parent_id=rect.id
    )
    db.add(new_rect)
    db.flush()

    create_event(
        db=db,
        rectification_id=new_rect.id,
        event_type="retry_created",
        from_status=None,
        to_status=RectificationStatus.ASSIGNED,
        actor=actor,
        description=f"从整改任务 #{rect.id} 重试，第 {new_rect.retry_count} 次"
    )
    db.flush()
    return new_rect


def cancel_rectification(db: Session, rect_id: int, reason: str, actor: str = None):
    rect = db.query(Rectification).filter(Rectification.id == rect_id).first()

    if not rect:
        raise BusinessRuleError("整改任务不存在", code="not_found")

    if rect.status in [RectificationStatus.PASSED, RectificationStatus.CANCELLED]:
        raise BusinessRuleError(
            f"当前状态 {rect.status.value} 不允许撤销",
            code="invalid_status"
        )

    from_status = rect.status
    rect.status = RectificationStatus.CANCELLED

    create_event(
        db=db,
        rectification_id=rect.id,
        event_type="cancel",
        from_status=from_status,
        to_status=RectificationStatus.CANCELLED,
        actor=actor,
        description=f"撤销整改：{reason}"
    )
    db.flush()
    return rect


def get_region_report(db: Session, region: str = None,
                      start_date: datetime = None, end_date: datetime = None):
    query = db.query(Store, Inspection, InspectionRecord, Rectification) \
        .outerjoin(Inspection, Store.id == Inspection.store_id) \
        .outerjoin(InspectionRecord, Inspection.id == InspectionRecord.inspection_id) \
        .outerjoin(Rectification, InspectionRecord.id == Rectification.record_id)

    if region:
        query = query.filter(Store.region == region)

    if start_date:
        query = query.filter(Inspection.inspection_date >= start_date)

    if end_date:
        query = query.filter(Inspection.inspection_date <= end_date)

    stores = db.query(Store)
    if region:
        stores = stores.filter(Store.region == region)
    store_count = stores.count()

    inspection_query = db.query(Inspection).join(Store)
    if region:
        inspection_query = inspection_query.filter(Store.region == region)
    if start_date:
        inspection_query = inspection_query.filter(Inspection.inspection_date >= start_date)
    if end_date:
        inspection_query = inspection_query.filter(Inspection.inspection_date <= end_date)
    inspection_count = inspection_query.count()

    issue_query = db.query(InspectionRecord).join(Inspection).join(Store) \
        .filter(InspectionRecord.is_pass == False)
    if region:
        issue_query = issue_query.filter(Store.region == region)
    if start_date:
        issue_query = issue_query.filter(Inspection.inspection_date >= start_date)
    if end_date:
        issue_query = issue_query.filter(Inspection.inspection_date <= end_date)
    issue_count = issue_query.count()

    rect_query = db.query(Rectification).join(InspectionRecord) \
        .join(Inspection).join(Store)
    if region:
        rect_query = rect_query.filter(Store.region == region)
    rect_count = rect_query.count()

    passed_count = rect_query.filter(
        Rectification.status == RectificationStatus.PASSED
    ).count()

    overdue_count = rect_query.filter(
        Rectification.status == RectificationStatus.OVERDUE
    ).count()

    total_deduction = db.query(func.sum(Rectification.final_deduction)) \
        .join(InspectionRecord).join(Inspection).join(Store)
    if region:
        total_deduction = total_deduction.filter(Store.region == region)
    total_deduction = total_deduction.scalar() or 0.0

    avg_score_query = db.query(func.avg(Rectification.final_score)) \
        .join(InspectionRecord).join(Inspection).join(Store) \
        .filter(Rectification.final_score.isnot(None))
    if region:
        avg_score_query = avg_score_query.filter(Store.region == region)
    avg_score = avg_score_query.scalar() or 0.0

    return {
        "region": region or "全部",
        "total_stores": store_count,
        "total_inspections": inspection_count,
        "total_issues": issue_count,
        "total_rectifications": rect_count,
        "passed_rectifications": passed_count,
        "overdue_rectifications": overdue_count,
        "total_deduction": total_deduction,
        "avg_score": avg_score
    }


def get_rectification_trace(db: Session, rect_id: int):
    rect = db.query(Rectification).filter(Rectification.id == rect_id).first()
    if not rect:
        return None

    events = db.query(RectificationEvent).filter(
        RectificationEvent.rectification_id == rect_id
    ).order_by(RectificationEvent.created_at).all()

    photos = db.query(PhotoEvidence).filter(
        PhotoEvidence.rectification_id == rect_id
    ).order_by(PhotoEvidence.upload_time).all()

    history = []
    if rect.parent_id:
        parent = db.query(Rectification).filter(
            Rectification.id == rect.parent_id
        ).first()
        if parent:
            history.append({
                "id": parent.id,
                "status": parent.status.value,
                "retry_count": parent.retry_count,
                "created_at": parent.created_at
            })

    return {
        "rectification": rect,
        "events": events,
        "photos": photos,
        "history": history,
        "retry_chain": get_retry_chain(db, rect_id)
    }


def get_retry_chain(db: Session, rect_id: int):
    chain = []
    current = db.query(Rectification).filter(Rectification.id == rect_id).first()

    while current:
        chain.insert(0, {
            "id": current.id,
            "status": current.status.value,
            "retry_count": current.retry_count,
            "assignee": current.assignee,
            "deadline": current.deadline,
            "created_at": current.created_at
        })
        current = current.parent

    return chain
