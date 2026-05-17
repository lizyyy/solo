import json
import csv
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import asdict

from .models import (
    BusStop, Student, BusRoute, ReroutePlan, ParentConfirmation,
    RecoveryCheck, RerouteReason, ConfirmationStatus, RecoveryStatus, ConfirmationChannel
)


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, (RerouteReason, ConfirmationStatus, RecoveryStatus, ConfirmationChannel)):
            return obj.value
        return super().default(obj)


class Storage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        self.stops_file = self.data_dir / "stops.json"
        self.students_file = self.data_dir / "students.json"
        self.routes_file = self.data_dir / "routes.json"
        self.reroutes_file = self.data_dir / "reroutes.json"
        self.confirmations_file = self.data_dir / "confirmations.json"
        self.recovery_checks_file = self.data_dir / "recovery_checks.json"
        
        self._ensure_files_exist()

    def _ensure_files_exist(self):
        for f in [self.stops_file, self.students_file, self.routes_file,
                  self.reroutes_file, self.confirmations_file, self.recovery_checks_file]:
            if not f.exists():
                f.write_text("[]")

    def _load_json(self, file_path: Path) -> List[Dict]:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_json(self, file_path: Path, data: List[Dict]):
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=2)

    def save_stop(self, stop: BusStop):
        stops = self._load_json(self.stops_file)
        stops.append(asdict(stop))
        self._save_json(self.stops_file, stops)

    def get_all_stops(self) -> List[Dict]:
        return self._load_json(self.stops_file)

    def save_student(self, student: Student):
        students = self._load_json(self.students_file)
        students.append(asdict(student))
        self._save_json(self.students_file, students)

    def get_all_students(self) -> List[Dict]:
        return self._load_json(self.students_file)

    def save_route(self, route: BusRoute):
        routes = self._load_json(self.routes_file)
        route_dict = asdict(route)
        route_dict['stops'] = [asdict(s) for s in route.stops]
        route_dict['students'] = [asdict(s) for s in route.students]
        routes.append(route_dict)
        self._save_json(self.routes_file, routes)

    def get_all_routes(self) -> List[Dict]:
        return self._load_json(self.routes_file)

    def save_reroute(self, reroute: ReroutePlan):
        reroutes = self._load_json(self.reroutes_file)
        reroute_dict = asdict(reroute)
        reroute_dict['original_stop_replacements'] = {
            k: asdict(v) for k, v in reroute.original_stop_replacements.items()
        }
        reroutes.append(reroute_dict)
        self._save_json(self.reroutes_file, reroutes)

    def get_all_reroutes(self) -> List[Dict]:
        return self._load_json(self.reroutes_file)

    def get_reroute_by_id(self, reroute_id: str) -> Optional[Dict]:
        reroutes = self.get_all_reroutes()
        for r in reroutes:
            if r['reroute_id'] == reroute_id:
                return r
        return None

    def save_confirmation(self, conf: ParentConfirmation):
        confirmations = self._load_json(self.confirmations_file)
        confirmations.append(asdict(conf))
        self._save_json(self.confirmations_file, confirmations)

    def batch_save_confirmations(self, confs: List[ParentConfirmation]):
        confirmations = self._load_json(self.confirmations_file)
        for conf in confs:
            confirmations.append(asdict(conf))
        self._save_json(self.confirmations_file, confirmations)

    def get_all_confirmations(self) -> List[Dict]:
        return self._load_json(self.confirmations_file)

    def get_confirmations_by_reroute(self, reroute_id: str) -> List[Dict]:
        return [c for c in self.get_all_confirmations() if c['reroute_id'] == reroute_id]

    def save_recovery_check(self, check: RecoveryCheck):
        checks = self._load_json(self.recovery_checks_file)
        checks.append(asdict(check))
        self._save_json(self.recovery_checks_file, checks)

    def update_recovery_check(self, check: RecoveryCheck):
        checks = self._load_json(self.recovery_checks_file)
        for i, c in enumerate(checks):
            if c['check_id'] == check.check_id:
                checks[i] = asdict(check)
                break
        self._save_json(self.recovery_checks_file, checks)

    def get_all_recovery_checks(self) -> List[Dict]:
        return self._load_json(self.recovery_checks_file)

    def get_recovery_checks_by_reroute(self, reroute_id: str) -> List[Dict]:
        return [c for c in self.get_all_recovery_checks() if c['reroute_id'] == reroute_id]

    def clear_all(self):
        for f in [self.stops_file, self.students_file, self.routes_file,
                  self.reroutes_file, self.confirmations_file, self.recovery_checks_file]:
            f.write_text("[]")
