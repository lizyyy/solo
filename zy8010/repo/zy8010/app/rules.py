from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import json


class Severity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class RuleResult:
    rule_code: str
    rule_name: str
    passed: bool
    severity: Severity
    description: str
    affected_data: Dict[str, Any]


class BaseRule:
    code: str = ""
    name: str = ""
    severity: Severity = Severity.MEDIUM

    async def validate(self, context: Dict[str, Any]) -> RuleResult:
        raise NotImplementedError


class PrescriptionDateAfterSettlementRule(BaseRule):
    code = "R001"
    name = "处方日期晚于结算日期校验"
    severity = Severity.HIGH

    async def validate(self, context: Dict[str, Any]) -> RuleResult:
        prescription = context.get("prescription")
        settlements = context.get("settlements", [])

        if not prescription or not settlements:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=True,
                severity=self.severity,
                description="无结算数据，跳过校验",
                affected_data={}
            )

        prescription_date = prescription.prescription_date
        for settlement in settlements:
            if prescription_date > settlement.settlement_date:
                return RuleResult(
                    rule_code=self.code,
                    rule_name=self.name,
                    passed=False,
                    severity=self.severity,
                    description=f"处方日期({prescription_date.strftime('%Y-%m-%d')})晚于结算日期({settlement.settlement_date.strftime('%Y-%m-%d')})",
                    affected_data={
                        "prescription_no": prescription.prescription_no,
                        "prescription_date": prescription_date.isoformat(),
                        "settlement_no": settlement.settlement_no,
                        "settlement_date": settlement.settlement_date.isoformat()
                    }
                )

        return RuleResult(
            rule_code=self.code,
            rule_name=self.name,
            passed=True,
            severity=self.severity,
            description="处方日期早于或等于所有结算日期",
            affected_data={}
        )


class BatchNumberNotExistsRule(BaseRule):
    code = "R002"
    name = "药品批号不存在校验"
    severity = Severity.HIGH

    async def validate(self, context: Dict[str, Any]) -> RuleResult:
        prescription_items = context.get("prescription_items", [])
        inventory_batches = context.get("inventory_batches", set())

        if not prescription_items:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=True,
                severity=self.severity,
                description="无处方药品明细，跳过校验",
                affected_data={}
            )

        missing_batches = []
        for item in prescription_items:
            if item.batch_no and item.batch_no not in inventory_batches:
                missing_batches.append({
                    "drug_name": item.drug_name,
                    "batch_no": item.batch_no,
                    "drug_code": item.drug_code
                })

        if missing_batches:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=False,
                severity=self.severity,
                description=f"发现 {len(missing_batches)} 个药品批号在库存中不存在",
                affected_data={"missing_batches": missing_batches}
            )

        return RuleResult(
            rule_code=self.code,
            rule_name=self.name,
            passed=True,
            severity=self.severity,
            description="所有药品批号均存在于库存中",
            affected_data={}
        )


class ReturnQuantityExceedsOriginalRule(BaseRule):
    code = "R003"
    name = "退药数量超过原发药数量校验"
    severity = Severity.HIGH

    async def validate(self, context: Dict[str, Any]) -> RuleResult:
        prescription_items = context.get("prescription_items", [])

        if not prescription_items:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=True,
                severity=self.severity,
                description="无处方药品明细，跳过校验",
                affected_data={}
            )

        over_returns = []
        for item in prescription_items:
            original_qty = item.quantity
            total_return_qty = sum(r.return_quantity for r in item.return_records) if item.return_records else 0

            if total_return_qty > original_qty:
                over_returns.append({
                    "drug_name": item.drug_name,
                    "original_quantity": original_qty,
                    "total_return_quantity": total_return_qty,
                    "excess_quantity": total_return_qty - original_qty,
                    "batch_no": item.batch_no
                })

        if over_returns:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=False,
                severity=self.severity,
                description=f"发现 {len(over_returns)} 条退药记录数量超过原发药数量",
                affected_data={"over_returns": over_returns}
            )

        return RuleResult(
            rule_code=self.code,
            rule_name=self.name,
            passed=True,
            severity=self.severity,
            description="所有退药数量均不超过原发药数量",
            affected_data={}
        )


class SettlementAmountConsistencyRule(BaseRule):
    code = "R004"
    name = "结算金额一致性校验"
    severity = Severity.MEDIUM

    async def validate(self, context: Dict[str, Any]) -> RuleResult:
        settlements = context.get("settlements", [])

        if not settlements:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=True,
                severity=self.severity,
                description="无结算数据，跳过校验",
                affected_data={}
            )

        inconsistencies = []
        for settlement in settlements:
            total_calc = settlement.insurance_payment + settlement.personal_payment
            if abs(total_calc - settlement.total_amount) > 0.01:
                inconsistencies.append({
                    "settlement_no": settlement.settlement_no,
                    "total_amount": settlement.total_amount,
                    "insurance_payment": settlement.insurance_payment,
                    "personal_payment": settlement.personal_payment,
                    "calculated_total": total_calc,
                    "difference": total_calc - settlement.total_amount
                })

        if inconsistencies:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=False,
                severity=self.severity,
                description=f"发现 {len(inconsistencies)} 条结算金额不一致",
                affected_data={"inconsistencies": inconsistencies}
            )

        return RuleResult(
            rule_code=self.code,
            rule_name=self.name,
            passed=True,
            severity=self.severity,
            description="所有结算金额均一致",
            affected_data={}
        )


class InventorySufficientRule(BaseRule):
    code = "R005"
    name = "库存数量充足校验"
    severity = Severity.MEDIUM

    async def validate(self, context: Dict[str, Any]) -> RuleResult:
        prescription_items = context.get("prescription_items", [])
        inventory_map = context.get("inventory_map", {})

        if not prescription_items:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=True,
                severity=self.severity,
                description="无处方药品明细，跳过校验",
                affected_data={}
            )

        insufficient = []
        for item in prescription_items:
            key = (item.drug_code or item.drug_name, item.batch_no)
            inventory_qty = inventory_map.get(key, 0)

            if item.quantity > inventory_qty:
                insufficient.append({
                    "drug_name": item.drug_name,
                    "batch_no": item.batch_no,
                    "prescription_quantity": item.quantity,
                    "inventory_quantity": inventory_qty,
                    "shortage": item.quantity - inventory_qty
                })

        if insufficient:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=False,
                severity=self.severity,
                description=f"发现 {len(insufficient)} 条药品库存不足",
                affected_data={"insufficient": insufficient}
            )

        return RuleResult(
            rule_code=self.code,
            rule_name=self.name,
            passed=True,
            severity=self.severity,
            description="所有药品库存充足",
            affected_data={}
        )


class ExpiredDrugRule(BaseRule):
    code = "R006"
    name = "过期药品校验"
    severity = Severity.HIGH

    async def validate(self, context: Dict[str, Any]) -> RuleResult:
        prescription_items = context.get("prescription_items", [])
        inventory_map = context.get("inventory_expiry_map", {})

        if not prescription_items:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=True,
                severity=self.severity,
                description="无处方药品明细，跳过校验",
                affected_data={}
            )

        today = datetime.utcnow().date()
        expired = []
        for item in prescription_items:
            key = (item.drug_code or item.drug_name, item.batch_no)
            expiry_date = inventory_map.get(key)

            if expiry_date and expiry_date.date() < today:
                expired.append({
                    "drug_name": item.drug_name,
                    "batch_no": item.batch_no,
                    "expiry_date": expiry_date.isoformat(),
                    "today": today.isoformat()
                })

        if expired:
            return RuleResult(
                rule_code=self.code,
                rule_name=self.name,
                passed=False,
                severity=self.severity,
                description=f"发现 {len(expired)} 条过期药品记录",
                affected_data={"expired": expired}
            )

        return RuleResult(
            rule_code=self.code,
            rule_name=self.name,
            passed=True,
            severity=self.severity,
            description="无过期药品",
            affected_data={}
        )


ALL_RULES = [
    PrescriptionDateAfterSettlementRule(),
    BatchNumberNotExistsRule(),
    ReturnQuantityExceedsOriginalRule(),
    SettlementAmountConsistencyRule(),
    InventorySufficientRule(),
    ExpiredDrugRule(),
]


async def run_all_rules(context: Dict[str, Any]) -> List[RuleResult]:
    results = []
    for rule in ALL_RULES:
        result = await rule.validate(context)
        results.append(result)
    return results
