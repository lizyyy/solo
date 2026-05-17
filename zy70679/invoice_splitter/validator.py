from typing import List, Set, Dict, Tuple
from datetime import datetime
from decimal import Decimal
from .models import InvoiceItem, SplitResult


class InvoiceValidator:
    def __init__(self):
        self.seen_invoices: Set[str] = set()
        self.duplicate_invoices: List[str] = []
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def reset(self):
        self.seen_invoices.clear()
        self.duplicate_invoices.clear()
        self.warnings.clear()
        self.errors.clear()

    def check_duplicate(self, invoice_no: str) -> Tuple[bool, str]:
        if not invoice_no or not invoice_no.strip():
            self.errors.append("发票号为空")
            return False, "发票号不能为空"

        invoice_no = invoice_no.strip()
        if invoice_no in self.seen_invoices:
            self.duplicate_invoices.append(invoice_no)
            msg = f"重复发票: {invoice_no}"
            self.errors.append(msg)
            return False, msg

        self.seen_invoices.add(invoice_no)
        return True, ""

    def validate_invoice(self, invoice: InvoiceItem) -> Tuple[bool, List[str]]:
        validation_errors = []

        if not invoice.invoice_no or not invoice.invoice_no.strip():
            validation_errors.append("发票号不能为空")

        if not invoice.invoice_date:
            validation_errors.append("发票日期不能为空")
        else:
            try:
                datetime.strptime(invoice.invoice_date, "%Y-%m-%d")
            except ValueError:
                validation_errors.append(
                    f"发票日期格式错误: {invoice.invoice_date}，应为YYYY-MM-DD"
                )

        if invoice.total_amount <= 0:
            validation_errors.append(f"发票金额必须大于0: {invoice.total_amount}")

        if invoice.total_tax < 0:
            validation_errors.append(f"发票税额不能为负: {invoice.total_tax}")

        if invoice.tax_rate < 0 or invoice.tax_rate > 1:
            validation_errors.append(
                f"税率应在0-1之间: {invoice.tax_rate}"
            )

        if validation_errors:
            for err in validation_errors:
                self.errors.append(err)

        return len(validation_errors) == 0, validation_errors

    def validate_travelers(
        self, travelers: List
    ) -> Tuple[bool, List[str]]:
        validation_errors = []
        seen_employee_ids = set()

        if not travelers:
            validation_errors.append("出差人列表不能为空")
            return False, validation_errors

        for traveler in travelers:
            if not traveler.name or not traveler.name.strip():
                validation_errors.append("出差人姓名不能为空")

            if not traveler.employee_id or not traveler.employee_id.strip():
                validation_errors.append("员工ID不能为空")
            else:
                if traveler.employee_id in seen_employee_ids:
                    validation_errors.append(
                        f"重复员工ID: {traveler.employee_id}"
                    )
                seen_employee_ids.add(traveler.employee_id)

            if not traveler.project_code or not traveler.project_code.strip():
                validation_errors.append("项目号不能为空")

            if traveler.weight <= 0:
                validation_errors.append(
                    f"员工{traveler.name}的权重必须大于0: {traveler.weight}"
                )

        if validation_errors:
            for err in validation_errors:
                self.errors.append(err)

        return len(validation_errors) == 0, validation_errors

    def get_validation_summary(self) -> Dict:
        return {
            "total_invoices_checked": len(self.seen_invoices),
            "duplicate_invoices_count": len(self.duplicate_invoices),
            "duplicate_invoices": self.duplicate_invoices,
            "warnings_count": len(self.warnings),
            "warnings": self.warnings,
            "errors_count": len(self.errors),
            "errors": self.errors,
        }
