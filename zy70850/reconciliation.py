from datetime import datetime
from typing import List, Dict, Optional
from models import (
    ClaimApplication, Policy, ReconciliationResult, ReconciliationSummary,
    ClaimStatus, IssueType, ReviewRequest, ReviewAction, IssueDetail
)
from rules_engine import RulesEngine
from data_import import DataImporter


class ReconciliationService:
    def __init__(self):
        self.rules_engine = RulesEngine()
        self.data_importer = DataImporter()
        self.results: Dict[str, ReconciliationResult] = {}
        self.original_issues: Dict[str, List[IssueDetail]] = {}

    def process_claim(self, claim: ClaimApplication, policy: Policy) -> ReconciliationResult:
        issues = self.rules_engine.validate_claim(claim, policy)
        self.original_issues[claim.claim_id] = [i.model_copy() for i in issues]
        
        system_calculated_amount = self.rules_engine.calculate_approved_amount(claim, policy, issues)
        
        status = self._determine_status(issues)
        
        result = ReconciliationResult(
            claim_id=claim.claim_id,
            claim_number=claim.claim_number,
            policy_number=policy.policy_number,
            applicant_name=claim.applicant_name,
            status=status,
            issues=issues,
            total_claimed_amount=claim.total_claimed_amount,
            system_calculated_amount=system_calculated_amount,
            final_approved_amount=system_calculated_amount if status == ClaimStatus.APPROVED else None
        )
        
        self.results[claim.claim_id] = result
        return result

    def _determine_status(self, issues: List[IssueDetail]) -> ClaimStatus:
        if not issues:
            return ClaimStatus.APPROVED
        
        error_issues = [i for i in issues if i.severity == "error"]
        if error_issues:
            has_duplicate = any(i.issue_type == IssueType.DUPLICATE_CLAIM for i in error_issues)
            has_policy_expired = any(i.issue_type == IssueType.POLICY_EXPIRED for i in error_issues)
            has_not_covered = any(i.issue_type == IssueType.NOT_COVERED for i in error_issues)
            
            if has_duplicate or has_policy_expired or has_not_covered:
                return ClaimStatus.REJECTED
        
        missing_material = any(i.issue_type in [IssueType.MISSING_MATERIAL, IssueType.MISSING_INVOICE] 
                                for i in issues)
        if missing_material:
            return ClaimStatus.SUPPLEMENT
        
        return ClaimStatus.PENDING

    def process_review(self, review_request: ReviewRequest) -> ReconciliationResult:
        result = self.results.get(review_request.claim_id)
        if not result:
            raise ValueError(f"未找到理赔记录: {review_request.claim_id}")
        
        claim = self.data_importer.get_claim(review_request.claim_id)
        policy = self.data_importer.get_policy(claim.policy_id) if claim else None
        
        if review_request.action == ReviewAction.APPROVE:
            result.status = ClaimStatus.APPROVED
            result.final_approved_amount = review_request.adjusted_amount or result.system_calculated_amount
        
        elif review_request.action == ReviewAction.REJECT:
            result.status = ClaimStatus.REJECTED
            result.final_approved_amount = 0.0
        
        elif review_request.action == ReviewAction.REQUEST_SUPPLEMENT:
            result.status = ClaimStatus.SUPPLEMENT
            result.final_approved_amount = None
        
        elif review_request.action == ReviewAction.ADJUST_AMOUNT:
            if review_request.adjusted_amount is not None:
                result.final_approved_amount = review_request.adjusted_amount
                result.status = ClaimStatus.APPROVED
        
        remaining_issues = []
        for issue in result.issues:
            issue_key = f"{issue.issue_type.value}|{issue.message}"
            if issue_key not in review_request.resolved_issues:
                remaining_issues.append(issue)
        
        result.issues = remaining_issues
        result.reviewer_notes = review_request.notes
        result.reviewed_by = review_request.reviewer
        result.reviewed_at = datetime.now()
        
        if claim and result.status == ClaimStatus.APPROVED:
            self.rules_engine.register_processed_claim(claim)
            if policy and result.final_approved_amount:
                policy.remaining_limit -= result.final_approved_amount
        
        self.results[review_request.claim_id] = result
        return result

    def recalculate_result(self, claim_id: str) -> ReconciliationResult:
        result = self.results.get(claim_id)
        if not result:
            raise ValueError(f"未找到理赔记录: {claim_id}")
        
        claim = self.data_importer.get_claim(claim_id)
        policy = self.data_importer.get_policy(claim.policy_id) if claim else None
        
        if not claim or not policy:
            return result
        
        original = self.original_issues.get(claim_id, [])
        new_issues = self.rules_engine.validate_claim(claim, policy)
        
        result.issues = new_issues
        result.system_calculated_amount = self.rules_engine.calculate_approved_amount(claim, policy, new_issues)
        
        if result.status != ClaimStatus.APPROVED:
            result.status = self._determine_status(new_issues)
            if result.status == ClaimStatus.APPROVED:
                result.final_approved_amount = result.system_calculated_amount
        
        return result

    def get_result(self, claim_id: str) -> Optional[ReconciliationResult]:
        return self.results.get(claim_id)

    def get_all_results(self) -> List[ReconciliationResult]:
        return list(self.results.values())

    def get_summary(self) -> ReconciliationSummary:
        summary = ReconciliationSummary()
        
        for result in self.results.values():
            summary.total_claims += 1
            summary.total_claimed_amount += result.total_claimed_amount
            if result.final_approved_amount:
                summary.total_approved_amount += result.final_approved_amount
            
            if result.status == ClaimStatus.PENDING:
                summary.pending_count += 1
            elif result.status == ClaimStatus.APPROVED:
                summary.approved_count += 1
            elif result.status == ClaimStatus.REJECTED:
                summary.rejected_count += 1
            elif result.status == ClaimStatus.SUPPLEMENT:
                summary.supplement_count += 1
            
            for issue in result.issues:
                issue_type = issue.issue_type.value
                summary.issue_distribution[issue_type] = summary.issue_distribution.get(issue_type, 0) + 1
                summary.issue_details.append({
                    "claim_id": result.claim_id,
                    "claim_number": result.claim_number,
                    "issue_type": issue_type,
                    "message": issue.message,
                    "severity": issue.severity
                })
        
        return summary

    def get_issue_explanation(self, claim_id: str, issue_type: IssueType) -> Optional[Dict]:
        result = self.results.get(claim_id)
        if not result:
            return None
        
        matching_issues = [i for i in result.issues if i.issue_type == issue_type]
        if not matching_issues:
            return None
        
        issue = matching_issues[0]
        return {
            "type": issue.issue_type.value,
            "severity": issue.severity,
            "message": issue.message,
            "evidence": issue.evidence,
            "suggestion": issue.suggestion,
            "impact": self._calculate_impact(issue, result)
        }

    def _calculate_impact(self, issue: IssueDetail, result: ReconciliationResult) -> Dict:
        if issue.issue_type == IssueType.AMOUNT_EXCEEDED:
            exceeded = issue.evidence.get('exceeded_amount', 0) if issue.evidence else 0
            return {
                "financial_impact": exceeded,
                "description": f"超出限额部分 {exceeded:.2f} 元不予赔付"
            }
        elif issue.issue_type == IssueType.MISSING_INVOICE:
            missing = issue.evidence.get('total_missing_amount', 0) if issue.evidence else 0
            return {
                "financial_impact": missing,
                "description": f"缺少发票涉及金额 {missing:.2f} 元需剔除"
            }
        elif issue.issue_type == IssueType.DUPLICATE_CLAIM:
            return {
                "financial_impact": result.total_claimed_amount,
                "description": "重复报案可能导致全额拒赔"
            }
        elif issue.issue_type == IssueType.POLICY_EXPIRED:
            return {
                "financial_impact": result.total_claimed_amount,
                "description": "保单过期，该事故不在保障范围内"
            }
        else:
            return {
                "financial_impact": 0,
                "description": "需人工复核后确定影响"
            }

    def clear_all(self):
        self.results.clear()
        self.original_issues.clear()
        self.rules_engine.clear_history()
        self.data_importer.clear_all()

    def generate_justification_text(self, claim_id: str) -> str:
        result = self.results.get(claim_id)
        if not result:
            return "未找到该理赔记录"
        
        lines = []
        lines.append(f"理赔对账说明")
        lines.append(f"报案号: {result.claim_number}")
        lines.append(f"被保险人: {result.applicant_name}")
        lines.append(f"当前状态: {result.status.value}")
        lines.append("=" * 50)
        
        if result.issues:
            lines.append("\n发现的问题:")
            for idx, issue in enumerate(result.issues, 1):
                lines.append(f"\n{idx}. {issue.issue_type.value}")
                lines.append(f"   {issue.message}")
                if issue.suggestion:
                    lines.append(f"   建议: {issue.suggestion}")
        else:
            lines.append("\n未发现问题，系统自动通过")
        
        lines.append(f"\n申报金额: {result.total_claimed_amount:.2f} 元")
        lines.append(f"系统计算赔付金额: {result.system_calculated_amount:.2f} 元")
        if result.final_approved_amount is not None:
            lines.append(f"最终赔付金额: {result.final_approved_amount:.2f} 元")
        
        if result.reviewed_by:
            lines.append(f"\n复核人: {result.reviewed_by}")
            lines.append(f"复核时间: {result.reviewed_at.strftime('%Y-%m-%d %H:%M:%S')}")
            if result.reviewer_notes:
                lines.append(f"复核备注: {result.reviewer_notes}")
        
        return "\n".join(lines)
