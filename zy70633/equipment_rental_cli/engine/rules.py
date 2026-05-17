from datetime import date
from typing import Dict, List, Optional, Tuple
from ..models import (
    ParsedData,
    RentalOrder,
    ReturnInspection,
    DepositDeduction,
    Equipment,
    AccessoryItem,
    AccessoryDiscrepancy,
    OverdueRecord,
    VerificationResult,
    DamageLevel,
    ApprovalStatus,
)


def calculate_overdue_days(expected_date: date, actual_date: date) -> int:
    if actual_date <= expected_date:
        return 0
    return (actual_date - expected_date).days


class AccessoryChecker:
    @staticmethod
    def check_accessories(
        expected: List[AccessoryItem],
        returned: List[AccessoryItem],
        order_id: str,
    ) -> List[AccessoryDiscrepancy]:
        discrepancies = []

        expected_dict = {a.accessory_id: a for a in expected}
        returned_dict = {a.accessory_id: a for a in returned}

        all_ids = sorted(set(expected_dict.keys()) | set(returned_dict.keys()))

        for acc_id in all_ids:
            exp_item = expected_dict.get(acc_id)
            ret_item = returned_dict.get(acc_id)

            exp_qty = exp_item.quantity if exp_item else 0
            ret_qty = ret_item.quantity if ret_item else 0
            diff = ret_qty - exp_qty
            unit_price = exp_item.unit_price if exp_item else (ret_item.unit_price if ret_item else 0.0)

            if diff != 0:
                discrepancies.append(
                    AccessoryDiscrepancy(
                        order_id=order_id,
                        accessory_id=acc_id,
                        accessory_name=exp_item.name if exp_item else (ret_item.name if ret_item else ""),
                        expected_quantity=exp_qty,
                        returned_quantity=ret_qty,
                        difference=diff,
                        unit_price=unit_price,
                        total_loss=abs(diff) * unit_price,
                    )
                )

        return discrepancies


class EquipmentChecker:
    @staticmethod
    def check_equipment_condition(
        inspection: ReturnInspection,
    ) -> List[str]:
        issues = []

        if inspection.equipment_condition == DamageLevel.MINOR:
            issues.append(f"轻微划痕: {inspection.equipment_notes}")
        elif inspection.equipment_condition == DamageLevel.MODERATE:
            issues.append(f"中度损坏: {inspection.equipment_notes}")
        elif inspection.equipment_condition == DamageLevel.SEVERE:
            issues.append(f"严重损坏: {inspection.equipment_notes}")

        return issues


class OverdueCalculator:
    @staticmethod
    def calculate_overdue(
        order: RentalOrder,
        daily_rate: float,
    ) -> Optional[OverdueRecord]:
        if not order.actual_return_date:
            return None

        overdue_days = calculate_overdue_days(
            order.expected_return_date,
            order.actual_return_date,
        )

        if overdue_days <= 0:
            return None

        overdue_fee = overdue_days * daily_rate

        return OverdueRecord(
            order_id=order.order_id,
            expected_return_date=order.expected_return_date,
            actual_return_date=order.actual_return_date,
            overdue_days=overdue_days,
            daily_rate=daily_rate,
            overdue_fee=overdue_fee,
        )


class DeductionProcessor:
    @staticmethod
    def get_deductions_by_order(
        deductions: Dict[str, DepositDeduction],
        order_id: str,
    ) -> Tuple[List[DepositDeduction], List[DepositDeduction]]:
        approved = []
        pending = []

        for deduction in sorted(deductions.values(), key=lambda x: x.deduction_id):
            if deduction.order_id == order_id:
                if deduction.approval_status == ApprovalStatus.APPROVED:
                    approved.append(deduction)
                elif deduction.approval_status == ApprovalStatus.PENDING:
                    pending.append(deduction)

        return approved, pending

    @staticmethod
    def calculate_total_deductions(approved: List[DepositDeduction]) -> float:
        return sum(d.amount for d in approved)


class VerificationEngine:
    def __init__(self, parsed_data: ParsedData):
        self.parsed_data = parsed_data
        self.results: List[VerificationResult] = []

    def verify_order(self, order: RentalOrder) -> VerificationResult:
        equipment = self.parsed_data.equipments.get(order.equipment_id)
        equipment_name = equipment.name if equipment else "未知器材"
        daily_rate = equipment.daily_rate if equipment else 0.0

        result = VerificationResult(
            order_id=order.order_id,
            borrower_name=order.borrower_name,
            equipment_name=equipment_name,
            total_deposit=order.deposit_paid,
        )

        inspection = None
        for insp in self.parsed_data.return_inspections.values():
            if insp.order_id == order.order_id:
                inspection = insp
                break

        if inspection:
            result.equipment_discrepancies = EquipmentChecker.check_equipment_condition(inspection)
            result.accessory_discrepancies = AccessoryChecker.check_accessories(
                order.accessories,
                inspection.returned_accessories,
                order.order_id,
            )
        elif not order.actual_return_date:
            pass
        else:
            result.equipment_discrepancies.append("缺少归还检查记录")

        if order.actual_return_date:
            overdue_record = OverdueCalculator.calculate_overdue(order, daily_rate)
            if overdue_record:
                result.overdue_record = overdue_record

        approved, pending = DeductionProcessor.get_deductions_by_order(
            self.parsed_data.deposit_deductions,
            order.order_id,
        )
        result.approved_deductions = approved
        result.pending_deductions = pending

        total_deductions = DeductionProcessor.calculate_total_deductions(approved)
        if result.overdue_record:
            total_deductions += result.overdue_record.overdue_fee

        result.total_deductions = total_deductions
        result.refund_amount = max(0.0, order.deposit_paid - total_deductions)

        result.is_complete = (
            inspection is not None
            and len(result.pending_deductions) == 0
        )

        return result

    def run_verification(self) -> List[VerificationResult]:
        results = []
        for order in sorted(self.parsed_data.rental_orders.values(), key=lambda x: x.order_id):
            result = self.verify_order(order)
            results.append(result)
        self.results = results
        return results

    def get_summary(self) -> dict:
        total_orders = len(self.results)
        complete_orders = sum(1 for r in self.results if r.is_complete)
        pending_orders = total_orders - complete_orders

        total_deposit = sum(r.total_deposit for r in self.results)
        total_deductions = sum(r.total_deductions for r in self.results)
        total_refund = sum(r.refund_amount for r in self.results)

        orders_with_issues = sum(
            1 for r in self.results
            if r.equipment_discrepancies or r.accessory_discrepancies or r.overdue_record
        )

        return {
            "total_orders": total_orders,
            "complete_orders": complete_orders,
            "pending_orders": pending_orders,
            "total_deposit": total_deposit,
            "total_deductions": total_deductions,
            "total_refund": total_refund,
            "orders_with_issues": orders_with_issues,
            "bad_records_count": len(self.parsed_data.bad_records),
        }
