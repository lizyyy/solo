import json
import os
from dataclasses import asdict
from typing import Any, Dict, List, Type
from src.models.base import (
    Order, ActivityRule, GiftInventory, ShipmentRecord, 
    ReturnRecord, ReissueTask, InventoryOperation, AuditLog, SystemState
)


DATA_DIR = "./data"


class Storage:
    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        self.ensure_dirs()
    
    def ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
    
    def _get_path(self, name: str) -> str:
        return os.path.join(self.data_dir, f"{name}.json")
    
    def save(self, name: str, data: Any):
        if isinstance(data, list):
            serializable = [asdict(item) if hasattr(item, '__dict__') else item for item in data]
        elif hasattr(data, '__dict__'):
            serializable = asdict(data)
        else:
            serializable = data
        
        with open(self._get_path(name), 'w', encoding='utf-8') as f:
            json.dump(serializable, f, ensure_ascii=False, indent=2)
    
    def load(self, name: str, default: Any = None) -> Any:
        path = self._get_path(name)
        if not os.path.exists(path):
            return default if default is not None else []
        
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def load_orders(self) -> Dict[str, Dict]:
        return {o['order_id']: o for o in self.load('orders', [])}
    
    def load_rules(self) -> Dict[str, Dict]:
        return {r['activity_id']: r for r in self.load('activity_rules', [])}
    
    def load_inventory(self) -> Dict[str, Dict]:
        return {inv['sku']: inv for inv in self.load('gift_inventory', [])}
    
    def load_state(self) -> Dict:
        return self.load('system_state', {'initialized': False, 'version': 1})
    
    def save_orders(self, orders: Dict[str, Dict]):
        self.save('orders', list(orders.values()))
    
    def save_rules(self, rules: Dict[str, Dict]):
        self.save('activity_rules', list(rules.values()))
    
    def save_inventory(self, inventory: Dict[str, Dict]):
        self.save('gift_inventory', list(inventory.values()))
    
    def save_state(self, state: Dict):
        self.save('system_state', state)
    
    def append(self, name: str, item: Any):
        items = self.load(name, [])
        if hasattr(item, '__dict__'):
            items.append(asdict(item))
        else:
            items.append(item)
        self.save(name, items)
    
    def append_shipment(self, shipment: Dict):
        self.append('shipment_records', shipment)
    
    def append_return(self, return_record: Dict):
        self.append('return_records', return_record)
    
    def append_reissue(self, task: Dict):
        self.append('reissue_tasks', task)
    
    def append_inventory_op(self, op: Dict):
        self.append('inventory_operations', op)
    
    def append_audit(self, log: Dict):
        self.append('audit_logs', log)
    
    def load_shipments(self) -> List[Dict]:
        return self.load('shipment_records', [])
    
    def load_returns(self) -> List[Dict]:
        return self.load('return_records', [])
    
    def load_reissues(self) -> List[Dict]:
        return self.load('reissue_tasks', [])
    
    def load_inventory_ops(self) -> List[Dict]:
        return self.load('inventory_operations', [])
    
    def load_audits(self) -> List[Dict]:
        return self.load('audit_logs', [])


storage = Storage()
