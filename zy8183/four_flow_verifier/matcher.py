import uuid
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple, Set
from collections import defaultdict

from .models import (
    Invoice, PurchaseOrderLine, Receipt, Payment,
    MatchResult, Issue, IssueType, IssueSeverity, DocumentType
)
from .rules_engine import RulesEngine


class DocumentMatcher:
    def __init__(self, rules_engine: Optional[RulesEngine] = None):
        self.rules_engine = rules_engine

    def match_all(self,
                  invoices: List[Invoice],
                  po_lines: List[PurchaseOrderLine],
                  receipts: List[Receipt],
                  payments: List[Payment]) -> Tuple[List[MatchResult], List[Issue]]:
        
        invoice_map = {inv.doc_id: inv for inv in invoices}
        po_map = {po.doc_id: po for po in po_lines}
        receipt_map = {rec.doc_id: rec for rec in receipts}
        payment_map = {pay.doc_id: pay for pay in payments}
        
        po_to_invoices = defaultdict(list)
        for inv in invoices:
            if inv.po_number:
                po_to_invoices[inv.po_number].append(inv.doc_id)
        
        po_to_po_lines = defaultdict(list)
        for po in po_lines:
            po_to_po_lines[po.po_number].append(po.doc_id)
        
        po_to_receipts = defaultdict(list)
        for rec in receipts:
            if rec.po_number:
                po_to_receipts[rec.po_number].append(rec.doc_id)
        
        invoice_to_payments = defaultdict(list)
        for pay in payments:
            if pay.invoice_number:
                invoice_to_payments[pay.invoice_number].append(pay.doc_id)
        
        all_pos = set(po_to_invoices.keys()) | set(po_to_po_lines.keys()) | set(po_to_receipts.keys())
        
        match_results = []
        all_issues = []
        
        processed_inv_ids: Set[str] = set()
        processed_po_ids: Set[str] = set()
        processed_rec_ids: Set[str] = set()
        processed_pay_ids: Set[str] = set()
        
        for po_number in all_pos:
            inv_ids = po_to_invoices.get(po_number, [])
            po_line_ids = po_to_po_lines.get(po_number, [])
            rec_ids = po_to_receipts.get(po_number, [])
            
            related_pay_ids = []
            for inv_id in inv_ids:
                related_pay_ids.extend(invoice_to_payments.get(inv_id, []))
            
            processed_inv_ids.update(inv_ids)
            processed_po_ids.update(po_line_ids)
            processed_rec_ids.update(rec_ids)
            processed_pay_ids.update(related_pay_ids)
            
            group_id = f"GRP-{po_number}"
            
            match_result = self._create_match_group(
                group_id=group_id,
                invoice_ids=inv_ids,
                po_line_ids=po_line_ids,
                receipt_ids=rec_ids,
                payment_ids=related_pay_ids,
                invoice_map=invoice_map,
                po_map=po_map,
                receipt_map=receipt_map,
                payment_map=payment_map
            )
            
            match_results.append(match_result)
            all_issues.extend(match_result.issues)
        
        unmatched_invoices = [inv for inv in invoices if inv.doc_id not in processed_inv_ids]
        unmatched_po_lines = [po for po in po_lines if po.doc_id not in processed_po_ids]
        unmatched_receipts = [rec for rec in receipts if rec.doc_id not in processed_rec_ids]
        unmatched_payments = [pay for pay in payments if pay.doc_id not in processed_pay_ids]
        
        for inv in unmatched_invoices:
            related_pay_ids = invoice_to_payments.get(inv.doc_id, [])
            processed_pay_ids.update(related_pay_ids)
            
            group_id = f"GRP-INV-{inv.doc_id}"
            match_result = self._create_match_group(
                group_id=group_id,
                invoice_ids=[inv.doc_id],
                po_line_ids=[],
                receipt_ids=[],
                payment_ids=related_pay_ids,
                invoice_map=invoice_map,
                po_map=po_map,
                receipt_map=receipt_map,
                payment_map=payment_map
            )
            match_results.append(match_result)
            all_issues.extend(match_result.issues)
        
        for po in unmatched_po_lines:
            if po.doc_id not in processed_po_ids:
                group_id = f"GRP-PO-{po.doc_id}"
                match_result = self._create_match_group(
                    group_id=group_id,
                    invoice_ids=[],
                    po_line_ids=[po.doc_id],
                    receipt_ids=[],
                    payment_ids=[],
                    invoice_map=invoice_map,
                    po_map=po_map,
                    receipt_map=receipt_map,
                    payment_map=payment_map
                )
                match_results.append(match_result)
                all_issues.extend(match_result.issues)
        
        for rec in unmatched_receipts:
            if rec.doc_id not in processed_rec_ids:
                group_id = f"GRP-REC-{rec.doc_id}"
                match_result = self._create_match_group(
                    group_id=group_id,
                    invoice_ids=[],
                    po_line_ids=[],
                    receipt_ids=[rec.doc_id],
                    payment_ids=[],
                    invoice_map=invoice_map,
                    po_map=po_map,
                    receipt_map=receipt_map,
                    payment_map=payment_map
                )
                match_results.append(match_result)
                all_issues.extend(match_result.issues)
        
        remaining_payments = [pay for pay in payments if pay.doc_id not in processed_pay_ids]
        for pay in remaining_payments:
            group_id = f"GRP-PAY-{pay.doc_id}"
            match_result = self._create_match_group(
                group_id=group_id,
                invoice_ids=[],
                po_line_ids=[],
                receipt_ids=[],
                payment_ids=[pay.doc_id],
                invoice_map=invoice_map,
                po_map=po_map,
                receipt_map=receipt_map,
                payment_map=payment_map
            )
            match_results.append(match_result)
            all_issues.extend(match_result.issues)
        
        return match_results, all_issues

    def _create_match_group(self,
                            group_id: str,
                            invoice_ids: List[str],
                            po_line_ids: List[str],
                            receipt_ids: List[str],
                            payment_ids: List[str],
                            invoice_map: Dict[str, Invoice],
                            po_map: Dict[str, PurchaseOrderLine],
                            receipt_map: Dict[str, Receipt],
                            payment_map: Dict[str, Payment]) -> MatchResult:
        
        issues = []
        
        for inv_id in invoice_ids:
            inv = invoice_map.get(inv_id)
            if inv:
                if inv.is_split:
                    issues.append(self._create_issue(
                        issue_type=IssueType.SPLIT_INVOICE,
                        severity=IssueSeverity.INFO,
                        description=f"发票 {inv.doc_id} 是拆分发票，拆分自: {inv.split_from or '未知'}",
                        primary_doc=inv
                    ))
                if inv.is_merged:
                    issues.append(self._create_issue(
                        issue_type=IssueType.MERGED_INVOICE,
                        severity=IssueSeverity.INFO,
                        description=f"发票 {inv.doc_id} 是合并发票，包含: {', '.join(inv.merged_invoices) if inv.merged_invoices else '未知'}",
                        primary_doc=inv
                    ))
        
        for pay_id in payment_ids:
            pay = payment_map.get(pay_id)
            if pay and pay.is_cross_month:
                issues.append(self._create_issue(
                    issue_type=IssueType.CROSS_MONTH_PAYMENT,
                    severity=IssueSeverity.INFO,
                    description=f"付款 {pay.doc_id} 是跨月付款",
                    primary_doc=pay
                ))
        
        doc_types_present = []
        if invoice_ids:
            doc_types_present.append("发票")
        if po_line_ids:
            doc_types_present.append("采购订单")
        if receipt_ids:
            doc_types_present.append("收货单")
        if payment_ids:
            doc_types_present.append("付款单")
        
        is_matched = False
        match_score = Decimal(0)
        
        if len(doc_types_present) >= 4:
            is_matched = True
            match_score = Decimal(100)
        elif len(doc_types_present) == 3:
            match_score = Decimal(75)
        elif len(doc_types_present) == 2:
            match_score = Decimal(50)
        else:
            match_score = Decimal(25)
        
        all_docs_present = (
            len(invoice_ids) > 0 and 
            len(po_line_ids) > 0 and 
            len(receipt_ids) > 0 and 
            len(payment_ids) > 0
        )
        
        if not all_docs_present:
            missing = []
            if not invoice_ids:
                missing.append("发票")
            if not po_line_ids:
                missing.append("采购订单")
            if not receipt_ids:
                missing.append("收货单")
            if not payment_ids:
                missing.append("付款单")
            
            primary_doc = None
            if invoice_ids:
                primary_doc = invoice_map.get(invoice_ids[0])
            elif po_line_ids:
                primary_doc = po_map.get(po_line_ids[0])
            elif receipt_ids:
                primary_doc = receipt_map.get(receipt_ids[0])
            elif payment_ids:
                primary_doc = payment_map.get(payment_ids[0])
            
            if primary_doc:
                issues.append(self._create_issue(
                    issue_type=IssueType.UNMATCHED_DOCUMENT,
                    severity=IssueSeverity.WARNING,
                    description=f"匹配组缺少单据: {', '.join(missing)}",
                    primary_doc=primary_doc
                ))
        
        if self.rules_engine:
            match_group = MatchResult(
                group_id=group_id,
                invoice_ids=invoice_ids,
                po_line_ids=po_line_ids,
                receipt_ids=receipt_ids,
                payment_ids=payment_ids,
                is_matched=is_matched,
                issues=[],
                match_score=match_score
            )
            
            rule_issues = self.rules_engine.validate_match_group(
                match_group, invoice_map, po_map, receipt_map, payment_map
            )
            issues.extend(rule_issues)
        
        return MatchResult(
            group_id=group_id,
            invoice_ids=invoice_ids,
            po_line_ids=po_line_ids,
            receipt_ids=receipt_ids,
            payment_ids=payment_ids,
            is_matched=is_matched,
            issues=issues,
            match_score=match_score
        )

    def _create_issue(self,
                       issue_type: IssueType,
                       severity: IssueSeverity,
                       description: str,
                       primary_doc=None,
                       related_docs=None) -> Issue:
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
        )
