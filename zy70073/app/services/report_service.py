from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session

from app.models.enums import (
    ContractStatus,
    DeliveryStatus,
    PaymentStatus,
    WarningLevel,
    WarningType,
)
from app.models.models import (
    Contract,
    DeliveryPlan,
    PaymentNode,
    PenaltyRecord,
    WarningRecord,
)


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_daily_report(self, report_date: Optional[date] = None) -> Dict[str, Any]:
        ref_date = report_date or date.today()

        contracts = self.db.query(Contract).all()
        delivery_plans = self.db.query(DeliveryPlan).all()
        payment_nodes = self.db.query(PaymentNode).all()
        penalties = self.db.query(PenaltyRecord).all()
        active_warnings = self.db.query(WarningRecord).filter(
            WarningRecord.is_active == True
        ).all()

        report = {
            "report_date": ref_date.isoformat(),
            "generated_at": date.today().isoformat(),
            "contracts": self._contract_summary(contracts),
            "deliveries": self._delivery_summary(delivery_plans, ref_date),
            "payments": self._payment_summary(payment_nodes, ref_date),
            "penalties": self._penalty_summary(penalties),
            "warnings": self._warning_summary(active_warnings),
        }

        report["validation"] = self._validate_numbers(report)

        return report

    def _contract_summary(self, contracts: List[Contract]) -> Dict[str, Any]:
        from collections import defaultdict

        by_status: Dict[str, int] = defaultdict(int)
        total_amount = Decimal("0")

        for c in contracts:
            by_status[c.status.value] += 1
            total_amount += c.total_amount

        return {
            "total_count": len(contracts),
            "total_amount": float(total_amount),
            "by_status": dict(by_status),
        }

    def _delivery_summary(
        self, plans: List[DeliveryPlan], ref_date: date
    ) -> Dict[str, Any]:
        from collections import defaultdict

        by_status: Dict[str, int] = defaultdict(int)
        plan_total = Decimal("0")
        actual_total = Decimal("0")

        upcoming = 0
        late = 0

        for plan in plans:
            by_status[plan.status.value] += 1
            plan_total += plan.plan_amount
            if plan.actual_amount:
                actual_total += plan.actual_amount

            if plan.status == DeliveryStatus.PENDING:
                if plan.plan_delivery_date < ref_date:
                    late += 1
                elif (plan.plan_delivery_date - ref_date).days <= 3:
                    upcoming += 1

        completion_rate = (
            (actual_total / plan_total * 100) if plan_total > Decimal("0") else Decimal("0")
        )

        return {
            "total_count": len(plans),
            "plan_amount": float(plan_total),
            "actual_amount": float(actual_total),
            "completion_rate": float(completion_rate.quantize(Decimal("0.01"))),
            "upcoming_count": upcoming,
            "late_count": late,
            "by_status": dict(by_status),
        }

    def _payment_summary(
        self, nodes: List[PaymentNode], ref_date: date
    ) -> Dict[str, Any]:
        from collections import defaultdict

        by_status: Dict[str, int] = defaultdict(int)
        plan_total = Decimal("0")
        actual_total = Decimal("0")

        upcoming = 0
        overdue = 0

        for node in nodes:
            by_status[node.status.value] += 1
            plan_total += node.plan_amount
            if node.actual_amount:
                actual_total += node.actual_amount

            if node.status in [PaymentStatus.PENDING, PaymentStatus.DUE]:
                if node.plan_payment_date < ref_date:
                    overdue += 1
                elif (node.plan_payment_date - ref_date).days <= 7:
                    upcoming += 1

        payment_rate = (
            (actual_total / plan_total * 100) if plan_total > Decimal("0") else Decimal("0")
        )

        return {
            "total_count": len(nodes),
            "plan_amount": float(plan_total),
            "actual_amount": float(actual_total),
            "payment_rate": float(payment_rate.quantize(Decimal("0.01"))),
            "upcoming_count": upcoming,
            "overdue_count": overdue,
            "by_status": dict(by_status),
        }

    def _penalty_summary(self, penalties: List[PenaltyRecord]) -> Dict[str, Any]:
        from collections import defaultdict

        by_type: Dict[str, int] = defaultdict(int)
        total_amount = Decimal("0")
        unsettled_amount = Decimal("0")

        for p in penalties:
            by_type[p.penalty_type] += 1
            total_amount += p.penalty_amount
            if not p.is_settled:
                unsettled_amount += p.penalty_amount

        return {
            "total_count": len(penalties),
            "total_amount": float(total_amount),
            "unsettled_count": sum(1 for p in penalties if not p.is_settled),
            "unsettled_amount": float(unsettled_amount),
            "by_type": dict(by_type),
        }

    def _warning_summary(self, warnings: List[WarningRecord]) -> Dict[str, Any]:
        from collections import defaultdict

        by_type: Dict[str, int] = defaultdict(int)
        by_level: Dict[str, int] = defaultdict(int)
        by_contract: Dict[int, int] = defaultdict(int)

        for w in warnings:
            by_type[w.warning_type.value] += 1
            by_level[w.warning_level.value] += 1
            by_contract[w.contract_id] += 1

        return {
            "active_count": len(warnings),
            "by_type": dict(by_type),
            "by_level": dict(by_level),
            "contracts_with_warnings": len(by_contract),
        }

    def _validate_numbers(self, report: Dict[str, Any]) -> Dict[str, Any]:
        errors = []
        warnings = []

        contracts = report["contracts"]
        deliveries = report["deliveries"]
        payments = report["payments"]

        if deliveries["plan_amount"] > 0:
            pass
        elif deliveries["total_count"] > 0:
            warnings.append("存在交付计划但计划金额为0")

        if payments["plan_amount"] > 0:
            pass
        elif payments["total_count"] > 0:
            warnings.append("存在付款节点但计划金额为0")

        if report["warnings"]["active_count"] > 0:
            critical_count = report["warnings"]["by_level"].get("critical", 0)
            if critical_count > 0:
                errors.append(f"存在 {critical_count} 个严重预警需要处理")

        if report["penalties"]["unsettled_count"] > 0:
            warnings.append(f"存在 {report['penalties']['unsettled_count']} 条未结清违约金")

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    def get_contract_detail_report(self, contract_id: int) -> Optional[Dict[str, Any]]:
        contract = self.db.query(Contract).filter(Contract.id == contract_id).first()
        if not contract:
            return None

        delivery_plans = contract.delivery_plans
        payment_nodes = contract.payment_nodes
        penalties = contract.penalties
        warnings = [w for w in contract.warnings if w.is_active]

        plan_delivery = sum(dp.plan_amount for dp in delivery_plans)
        actual_delivery = sum(dp.actual_amount or Decimal("0") for dp in delivery_plans)
        delivery_progress = (
            (actual_delivery / plan_delivery * 100) if plan_delivery > Decimal("0") else Decimal("0")
        )

        plan_payment = sum(pn.plan_amount for pn in payment_nodes)
        actual_payment = sum(pn.actual_amount or Decimal("0") for pn in payment_nodes)
        payment_progress = (
            (actual_payment / plan_payment * 100) if plan_payment > Decimal("0") else Decimal("0")
        )

        total_penalty = sum(p.penalty_amount for p in penalties)
        unsettled_penalty = sum(p.penalty_amount for p in penalties if not p.is_settled)

        return {
            "contract_id": contract.id,
            "contract_no": contract.contract_no,
            "contract_name": contract.contract_name,
            "supplier_name": contract.supplier_name,
            "status": contract.status.value,
            "total_amount": float(contract.total_amount),
            "delivery": {
                "total_batches": len(delivery_plans),
                "plan_amount": float(plan_delivery),
                "actual_amount": float(actual_delivery),
                "progress_pct": float(delivery_progress.quantize(Decimal("0.01"))),
                "batches": [
                    {
                        "batch_no": dp.batch_no,
                        "status": dp.status.value,
                        "plan_date": dp.plan_delivery_date.isoformat(),
                        "actual_date": dp.actual_delivery_date.isoformat() if dp.actual_delivery_date else None,
                        "plan_amount": float(dp.plan_amount),
                        "actual_amount": float(dp.actual_amount) if dp.actual_amount else None,
                    }
                    for dp in delivery_plans
                ],
            },
            "payment": {
                "total_nodes": len(payment_nodes),
                "plan_amount": float(plan_payment),
                "actual_amount": float(actual_payment),
                "progress_pct": float(payment_progress.quantize(Decimal("0.01"))),
                "nodes": [
                    {
                        "name": pn.node_name,
                        "status": pn.status.value,
                        "plan_date": pn.plan_payment_date.isoformat(),
                        "actual_date": pn.actual_payment_date.isoformat() if pn.actual_payment_date else None,
                        "plan_amount": float(pn.plan_amount),
                        "actual_amount": float(pn.actual_amount) if pn.actual_amount else None,
                    }
                    for pn in payment_nodes
                ],
            },
            "penalties": {
                "total_count": len(penalties),
                "total_amount": float(total_penalty),
                "unsettled_count": sum(1 for p in penalties if not p.is_settled),
                "unsettled_amount": float(unsettled_penalty),
                "records": [
                    {
                        "type": p.penalty_type,
                        "amount": float(p.penalty_amount),
                        "is_settled": p.is_settled,
                        "details": p.calculation_details,
                    }
                    for p in penalties
                ],
            },
            "active_warnings": len(warnings),
        }
