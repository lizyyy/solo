import json
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, TypeVar, Type, Any
from datetime import datetime

T = TypeVar('T')


class DataStore:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        self._pets: Dict[str, Any] = {}
        self._orders: Dict[str, Any] = {}
        self._medication_plans: Dict[str, Any] = {}
        self._shift_executions: Dict[str, Any] = {}
        self._change_records: Dict[str, Any] = {}
        
        self._load_all()

    def _get_file_path(self, name: str) -> Path:
        return self.data_dir / f"{name}.json"

    def _load_file(self, name: str) -> Dict:
        file_path = self._get_file_path(name)
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def _save_file(self, name: str, data: Dict) -> None:
        file_path = self._get_file_path(name)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _load_all(self) -> None:
        self._pets = self._load_file("pets")
        self._orders = self._load_file("orders")
        self._medication_plans = self._load_file("medication_plans")
        self._shift_executions = self._load_file("shift_executions")
        self._change_records = self._load_file("change_records")

    def _save_all(self) -> None:
        self._save_file("pets", self._pets)
        self._save_file("orders", self._orders)
        self._save_file("medication_plans", self._medication_plans)
        self._save_file("shift_executions", self._shift_executions)
        self._save_file("change_records", self._change_records)

    def save_pet(self, pet_data: Dict) -> None:
        self._pets[pet_data["pet_id"]] = pet_data
        self._save_all()

    def get_pet(self, pet_id: str) -> Optional[Dict]:
        return self._pets.get(pet_id)

    def get_all_pets(self) -> List[Dict]:
        return list(self._pets.values())

    def save_order(self, order_data: Dict) -> None:
        self._orders[order_data["order_id"]] = order_data
        self._save_all()

    def get_order(self, order_id: str) -> Optional[Dict]:
        return self._orders.get(order_id)

    def get_all_orders(self) -> List[Dict]:
        return list(self._orders.values())

    def save_medication_plan(self, plan_data: Dict) -> None:
        self._medication_plans[plan_data["plan_id"]] = plan_data
        self._save_all()

    def get_medication_plan(self, plan_id: str) -> Optional[Dict]:
        return self._medication_plans.get(plan_id)

    def get_plans_by_order(self, order_id: str) -> List[Dict]:
        return [p for p in self._medication_plans.values() if p["order_id"] == order_id]

    def get_all_plans(self) -> List[Dict]:
        return list(self._medication_plans.values())

    def save_shift_execution(self, execution_data: Dict) -> None:
        self._shift_executions[execution_data["execution_id"]] = execution_data
        self._save_all()

    def get_shift_execution(self, execution_id: str) -> Optional[Dict]:
        return self._shift_executions.get(execution_id)

    def get_executions_by_plan(self, plan_id: str) -> List[Dict]:
        return [e for e in self._shift_executions.values() if e["plan_id"] == plan_id]

    def get_executions_by_date(self, shift_date: str) -> List[Dict]:
        return [e for e in self._shift_executions.values() if e["shift_date"] == shift_date]

    def get_all_executions(self) -> List[Dict]:
        return list(self._shift_executions.values())

    def _calculate_change_hash(self, plan_id: str, field_changed: str, 
                               old_value: Any, new_value: Any) -> str:
        content = f"{plan_id}:{field_changed}:{old_value}:{new_value}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def save_change_record(self, change_data: Dict) -> Optional[str]:
        change_hash = self._calculate_change_hash(
            change_data["plan_id"],
            change_data["field_changed"],
            change_data["old_value"],
            change_data["new_value"]
        )
        
        for existing in self._change_records.values():
            if existing["change_hash"] == change_hash:
                return None
        
        change_data["change_hash"] = change_hash
        self._change_records[change_data["change_id"]] = change_data
        self._save_all()
        return change_data["change_id"]

    def get_change_record(self, change_id: str) -> Optional[Dict]:
        return self._change_records.get(change_id)

    def get_changes_by_plan(self, plan_id: str) -> List[Dict]:
        return [c for c in self._change_records.values() if c["plan_id"] == plan_id]

    def get_pending_changes(self) -> List[Dict]:
        return [c for c in self._change_records.values() if c["status"] == "pending"]

    def get_all_changes(self) -> List[Dict]:
        return list(self._change_records.values())

    def update_change_status(self, change_id: str, status: str, 
                            confirmed_by: str) -> bool:
        if change_id not in self._change_records:
            return False
        self._change_records[change_id]["status"] = status
        self._change_records[change_id]["confirmed_by"] = confirmed_by
        self._change_records[change_id]["confirmed_at"] = datetime.now().isoformat()
        self._save_all()
        return True

    def clear_all(self) -> None:
        self._pets.clear()
        self._orders.clear()
        self._medication_plans.clear()
        self._shift_executions.clear()
        self._change_records.clear()
        self._save_all()
