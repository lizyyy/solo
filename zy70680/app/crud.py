import uuid
import json
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app import models, schemas


COMPENSATION_STATUS_FLOW = {
    "PENDING": ["MATCHING", "REJECTED", "CLOSED"],
    "MATCHING": ["ORDER_CREATED", "COMPENSATING", "REJECTED", "CLOSED"],
    "ORDER_CREATED": ["COMPENSATING", "COMPLETED", "CLOSED"],
    "COMPENSATING": ["COMPLETED", "REJECTED", "CLOSED"],
    "COMPLETED": [],
    "REJECTED": ["PENDING"],
    "WITHDRAWN": [],
    "CLOSED": [],
}


def generate_record_no() -> str:
    return f"COMP{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def generate_report_no() -> str:
    return f"RPT{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def generate_order_no() -> str:
    return f"ORD{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"


def can_transition_status(from_status: str, to_status: str) -> bool:
    return to_status in COMPENSATION_STATUS_FLOW.get(from_status, [])


def create_operation_log(db: Session, record_id: int, handler_id: str, operation: str,
                         old_status: Optional[str] = None, new_status: Optional[str] = None,
                         remark: Optional[str] = None):
    db_log = models.OperationLog(
        record_id=record_id,
        handler_id=handler_id,
        operation=operation,
        old_status=old_status,
        new_status=new_status,
        remark=remark
    )
    db.add(db_log)
    db.commit()
    return db_log


def get_transaction_by_id(db: Session, transaction_id: str):
    return db.query(models.PaymentTransaction).filter(models.PaymentTransaction.transaction_id == transaction_id).first()


def create_transaction(db: Session, transaction: schemas.PaymentTransactionCreate):
    db_transaction = models.PaymentTransaction(**transaction.model_dump())
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction


def get_user_by_id(db: Session, user_id: str):
    return db.query(models.UserAccount).filter(models.UserAccount.user_id == user_id).first()


def create_user(db: Session, user: schemas.UserAccountCreate):
    db_user = models.UserAccount(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_handler_by_id(db: Session, handler_id: str):
    return db.query(models.Handler).filter(models.Handler.handler_id == handler_id).first()


def create_handler(db: Session, handler: schemas.HandlerCreate):
    db_handler = models.Handler(**handler.model_dump())
    db.add(db_handler)
    db.commit()
    db.refresh(db_handler)
    return db_handler


def get_voucher_by_id(db: Session, voucher_id: int):
    return db.query(models.CompensationVoucher).filter(models.CompensationVoucher.id == voucher_id).first()


def get_voucher_by_code(db: Session, voucher_code: str):
    return db.query(models.CompensationVoucher).filter(models.CompensationVoucher.voucher_code == voucher_code).first()


def create_voucher(db: Session, voucher: schemas.CompensationVoucherCreate):
    db_voucher = models.CompensationVoucher(**voucher.model_dump())
    db.add(db_voucher)
    db.commit()
    db.refresh(db_voucher)
    return db_voucher


def match_transaction_to_order(db: Session, transaction_id: str) -> Optional[models.OrderDraft]:
    transaction = get_transaction_by_id(db, transaction_id)
    if not transaction:
        return None

    existing_order = db.query(models.OrderDraft).filter(models.OrderDraft.transaction_id == transaction_id).first()
    if existing_order:
        return existing_order

    order_no = generate_order_no()
    db_order = models.OrderDraft(
        order_no=order_no,
        transaction_id=transaction_id,
        user_id=transaction.user_id,
        amount=transaction.amount,
        product_info="补建订单",
        order_status="CREATED"
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


def get_compensation_record_by_no(db: Session, record_no: str):
    return db.query(models.CompensationRecord).filter(models.CompensationRecord.record_no == record_no).first()


def get_compensation_record_by_transaction(db: Session, transaction_id: str):
    return db.query(models.CompensationRecord).filter(models.CompensationRecord.transaction_id == transaction_id).first()


def get_compensation_records(db: Session, skip: int = 0, limit: int = 100, status: Optional[str] = None,
                             user_id: Optional[str] = None, handler_id: Optional[str] = None):
    query = db.query(models.CompensationRecord)
    if status:
        query = query.filter(models.CompensationRecord.status == status)
    if user_id:
        query = query.filter(models.CompensationRecord.user_id == user_id)
    if handler_id:
        query = query.filter(models.CompensationRecord.handler_id == handler_id)
    return query.order_by(models.CompensationRecord.created_at.desc()).offset(skip).limit(limit).all()


def create_compensation_record(db: Session, record: schemas.CompensationRecordCreate):
    existing_record = get_compensation_record_by_transaction(db, record.transaction_id)
    if existing_record:
        return existing_record, False

    if not record.record_no:
        record.record_no = generate_record_no()

    record_data = record.model_dump()
    if record.raw_input is None:
        record_data["raw_input"] = json.dumps(record_data, ensure_ascii=False)

    db_record = models.CompensationRecord(**record_data)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)

    create_operation_log(
        db, db_record.id, record.handler_id, "CREATE",
        new_status=db_record.status,
        remark="创建补偿记录"
    )

    return db_record, True


def update_compensation_status(db: Session, record_id: int, new_status: str, handler_id: str,
                               reason: Optional[str] = None, conclusion: Optional[str] = None):
    db_record = db.query(models.CompensationRecord).filter(models.CompensationRecord.id == record_id).first()
    if not db_record:
        return None, "记录不存在"

    old_status = db_record.status
    if old_status == new_status:
        return db_record, None

    if not can_transition_status(old_status, new_status):
        return None, f"不允许从 {old_status} 流转到 {new_status}"

    db_record.status = new_status
    if reason:
        db_record.reason = reason
    if conclusion:
        db_record.conclusion = conclusion

    db.commit()
    db.refresh(db_record)

    create_operation_log(
        db, db_record.id, handler_id, "STATUS_CHANGE",
        old_status=old_status,
        new_status=new_status,
        remark=f"状态变更: {old_status} -> {new_status}"
    )

    return db_record, None


def manual_correct_record(db: Session, record_id: int, update_data: schemas.CompensationRecordUpdate, handler_id: str):
    db_record = db.query(models.CompensationRecord).filter(models.CompensationRecord.id == record_id).first()
    if not db_record:
        return None, "记录不存在"

    old_values = {}
    update_dict = update_data.model_dump(exclude_unset=True)

    for key, value in update_dict.items():
        if hasattr(db_record, key) and value is not None:
            old_values[key] = getattr(db_record, key)
            setattr(db_record, key, value)

    db.commit()
    db.refresh(db_record)

    create_operation_log(
        db, db_record.id, handler_id, "MANUAL_CORRECT",
        remark=f"人工修正: {json.dumps(old_values, ensure_ascii=False)} -> {json.dumps(update_dict, ensure_ascii=False)}"
    )

    return db_record, None


def withdraw_record(db: Session, record_id: int, handler_id: str, reason: str):
    db_record = db.query(models.CompensationRecord).filter(models.CompensationRecord.id == record_id).first()
    if not db_record:
        return None, "记录不存在"

    old_status = db_record.status
    db_record.status = "WITHDRAWN"
    db_record.conclusion = f"撤回: {reason}"

    db.commit()
    db.refresh(db_record)

    create_operation_log(
        db, db_record.id, handler_id, "WITHDRAW",
        old_status=old_status,
        new_status="WITHDRAWN",
        remark=reason
    )

    return db_record, None


def close_record(db: Session, record_id: int, handler_id: str, reason: str):
    db_record = db.query(models.CompensationRecord).filter(models.CompensationRecord.id == record_id).first()
    if not db_record:
        return None, "记录不存在"

    old_status = db_record.status
    db_record.status = "CLOSED"
    db_record.conclusion = f"关闭: {reason}"

    db.commit()
    db.refresh(db_record)

    create_operation_log(
        db, db_record.id, handler_id, "CLOSE",
        old_status=old_status,
        new_status="CLOSED",
        remark=reason
    )

    return db_record, None


def create_compensation_report(db: Session, record_id: int, exported_by: str):
    db_record = db.query(models.CompensationRecord).filter(models.CompensationRecord.id == record_id).first()
    if not db_record:
        return None, "记录不存在"

    existing_report = db.query(models.CompensationReport).filter(models.CompensationReport.record_id == record_id).first()
    if existing_report:
        return existing_report, None

    report_no = generate_report_no()

    transaction_info = json.dumps({
        "transaction_id": db_record.transaction.transaction_id if db_record.transaction else None,
        "amount": db_record.transaction.amount if db_record.transaction else None,
        "pay_time": db_record.transaction.pay_time.isoformat() if db_record.transaction and db_record.transaction.pay_time else None
    }, ensure_ascii=False) if db_record.transaction else None

    order_info = json.dumps({
        "order_no": db_record.order.order_no if db_record.order else None,
        "amount": db_record.order.amount if db_record.order else None,
        "order_status": db_record.order.order_status if db_record.order else None
    }, ensure_ascii=False) if db_record.order else None

    user_info = json.dumps({
        "user_id": db_record.user.user_id if db_record.user else None,
        "user_name": db_record.user.user_name if db_record.user else None,
        "phone": db_record.user.phone if db_record.user else None
    }, ensure_ascii=False) if db_record.user else None

    handler_info = json.dumps({
        "handler_id": db_record.handler.handler_id if db_record.handler else None,
        "handler_name": db_record.handler.handler_name if db_record.handler else None,
        "department": db_record.handler.department if db_record.handler else None
    }, ensure_ascii=False) if db_record.handler else None

    compensation_info = json.dumps({
        "record_no": db_record.record_no,
        "status": db_record.status,
        "compensation_type": db_record.compensation_type,
        "compensation_amount": db_record.compensation_amount,
        "reason": db_record.reason,
        "conclusion": db_record.conclusion
    }, ensure_ascii=False)

    operation_logs = db.query(models.OperationLog).filter(models.OperationLog.record_id == record_id).all()
    operation_history = json.dumps([{
        "operation": log.operation,
        "handler_id": log.handler_id,
        "old_status": log.old_status,
        "new_status": log.new_status,
        "remark": log.remark,
        "created_at": log.created_at.isoformat()
    } for log in operation_logs], ensure_ascii=False)

    db_report = models.CompensationReport(
        record_id=record_id,
        report_no=report_no,
        transaction_info=transaction_info,
        order_info=order_info,
        user_info=user_info,
        handler_info=handler_info,
        compensation_info=compensation_info,
        operation_history=operation_history,
        exported_by=exported_by,
        exported_at=datetime.now()
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    return db_report, None


def get_report_by_id(db: Session, report_id: int):
    return db.query(models.CompensationReport).filter(models.CompensationReport.id == report_id).first()


def get_report_by_no(db: Session, report_no: str):
    return db.query(models.CompensationReport).filter(models.CompensationReport.report_no == report_no).first()


def get_reports(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.CompensationReport).order_by(models.CompensationReport.created_at.desc()).offset(skip).limit(limit).all()


def get_order_by_no(db: Session, order_no: str):
    return db.query(models.OrderDraft).filter(models.OrderDraft.order_no == order_no).first()


def get_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.OrderDraft).order_by(models.OrderDraft.created_at.desc()).offset(skip).limit(limit).all()


def get_operation_logs_by_record(db: Session, record_id: int):
    return db.query(models.OperationLog).filter(models.OperationLog.record_id == record_id).order_by(models.OperationLog.created_at.asc()).all()
