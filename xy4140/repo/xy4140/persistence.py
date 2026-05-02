import json
from pathlib import Path
from typing import List, Dict, Optional, Any
from datetime import datetime, date
import uuid

from models import (
    ElderlyPerson,
    CoolingStation,
    HeatForecast,
    HourlyForecast,
    TravelTime,
    DispatchPlan,
    VisitSchedule,
    CoverageGap,
)
from config import SAVED_PLANS_DIR, DATA_DIR


class DataLoader:
    @staticmethod
    def load_json(file_path: Path) -> Dict:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def save_json(data: Dict, file_path: Path):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    @staticmethod
    def load_elderly_from_csv(file_path: Path) -> List[ElderlyPerson]:
        import pandas as pd
        df = pd.read_csv(file_path, encoding="utf-8")
        persons = []
        
        for _, row in df.iterrows():
            health_conditions = []
            if pd.notna(row.get("health_conditions")):
                health_conditions = [
                    h.strip() for h in str(row["health_conditions"]).split(";")
                    if h.strip()
                ]
            
            person = ElderlyPerson(
                id=str(row.get("id", str(uuid.uuid4()))),
                name=str(row.get("name", "")),
                age=int(row.get("age", 65)),
                gender=str(row.get("gender", "未知")),
                address=str(row.get("address", "")),
                district=str(row.get("district", "")),
                community=str(row.get("community", "")),
                latitude=float(row.get("latitude", 0.0)),
                longitude=float(row.get("longitude", 0.0)),
                phone=str(row.get("phone", "")),
                contact_person=str(row.get("contact_person", "")),
                contact_phone=str(row.get("contact_phone", "")),
                health_conditions=health_conditions,
                living_alone=bool(row.get("living_alone", False)),
                mobility=str(row.get("mobility", "正常")),
                has_air_conditioning=bool(row.get("has_air_conditioning", True)),
                needs_special_care=bool(row.get("needs_special_care", False)),
                notes=str(row.get("notes", "")),
                visit_priority=int(row.get("visit_priority", 3)),
            )
            persons.append(person)
        
        return persons

    @staticmethod
    def load_stations_from_csv(file_path: Path) -> List[CoolingStation]:
        import pandas as pd
        df = pd.read_csv(file_path, encoding="utf-8")
        stations = []
        
        for _, row in df.iterrows():
            facilities = []
            if pd.notna(row.get("facilities")):
                facilities = [
                    f.strip() for f in str(row["facilities"]).split(";")
                    if f.strip()
                ]
            
            station = CoolingStation(
                id=str(row.get("id", str(uuid.uuid4()))),
                name=str(row.get("name", "")),
                address=str(row.get("address", "")),
                district=str(row.get("district", "")),
                community=str(row.get("community", "")),
                latitude=float(row.get("latitude", 0.0)),
                longitude=float(row.get("longitude", 0.0)),
                capacity=int(row.get("capacity", 50)),
                current_occupancy=int(row.get("current_occupancy", 0)),
                opening_time=str(row.get("opening_time", "08:00")),
                closing_time=str(row.get("closing_time", "18:00")),
                facilities=facilities,
                staff_count=int(row.get("staff_count", 2)),
                status=str(row.get("status", "开放")),
                is_locked=bool(row.get("is_locked", False)),
                notes=str(row.get("notes", "")),
            )
            stations.append(station)
        
        return stations

    @staticmethod
    def load_forecast_from_json(file_path: Path) -> HeatForecast:
        data = DataLoader.load_json(file_path)
        return HeatForecast.from_dict(data)

    @staticmethod
    def load_elderly_from_json(file_path: Path) -> List[ElderlyPerson]:
        data = DataLoader.load_json(file_path)
        return [ElderlyPerson.from_dict(p) for p in data.get("persons", [])]

    @staticmethod
    def load_stations_from_json(file_path: Path) -> List[CoolingStation]:
        data = DataLoader.load_json(file_path)
        return [CoolingStation.from_dict(s) for s in data.get("stations", [])]


class PlanManager:
    def __init__(self, plans_dir: Optional[Path] = None):
        self.plans_dir = plans_dir or SAVED_PLANS_DIR
        self.plans_dir.mkdir(parents=True, exist_ok=True)

    def save_plan(
        self,
        plan: DispatchPlan,
        persons: List[ElderlyPerson],
        stations: List[CoolingStation],
        forecast: Optional[HeatForecast] = None,
    ) -> Path:
        plan_file = self.plans_dir / f"{plan.id}.json"
        
        full_data = {
            "plan": plan.to_dict(),
            "persons": [p.to_dict() for p in persons],
            "stations": [s.to_dict() for s in stations],
            "forecast": forecast.to_dict() if forecast else None,
            "saved_at": datetime.now().isoformat(),
        }
        
        DataLoader.save_json(full_data, plan_file)
        return plan_file

    def load_plan(self, plan_id: str) -> Dict[str, Any]:
        plan_file = self.plans_dir / f"{plan_id}.json"
        if not plan_file.exists():
            raise FileNotFoundError(f"方案 {plan_id} 不存在")
        
        data = DataLoader.load_json(plan_file)
        
        result = {
            "plan": DispatchPlan.from_dict(data["plan"]),
            "persons": [ElderlyPerson.from_dict(p) for p in data["persons"]],
            "stations": [CoolingStation.from_dict(s) for s in data["stations"]],
            "forecast": HeatForecast.from_dict(data["forecast"]) if data.get("forecast") else None,
            "saved_at": data.get("saved_at"),
        }
        return result

    def list_plans(self) -> List[Dict]:
        plans = []
        for file in self.plans_dir.glob("*.json"):
            try:
                data = DataLoader.load_json(file)
                plan_data = data.get("plan", {})
                plans.append({
                    "id": plan_data.get("id"),
                    "name": plan_data.get("name", "未命名方案"),
                    "created_at": plan_data.get("created_at"),
                    "saved_at": data.get("saved_at"),
                    "district": plan_data.get("district", ""),
                    "forecast_date": plan_data.get("forecast_date", ""),
                    "elderly_count": len(plan_data.get("elderly_ids", [])),
                    "file_path": str(file),
                })
            except Exception:
                continue
        
        return sorted(plans, key=lambda x: x.get("saved_at", ""), reverse=True)

    def delete_plan(self, plan_id: str) -> bool:
        plan_file = self.plans_dir / f"{plan_id}.json"
        if plan_file.exists():
            plan_file.unlink()
            return True
        return False

    def create_new_plan(
        self,
        name: str,
        district: str,
        forecast_date: date,
        persons: List[ElderlyPerson],
        stations: List[CoolingStation],
    ) -> DispatchPlan:
        plan = DispatchPlan(
            id=str(uuid.uuid4()),
            name=name,
            created_at=datetime.now(),
            forecast_date=forecast_date,
            district=district,
            elderly_ids=[p.id for p in persons],
            station_assignments={},
            visit_schedules=[],
            locked_stations=[],
            priority_overrides={},
        )
        return plan


class SessionState:
    def __init__(self):
        self.persons: List[ElderlyPerson] = []
        self.stations: List[CoolingStation] = []
        self.forecast: Optional[HeatForecast] = None
        self.current_plan: Optional[DispatchPlan] = None
        self.locked_stations: List[str] = []
        self.priority_overrides: Dict[str, int] = {}
        self.station_assignments: List[Any] = []
        self.visit_schedules: List[VisitSchedule] = []
        self.coverage_gaps: List[CoverageGap] = []
        self.hotspots: List[Dict] = []

    def clear(self):
        self.__init__()
