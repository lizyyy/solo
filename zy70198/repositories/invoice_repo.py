from datetime import date
from typing import Dict, List, Optional

from models import Invoice, InvoiceStatus


class InvoiceRepository:
    def __init__(self):
        self._invoices: Dict[str, Invoice] = {}

    def save(self, invoice: Invoice) -> None:
        self._invoices[invoice.id] = invoice

    def get_by_id(self, invoice_id: str) -> Optional[Invoice]:
        return self._invoices.get(invoice_id)

    def get_by_invoice_no(self, invoice_no: str) -> Optional[Invoice]:
        for inv in self._invoices.values():
            if inv.invoice_no == invoice_no:
                return inv
        return None

    def get_by_plan_id(self, plan_id: str) -> List[Invoice]:
        return [inv for inv in self._invoices.values() 
                if inv.matched_payment_plan_id == plan_id]

    def get_by_vendor(self, vendor_id: str) -> List[Invoice]:
        return [inv for inv in self._invoices.values() if inv.vendor_id == vendor_id]

    def get_by_purchase_order(self, po_id: str) -> List[Invoice]:
        return [inv for inv in self._invoices.values() if inv.purchase_order_id == po_id]

    def get_by_status(self, status: InvoiceStatus) -> List[Invoice]:
        return [inv for inv in self._invoices.values() if inv.status == status]

    def get_unmatched(self) -> List[Invoice]:
        return [inv for inv in self._invoices.values() 
                if inv.matched_payment_plan_id is None]

    def get_by_date_range(self, start_date: date, end_date: date) -> List[Invoice]:
        return [inv for inv in self._invoices.values() 
                if start_date <= inv.invoice_date <= end_date]

    def get_all(self) -> List[Invoice]:
        return list(self._invoices.values())

    def delete(self, invoice_id: str) -> bool:
        if invoice_id in self._invoices:
            del self._invoices[invoice_id]
            return True
        return False
