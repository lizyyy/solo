import uuid
from decimal import Decimal
from datetime import date
from typing import List, Dict, Any, Optional, Tuple, Callable
from collections import defaultdict

from .models import (
    Document, Invoice, PurchaseOrderLine, Receipt, Payment,
    Issue, IssueType, IssueSeverity, DocumentType,
    ValidationRule, MatchResult
)


class RulesEngine:
    def __init__(self, rules: List[ValidationRule]):
        self.rules = [r for r in rules if r.enabled]
        self._rule_handlers: Dict[str, Callable] = {
            "amount": self._check_amount_consistency,
            "vendor": self._check_vendor_consistency,
            "quantity": self._check_quantity_consistency,
            "tax_rate": self._check_tax_rate_consistency,
            "currency": self._check_currency_consistency,
            "date": self._check_date_logic,
            "required": self._check_required_fields,
        }

    def validate_single_document(self, doc: Document) -> List[Issue]:
        issues = []
        
        for rule in self.rules:
            if rule.rule_type == "required":
                rule_issues = self._check_required_fields_for_doc(doc, rule)
                issues.extend(rule_issues)
        
        return issues

    def validate_match_group(self, match_group: MatchResult,
                             invoices: Dict[str, Invoice],
                             po_lines: Dict[str, PurchaseOrderLine],
                             receipts: Dict[str, Receipt],
                             payments: Dict[str, Payment]) -> List[Issue]:
        issues = []
        
        docs = {
            "invoices": [invoices.get(iid) for iid in match_group.invoice_ids if invoices.get(iid)],
            "po_lines": [po_lines.get(pid) for pid in match_group.po_line_ids if po_lines.get(pid)],
            "receipts": [receipts.get(rid) for rid in match_group.receipt_ids if receipts.get(rid)],
            "payments": [payments.get(pid) for pid in match_group.payment_ids if payments.get(pid)],
        }
        
        for rule in self.rules:
            handler = self._rule_handlers.get(rule.rule_type)
            if handler:
                rule_issues = handler(docs, rule)
                issues.extend(rule_issues)
        
        return issues

    def _check_amount_consistency(self, docs: Dict[str, List[Document]], 
                                   rule: ValidationRule) -> List[Issue]:
        issues = []
        tolerance = Decimal(str(rule.conditions.get("tolerance", "0.01")))
        check_tax = rule.conditions.get("check_tax", True)
        
        all_docs = []
        all_docs.extend(docs.get("invoices", []))
        all_docs.extend(docs.get("po_lines", []))
        all_docs.extend(docs.get("receipts", []))
        all_docs.extend(docs.get("payments", []))
        
        if len(all_docs) < 2:
            return issues
        
        invoices_total = sum(d.total_amount for d in docs.get("invoices", []))
        po_total = sum(d.total_amount for d in docs.get("po_lines", []))
        receipts_total = sum(d.total_amount for d in docs.get("receipts", []))
        payments_total = sum(d.total_amount for d in docs.get("payments", []))
        
        primary_doc = all_docs[0]
        expected_amount = invoices_total if docs.get("invoices") else (po_total if docs.get("po_lines") else receipts_total)
        
        if po_total > 0 and abs(invoices_total - po_total) > tolerance:
            issues.append(self._create_issue(
                issue_type=IssueType.AMOUNT_MISMATCH,
                severity=rule.severity,
                description=f"发票总金额 {invoices_total} 与采购订单总金额 {po_total} 不一致",
                primary_doc=primary_doc,
                related_docs=all_docs,
                expected=po_total,
                actual=invoices_total,
                difference=abs(invoices_total - po_total)
            ))
        
        if receipts_total > 0 and abs(invoices_total - receipts_total) > tolerance:
            issues.append(self._create_issue(
                issue_type=IssueType.AMOUNT_MISMATCH,
                severity=rule.severity,
                description=f"发票总金额 {invoices_total} 与收货单总金额 {receipts_total} 不一致",
                primary_doc=primary_doc,
                related_docs=all_docs,
                expected=receipts_total,
                actual=invoices_total,
                difference=abs(invoices_total - receipts_total)
            ))
        
        if payments_total > 0 and abs(invoices_total - payments_total) > tolerance:
            issues.append(self._create_issue(
                issue_type=IssueType.AMOUNT_MISMATCH,
                severity=rule.severity,
                description=f"发票总金额 {invoices_total} 与付款总金额 {payments_total} 不一致",
                primary_doc=primary_doc,
                related_docs=all_docs,
                expected=invoices_total,
                actual=payments_total,
                difference=abs(invoices_total - payments_total)
            ))
        
        return issues

    def _check_vendor_consistency(self, docs: Dict[str, List[Document]],
                                   rule: ValidationRule) -> List[Issue]:
        issues = []
        
        all_docs = []
        all_docs.extend(docs.get("invoices", []))
        all_docs.extend(docs.get("po_lines", []))
        all_docs.extend(docs.get("receipts", []))
        
        if len(all_docs) < 2:
            return issues
        
        vendor_ids = set()
        vendor_names = {}
        
        for doc in all_docs:
            if doc.vendor_id:
                vendor_ids.add(doc.vendor_id)
                vendor_names[doc.vendor_id] = doc.vendor_name
        
        if len(vendor_ids) > 1:
            issues.append(self._create_issue(
                issue_type=IssueType.VENDOR_MISMATCH,
                severity=rule.severity,
                description=f"供应商不一致: {', '.join([f'{vid}({vendor_names.get(vid, vid)})' for vid in vendor_ids])}",
                primary_doc=all_docs[0],
                related_docs=all_docs
            ))
        
        return issues

    def _check_quantity_consistency(self, docs: Dict[str, List[Document]],
                                     rule: ValidationRule) -> List[Issue]:
        issues = []
        tolerance = Decimal(str(rule.conditions.get("tolerance", "0")))
        
        po_lines = docs.get("po_lines", [])
        receipts = docs.get("receipts", [])
        
        po_quantities = defaultdict(Decimal)
        for po in po_lines:
            if isinstance(po, PurchaseOrderLine):
                key = po.item_code or po.po_number
                po_quantities[key] += po.quantity
        
        receipt_quantities = defaultdict(Decimal)
        for rec in receipts:
            if isinstance(rec, Receipt):
                key = rec.item_code or (rec.po_number or "")
                receipt_quantities[key] += rec.received_quantity
        
        all_keys = set(po_quantities.keys()) | set(receipt_quantities.keys())
        
        for key in all_keys:
            po_qty = po_quantities.get(key, Decimal(0))
            rec_qty = receipt_quantities.get(key, Decimal(0))
            
            if abs(po_qty - rec_qty) > tolerance and (po_qty > 0 or rec_qty > 0):
                all_docs = po_lines + receipts
                if all_docs:
                    issues.append(self._create_issue(
                        issue_type=IssueType.QUANTITY_MISMATCH,
                        severity=rule.severity,
                        description=f"物料 {key} 数量不一致: 订单数量 {po_qty}, 收货数量 {rec_qty}",
                        primary_doc=all_docs[0] if all_docs else None,
                        related_docs=all_docs,
                        expected=po_qty,
                        actual=rec_qty,
                        difference=abs(po_qty - rec_qty)
                    ))
        
        return issues

    def _check_tax_rate_consistency(self, docs: Dict[str, List[Document]],
                                     rule: ValidationRule) -> List[Issue]:
        issues = []
        
        all_docs = []
        all_docs.extend(docs.get("invoices", []))
        all_docs.extend(docs.get("po_lines", []))
        
        if len(all_docs) < 2:
            return issues
        
        tax_rates = set()
        doc_with_tax = []
        
        for doc in all_docs:
            effective_rate = doc.effective_tax_rate
            if effective_rate is not None:
                tax_rates.add(effective_rate)
                doc_with_tax.append((doc, effective_rate))
        
        if len(tax_rates) > 1:
            issues.append(self._create_issue(
                issue_type=IssueType.TAX_RATE_MISMATCH,
                severity=rule.severity,
                description=f"税率不一致: {', '.join([f'{r*100:.2f}%' for r in tax_rates])}",
                primary_doc=all_docs[0],
                related_docs=all_docs
            ))
        
        return issues

    def _check_currency_consistency(self, docs: Dict[str, List[Document]],
                                     rule: ValidationRule) -> List[Issue]:
        issues = []
        
        all_docs = []
        all_docs.extend(docs.get("invoices", []))
        all_docs.extend(docs.get("po_lines", []))
        all_docs.extend(docs.get("receipts", []))
        all_docs.extend(docs.get("payments", []))
        
        if len(all_docs) < 2:
            return issues
        
        currencies = set()
        doc_with_currency = []
        
        for doc in all_docs:
            if doc.currency:
                currencies.add(doc.currency)
                doc_with_currency.append(doc)
        
        if len(currencies) > 1:
            issues.append(self._create_issue(
                issue_type=IssueType.CURRENCY_MISMATCH,
                severity=rule.severity,
                description=f"币种不一致: {', '.join(currencies)}",
                primary_doc=all_docs[0],
                related_docs=all_docs
            ))
        
        return issues

    def _check_date_logic(self, docs: Dict[str, List[Document]],
                          rule: ValidationRule) -> List[Issue]:
        issues = []
        allow_cross_month = rule.conditions.get("allow_cross_month", True)
        
        invoices = docs.get("invoices", [])
        po_lines = docs.get("po_lines", [])
        receipts = docs.get("receipts", [])
        payments = docs.get("payments", [])
        
        earliest_po_date = None
        for po in po_lines:
            if po.date:
                if earliest_po_date is None or po.date < earliest_po_date:
                    earliest_po_date = po.date
        
        earliest_receipt_date = None
        for rec in receipts:
            if rec.date:
                if earliest_receipt_date is None or rec.date < earliest_receipt_date:
                    earliest_receipt_date = rec.date
        
        earliest_invoice_date = None
        for inv in invoices:
            if inv.date:
                if earliest_invoice_date is None or inv.date < earliest_invoice_date:
                    earliest_invoice_date = inv.date
        
        earliest_payment_date = None
        for pay in payments:
            if pay.date:
                if earliest_payment_date is None or pay.date < earliest_payment_date:
                    earliest_payment_date = pay.date
        
        all_docs = invoices + po_lines + receipts + payments
        
        if earliest_po_date and earliest_receipt_date and earliest_receipt_date < earliest_po_date:
            issues.append(self._create_issue(
                issue_type=IssueType.DATE_MISMATCH,
                severity=rule.severity,
                description=f"收货日期 {earliest_receipt_date} 早于订单日期 {earliest_po_date}",
                primary_doc=all_docs[0] if all_docs else None,
                related_docs=all_docs
            ))
        
        if earliest_receipt_date and earliest_invoice_date and earliest_invoice_date < earliest_receipt_date:
            issues.append(self._create_issue(
                issue_type=IssueType.DATE_MISMATCH,
                severity=rule.severity,
                description=f"发票日期 {earliest_invoice_date} 早于收货日期 {earliest_receipt_date}",
                primary_doc=all_docs[0] if all_docs else None,
                related_docs=all_docs
            ))
        
        if earliest_invoice_date and earliest_payment_date and earliest_payment_date < earliest_invoice_date:
            issues.append(self._create_issue(
                issue_type=IssueType.DATE_MISMATCH,
                severity=rule.severity,
                description=f"付款日期 {earliest_payment_date} 早于发票日期 {earliest_invoice_date}",
                primary_doc=all_docs[0] if all_docs else None,
                related_docs=all_docs
            ))
        
        if not allow_cross_month:
            all_dates = [earliest_po_date, earliest_receipt_date, 
                        earliest_invoice_date, earliest_payment_date]
            valid_dates = [d for d in all_dates if d]
            
            if len(valid_dates) > 1:
                months = set((d.year, d.month) for d in valid_dates)
                if len(months) > 1:
                    for pay in payments:
                        if isinstance(pay, Payment) and pay.date:
                            if (pay.date.year, pay.date.month) != (valid_dates[0].year, valid_dates[0].month):
                                issues.append(self._create_issue(
                                    issue_type=IssueType.CROSS_MONTH_PAYMENT,
                                    severity=IssueSeverity.INFO,
                                    description=f"跨月付款: 付款日期 {pay.date} 不在业务发生月份",
                                    primary_doc=pay,
                                    related_docs=all_docs
                                ))
                                break
        
        return issues

    def _check_required_fields(self, docs: Dict[str, List[Document]],
                                rule: ValidationRule) -> List[Issue]:
        issues = []
        fields = rule.conditions.get("fields", ["currency", "tax_rate"])
        
        all_docs = []
        all_docs.extend(docs.get("invoices", []))
        all_docs.extend(docs.get("po_lines", []))
        all_docs.extend(docs.get("receipts", []))
        all_docs.extend(docs.get("payments", []))
        
        for doc in all_docs:
            if "currency" in fields and not doc.currency:
                issues.append(self._create_issue(
                    issue_type=IssueType.MISSING_CURRENCY,
                    severity=rule.severity,
                    description=f"单据 {doc.doc_id} 缺少币种信息",
                    primary_doc=doc
                ))
            
            if "tax_rate" in fields and doc.tax_rate is None:
                issues.append(self._create_issue(
                    issue_type=IssueType.MISSING_TAX_RATE,
                    severity=rule.severity,
                    description=f"单据 {doc.doc_id} 缺少税率信息",
                    primary_doc=doc
                ))
        
        return issues

    def _check_required_fields_for_doc(self, doc: Document, 
                                        rule: ValidationRule) -> List[Issue]:
        issues = []
        fields = rule.conditions.get("fields", ["currency", "tax_rate"])
        
        if "currency" in fields and not doc.currency:
            issues.append(self._create_issue(
                issue_type=IssueType.MISSING_CURRENCY,
                severity=rule.severity,
                description=f"单据 {doc.doc_id} 缺少币种信息",
                primary_doc=doc
            ))
        
        if "tax_rate" in fields and doc.tax_rate is None:
            issues.append(self._create_issue(
                issue_type=IssueType.MISSING_TAX_RATE,
                severity=rule.severity,
                description=f"单据 {doc.doc_id} 缺少税率信息",
                primary_doc=doc
            ))
        
        return issues

    def _create_issue(self,
                       issue_type: IssueType,
                       severity: IssueSeverity,
                       description: str,
                       primary_doc: Optional[Document] = None,
                       related_docs: Optional[List[Document]] = None,
                       expected: Optional[Any] = None,
                       actual: Optional[Any] = None,
                       difference: Optional[Any] = None) -> Issue:
        issue_id = str(uuid.uuid4())[:8]
        
        primary_doc_id = primary_doc.doc_id if primary_doc else ""
        primary_doc_type = primary_doc.doc_type if primary_doc else DocumentType.INVOICE
        
        related_doc_ids = []
        related_doc_types = []
        
        if related_docs:
            for doc in related_docs:
                if doc != primary_doc:
                    related_doc_ids.append(doc.doc_id)
                    related_doc_types.append(doc.doc_type)
        
        return Issue(
            issue_id=issue_id,
            issue_type=issue_type,
            severity=severity,
            description=description,
            primary_doc_id=primary_doc_id,
            primary_doc_type=primary_doc_type,
            related_doc_ids=related_doc_ids,
            related_doc_types=related_doc_types,
            expected_value=expected,
            actual_value=actual,
            difference=difference,
        )
