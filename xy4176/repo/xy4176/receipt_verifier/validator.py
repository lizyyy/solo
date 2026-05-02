"""规则校验模块 - 校验付款金额、账号尾号、发票号、日期窗口、重复回单和缺失凭证"""

from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from .models import (
    ERPPayment,
    InvoiceItem,
    PaymentVerification,
    ReceiptInfo,
    SupplierLedger,
    VerificationResult,
    VerificationStatus,
)
from .utils import compare_fuzzy, extract_account_tail


@dataclass
class VerificationContext:
    """校验上下文"""

    receipts: List[ReceiptInfo] = field(default_factory=list)
    erp_payments: List[ERPPayment] = field(default_factory=list)
    invoices: List[InvoiceItem] = field(default_factory=list)
    suppliers: List[SupplierLedger] = field(default_factory=list)

    receipt_by_hash: Dict[str, ReceiptInfo] = field(default_factory=dict)
    erp_by_id: Dict[str, ERPPayment] = field(default_factory=dict)
    invoice_by_number: Dict[str, InvoiceItem] = field(default_factory=dict)
    supplier_by_code: Dict[str, SupplierLedger] = field(default_factory=dict)
    supplier_by_name: Dict[str, SupplierLedger] = field(default_factory=dict)

    duplicate_receipts: List[List[ReceiptInfo]] = field(default_factory=list)

    def build_indexes(self) -> None:
        """构建索引"""
        hash_to_receipts: Dict[str, List[ReceiptInfo]] = defaultdict(list)

        for receipt in self.receipts:
            hash_to_receipts[receipt.file_hash].append(receipt)
            if receipt.file_hash not in self.receipt_by_hash:
                self.receipt_by_hash[receipt.file_hash] = receipt

        self.duplicate_receipts = [
            group for group in hash_to_receipts.values() if len(group) > 1
        ]

        for payment in self.erp_payments:
            if payment.payment_id:
                self.erp_by_id[payment.payment_id] = payment

        for invoice in self.invoices:
            if invoice.invoice_number:
                self.invoice_by_number[invoice.invoice_number] = invoice

        for supplier in self.suppliers:
            if supplier.supplier_code:
                self.supplier_by_code[supplier.supplier_code] = supplier
            if supplier.supplier_name:
                self.supplier_by_name[supplier.supplier_name] = supplier


class BaseVerificationRule(ABC):
    """校验规则基类"""

    rule_name: str = "base_rule"
    severity: str = "error"

    @abstractmethod
    def verify(self, context: VerificationContext) -> List[VerificationResult]:
        """执行校验

        Args:
            context: 校验上下文

        Returns:
            校验结果列表
        """
        pass


class AmountVerificationRule(BaseVerificationRule):
    """金额校验规则"""

    rule_name: str = "amount_verification"
    severity: str = "error"

    def __init__(self, tolerance: Decimal = Decimal("0.01")):
        self.tolerance = tolerance

    def verify(self, context: VerificationContext) -> List[VerificationResult]:
        results: List[VerificationResult] = []

        for payment in context.erp_payments:
            matched_receipt = self._find_matching_receipt(payment, context)
            matched_invoice = self._find_matching_invoice(payment, context)

            if matched_receipt:
                receipt_amount = matched_receipt.amount
                erp_amount = payment.amount

                if abs(receipt_amount - erp_amount) > self.tolerance:
                    results.append(
                        VerificationResult(
                            rule_name=self.rule_name,
                            status=VerificationStatus.FAILED,
                            message=f"付款金额不匹配: ERP金额 {erp_amount} != 回单金额 {receipt_amount}",
                            details={
                                "payment_id": payment.payment_id,
                                "erp_amount": str(erp_amount),
                                "receipt_amount": str(receipt_amount),
                                "difference": str(abs(receipt_amount - erp_amount)),
                                "receipt_file": matched_receipt.file_path,
                            },
                        )
                    )
                else:
                    results.append(
                        VerificationResult(
                            rule_name=self.rule_name,
                            status=VerificationStatus.PASSED,
                            message=f"金额匹配: ERP金额 {erp_amount} == 回单金额 {receipt_amount}",
                            details={
                                "payment_id": payment.payment_id,
                                "erp_amount": str(erp_amount),
                                "receipt_amount": str(receipt_amount),
                            },
                        )
                    )

            if matched_invoice and payment.amount > 0:
                invoice_amount = matched_invoice.total_amount or matched_invoice.amount
                if invoice_amount > 0:
                    if abs(payment.amount - invoice_amount) > self.tolerance:
                        results.append(
                            VerificationResult(
                                rule_name=self.rule_name,
                                status=VerificationStatus.WARNING,
                                message=f"付款与发票金额差异: 付款 {payment.amount} != 发票 {invoice_amount}",
                                details={
                                    "payment_id": payment.payment_id,
                                    "payment_amount": str(payment.amount),
                                    "invoice_amount": str(invoice_amount),
                                    "invoice_number": matched_invoice.invoice_number,
                                    "difference": str(abs(payment.amount - invoice_amount)),
                                },
                            )
                        )

        return results

    def _find_matching_receipt(
        self, payment: ERPPayment, context: VerificationContext
    ) -> Optional[ReceiptInfo]:
        """查找匹配的回单"""
        for receipt in context.receipts:
            if payment.payee_account and receipt.payee_account:
                if payment.payee_account in receipt.payee_account or receipt.payee_account in payment.payee_account:
                    if abs(payment.amount - receipt.amount) <= Decimal("100"):
                        return receipt

            if payment.payee_name and receipt.payee_name:
                similarity = compare_fuzzy(payment.payee_name, receipt.payee_name)
                if similarity >= 0.8:
                    if abs(payment.amount - receipt.amount) <= Decimal("100"):
                        return receipt

        return None

    def _find_matching_invoice(
        self, payment: ERPPayment, context: VerificationContext
    ) -> Optional[InvoiceItem]:
        """查找匹配的发票"""
        if payment.invoice_number:
            if payment.invoice_number in context.invoice_by_number:
                return context.invoice_by_number[payment.invoice_number]

            for inv_num, invoice in context.invoice_by_number.items():
                if payment.invoice_number in inv_num or inv_num in payment.invoice_number:
                    return invoice

        return None


class AccountTailVerificationRule(BaseVerificationRule):
    """账号尾号校验规则"""

    rule_name: str = "account_tail_verification"
    severity: str = "error"

    def __init__(self, tail_length: int = 4):
        self.tail_length = tail_length

    def verify(self, context: VerificationContext) -> List[VerificationResult]:
        results: List[VerificationResult] = []

        for payment in context.erp_payments:
            supplier = self._find_supplier(payment, context)
            if not supplier:
                continue

            erp_tail = extract_account_tail(payment.payee_account, self.tail_length)
            supplier_tail = extract_account_tail(supplier.bank_account, self.tail_length)

            if erp_tail and supplier_tail:
                if erp_tail != supplier_tail:
                    results.append(
                        VerificationResult(
                            rule_name=self.rule_name,
                            status=VerificationStatus.FAILED,
                            message=f"账号尾号不匹配: ERP尾号 {erp_tail} != 台账尾号 {supplier_tail}",
                            details={
                                "payment_id": payment.payment_id,
                                "payee_name": payment.payee_name,
                                "erp_account": payment.payee_account,
                                "supplier_account": supplier.bank_account,
                                "supplier_name": supplier.supplier_name,
                            },
                        )
                    )
                else:
                    results.append(
                        VerificationResult(
                            rule_name=self.rule_name,
                            status=VerificationStatus.PASSED,
                            message=f"账号尾号匹配: {erp_tail}",
                            details={
                                "payment_id": payment.payment_id,
                                "payee_name": payment.payee_name,
                                "account_tail": erp_tail,
                            },
                        )
                    )

        return results

    def _find_supplier(
        self, payment: ERPPayment, context: VerificationContext
    ) -> Optional[SupplierLedger]:
        """查找对应的供应商"""
        if payment.supplier_code and payment.supplier_code in context.supplier_by_code:
            return context.supplier_by_code[payment.supplier_code]

        if payment.payee_name:
            if payment.payee_name in context.supplier_by_name:
                return context.supplier_by_name[payment.payee_name]

            for supplier_name, supplier in context.supplier_by_name.items():
                similarity = compare_fuzzy(payment.payee_name, supplier_name)
                if similarity >= 0.8:
                    return supplier

        return None


class InvoiceNumberVerificationRule(BaseVerificationRule):
    """发票号校验规则"""

    rule_name: str = "invoice_number_verification"
    severity: str = "warning"

    def verify(self, context: VerificationContext) -> List[VerificationResult]:
        results: List[VerificationResult] = []

        erp_invoice_numbers = set()
        for payment in context.erp_payments:
            if payment.invoice_number:
                erp_invoice_numbers.add(payment.invoice_number)

        invoice_list_numbers = set(context.invoice_by_number.keys())

        missing_in_invoice_list = erp_invoice_numbers - invoice_list_numbers
        for inv_num in missing_in_invoice_list:
            results.append(
                VerificationResult(
                    rule_name=self.rule_name,
                    status=VerificationStatus.WARNING,
                    message=f"ERP中的发票号 {inv_num} 在发票清单中不存在",
                    details={
                        "invoice_number": inv_num,
                        "source": "ERP",
                    },
                )
            )

        missing_in_erp = invoice_list_numbers - erp_invoice_numbers
        for inv_num in missing_in_erp:
            results.append(
                VerificationResult(
                    rule_name=self.rule_name,
                    status=VerificationStatus.WARNING,
                    message=f"发票清单中的发票号 {inv_num} 在ERP中不存在",
                    details={
                        "invoice_number": inv_num,
                        "source": "发票清单",
                    },
                )
            )

        common_invoices = erp_invoice_numbers & invoice_list_numbers
        for inv_num in common_invoices:
            results.append(
                VerificationResult(
                    rule_name=self.rule_name,
                    status=VerificationStatus.PASSED,
                    message=f"发票号 {inv_num} 匹配",
                    details={
                        "invoice_number": inv_num,
                    },
                )
            )

        return results


class DateWindowVerificationRule(BaseVerificationRule):
    """日期窗口校验规则"""

    rule_name: str = "date_window_verification"
    severity: str = "warning"

    def __init__(
        self,
        window_days: int = 30,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
    ):
        self.window_days = window_days
        self.period_start = period_start
        self.period_end = period_end

    def verify(self, context: VerificationContext) -> List[VerificationResult]:
        results: List[VerificationResult] = []

        all_dates: List[date] = []
        for receipt in context.receipts:
            if receipt.payment_date:
                all_dates.append(receipt.payment_date)
        for payment in context.erp_payments:
            if payment.payment_date:
                all_dates.append(payment.payment_date)
        for invoice in context.invoices:
            if invoice.invoice_date:
                all_dates.append(invoice.invoice_date)

        if not all_dates:
            return results

        if self.period_start is None:
            self.period_start = min(all_dates)
        if self.period_end is None:
            self.period_end = max(all_dates)

        for receipt in context.receipts:
            if receipt.payment_date:
                if receipt.payment_date < self.period_start or receipt.payment_date > self.period_end:
                    results.append(
                        VerificationResult(
                            rule_name=self.rule_name,
                            status=VerificationStatus.WARNING,
                            message=f"回单日期 {receipt.payment_date} 超出账期范围 {self.period_start} ~ {self.period_end}",
                            details={
                                "receipt_file": receipt.file_path,
                                "receipt_date": str(receipt.payment_date),
                                "period_start": str(self.period_start),
                                "period_end": str(self.period_end),
                            },
                        )
                    )
                else:
                    results.append(
                        VerificationResult(
                            rule_name=self.rule_name,
                            status=VerificationStatus.PASSED,
                            message=f"回单日期 {receipt.payment_date} 在账期范围内",
                            details={
                                "receipt_file": receipt.file_path,
                                "receipt_date": str(receipt.payment_date),
                            },
                        )
                    )

        for payment in context.erp_payments:
            if payment.payment_date:
                if payment.payment_date < self.period_start or payment.payment_date > self.period_end:
                    results.append(
                        VerificationResult(
                            rule_name=self.rule_name,
                            status=VerificationStatus.WARNING,
                            message=f"ERP付款日期 {payment.payment_date} 超出账期范围",
                            details={
                                "payment_id": payment.payment_id,
                                "payment_date": str(payment.payment_date),
                            },
                        )
                    )

        return results


class DuplicateReceiptVerificationRule(BaseVerificationRule):
    """重复回单校验规则"""

    rule_name: str = "duplicate_receipt_verification"
    severity: str = "error"

    def verify(self, context: VerificationContext) -> List[VerificationResult]:
        results: List[VerificationResult] = []

        for duplicate_group in context.duplicate_receipts:
            file_paths = [r.file_path for r in duplicate_group]
            amounts = [str(r.amount) for r in duplicate_group]
            payees = [r.payee_name for r in duplicate_group]

            results.append(
                VerificationResult(
                    rule_name=self.rule_name,
                    status=VerificationStatus.FAILED,
                    message=f"发现 {len(duplicate_group)} 个重复回单: {', '.join(file_paths)}",
                    details={
                        "duplicate_count": len(duplicate_group),
                        "file_paths": file_paths,
                        "file_hashes": [r.file_hash for r in duplicate_group],
                        "amounts": amounts,
                        "payee_names": payees,
                    },
                )
            )

        if not context.duplicate_receipts:
            results.append(
                VerificationResult(
                    rule_name=self.rule_name,
                    status=VerificationStatus.PASSED,
                    message=f"未发现重复回单（共检查 {len(context.receipts)} 个回单）",
                    details={
                        "total_receipts": len(context.receipts),
                    },
                )
            )

        return results


class MissingDocumentVerificationRule(BaseVerificationRule):
    """缺失凭证校验规则"""

    rule_name: str = "missing_document_verification"
    severity: str = "warning"

    def verify(self, context: VerificationContext) -> List[VerificationResult]:
        results: List[VerificationResult] = []

        for payment in context.erp_payments:
            has_receipt = self._has_matching_receipt(payment, context)
            has_invoice = self._has_matching_invoice(payment, context)

            if not has_receipt and payment.amount > 0:
                results.append(
                    VerificationResult(
                        rule_name=self.rule_name,
                        status=VerificationStatus.FAILED,
                        message=f"ERP付款记录 {payment.payment_id} 缺少对应的银行回单",
                        details={
                            "payment_id": payment.payment_id,
                            "payee_name": payment.payee_name,
                            "amount": str(payment.amount),
                            "missing_type": "回单",
                        },
                    )
                )

            if not has_invoice and payment.invoice_number:
                results.append(
                    VerificationResult(
                        rule_name=self.rule_name,
                        status=VerificationStatus.WARNING,
                        message=f"ERP付款记录 {payment.payment_id} 缺少对应的发票（发票号: {payment.invoice_number}）",
                        details={
                            "payment_id": payment.payment_id,
                            "invoice_number": payment.invoice_number,
                            "missing_type": "发票",
                        },
                    )
                )

            if has_receipt and has_invoice:
                results.append(
                    VerificationResult(
                        rule_name=self.rule_name,
                        status=VerificationStatus.PASSED,
                        message=f"付款记录 {payment.payment_id} 凭证完整",
                        details={
                            "payment_id": payment.payment_id,
                            "has_receipt": has_receipt,
                            "has_invoice": has_invoice,
                        },
                    )
                )

        return results

    def _has_matching_receipt(
        self, payment: ERPPayment, context: VerificationContext
    ) -> bool:
        """检查是否有匹配的回单"""
        for receipt in context.receipts:
            if payment.payee_account and receipt.payee_account:
                if payment.payee_account in receipt.payee_account or receipt.payee_account in payment.payee_account:
                    if abs(payment.amount - receipt.amount) <= Decimal("0.01"):
                        return True

            if payment.payee_name and receipt.payee_name:
                similarity = compare_fuzzy(payment.payee_name, receipt.payee_name)
                if similarity >= 0.8:
                    if abs(payment.amount - receipt.amount) <= Decimal("100"):
                        return True

        return False

    def _has_matching_invoice(
        self, payment: ERPPayment, context: VerificationContext
    ) -> bool:
        """检查是否有匹配的发票"""
        if not payment.invoice_number:
            return True

        if payment.invoice_number in context.invoice_by_number:
            return True

        for inv_num in context.invoice_by_number.keys():
            if payment.invoice_number in inv_num or inv_num in payment.invoice_number:
                return True

        return False


class PaymentVerifier:
    """付款校验器 - 整合所有规则"""

    DEFAULT_RULES = [
        AmountVerificationRule,
        AccountTailVerificationRule,
        InvoiceNumberVerificationRule,
        DateWindowVerificationRule,
        DuplicateReceiptVerificationRule,
        MissingDocumentVerificationRule,
    ]

    def __init__(
        self,
        receipts: List[ReceiptInfo],
        erp_payments: List[ERPPayment],
        invoices: List[InvoiceItem],
        suppliers: List[SupplierLedger],
        custom_rules: Optional[List[BaseVerificationRule]] = None,
    ):
        self.context = VerificationContext(
            receipts=receipts,
            erp_payments=erp_payments,
            invoices=invoices,
            suppliers=suppliers,
        )
        self.context.build_indexes()
        self.rules = custom_rules or [rule_class() for rule_class in self.DEFAULT_RULES]

    def verify(self) -> List[VerificationResult]:
        """执行所有校验

        Returns:
            所有校验结果列表
        """
        all_results: List[VerificationResult] = []

        for rule in self.rules:
            results = rule.verify(self.context)
            all_results.extend(results)

        return all_results

    def verify_by_payment(self) -> List[PaymentVerification]:
        """按付款记录分组校验

        Returns:
            付款校验结果列表
        """
        payment_verifications: List[PaymentVerification] = []

        for payment in self.context.erp_payments:
            receipt = self._find_receipt_for_payment(payment)
            invoice = self._find_invoice_for_payment(payment)
            supplier = self._find_supplier_for_payment(payment)

            pv = PaymentVerification(
                payment_id=payment.payment_id,
                receipt_info=receipt,
                erp_payment=payment,
                invoice=invoice,
                supplier=supplier,
                verification_results=[],
                overall_status=VerificationStatus.PENDING,
            )

            for rule in self.rules:
                if hasattr(rule, "verify_single"):
                    try:
                        result = rule.verify_single(payment, self.context)
                        pv.verification_results.append(result)
                    except Exception:
                        pass

            statuses = [r.status for r in pv.verification_results]
            if VerificationStatus.FAILED in statuses:
                pv.overall_status = VerificationStatus.FAILED
            elif VerificationStatus.WARNING in statuses:
                pv.overall_status = VerificationStatus.WARNING
            elif VerificationStatus.PASSED in statuses:
                pv.overall_status = VerificationStatus.PASSED

            payment_verifications.append(pv)

        return payment_verifications

    def get_summary(self) -> Dict[str, Any]:
        """获取校验摘要

        Returns:
            校验摘要字典
        """
        results = self.verify()

        passed = sum(1 for r in results if r.status == VerificationStatus.PASSED)
        failed = sum(1 for r in results if r.status == VerificationStatus.FAILED)
        warning = sum(1 for r in results if r.status == VerificationStatus.WARNING)

        return {
            "total_checks": len(results),
            "passed": passed,
            "failed": failed,
            "warning": warning,
            "duplicate_receipts_count": len(self.context.duplicate_receipts),
            "total_receipts": len(self.context.receipts),
            "total_erp_payments": len(self.context.erp_payments),
            "total_invoices": len(self.context.invoices),
            "total_suppliers": len(self.context.suppliers),
        }

    def _find_receipt_for_payment(self, payment: ERPPayment) -> Optional[ReceiptInfo]:
        """为付款记录查找匹配的回单"""
        for receipt in self.context.receipts:
            if payment.payee_account and receipt.payee_account:
                if payment.payee_account in receipt.payee_account or receipt.payee_account in payment.payee_account:
                    if abs(payment.amount - receipt.amount) <= Decimal("0.01"):
                        return receipt

            if payment.payee_name and receipt.payee_name:
                similarity = compare_fuzzy(payment.payee_name, receipt.payee_name)
                if similarity >= 0.8:
                    if abs(payment.amount - receipt.amount) <= Decimal("100"):
                        return receipt

        return None

    def _find_invoice_for_payment(self, payment: ERPPayment) -> Optional[InvoiceItem]:
        """为付款记录查找匹配的发票"""
        if payment.invoice_number:
            if payment.invoice_number in self.context.invoice_by_number:
                return self.context.invoice_by_number[payment.invoice_number]

            for inv_num, invoice in self.context.invoice_by_number.items():
                if payment.invoice_number in inv_num or inv_num in payment.invoice_number:
                    return invoice

        return None

    def _find_supplier_for_payment(self, payment: ERPPayment) -> Optional[SupplierLedger]:
        """为付款记录查找对应的供应商"""
        if payment.supplier_code and payment.supplier_code in self.context.supplier_by_code:
            return self.context.supplier_by_code[payment.supplier_code]

        if payment.payee_name:
            if payment.payee_name in self.context.supplier_by_name:
                return self.context.supplier_by_name[payment.payee_name]

            for supplier_name, supplier in self.context.supplier_by_name.items():
                similarity = compare_fuzzy(payment.payee_name, supplier_name)
                if similarity >= 0.8:
                    return supplier

        return None


def verify_payments(
    receipts: List[ReceiptInfo],
    erp_payments: List[ERPPayment],
    invoices: List[InvoiceItem],
    suppliers: List[SupplierLedger],
) -> Tuple[List[VerificationResult], Dict[str, Any]]:
    """便捷函数：执行付款校验

    Args:
        receipts: 回单信息列表
        erp_payments: ERP付款记录列表
        invoices: 发票清单列表
        suppliers: 供应商台账列表

    Returns:
        (校验结果列表, 校验摘要字典)
    """
    verifier = PaymentVerifier(
        receipts=receipts,
        erp_payments=erp_payments,
        invoices=invoices,
        suppliers=suppliers,
    )
    results = verifier.verify()
    summary = verifier.get_summary()
    return results, summary
