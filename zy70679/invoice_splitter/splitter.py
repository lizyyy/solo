from typing import List, Dict
from decimal import Decimal, ROUND_HALF_UP
from .models import InvoiceItem, Traveler, SplitResult, round_decimal


class InvoiceSplitter:
    def __init__(self):
        self.tax_adjustment_tolerance = Decimal("0.01")

    def split_invoice(
        self, invoice: InvoiceItem, travelers: List[Traveler]
    ) -> List[SplitResult]:
        total_weight = sum(t.weight for t in travelers)
        if total_weight <= 0:
            raise ValueError("总权重必须大于0")

        total_amount_excl_tax = invoice.total_amount - invoice.total_tax
        split_results = []
        cumulative_amount = Decimal("0")
        cumulative_tax = Decimal("0")
        cumulative_amount_excl_tax = Decimal("0")

        for i, traveler in enumerate(travelers):
            ratio = traveler.weight / total_weight
            is_last = i == len(travelers) - 1

            if is_last:
                split_amount_excl_tax = (
                    total_amount_excl_tax - cumulative_amount_excl_tax
                )
                split_tax = invoice.total_tax - cumulative_tax
                split_amount = invoice.total_amount - cumulative_amount
            else:
                split_amount_excl_tax = round_decimal(
                    total_amount_excl_tax * ratio
                )
                split_tax = round_decimal(invoice.total_tax * ratio)
                split_amount = split_amount_excl_tax + split_tax

                cumulative_amount_excl_tax += split_amount_excl_tax
                cumulative_tax += split_tax
                cumulative_amount += split_amount

            split_result = SplitResult(
                invoice_no=invoice.invoice_no,
                traveler_name=traveler.name,
                employee_id=traveler.employee_id,
                project_code=traveler.project_code,
                split_amount=split_amount,
                split_tax=split_tax,
                split_amount_excl_tax=split_amount_excl_tax,
                tax_rate=invoice.tax_rate,
                original_amount=invoice.total_amount,
                original_tax=invoice.total_tax,
                split_ratio=round_decimal(ratio, 4),
            )
            split_results.append(split_result)

        self._validate_split_correctness(split_results, invoice)
        return split_results

    def _validate_split_correctness(
        self, results: List[SplitResult], invoice: InvoiceItem
    ) -> None:
        total_split_amount = sum(r.split_amount for r in results)
        total_split_tax = sum(r.split_tax for r in results)

        amount_diff = abs(total_split_amount - invoice.total_amount)
        tax_diff = abs(total_split_tax - invoice.total_tax)

        if amount_diff > self.tax_adjustment_tolerance:
            for r in results:
                r.is_valid = False
                r.error_message = f"金额校验失败: 差异{amount_diff}元"

        if tax_diff > self.tax_adjustment_tolerance:
            for r in results:
                r.is_valid = False
                prefix = r.error_message + "; " if r.error_message else ""
                r.error_message = prefix + f"税额校验失败: 差异{tax_diff}元"

    def calculate_tax_from_amount(
        self, amount_incl_tax: Decimal, tax_rate: Decimal
    ) -> Decimal:
        amount_excl_tax = amount_incl_tax / (1 + tax_rate)
        tax = amount_incl_tax - amount_excl_tax
        return round_decimal(tax)

    def validate_tax_correctness(
        self, amount: Decimal, tax: Decimal, tax_rate: Decimal
    ) -> Dict:
        expected_tax = self.calculate_tax_from_amount(amount, tax_rate)
        diff = abs(tax - expected_tax)

        return {
            "is_valid": diff <= self.tax_adjustment_tolerance,
            "expected_tax": expected_tax,
            "diff": diff,
        }
