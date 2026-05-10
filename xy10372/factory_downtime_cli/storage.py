"""
数据持久化存储
"""

import json
import pickle
from pathlib import Path
from typing import Optional

from .models import DataStore


class StorageManager:
    """存储管理器"""
    
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_file = data_dir / "data_store.pkl"
        self.data_dir.mkdir(parents=True, exist_ok=True)
    
    def save(self, store: DataStore) -> bool:
        """保存数据"""
        try:
            with open(self.data_file, 'wb') as f:
                pickle.dump(store, f)
            return True
        except Exception:
            return False
    
    def load(self) -> Optional[DataStore]:
        """加载数据"""
        if not self.data_file.exists():
            return None
        
        try:
            with open(self.data_file, 'rb') as f:
                return pickle.load(f)
        except Exception:
            return None
    
    def reset(self) -> bool:
        """重置数据"""
        if self.data_file.exists():
            self.data_file.unlink()
        return True
    
    def export_json(self, store: DataStore, output_file: Path) -> bool:
        """导出为JSON格式"""
        try:
            data = {
                "plans": [
                    {
                        "plan_id": p.plan_id,
                        "machine_id": p.machine_id,
                        "product_code": p.product_code,
                        "planned_start": p.planned_start.isoformat(),
                        "planned_end": p.planned_end.isoformat(),
                        "planned_quantity": p.planned_quantity,
                        "status": p.status
                    }
                    for p in store.plans.values()
                ],
                "changeovers": [
                    {
                        "record_id": c.record_id,
                        "machine_id": c.machine_id,
                        "from_product": c.from_product,
                        "to_product": c.to_product,
                        "start_time": c.start_time.isoformat(),
                        "end_time": c.end_time.isoformat(),
                        "duration_minutes": c.duration_minutes,
                        "operator": c.operator,
                        "status": c.status.value
                    }
                    for c in store.changeovers.values()
                ],
                "abnormal_downtimes": [
                    {
                        "record_id": a.record_id,
                        "machine_id": a.machine_id,
                        "downtime_type": a.downtime_type,
                        "start_time": a.start_time.isoformat(),
                        "end_time": a.end_time.isoformat(),
                        "duration_minutes": a.duration_minutes,
                        "reason": a.reason,
                        "operator": a.operator,
                        "status": a.status.value
                    }
                    for a in store.abnormal_downtimes.values()
                ],
                "productions": [
                    {
                        "record_id": p.record_id,
                        "machine_id": p.machine_id,
                        "product_code": p.product_code,
                        "quantity": p.quantity,
                        "production_time": p.production_time.isoformat(),
                        "plan_id": p.plan_id,
                        "status": p.status.value
                    }
                    for p in store.productions.values()
                ]
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False
