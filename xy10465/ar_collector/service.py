import csv
import os
import uuid
from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from .models import (
    Customer,
    CustomerTier,
    Receivable,
    CollectionLog,
    CollectionStatus,
    Promise,
    Payment,
    TieredReceivable,
)
from .storage import Storage


class ValidationError(Exception):
    pass


class CollectorService:
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def _generate_id(self, prefix: str = "") -> str:
        return f"{prefix}{uuid.uuid4().hex[:8]}"
    
    def calculate_priority(self, receivable: Receivable, customer: Optional[Customer]) -> Tuple[int, str]:
        score = 0
        
        if receivable.balance <= 0:
            return 0, "已结清"
        
        if receivable.is_disputed:
            return 100, "争议"
        
        overdue = receivable.overdue_days
        balance = receivable.balance
        
        if overdue > 90:
            score += 40
        elif overdue > 60:
            score += 30
        elif overdue > 30:
            score += 20
        elif overdue > 0:
            score += 10
        else:
            score += 0
        
        if balance > 50000:
            score += 30
        elif balance > 20000:
            score += 20
        elif balance > 10000:
            score += 10
        else:
            score += 0
        
        if customer:
            if customer.tier == CustomerTier.D:
                score += 20
            elif customer.tier == CustomerTier.C:
                score += 15
            elif customer.tier == CustomerTier.B:
                score += 5
            else:
                score += 0
        
        if receivable.status == CollectionStatus.NO_CONTACT:
            score += 15
        elif receivable.status == CollectionStatus.CONTACTED:
            score += 5
        elif receivable.status == CollectionStatus.PROMISED:
            score += 0
        
        if score >= 80:
            level = "紧急"
        elif score >= 50:
            level = "高"
        elif score >= 30:
            level = "中"
        else:
            level = "低"
        
        return score, level
    
    def get_tiered_receivables(self) -> Dict[str, List[TieredReceivable]]:
        customers = {c.customer_id: c for c in self.storage.list_customers()}
        receivables = self.storage.list_receivables()
        logs = self.storage.list_collection_logs()
        promises = self.storage.list_promises()
        
        logs_by_invoice: Dict[str, List[CollectionLog]] = {}
        for log in logs:
            if log.invoice_no not in logs_by_invoice:
                logs_by_invoice[log.invoice_no] = []
            logs_by_invoice[log.invoice_no].append(log)
        
        active_promises: Dict[str, Promise] = {}
        for p in promises:
            if not p.is_fulfilled and p.invoice_no not in active_promises:
                active_promises[p.invoice_no] = p
        
        tiered: Dict[str, List[TieredReceivable]] = {
            "紧急": [],
            "高": [],
            "中": [],
            "低": [],
            "争议": [],
            "已结清": [],
        }
        
        for rec in receivables:
            customer = customers.get(rec.customer_id)
            score, level = self.calculate_priority(rec, customer)
            tr = TieredReceivable(
                receivable=rec,
                customer=customer,
                priority_score=score,
                priority_level=level,
                collection_logs=logs_by_invoice.get(rec.invoice_no, []),
                active_promise=active_promises.get(rec.invoice_no),
            )
            tiered[level].append(tr)
        
        for level in tiered:
            if level == "争议":
                tiered[level].sort(key=lambda x: (
                    x.receivable.dispute_date or date.min,
                    -x.receivable.balance,
                ))
            elif level == "已结清":
                tiered[level].sort(key=lambda x: x.receivable.invoice_no)
            else:
                tiered[level].sort(key=lambda x: (-x.priority_score, -x.receivable.balance))
        
        return tiered
    
    def get_missed_promises(self) -> List[Tuple[Promise, Receivable, Optional[Customer]]]:
        customers = {c.customer_id: c for c in self.storage.list_customers()}
        receivables = {r.invoice_no: r for r in self.storage.list_receivables()}
        missed = []
        
        for p in self.storage.list_promises():
            if p.is_missed:
                rec = receivables.get(p.invoice_no)
                if rec:
                    customer = customers.get(rec.customer_id)
                    missed.append((p, rec, customer))
        
        missed.sort(key=lambda x: (-x[0].days_overdue, -x[1].balance))
        return missed
    
    def get_weekly_report(self) -> Dict[str, Any]:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        
        payments_this_week = []
        collections_this_week = []
        
        for p in self.storage.list_payments():
            if week_start <= p.payment_date <= week_end:
                payments_this_week.append(p)
        
        for log in self.storage.list_collection_logs():
            if week_start <= log.contact_date <= week_end:
                collections_this_week.append(log)
        
        total_paid = sum(p.amount for p in payments_this_week)
        total_receivables = sum(r.balance for r in self.storage.list_receivables() if r.balance > 0)
        overdue_receivables = [r for r in self.storage.list_receivables() if r.is_overdue and r.balance > 0]
        disputed_receivables = [r for r in self.storage.list_receivables() if r.is_disputed]
        
        customers = {c.customer_id: c for c in self.storage.list_customers()}
        
        payment_details = []
        for p in payments_this_week:
            rec = self.storage.get_receivable(p.invoice_no)
            customer = customers.get(rec.customer_id) if rec else None
            payment_details.append({
                "payment": p,
                "receivable": rec,
                "customer": customer,
            })
        payment_details.sort(key=lambda x: x["payment"].payment_date, reverse=True)
        
        return {
            "week_start": week_start,
            "week_end": week_end,
            "total_paid": total_paid,
            "payment_count": len(payments_this_week),
            "payment_details": payment_details,
            "collection_count": len(collections_this_week),
            "total_receivables": total_receivables,
            "overdue_count": len(overdue_receivables),
            "overdue_amount": sum(r.balance for r in overdue_receivables),
            "disputed_count": len(disputed_receivables),
            "disputed_amount": sum(r.balance for r in disputed_receivables),
        }
    
    def validate_promise_date(self, promise_date: date, contact_date: date) -> None:
        if promise_date < contact_date:
            raise ValidationError(
                f"承诺付款日期 ({promise_date}) 不能早于催款日期 ({contact_date})"
            )
    
    def validate_payment_amount(self, invoice_no: str, amount: float) -> None:
        rec = self.storage.get_receivable(invoice_no)
        if not rec:
            raise ValidationError(f"发票 {invoice_no} 不存在")
        if amount > rec.balance:
            raise ValidationError(
                f"回款金额 ({amount}) 超过应收余额 ({rec.balance})"
            )
    
    def validate_dispute_closure(self, invoice_no: str) -> None:
        rec = self.storage.get_receivable(invoice_no)
        if not rec:
            raise ValidationError(f"发票 {invoice_no} 不存在")
        if rec.status == CollectionStatus.DISPUTED and not rec.dispute_resolved:
            raise ValidationError(
                f"发票 {invoice_no} 存在未解除的争议，无法关闭"
            )
    
    def import_customers_from_csv(self, csv_path: str) -> Tuple[int, List[str]]:
        if not os.path.exists(csv_path):
            raise ValidationError(f"文件不存在: {csv_path}")
        
        added = 0
        skipped = []
        
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    customer = Customer(
                        customer_id=row["customer_id"].strip(),
                        name=row["name"].strip(),
                        tier=CustomerTier(row["tier"].strip().upper()),
                        credit_limit=float(row["credit_limit"]),
                        contact_person=row.get("contact_person", "").strip() or None,
                        phone=row.get("phone", "").strip() or None,
                        email=row.get("email", "").strip() or None,
                    )
                    if self.storage.save_customer(customer):
                        added += 1
                    else:
                        skipped.append(f"客户已存在: {customer.customer_id}")
                except Exception as e:
                    skipped.append(f"行错误: {str(e)}")
        
        return added, skipped
    
    def import_receivables_from_csv(self, csv_path: str) -> Tuple[int, List[str]]:
        if not os.path.exists(csv_path):
            raise ValidationError(f"文件不存在: {csv_path}")
        
        added = 0
        skipped = []
        
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    receivable = Receivable(
                        invoice_no=row["invoice_no"].strip(),
                        customer_id=row["customer_id"].strip(),
                        invoice_date=date.fromisoformat(row["invoice_date"].strip()),
                        due_date=date.fromisoformat(row["due_date"].strip()),
                        amount=float(row["amount"]),
                        paid_amount=float(row.get("paid_amount", 0)),
                    )
                    if self.storage.save_receivable(receivable):
                        added += 1
                    else:
                        skipped.append(f"发票已存在: {receivable.invoice_no}")
                except Exception as e:
                    skipped.append(f"行错误: {str(e)}")
        
        return added, skipped
    
    def import_collection_logs_from_csv(self, csv_path: str) -> Tuple[int, List[str]]:
        if not os.path.exists(csv_path):
            raise ValidationError(f"文件不存在: {csv_path}")
        
        added = 0
        skipped = []
        
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    log_id = row.get("log_id", "").strip() or self._generate_id("LOG")
                    log = CollectionLog(
                        log_id=log_id,
                        invoice_no=row["invoice_no"].strip(),
                        contact_date=date.fromisoformat(row["contact_date"].strip()),
                        contact_method=row["contact_method"].strip(),
                        contact_result=row["contact_result"].strip(),
                        notes=row.get("notes", "").strip() or None,
                    )
                    
                    rec = self.storage.get_receivable(log.invoice_no)
                    if not rec:
                        skipped.append(f"发票不存在: {log.invoice_no}")
                        continue
                    
                    if "promised_date" in row and row["promised_date"].strip():
                        promised_date = date.fromisoformat(row["promised_date"].strip())
                        self.validate_promise_date(promised_date, log.contact_date)
                        promise = Promise(
                            promise_id=self._generate_id("PRM"),
                            invoice_no=log.invoice_no,
                            promise_date=log.contact_date,
                            promised_payment_date=promised_date,
                            promised_amount=float(row.get("promised_amount", rec.balance)),
                            notes=row.get("promise_notes", "").strip() or None,
                        )
                        self.storage.save_promise(promise)
                        rec.status = CollectionStatus.PROMISED
                        self.storage.update_receivable(rec)
                    else:
                        rec.status = CollectionStatus.CONTACTED
                        self.storage.update_receivable(rec)
                    
                    if self.storage.save_collection_log(log):
                        added += 1
                    else:
                        skipped.append(f"记录已存在: {log.log_id}")
                except ValidationError as e:
                    skipped.append(str(e))
                except Exception as e:
                    skipped.append(f"行错误: {str(e)}")
        
        return added, skipped
    
    def import_promises_from_csv(self, csv_path: str) -> Tuple[int, List[str]]:
        if not os.path.exists(csv_path):
            raise ValidationError(f"文件不存在: {csv_path}")
        
        added = 0
        skipped = []
        
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    promise_id = row.get("promise_id", "").strip() or self._generate_id("PRM")
                    promise_date = date.fromisoformat(row["promise_date"].strip())
                    promised_payment_date = date.fromisoformat(row["promised_payment_date"].strip())
                    
                    self.validate_promise_date(promised_payment_date, promise_date)
                    
                    promise = Promise(
                        promise_id=promise_id,
                        invoice_no=row["invoice_no"].strip(),
                        promise_date=promise_date,
                        promised_payment_date=promised_payment_date,
                        promised_amount=float(row["promised_amount"]),
                        notes=row.get("notes", "").strip() or None,
                    )
                    
                    rec = self.storage.get_receivable(promise.invoice_no)
                    if rec and rec.status != CollectionStatus.PROMISED:
                        rec.status = CollectionStatus.PROMISED
                        self.storage.update_receivable(rec)
                    
                    if self.storage.save_promise(promise):
                        added += 1
                    else:
                        skipped.append(f"承诺已存在: {promise.promise_id}")
                except ValidationError as e:
                    skipped.append(str(e))
                except Exception as e:
                    skipped.append(f"行错误: {str(e)}")
        
        return added, skipped
    
    def record_collection(
        self,
        invoice_no: str,
        contact_date: date,
        contact_method: str,
        contact_result: str,
        notes: Optional[str] = None,
        promised_payment_date: Optional[date] = None,
        promised_amount: Optional[float] = None,
    ) -> CollectionLog:
        rec = self.storage.get_receivable(invoice_no)
        if not rec:
            raise ValidationError(f"发票 {invoice_no} 不存在")
        if rec.balance <= 0:
            raise ValidationError(f"发票 {invoice_no} 已结清")
        if rec.is_disputed:
            raise ValidationError(f"发票 {invoice_no} 存在争议，请先解决争议")
        
        if promised_payment_date:
            self.validate_promise_date(promised_payment_date, contact_date)
            promise = Promise(
                promise_id=self._generate_id("PRM"),
                invoice_no=invoice_no,
                promise_date=contact_date,
                promised_payment_date=promised_payment_date,
                promised_amount=promised_amount or rec.balance,
                notes=notes,
            )
            self.storage.save_promise(promise)
            rec.status = CollectionStatus.PROMISED
        else:
            rec.status = CollectionStatus.CONTACTED
        
        self.storage.update_receivable(rec)
        
        log = CollectionLog(
            log_id=self._generate_id("LOG"),
            invoice_no=invoice_no,
            contact_date=contact_date,
            contact_method=contact_method,
            contact_result=contact_result,
            notes=notes,
        )
        self.storage.save_collection_log(log)
        
        return log
    
    def mark_dispute(
        self,
        invoice_no: str,
        reason: str,
        dispute_date: Optional[date] = None,
    ) -> Receivable:
        rec = self.storage.get_receivable(invoice_no)
        if not rec:
            raise ValidationError(f"发票 {invoice_no} 不存在")
        if rec.balance <= 0:
            raise ValidationError(f"发票 {invoice_no} 已结清")
        if rec.is_disputed:
            raise ValidationError(f"发票 {invoice_no} 已标记为争议")
        
        rec.status = CollectionStatus.DISPUTED
        rec.dispute_reason = reason
        rec.dispute_date = dispute_date or date.today()
        rec.dispute_resolved = False
        
        self.storage.update_receivable(rec)
        return rec
    
    def resolve_dispute(
        self,
        invoice_no: str,
        notes: Optional[str] = None,
        resolved_date: Optional[date] = None,
    ) -> Receivable:
        rec = self.storage.get_receivable(invoice_no)
        if not rec:
            raise ValidationError(f"发票 {invoice_no} 不存在")
        if not rec.is_disputed:
            raise ValidationError(f"发票 {invoice_no} 没有待解决的争议")
        
        rec.dispute_resolved = True
        rec.dispute_resolved_date = resolved_date or date.today()
        rec.status = CollectionStatus.CONTACTED
        
        self.storage.update_receivable(rec)
        return rec
    
    def record_payment(
        self,
        invoice_no: str,
        amount: float,
        payment_date: Optional[date] = None,
        notes: Optional[str] = None,
    ) -> Payment:
        self.validate_payment_amount(invoice_no, amount)
        
        rec = self.storage.get_receivable(invoice_no)
        if not rec:
            raise ValidationError(f"发票 {invoice_no} 不存在")
        
        self.validate_dispute_closure(invoice_no)
        
        rec.paid_amount += amount
        
        if rec.balance <= 0:
            rec.status = CollectionStatus.PAID
            rec.paid_amount = rec.amount
        elif rec.paid_amount > 0:
            rec.status = CollectionStatus.PARTIAL_PAID
        
        self.storage.update_receivable(rec)
        
        active_promise = self.storage.get_active_promise(invoice_no)
        if active_promise and rec.balance <= 0:
            active_promise.is_fulfilled = True
            active_promise.fulfilled_date = payment_date or date.today()
            self.storage.update_promise(active_promise)
        
        payment = Payment(
            payment_id=self._generate_id("PAY"),
            invoice_no=invoice_no,
            payment_date=payment_date or date.today(),
            amount=amount,
            notes=notes,
        )
        self.storage.save_payment(payment)
        
        return payment
    
    def get_customer_detail(self, customer_id: str) -> Optional[Dict[str, Any]]:
        customer = self.storage.get_customer(customer_id)
        if not customer:
            return None
        
        receivables = [r for r in self.storage.list_receivables() if r.customer_id == customer_id]
        total_balance = sum(r.balance for r in receivables)
        overdue_balance = sum(r.balance for r in receivables if r.is_overdue)
        
        all_logs = []
        for r in receivables:
            all_logs.extend(self.storage.list_collection_logs_by_invoice(r.invoice_no))
        
        active_promises = []
        for r in receivables:
            p = self.storage.get_active_promise(r.invoice_no)
            if p:
                active_promises.append((r, p))
        
        return {
            "customer": customer,
            "receivables": receivables,
            "total_balance": total_balance,
            "overdue_balance": overdue_balance,
            "collection_logs": all_logs,
            "active_promises": active_promises,
        }
