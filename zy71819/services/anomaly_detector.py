from typing import List, Dict, Optional, Tuple
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from models import Bill
from config import (
    ANOMALY_DUPLICATE, ANOMALY_CROSS_PERIOD, ANOMALY_SUSPENSE,
    ANOMALY_REFUND, ANOMALY_FEE_MISMATCH, STATUS_PENDING
)


class AnomalyDetector:
    def __init__(self, db: Session):
        self.db = db

    def detect_duplicate(self, bill: Bill) -> Tuple[bool, str]:
        if not bill.serial_no:
            return False, ""

        duplicates = self.db.query(Bill).filter(
            Bill.serial_no == bill.serial_no,
            Bill.id != bill.id,
            Bill.amount == bill.amount
        ).all()

        if duplicates:
            dup_ids = [str(d.id) for d in duplicates]
            reason = f"检测到同一流水重复入账：流水号{bill.serial_no}已存在记录ID: {', '.join(dup_ids)}，金额均为{bill.amount}"
            return True, reason
        return False, ""

    def detect_cross_period_fee(self, bill: Bill) -> Tuple[bool, str]:
        if bill.bill_date and bill.due_date:
            days_diff = (bill.due_date - bill.bill_date).days
            if days_diff > 90:
                reason = f"手续费跨期风险：票据日期{bill.bill_date}与到期日期{bill.due_date}间隔{days_diff}天，超过90天跨期阈值"
                return True, reason

        if bill.fee_amount and bill.fee_amount > 0:
            fee_ratio = bill.fee_amount / abs(bill.amount) if bill.amount else 0
            if fee_ratio > 0.1:
                reason = f"手续费比例异常：手续费{bill.fee_amount}占金额{bill.amount}的{fee_ratio:.1%}，超过10%阈值，可能存在跨期情况"
                return True, reason
        return False, ""

    def detect_suspense_or_refund(self, bill: Bill) -> Tuple[bool, str]:
        keywords = ["退款", "挂账", "退回", "暂收", "待确认", "争议", "suspense", "refund", "pending"]
        text_fields = [bill.payer or "", bill.payee or "", bill.remark or "", bill.bill_no or ""]

        for field in text_fields:
            for kw in keywords:
                if kw.lower() in str(field).lower():
                    reason = f"退款挂账风险：字段包含敏感词'{kw}'，需人工复核确认款项性质"
                    return True, reason

        if bill.amount < 0:
            reason = f"负金额记录：金额{bill.amount}为负数，可能为退款或冲账，需确认"
            return True, reason

        return False, ""

    def detect_fee_mismatch(self, bill: Bill) -> Tuple[bool, str]:
        if bill.fee_amount and bill.fee_amount > 0:
            expected_fee = bill.amount * 0.006
            if abs(bill.fee_amount - expected_fee) > max(expected_fee * 0.5, 10):
                reason = f"手续费不匹配：预计手续费约{expected_fee:.2f}（按0.6%估算），实际{bill.fee_amount}，差额{abs(bill.fee_amount - expected_fee):.2f}"
                return True, reason
        return False, ""

    def detect_all(self, bill: Bill) -> Tuple[Optional[str], Optional[str]]:
        has_duplicate, reason_dup = self.detect_duplicate(bill)
        if has_duplicate:
            return ANOMALY_DUPLICATE, reason_dup

        has_suspense, reason_sus = self.detect_suspense_or_refund(bill)
        if has_suspense:
            return ANOMALY_REFUND, reason_sus

        has_cross, reason_cross = self.detect_cross_period_fee(bill)
        if has_cross:
            return ANOMALY_CROSS_PERIOD, reason_cross

        has_fee_mismatch, reason_fee = self.detect_fee_mismatch(bill)
        if has_fee_mismatch:
            return ANOMALY_FEE_MISMATCH, reason_fee

        return None, None

    def analyze_and_mark(self, bill: Bill) -> Bill:
        anomaly_type, anomaly_reason = self.detect_all(bill)
        if anomaly_type:
            bill.anomaly_type = anomaly_type
            bill.anomaly_reason = anomaly_reason
            bill.status = STATUS_PENDING
        return bill

    def batch_detect(self, bills: List[Bill]) -> List[Bill]:
        results = []
        for bill in bills:
            results.append(self.analyze_and_mark(bill))
        return results
