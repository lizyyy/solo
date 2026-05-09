from datetime import date
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.enums import DeliveryStatus, AcceptanceResult
from app.models.models import (
    Contract,
    DeliveryPlan,
    AcceptanceReceipt,
    PenaltyRecord,
)


class PenaltyCalculationResult:
    def __init__(
        self,
        penalty_type: str,
        base_amount: Decimal,
        penalty_rate: Decimal,
        penalty_amount: Decimal,
        calculation_details: str,
        late_days: Optional[int] = None,
    ):
        self.penalty_type = penalty_type
        self.base_amount = base_amount
        self.penalty_rate = penalty_rate
        self.penalty_amount = penalty_amount
        self.calculation_details = calculation_details
        self.late_days = late_days


class PenaltyService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_late_delivery_penalty(
        self, delivery_plan: DeliveryPlan, contract: Contract
    ) -> Optional[PenaltyCalculationResult]:
        if not delivery_plan.actual_delivery_date:
            return None

        plan_date = delivery_plan.plan_delivery_date
        actual_date = delivery_plan.actual_delivery_date

        if actual_date <= plan_date:
            return None

        late_days = (actual_date - plan_date).days
        if late_days <= 0:
            return None

        base_amount = delivery_plan.plan_amount
        penalty_rate = contract.late_delivery_rate
        penalty_amount = base_amount * penalty_rate * Decimal(late_days)
        penalty_amount = penalty_amount.quantize(Decimal("0.01"))

        details = (
            f"批次[{delivery_plan.batch_no}]延迟交付违约金: "
            f"计划交付={plan_date}, 实际交付={actual_date}, "
            f"延迟天数={late_days}天, 基数={base_amount}, "
            f"日违约金率={penalty_rate * 100}%, "
            f"违约金={base_amount} × {penalty_rate} × {late_days} = {penalty_amount}"
        )

        return PenaltyCalculationResult(
            penalty_type="late_delivery",
            base_amount=base_amount,
            penalty_rate=penalty_rate,
            penalty_amount=penalty_amount,
            calculation_details=details,
            late_days=late_days,
        )

    def calculate_quality_penalty(
        self, acceptance: AcceptanceReceipt, delivery_plan: DeliveryPlan, contract: Contract
    ) -> Optional[PenaltyCalculationResult]:
        if acceptance.result == AcceptanceResult.ACCEPTED:
            return None

        if acceptance.quality_issue_rate <= Decimal("0"):
            return None

        base_amount = delivery_plan.plan_amount
        penalty_rate = contract.quality_penalty_rate * acceptance.quality_issue_rate
        penalty_rate = penalty_rate.quantize(Decimal("0.00001"))
        penalty_amount = base_amount * penalty_rate
        penalty_amount = penalty_amount.quantize(Decimal("0.01"))

        if acceptance.result == AcceptanceResult.REJECTED:
            quality_rate = acceptance.quality_issue_rate
            details = (
                f"批次[{delivery_plan.batch_no}]质量不合格违约金: "
                f"质量不合格率={quality_rate * 100}%, 验收结果=全部拒收, "
                f"基数={base_amount}, 质量违约金率={contract.quality_penalty_rate * 100}%, "
                f"综合比例={penalty_rate * 100}%, "
                f"违约金={base_amount} × {penalty_rate} = {penalty_amount}"
            )
        else:
            details = (
                f"批次[{delivery_plan.batch_no}]质量问题违约金: "
                f"质量问题率={acceptance.quality_issue_rate * 100}%, "
                f"验收结果=部分验收, "
                f"拒收数量={acceptance.rejected_quantity}, "
                f"拒收金额={acceptance.rejected_amount}, "
                f"违约金={base_amount} × {penalty_rate} = {penalty_amount}"
            )

        return PenaltyCalculationResult(
            penalty_type="quality_issue",
            base_amount=base_amount,
            penalty_rate=penalty_rate,
            penalty_amount=penalty_amount,
            calculation_details=details,
        )

    def create_penalty_record(
        self,
        contract: Contract,
        delivery_plan: DeliveryPlan,
        result: PenaltyCalculationResult,
        acceptance: Optional[AcceptanceReceipt] = None,
    ) -> PenaltyRecord:
        existing = (
            self.db.query(PenaltyRecord)
            .filter(
                PenaltyRecord.contract_id == contract.id,
                PenaltyRecord.delivery_plan_id == delivery_plan.id,
                PenaltyRecord.penalty_type == result.penalty_type,
            )
            .first()
        )

        if existing:
            return existing

        record = PenaltyRecord(
            contract_id=contract.id,
            delivery_plan_id=delivery_plan.id,
            acceptance_id=acceptance.id if acceptance else None,
            penalty_type=result.penalty_type,
            penalty_amount=result.penalty_amount,
            base_amount=result.base_amount,
            penalty_rate=result.penalty_rate,
            late_days=result.late_days,
            calculation_details=result.calculation_details,
            is_settled=False,
        )

        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def process_delivery_penalties(
        self, delivery_plan_id: int
    ) -> List[PenaltyRecord]:
        delivery_plan = self.db.query(DeliveryPlan).filter(
            DeliveryPlan.id == delivery_plan_id
        ).first()

        if not delivery_plan:
            return []

        contract = delivery_plan.contract
        results: List[PenaltyRecord] = []

        if delivery_plan.actual_delivery_date:
            late_result = self.calculate_late_delivery_penalty(delivery_plan, contract)
            if late_result and late_result.penalty_amount > Decimal("0"):
                record = self.create_penalty_record(
                    contract, delivery_plan, late_result
                )
                results.append(record)

        acceptance = delivery_plan.acceptance
        if acceptance:
            quality_result = self.calculate_quality_penalty(acceptance, delivery_plan, contract)
            if quality_result and quality_result.penalty_amount > Decimal("0"):
                record = self.create_penalty_record(
                    contract, delivery_plan, quality_result, acceptance
                )
                results.append(record)

        return results

    def process_all_penalties(self) -> Tuple[int, Decimal]:
        delivery_plans = self.db.query(DeliveryPlan).filter(
            DeliveryPlan.status.in_([
                DeliveryStatus.LATE,
                DeliveryStatus.ACCEPTED,
                DeliveryStatus.PARTIAL_ACCEPTED,
                DeliveryStatus.REJECTED,
            ])
        ).all()

        total_count = 0
        total_amount = Decimal("0")

        for plan in delivery_plans:
            penalties = self.process_delivery_penalties(plan.id)
            total_count += len(penalties)
            total_amount += sum(p.penalty_amount for p in penalties)

        return total_count, total_amount

    def get_contract_penalties(self, contract_id: int) -> List[PenaltyRecord]:
        return (
            self.db.query(PenaltyRecord)
            .filter(PenaltyRecord.contract_id == contract_id)
            .order_by(PenaltyRecord.created_at.desc())
            .all()
        )

    def get_unsettled_penalties(self, contract_id: Optional[int] = None) -> List[PenaltyRecord]:
        query = self.db.query(PenaltyRecord).filter(PenaltyRecord.is_settled == False)
        if contract_id:
            query = query.filter(PenaltyRecord.contract_id == contract_id)
        return query.order_by(PenaltyRecord.created_at.desc()).all()

    def settle_penalty(self, penalty_id: int) -> Optional[PenaltyRecord]:
        penalty = self.db.query(PenaltyRecord).filter(PenaltyRecord.id == penalty_id).first()
        if not penalty:
            return None
        penalty.is_settled = True
        self.db.commit()
        self.db.refresh(penalty)
        return penalty

    def settle_all_penalties(self, contract_id: int) -> int:
        penalties = self.get_unsettled_penalties(contract_id)
        for p in penalties:
            p.is_settled = True
        self.db.commit()
        return len(penalties)
