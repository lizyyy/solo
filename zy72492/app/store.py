import json
import os
from typing import List, Dict, Optional
from datetime import datetime
from .models import (
    StreetPoint, SamplingRecord, DispatchOrder, AuditLog,
    HeatmapResult, HeatmapCell, Status, AuditAction, RecordType, SamplingTime
)


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


class DataStore:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self._points_file = os.path.join(DATA_DIR, "points.json")
        self._records_file = os.path.join(DATA_DIR, "records.json")
        self._orders_file = os.path.join(DATA_DIR, "orders.json")
        self._audit_file = os.path.join(DATA_DIR, "audit.json")
        self._heatmap_file = os.path.join(DATA_DIR, "heatmap.json")
        self._heatmap_version_file = os.path.join(DATA_DIR, "heatmap_version.txt")
        self._load_all()

    def _load_all(self):
        self.points: Dict[str, StreetPoint] = {}
        self.records: Dict[str, SamplingRecord] = {}
        self.orders: Dict[str, DispatchOrder] = {}
        self.audit_logs: List[AuditLog] = []
        self.heatmap_history: List[HeatmapResult] = []

        if os.path.exists(self._points_file):
            with open(self._points_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.points = {k: StreetPoint(**v) for k, v in data.items()}

        if os.path.exists(self._records_file):
            with open(self._records_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.records = {k: SamplingRecord(**v) for k, v in data.items()}

        if os.path.exists(self._orders_file):
            with open(self._orders_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.orders = {k: DispatchOrder(**v) for k, v in data.items()}

        if os.path.exists(self._audit_file):
            with open(self._audit_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.audit_logs = [AuditLog(**item) for item in data]

        if os.path.exists(self._heatmap_file):
            with open(self._heatmap_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.heatmap_history = [HeatmapResult(**item) for item in data]

        self.heatmap_version = 0
        if os.path.exists(self._heatmap_version_file):
            with open(self._heatmap_version_file, 'r') as f:
                self.heatmap_version = int(f.read().strip())

    def _save_points(self):
        with open(self._points_file, 'w', encoding='utf-8') as f:
            json.dump({k: v.model_dump() for k, v in self.points.items()}, f, ensure_ascii=False, indent=2, default=str)

    def _save_records(self):
        with open(self._records_file, 'w', encoding='utf-8') as f:
            json.dump({k: v.model_dump() for k, v in self.records.items()}, f, ensure_ascii=False, indent=2, default=str)

    def _save_orders(self):
        with open(self._orders_file, 'w', encoding='utf-8') as f:
            json.dump({k: v.model_dump() for k, v in self.orders.items()}, f, ensure_ascii=False, indent=2, default=str)

    def _save_audit(self):
        with open(self._audit_file, 'w', encoding='utf-8') as f:
            json.dump([item.model_dump() for item in self.audit_logs], f, ensure_ascii=False, indent=2, default=str)

    def _save_heatmap(self):
        with open(self._heatmap_file, 'w', encoding='utf-8') as f:
            json.dump([item.model_dump() for item in self.heatmap_history], f, ensure_ascii=False, indent=2, default=str)
        with open(self._heatmap_version_file, 'w') as f:
            f.write(str(self.heatmap_version))

    def save_all(self):
        self._save_points()
        self._save_records()
        self._save_orders()
        self._save_audit()
        self._save_heatmap()

    def add_point(self, point: StreetPoint):
        self.points[point.id] = point
        self._save_points()

    def add_record(self, record: SamplingRecord):
        self.records[record.id] = record
        self._save_records()

    def add_order(self, order: DispatchOrder):
        self.orders[order.id] = order
        self._save_orders()

    def update_order(self, order_id: str, **kwargs):
        if order_id in self.orders:
            order = self.orders[order_id]
            old_values = {}
            for key, value in kwargs.items():
                if hasattr(order, key):
                    old_values[key] = getattr(order, key)
                    setattr(order, key, value)
            order.updated_at = datetime.now()
            self._save_orders()
            return old_values
        return None

    def add_audit(self, log: AuditLog):
        self.audit_logs.append(log)
        self._save_audit()

    def add_heatmap(self, heatmap: HeatmapResult):
        self.heatmap_history.append(heatmap)
        self.heatmap_version = heatmap.version
        self._save_heatmap()

    def get_latest_heatmap(self) -> Optional[HeatmapResult]:
        if self.heatmap_history:
            return self.heatmap_history[-1]
        return None

    def get_records_by_point(self, point_id: str) -> List[SamplingRecord]:
        return [r for r in self.records.values() if r.point_id == point_id]

    def get_orders_by_point(self, point_id: str) -> List[DispatchOrder]:
        return [o for o in self.orders.values() if o.point_id == point_id]

    def get_audit_by_order(self, order_id: str) -> List[AuditLog]:
        return [a for a in self.audit_logs if a.order_id == order_id]


store = DataStore()
