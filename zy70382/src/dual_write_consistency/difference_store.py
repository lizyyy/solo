import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from .models import Difference, DifferenceStatus


class DifferenceStore:
    def __init__(self, store_dir: str):
        self.store_dir = store_dir
        self.differences_file = os.path.join(store_dir, "differences.json")
        self._ensure_directory()
    
    def _ensure_directory(self):
        if not os.path.exists(self.store_dir):
            os.makedirs(self.store_dir)
    
    def _load_all(self) -> Dict[str, Dict[str, Any]]:
        if not os.path.exists(self.differences_file):
            return {}
        
        with open(self.differences_file, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def _save_all(self, data: Dict[str, Dict[str, Any]]):
        with open(self.differences_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    
    def update_difference(self, diff: Difference):
        all_diffs = self._load_all()
        
        if diff.id in all_diffs:
            existing = all_diffs[diff.id]
            
            if existing.get("status") == DifferenceStatus.CONFIRMED:
                if diff.status != DifferenceStatus.FIXED:
                    diff.status = DifferenceStatus.RECURRING
                    diff.recurrence_count = existing.get("recurrence_count", 0) + 1
                    diff.first_seen_at = existing.get("first_seen_at", diff.created_at)
            elif existing.get("status") == DifferenceStatus.FIXED:
                diff.status = DifferenceStatus.RECURRING
                diff.recurrence_count = existing.get("recurrence_count", 0) + 1
                diff.first_seen_at = existing.get("first_seen_at", diff.created_at)
            else:
                diff.first_seen_at = existing.get("first_seen_at", diff.first_seen_at)
                diff.recurrence_count = existing.get("recurrence_count", 0)
        
        all_diffs[diff.id] = diff.model_dump(mode="json")
        self._save_all(all_diffs)
    
    def update_many(self, diffs: List[Difference]):
        for diff in diffs:
            self.update_difference(diff)
    
    def get_difference(self, diff_id: str) -> Optional[Difference]:
        all_diffs = self._load_all()
        
        if diff_id not in all_diffs:
            return None
        
        data = all_diffs[diff_id]
        return self._deserialize_diff(data)
    
    def _deserialize_diff(self, data: Dict[str, Any]) -> Difference:
        if "first_seen_at" in data and isinstance(data["first_seen_at"], str):
            data["first_seen_at"] = datetime.fromisoformat(data["first_seen_at"])
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        if "confirmed_at" in data and isinstance(data.get("confirmed_at"), str):
            data["confirmed_at"] = datetime.fromisoformat(data["confirmed_at"])
        if "fixed_at" in data and isinstance(data.get("fixed_at"), str):
            data["fixed_at"] = datetime.fromisoformat(data["fixed_at"])
        
        return Difference(**data)
    
    def get_all(self, status: Optional[DifferenceStatus] = None) -> List[Difference]:
        all_diffs = self._load_all()
        
        diffs: List[Difference] = []
        for diff_id, data in all_diffs.items():
            diff = self._deserialize_diff(data)
            if status is None or diff.status == status:
                diffs.append(diff)
        
        return diffs
    
    def get_by_entity(self, entity_name: str) -> List[Difference]:
        all_diffs = self._load_all()
        
        diffs: List[Difference] = []
        for diff_id, data in all_diffs.items():
            if data.get("entity") == entity_name:
                diffs.append(self._deserialize_diff(data))
        
        return diffs
    
    def confirm_difference(self, diff_id: str, notes: Optional[str] = None) -> bool:
        all_diffs = self._load_all()
        
        if diff_id not in all_diffs:
            return False
        
        data = all_diffs[diff_id]
        data["status"] = DifferenceStatus.CONFIRMED
        data["confirmed_at"] = datetime.now().isoformat()
        if notes:
            data["notes"] = notes
        
        self._save_all(all_diffs)
        return True
    
    def mark_fixed(self, diff_id: str, notes: Optional[str] = None) -> bool:
        all_diffs = self._load_all()
        
        if diff_id not in all_diffs:
            return False
        
        data = all_diffs[diff_id]
        data["status"] = DifferenceStatus.FIXED
        data["fixed_at"] = datetime.now().isoformat()
        if notes:
            data["notes"] = notes
        
        self._save_all(all_diffs)
        return True
    
    def mark_many_fixed(self, diff_ids: List[str]) -> int:
        count = 0
        for diff_id in diff_ids:
            if self.mark_fixed(diff_id):
                count += 1
        return count
    
    def get_recurring(self) -> List[Difference]:
        all_diffs = self._load_all()
        
        diffs: List[Difference] = []
        for diff_id, data in all_diffs.items():
            if data.get("status") == DifferenceStatus.RECURRING:
                diffs.append(self._deserialize_diff(data))
        
        return diffs
    
    def get_statistics(self) -> Dict[str, int]:
        all_diffs = self._load_all()
        
        stats = {
            "total": len(all_diffs),
            "open": 0,
            "confirmed": 0,
            "fixed": 0,
            "recurring": 0,
        }
        
        for data in all_diffs.values():
            status = data.get("status")
            if status == DifferenceStatus.OPEN:
                stats["open"] += 1
            elif status == DifferenceStatus.CONFIRMED:
                stats["confirmed"] += 1
            elif status == DifferenceStatus.FIXED:
                stats["fixed"] += 1
            elif status == DifferenceStatus.RECURRING:
                stats["recurring"] += 1
        
        return stats
