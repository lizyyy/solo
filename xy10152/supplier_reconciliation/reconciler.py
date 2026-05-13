from datetime import date, datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from dataclasses import dataclass
from .models import Document, DocumentType, ReconciliationItem, ReconciliationStatus, ReconciliationRun


@dataclass
class MatchableItem:
    document: Document
    remaining: float


class Reconciler:
    def __init__(self, tolerance: float = 0.01, match_by_reference: bool = True):
        self.tolerance = tolerance
        self.match_by_reference = match_by_reference
    
    def _amount_equal(self, a: float, b: float) -> bool:
        return abs(a - b) <= self.tolerance
    
    def _get_period(self, d: date, period_type: str = "month") -> str:
        if period_type == "month":
            return f"{d.year}-{d.month:02d}"
        elif period_type == "quarter":
            quarter = (d.month - 1) // 3 + 1
            return f"{d.year}-Q{quarter}"
        else:
            return str(d.year)
    
    def _get_aging_days(self, doc: Document, as_of_date: Optional[date] = None) -> int:
        if as_of_date is None:
            as_of_date = date.today()
        
        effective_date = doc.due_date if doc.due_date else doc.doc_date
        return (as_of_date - effective_date).days
    
    def _group_by_supplier(self, documents: List[Document]) -> Dict[str, List[Document]]:
        groups = defaultdict(list)
        for doc in documents:
            if doc.is_valid and not doc.metadata.get("is_duplicate", False):
                groups[doc.supplier_id].append(doc)
        return dict(groups)
    
    def _match_grn_invoice(self, grns: List[Document], invoices: List[Document]) -> List[Tuple[Document, Document, float]]:
        matches = []
        matched_grns = set()
        matched_invoices = set()
        
        for grn in grns:
            for inv in invoices:
                if grn.key in matched_grns or inv.key in matched_invoices:
                    continue
                
                ref_match = False
                if grn.reference and grn.reference == inv.doc_number:
                    ref_match = True
                elif inv.reference and inv.reference == grn.doc_number:
                    ref_match = True
                
                if ref_match or self._amount_equal(grn.amount, inv.amount):
                    match_amount = min(grn.amount, inv.amount)
                    matches.append((grn, inv, match_amount))
                    matched_grns.add(grn.key)
                    matched_invoices.add(inv.key)
                    break
        
        return matches
    
    def _match_invoice_payment_by_ref(self, invoices: List[Document], payments: List[Document]) -> List[Tuple[Document, Document, float]]:
        matches = []
        used_payments = set()
        matched_invoices = set()
        
        for inv in invoices:
            for pay in payments:
                if pay.key in used_payments or inv.key in matched_invoices:
                    continue
                
                ref_match = False
                if pay.reference and pay.reference == inv.doc_number:
                    ref_match = True
                elif inv.reference and inv.reference == pay.doc_number:
                    ref_match = True
                
                if ref_match:
                    match_amount = min(inv.amount, pay.amount)
                    matches.append((inv, pay, match_amount))
                    used_payments.add(pay.key)
                    matched_invoices.add(inv.key)
                    break
        
        return matches
    
    def _match_invoice_payment_by_amount(self, invoices: List[Document], payments: List[Document]) -> List[Tuple[Document, Document, float]]:
        matches = []
        used_payments = set()
        matched_invoices = set()
        
        for inv in invoices:
            if inv.key in matched_invoices:
                continue
            for pay in payments:
                if pay.key in used_payments:
                    continue
                
                if self._amount_equal(inv.amount, pay.amount):
                    matches.append((inv, pay, inv.amount))
                    used_payments.add(pay.key)
                    matched_invoices.add(inv.key)
                    break
        
        return matches
    
    def _match_partial_with_remaining(self, invoices: List[Document], payments: List[Document]) -> List[Tuple[Document, Document, float]]:
        matches = []
        
        inv_remaining = {inv.key: inv.amount for inv in invoices}
        pay_remaining = {pay.key: pay.amount for pay in payments}
        
        for inv in invoices:
            if inv_remaining[inv.key] <= self.tolerance:
                continue
            
            for pay in payments:
                if pay_remaining[pay.key] <= self.tolerance:
                    continue
                
                match_amount = min(inv_remaining[inv.key], pay_remaining[pay.key])
                if match_amount > self.tolerance:
                    matches.append((inv, pay, match_amount))
                    inv_remaining[inv.key] -= match_amount
                    pay_remaining[pay.key] -= match_amount
                
                if inv_remaining[inv.key] <= self.tolerance:
                    break
        
        return matches
    
    def _identify_discrepancies(self, item: ReconciliationItem) -> List[str]:
        discrepancies = []
        doc = item.document
        
        if item.status == ReconciliationStatus.UNMATCHED:
            if doc.doc_type == DocumentType.INVOICE:
                if item.aging_days > 90:
                    discrepancies.append("发票超期90天未付款")
                else:
                    discrepancies.append("发票无对应付款记录")
            elif doc.doc_type == DocumentType.PAYMENT:
                discrepancies.append("付款无对应发票记录")
            elif doc.doc_type == DocumentType.GRN:
                discrepancies.append("收货单无对应发票记录")
        
        elif item.status == ReconciliationStatus.PARTIAL:
            discrepancies.append(f"部分匹配，剩余金额: {item.remaining_amount:.2f}")
        
        if doc.metadata.get("is_duplicate", False):
            discrepancies.append("检测为重复凭证")
        
        if not doc.is_valid:
            discrepancies.extend(doc.validation_errors)
        
        return discrepancies
    
    def reconcile(self, documents: List[Document], 
                  period_type: str = "month",
                  as_of_date: Optional[date] = None,
                  rolling_periods: int = 3) -> ReconciliationRun:
        
        run_id = f"RECON-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        run_date = datetime.now()
        
        if as_of_date is None:
            as_of_date = date.today()
        
        period = self._get_period(as_of_date, period_type)
        
        results: List[ReconciliationItem] = []
        supplier_groups = self._group_by_supplier(documents)
        
        for supplier_id, supplier_docs in supplier_groups.items():
            invoices = [d for d in supplier_docs if d.doc_type == DocumentType.INVOICE]
            payments = [d for d in supplier_docs if d.doc_type == DocumentType.PAYMENT]
            grns = [d for d in supplier_docs if d.doc_type == DocumentType.GRN]
            
            matched_inv = defaultdict(lambda: {"amount": 0.0, "docs": [], "grn_matched": False})
            matched_pay = defaultdict(lambda: {"amount": 0.0, "docs": []})
            matched_grn = defaultdict(lambda: {"amount": 0.0, "docs": []})
            
            grn_invoice_matches = self._match_grn_invoice(grns, invoices)
            for grn, inv, amount in grn_invoice_matches:
                matched_grn[grn.key]["amount"] += amount
                matched_grn[grn.key]["docs"].append(inv.key)
                matched_inv[inv.key]["amount"] += amount
                matched_inv[inv.key]["docs"].append(grn.key)
                matched_inv[inv.key]["grn_matched"] = True
            
            inv_pay_by_ref = self._match_invoice_payment_by_ref(
                [i for i in invoices],
                [p for p in payments]
            )
            
            matched_inv_keys_ref = {m[0].key for m in inv_pay_by_ref}
            matched_pay_keys_ref = {m[1].key for m in inv_pay_by_ref}
            
            remaining_invoices_after_ref = [i for i in invoices if i.key not in matched_inv_keys_ref]
            remaining_payments_after_ref = [p for p in payments if p.key not in matched_pay_keys_ref]
            
            inv_pay_by_amount = self._match_invoice_payment_by_amount(
                remaining_invoices_after_ref,
                remaining_payments_after_ref
            )
            
            matched_inv_keys_amount = {m[0].key for m in inv_pay_by_amount}
            matched_pay_keys_amount = {m[1].key for m in inv_pay_by_amount}
            
            remaining_invoices_after_amount = [i for i in remaining_invoices_after_ref if i.key not in matched_inv_keys_amount]
            remaining_payments_after_amount = [p for p in remaining_payments_after_ref if p.key not in matched_pay_keys_amount]
            
            inv_pay_partial = self._match_partial_with_remaining(
                remaining_invoices_after_amount,
                remaining_payments_after_amount
            )
            
            all_inv_pay_matches = inv_pay_by_ref + inv_pay_by_amount + inv_pay_partial
            
            for inv, pay, amount in all_inv_pay_matches:
                matched_inv[inv.key]["amount"] += amount
                matched_inv[inv.key]["docs"].append(pay.key)
                matched_pay[pay.key]["amount"] += amount
                matched_pay[pay.key]["docs"].append(inv.key)
            
            for doc in supplier_docs:
                item = ReconciliationItem(
                    document=doc,
                    period=self._get_period(doc.doc_date, period_type),
                    aging_days=self._get_aging_days(doc, as_of_date)
                )
                
                if doc.doc_type == DocumentType.INVOICE:
                    if doc.key in matched_inv:
                        inv_match = matched_inv[doc.key]
                        grn_match_amount = 0.0
                        payment_match_amount = 0.0
                        
                        for other_key in inv_match["docs"]:
                            if other_key.startswith("grn:"):
                                continue
                            else:
                                payment_match_amount = inv_match["amount"]
                                break
                        
                        invoice_total = 0.0
                        for m in all_inv_pay_matches:
                            if m[0].key == doc.key:
                                invoice_total += m[2]
                        
                        item.matched_amount = invoice_total
                        item.matched_documents = [
                            k for k in inv_match["docs"] if not k.startswith("grn:")
                        ]
                elif doc.doc_type == DocumentType.PAYMENT:
                    if doc.key in matched_pay:
                        item.matched_amount = matched_pay[doc.key]["amount"]
                        item.matched_documents = matched_pay[doc.key]["docs"]
                elif doc.doc_type == DocumentType.GRN:
                    if doc.key in matched_grn:
                        item.matched_amount = matched_grn[doc.key]["amount"]
                        item.matched_documents = matched_grn[doc.key]["docs"]
                
                if self._amount_equal(item.matched_amount, doc.amount):
                    item.status = ReconciliationStatus.MATCHED
                elif item.matched_amount > self.tolerance:
                    item.status = ReconciliationStatus.PARTIAL
                else:
                    item.status = ReconciliationStatus.UNMATCHED
                
                if doc.metadata.get("is_duplicate", False):
                    item.status = ReconciliationStatus.DUPLICATE
                elif not doc.is_valid:
                    item.status = ReconciliationStatus.INVALID
                
                discrepancies = self._identify_discrepancies(item)
                if discrepancies:
                    doc.metadata["discrepancies"] = discrepancies
                
                results.append(item)
        
        invalid_docs = [d for d in documents if not d.is_valid]
        for doc in invalid_docs:
            if not any(r.document.key == doc.key for r in results):
                item = ReconciliationItem(
                    document=doc,
                    status=ReconciliationStatus.INVALID,
                    period=self._get_period(doc.doc_date, period_type),
                    aging_days=self._get_aging_days(doc, as_of_date)
                )
                results.append(item)
        
        summary = self._generate_summary(results, documents)
        
        run = ReconciliationRun(
            run_id=run_id,
            run_date=run_date,
            period=period,
            documents=documents,
            results=results,
            summary=summary
        )
        
        return run
    
    def _generate_summary(self, results: List[ReconciliationItem], 
                         documents: List[Document]) -> Dict:
        summary = {
            "total_documents": len(documents),
            "valid_documents": len([d for d in documents if d.is_valid]),
            "invalid_documents": len([d for d in documents if not d.is_valid]),
            "by_type": defaultdict(lambda: {"count": 0, "amount": 0.0}),
            "by_status": defaultdict(lambda: {"count": 0, "amount": 0.0}),
            "by_supplier": defaultdict(lambda: {"count": 0, "amount": 0.0, "matched": 0.0}),
        }
        
        for doc in documents:
            summary["by_type"][doc.doc_type.value]["count"] += 1
            summary["by_type"][doc.doc_type.value]["amount"] += doc.amount
        
        for item in results:
            status = item.status.value
            summary["by_status"][status]["count"] += 1
            summary["by_status"][status]["amount"] += item.document.amount
            
            supplier_id = item.document.supplier_id
            summary["by_supplier"][supplier_id]["count"] += 1
            summary["by_supplier"][supplier_id]["amount"] += item.document.amount
            summary["by_supplier"][supplier_id]["matched"] += item.matched_amount
        
        total_amount = sum(d.amount for d in documents if d.is_valid)
        matched_amount = sum(r.matched_amount for r in results if r.status in [
            ReconciliationStatus.MATCHED, ReconciliationStatus.PARTIAL
        ])
        
        summary["total_amount"] = total_amount
        summary["matched_amount"] = matched_amount
        summary["match_rate"] = matched_amount / total_amount if total_amount > 0 else 0.0
        
        return dict(summary)
