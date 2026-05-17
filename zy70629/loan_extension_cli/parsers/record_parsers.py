from typing import Any
import hashlib

from loan_extension_cli.parsers.base_parser import BaseParser
from loan_extension_cli.models import (
    SourceLocation,
    LoanRecord,
    RepaymentPlanRecord,
    ExtensionApplicationRecord,
    ApprovalRecord,
    DeductionRecord,
    RepaymentReportRecord,
)


class LoanParser(BaseParser[LoanRecord]):
    def __init__(self):
        super().__init__(
            LoanRecord,
            ["loan_no", "employee_id", "employee_name", "loan_amount", "loan_date", "loan_term_months"],
        )

    def _build_record(self, row: dict[str, Any], source: SourceLocation) -> LoanRecord:
        loan_no = self._get_value(row, "loan_no")
        employee_id = self._get_value(row, "employee_id")
        record_id = hashlib.md5(f"loan:{loan_no}:{employee_id}".encode()).hexdigest()[:12]

        record = LoanRecord(
            source=source,
            record_id=record_id,
            loan_no=loan_no,
            employee_id=self._get_value(row, "employee_id"),
            employee_name=self._get_value(row, "employee_name"),
            loan_amount=self._parse_float(self._get_value(row, "loan_amount")),
            loan_date=self._parse_date(self._get_value(row, "loan_date")),
            loan_term_months=self._parse_int(self._get_value(row, "loan_term_months")),
        )

        interest_rate = self._get_value(row, "interest_rate")
        if interest_rate:
            record.interest_rate = self._parse_float(interest_rate)

        status = self._get_value(row, "status")
        if status:
            record.status = status

        return record


class RepaymentPlanParser(BaseParser[RepaymentPlanRecord]):
    def __init__(self):
        super().__init__(
            RepaymentPlanRecord,
            ["plan_id", "loan_no", "period_no", "due_date", "principal_amount", "interest_amount", "total_amount"],
        )

    def _build_record(self, row: dict[str, Any], source: SourceLocation) -> RepaymentPlanRecord:
        plan_id = self._get_value(row, "plan_id")
        loan_no = self._get_value(row, "loan_no")
        period_no = self._get_value(row, "period_no")
        record_id = hashlib.md5(f"plan:{loan_no}:{plan_id}:{period_no}".encode()).hexdigest()[:12]

        record = RepaymentPlanRecord(
            source=source,
            record_id=record_id,
            plan_id=plan_id,
            loan_no=loan_no,
            period_no=self._parse_int(self._get_value(row, "period_no")),
            due_date=self._parse_date(self._get_value(row, "due_date")),
            principal_amount=self._parse_float(self._get_value(row, "principal_amount")),
            interest_amount=self._parse_float(self._get_value(row, "interest_amount")),
            total_amount=self._parse_float(self._get_value(row, "total_amount")),
        )

        status = self._get_value(row, "status")
        if status:
            record.status = status

        is_extended = self._get_value(row, "is_extended")
        if is_extended:
            record.is_extended = is_extended.lower() in ["true", "是", "1", "yes"]

        return record


class ExtensionApplicationParser(BaseParser[ExtensionApplicationRecord]):
    def __init__(self):
        super().__init__(
            ExtensionApplicationRecord,
            ["application_id", "loan_no", "application_date", "extension_months"],
        )

    def _build_record(self, row: dict[str, Any], source: SourceLocation) -> ExtensionApplicationRecord:
        application_id = self._get_value(row, "application_id")
        loan_no = self._get_value(row, "loan_no")
        record_id = hashlib.md5(f"ext:{loan_no}:{application_id}".encode()).hexdigest()[:12]

        record = ExtensionApplicationRecord(
            source=source,
            record_id=record_id,
            application_id=application_id,
            loan_no=loan_no,
            application_date=self._parse_date(self._get_value(row, "application_date")),
            extension_months=self._parse_int(self._get_value(row, "extension_months")),
        )

        new_due_date = self._get_value(row, "new_due_date")
        if new_due_date:
            record.new_due_date = self._parse_date(new_due_date)

        reason = self._get_value(row, "reason")
        if reason:
            record.reason = reason

        applicant = self._get_value(row, "applicant")
        if applicant:
            record.applicant = applicant

        return record


class ApprovalParser(BaseParser[ApprovalRecord]):
    def __init__(self):
        super().__init__(
            ApprovalRecord,
            ["approval_id", "application_id", "loan_no", "approver", "approval_date", "approval_result"],
        )

    def _build_record(self, row: dict[str, Any], source: SourceLocation) -> ApprovalRecord:
        approval_id = self._get_value(row, "approval_id")
        application_id = self._get_value(row, "application_id")
        loan_no = self._get_value(row, "loan_no")
        record_id = hashlib.md5(f"appr:{loan_no}:{application_id}:{approval_id}".encode()).hexdigest()[:12]

        record = ApprovalRecord(
            source=source,
            record_id=record_id,
            approval_id=approval_id,
            application_id=application_id,
            loan_no=loan_no,
            approver=self._get_value(row, "approver"),
            approval_date=self._parse_date(self._get_value(row, "approval_date")),
            approval_result=self._get_value(row, "approval_result"),
        )

        approval_comment = self._get_value(row, "approval_comment")
        if approval_comment:
            record.approval_comment = approval_comment

        approval_level = self._get_value(row, "approval_level")
        if approval_level:
            record.approval_level = self._parse_int(approval_level)

        return record


class DeductionParser(BaseParser[DeductionRecord]):
    def __init__(self):
        super().__init__(
            DeductionRecord,
            ["deduction_id", "loan_no", "deduction_date", "deduction_amount", "deduction_type"],
        )

    def _build_record(self, row: dict[str, Any], source: SourceLocation) -> DeductionRecord:
        deduction_id = self._get_value(row, "deduction_id")
        loan_no = self._get_value(row, "loan_no")
        transaction_no = self._get_value(row, "transaction_no")
        record_id = hashlib.md5(f"ded:{loan_no}:{deduction_id}:{transaction_no}".encode()).hexdigest()[:12]

        record = DeductionRecord(
            source=source,
            record_id=record_id,
            deduction_id=deduction_id,
            loan_no=loan_no,
            deduction_date=self._parse_date(self._get_value(row, "deduction_date")),
            deduction_amount=self._parse_float(self._get_value(row, "deduction_amount")),
            deduction_type=self._get_value(row, "deduction_type"),
        )

        related_plan_id = self._get_value(row, "related_plan_id")
        if related_plan_id:
            record.related_plan_id = related_plan_id

        transaction_no = self._get_value(row, "transaction_no")
        if transaction_no:
            record.transaction_no = transaction_no

        return record


class RepaymentReportParser(BaseParser[RepaymentReportRecord]):
    def __init__(self):
        super().__init__(
            RepaymentReportRecord,
            [
                "report_id",
                "loan_no",
                "report_date",
                "total_principal_due",
                "total_interest_due",
                "total_paid",
                "remaining_principal",
                "remaining_interest",
            ],
        )

    def _build_record(self, row: dict[str, Any], source: SourceLocation) -> RepaymentReportRecord:
        report_id = self._get_value(row, "report_id")
        loan_no = self._get_value(row, "loan_no")
        record_id = hashlib.md5(f"rpt:{loan_no}:{report_id}".encode()).hexdigest()[:12]

        record = RepaymentReportRecord(
            source=source,
            record_id=record_id,
            report_id=report_id,
            loan_no=loan_no,
            report_date=self._parse_date(self._get_value(row, "report_date")),
            total_principal_due=self._parse_float(self._get_value(row, "total_principal_due")),
            total_interest_due=self._parse_float(self._get_value(row, "total_interest_due")),
            total_paid=self._parse_float(self._get_value(row, "total_paid")),
            remaining_principal=self._parse_float(self._get_value(row, "remaining_principal")),
            remaining_interest=self._parse_float(self._get_value(row, "remaining_interest")),
        )

        is_overdue = self._get_value(row, "is_overdue")
        if is_overdue:
            record.is_overdue = is_overdue.lower() in ["true", "是", "1", "yes"]

        return record
