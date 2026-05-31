from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from models import Bill, ReviewRecord, HistoryRecord
from config import (
    STATUS_CONFIRMED, STATUS_PENDING, STATUS_DISPUTED,
    ANOMALY_DUPLICATE, ANOMALY_REFUND, ANOMALY_CROSS_PERIOD
)


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    def _create_review_record(
        self,
        bill_id: int,
        review_action: str,
        review_result: str,
        review_reason: Optional[str],
        review_evidence: Optional[str],
        reviewed_by: str,
        previous_status: str,
        new_status: str
    ) -> ReviewRecord:
        record = ReviewRecord(
            bill_id=bill_id,
            review_action=review_action,
            review_result=review_result,
            review_reason=review_reason,
            review_evidence=review_evidence,
            reviewed_by=reviewed_by,
            reviewed_at=datetime.now(),
            previous_status=previous_status,
            new_status=new_status
        )
        self.db.add(record)
        return record

    def _create_history_record(
        self,
        bill_id: int,
        operation_type: str,
        remark: str,
        operator: str
    ) -> HistoryRecord:
        history = HistoryRecord(
            bill_id=bill_id,
            operation_type=operation_type,
            remark=remark,
            operator=operator,
            operated_at=datetime.now()
        )
        self.db.add(history)
        return history

    def confirm_bill(
        self,
        bill_id: int,
        review_reason: Optional[str] = None,
        review_evidence: Optional[str] = None,
        reviewed_by: str = "operator"
    ) -> Bill:
        bill = self.db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            raise ValueError(f"票据ID {bill_id} 不存在")

        previous_status = bill.status
        bill.status = STATUS_CONFIRMED
        bill.anomaly_type = None
        bill.anomaly_reason = None

        self._create_review_record(
            bill_id=bill_id,
            review_action="confirm",
            review_result="confirmed",
            review_reason=review_reason or "人工复核通过，数据无误",
            review_evidence=review_evidence,
            reviewed_by=reviewed_by,
            previous_status=previous_status,
            new_status=STATUS_CONFIRMED
        )

        self._create_history_record(
            bill_id=bill_id,
            operation_type="confirm",
            remark=f"复核通过: {review_reason or '数据无误'}",
            operator=reviewed_by
        )

        self.db.commit()
        self.db.refresh(bill)
        return bill

    def mark_disputed(
        self,
        bill_id: int,
        review_reason: str,
        review_evidence: Optional[str] = None,
        reviewed_by: str = "operator"
    ) -> Bill:
        bill = self.db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            raise ValueError(f"票据ID {bill_id} 不存在")

        previous_status = bill.status
        bill.status = STATUS_DISPUTED

        self._create_review_record(
            bill_id=bill_id,
            review_action="dispute",
            review_result="disputed",
            review_reason=review_reason,
            review_evidence=review_evidence,
            reviewed_by=reviewed_by,
            previous_status=previous_status,
            new_status=STATUS_DISPUTED
        )

        self._create_history_record(
            bill_id=bill_id,
            operation_type="dispute",
            remark=f"标记为争议: {review_reason}",
            operator=reviewed_by
        )

        self.db.commit()
        self.db.refresh(bill)
        return bill

    def mark_pending(
        self,
        bill_id: int,
        review_reason: str,
        review_evidence: Optional[str] = None,
        reviewed_by: str = "operator"
    ) -> Bill:
        bill = self.db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            raise ValueError(f"票据ID {bill_id} 不存在")

        previous_status = bill.status
        bill.status = STATUS_PENDING

        self._create_review_record(
            bill_id=bill_id,
            review_action="mark_pending",
            review_result="pending",
            review_reason=review_reason,
            review_evidence=review_evidence,
            reviewed_by=reviewed_by,
            previous_status=previous_status,
            new_status=STATUS_PENDING
        )

        self._create_history_record(
            bill_id=bill_id,
            operation_type="pending",
            remark=f"标记待确认: {review_reason}",
            operator=reviewed_by
        )

        self.db.commit()
        self.db.refresh(bill)
        return bill

    def batch_review(
        self,
        bill_ids: List[int],
        action: str,
        review_reason: Optional[str] = None,
        review_evidence: Optional[str] = None,
        reviewed_by: str = "operator"
    ) -> dict:
        results = {"success": [], "failed": []}

        action_map = {
            "confirm": self.confirm_bill,
            "dispute": self.mark_disputed,
            "pending": self.mark_pending
        }

        action_func = action_map.get(action)
        if not action_func:
            raise ValueError(f"不支持的复核操作: {action}")

        for bill_id in bill_ids:
            try:
                if action == "confirm":
                    self.confirm_bill(bill_id, review_reason, review_evidence, reviewed_by)
                elif action == "dispute":
                    if not review_reason:
                        review_reason = "批量标记为争议，需进一步核实"
                    self.mark_disputed(bill_id, review_reason, review_evidence, reviewed_by)
                elif action == "pending":
                    if not review_reason:
                        review_reason = "批量标记待确认"
                    self.mark_pending(bill_id, review_reason, review_evidence, reviewed_by)
                results["success"].append(bill_id)
            except Exception as e:
                results["failed"].append({"bill_id": bill_id, "error": str(e)})

        return results

    def get_review_history(self, bill_id: int) -> List[ReviewRecord]:
        return self.db.query(ReviewRecord).filter(
            ReviewRecord.bill_id == bill_id
        ).order_by(ReviewRecord.reviewed_at.desc()).all()
