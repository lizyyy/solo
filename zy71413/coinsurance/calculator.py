from typing import List, Tuple
from decimal import Decimal, ROUND_HALF_UP

from .models import (
    Policy,
    Claim,
    CoInsurer,
    Bill,
    BillItem,
    BillStatus,
    ValidationResult,
    ValidationSeverity,
)


RATIO_TOLERANCE = 0.0001


class CoInsuranceCalculator:
    def validate_ratio(self, co_insurers: List[CoInsurer]) -> List[ValidationResult]:
        results: List[ValidationResult] = []
        total_ratio = sum(c.share_ratio for c in co_insurers)

        if abs(total_ratio - 1.0) > RATIO_TOLERANCE:
            results.append(
                ValidationResult(
                    field="share_ratio",
                    severity=ValidationSeverity.ERROR,
                    message=f"共保比例不闭合，合计为 {total_ratio:.4%}，应为 100%",
                    code="RATIO_NOT_CLOSED",
                )
            )

        for insurer in co_insurers:
            if insurer.share_ratio <= 0:
                results.append(
                    ValidationResult(
                        field=f"share_ratio.{insurer.insurer_id}",
                        severity=ValidationSeverity.ERROR,
                        message=f"承保人 {insurer.insurer_name} 的比例必须大于0",
                        code="RATIO_NEGATIVE",
                    )
                )
            elif insurer.share_ratio > 1:
                results.append(
                    ValidationResult(
                        field=f"share_ratio.{insurer.insurer_id}",
                        severity=ValidationSeverity.ERROR,
                        message=f"承保人 {insurer.insurer_name} 的比例不能超过100%",
                        code="RATIO_EXCEEDED",
                    )
                )

        return results

    def validate_deductible(
        self, policy: Policy, claim: Claim, existing_bills: List[Bill]
    ) -> List[ValidationResult]:
        results: List[ValidationResult] = []

        if policy.deductible <= 0:
            results.append(
                ValidationResult(
                    field="deductible",
                    severity=ValidationSeverity.WARNING,
                    message="保单免赔额为0，请确认是否正确",
                    code="DEDUCTIBLE_ZERO",
                )
            )

        if claim.deductible_applied is not None and claim.deductible_applied != policy.deductible:
            results.append(
                ValidationResult(
                    field="deductible_applied",
                    severity=ValidationSeverity.WARNING,
                    message=f"赔案免赔额 {claim.deductible_applied} 与保单免赔额 {policy.deductible} 不一致",
                    code="DEDUCTIBLE_MISMATCH",
                )
            )

        if claim.claim_amount <= 0:
            results.append(
                ValidationResult(
                    field="claim_amount",
                    severity=ValidationSeverity.ERROR,
                    message="赔案金额必须大于0",
                    code="CLAIM_AMOUNT_ZERO",
                )
            )

        if claim.deductible_waived:
            results.append(
                ValidationResult(
                    field="deductible_waived",
                    severity=ValidationSeverity.INFO,
                    message="免赔额已豁免",
                    code="DEDUCTIBLE_WAIVED",
                )
            )

        duplicate_deductible_bills = [
            b
            for b in existing_bills
            if b.claim_no == claim.claim_no
            and b.deductible_amount > 0
            and b.status != BillStatus.WITHDRAWN
        ]
        if len(duplicate_deductible_bills) > 0 and not claim.deductible_waived:
            results.append(
                ValidationResult(
                    field="deductible",
                    severity=ValidationSeverity.ERROR,
                    message=f"免赔额可能重复扣除，已有 {len(duplicate_deductible_bills)} 张账单扣过免赔额",
                    code="DEDUCTIBLE_DUPLICATE",
                )
            )

        return results

    def validate_confirmations(
        self, co_insurers: List[CoInsurer]
    ) -> Tuple[List[ValidationResult], bool]:
        results: List[ValidationResult] = []
        all_confirmed = True

        unconfirmed_followers = [
            c for c in co_insurers if not c.is_leader and not c.confirmed
        ]

        if len(unconfirmed_followers) > 0:
            all_confirmed = False
            names = ", ".join(c.insurer_name for c in unconfirmed_followers)
            results.append(
                ValidationResult(
                    field="confirmation",
                    severity=ValidationSeverity.WARNING,
                    message=f"从承保人尚未确认: {names}",
                    code="FOLLOWER_NOT_CONFIRMED",
                )
            )

        leader = next((c for c in co_insurers if c.is_leader), None)
        if leader and not leader.confirmed:
            all_confirmed = False
            results.append(
                ValidationResult(
                    field="confirmation",
                    severity=ValidationSeverity.WARNING,
                    message=f"主承保人 {leader.insurer_name} 尚未确认",
                    code="LEADER_NOT_CONFIRMED",
                )
            )

        return results, all_confirmed

    def validate_required_fields(self, policy: Policy, claim: Claim) -> List[ValidationResult]:
        results: List[ValidationResult] = []

        required_policy_fields = [
            ("policy_no", policy.policy_no),
            ("policy_name", policy.policy_name),
            ("effective_date", policy.effective_date),
            ("expiry_date", policy.expiry_date),
            ("total_sum_insured", policy.total_sum_insured),
        ]

        for field_name, field_value in required_policy_fields:
            if field_value is None or (isinstance(field_value, str) and not field_value.strip()):
                results.append(
                    ValidationResult(
                        field=f"policy.{field_name}",
                        severity=ValidationSeverity.ERROR,
                        message=f"保单缺少必填字段: {field_name}",
                        code="MISSING_FIELD",
                    )
                )

        required_claim_fields = [
            ("claim_no", claim.claim_no),
            ("policy_no", claim.policy_no),
            ("claim_amount", claim.claim_amount),
            ("reported_date", claim.reported_date),
            ("accident_date", claim.accident_date),
            ("loss_description", claim.loss_description),
        ]

        for field_name, field_value in required_claim_fields:
            if field_value is None or (isinstance(field_value, str) and not field_value.strip()):
                results.append(
                    ValidationResult(
                        field=f"claim.{field_name}",
                        severity=ValidationSeverity.ERROR,
                        message=f"赔案缺少必填字段: {field_name}",
                        code="MISSING_FIELD",
                    )
                )

        if claim.accident_date < policy.effective_date:
            results.append(
                ValidationResult(
                    field="accident_date",
                    severity=ValidationSeverity.ERROR,
                    message="事故日期在保单生效日期之前",
                    code="ACCIDENT_BEFORE_EFFECTIVE",
                )
            )

        if claim.accident_date > policy.expiry_date:
            results.append(
                ValidationResult(
                    field="accident_date",
                    severity=ValidationSeverity.ERROR,
                    message="事故日期在保单失效日期之后",
                    code="ACCIDENT_AFTER_EXPIRY",
                )
            )

        return results

    def calculate_deductible(self, policy: Policy, claim: Claim) -> float:
        if claim.deductible_waived:
            return 0.0

        if claim.deductible_applied is not None:
            deductible = claim.deductible_applied
        else:
            deductible = policy.deductible

        if claim.claim_amount <= deductible:
            return claim.claim_amount

        return deductible

    def calculate_shares(
        self, net_amount: float, co_insurers: List[CoInsurer]
    ) -> List[BillItem]:
        items: List[BillItem] = []
        total_allocated = Decimal("0")
        net_amount_dec = Decimal(str(net_amount))

        for i, insurer in enumerate(co_insurers):
            ratio = Decimal(str(insurer.share_ratio))
            if i == len(co_insurers) - 1:
                amount = net_amount_dec - total_allocated
            else:
                amount = (net_amount_dec * ratio).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                total_allocated += amount

            items.append(
                BillItem(
                    insurer_id=insurer.insurer_id,
                    insurer_name=insurer.insurer_name,
                    is_leader=insurer.is_leader,
                    share_ratio=insurer.share_ratio,
                    payable_amount=float(amount),
                    confirmed=insurer.confirmed,
                    confirmed_at=insurer.confirmed_at,
                )
            )

        return items

    def validate_all(
        self, policy: Policy, claim: Claim, existing_bills: List[Bill]
    ) -> List[ValidationResult]:
        all_results: List[ValidationResult] = []

        all_results.extend(self.validate_required_fields(policy, claim))
        all_results.extend(self.validate_ratio(policy.co_insurers))
        all_results.extend(self.validate_deductible(policy, claim, existing_bills))

        confirm_results, _ = self.validate_confirmations(policy.co_insurers)
        all_results.extend(confirm_results)

        return all_results

    def create_bill(
        self,
        bill_no: str,
        policy: Policy,
        claim: Claim,
        existing_bills: List[Bill],
    ) -> Bill:
        validation_results = self.validate_all(policy, claim, existing_bills)

        has_errors = any(v.severity == ValidationSeverity.ERROR for v in validation_results)
        has_warnings = any(v.severity == ValidationSeverity.WARNING for v in validation_results)

        deductible_amount = self.calculate_deductible(policy, claim)
        net_claim_amount = max(0.0, claim.claim_amount - deductible_amount)
        items = self.calculate_shares(net_claim_amount, policy.co_insurers)

        if has_errors:
            status = BillStatus.EXCEPTION
        elif has_warnings:
            status = BillStatus.PENDING
        else:
            status = BillStatus.NORMAL

        if claim.is_late_supplement:
            status = BillStatus.SUPPLEMENTED
            validation_results.append(
                ValidationResult(
                    field="is_late_supplement",
                    severity=ValidationSeverity.INFO,
                    message="此为补录赔案",
                    code="LATE_SUPPLEMENT",
                )
            )

        if claim.remarks_modified:
            validation_results.append(
                ValidationResult(
                    field="remarks",
                    severity=ValidationSeverity.INFO,
                    message="赔案备注已被修改",
                    code="REMARKS_MODIFIED",
                )
            )

        return Bill(
            bill_no=bill_no,
            claim_no=claim.claim_no,
            policy_no=policy.policy_no,
            claim_amount=claim.claim_amount,
            deductible_amount=deductible_amount,
            net_claim_amount=net_claim_amount,
            items=items,
            status=status,
            validation_results=validation_results,
            remarks=claim.remarks,
        )
