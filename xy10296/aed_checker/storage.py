import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import (
    AEDDevice, Volunteer, Supplies, InspectionPlan,
    CheckinRecord, InspectionReport, ExceptionRecord,
    to_dict, from_dict
)


class Storage:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.files = {
            "devices": os.path.join(data_dir, "devices.json"),
            "volunteers": os.path.join(data_dir, "volunteers.json"),
            "supplies": os.path.join(data_dir, "supplies.json"),
            "plans": os.path.join(data_dir, "plans.json"),
            "checkins": os.path.join(data_dir, "checkins.json"),
            "reports": os.path.join(data_dir, "reports.json"),
            "exceptions": os.path.join(data_dir, "exceptions.json")
        }
        self._init_storage()

    def _init_storage(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
        for file_path in self.files.values():
            if not os.path.exists(file_path):
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump([], f)

    def _load(self, key: str) -> List[Dict[str, Any]]:
        with open(self.files[key], 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save(self, key: str, data: List[Dict[str, Any]]):
        with open(self.files[key], 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_device(self, device: AEDDevice) -> bool:
        devices = self._load("devices")
        for i, d in enumerate(devices):
            if d["device_id"] == device.device_id:
                devices[i] = to_dict(device)
                self._save("devices", devices)
                return True
        devices.append(to_dict(device))
        self._save("devices", devices)
        return True

    def get_device(self, device_id: str) -> Optional[AEDDevice]:
        devices = self._load("devices")
        for d in devices:
            if d["device_id"] == device_id:
                return from_dict(AEDDevice, d)
        return None

    def get_all_devices(self) -> List[AEDDevice]:
        return [from_dict(AEDDevice, d) for d in self._load("devices")]

    def save_volunteer(self, volunteer: Volunteer) -> bool:
        volunteers = self._load("volunteers")
        for i, v in enumerate(volunteers):
            if v["volunteer_id"] == volunteer.volunteer_id:
                volunteers[i] = to_dict(volunteer)
                self._save("volunteers", volunteers)
                return True
        volunteers.append(to_dict(volunteer))
        self._save("volunteers", volunteers)
        return True

    def get_volunteer(self, volunteer_id: str) -> Optional[Volunteer]:
        volunteers = self._load("volunteers")
        for v in volunteers:
            if v["volunteer_id"] == volunteer_id:
                return from_dict(Volunteer, v)
        return None

    def get_all_volunteers(self) -> List[Volunteer]:
        return [from_dict(Volunteer, v) for v in self._load("volunteers")]

    def save_supplies(self, supplies: Supplies) -> bool:
        supplies_list = self._load("supplies")
        for i, s in enumerate(supplies_list):
            if s["supplies_id"] == supplies.supplies_id:
                supplies_list[i] = to_dict(supplies)
                self._save("supplies", supplies_list)
                return True
        supplies_list.append(to_dict(supplies))
        self._save("supplies", supplies_list)
        return True

    def get_supplies_for_device(self, device_id: str) -> List[Supplies]:
        supplies_list = self._load("supplies")
        return [from_dict(Supplies, s) for s in supplies_list if s["device_id"] == device_id]

    def get_all_supplies(self) -> List[Supplies]:
        return [from_dict(Supplies, s) for s in self._load("supplies")]

    def save_plan(self, plan: InspectionPlan) -> bool:
        plans = self._load("plans")
        for i, p in enumerate(plans):
            if p["plan_id"] == plan.plan_id:
                plans[i] = to_dict(plan)
                self._save("plans", plans)
                return True
        plans.append(to_dict(plan))
        self._save("plans", plans)
        return True

    def get_plan(self, plan_id: str) -> Optional[InspectionPlan]:
        plans = self._load("plans")
        for p in plans:
            if p["plan_id"] == plan_id:
                return from_dict(InspectionPlan, p)
        return None

    def get_all_plans(self) -> List[InspectionPlan]:
        return [from_dict(InspectionPlan, p) for p in self._load("plans")]

    def get_plans_by_status(self, status: str) -> List[InspectionPlan]:
        plans = self._load("plans")
        return [from_dict(InspectionPlan, p) for p in plans if p["status"] == status]

    def save_checkin(self, checkin: CheckinRecord) -> bool:
        checkins = self._load("checkins")
        checkins.append(to_dict(checkin))
        self._save("checkins", checkins)
        return True

    def get_all_checkins(self) -> List[CheckinRecord]:
        return [from_dict(CheckinRecord, c) for c in self._load("checkins")]

    def save_report(self, report: InspectionReport) -> bool:
        reports = self._load("reports")
        for i, r in enumerate(reports):
            if r["report_id"] == report.report_id:
                reports[i] = to_dict(report)
                self._save("reports", reports)
                return True
        reports.append(to_dict(report))
        self._save("reports", reports)
        return True

    def get_report(self, report_id: str) -> Optional[InspectionReport]:
        reports = self._load("reports")
        for r in reports:
            if r["report_id"] == report_id:
                return from_dict(InspectionReport, r)
        return None

    def get_all_reports(self) -> List[InspectionReport]:
        return [from_dict(InspectionReport, r) for r in self._load("reports")]

    def get_reports_by_approval(self, status: str) -> List[InspectionReport]:
        reports = self._load("reports")
        return [from_dict(InspectionReport, r) for r in reports if r["approval_status"] == status]

    def save_exception(self, exception: ExceptionRecord) -> bool:
        exceptions = self._load("exceptions")
        for i, e in enumerate(exceptions):
            if e["exception_id"] == exception.exception_id:
                exceptions[i] = to_dict(exception)
                self._save("exceptions", exceptions)
                return True
        exceptions.append(to_dict(exception))
        self._save("exceptions", exceptions)
        return True

    def get_all_exceptions(self) -> List[ExceptionRecord]:
        return [from_dict(ExceptionRecord, e) for e in self._load("exceptions")]

    def get_unresolved_exceptions(self) -> List[ExceptionRecord]:
        exceptions = self._load("exceptions")
        return [from_dict(ExceptionRecord, e) for e in exceptions if not e["resolved"]]
