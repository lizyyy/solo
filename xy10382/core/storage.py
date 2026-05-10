import json
import os
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from models import Farmer, Sale, Payment, ReturnItem, Deduction


class DataStorage:
    def __init__(self, data_dir: str = 'data'):
        self.data_dir = data_dir
        self._ensure_dir()
        self._files = {
            'farmers': os.path.join(data_dir, 'farmers.json'),
            'sales': os.path.join(data_dir, 'sales.json'),
            'payments': os.path.join(data_dir, 'payments.json'),
            'returns': os.path.join(data_dir, 'returns.json'),
            'deductions': os.path.join(data_dir, 'deductions.json'),
        }
        self._init_files()

    def _ensure_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def _init_files(self):
        for file_path in self._files.values():
            if not os.path.exists(file_path):
                self._write_json(file_path, [])

    def _read_json(self, file_path: str) -> List[dict]:
        if not os.path.exists(file_path):
            return []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                if not content.strip():
                    return []
                return json.loads(content)
        except json.JSONDecodeError:
            return []

    def _write_json(self, file_path: str, data: List[dict]):
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add_farmer(self, farmer: Farmer) -> Farmer:
        data = self._read_json(self._files['farmers'])
        existing = next((f for f in data if f['id'] == farmer.id), None)
        if not existing:
            data.append(farmer.to_dict())
            self._write_json(self._files['farmers'], data)
        return farmer

    def get_farmers(self) -> List[Farmer]:
        data = self._read_json(self._files['farmers'])
        return [Farmer.from_dict(f) for f in data]

    def get_farmer_by_id(self, farmer_id: str) -> Optional[Farmer]:
        farmers = self.get_farmers()
        return next((f for f in farmers if f.id == farmer_id), None)

    def get_farmer_by_name(self, name: str) -> Optional[Farmer]:
        farmers = self.get_farmers()
        return next((f for f in farmers if f.name == name), None)

    def add_sale(self, sale: Sale) -> Sale:
        data = self._read_json(self._files['sales'])
        existing = next((s for s in data if s['id'] == sale.id), None)
        if not existing:
            data.append(sale.to_dict())
            self._write_json(self._files['sales'], data)
        return sale

    def get_sales(self) -> List[Sale]:
        data = self._read_json(self._files['sales'])
        return [Sale.from_dict(s) for s in data]

    def get_sales_by_farmer(self, farmer_id: str) -> List[Sale]:
        sales = self.get_sales()
        return [s for s in sales if s.farmer_id == farmer_id]

    def get_sale_by_id(self, sale_id: str) -> Optional[Sale]:
        sales = self.get_sales()
        return next((s for s in sales if s.id == sale_id), None)

    def add_payment(self, payment: Payment) -> Payment:
        data = self._read_json(self._files['payments'])
        existing = next((p for p in data if p['id'] == payment.id), None)
        if not existing:
            data.append(payment.to_dict())
            self._write_json(self._files['payments'], data)
        return payment

    def get_payments(self) -> List[Payment]:
        data = self._read_json(self._files['payments'])
        return [Payment.from_dict(p) for p in data]

    def get_payments_by_farmer(self, farmer_id: str) -> List[Payment]:
        payments = self.get_payments()
        return [p for p in payments if p.farmer_id == farmer_id]

    def get_payment_by_receipt(self, receipt_no: str) -> Optional[Payment]:
        if not receipt_no:
            return None
        payments = self.get_payments()
        return next((p for p in payments if p.receipt_no == receipt_no), None)

    def add_return(self, return_item: ReturnItem) -> ReturnItem:
        data = self._read_json(self._files['returns'])
        existing = next((r for r in data if r['id'] == return_item.id), None)
        if not existing:
            data.append(return_item.to_dict())
            self._write_json(self._files['returns'], data)
        return return_item

    def get_returns(self) -> List[ReturnItem]:
        data = self._read_json(self._files['returns'])
        return [ReturnItem.from_dict(r) for r in data]

    def get_returns_by_farmer(self, farmer_id: str) -> List[ReturnItem]:
        returns = self.get_returns()
        return [r for r in returns if r.farmer_id == farmer_id]

    def get_returns_by_sale(self, sale_id: str) -> List[ReturnItem]:
        returns = self.get_returns()
        return [r for r in returns if r.sale_id == sale_id]

    def add_deduction(self, deduction: Deduction) -> Deduction:
        data = self._read_json(self._files['deductions'])
        existing = next((d for d in data if d['id'] == deduction.id), None)
        if not existing:
            data.append(deduction.to_dict())
            self._write_json(self._files['deductions'], data)
        return deduction

    def get_deductions(self) -> List[Deduction]:
        data = self._read_json(self._files['deductions'])
        return [Deduction.from_dict(d) for d in data]

    def get_deductions_by_farmer(self, farmer_id: str) -> List[Deduction]:
        deductions = self.get_deductions()
        return [d for d in deductions if d.farmer_id == farmer_id]
