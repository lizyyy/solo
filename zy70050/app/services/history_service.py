from sqlalchemy.orm import Session
from datetime import datetime
from typing import Any, Dict, Optional

from app.models.history import InstrumentHistory, HistoryAction
from app.models.instrument import Instrument
from app.models.user import User


class HistoryService:
    @staticmethod
    def create_history(
        db: Session,
        instrument: Instrument,
        action: HistoryAction,
        action_description: str,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        created_by: Optional[User] = None,
        remark: Optional[str] = None,
    ) -> InstrumentHistory:
        history = InstrumentHistory(
            instrument_id=instrument.id,
            action=action,
            action_description=action_description,
            old_status=old_values.get("status") if old_values and "status" in old_values else None,
            new_status=new_values.get("status") if new_values and "status" in new_values else None,
            old_values=old_values,
            new_values=new_values,
            created_by=created_by.id if created_by else None,
            created_by_name=created_by.full_name if created_by else None,
            remark=remark,
        )
        db.add(history)
        db.flush()
        return history

    @staticmethod
    def record_create(
        db: Session,
        instrument: Instrument,
        created_by: Optional[User] = None,
    ) -> InstrumentHistory:
        return HistoryService.create_history(
            db=db,
            instrument=instrument,
            action=HistoryAction.CREATE,
            action_description=f"创建计量器具档案：{instrument.name} (编号: {instrument.code})",
            new_values={
                "code": instrument.code,
                "name": instrument.name,
                "specification": instrument.specification,
                "status": instrument.status.value if instrument.status else None,
            },
            created_by=created_by,
        )

    @staticmethod
    def record_update(
        db: Session,
        instrument: Instrument,
        old_values: Dict[str, Any],
        new_values: Dict[str, Any],
        updated_by: Optional[User] = None,
        is_rectify: bool = False,
    ) -> InstrumentHistory:
        changes = []
        for key, new_val in new_values.items():
            old_val = old_values.get(key)
            if old_val != new_val:
                changes.append(f"{key}: {old_val} -> {new_val}")
        
        description = f"补录修正档案：{instrument.name}" if is_rectify else f"更新档案：{instrument.name}"
        if changes:
            description += f"。变更：{'; '.join(changes)}"
        
        return HistoryService.create_history(
            db=db,
            instrument=instrument,
            action=HistoryAction.RECTIFY if is_rectify else HistoryAction.UPDATE,
            action_description=description,
            old_values=old_values,
            new_values=new_values,
            created_by=updated_by,
        )

    @staticmethod
    def record_borrow(
        db: Session,
        instrument: Instrument,
        borrower_name: str,
        borrow_purpose: str,
        created_by: Optional[User] = None,
    ) -> InstrumentHistory:
        return HistoryService.create_history(
            db=db,
            instrument=instrument,
            action=HistoryAction.BORROW,
            action_description=f"器具被借走：{borrower_name}，用途：{borrow_purpose}",
            old_values={"status": instrument.status.value if instrument.status else None},
            new_values={"status": "borrowed"},
            created_by=created_by,
        )

    @staticmethod
    def record_return(
        db: Session,
        instrument: Instrument,
        return_condition: str,
        created_by: Optional[User] = None,
    ) -> InstrumentHistory:
        return HistoryService.create_history(
            db=db,
            instrument=instrument,
            action=HistoryAction.RETURN,
            action_description=f"器具归还，归还状况：{return_condition}",
            old_values={"status": instrument.status.value if instrument.status else None},
            new_values={"status": "in_stock"},
            created_by=created_by,
        )

    @staticmethod
    def record_calibration(
        db: Session,
        instrument: Instrument,
        calibration_type: str,
        result: str,
        created_by: Optional[User] = None,
    ) -> InstrumentHistory:
        return HistoryService.create_history(
            db=db,
            instrument=instrument,
            action=HistoryAction.CALIBRATE,
            action_description=f"执行校准：{calibration_type}，结果：{result}",
            created_by=created_by,
        )

    @staticmethod
    def record_seal(
        db: Session,
        instrument: Instrument,
        reason: str,
        approval_no: Optional[str] = None,
        created_by: Optional[User] = None,
    ) -> InstrumentHistory:
        return HistoryService.create_history(
            db=db,
            instrument=instrument,
            action=HistoryAction.SEAL,
            action_description=f"封存器具，原因：{reason}，审批单号：{approval_no or '无'}",
            old_values={"status": instrument.status.value if instrument.status else None},
            new_values={"status": "sealed"},
            created_by=created_by,
        )

    @staticmethod
    def record_unseal(
        db: Session,
        instrument: Instrument,
        approval_no: Optional[str] = None,
        created_by: Optional[User] = None,
    ) -> InstrumentHistory:
        return HistoryService.create_history(
            db=db,
            instrument=instrument,
            action=HistoryAction.UNSEAL,
            action_description=f"启封器具，审批单号：{approval_no or '无'}",
            old_values={"status": instrument.status.value if instrument.status else None},
            new_values={"status": "in_stock"},
            created_by=created_by,
        )

    @staticmethod
    def record_withdraw(
        db: Session,
        instrument: Instrument,
        old_values: Dict[str, Any],
        reason: str,
        created_by: Optional[User] = None,
    ) -> InstrumentHistory:
        return HistoryService.create_history(
            db=db,
            instrument=instrument,
            action=HistoryAction.WITHDRAW,
            action_description=f"撤回操作：{reason}",
            old_values=old_values,
            new_values={
                "status": instrument.status.value if instrument.status else None,
            },
            created_by=created_by,
        )

    @staticmethod
    def get_history_by_instrument(
        db: Session,
        instrument_id: int,
        limit: int = 100,
    ):
        return (
            db.query(InstrumentHistory)
            .filter(InstrumentHistory.instrument_id == instrument_id)
            .order_by(InstrumentHistory.created_at.desc())
            .limit(limit)
            .all()
        )
