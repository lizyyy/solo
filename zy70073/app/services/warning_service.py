from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.enums import (
    WarningLevel,
    WarningType,
    DeliveryStatus,
    PaymentStatus,
    AcceptanceResult,
)
from app.models.models import (
    Contract,
    DeliveryPlan,
    PaymentNode,
    AcceptanceReceipt,
    PenaltyRecord,
    WarningRecord,
)
from app.config import settings


class WarningService:
    def __init__(self, db: Session):
        self.db = db

    def create_warning(
        self,
        contract: Contract,
        warning_type: WarningType,
        warning_level: WarningLevel,
        title: str,
        description: str,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[int] = None,
    ) -> WarningRecord:
        existing = (
            self.db.query(WarningRecord)
            .filter(
                WarningRecord.contract_id == contract.id,
                WarningRecord.warning_type == warning_type,
                WarningRecord.related_entity_type == related_entity_type,
                WarningRecord.related_entity_id == related_entity_id,
                WarningRecord.is_active == True,
            )
            .first()
        )

        if existing:
            existing.title = title
            existing.description = description
            existing.warning_level = warning_level
            self.db.commit()
            self.db.refresh(existing)
            return existing

        warning = WarningRecord(
            contract_id=contract.id,
            warning_type=warning_type,
            warning_level=warning_level,
            title=title,
            description=description,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            is_active=True,
        )
        self.db.add(warning)
        self.db.commit()
        self.db.refresh(warning)
        return warning

    def resolve_warning(self, warning_id: int) -> Optional[WarningRecord]:
        warning = self.db.query(WarningRecord).filter(WarningRecord.id == warning_id).first()
        if not warning:
            return None
        warning.is_active = False
        warning.resolved_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(warning)
        return warning

    def resolve_by_entity(
        self, contract_id: int, entity_type: str, entity_id: int
    ) -> int:
        warnings = (
            self.db.query(WarningRecord)
            .filter(
                WarningRecord.contract_id == contract_id,
                WarningRecord.related_entity_type == entity_type,
                WarningRecord.related_entity_id == entity_id,
                WarningRecord.is_active == True,
            )
            .all()
        )
        for w in warnings:
            w.is_active = False
            w.resolved_at = datetime.utcnow()
        self.db.commit()
        return len(warnings)

    def check_upcoming_deliveries(self, reference_date: Optional[date] = None) -> int:
        ref_date = reference_date or date.today()
        warning_days = settings.WARNING_DAYS_BEFORE_DUE
        end_date = ref_date + timedelta(days=warning_days)

        plans = (
            self.db.query(DeliveryPlan)
            .filter(
                DeliveryPlan.status == DeliveryStatus.PENDING,
                DeliveryPlan.plan_delivery_date >= ref_date,
                DeliveryPlan.plan_delivery_date <= end_date,
            )
            .all()
        )

        count = 0
        for plan in plans:
            contract = plan.contract
            days_left = (plan.plan_delivery_date - ref_date).days

            level = WarningLevel.LOW if days_left > 1 else WarningLevel.MEDIUM
            title = f"即将到期提醒: 批次 {plan.batch_no}"
            description = (
                f"合同[{contract.contract_no}] {contract.contract_name} 的交付批次 "
                f"{plan.batch_no} 计划于 {plan.plan_delivery_date} 交付，"
                f"还剩 {days_left} 天，请催促供应商。"
            )

            self.create_warning(
                contract=contract,
                warning_type=WarningType.UPCOMING_DELIVERY,
                warning_level=level,
                title=title,
                description=description,
                related_entity_type="delivery_plan",
                related_entity_id=plan.id,
            )
            count += 1

        return count

    def check_late_deliveries(self, reference_date: Optional[date] = None) -> int:
        ref_date = reference_date or date.today()

        plans = (
            self.db.query(DeliveryPlan)
            .filter(
                DeliveryPlan.status.in_([DeliveryStatus.PENDING, DeliveryStatus.LATE]),
                DeliveryPlan.plan_delivery_date < ref_date,
            )
            .all()
        )

        count = 0
        for plan in plans:
            contract = plan.contract
            late_days = (ref_date - plan.plan_delivery_date).days

            if late_days <= 3:
                level = WarningLevel.MEDIUM
            elif late_days <= 7:
                level = WarningLevel.HIGH
            else:
                level = WarningLevel.CRITICAL

            title = f"交付逾期: 批次 {plan.batch_no}"
            description = (
                f"合同[{contract.contract_no}] {contract.contract_name} 的交付批次 "
                f"{plan.batch_no} 已于 {plan.plan_delivery_date} 到期，"
                f"已逾期 {late_days} 天，请立即跟进。"
            )

            self.create_warning(
                contract=contract,
                warning_type=WarningType.LATE_DELIVERY,
                warning_level=level,
                title=title,
                description=description,
                related_entity_type="delivery_plan",
                related_entity_id=plan.id,
            )
            count += 1

        return count

    def check_upcoming_payments(self, reference_date: Optional[date] = None) -> int:
        ref_date = reference_date or date.today()
        end_date = ref_date + timedelta(days=7)

        nodes = (
            self.db.query(PaymentNode)
            .filter(
                PaymentNode.status.in_([PaymentStatus.PENDING, PaymentStatus.DUE]),
                PaymentNode.plan_payment_date >= ref_date,
                PaymentNode.plan_payment_date <= end_date,
            )
            .all()
        )

        count = 0
        for node in nodes:
            contract = node.contract
            days_left = (node.plan_payment_date - ref_date).days

            level = WarningLevel.LOW if days_left > 3 else WarningLevel.MEDIUM
            title = f"付款即将到期: {node.node_name}"
            description = (
                f"合同[{contract.contract_no}] {contract.contract_name} 的付款节点 "
                f"{node.node_name} 计划于 {node.plan_payment_date} 支付，"
                f"金额 {node.plan_amount}，还剩 {days_left} 天。"
            )

            self.create_warning(
                contract=contract,
                warning_type=WarningType.UPCOMING_PAYMENT,
                warning_level=level,
                title=title,
                description=description,
                related_entity_type="payment_node",
                related_entity_id=node.id,
            )
            count += 1

        return count

    def check_late_payments(self, reference_date: Optional[date] = None) -> int:
        ref_date = reference_date or date.today()

        nodes = (
            self.db.query(PaymentNode)
            .filter(PaymentNode.status == PaymentStatus.OVERDUE)
            .all()
        )

        count = 0
        for node in nodes:
            contract = node.contract
            late_days = (ref_date - node.plan_payment_date).days

            if late_days <= 7:
                level = WarningLevel.MEDIUM
            elif late_days <= 15:
                level = WarningLevel.HIGH
            else:
                level = WarningLevel.CRITICAL

            title = f"付款逾期: {node.node_name}"
            description = (
                f"合同[{contract.contract_no}] {contract.contract_name} 的付款节点 "
                f"{node.node_name} 已于 {node.plan_payment_date} 到期，"
                f"应付金额 {node.plan_amount}，已逾期 {late_days} 天。"
            )

            self.create_warning(
                contract=contract,
                warning_type=WarningType.LATE_PAYMENT,
                warning_level=level,
                title=title,
                description=description,
                related_entity_type="payment_node",
                related_entity_id=node.id,
            )
            count += 1

        return count

    def check_quality_issues(self) -> int:
        acceptances = (
            self.db.query(AcceptanceReceipt)
            .filter(
                AcceptanceReceipt.result.in_([
                    AcceptanceResult.REJECTED,
                    AcceptanceResult.PARTIAL_ACCEPTED,
                ])
            )
            .all()
        )

        count = 0
        for acceptance in acceptances:
            plan = acceptance.delivery_plan
            if not plan:
                continue
            contract = plan.contract

            if acceptance.result == AcceptanceResult.REJECTED:
                level = WarningLevel.CRITICAL
                title = f"验收拒收: 批次 {plan.batch_no}"
                description = (
                    f"合同[{contract.contract_no}] {contract.contract_name} 的批次 "
                    f"{plan.batch_no} 验收不合格，已全部拒收。"
                    f"拒收数量: {acceptance.rejected_quantity}, "
                    f"拒收金额: {acceptance.rejected_amount}"
                )
            else:
                if acceptance.quality_issue_rate >= Decimal("0.1"):
                    level = WarningLevel.HIGH
                else:
                    level = WarningLevel.MEDIUM
                title = f"质量问题: 批次 {plan.batch_no}"
                description = (
                    f"合同[{contract.contract_no}] {contract.contract_name} 的批次 "
                    f"{plan.batch_no} 存在质量问题，质量问题率: "
                    f"{acceptance.quality_issue_rate * 100}%。"
                    f"拒收数量: {acceptance.rejected_quantity}, "
                    f"拒收金额: {acceptance.rejected_amount}"
                )

            self.create_warning(
                contract=contract,
                warning_type=WarningType.QUALITY_ISSUE,
                warning_level=level,
                title=title,
                description=description,
                related_entity_type="acceptance",
                related_entity_id=acceptance.id,
            )
            count += 1

        return count

    def check_unsettled_penalties(self) -> int:
        penalties = (
            self.db.query(PenaltyRecord)
            .filter(PenaltyRecord.is_settled == False)
            .all()
        )

        count = 0
        for penalty in penalties:
            contract = self.db.query(Contract).filter(
                Contract.id == penalty.contract_id
            ).first()
            if not contract:
                continue

            level = WarningLevel.MEDIUM
            title = f"未结清违约金: {penalty.penalty_type}"
            description = (
                f"合同[{contract.contract_no}] {contract.contract_name} 存在未结清违约金。"
                f"类型: {penalty.penalty_type}, "
                f"金额: {penalty.penalty_amount}, "
                f"计算详情: {penalty.calculation_details}"
            )

            self.create_warning(
                contract=contract,
                warning_type=WarningType.PENALTY_UNSETTLED,
                warning_level=level,
                title=title,
                description=description,
                related_entity_type="penalty",
                related_entity_id=penalty.id,
            )
            count += 1

        return count

    def run_all_checks(self, reference_date: Optional[date] = None) -> dict:
        results = {
            "upcoming_deliveries": self.check_upcoming_deliveries(reference_date),
            "late_deliveries": self.check_late_deliveries(reference_date),
            "upcoming_payments": self.check_upcoming_payments(reference_date),
            "late_payments": self.check_late_payments(reference_date),
            "quality_issues": self.check_quality_issues(),
            "unsettled_penalties": self.check_unsettled_penalties(),
        }
        results["total"] = sum(results.values())
        return results

    def get_active_warnings(
        self,
        contract_id: Optional[int] = None,
        warning_type: Optional[WarningType] = None,
        warning_level: Optional[WarningLevel] = None,
    ) -> List[WarningRecord]:
        query = self.db.query(WarningRecord).filter(WarningRecord.is_active == True)

        if contract_id:
            query = query.filter(WarningRecord.contract_id == contract_id)
        if warning_type:
            query = query.filter(WarningRecord.warning_type == warning_type)
        if warning_level:
            query = query.filter(WarningRecord.warning_level == warning_level)

        return query.order_by(WarningRecord.created_at.desc()).all()

    def get_warning_summary(self) -> dict:
        from collections import defaultdict

        warnings = self.get_active_warnings()

        by_type: dict[str, int] = defaultdict(int)
        by_level: dict[str, int] = defaultdict(int)
        by_contract: dict[int, int] = defaultdict(int)

        for w in warnings:
            by_type[w.warning_type.value] += 1
            by_level[w.warning_level.value] += 1
            by_contract[w.contract_id] += 1

        return {
            "total_warnings": len(warnings),
            "active_warnings": len(warnings),
            "by_type": dict(by_type),
            "by_level": dict(by_level),
            "by_contract": dict(by_contract),
        }
