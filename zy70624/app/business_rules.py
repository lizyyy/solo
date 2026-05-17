import json
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models import (
    TrialSchedule, TrialScheduleStatus, Deposit, DepositStatus,
    Review, ReviewStatus, Conversion, ConversionStatus,
    AuntProfile, AuntStatus, CustomerDemand, CustomerDemandStatus,
    AuditLog
)


def check_schedule_conflict(
    db: Session, aunt_id: int, start_time: datetime, end_time: datetime, exclude_schedule_id: int = None
) -> list:
    query = db.query(TrialSchedule).filter(
        TrialSchedule.aunt_id == aunt_id,
        TrialSchedule.status != TrialScheduleStatus.CANCELLED,
        TrialSchedule.is_cancelled == False,
        or_(
            and_(
                TrialSchedule.trial_start_time <= start_time,
                TrialSchedule.trial_end_time > start_time
            ),
            and_(
                TrialSchedule.trial_start_time < end_time,
                TrialSchedule.trial_end_time >= end_time
            ),
            and_(
                TrialSchedule.trial_start_time >= start_time,
                TrialSchedule.trial_end_time <= end_time
            )
        )
    )
    
    if exclude_schedule_id:
        query = query.filter(TrialSchedule.id != exclude_schedule_id)
    
    conflicts = query.all()
    return conflicts


def can_pay_deposit(db: Session, trial_schedule_id: int) -> tuple[bool, str]:
    schedule = db.query(TrialSchedule).filter(TrialSchedule.id == trial_schedule_id).first()
    if not schedule:
        return False, "试工排期不存在"
    
    if schedule.status == TrialScheduleStatus.CANCELLED or schedule.is_cancelled:
        return False, "试工排期已取消"
    
    existing_deposit = db.query(Deposit).filter(
        Deposit.trial_schedule_id == trial_schedule_id,
        Deposit.status.in_([DepositStatus.PAID, DepositStatus.CONVERTED])
    ).first()
    
    if existing_deposit:
        return False, "该试工已有有效押金"
    
    return True, ""


def can_refund_deposit(db: Session, deposit_id: int) -> tuple[bool, str]:
    deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not deposit:
        return False, "押金记录不存在"
    
    if deposit.status != DepositStatus.PAID:
        return False, "押金状态不是已支付，无法退款"
    
    return True, ""


def can_convert_deposit(db: Session, deposit_id: int) -> tuple[bool, str]:
    deposit = db.query(Deposit).filter(Deposit.id == deposit_id).first()
    if not deposit:
        return False, "押金记录不存在"
    
    if deposit.status != DepositStatus.PAID:
        return False, "押金状态不是已支付，无法转为合同定金"
    
    return True, ""


def can_submit_review(db: Session, trial_schedule_id: int) -> tuple[bool, str]:
    schedule = db.query(TrialSchedule).filter(TrialSchedule.id == trial_schedule_id).first()
    if not schedule:
        return False, "试工排期不存在"
    
    if schedule.status != TrialScheduleStatus.COMPLETED:
        return False, "试工未完成，无法提交评价"
    
    return True, ""


def can_review_approval(db: Session, review_id: int) -> tuple[bool, str]:
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        return False, "评价记录不存在"
    
    if review.status != ReviewStatus.SUBMITTED:
        return False, "评价状态不是已提交，无法复核"
    
    return True, ""


def check_conversion_eligibility(db: Session, trial_schedule_id: int) -> tuple[bool, str]:
    schedule = db.query(TrialSchedule).filter(TrialSchedule.id == trial_schedule_id).first()
    if not schedule:
        return False, "试工排期不存在"
    
    if schedule.status != TrialScheduleStatus.COMPLETED:
        return False, "试工未完成"
    
    approved_review = db.query(Review).filter(
        Review.trial_schedule_id == trial_schedule_id,
        Review.status == ReviewStatus.APPROVED
    ).first()
    
    if not approved_review:
        return False, "没有已通过的评价"
    
    if approved_review.overall_rating < 3:
        return False, "综合评分低于3分，不符合转正条件"
    
    paid_deposit = db.query(Deposit).filter(
        Deposit.trial_schedule_id == trial_schedule_id,
        Deposit.status == DepositStatus.PAID
    ).first()
    
    if not paid_deposit:
        return False, "押金未支付"
    
    return True, "符合转正条件"


def get_conversion_valid_status_transitions() -> dict:
    return {
        ConversionStatus.PENDING: [ConversionStatus.ELIGIBLE, ConversionStatus.NOT_ELIGIBLE, ConversionStatus.CLOSED],
        ConversionStatus.ELIGIBLE: [ConversionStatus.CONVERTED, ConversionStatus.REJECTED, ConversionStatus.CLOSED],
        ConversionStatus.NOT_ELIGIBLE: [ConversionStatus.CLOSED],
        ConversionStatus.CONVERTED: [],
        ConversionStatus.REJECTED: [ConversionStatus.CLOSED],
        ConversionStatus.CLOSED: []
    }


def can_transition_conversion_status(current_status: ConversionStatus, target_status: ConversionStatus) -> bool:
    transitions = get_conversion_valid_status_transitions()
    return target_status in transitions.get(current_status, [])


def create_audit_log(db: Session, operation_type: str, entity_type: str, entity_id: Optional[int], original_input: dict, handler: str, conclusion: str):
    audit_log = AuditLog(
        operation_type=operation_type,
        entity_type=entity_type,
        entity_id=entity_id,
        original_input=json.dumps(original_input, ensure_ascii=False, default=str),
        handler=handler,
        conclusion=conclusion
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def update_aunt_status_when_schedule(db: Session, aunt_id: int):
    aunt = db.query(AuntProfile).filter(AuntProfile.id == aunt_id).first()
    if aunt and aunt.status == AuntStatus.AVAILABLE:
        aunt.status = AuntStatus.ON_TRIAL
        db.commit()


def update_aunt_status_when_conversion(db: Session, aunt_id: int):
    aunt = db.query(AuntProfile).filter(AuntProfile.id == aunt_id).first()
    if aunt:
        aunt.status = AuntStatus.WORKING
        db.commit()


def update_demand_status_when_schedule(db: Session, demand_id: int):
    demand = db.query(CustomerDemand).filter(CustomerDemand.id == demand_id).first()
    if demand and demand.status == CustomerDemandStatus.PENDING:
        demand.status = CustomerDemandStatus.TRIAL_SCHEDULED
        db.commit()


def update_demand_status_when_conversion(db: Session, demand_id: int):
    demand = db.query(CustomerDemand).filter(CustomerDemand.id == demand_id).first()
    if demand:
        demand.status = CustomerDemandStatus.COMPLETED
        db.commit()
