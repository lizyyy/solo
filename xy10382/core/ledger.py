from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import date

from models import Farmer, Sale, Payment, ReturnItem, Deduction
from core.overdue import OverdueCalculator, OverdueInfo


@dataclass
class LedgerEntry:
    date: str
    type: str
    description: str
    debit: float
    credit: float
    balance: float
    ref_id: str
    remark: str = ''


@dataclass
class SaleSettlement:
    sale: Sale
    total_amount: float
    returned_amount: float
    deducted_amount: float
    paid_amount: float
    balance: float
    overdue_info: Optional[OverdueInfo]


@dataclass
class FarmerLedger:
    farmer: Farmer
    total_sales: float
    total_payments: float
    total_returns: float
    total_deductions: float
    total_balance: float
    sale_settlements: List[SaleSettlement]
    ledger_entries: List[LedgerEntry]
    overdue_info: List[OverdueInfo]


class LedgerManager:
    def __init__(self, storage):
        self.storage = storage
        self.overdue_calc = OverdueCalculator()

    def _allocate_credits_to_sales(self, farmer_id: str) -> Dict[str, dict]:
        sales = self.storage.get_sales_by_farmer(farmer_id)
        payments = self.storage.get_payments_by_farmer(farmer_id)
        returns = self.storage.get_returns_by_farmer(farmer_id)
        deductions = self.storage.get_deductions_by_farmer(farmer_id)

        sorted_sales = sorted(sales, key=lambda s: s.sale_date)
        sorted_payments = sorted(payments, key=lambda p: p.payment_date)
        sorted_returns = sorted(returns, key=lambda r: r.return_date)
        sorted_deductions = sorted(deductions, key=lambda d: d.deduction_date)

        allocation = {}
        for sale in sorted_sales:
            allocation[sale.id] = {
                'returned_amount': 0.0,
                'paid_amount': 0.0,
                'deducted_amount': 0.0
            }

        for return_item in sorted_returns:
            sale_id = return_item.sale_id
            if sale_id in allocation:
                allocation[sale_id]['returned_amount'] += return_item.amount

        total_returned = sum(a['returned_amount'] for a in allocation.values())
        total_deductions = sum(d.amount for d in sorted_deductions)
        total_payments = sum(p.amount for p in sorted_payments)

        remaining_deductions = total_deductions
        for sale in sorted_sales:
            if remaining_deductions <= 0:
                break
            sale_balance = sale.total_amount - allocation[sale.id]['returned_amount']
            if sale_balance <= 0:
                continue
            use_amount = min(remaining_deductions, sale_balance)
            allocation[sale.id]['deducted_amount'] += use_amount
            remaining_deductions -= use_amount

        remaining_payments = total_payments
        for sale in sorted_sales:
            if remaining_payments <= 0:
                break
            sale_balance = sale.total_amount - allocation[sale.id]['returned_amount'] - allocation[sale.id]['deducted_amount']
            if sale_balance <= 0:
                continue
            use_amount = min(remaining_payments, sale_balance)
            allocation[sale.id]['paid_amount'] += use_amount
            remaining_payments -= use_amount

        return allocation

    def get_farmer_ledger(self, farmer_id: str) -> Optional[FarmerLedger]:
        farmer = self.storage.get_farmer_by_id(farmer_id)
        if not farmer:
            return None

        sales = self.storage.get_sales_by_farmer(farmer_id)
        payments = self.storage.get_payments_by_farmer(farmer_id)
        returns = self.storage.get_returns_by_farmer(farmer_id)
        deductions = self.storage.get_deductions_by_farmer(farmer_id)

        total_sales = sum(s.total_amount for s in sales)
        total_payments = sum(p.amount for p in payments)
        total_returns = sum(r.amount for r in returns)
        total_deductions = sum(d.amount for d in deductions)

        total_balance = total_sales - total_returns - total_payments - total_deductions

        allocation = self._allocate_credits_to_sales(farmer_id)

        sale_settlements = []
        sorted_sales = sorted(sales, key=lambda s: s.sale_date)
        for sale in sorted_sales:
            alloc = allocation[sale.id]
            paid_amount = alloc['paid_amount'] + alloc['deducted_amount']
            balance = max(0.0, sale.total_amount - alloc['returned_amount'] - paid_amount)

            total_paid_with_return = alloc['returned_amount'] + paid_amount
            overdue_info = self.overdue_calc.calculate_overdue(sale, total_paid_with_return)

            sale_settlements.append(SaleSettlement(
                sale=sale,
                total_amount=sale.total_amount,
                returned_amount=alloc['returned_amount'],
                deducted_amount=alloc['deducted_amount'],
                paid_amount=alloc['paid_amount'],
                balance=balance,
                overdue_info=overdue_info
            ))

        ledger_entries = self._build_ledger_entries(sales, payments, returns, deductions)

        overdue_info = []
        for settlement in sale_settlements:
            if settlement.overdue_info:
                overdue_info.append(settlement.overdue_info)

        return FarmerLedger(
            farmer=farmer,
            total_sales=total_sales,
            total_payments=total_payments,
            total_returns=total_returns,
            total_deductions=total_deductions,
            total_balance=total_balance,
            sale_settlements=sale_settlements,
            ledger_entries=ledger_entries,
            overdue_info=overdue_info
        )

    def _build_ledger_entries(self, sales, payments, returns, deductions) -> List[LedgerEntry]:
        entries = []

        for sale in sales:
            items_desc = ', '.join([f'{item.product_name}×{item.quantity}{item.unit}' for item in sale.items])
            entries.append(LedgerEntry(
                date=sale.sale_date,
                type='赊销',
                description=f'赊销商品: {items_desc}',
                debit=sale.total_amount,
                credit=0.0,
                balance=0.0,
                ref_id=sale.id,
                remark=sale.remark
            ))

        for payment in payments:
            receipt_str = f' (收据: {payment.receipt_no})' if payment.receipt_no else ''
            entries.append(LedgerEntry(
                date=payment.payment_date,
                type='回款',
                description=f'{payment.payment_method}回款{receipt_str}',
                debit=0.0,
                credit=payment.amount,
                balance=0.0,
                ref_id=payment.id,
                remark=payment.remark
            ))

        for return_item in returns:
            entries.append(LedgerEntry(
                date=return_item.return_date,
                type='退货',
                description=f'退货: {return_item.product_name}×{return_item.quantity}',
                debit=0.0,
                credit=return_item.amount,
                balance=0.0,
                ref_id=return_item.id,
                remark=return_item.reason
            ))

        for deduction in deductions:
            entries.append(LedgerEntry(
                date=deduction.deduction_date,
                type='抵扣',
                description=f'抵扣: {deduction.reason} (凭证: {deduction.evidence})',
                debit=0.0,
                credit=deduction.amount,
                balance=0.0,
                ref_id=deduction.id,
                remark=deduction.remark
            ))

        entries.sort(key=lambda e: (e.date, {'赊销': 0, '退货': 1, '回款': 2, '抵扣': 3}[e.type]))

        balance = 0.0
        for entry in entries:
            balance += entry.debit - entry.credit
            entry.balance = balance

        return entries

    def get_all_farmers_ledgers(self) -> Dict[str, FarmerLedger]:
        farmers = self.storage.get_farmers()
        result = {}
        for farmer in farmers:
            ledger = self.get_farmer_ledger(farmer.id)
            if ledger:
                result[farmer.id] = ledger
        return result

    def get_collection_list(self) -> List[dict]:
        ledgers = self.get_all_farmers_ledgers()
        collection_list = []

        for farmer_id, ledger in ledgers.items():
            if ledger.total_balance <= 0:
                continue

            overdue_count = len(ledger.overdue_info)
            total_overdue = sum(o.overdue_amount for o in ledger.overdue_info)
            has_cross_season = any(o.cross_season for o in ledger.overdue_info)
            max_days = max([o.days_overdue for o in ledger.overdue_info]) if ledger.overdue_info else 0

            collection_list.append({
                'farmer_id': farmer_id,
                'farmer_name': ledger.farmer.name,
                'phone': ledger.farmer.phone,
                'village': ledger.farmer.village,
                'total_balance': ledger.total_balance,
                'overdue_count': overdue_count,
                'total_overdue': total_overdue,
                'max_days_overdue': max_days,
                'has_cross_season': has_cross_season,
                'overdue_sales': ledger.overdue_info
            })

        collection_list.sort(key=lambda x: (-x['max_days_overdue'], -x['total_balance']))
        return collection_list
