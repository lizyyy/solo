import os
import csv
import json
from datetime import datetime, date
from typing import List, Optional, Dict
from .models import (
    GrainBarn, BarnStatus, FumigationPlan, FumigationStatus,
    ChemicalRecord, EvacuationRecord, FumigationCheck, CheckItem, CheckStatus
)


class DataStore:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.checks_dir = os.path.join(data_dir, "checks")
        self.barns_file = os.path.join(data_dir, "grain_barns.csv")
        self.plans_file = os.path.join(data_dir, "fumigation_plans.csv")
        self.barns: Dict[str, GrainBarn] = {}
        self.plans: Dict[str, FumigationPlan] = {}
        self.checks: Dict[str, FumigationCheck] = {}
        self._init_dirs()
        self._load_all()

    def _init_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.checks_dir, exist_ok=True)

    def _parse_date(self, value: str) -> Optional[date]:
        if not value or value.strip() == "":
            return None
        try:
            return datetime.fromisoformat(value.strip()).date()
        except ValueError:
            return None

    def _parse_datetime(self, value: str) -> Optional[datetime]:
        if not value or value.strip() == "":
            return None
        try:
            return datetime.fromisoformat(value.strip())
        except ValueError:
            return None

    def _load_all(self):
        self._load_barns()
        self._load_plans()
        self._load_checks()

    def _load_barns(self):
        if not os.path.exists(self.barns_file):
            return
        with open(self.barns_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                barn = GrainBarn(
                    barn_id=row["barn_id"],
                    barn_name=row["barn_name"],
                    location=row["location"],
                    capacity=float(row["capacity"]) if row["capacity"] else 0,
                    current_grain_type=row["current_grain_type"],
                    current_grain_quantity=float(row["current_grain_quantity"]) if row["current_grain_quantity"] else 0,
                    last_fumigation_date=self._parse_date(row["last_fumigation_date"]),
                    status=BarnStatus(row["status"]),
                    created_at=self._parse_datetime(row["created_at"]) or datetime.now(),
                    updated_at=self._parse_datetime(row["updated_at"]) or datetime.now()
                )
                self.barns[barn.barn_id] = barn

    def _load_plans(self):
        if not os.path.exists(self.plans_file):
            return
        with open(self.plans_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                chemicals = self._parse_chemicals_json(row.get("chemicals_json", "[]"))
                evacuations = self._parse_evacuations_json(row.get("evacuations_json", "[]"))
                plan = FumigationPlan(
                    plan_id=row["plan_id"],
                    barn_id=row["barn_id"],
                    plan_date=self._parse_date(row["plan_date"]) or date.today(),
                    estimated_duration_hours=float(row["estimated_duration_hours"]) if row["estimated_duration_hours"] else 0,
                    target_pests=row["target_pests"],
                    operator=row["operator"],
                    chemicals=chemicals,
                    evacuations=evacuations,
                    status=FumigationStatus(row["status"]),
                    created_at=self._parse_datetime(row["created_at"]) or datetime.now(),
                    updated_at=self._parse_datetime(row["updated_at"]) or datetime.now(),
                    remarks=row.get("remarks", "")
                )
                self.plans[plan.plan_id] = plan

    def _load_checks(self):
        for filename in os.listdir(self.checks_dir):
            if filename.endswith(".json") and filename.startswith("check_"):
                filepath = os.path.join(self.checks_dir, filename)
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    check = FumigationCheck(
                        check_id=data["check_id"],
                        plan_id=data["plan_id"],
                        barn_id=data["barn_id"],
                        barn_name=data["barn_name"],
                        temperature=float(data["temperature"]),
                        humidity=float(data["humidity"]),
                        seal_start_time=self._parse_datetime(data["seal_start_time"]) or datetime.now(),
                        seal_quality_score=float(data["seal_quality_score"]),
                        overall_status=CheckStatus(data["overall_status"]),
                        items=[
                            CheckItem(
                                check_id=item["check_id"],
                                plan_id=item["plan_id"],
                                check_type=item["check_type"],
                                check_description=item["check_description"],
                                check_value=item.get("check_value"),
                                expected_value=item.get("expected_value"),
                                status=CheckStatus(item["status"]),
                                message=item["message"],
                                checked_at=self._parse_datetime(item.get("checked_at", "")),
                                checked_by=item.get("checked_by")
                            )
                            for item in data.get("items", [])
                        ],
                        created_at=self._parse_datetime(data["created_at"]) or datetime.now(),
                        updated_at=self._parse_datetime(data["updated_at"]) or datetime.now()
                    )
                    self.checks[check.check_id] = check

    def _parse_chemicals_json(self, json_str: str) -> List[ChemicalRecord]:
        try:
            data = json.loads(json_str) if json_str else []
        except json.JSONDecodeError:
            data = []
        return [
            ChemicalRecord(
                chemical_name=item["chemical_name"],
                chemical_type=item["chemical_type"],
                dosage=float(item["dosage"]),
                unit=item["unit"],
                batch_number=item["batch_number"],
                expiration_date=self._parse_date(item["expiration_date"]) or date.today(),
                supplier=item["supplier"]
            )
            for item in data
        ]

    def _parse_evacuations_json(self, json_str: str) -> List[EvacuationRecord]:
        try:
            data = json.loads(json_str) if json_str else []
        except json.JSONDecodeError:
            data = []
        return [
            EvacuationRecord(
                personnel_name=item["personnel_name"],
                personnel_id=item["personnel_id"],
                department=item["department"],
                evacuation_time=self._parse_datetime(item["evacuation_time"]) or datetime.now(),
                check_time=self._parse_datetime(item["check_time"]) or datetime.now(),
                check_person=item["check_person"]
            )
            for item in data
        ]

    def save_barns(self):
        fieldnames = [
            "barn_id", "barn_name", "location", "capacity",
            "current_grain_type", "current_grain_quantity",
            "last_fumigation_date", "status", "created_at", "updated_at"
        ]
        with open(self.barns_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for barn in self.barns.values():
                writer.writerow(barn.to_dict())

    def save_plans(self):
        fieldnames = [
            "plan_id", "barn_id", "plan_date", "estimated_duration_hours",
            "target_pests", "operator", "chemicals_json", "evacuations_json",
            "status", "remarks", "created_at", "updated_at"
        ]
        with open(self.plans_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for plan in self.plans.values():
                chemicals_json = json.dumps([
                    {
                        "chemical_name": c.chemical_name,
                        "chemical_type": c.chemical_type,
                        "dosage": c.dosage,
                        "unit": c.unit,
                        "batch_number": c.batch_number,
                        "expiration_date": c.expiration_date.isoformat() if c.expiration_date else "",
                        "supplier": c.supplier
                    }
                    for c in plan.chemicals
                ], ensure_ascii=False)
                evacuations_json = json.dumps([
                    {
                        "personnel_name": e.personnel_name,
                        "personnel_id": e.personnel_id,
                        "department": e.department,
                        "evacuation_time": e.evacuation_time.isoformat(),
                        "check_time": e.check_time.isoformat(),
                        "check_person": e.check_person
                    }
                    for e in plan.evacuations
                ], ensure_ascii=False)
                row = plan.to_dict()
                row["chemicals_json"] = chemicals_json
                row["evacuations_json"] = evacuations_json
                writer.writerow(row)

    def save_check(self, check: FumigationCheck):
        filepath = os.path.join(self.checks_dir, f"check_{check.check_id}.json")
        data = check.to_dict()
        data["items"] = [item.to_dict() for item in check.items]
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add_barn(self, barn: GrainBarn) -> bool:
        if barn.barn_id in self.barns:
            return False
        self.barns[barn.barn_id] = barn
        self.save_barns()
        return True

    def update_barn(self, barn: GrainBarn):
        self.barns[barn.barn_id] = barn
        self.save_barns()

    def get_barn(self, barn_id: str) -> Optional[GrainBarn]:
        return self.barns.get(barn_id)

    def add_plan(self, plan: FumigationPlan) -> bool:
        if plan.plan_id in self.plans:
            return False
        self.plans[plan.plan_id] = plan
        self.save_plans()
        return True

    def update_plan(self, plan: FumigationPlan):
        self.plans[plan.plan_id] = plan
        self.save_plans()

    def get_plan(self, plan_id: str) -> Optional[FumigationPlan]:
        return self.plans.get(plan_id)

    def get_plans_by_barn(self, barn_id: str) -> List[FumigationPlan]:
        return [p for p in self.plans.values() if p.barn_id == barn_id]

    def add_check(self, check: FumigationCheck):
        self.checks[check.check_id] = check
        self.save_check(check)

    def get_check(self, check_id: str) -> Optional[FumigationCheck]:
        return self.checks.get(check_id)

    def get_checks_by_plan(self, plan_id: str) -> List[FumigationCheck]:
        return [c for c in self.checks.values() if c.plan_id == plan_id]

    def get_all_checks(self) -> List[FumigationCheck]:
        return list(self.checks.values())
