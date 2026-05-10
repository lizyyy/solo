import json
import os
from typing import Dict, List, Optional, Type, TypeVar
from pathlib import Path

from drill_service.models import (
    BaseModel,
    Region,
    DrillPlan,
    TrafficSwitch,
    OperationHistory,
    DrillReport,
)

T = TypeVar("T", bound=BaseModel)


class Storage:
    def __init__(self, base_dir: str = "./data"):
        self.base_dir = Path(base_dir)
        self._ensure_directories()
    
    def _ensure_directories(self):
        for subdir in ["regions", "plans", "traffic_switches", "history", "reports"]:
            (self.base_dir / subdir).mkdir(parents=True, exist_ok=True)
    
    def _file_path(self, collection: str, entity_id: str) -> Path:
        return self.base_dir / collection / f"{entity_id}.json"
    
    def _save(self, collection: str, entity_id: str, data: Dict):
        path = self._file_path(collection, entity_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load(self, collection: str, entity_id: str) -> Optional[Dict]:
        path = self._file_path(collection, entity_id)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def _list_all(self, collection: str) -> List[Dict]:
        path = self.base_dir / collection
        if not path.exists():
            return []
        results = []
        for file_path in path.glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                results.append(json.load(f))
        return results
    
    def _list_ids(self, collection: str) -> List[str]:
        path = self.base_dir / collection
        if not path.exists():
            return []
        return [p.stem for p in path.glob("*.json")]
    
    def _delete(self, collection: str, entity_id: str) -> bool:
        path = self._file_path(collection, entity_id)
        if path.exists():
            path.unlink()
            return True
        return False
    
    def save_region(self, region: Region):
        self._save("regions", region.name, region.to_dict())
    
    def get_region(self, name: str) -> Optional[Region]:
        data = self._load("regions", name)
        if data is None:
            return None
        return Region.from_dict(data)
    
    def list_regions(self) -> List[Region]:
        return [Region.from_dict(d) for d in self._list_all("regions")]
    
    def save_plan(self, plan: DrillPlan):
        self._save("plans", plan.plan_id, plan.to_dict())
    
    def get_plan(self, plan_id: str) -> Optional[DrillPlan]:
        data = self._load("plans", plan_id)
        if data is None:
            return None
        return DrillPlan.from_dict(data)
    
    def list_plans(self) -> List[DrillPlan]:
        return [DrillPlan.from_dict(d) for d in self._list_all("plans")]
    
    def save_traffic_switch(self, traffic_switch: TrafficSwitch):
        self._save("traffic_switches", traffic_switch.switch_id, traffic_switch.to_dict())
    
    def get_traffic_switch(self, switch_id: str) -> Optional[TrafficSwitch]:
        data = self._load("traffic_switches", switch_id)
        if data is None:
            return None
        return TrafficSwitch.from_dict(data)
    
    def list_traffic_switches_by_plan(self, plan_id: str) -> List[TrafficSwitch]:
        all_switches = [TrafficSwitch.from_dict(d) for d in self._list_all("traffic_switches")]
        return [s for s in all_switches if s.plan_id == plan_id]
    
    def save_history(self, history: OperationHistory):
        self._save("history", history.history_id, history.to_dict())
    
    def get_history(self, history_id: str) -> Optional[OperationHistory]:
        data = self._load("history", history_id)
        if data is None:
            return None
        return OperationHistory.from_dict(data)
    
    def list_history_by_plan(self, plan_id: str) -> List[OperationHistory]:
        all_history = [OperationHistory.from_dict(d) for d in self._list_all("history")]
        plan_history = [h for h in all_history if h.plan_id == plan_id]
        return sorted(plan_history, key=lambda x: x.timestamp)
    
    def save_report(self, report: DrillReport):
        self._save("reports", report.report_id, report.to_dict())
    
    def get_report(self, report_id: str) -> Optional[DrillReport]:
        data = self._load("reports", report_id)
        if data is None:
            return None
        return DrillReport.from_dict(data)
    
    def get_report_by_plan(self, plan_id: str) -> Optional[DrillReport]:
        all_reports = [DrillReport.from_dict(d) for d in self._list_all("reports")]
        for report in all_reports:
            if report.plan_id == plan_id:
                return report
        return None
