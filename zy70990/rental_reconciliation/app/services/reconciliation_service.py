from sqlalchemy.orm import Session
from app.models import Order, MeterReading, Deduction, DepositRecord
from app.schemas import (
    ReconciliationResult, CostSummary, ElectricityCostDetail,
    WaterCostDetail, DifferenceItem, DeductionResponse, DepositRecordResponse
)
from app.config import settings


class ReconciliationService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_electricity_cost(self, meter_reading: MeterReading) -> ElectricityCostDetail:
        consumption = meter_reading.final_reading - meter_reading.initial_reading
        consumption = max(0, consumption)

        tier1_threshold = settings.ELECTRICITY_TIER_THRESHOLD_1
        tier2_threshold = settings.ELECTRICITY_TIER_THRESHOLD_2
        tier1_rate = settings.ELECTRICITY_TIER_RATE_1
        tier2_rate = settings.ELECTRICITY_TIER_RATE_2
        tier3_rate = settings.ELECTRICITY_TIER_RATE_3

        tier1_usage = min(consumption, tier1_threshold)
        tier1_cost = tier1_usage * tier1_rate

        remaining = consumption - tier1_usage
        tier2_usage = min(remaining, tier2_threshold - tier1_threshold) if remaining > 0 else 0
        tier2_cost = tier2_usage * tier2_rate

        remaining -= tier2_usage
        tier3_usage = max(0, remaining)
        tier3_cost = tier3_usage * tier3_rate

        total_cost = tier1_cost + tier2_cost + tier3_cost

        return ElectricityCostDetail(
            meter_type=meter_reading.meter_type,
            initial_reading=meter_reading.initial_reading,
            final_reading=meter_reading.final_reading,
            consumption=consumption,
            unit=meter_reading.unit,
            tier1_usage=tier1_usage,
            tier1_cost=tier1_cost,
            tier2_usage=tier2_usage,
            tier2_cost=tier2_cost,
            tier3_usage=tier3_usage,
            tier3_cost=tier3_cost,
            total_cost=total_cost
        )

    def calculate_water_cost(self, meter_reading: MeterReading) -> WaterCostDetail:
        consumption = meter_reading.final_reading - meter_reading.initial_reading
        consumption = max(0, consumption)

        total_cost = consumption * settings.WATER_RATE

        return WaterCostDetail(
            meter_type=meter_reading.meter_type,
            initial_reading=meter_reading.initial_reading,
            final_reading=meter_reading.final_reading,
            consumption=consumption,
            unit=meter_reading.unit,
            rate=settings.WATER_RATE,
            total_cost=total_cost
        )

    def reconcile_order(self, order_id: str) -> ReconciliationResult:
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return ReconciliationResult(
                order_id=order_id,
                order_no="",
                cost_summary=CostSummary(),
                is_balanced=False,
                needs_review=True
            )

        meter_readings = self.db.query(MeterReading).filter(
            MeterReading.order_id == order_id
        ).all()

        deductions = self.db.query(Deduction).filter(
            Deduction.order_id == order_id
        ).all()

        deposit_records = self.db.query(DepositRecord).filter(
            DepositRecord.order_id == order_id
        ).order_by(DepositRecord.created_at.asc()).all()

        electricity_details = []
        water_details = []
        total_electricity_cost = 0.0
        total_water_cost = 0.0

        for reading in meter_readings:
            if reading.meter_type in ["electricity", "electric"]:
                detail = self.calculate_electricity_cost(reading)
                electricity_details.append(detail)
                total_electricity_cost += detail.total_cost
            elif reading.meter_type in ["water"]:
                detail = self.calculate_water_cost(reading)
                water_details.append(detail)
                total_water_cost += detail.total_cost

        utility_total = total_electricity_cost + total_water_cost

        deduction_total = sum(d.amount for d in deductions if d.is_verified)
        pending_deductions = [d for d in deductions if not d.is_verified]

        deposit_refund = self._calculate_deposit_refund(
            order.deposit_amount, utility_total, deduction_total, deposit_records
        )

        current_balance = order.deposit_amount
        for record in deposit_records:
            if record.transaction_type == "charge":
                current_balance += record.amount
            elif record.transaction_type in ["refund", "deduct", "correction"]:
                current_balance -= record.amount

        final_balance = current_balance - utility_total - deduction_total

        cost_summary = CostSummary(
            electricity_cost=total_electricity_cost,
            water_cost=total_water_cost,
            utility_total=utility_total,
            deduction_total=deduction_total,
            deposit_refund=deposit_refund,
            final_deposit_balance=final_balance
        )

        differences = self._detect_differences(
            order, meter_readings, deductions, deposit_records, cost_summary
        )

        needs_review = len(differences) > 0 or len(pending_deductions) > 0 or final_balance < 0

        is_balanced = not needs_review and abs(final_balance) < 0.01

        deduction_responses = [
            DeductionResponse.model_validate(d) for d in deductions
        ]
        deposit_responses = [
            DepositRecordResponse.model_validate(r) for r in deposit_records
        ]

        return ReconciliationResult(
            order_id=order.id,
            order_no=order.order_no,
            cost_summary=cost_summary,
            electricity_details=electricity_details,
            water_details=water_details,
            deductions=deduction_responses,
            deposit_records=deposit_responses,
            differences=differences,
            is_balanced=is_balanced,
            needs_review=needs_review
        )

    def _calculate_deposit_refund(self, initial_deposit: float, utility_cost: float,
                                   deduction_amount: float, deposit_records: list) -> float:
        total_deduct = sum(r.amount for r in deposit_records if r.transaction_type == "deduct")
        total_refund = sum(r.amount for r in deposit_records if r.transaction_type == "refund")

        expected_deduct = utility_cost + deduction_amount
        refund = initial_deposit - expected_deduct - total_refund

        return max(0, refund)

    def _detect_differences(self, order: Order, meter_readings: list,
                            deductions: list, deposit_records: list,
                            cost_summary: CostSummary) -> list:
        differences = []

        for reading in meter_readings:
            if reading.final_reading < reading.initial_reading:
                differences.append(DifferenceItem(
                    field=f"{reading.meter_type}_meter",
                    expected=reading.initial_reading,
                    actual=reading.final_reading,
                    difference=reading.final_reading - reading.initial_reading,
                    reason="最终读数小于初始读数，可能存在抄表错误",
                    evidence=reading.photo_url
                ))

        total_verified_deductions = sum(d.amount for d in deductions if d.is_verified)
        deduct_records = [r for r in deposit_records if r.transaction_type == "deduct"]
        total_deduct_records = sum(r.amount for r in deduct_records)

        if abs(total_verified_deductions - total_deduct_records) > 0.01:
            differences.append(DifferenceItem(
                field="deposit_deduction",
                expected=total_verified_deductions,
                actual=total_deduct_records,
                difference=total_deduct_records - total_verified_deductions,
                reason="扣款金额与押金扣除记录不一致"
            ))

        current_balance = order.deposit_amount
        for record in deposit_records:
            if record.transaction_type == "charge":
                current_balance += record.amount
            elif record.transaction_type == "refund":
                current_balance -= record.amount
            elif record.transaction_type == "deduct":
                current_balance -= record.amount

        expected_final_balance = order.deposit_amount - cost_summary.utility_total - total_verified_deductions

        if abs(current_balance - expected_final_balance) > 0.01:
            differences.append(DifferenceItem(
                field="deposit_balance",
                expected=expected_final_balance,
                actual=current_balance,
                difference=current_balance - expected_final_balance,
                reason="押金余额与计算结果不一致，可能存在退款冲正记录"
            ))

        return differences