from pathlib import Path
from typing import List, Dict, Any
import csv

from models.order import Order
from models.patient import Patient
from core.order_repository import OrderRepository
from core.patient_repository import PatientRepository


class CSVExporter:
    def __init__(self):
        self.order_repo = OrderRepository()
        self.patient_repo = PatientRepository()
    
    def export_orders(self, output_path: Path, orders: List[Order] = None) -> bool:
        if orders is None:
            orders = self.order_repo.get_all()
        
        if not orders:
            return False
        
        patient_ids = {o.patient_id for o in orders}
        patients = {}
        for pid in patient_ids:
            patient = self.patient_repo.get_by_id(pid)
            if patient:
                patients[pid] = patient
        
        rows = []
        for order in orders:
            patient = patients.get(order.patient_id)
            row = {
                "订单号": order.order_number,
                "患者姓名": patient.name if patient else "",
                "联系电话": patient.phone if patient else "",
                "诊断部位": order.body_part,
                "左右侧": order.side,
                "当前状态": order.status,
                "取模日期": order.impression_date or "",
                "复诊日期": order.follow_up_date or "",
                "负责技师": order.technician or "",
                "备注": order.notes or "",
                "创建时间": order.created_at or "",
            }
            rows.append(row)
        
        fieldnames = [
            "订单号", "患者姓名", "联系电话", "诊断部位", "左右侧",
            "当前状态", "取模日期", "复诊日期", "负责技师", "备注", "创建时间"
        ]
        
        try:
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            return True
        except Exception:
            return False
    
    def export_by_status(self, output_path: Path, status: str) -> bool:
        orders = self.order_repo.get_by_status(status)
        return self.export_orders(output_path, orders)
    
    def export_all(self, output_path: Path) -> bool:
        return self.export_orders(output_path)
