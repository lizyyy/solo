from sqlalchemy.orm import Session
from datetime import date
from typing import List, Optional, Tuple
import models
import schemas
from models import ReductionStatus, ReductionType, InvoiceStatus


class ReductionValidationError(Exception):
    def __init__(self, error_code: str, error_message: str, suggestion: str):
        self.error_code = error_code
        self.error_message = error_message
        self.suggestion = suggestion
        super().__init__(error_message)


def get_stall_by_number(db: Session, stall_number: str) -> Optional[models.Stall]:
    return db.query(models.Stall).filter(models.Stall.stall_number == stall_number).first()


def get_closure_by_notice_no(db: Session, closure_notice_no: str) -> Optional[models.MarketClosure]:
    return db.query(models.MarketClosure).filter(models.MarketClosure.closure_notice_no == closure_notice_no).first()


def get_leave_by_leave_no(db: Session, leave_no: str) -> Optional[models.PersonalLeave]:
    return db.query(models.PersonalLeave).filter(models.PersonalLeave.leave_no == leave_no).first()


def check_duplicate_reduction(
    db: Session,
    stall_id: int,
    reduction_month: str,
    reduction_type: str,
    exclude_reduction_id: Optional[int] = None
) -> Tuple[bool, str]:
    query = db.query(models.FeeReduction).filter(
        models.FeeReduction.stall_id == stall_id,
        models.FeeReduction.reduction_month == reduction_month,
        models.FeeReduction.reduction_type == reduction_type,
        models.FeeReduction.status != ReductionStatus.REJECTED
    )
    
    if exclude_reduction_id:
        query = query.filter(models.FeeReduction.id != exclude_reduction_id)
    
    existing = query.first()
    if existing:
        reason = f"该摊位{reduction_month}月份已存在{reduction_type}申请（编号：{existing.reduction_no}）"
        return True, reason
    return False, ""


def check_fee_consistency(
    db: Session,
    stall_id: int,
    reduction_month: str,
    reduction_amount: float
) -> Tuple[bool, str]:
    fee_record = db.query(models.FeeRecord).filter(
        models.FeeRecord.stall_id == stall_id,
        models.FeeRecord.fee_month == reduction_month
    ).first()
    
    if not fee_record:
        return True, f"警告：{reduction_month}月份未找到对应收费记录，请确认月份是否正确"
    
    if reduction_amount > fee_record.fee_amount:
        reason = (f"减免金额({reduction_amount}元)超过当月应缴金额({fee_record.fee_amount}元)，"
                 f"补缴截止日：{fee_record.payment_deadline}")
        return False, reason
    
    if reduction_amount <= 0:
        reason = "减免金额必须大于0"
        return False, reason
    
    return True, ""


def check_closure_leave_overlap(
    db: Session,
    stall_id: int,
    reduction_month: str,
    closure_id: Optional[int] = None,
    leave_id: Optional[int] = None
) -> Tuple[bool, str]:
    if closure_id and leave_id:
        closure = db.query(models.MarketClosure).filter(models.MarketClosure.id == closure_id).first()
        leave = db.query(models.PersonalLeave).filter(models.PersonalLeave.id == leave_id).first()
        if closure and leave:
            if closure.start_date <= leave.end_date and leave.start_date <= closure.end_date:
                reason = (f"休市期间({closure.start_date}至{closure.end_date})与"
                         f"请假期间({leave.start_date}至{leave.end_date})存在重叠，"
                         f"同一时间段不能同时申请两类减免")
                return True, reason
    
    if closure_id:
        existing_leave_reductions = db.query(models.FeeReduction).filter(
            models.FeeReduction.stall_id == stall_id,
            models.FeeReduction.reduction_month == reduction_month,
            models.FeeReduction.reduction_type == ReductionType.PERSONAL_LEAVE,
            models.FeeReduction.status != ReductionStatus.REJECTED
        ).all()
        
        if existing_leave_reductions:
            reason = (f"该摊位{reduction_month}月份已存在请假减免申请，"
                     f"不能同时申请临时休市减免，请核实后重新提交")
            return True, reason
    
    if leave_id:
        existing_closure_reductions = db.query(models.FeeReduction).filter(
            models.FeeReduction.stall_id == stall_id,
            models.FeeReduction.reduction_month == reduction_month,
            models.FeeReduction.reduction_type == ReductionType.MARKET_CLOSURE,
            models.FeeReduction.status != ReductionStatus.REJECTED
        ).all()
        
        if existing_closure_reductions:
            reason = (f"该摊位{reduction_month}月份已存在临时休市减免申请，"
                     f"不能同时申请请假减免，请核实后重新提交")
            return True, reason
    
    return False, ""


def import_reduction(
    db: Session,
    import_data: schemas.FeeReductionImport
) -> schemas.ReductionResult:
    stall = get_stall_by_number(db, import_data.stall_number)
    if not stall:
        raise ReductionValidationError(
            error_code="STALL_NOT_FOUND",
            error_message=f"摊位编号{import_data.stall_number}不存在",
            suggestion="请核对摊位编号是否正确，或先在系统中创建该摊位信息"
        )
    
    if not stall.vendor:
        raise ReductionValidationError(
            error_code="VENDOR_NOT_FOUND",
            error_message=f"摊位{import_data.stall_number}未关联摊主信息",
            suggestion="请先为该摊位配置摊主信息后再申请减免"
        )
    
    closure_id = None
    if import_data.closure_notice_no:
        closure = get_closure_by_notice_no(db, import_data.closure_notice_no)
        if closure:
            closure_id = closure.id
        else:
            raise ReductionValidationError(
                error_code="CLOSURE_NOT_FOUND",
                error_message=f"休市通知编号{import_data.closure_notice_no}不存在",
                suggestion="请核对休市通知编号是否正确，或先录入休市通知信息"
            )
    
    leave_id = None
    if import_data.leave_no:
        leave = get_leave_by_leave_no(db, import_data.leave_no)
        if leave:
            leave_id = leave.id
        else:
            raise ReductionValidationError(
                error_code="LEAVE_NOT_FOUND",
                error_message=f"请假编号{import_data.leave_no}不存在",
                suggestion="请核对请假编号是否正确，或先录入请假申请信息"
            )
    
    if import_data.reduction_type == ReductionType.MARKET_CLOSURE and not closure_id:
        raise ReductionValidationError(
            error_code="CLOSURE_REQUIRED",
            error_message="临时休市减免必须关联休市通知编号",
            suggestion="请填写正确的休市通知编号"
        )
    
    if import_data.reduction_type == ReductionType.PERSONAL_LEAVE and not leave_id:
        raise ReductionValidationError(
            error_code="LEAVE_REQUIRED",
            error_message="个人请假减免必须关联请假编号",
            suggestion="请填写正确的请假编号"
        )
    
    duplicate, dup_reason = check_duplicate_reduction(
        db, stall.id, import_data.reduction_month, import_data.reduction_type
    )
    if duplicate:
        raise ReductionValidationError(
            error_code="DUPLICATE_REDUCTION",
            error_message=dup_reason,
            suggestion="请撤回原有申请后重新提交，或联系管理员进行合并处理"
        )
    
    overlap, overlap_reason = check_closure_leave_overlap(
        db, stall.id, import_data.reduction_month, closure_id, leave_id
    )
    
    fee_ok, fee_msg = check_fee_consistency(
        db, stall.id, import_data.reduction_month, import_data.reduction_amount
    )
    
    reduction_data = schemas.FeeReductionCreate(
        reduction_no=import_data.reduction_no,
        stall_id=stall.id,
        vendor_id=stall.vendor.id,
        reduction_type=import_data.reduction_type,
        reduction_month=import_data.reduction_month,
        reduction_amount=import_data.reduction_amount,
        closure_id=closure_id,
        leave_id=leave_id,
        applicant=import_data.applicant,
        application_date=import_data.application_date,
        review_deadline=import_data.review_deadline,
        remarks=import_data.remarks
    )
    
    db_reduction = models.FeeReduction(**reduction_data.model_dump())
    db_reduction.status = ReductionStatus.IMPORTED
    
    if overlap or not fee_ok:
        db_reduction.status = ReductionStatus.PENDING_MANUAL
        manual_reasons = []
        if overlap:
            manual_reasons.append(overlap_reason)
        if not fee_ok:
            manual_reasons.append(fee_msg)
        db_reduction.reject_reason = "；".join(manual_reasons)
    
    db.add(db_reduction)
    db.commit()
    db.refresh(db_reduction)
    
    return schemas.ReductionResult(
        success=True,
        reduction=schemas.FeeReduction.model_validate(db_reduction),
        message="导入成功" if db_reduction.status != ReductionStatus.PENDING_MANUAL else "已导入，需人工处理",
        need_manual=db_reduction.status == ReductionStatus.PENDING_MANUAL,
        manual_reason=db_reduction.reject_reason if db_reduction.status == ReductionStatus.PENDING_MANUAL else None
    )


def process_reduction(
    db: Session,
    reduction_id: int,
    process_data: schemas.FeeReductionProcess
) -> schemas.ReductionResult:
    reduction = db.query(models.FeeReduction).filter(models.FeeReduction.id == reduction_id).first()
    if not reduction:
        raise ReductionValidationError(
            error_code="REDUCTION_NOT_FOUND",
            error_message="减免申请不存在",
            suggestion="请核对申请ID是否正确"
        )
    
    if reduction.status not in [ReductionStatus.IMPORTED, ReductionStatus.PENDING_MANUAL]:
        raise ReductionValidationError(
            error_code="INVALID_STATUS",
            error_message=f"当前状态({reduction.status})不允许处理",
            suggestion="只有已导入或待人工处理的申请可以进行处理"
        )
    
    reduction.status = ReductionStatus.PENDING_REVIEW
    reduction.processor = process_data.processor
    reduction.processed_at = date.today()
    db.commit()
    db.refresh(reduction)
    
    return schemas.ReductionResult(
        success=True,
        reduction=schemas.FeeReduction.model_validate(reduction),
        message="处理完成，已进入待复核状态"
    )


def review_reduction(
    db: Session,
    reduction_id: int,
    review_data: schemas.FeeReductionReview
) -> schemas.ReductionResult:
    reduction = db.query(models.FeeReduction).filter(models.FeeReduction.id == reduction_id).first()
    if not reduction:
        raise ReductionValidationError(
            error_code="REDUCTION_NOT_FOUND",
            error_message="减免申请不存在",
            suggestion="请核对申请ID是否正确"
        )
    
    if reduction.status != ReductionStatus.PENDING_REVIEW:
        raise ReductionValidationError(
            error_code="INVALID_STATUS",
            error_message=f"当前状态({reduction.status})不允许复核",
            suggestion="只有待复核的申请可以进行复核"
        )
    
    reduction.reviewer = review_data.reviewer
    reduction.reviewed_at = date.today()
    
    if review_data.approved:
        reduction.status = ReductionStatus.APPROVED
        reduction.reject_reason = None
        message = "复核通过，减免已生效"
    else:
        reduction.status = ReductionStatus.REJECTED
        reduction.reject_reason = review_data.reject_reason
        message = f"已驳回，原因：{review_data.reject_reason}"
    
    db.commit()
    db.refresh(reduction)
    
    return schemas.ReductionResult(
        success=True,
        reduction=schemas.FeeReduction.model_validate(reduction),
        message=message
    )
