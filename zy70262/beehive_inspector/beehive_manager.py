"""蜂箱档案管理模块"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from beehive_inspector.models import Beehive
from beehive_inspector.storage import FileStorage


class BeehiveManager:
    def __init__(self, storage: FileStorage):
        self.storage = storage

    def list_beehives(self) -> List[Dict[str, Any]]:
        return self.storage.load_beehives()

    def get_beehive(self, beehive_id: str) -> Optional[Dict[str, Any]]:
        beehives = self.storage.load_beehives()
        hive = next((b for b in beehives if b["beehive_id"] == beehive_id), None)
        return hive

    def add_beehive(self, beehive_id: str, location: str, established_date: str, queen_status: str = "活跃", notes: str = "") -> Dict[str, Any]:
        beehives = self.storage.load_beehives()
        
        existing = next((b for b in beehives if b["beehive_id"] == beehive_id), None)
        if existing:
            raise ValueError(f"蜂箱 {beehive_id} 已存在")
        
        new_hive = Beehive(
            beehive_id=beehive_id,
            location=location,
            established_date=established_date,
            current_status="正常",
            queen_status=queen_status,
            notes=notes,
        )
        new_hive.add_history({
            "type": "created",
            "description": f"蜂箱建立，位置: {location}",
        })
        
        beehives.append(new_hive.to_dict())
        self.storage.save_beehives(beehives)
        return new_hive.to_dict()

    def update_beehive(self, beehive_id: str, **kwargs) -> Dict[str, Any]:
        beehives = self.storage.load_beehives()
        hive_idx = next((i for i, b in enumerate(beehives) if b["beehive_id"] == beehive_id), None)
        
        if hive_idx is None:
            raise ValueError(f"蜂箱 {beehive_id} 不存在")
        
        hive = Beehive.from_dict(beehives[hive_idx])
        
        allowed_fields = ["location", "current_status", "queen_status", "notes"]
        changes = []
        for field, value in kwargs.items():
            if field in allowed_fields and value is not None:
                old_value = getattr(hive, field, None)
                setattr(hive, field, value)
                if old_value != value:
                    changes.append(f"{field}: {old_value} -> {value}")
        
        if changes:
            hive.add_history({
                "type": "updated",
                "changes": ", ".join(changes),
            })
        
        beehives[hive_idx] = hive.to_dict()
        self.storage.save_beehives(beehives)
        return hive.to_dict()

    def update_last_inspection(self, beehive_id: str, inspection_date: str):
        beehives = self.storage.load_beehives()
        hive_idx = next((i for i, b in enumerate(beehives) if b["beehive_id"] == beehive_id), None)
        
        if hive_idx is not None:
            hive = Beehive.from_dict(beehives[hive_idx])
            hive.last_inspection_date = inspection_date
            beehives[hive_idx] = hive.to_dict()
            self.storage.save_beehives(beehives)
