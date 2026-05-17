from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Optional
from collections import defaultdict
from dateutil.relativedelta import relativedelta

from loan_extension_cli.models import (
    LoanRecord,
    RepaymentPlanRecord,
    ExtensionApplicationRecord,
    ApprovalRecord,
    DeductionRecord,
    RepaymentReportRecord,
)


@dataclass
class RuleViolation:
    rule_code: str
    rule_name: str
    severity: str
    message: str
    related_records: list[dict[str, Any]]
    suggestion: str = ""


@dataclass
class RuleResult:
    rule_code: str
    rule_name: str
    is_passed: bool
    violations: list[RuleViolation]
    details: dict[str, Any]


class RuleEngine:
    def __init__(self):
        self.rules = [
            self._check_plan_recalculation,
            self._check_extension_approval,
            self._check_deduction_idempotency,
            self._check_overdue_marking,
            self._check_plan_amount_consistency,
            self._check_approval_completeness,
        ]

    def execute_all(
        self,
        loans: list[LoanRecord],
        plans: list[RepaymentPlanRecord],
        extensions: list[ExtensionApplicationRecord],
        approvals: list[ApprovalRecord],
        deductions: list[DeductionRecord],
        reports: list[RepaymentReportRecord],
        check_date: Optional[date] = None,
    ) -> list[RuleResult]:
        check_date = check_date or date.today()

        results = []
        for rule in self.rules:
            result = rule(loans, plans, extensions, approvals, deductions, reports, check_date)
            results.append(result)

        return results

    def _check_plan_recalculation(
        self,
        loans: list[LoanRecord],
        plans: list[RepaymentPlanRecord],
        extensions: list[ExtensionApplicationRecord],
        approvals: list[ApprovalRecord],
        deductions: list[DeductionRecord],
        reports: list[RepaymentReportRecord],
        check_date: date,
    ) -> RuleResult:
        violations: list[RuleViolation] = []
        details: dict[str, Any] = {"checked_loans": 0, "mismatched_plans": 0}

        loan_map = {loan.loan_no: loan for loan in loans}
        plans_by_loan = defaultdict(list)
        for plan in plans:
            plans_by_loan[plan.loan_no].append(plan)

        approved_extensions = self._get_approved_extensions(extensions, approvals)

        for loan_no, loan in loan_map.items():
            details["checked_loans"] += 1
            loan_plans = plans_by_loan.get(loan_no, [])

            if not loan_plans:
                violations.append(
                    RuleViolation(
                        rule_code="PLAN-001",
                        rule_name="还款计划缺失",
                        severity="error",
                        message=f"借款单 {loan_no} 没有还款计划记录",
                        related_records=[{"type": "loan", "loan_no": loan_no, "source": loan.source.get_location_str()}],
                        suggestion="请补充该借款单的还款计划",
                    )
                )
                continue

            sorted_plans = sorted(loan_plans, key=lambda p: p.period_no)
            expected_total = loan.loan_amount
            actual_total = sum(p.principal_amount for p in sorted_plans)

            if abs(expected_total - actual_total) > 0.01:
                details["mismatched_plans"] += 1
                violations.append(
                    RuleViolation(
                        rule_code="PLAN-002",
                        rule_name="还款计划本金不符",
                        severity="error",
                        message=f"借款单 {loan_no} 还款计划本金总额 {actual_total:.2f} 与借款金额 {expected_total:.2f} 不符",
                        related_records=[
                            {"type": "loan", "loan_no": loan_no, "source": loan.source.get_location_str()},
                            *[
                                {"type": "plan", "plan_id": p.plan_id, "period": p.period_no, "source": p.source.get_location_str()}
                                for p in sorted_plans
                            ],
                        ],
                        suggestion="请重新计算并调整还款计划各期本金",
                    )
                )

            if loan_no in approved_extensions:
                ext = approved_extensions[loan_no]
                extension_effect = False
                for plan in sorted_plans:
                    if ext["new_due_date"] and plan.due_date > ext["new_due_date"]:
                        extension_effect = True
                        if not plan.is_extended:
                            violations.append(
                                RuleViolation(
                                    rule_code="PLAN-003",
                                    rule_name="展期计划未标记",
                                    severity="warning",
                                    message=f"借款单 {loan_no} 第 {plan.period_no} 期已展期但计划未标记为展期",
                                    related_records=[
                                        {"type": "extension", "application_id": ext["application_id"], "source": ext["source"]},
                                        {"type": "plan", "plan_id": plan.plan_id, "source": plan.source.get_location_str()},
                                    ],
                                    suggestion="请更新还款计划的展期标记",
                                )
                            )

        return RuleResult(
            rule_code="PLAN-RECALC",
            rule_name="还款计划重算检查",
            is_passed=len([v for v in violations if v.severity == "error"]) == 0,
            violations=violations,
            details=details,
        )

    def _check_extension_approval(
        self,
        loans: list[LoanRecord],
        plans: list[RepaymentPlanRecord],
        extensions: list[ExtensionApplicationRecord],
        approvals: list[ApprovalRecord],
        deductions: list[DeductionRecord],
        reports: list[RepaymentReportRecord],
        check_date: date,
    ) -> RuleResult:
        violations: list[RuleViolation] = []
        details: dict[str, Any] = {"total_extensions": len(extensions), "approved": 0, "rejected": 0, "pending": 0}

        approvals_by_app = defaultdict(list)
        for approval in approvals:
            approvals_by_app[approval.application_id].append(approval)

        loan_nos = {loan.loan_no for loan in loans}

        for ext in extensions:
            app_approvals = approvals_by_app.get(ext.application_id, [])

            if not app_approvals:
                details["pending"] += 1
                violations.append(
                    RuleViolation(
                        rule_code="APPR-001",
                        rule_name="展期审批缺失",
                        severity="warning",
                        message=f"展期申请 {ext.application_id} 没有审批记录",
                        related_records=[{"type": "extension", "application_id": ext.application_id, "source": ext.source.get_location_str()}],
                        suggestion="请补充该展期申请的审批记录",
                    )
                )
                continue

            sorted_approvals = sorted(app_approvals, key=lambda a: a.approval_level)
            final_approval = sorted_approvals[-1]

            if final_approval.approval_result.lower() in ["通过", "同意", "approved", "pass"]:
                details["approved"] += 1
                if ext.loan_no not in loan_nos:
                    violations.append(
                        RuleViolation(
                            rule_code="APPR-002",
                            rule_name="展期申请对应借款单不存在",
                            severity="error",
                            message=f"展期申请 {ext.application_id} 对应的借款单 {ext.loan_no} 在借款记录中不存在",
                            related_records=[
                                {"type": "extension", "application_id": ext.application_id, "source": ext.source.get_location_str()},
                            ],
                            suggestion="请核对借款单号是否正确",
                        )
                    )
            elif final_approval.approval_result.lower() in ["拒绝", "驳回", "rejected", "reject"]:
                details["rejected"] += 1
            else:
                details["pending"] += 1

            for approval in sorted_approvals:
                if approval.approval_date < ext.application_date:
                    violations.append(
                        RuleViolation(
                            rule_code="APPR-003",
                            rule_name="审批日期早于申请日期",
                            severity="error",
                            message=f"展期申请 {ext.application_id} 的审批日期 {approval.approval_date} 早于申请日期 {ext.application_date}",
                            related_records=[
                                {"type": "extension", "application_id": ext.application_id, "source": ext.source.get_location_str()},
                                {"type": "approval", "approval_id": approval.approval_id, "source": approval.source.get_location_str()},
                            ],
                            suggestion="请核对审批日期",
                        )
                    )

        return RuleResult(
            rule_code="EXT-APPR",
            rule_name="展期审批合规性检查",
            is_passed=len([v for v in violations if v.severity == "error"]) == 0,
            violations=violations,
            details=details,
        )

    def _check_deduction_idempotency(
        self,
        loans: list[LoanRecord],
        plans: list[RepaymentPlanRecord],
        extensions: list[ExtensionApplicationRecord],
        approvals: list[ApprovalRecord],
        deductions: list[DeductionRecord],
        reports: list[RepaymentReportRecord],
        check_date: date,
    ) -> RuleResult:
        violations: list[RuleViolation] = []
        details: dict[str, Any] = {"total_deductions": len(deductions), "duplicates": 0}

        transaction_groups: dict[str, list[DeductionRecord]] = defaultdict(list)
        for ded in deductions:
            key = f"{ded.transaction_no}:{ded.loan_no}:{ded.deduction_amount:.2f}"
            if not ded.transaction_no:
                key = f"{ded.deduction_id}:{ded.loan_no}:{ded.deduction_date}:{ded.deduction_amount:.2f}"
            transaction_groups[key].append(ded)

        for key, ded_list in transaction_groups.items():
            if len(ded_list) > 1:
                details["duplicates"] += 1
                violations.append(
                    RuleViolation(
                        rule_code="DEDU-001",
                        rule_name="扣款记录重复",
                        severity="error",
                        message=f"发现 {len(ded_list)} 条重复扣款记录，交易标识: {key}",
                        related_records=[
                            {"type": "deduction", "deduction_id": d.deduction_id, "source": d.source.get_location_str()}
                            for d in ded_list
                        ],
                        suggestion="请核实并删除重复的扣款记录",
                    )
                )

        plan_map = {plan.plan_id: plan for plan in plans}
        for ded in deductions:
            if ded.related_plan_id and ded.related_plan_id in plan_map:
                plan = plan_map[ded.related_plan_id]
                if ded.deduction_date < plan.due_date - timedelta(days=30):
                    violations.append(
                        RuleViolation(
                            rule_code="DEDU-002",
                            rule_name="扣款日期异常",
                            severity="warning",
                            message=f"扣款 {ded.deduction_id} 日期 {ded.deduction_date} 远早于计划到期日 {plan.due_date}",
                            related_records=[
                                {"type": "deduction", "deduction_id": ded.deduction_id, "source": ded.source.get_location_str()},
                                {"type": "plan", "plan_id": plan.plan_id, "source": plan.source.get_location_str()},
                            ],
                            suggestion="请核对扣款日期是否正确",
                        )
                    )

        return RuleResult(
            rule_code="DEDU-IDEM",
            rule_name="扣款幂等性检查",
            is_passed=len([v for v in violations if v.severity == "error"]) == 0,
            violations=violations,
            details=details,
        )

    def _check_overdue_marking(
        self,
        loans: list[LoanRecord],
        plans: list[RepaymentPlanRecord],
        extensions: list[ExtensionApplicationRecord],
        approvals: list[ApprovalRecord],
        deductions: list[DeductionRecord],
        reports: list[RepaymentReportRecord],
        check_date: date,
    ) -> RuleResult:
        violations: list[RuleViolation] = []
        details: dict[str, Any] = {"total_plans": len(plans), "overdue_plans": 0, "missing_overdue_mark": 0}

        approved_extensions = self._get_approved_extensions(extensions, approvals)

        deductions_by_plan = defaultdict(list)
        for ded in deductions:
            if ded.related_plan_id:
                deductions_by_plan[ded.related_plan_id].append(ded)

        reports_by_loan = defaultdict(list)
        for report in reports:
            reports_by_loan[report.loan_no].append(report)

        for plan in plans:
            if plan.status.lower() in ["已还款", "paid", "completed"]:
                continue

            plan_due_date = plan.due_date
            if plan.loan_no in approved_extensions and plan.is_extended:
                ext = approved_extensions[plan.loan_no]
                if ext["new_due_date"]:
                    plan_due_date = ext["new_due_date"]

            if check_date > plan_due_date:
                details["overdue_plans"] += 1

                plan_deductions = deductions_by_plan.get(plan.plan_id, [])
                total_deducted = sum(d.deduction_amount for d in plan_deductions)

                if total_deducted < plan.total_amount - 0.01:
                    loan_reports = reports_by_loan.get(plan.loan_no, [])
                    latest_report = max(loan_reports, key=lambda r: r.report_date) if loan_reports else None

                    if latest_report and not latest_report.is_overdue:
                        details["missing_overdue_mark"] += 1
                        violations.append(
                            RuleViolation(
                                rule_code="OVERDUE-001",
                                rule_name="逾期未标记",
                                severity="warning",
                                message=f"借款单 {plan.loan_no} 第 {plan.period_no} 期已逾期但最新报告未标记逾期",
                                related_records=[
                                    {"type": "plan", "plan_id": plan.plan_id, "due_date": plan_due_date, "source": plan.source.get_location_str()},
                                    {"type": "report", "report_id": latest_report.report_id, "source": latest_report.source.get_location_str()},
                                ],
                                suggestion="请更新还款报告的逾期标记",
                            )
                        )

        return RuleResult(
            rule_code="OVERDUE-MARK",
            rule_name="逾期标记检查",
            is_passed=len(violations) == 0,
            violations=violations,
            details=details,
        )

    def _check_plan_amount_consistency(
        self,
        loans: list[LoanRecord],
        plans: list[RepaymentPlanRecord],
        extensions: list[ExtensionApplicationRecord],
        approvals: list[ApprovalRecord],
        deductions: list[DeductionRecord],
        reports: list[RepaymentReportRecord],
        check_date: date,
    ) -> RuleResult:
        violations: list[RuleViolation] = []
        details: dict[str, Any] = {"checked_plans": 0, "inconsistent": 0}

        for plan in plans:
            details["checked_plans"] += 1
            expected_total = plan.principal_amount + plan.interest_amount
            if abs(plan.total_amount - expected_total) > 0.01:
                details["inconsistent"] += 1
                violations.append(
                    RuleViolation(
                        rule_code="AMT-001",
                        rule_name="计划金额不一致",
                        severity="error",
                        message=f"还款计划 {plan.plan_id} 本息和 {expected_total:.2f} 与总金额 {plan.total_amount:.2f} 不符",
                        related_records=[{"type": "plan", "plan_id": plan.plan_id, "source": plan.source.get_location_str()}],
                        suggestion="请重新计算还款计划的总金额",
                    )
                )

        return RuleResult(
            rule_code="AMT-CONSIST",
            rule_name="计划金额一致性检查",
            is_passed=len(violations) == 0,
            violations=violations,
            details=details,
        )

    def _check_approval_completeness(
        self,
        loans: list[LoanRecord],
        plans: list[RepaymentPlanRecord],
        extensions: list[ExtensionApplicationRecord],
        approvals: list[ApprovalRecord],
        deductions: list[DeductionRecord],
        reports: list[RepaymentReportRecord],
        check_date: date,
    ) -> RuleResult:
        violations: list[RuleViolation] = []
        details: dict[str, Any] = {"checked_approvals": 0, "incomplete": 0}

        approvals_by_app = defaultdict(list)
        for approval in approvals:
            approvals_by_app[approval.application_id].append(approval)
            details["checked_approvals"] += 1

        for app_id, app_approvals in approvals_by_app.items():
            levels = sorted({a.approval_level for a in app_approvals})
            if len(levels) < 2:
                details["incomplete"] += 1
                violations.append(
                    RuleViolation(
                        rule_code="APPR-004",
                        rule_name="审批层级不足",
                        severity="warning",
                        message=f"展期申请 {app_id} 只有 {len(levels)} 级审批，建议至少2级审批",
                        related_records=[
                            {"type": "approval", "approval_id": a.approval_id, "level": a.approval_level, "source": a.source.get_location_str()}
                            for a in app_approvals
                        ],
                        suggestion="请补充后续审批流程",
                    )
                )

        return RuleResult(
            rule_code="APPR-COMPLETE",
            rule_name="审批完整性检查",
            is_passed=len(violations) == 0,
            violations=violations,
            details=details,
        )

    def _get_approved_extensions(
        self,
        extensions: list[ExtensionApplicationRecord],
        approvals: list[ApprovalRecord],
    ) -> dict[str, dict[str, Any]]:
        approved: dict[str, dict[str, Any]] = {}

        approvals_by_app = defaultdict(list)
        for approval in approvals:
            approvals_by_app[approval.application_id].append(approval)

        for ext in extensions:
            app_approvals = approvals_by_app.get(ext.application_id, [])
            if not app_approvals:
                continue

            final_approval = sorted(app_approvals, key=lambda a: a.approval_level)[-1]
            if final_approval.approval_result.lower() in ["通过", "同意", "approved", "pass"]:
                approved[ext.loan_no] = {
                    "application_id": ext.application_id,
                    "extension_months": ext.extension_months,
                    "new_due_date": ext.new_due_date,
                    "application_date": ext.application_date,
                    "approval_date": final_approval.approval_date,
                    "source": ext.source.get_location_str(),
                }

        return approved
