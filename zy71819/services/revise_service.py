from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from models import Bill, HistoryRecord
from config import STATUS_REVISED
from services.anomaly_detector import AnomalyDetector


class ReviseService:
    def __init__(self, db: Session):
        self.db = db
        self.detector = AnomalyDetector(db)

    def _create_history_record(
        self,
        bill_id: int,
        field_name: str,
        old_value: Any,
        new_value: Any,
        operator: str,
        remark: Optional[str] = None
    ):
        history = HistoryRecord(
            bill_id=bill_id,
            operation_type="revise",
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            operator=operator,
            operated_at=datetime.now(),
            remark=remark
        )
        self.db.add(history)

    def revise_bill(
        self,
        bill_id: int,
        update_data: Dict[str, Any],
        operator: str = "operator",
        revise_reason: Optional[str] = None
    ) -> Bill:
        bill = self.db.query(Bill).filter(Bill.id == bill_id).first()
        if not bill:
            raise ValueError(f"票据ID {bill_id} 不存在")

        previous_status = bill.status

        field_map = {
            "bill_no": "票据号",
            "amount": "金额",
            "fee_amount": "手续费",
            "bill_date": "票据日期",
            "due_date": "到期日期",
            "payer": "付款方",
            "payee": "收款方",
            "serial_no": "流水号",
            "bank_account": "银行账号",
            "status": "状态",
            "anomaly_type": "异常类型",
            "anomaly_reason": "异常原因",
            "remark": "备注",
        }

        for field, display_name in field_map.items():
            if field in update_data and update_data[field] is not None:
                old_value = getattr(bill, field)
                new_value = update_data[field]

                if old_value != new_value:
                    setattr(bill, field, new_value)
                    self._create_history_record(
                        bill_id=bill_id,
                        field_name=display_name,
                        old_value=old_value,
                        new_value=new_value,
                        operator=operator,
                        remark=revise_reason
                    )

        bill.status = STATUS_REVISED

        main_history = HistoryRecord(
            bill_id=bill_id,
            operation_type="revise",
            operator=operator,
            operated_at=datetime.now(),
            remark=f"数据修正: {revise_reason or '人工修正数据'}"
        )
        self.db.add(main_history)

        bill = self.detector.analyze_and_mark(bill)
        if bill.status == STATUS_REVISED and bill.anomaly_type is None:
            pass

        self.db.commit()
        self.db.refresh(bill)
        return bill

    def get_history(self, bill_id: int = None, limit: int = 100) -> list:
        query = self.db.query(HistoryRecord)
        if bill_id:
            query = query.filter(HistoryRecord.bill_id == bill_id)
        return query.order_by(HistoryRecord.operated_at.desc()).limit(limit).all()

    def revert_to_version(self, history_id: int, operator: str = "operator") -> Bill:
        history = self.db.query(HistoryRecord).filter(HistoryRecord.id == history_id).first()
        if not history:
            raise ValueError(f"历史记录ID {history_id} 不存在")

        bill = self.db.query(Bill).filter(Bill.id == history.bill_id).first()
        if not bill:
            raise ValueError(f"关联票据不存在")

        revert_history = HistoryRecord(
            bill_id=bill.id,
            operation_type="revert",
            operator=operator,
            operated_at=datetime.now(),
            remark=f"回退到历史版本: 历史记录ID {history_id}, 操作时间 {history.operated_at}"
        )
        self.db.add(revert_history)

        bill.status = STATUS_REVISED
        self.db.commit()
        self.db.refresh(bill)
        return bill
