from datetime import datetime, date
from typing import Optional, Any
from pydantic import BaseModel, Field
from pathlib import Path


class SourceLocation(BaseModel):
    file_path: str
    file_name: str
    sheet_name: Optional[str] = None
    row_number: int
    column_mapping: dict[str, str] = Field(default_factory=dict)
    raw_content: str

    def get_location_str(self) -> str:
        if self.sheet_name:
            return f"{self.file_name}!{self.sheet_name}:{self.row_number}"
        return f"{self.file_name}:{self.row_number}"


class BaseRecord(BaseModel):
    source: SourceLocation
    record_id: str
    is_valid: bool = True
    validation_errors: list[str] = Field(default_factory=list)

    def add_error(self, error: str) -> None:
        self.is_valid = False
        self.validation_errors.append(error)


class LoanRecord(BaseRecord):
    loan_no: str
    employee_id: str
    employee_name: str
    loan_amount: float
    loan_date: date
    loan_term_months: int
    interest_rate: Optional[float] = None
    status: str = "active"


class RepaymentPlanRecord(BaseRecord):
    plan_id: str
    loan_no: str
    period_no: int
    due_date: date
    principal_amount: float
    interest_amount: float
    total_amount: float
    status: str = "pending"
    is_extended: bool = False


class ExtensionApplicationRecord(BaseRecord):
    application_id: str
    loan_no: str
    application_date: date
    extension_months: int
    new_due_date: Optional[date] = None
    reason: str = ""
    applicant: str = ""


class ApprovalRecord(BaseRecord):
    approval_id: str
    application_id: str
    loan_no: str
    approver: str
    approval_date: date
    approval_result: str
    approval_comment: str = ""
    approval_level: int = 1


class DeductionRecord(BaseRecord):
    deduction_id: str
    loan_no: str
    deduction_date: date
    deduction_amount: float
    deduction_type: str
    related_plan_id: Optional[str] = None
    transaction_no: str = ""


class RepaymentReportRecord(BaseRecord):
    report_id: str
    loan_no: str
    report_date: date
    total_principal_due: float
    total_interest_due: float
    total_paid: float
    remaining_principal: float
    remaining_interest: float
    is_overdue: bool = False
