from typing import List, Tuple, Dict, Optional
from sqlalchemy.orm import Session
from app.models import Notice, Receipt, BlastPlan
from app.exceptions import ReceiptMissingException


class ReceiptTracker:
    def get_notice_receipt_status(
        self,
        db: Session,
        plan_id: int,
    ) -> Tuple[List[Notice], List[Notice]]:
        notices = db.query(Notice).filter(
            Notice.plan_id == plan_id,
            Notice.is_active == True
        ).all()

        notices_with_receipt = []
        notices_without_receipt = []

        for notice in notices:
            receipt = db.query(Receipt).filter(
                Receipt.notice_id == notice.id
            ).first()
            if receipt:
                notices_with_receipt.append(notice)
            else:
                notices_without_receipt.append(notice)

        return notices_with_receipt, notices_without_receipt

    def check_all_receipts_received(
        self,
        db: Session,
        plan_id: int,
    ) -> Tuple[bool, List[str]]:
        notices_with_receipt, notices_without_receipt = self.get_notice_receipt_status(
            db, plan_id
        )

        missing_details = []
        for notice in notices_without_receipt:
            missing_details.append(
                f"{notice.notice_type.value} - {notice.recipient_name}"
            )

        all_received = len(notices_without_receipt) == 0
        return all_received, missing_details

    def get_receipt_summary(
        self,
        db: Session,
        plan_id: int,
    ) -> Dict:
        notices_with_receipt, notices_without_receipt = self.get_notice_receipt_status(
            db, plan_id
        )

        return {
            "total_notices": len(notices_with_receipt) + len(notices_without_receipt),
            "received_count": len(notices_with_receipt),
            "missing_count": len(notices_without_receipt),
            "missing_notices": [
                {
                    "type": n.notice_type.value,
                    "recipient": n.recipient_name,
                    "phone": n.contact_phone,
                }
                for n in notices_without_receipt
            ],
        }

    def check_and_raise(
        self,
        db: Session,
        plan_id: int,
    ) -> None:
        all_received, missing_details = self.check_all_receipts_received(db, plan_id)
        if not all_received:
            raise ReceiptMissingException(
                message=f"还有 {len(missing_details)} 个回执未收到",
                error_details=missing_details
            )

    def is_notice_receipt_received(
        self,
        db: Session,
        notice_id: int,
    ) -> bool:
        receipt = db.query(Receipt).filter(
            Receipt.notice_id == notice_id
        ).first()
        return receipt is not None


receipt_tracker = ReceiptTracker()
