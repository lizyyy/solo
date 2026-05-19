from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    Cleaner,
    CleaningRecord,
    Issue,
    Settlement,
    DeductionStatus,
    RecordStatus,
    AuditLog,
)


class SettlementService:
    BASE_RATE_PER_CLEANING = 100.0

    def __init__(self, db: Session, operator: str = "system"):
        self.db = db
        self.operator = operator

    def _log_audit(self, action: str, entity_type: str, entity_id: int, old_value: Dict = None, new_value: Dict = None):
        log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            operator=self.operator,
        )
        self.db.add(log)

    def calculate_cleaner_settlement(self, cleaner_id: int, month: str) -> Dict[str, Any]:
        year, month_num = map(int, month.split("-"))
        start_date = datetime(year, month_num, 1)
        if month_num == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month_num + 1, 1)

        records = (
            self.db.query(CleaningRecord)
            .filter(
                CleaningRecord.cleaner_id == cleaner_id,
                CleaningRecord.cleaning_date >= start_date,
                CleaningRecord.cleaning_date < end_date,
                CleaningRecord.status_record != RecordStatus.INVALID,
            )
            .all()
        )

        total_cleanings = len(records)
        base_amount = total_cleanings * self.BASE_RATE_PER_CLEANING

        issues = (
            self.db.query(Issue)
            .join(CleaningRecord)
            .filter(
                CleaningRecord.cleaner_id == cleaner_id,
                CleaningRecord.cleaning_date >= start_date,
                CleaningRecord.cleaning_date < end_date,
                Issue.deduction_status.in_([DeductionStatus.CONFIRMED, DeductionStatus.RESOLVED]),
            )
            .all()
        )

        total_deductions = sum(issue.deduction_amount for issue in issues)
        final_amount = base_amount - total_deductions

        return {
            "cleaner_id": cleaner_id,
            "month": month,
            "total_cleanings": total_cleanings,
            "base_amount": base_amount,
            "total_deductions": total_deductions,
            "final_amount": max(0, final_amount),
            "issues_count": len(issues),
            "record_ids": [r.id for r in records],
        }

    def create_or_update_settlement(self, cleaner_id: int, month: str) -> Settlement:
        calculation = self.calculate_cleaner_settlement(cleaner_id, month)

        existing = (
            self.db.query(Settlement).filter(Settlement.cleaner_id == cleaner_id, Settlement.month == month).first()
        )

        if existing:
            old_values = {
                "total_cleanings": existing.total_cleanings,
                "base_amount": existing.base_amount,
                "total_deductions": existing.total_deductions,
                "final_amount": existing.final_amount,
            }

            existing.total_cleanings = calculation["total_cleanings"]
            existing.base_amount = calculation["base_amount"]
            existing.total_deductions = calculation["total_deductions"]
            existing.final_amount = calculation["final_amount"]

            self._log_audit(
                "update_settlement",
                "Settlement",
                existing.id,
                old_value=old_values,
                new_value=calculation,
            )
        else:
            settlement = Settlement(
                cleaner_id=cleaner_id,
                month=month,
                total_cleanings=calculation["total_cleanings"],
                base_amount=calculation["base_amount"],
                total_deductions=calculation["total_deductions"],
                final_amount=calculation["final_amount"],
                is_finalized=False,
            )
            self.db.add(settlement)
            self.db.flush()

            self._log_audit(
                "create_settlement",
                "Settlement",
                settlement.id,
                new_value=calculation,
            )
            existing = settlement

        self.db.commit()
        return existing

    def finalize_settlement(self, settlement_id: int) -> Optional[Settlement]:
        settlement = self.db.query(Settlement).filter(Settlement.id == settlement_id).first()
        if not settlement or settlement.is_finalized:
            return None

        settlement.is_finalized = True
        settlement.finalized_by = self.operator
        settlement.finalized_at = datetime.utcnow()

        self._log_audit(
            "finalize_settlement",
            "Settlement",
            settlement.id,
            old_value={"is_finalized": False},
            new_value={"is_finalized": True},
        )

        self.db.commit()
        return settlement

    def get_monthly_summary(self, month: str) -> Dict[str, Any]:
        cleaners = self.db.query(Cleaner).filter(Cleaner.is_active == True).all()

        settlements = []
        for cleaner in cleaners:
            settlement = self.create_or_update_settlement(cleaner.id, month)
            settlements.append(settlement)

        total_base = sum(s.base_amount for s in settlements)
        total_deductions = sum(s.total_deductions for s in settlements)
        total_final = sum(s.final_amount for s in settlements)

        return {
            "month": month,
            "cleaners_count": len(cleaners),
            "total_cleanings": sum(s.total_cleanings for s in settlements),
            "total_base_amount": total_base,
            "total_deductions": total_deductions,
            "total_final_amount": total_final,
            "settlements": [
            {
                "cleaner_name": cleaner.name,
                "total_cleanings": s.total_cleanings,
                "base_amount": s.base_amount,
                "total_deductions": s.total_deductions,
                "final_amount": s.final_amount,
                "is_finalized": s.is_finalized,
            }
            for cleaner, s in zip(cleaners, settlements)
        ],
        }

    def get_cleaner_history(self, cleaner_id: int, limit: int = 12) -> List[Dict[str, Any]]:
        settlements = (
            self.db.query(Settlement)
            .filter(Settlement.cleaner_id == cleaner_id)
            .order_by(Settlement.month.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "month": s.month,
                "total_cleanings": s.total_cleanings,
                "base_amount": s.base_amount,
                "total_deductions": s.total_deductions,
                "final_amount": s.final_amount,
                "is_finalized": s.is_finalized,
            }
            for s in settlements
        ]
