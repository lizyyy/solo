from datetime import datetime
from typing import List, Dict, Set, Tuple
from models import (
    ClaimApplication, Policy, Material, MaterialType,
    IssueDetail, IssueType, ClaimItem
)


class RulesEngine:
    def __init__(self):
        self.processed_claim_numbers: Set[str] = set()
        self.processed_invoice_numbers: Set[str] = set()

    def validate_claim(self, claim: ClaimApplication, policy: Policy) -> List[IssueDetail]:
        issues = []
        
        issues.extend(self._check_policy_validity(claim, policy))
        issues.extend(self._check_missing_invoices(claim))
        issues.extend(self._check_missing_materials(claim))
        issues.extend(self._check_amount_exceeded(claim, policy))
        issues.extend(self._check_duplicate_claim(claim))
        issues.extend(self._check_claim_amount_calculation(claim))
        
        return issues

    def _check_policy_validity(self, claim: ClaimApplication, policy: Policy) -> List[IssueDetail]:
        issues = []
        
        if claim.claim_date > policy.expiry_date:
            issues.append(IssueDetail(
                issue_type=IssueType.POLICY_EXPIRED,
                severity="error",
                message=f"保单已过期，保单有效期至 {policy.expiry_date.strftime('%Y-%m-%d')}",
                evidence={
                    "policy_expiry_date": policy.expiry_date.isoformat(),
                    "claim_date": claim.claim_date.isoformat(),
                    "days_overdue": (claim.claim_date - policy.expiry_date).days
                },
                suggestion="该事故不在保单有效期内，建议退回"
            ))
        
        if claim.claim_date < policy.effective_date:
            issues.append(IssueDetail(
                issue_type=IssueType.NOT_COVERED,
                severity="error",
                message=f"事故发生在保单生效前，保单生效日期为 {policy.effective_date.strftime('%Y-%m-%d')}",
                evidence={
                    "policy_effective_date": policy.effective_date.isoformat(),
                    "claim_date": claim.claim_date.isoformat(),
                    "days_before_effective": (policy.effective_date - claim.claim_date).days
                },
                suggestion="该事故不在保单有效期内，建议退回"
            ))
        
        return issues

    def _check_missing_invoices(self, claim: ClaimApplication) -> List[IssueDetail]:
        issues = []
        
        invoice_materials = [m for m in claim.materials if m.material_type == MaterialType.INVOICE]
        invoice_numbers_in_materials = set()
        
        for mat in invoice_materials:
            if mat.name:
                invoice_numbers_in_materials.add(mat.name)
        
        missing_invoice_items = []
        for item in claim.claim_items:
            if item.invoice_number:
                if item.invoice_number not in invoice_numbers_in_materials:
                    missing_invoice_items.append(item)
            else:
                missing_invoice_items.append(item)
        
        if missing_invoice_items:
            missing_details = []
            total_missing_amount = 0.0
            for item in missing_invoice_items:
                missing_details.append({
                    "item_id": item.item_id,
                    "expense_type": item.expense_type,
                    "invoice_number": item.invoice_number or "未提供",
                    "claimed_amount": item.claimed_amount
                })
                total_missing_amount += item.claimed_amount
            
            issues.append(IssueDetail(
                issue_type=IssueType.MISSING_INVOICE,
                severity="warning",
                message=f"缺少 {len(missing_invoice_items)} 项费用对应的发票，涉及金额 {total_missing_amount:.2f} 元",
                evidence={
                    "missing_items_count": len(missing_invoice_items),
                    "total_missing_amount": total_missing_amount,
                    "missing_items": missing_details,
                    "found_invoice_count": len(invoice_materials)
                },
                suggestion=f"请客户补充上述 {len(missing_invoice_items)} 项费用的发票原件或扫描件"
            ))
        
        return issues

    def _check_missing_materials(self, claim: ClaimApplication) -> List[IssueDetail]:
        issues = []
        
        required_materials = {
            MaterialType.ID_CARD: "身份证",
            MaterialType.BANK_CARD: "银行卡",
            MaterialType.DIAGNOSIS: "诊断证明",
        }
        
        missing_types = []
        for mat_type, mat_name in required_materials.items():
            found = any(m.material_type == mat_type and m.is_valid for m in claim.materials)
            if not found:
                missing_types.append(mat_name)
        
        if missing_types:
            issues.append(IssueDetail(
                issue_type=IssueType.MISSING_MATERIAL,
                severity="warning",
                message=f"缺少必要材料：{', '.join(missing_types)}",
                evidence={
                    "missing_materials": missing_types,
                    "uploaded_materials_count": len(claim.materials)
                },
                suggestion=f"请客户补充：{', '.join(missing_types)}"
            ))
        
        return issues

    def _check_amount_exceeded(self, claim: ClaimApplication, policy: Policy) -> List[IssueDetail]:
        issues = []
        
        if claim.total_claimed_amount > policy.remaining_limit:
            exceeded_amount = claim.total_claimed_amount - policy.remaining_limit
            issues.append(IssueDetail(
                issue_type=IssueType.AMOUNT_EXCEEDED,
                severity="warning",
                message=f"申报金额超过保单剩余限额，超出 {exceeded_amount:.2f} 元",
                evidence={
                    "claimed_amount": claim.total_claimed_amount,
                    "remaining_limit": policy.remaining_limit,
                    "exceeded_amount": exceeded_amount,
                    "policy_total_limit": policy.total_limit
                },
                suggestion=f"超出限额部分不予赔付，建议赔付金额调整为 {policy.remaining_limit:.2f} 元"
            ))
        
        for coverage in policy.coverages:
            coverage_claims = [
                item for item in claim.claim_items 
                if item.expense_type == coverage.coverage_type
            ]
            coverage_total = sum(item.claimed_amount for item in coverage_claims)
            
            available = coverage.limit_amount - coverage.used_amount
            if coverage_total > available and available > 0:
                exceeded = coverage_total - available
                issues.append(IssueDetail(
                    issue_type=IssueType.AMOUNT_EXCEEDED,
                    severity="warning",
                    message=f"{coverage.coverage_type} 赔付金额超出该险种剩余限额，超出 {exceeded:.2f} 元",
                    evidence={
                        "coverage_type": coverage.coverage_type,
                        "coverage_claimed": coverage_total,
                        "coverage_remaining": available,
                        "exceeded_amount": exceeded
                    },
                    suggestion=f"{coverage.coverage_type} 最多可赔付 {available:.2f} 元"
                ))
        
        return issues

    def _check_duplicate_claim(self, claim: ClaimApplication) -> List[IssueDetail]:
        issues = []
        
        if claim.claim_number in self.processed_claim_numbers:
            issues.append(IssueDetail(
                issue_type=IssueType.DUPLICATE_CLAIM,
                severity="error",
                message=f"报案号 {claim.claim_number} 已存在，疑似重复报案",
                evidence={
                    "claim_number": claim.claim_number,
                    "applicant_name": claim.applicant_name
                },
                suggestion="请核实是否为重复报案，如属实则退回"
            ))
        
        duplicate_invoices = []
        for item in claim.claim_items:
            if item.invoice_number and item.invoice_number in self.processed_invoice_numbers:
                duplicate_invoices.append(item.invoice_number)
        
        if duplicate_invoices:
            issues.append(IssueDetail(
                issue_type=IssueType.DUPLICATE_CLAIM,
                severity="error",
                message=f"发现 {len(duplicate_invoices)} 张已报销过的发票：{', '.join(duplicate_invoices)}",
                evidence={
                    "duplicate_invoice_count": len(duplicate_invoices),
                    "duplicate_invoices": duplicate_invoices
                },
                suggestion="重复报销的发票金额需剔除，如情节严重建议退回并记入风险名单"
            ))
        
        return issues

    def _check_claim_amount_calculation(self, claim: ClaimApplication) -> List[IssueDetail]:
        issues = []
        
        calculated_total = sum(item.claimed_amount for item in claim.claim_items)
        
        if abs(calculated_total - claim.total_claimed_amount) > 0.01:
            diff = calculated_total - claim.total_claimed_amount
            issues.append(IssueDetail(
                issue_type=IssueType.CALCULATION_ERROR,
                severity="warning",
                message=f"申报金额汇总有误，明细合计 {calculated_total:.2f} 元，与申报总额相差 {diff:.2f} 元",
                evidence={
                    "claimed_total": claim.total_claimed_amount,
                    "calculated_total": calculated_total,
                    "difference": diff
                },
                suggestion="建议以明细合计金额为准"
            ))
        
        return issues

    def register_processed_claim(self, claim: ClaimApplication):
        self.processed_claim_numbers.add(claim.claim_number)
        for item in claim.claim_items:
            if item.invoice_number:
                self.processed_invoice_numbers.add(item.invoice_number)

    def calculate_approved_amount(self, claim: ClaimApplication, policy: Policy, 
                                   issues: List[IssueDetail]) -> float:
        base_amount = sum(item.claimed_amount for item in claim.claim_items)
        
        amount_exceeded_issues = [i for i in issues if i.issue_type == IssueType.AMOUNT_EXCEEDED]
        if amount_exceeded_issues:
            base_amount = min(base_amount, policy.remaining_limit)
        
        missing_invoice_issues = [i for i in issues if i.issue_type == IssueType.MISSING_INVOICE]
        for issue in missing_invoice_issues:
            if issue.evidence and 'total_missing_amount' in issue.evidence:
                base_amount -= issue.evidence['total_missing_amount']
        
        return max(0.0, base_amount)

    def clear_history(self):
        self.processed_claim_numbers.clear()
        self.processed_invoice_numbers.clear()
