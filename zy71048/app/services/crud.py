from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from datetime import datetime
from app.models import (
    BlastPlan, WarningZone, Notice, Receipt, AuditLog, ExecutionReport,
    BlastStatus, AuditAction
)
from app.schemas import (
    BlastPlanCreate, BlastPlanUpdate, WarningZoneCreate, NoticeCreate,
    ReceiptCreate, ExecutionReportCreate
)
from app.exceptions import (
    NotFoundException, DuplicateRequestException, InvalidStatusException,
    MissingDataException
)
from app.services.state_machine import BlastStateMachine
from app.services.wind_checker import wind_checker
from app.services.receipt_tracker import receipt_tracker
from app.services.zone_auditor import zone_auditor


def create_audit_log(
    db: Session,
    plan_id: int,
    action: AuditAction,
    operator: Optional[str] = None,
    old_status: Optional[BlastStatus] = None,
    new_status: Optional[BlastStatus] = None,
    detail: Optional[str] = None,
) -> AuditLog:
    audit_log = AuditLog(
        plan_id=plan_id,
        action=action,
        operator=operator,
        old_status=old_status.value if old_status else None,
        new_status=new_status.value if new_status else None,
        detail=detail,
    )
    db.add(audit_log)
    db.flush()
    return audit_log


def check_duplicate_business_no(db: Session, business_no: str) -> Optional[BlastPlan]:
    return db.query(BlastPlan).filter(BlastPlan.business_no == business_no).first()


def get_plan_by_id(db: Session, plan_id: int) -> BlastPlan:
    plan = db.query(BlastPlan).filter(BlastPlan.id == plan_id).first()
    if not plan:
        raise NotFoundException(message=f"爆破计划 ID:{plan_id} 不存在")
    return plan


def get_plan_by_business_no(db: Session, business_no: str) -> Optional[BlastPlan]:
    return db.query(BlastPlan).filter(BlastPlan.business_no == business_no).first()


def create_blast_plan(db: Session, plan_data: BlastPlanCreate) -> BlastPlan:
    existing_plan = check_duplicate_business_no(db, plan_data.business_no)
    if existing_plan:
        if existing_plan.status in {BlastStatus.ARCHIVED, BlastStatus.EXECUTED}:
            raise DuplicateRequestException(
                message=f"业务编号 [{plan_data.business_no}] 已归档/执行，无法重复提交",
                error_details=[f"当前状态: {existing_plan.status.value}"]
            )
        else:
            raise DuplicateRequestException(
                message=f"业务编号 [{plan_data.business_no}] 已存在",
                error_details=[f"当前状态: {existing_plan.status.value}, 可进行补证操作"]
            )

    plan = BlastPlan(
        business_no=plan_data.business_no,
        quarry_name=plan_data.quarry_name,
        blast_time=plan_data.blast_time,
        expected_blast_volume=plan_data.expected_blast_volume,
        safety_measures=plan_data.safety_measures,
        wind_direction=plan_data.wind_direction,
        wind_speed=plan_data.wind_speed,
        created_by=plan_data.created_by,
        remark=plan_data.remark,
        status=BlastStatus.DRAFT,
    )
    db.add(plan)
    db.flush()

    for zone_data in plan_data.zones:
        zone = WarningZone(
            plan_id=plan.id,
            zone_name=zone_data.zone_name,
            boundary_description=zone_data.boundary_description,
            radius_meters=zone_data.radius_meters,
        )
        db.add(zone)

    for notice_data in plan_data.notices:
        notice = Notice(
            plan_id=plan.id,
            notice_type=notice_data.notice_type,
            recipient_name=notice_data.recipient_name,
            contact_phone=notice_data.contact_phone,
            address=notice_data.address,
            notice_content=notice_data.notice_content,
        )
        db.add(notice)

    create_audit_log(
        db, plan.id, AuditAction.CREATE, plan_data.created_by,
        new_status=BlastStatus.DRAFT, detail="创建爆破计划"
    )

    db.commit()
    db.refresh(plan)
    return plan


def transition_plan_status(
    db: Session,
    plan: BlastPlan,
    target_status: BlastStatus,
    operator: Optional[str] = None,
    detail: Optional[str] = None,
) -> BlastPlan:
    old_status = plan.status
    BlastStateMachine.validate_transition(old_status, target_status)

    action = BlastStateMachine.get_audit_action(old_status, target_status)
    plan.status = target_status

    create_audit_log(
        db, plan.id, action, operator,
        old_status=old_status, new_status=target_status, detail=detail
    )

    db.flush()
    return plan


def submit_blast_plan(db: Session, plan_id: int, operator: Optional[str] = None) -> BlastPlan:
    plan = get_plan_by_id(db, plan_id)

    if plan.status == BlastStatus.DRAFT:
        missing_fields = []
        if not plan.wind_direction:
            missing_fields.append("风向")
        if plan.wind_speed is None:
            missing_fields.append("风速")
        if missing_fields:
            raise MissingDataException(
                message="提交前缺少必要的气象数据",
                error_details=missing_fields
            )

    plan = transition_plan_status(
        db, plan, BlastStatus.SUBMITTED, operator,
        detail="提交爆破计划"
    )

    wind_valid, wind_errors = wind_checker.validate_wind(plan.wind_direction, plan.wind_speed)
    receipt_valid, receipt_errors = receipt_tracker.check_all_receipts_received(db, plan.id)

    if not wind_valid:
        plan = transition_plan_status(
            db, plan, BlastStatus.WIND_CHECK_FAILED, operator,
            detail="风向校验不通过: " + "; ".join(wind_errors)
        )
    elif not receipt_valid:
        plan = transition_plan_status(
            db, plan, BlastStatus.RECEIPT_MISSING, operator,
            detail="回执缺失: " + "; ".join(receipt_errors)
        )
    else:
        plan = transition_plan_status(
            db, plan, BlastStatus.APPROVED, operator,
            detail="校验通过，已核准"
        )

    db.commit()
    db.refresh(plan)
    return plan


def update_blast_plan(
    db: Session,
    plan_id: int,
    update_data: BlastPlanUpdate,
    operator: Optional[str] = None,
) -> BlastPlan:
    plan = get_plan_by_id(db, plan_id)

    if not BlastStateMachine.is_modification_allowed(plan.status):
        raise InvalidStatusException(
            message=f"状态 [{plan.status.value}] 不允许修改",
            error_details=["仅草稿、异常状态、驳回状态允许修改"]
        )

    old_zone_changed = False
    if update_data.zones is not None:
        zone_dicts = [z.model_dump() for z in update_data.zones]
        new_zones, changes = zone_auditor.update_zones_with_version(
            db, plan_id, zone_dicts, operator
        )
        if changes:
            old_zone_changed = True

    if update_data.notices is not None:
        old_notices = db.query(Notice).filter(
            Notice.plan_id == plan_id,
            Notice.is_active == True
        ).all()
        for n in old_notices:
            n.is_active = False

        for notice_data in update_data.notices:
            notice = Notice(
                plan_id=plan.id,
                notice_type=notice_data.notice_type,
                recipient_name=notice_data.recipient_name,
                contact_phone=notice_data.contact_phone,
                address=notice_data.address,
                notice_content=notice_data.notice_content,
            )
            db.add(notice)

    update_dict = update_data.model_dump(exclude_unset=True, exclude={"zones", "notices"})
    for field, value in update_dict.items():
        setattr(plan, field, value)

    create_audit_log(
        db, plan.id, AuditAction.UPDATE, operator,
        old_status=plan.status, new_status=plan.status,
        detail="修改计划信息" + ("; 警戒区已变更" if old_zone_changed else "")
    )

    if old_zone_changed and plan.status == BlastStatus.SUBMITTED:
        plan = transition_plan_status(
            db, plan, BlastStatus.ZONE_CHANGED, operator,
            detail="警戒区变更，需要重新同步"
        )

    db.commit()
    db.refresh(plan)
    return plan


def add_receipt(db: Session, plan_id: int, receipt_data: ReceiptCreate) -> Receipt:
    plan = get_plan_by_id(db, plan_id)

    notice = db.query(Notice).filter(
        Notice.id == receipt_data.notice_id,
        Notice.plan_id == plan_id,
        Notice.is_active == True
    ).first()
    if not notice:
        raise NotFoundException(message="通知对象不存在")

    existing_receipt = db.query(Receipt).filter(
        Receipt.notice_id == receipt_data.notice_id
    ).first()
    if existing_receipt:
        raise DuplicateRequestException(message="该通知已有回执")

    receipt = Receipt(
        plan_id=plan_id,
        notice_id=receipt_data.notice_id,
        recipient_name=receipt_data.recipient_name,
        confirmed_at=receipt_data.confirmed_at,
        confirm_method=receipt_data.confirm_method,
        remark=receipt_data.remark,
    )
    db.add(receipt)
    db.flush()

    create_audit_log(
        db, plan_id, AuditAction.RECEIVE_RECEIPT,
        detail=f"收到回执: {notice.recipient_name}"
    )

    if plan.status == BlastStatus.RECEIPT_MISSING:
        all_received, _ = receipt_tracker.check_all_receipts_received(db, plan_id)
        if all_received:
            wind_valid, _ = wind_checker.validate_wind(plan.wind_direction, plan.wind_speed)
            if wind_valid:
                plan.status = BlastStatus.APPROVED
                create_audit_log(
                    db, plan_id, AuditAction.APPROVE,
                    old_status=BlastStatus.RECEIPT_MISSING,
                    new_status=BlastStatus.APPROVED,
                    detail="所有回执已收到，自动核准"
                )
            else:
                plan.status = BlastStatus.SUBMITTED
                create_audit_log(
                    db, plan_id, AuditAction.UPDATE,
                    old_status=BlastStatus.RECEIPT_MISSING,
                    new_status=BlastStatus.SUBMITTED,
                    detail="所有回执已收到"
                )

    db.commit()
    db.refresh(receipt)
    return receipt


def review_plan(
    db: Session,
    plan_id: int,
    operator: str,
    approve: bool,
    review_comment: Optional[str] = None,
) -> BlastPlan:
    plan = get_plan_by_id(db, plan_id)

    if plan.status not in {BlastStatus.PENDING_REVIEW, BlastStatus.SUBMITTED,
                           BlastStatus.WIND_CHECK_FAILED, BlastStatus.RECEIPT_MISSING,
                           BlastStatus.ZONE_CHANGED}:
        raise InvalidStatusException(
            message=f"状态 [{plan.status.value}] 不允许复核"
        )

    if plan.status != BlastStatus.REVIEWING:
        plan = transition_plan_status(
            db, plan, BlastStatus.REVIEWING, operator,
            detail="开始复核"
        )

    if approve:
        plan = transition_plan_status(
            db, plan, BlastStatus.APPROVED, operator,
            detail=f"复核通过: {review_comment or '无备注'}"
        )
    else:
        plan = transition_plan_status(
            db, plan, BlastStatus.REJECTED, operator,
            detail=f"复核驳回: {review_comment or '无备注'}"
        )

    db.commit()
    db.refresh(plan)
    return plan


def execute_plan(
    db: Session,
    plan_id: int,
    report_data: ExecutionReportCreate,
    operator: Optional[str] = None,
) -> ExecutionReport:
    plan = get_plan_by_id(db, plan_id)

    if plan.status != BlastStatus.APPROVED:
        raise InvalidStatusException(
            message=f"状态 [{plan.status.value}] 不允许执行",
            error_details=["仅已核准状态可以执行"]
        )

    report = ExecutionReport(
        plan_id=plan_id,
        actual_blast_time=report_data.actual_blast_time,
        actual_blast_volume=report_data.actual_blast_volume,
        wind_direction_at_blast=report_data.wind_direction_at_blast,
        wind_speed_at_blast=report_data.wind_speed_at_blast,
        on_site_supervisor=report_data.on_site_supervisor,
        safety_check_result=report_data.safety_check_result,
        abnormal_situation=report_data.abnormal_situation,
    )
    db.add(report)
    db.flush()

    plan = transition_plan_status(
        db, plan, BlastStatus.EXECUTED, operator,
        detail="爆破执行完成"
    )

    db.commit()
    db.refresh(report)
    return report


def archive_plan(
    db: Session,
    plan_id: int,
    operator: str,
    archive_remark: Optional[str] = None,
) -> BlastPlan:
    plan = get_plan_by_id(db, plan_id)

    if plan.status != BlastStatus.EXECUTED:
        raise InvalidStatusException(
            message=f"状态 [{plan.status.value}] 不允许归档",
            error_details=["仅已执行状态可以归档"]
        )

    plan = transition_plan_status(
        db, plan, BlastStatus.ARCHIVED, operator,
        detail=f"归档: {archive_remark or '无备注'}"
    )

    db.commit()
    db.refresh(plan)
    return plan


def list_plans(
    db: Session,
    status: Optional[BlastStatus] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[BlastPlan]:
    query = db.query(BlastPlan)
    if status:
        query = query.filter(BlastPlan.status == status)
    return query.order_by(BlastPlan.created_at.desc()).offset(skip).limit(limit).all()


def get_exception_plans(db: Session) -> Dict[str, List[BlastPlan]]:
    return {
        "wind_exceptions": db.query(BlastPlan).filter(
            BlastPlan.status == BlastStatus.WIND_CHECK_FAILED
        ).all(),
        "receipt_exceptions": db.query(BlastPlan).filter(
            BlastPlan.status == BlastStatus.RECEIPT_MISSING
        ).all(),
        "zone_exceptions": db.query(BlastPlan).filter(
            BlastPlan.status == BlastStatus.ZONE_CHANGED
        ).all(),
        "pending_review": db.query(BlastPlan).filter(
            BlastPlan.status.in_([BlastStatus.PENDING_REVIEW, BlastStatus.REVIEWING])
        ).all(),
    }
