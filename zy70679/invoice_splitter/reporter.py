import json
import csv
from datetime import datetime
from typing import List
from decimal import Decimal
from io import StringIO
from .models import SplitReport, SplitResult, round_decimal


class ReportGenerator:
    def __init__(self):
        self.report_id = self._generate_report_id()

    def _generate_report_id(self) -> str:
        return f"RPT{datetime.now().strftime('%Y%m%d%H%M%S')}"

    def generate_report(
        self,
        split_results: List[SplitResult],
        warnings: List[str],
        errors: List[str],
    ) -> SplitReport:
        valid_results = [r for r in split_results if r.is_valid]
        invalid_results = [r for r in split_results if not r.is_valid]

        invoice_nos = set(r.invoice_no for r in split_results)
        valid_invoice_nos = set(r.invoice_no for r in valid_results)

        total_original_amount = sum(
            r.original_amount
            for r in split_results
            if split_results.index(r) == 0
            or r.invoice_no != split_results[split_results.index(r) - 1].invoice_no
        )
        
        unique_invoices = {}
        for r in split_results:
            if r.invoice_no not in unique_invoices:
                unique_invoices[r.invoice_no] = (
                    r.original_amount,
                    r.original_tax,
                )

        total_original_amount = sum(v[0] for v in unique_invoices.values())
        total_original_tax = sum(v[1] for v in unique_invoices.values())
        total_split_amount = sum(r.split_amount for r in split_results)
        total_split_tax = sum(r.split_tax for r in split_results)

        tax_diff_amount = total_split_tax - total_original_tax

        report = SplitReport(
            report_id=self.report_id,
            report_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            total_invoices=len(unique_invoices),
            total_invoices_valid=len(
                set(
                    r.invoice_no
                    for r in split_results
                    if all(
                        sr.is_valid
                        for sr in split_results
                        if sr.invoice_no == r.invoice_no
                    )
                )
            ),
            total_invoices_invalid=len(unique_invoices)
            - len(
                set(
                    r.invoice_no
                    for r in split_results
                    if all(
                        sr.is_valid
                        for sr in split_results
                        if sr.invoice_no == r.invoice_no
                    )
                )
            ),
            total_original_amount=round_decimal(total_original_amount),
            total_original_tax=round_decimal(total_original_tax),
            total_split_amount=round_decimal(total_split_amount),
            total_split_tax=round_decimal(total_split_tax),
            tax_diff_amount=round_decimal(tax_diff_amount),
            split_results=split_results,
            warnings=warnings,
            errors=errors,
        )

        return report

    def _decimal_default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        raise TypeError(
            f"Object of type {obj.__class__.__name__} is not JSON serializable"
        )

    def export_json(self, report: SplitReport) -> str:
        report_dict = {
            "report_id": report.report_id,
            "report_date": report.report_date,
            "summary": {
                "total_invoices": report.total_invoices,
                "total_invoices_valid": report.total_invoices_valid,
                "total_invoices_invalid": report.total_invoices_invalid,
                "total_original_amount": float(report.total_original_amount),
                "total_original_tax": float(report.total_original_tax),
                "total_split_amount": float(report.total_split_amount),
                "total_split_tax": float(report.total_split_tax),
                "tax_diff_amount": float(report.tax_diff_amount),
            },
            "split_results": [
                {
                    "invoice_no": r.invoice_no,
                    "traveler_name": r.traveler_name,
                    "employee_id": r.employee_id,
                    "project_code": r.project_code,
                    "split_amount": float(r.split_amount),
                    "split_tax": float(r.split_tax),
                    "split_amount_excl_tax": float(r.split_amount_excl_tax),
                    "tax_rate": float(r.tax_rate),
                    "original_amount": float(r.original_amount),
                    "original_tax": float(r.original_tax),
                    "split_ratio": float(r.split_ratio),
                    "is_valid": r.is_valid,
                    "error_message": r.error_message,
                }
                for r in report.split_results
            ],
            "warnings": report.warnings,
            "errors": report.errors,
        }
        return json.dumps(report_dict, ensure_ascii=False, indent=2)

    def export_csv(self, report: SplitReport) -> str:
        output = StringIO()
        writer = csv.writer(output)

        writer.writerow(
            [
                "发票号",
                "出差人",
                "员工ID",
                "项目号",
                "拆分金额",
                "拆分税额",
                "不含税金额",
                "税率",
                "原发票金额",
                "原发票税额",
                "拆分比例",
                "是否有效",
                "错误信息",
            ]
        )

        for r in report.split_results:
            writer.writerow(
                [
                    r.invoice_no,
                    r.traveler_name,
                    r.employee_id,
                    r.project_code,
                    float(r.split_amount),
                    float(r.split_tax),
                    float(r.split_amount_excl_tax),
                    float(r.tax_rate),
                    float(r.original_amount),
                    float(r.original_tax),
                    float(r.split_ratio),
                    r.is_valid,
                    r.error_message,
                ]
            )

        return output.getvalue()

    def export_human_readable(self, report: SplitReport) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("           酒旅发票项目拆分税额校正排查报告")
        lines.append("=" * 80)
        lines.append("")
        lines.append(f"报告编号: {report.report_id}")
        lines.append(f"报告日期: {report.report_date}")
        lines.append("")
        lines.append("-" * 80)
        lines.append("【汇总信息】")
        lines.append("-" * 80)
        lines.append(f"  发票总数: {report.total_invoices} 张")
        lines.append(f"  有效发票: {report.total_invoices_valid} 张")
        lines.append(f"  无效发票: {report.total_invoices_invalid} 张")
        lines.append("")
        lines.append(f"  原发票总金额: {report.total_original_amount:,.2f} 元")
        lines.append(f"  原发票总税额: {report.total_original_tax:,.2f} 元")
        lines.append(f"  拆分后总金额: {report.total_split_amount:,.2f} 元")
        lines.append(f"  拆分后总税额: {report.total_split_tax:,.2f} 元")
        lines.append(f"  税额差异: {report.tax_diff_amount:,.2f} 元")
        lines.append("")

        if report.warnings:
            lines.append("-" * 80)
            lines.append("【警告信息】")
            lines.append("-" * 80)
            for i, warning in enumerate(report.warnings, 1):
                lines.append(f"  {i}. {warning}")
            lines.append("")

        if report.errors:
            lines.append("-" * 80)
            lines.append("【错误信息】")
            lines.append("-" * 80)
            for i, error in enumerate(report.errors, 1):
                lines.append(f"  {i}. {error}")
            lines.append("")

        lines.append("-" * 80)
        lines.append("【拆分明细】")
        lines.append("-" * 80)
        lines.append("")

        current_invoice = None
        for r in report.split_results:
            if current_invoice != r.invoice_no:
                current_invoice = r.invoice_no
                lines.append("")
                lines.append(
                    f"发票号: {r.invoice_no} | "
                    f"原金额: {r.original_amount:,.2f}元 | "
                    f"原税额: {r.original_tax:,.2f}元"
                )
                lines.append("-" * 80)

            status = "✓" if r.is_valid else "✗"
            lines.append(
                f"  [{status}] {r.traveler_name}({r.employee_id}) | "
                f"项目: {r.project_code} | "
                f"金额: {r.split_amount:,.2f}元 | "
                f"税额: {r.split_tax:,.2f}元 | "
                f"比例: {r.split_ratio*100:.2f}%"
            )
            if not r.is_valid and r.error_message:
                lines.append(f"       错误: {r.error_message}")

        lines.append("")
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        return "\n".join(lines)
