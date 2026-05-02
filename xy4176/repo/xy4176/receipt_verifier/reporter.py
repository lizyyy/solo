"""报告模块 - 导出 Markdown、CSV 和 JSON 审计包"""

import csv
import json
from dataclasses import asdict
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    PaymentVerification,
    ReportData,
    VerificationResult,
    VerificationStatus,
)
from .utils import ensure_directory, generate_id


class JSONEncoder(json.JSONEncoder):
    """自定义 JSON 编码器"""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, VerificationStatus):
            return obj.name
        return super().default(obj)


class ReportGenerator:
    """报告生成器"""

    def __init__(
        self,
        payment_verifications: List[PaymentVerification],
        report_id: Optional[str] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
    ):
        """初始化报告生成器

        Args:
            payment_verifications: 付款校验结果列表
            report_id: 报告 ID（自动生成时为 None）
            period_start: 账期开始日期
            period_end: 账期结束日期
        """
        self.payment_verifications = payment_verifications
        self.report_id = report_id or generate_id("REPORT_")
        self.generated_at = datetime.now()
        self.period_start = period_start
        self.period_end = period_end

    def _build_report_data(self) -> ReportData:
        """构建报告数据

        Returns:
            ReportData 对象
        """
        total_payments = len(self.payment_verifications)
        passed_payments = sum(
            1 for pv in self.payment_verifications
            if pv.overall_status == VerificationStatus.PASSED
        )
        failed_payments = sum(
            1 for pv in self.payment_verifications
            if pv.overall_status == VerificationStatus.FAILED
        )
        warning_payments = sum(
            1 for pv in self.payment_verifications
            if pv.overall_status == VerificationStatus.WARNING
        )
        verified_payments = passed_payments + failed_payments + warning_payments

        duplicate_receipts = self._collect_duplicate_receipts()
        missing_documents = self._collect_missing_documents()
        amount_mismatches = self._collect_amount_mismatches()

        return ReportData(
            report_id=self.report_id,
            generated_at=self.generated_at,
            period_start=self.period_start,
            period_end=self.period_end,
            total_payments=total_payments,
            verified_payments=verified_payments,
            passed_payments=passed_payments,
            failed_payments=failed_payments,
            warning_payments=warning_payments,
            duplicate_receipts=duplicate_receipts,
            missing_documents=missing_documents,
            amount_mismatches=amount_mismatches,
            verification_details=self.payment_verifications,
        )

    def _collect_duplicate_receipts(self) -> List[Dict[str, Any]]:
        """收集重复回单信息

        Returns:
            重复回单列表
        """
        hash_to_payments: Dict[str, List[PaymentVerification]] = {}

        for pv in self.payment_verifications:
            if pv.receipt_info and pv.receipt_info.file_hash:
                file_hash = pv.receipt_info.file_hash
                if file_hash not in hash_to_payments:
                    hash_to_payments[file_hash] = []
                hash_to_payments[file_hash].append(pv)

        duplicates: List[Dict[str, Any]] = []
        for file_hash, payments in hash_to_payments.items():
            if len(payments) > 1:
                duplicates.append({
                    "file_hash": file_hash,
                    "duplicate_count": len(payments),
                    "payment_ids": [pv.payment_id for pv in payments],
                    "file_paths": [pv.receipt_info.file_path if pv.receipt_info else "" for pv in payments],
                    "amounts": [str(pv.receipt_info.amount) if pv.receipt_info else "" for pv in payments],
                    "payee_names": [pv.receipt_info.payee_name if pv.receipt_info else "" for pv in payments],
                })

        return duplicates

    def _collect_missing_documents(self) -> List[Dict[str, Any]]:
        """收集缺失凭证信息

        Returns:
            缺失凭证列表
        """
        missing: List[Dict[str, Any]] = []

        for pv in self.payment_verifications:
            missing_types: List[str] = []

            if not pv.receipt_info:
                missing_types.append("回单")

            if pv.erp_payment and pv.erp_payment.invoice_number and not pv.invoice:
                missing_types.append("发票")

            if missing_types:
                missing.append({
                    "payment_id": pv.payment_id,
                    "payee_name": pv.erp_payment.payee_name if pv.erp_payment else "",
                    "amount": str(pv.erp_payment.amount) if pv.erp_payment else "",
                    "missing_types": missing_types,
                    "overall_status": pv.overall_status.name,
                })

        return missing

    def _collect_amount_mismatches(self) -> List[Dict[str, Any]]:
        """收集金额不匹配信息

        Returns:
            金额不匹配列表
        """
        mismatches: List[Dict[str, Any]] = []

        for pv in self.payment_verifications:
            if not pv.erp_payment or not pv.receipt_info:
                continue

            erp_amount = pv.erp_payment.amount
            receipt_amount = pv.receipt_info.amount

            if abs(erp_amount - receipt_amount) > Decimal("0.01"):
                invoice_amount = None
                if pv.invoice:
                    invoice_amount = pv.invoice.total_amount or pv.invoice.amount

                mismatches.append({
                    "payment_id": pv.payment_id,
                    "payee_name": pv.erp_payment.payee_name,
                    "erp_amount": str(erp_amount),
                    "receipt_amount": str(receipt_amount),
                    "invoice_amount": str(invoice_amount) if invoice_amount else None,
                    "difference": str(abs(erp_amount - receipt_amount)),
                })

        return mismatches

    def generate_json(self, output_path: str) -> str:
        """生成 JSON 报告

        Args:
            output_path: 输出文件路径

        Returns:
            输出文件路径
        """
        report_data = self._build_report_data()

        def convert_to_dict(obj: Any) -> Any:
            if hasattr(obj, "__dataclass_fields__"):
                return {k: convert_to_dict(v) for k, v in asdict(obj).items()}
            if isinstance(obj, Decimal):
                return str(obj)
            if isinstance(obj, (date, datetime)):
                return obj.isoformat()
            if isinstance(obj, VerificationStatus):
                return obj.name
            if isinstance(obj, list):
                return [convert_to_dict(item) for item in obj]
            if isinstance(obj, dict):
                return {k: convert_to_dict(v) for k, v in obj.items()}
            return obj

        output_dict = convert_to_dict(report_data)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output_dict, f, ensure_ascii=False, indent=2, cls=JSONEncoder)

        return output_path

    def generate_csv(self, output_path: str) -> str:
        """生成 CSV 报告

        Args:
            output_path: 输出文件路径

        Returns:
            输出文件路径
        """
        report_data = self._build_report_data()

        rows: List[Dict[str, Any]] = []

        for pv in report_data.verification_details:
            row = {
                "付款单号": pv.payment_id,
                "收款单位": pv.erp_payment.payee_name if pv.erp_payment else "",
                "ERP金额": str(pv.erp_payment.amount) if pv.erp_payment else "",
                "回单金额": str(pv.receipt_info.amount) if pv.receipt_info else "",
                "发票号": pv.invoice.invoice_number if pv.invoice else "",
                "供应商": pv.supplier.supplier_name if pv.supplier else "",
                "整体状态": pv.overall_status.name,
                "校验结果数": len(pv.verification_results),
            }

            for i, result in enumerate(pv.verification_results):
                row[f"校验规则_{i+1}"] = result.rule_name
                row[f"规则状态_{i+1}"] = result.status.name
                row[f"规则消息_{i+1}"] = result.message

            rows.append(row)

        if not rows:
            return output_path

        fieldnames = list(rows[0].keys())

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                writer.writerow(row)

        return output_path

    def generate_markdown(self, output_path: str) -> str:
        """生成 Markdown 报告

        Args:
            output_path: 输出文件路径

        Returns:
            输出文件路径
        """
        report_data = self._build_report_data()

        lines: List[str] = []

        lines.append("# 电子回单归档核验报告")
        lines.append("")
        lines.append(f"- **报告编号**: {report_data.report_id}")
        lines.append(f"- **生成时间**: {report_data.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        if report_data.period_start and report_data.period_end:
            lines.append(f"- **账期范围**: {report_data.period_start} ~ {report_data.period_end}")
        lines.append("")

        lines.append("## 统计概览")
        lines.append("")
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 总付款记录 | {report_data.total_payments} |")
        lines.append(f"| 已校验 | {report_data.verified_payments} |")
        lines.append(f"| ✅ 通过 | {report_data.passed_payments} |")
        lines.append(f"| ❌ 失败 | {report_data.failed_payments} |")
        lines.append(f"| ⚠️ 警告 | {report_data.warning_payments} |")
        lines.append("")

        if report_data.duplicate_receipts:
            lines.append("## 重复回单警告")
            lines.append("")
            lines.append(f"发现 **{len(report_data.duplicate_receipts)}** 组重复回单:")
            lines.append("")
            for i, dup in enumerate(report_data.duplicate_receipts, 1):
                lines.append(f"### 第 {i} 组重复 ({dup['duplicate_count']} 个文件)")
                lines.append("")
                lines.append(f"- **文件哈希**: `{dup['file_hash']}`")
                lines.append(f"- **涉及付款单号**: {', '.join(dup['payment_ids'])}")
                lines.append(f"- **涉及文件**:")
                for fp in dup['file_paths']:
                    lines.append(f"  - `{fp}`")
                lines.append("")

        if report_data.missing_documents:
            lines.append("## 缺失凭证")
            lines.append("")
            lines.append(f"发现 **{len(report_data.missing_documents)}** 条记录缺少凭证:")
            lines.append("")
            lines.append("| 付款单号 | 收款单位 | 金额 | 缺失凭证 |")
            lines.append("|----------|----------|------|----------|")
            for missing in report_data.missing_documents:
                lines.append(f"| {missing['payment_id']} | {missing['payee_name']} | {missing['amount']} | {', '.join(missing['missing_types'])} |")
            lines.append("")

        if report_data.amount_mismatches:
            lines.append("## 金额不匹配")
            lines.append("")
            lines.append(f"发现 **{len(report_data.amount_mismatches)}** 条记录金额不匹配:")
            lines.append("")
            lines.append("| 付款单号 | 收款单位 | ERP金额 | 回单金额 | 差异 |")
            lines.append("|----------|----------|---------|----------|------|")
            for mismatch in report_data.amount_mismatches:
                lines.append(f"| {mismatch['payment_id']} | {mismatch['payee_name']} | {mismatch['erp_amount']} | {mismatch['receipt_amount']} | {mismatch['difference']} |")
            lines.append("")

        lines.append("## 详细校验结果")
        lines.append("")

        for pv in report_data.verification_details:
            status_icon = "✅"
            if pv.overall_status == VerificationStatus.FAILED:
                status_icon = "❌"
            elif pv.overall_status == VerificationStatus.WARNING:
                status_icon = "⚠️"

            lines.append(f"### {status_icon} 付款单号: {pv.payment_id}")
            lines.append("")

            if pv.erp_payment:
                lines.append(f"- **收款单位**: {pv.erp_payment.payee_name}")
                lines.append(f"- **ERP金额**: {pv.erp_payment.amount}")
                if pv.erp_payment.invoice_number:
                    lines.append(f"- **关联发票号**: {pv.erp_payment.invoice_number}")

            if pv.receipt_info:
                lines.append(f"- **回单文件**: `{pv.receipt_info.file_path}`")
                lines.append(f"- **回单金额**: {pv.receipt_info.amount}")
                lines.append(f"- **收款人**: {pv.receipt_info.payee_name}")

            if pv.supplier:
                lines.append(f"- **供应商台账**: {pv.supplier.supplier_name}")

            lines.append("")

            if pv.verification_results:
                lines.append("**校验详情:**")
                lines.append("")
                for result in pv.verification_results:
                    result_icon = "✅"
                    if result.status == VerificationStatus.FAILED:
                        result_icon = "❌"
                    elif result.status == VerificationStatus.WARNING:
                        result_icon = "⚠️"
                    lines.append(f"{result_icon} **{result.rule_name}**: {result.message}")
                lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*此报告由电子回单归档核验员自动生成*")

        content = "\n".join(lines)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

        return output_path

    def generate_all(
        self,
        output_directory: str,
        base_name: Optional[str] = None,
    ) -> Dict[str, str]:
        """生成所有格式的报告

        Args:
            output_directory: 输出目录
            base_name: 基础文件名（不含扩展名）

        Returns:
            格式到文件路径的映射字典
        """
        ensure_directory(output_directory)

        if base_name is None:
            base_name = f"report_{self.report_id}"

        output_dir = Path(output_directory)

        json_path = str(output_dir / f"{base_name}.json")
        csv_path = str(output_dir / f"{base_name}.csv")
        md_path = str(output_dir / f"{base_name}.md")

        self.generate_json(json_path)
        self.generate_csv(csv_path)
        self.generate_markdown(md_path)

        return {
            "json": json_path,
            "csv": csv_path,
            "markdown": md_path,
        }


def generate_audit_report(
    payment_verifications: List[PaymentVerification],
    output_directory: str,
    report_id: Optional[str] = None,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
) -> Dict[str, str]:
    """便捷函数：生成审计报告包

    Args:
        payment_verifications: 付款校验结果列表
        output_directory: 输出目录
        report_id: 报告 ID
        period_start: 账期开始
        period_end: 账期结束

    Returns:
        格式到文件路径的映射字典
    """
    generator = ReportGenerator(
        payment_verifications=payment_verifications,
        report_id=report_id,
        period_start=period_start,
        period_end=period_end,
    )
    return generator.generate_all(output_directory)
