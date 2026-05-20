import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any

from app.schemas.inventory import InventoryRecord
from app.schemas.sales import SalesRecord
from app.schemas.replenishment import ReplenishmentRecord
from app.schemas.reconciliation import ReconciliationRecord
from app.schemas.common import AuditLog, SKUMapItem


class MemoryStorage:
    def __init__(self):
        self._inventory: Dict[str, InventoryRecord] = {}
        self._sales: Dict[str, SalesRecord] = {}
        self._replenishment: Dict[str, ReplenishmentRecord] = {}
        self._reconciliation: Dict[str, ReconciliationRecord] = {}
        self._audit_logs: List[AuditLog] = []
        self._sku_map: Dict[str, SKUMapItem] = {}
        self._init_sku_map()
    
    def _init_sku_map(self):
        default_skus = [
            SKUMapItem(sku="SKU001", aliases=["可口可乐", "可乐330ml"], category="饮料", unit="瓶"),
            SKUMapItem(sku="SKU002", aliases=["百事可乐", "百事"], category="饮料", unit="瓶"),
            SKUMapItem(sku="SKU003", aliases=["农夫山泉", "矿泉水"], category="饮料", unit="瓶"),
            SKUMapItem(sku="SKU004", aliases=["乐事薯片", "薯片"], category="零食", unit="袋"),
            SKUMapItem(sku="SKU005", aliases=["康师傅方便面", "泡面"], category="食品", unit="桶"),
            SKUMapItem(sku="SKU006", aliases=["统一冰红茶", "冰红茶"], category="饮料", unit="瓶"),
            SKUMapItem(sku="SKU007", aliases=["旺仔牛奶", "旺仔"], category="饮料", unit="罐"),
            SKUMapItem(sku="SKU008", aliases=["奥利奥饼干", "奥利奥"], category="零食", unit="包"),
        ]
        for item in default_skus:
            self._sku_map[item.sku] = item
    
    def generate_id(self) -> str:
        return str(uuid.uuid4())
    
    def get_sku_by_alias(self, alias: str) -> Optional[str]:
        alias_lower = alias.lower().strip()
        for sku, item in self._sku_map.items():
            if alias_lower in [a.lower().strip() for a in item.aliases]:
                return sku
            if alias_lower == sku.lower():
                return sku
        return None
    
    def add_sku_alias(self, sku: str, alias: str) -> bool:
        if sku in self._sku_map:
            if alias not in self._sku_map[sku].aliases:
                self._sku_map[sku].aliases.append(alias)
                return True
        return False
    
    def save_inventory(self, record: InventoryRecord) -> InventoryRecord:
        self._inventory[record.id] = record
        return record
    
    def get_inventory(self, record_id: str) -> Optional[InventoryRecord]:
        return self._inventory.get(record_id)
    
    def list_inventory(self, store_id: Optional[str] = None) -> List[InventoryRecord]:
        records = list(self._inventory.values())
        if store_id:
            records = [r for r in records if r.store_id == store_id]
        return sorted(records, key=lambda x: x.created_at, reverse=True)
    
    def save_sales(self, record: SalesRecord) -> SalesRecord:
        self._sales[record.id] = record
        return record
    
    def get_sales(self, record_id: str) -> Optional[SalesRecord]:
        return self._sales.get(record_id)
    
    def list_sales(self, store_id: Optional[str] = None) -> List[SalesRecord]:
        records = list(self._sales.values())
        if store_id:
            records = [r for r in records if r.store_id == store_id]
        return sorted(records, key=lambda x: x.created_at, reverse=True)
    
    def save_replenishment(self, record: ReplenishmentRecord) -> ReplenishmentRecord:
        self._replenishment[record.id] = record
        return record
    
    def get_replenishment(self, record_id: str) -> Optional[ReplenishmentRecord]:
        return self._replenishment.get(record_id)
    
    def list_replenishment(self, store_id: Optional[str] = None) -> List[ReplenishmentRecord]:
        records = list(self._replenishment.values())
        if store_id:
            records = [r for r in records if r.store_id == store_id]
        return sorted(records, key=lambda x: x.created_at, reverse=True)
    
    def save_reconciliation(self, record: ReconciliationRecord) -> ReconciliationRecord:
        record.updated_at = datetime.now()
        self._reconciliation[record.id] = record
        return record
    
    def get_reconciliation(self, record_id: str) -> Optional[ReconciliationRecord]:
        return self._reconciliation.get(record_id)
    
    def list_reconciliation(self, store_id: Optional[str] = None) -> List[ReconciliationRecord]:
        records = list(self._reconciliation.values())
        if store_id:
            records = [r for r in records if r.store_id == store_id]
        return sorted(records, key=lambda x: x.created_at, reverse=True)
    
    def add_audit_log(self, log: AuditLog):
        self._audit_logs.append(log)
    
    def get_audit_logs(self, reconciliation_id: Optional[str] = None) -> List[AuditLog]:
        logs = self._audit_logs
        if reconciliation_id:
            logs = [log for log in logs if log.reconciliation_id == reconciliation_id]
        return sorted(logs, key=lambda x: x.timestamp, reverse=True)
    
    def get_sku_map(self) -> Dict[str, SKUMapItem]:
        return self._sku_map


storage = MemoryStorage()
