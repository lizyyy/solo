import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional, Any, TypeVar, Type

from .models import (
    Employee, SalaryItem, Attendance, Leave, Allowance, Deduction,
    Tax, BankResponse, Anomaly, Correction, ImportRecord, CheckRun,
    to_dict, from_dict
)


T = TypeVar('T')


class StorageManager:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self._ensure_dirs()

    def _ensure_dirs(self):
        subdirs = [
            "employees", "salary_items", "attendances", "leaves",
            "allowances", "deductions", "taxes", "bank_responses",
            "anomalies", "corrections", "import_records", "check_runs"
        ]
        for subdir in subdirs:
            path = os.path.join(self.data_dir, subdir)
            os.makedirs(path, exist_ok=True)

    def _get_file_path(self, data_type: str, month: Optional[str] = None, obj_id: Optional[str] = None) -> str:
        base_path = os.path.join(self.data_dir, data_type)
        if month:
            base_path = os.path.join(base_path, month)
            os.makedirs(base_path, exist_ok=True)
        if obj_id:
            return os.path.join(base_path, f"{obj_id}.json")
        return base_path

    def _save_obj(self, data_type: str, month: Optional[str], obj_id: str, obj: Any):
        file_path = self._get_file_path(data_type, month, obj_id)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(to_dict(obj), f, ensure_ascii=False, indent=2)

    def _load_obj(self, data_type: str, month: Optional[str], obj_id: str, cls: Type[T]) -> Optional[T]:
        file_path = self._get_file_path(data_type, month, obj_id)
        if os.path.exists(file_path):
            with open(file_path, "r", encoding="utf-8") as f:
                return from_dict(json.load(f), cls)
        return None

    def _list_objs(self, data_type: str, month: Optional[str], cls: Type[T]) -> List[T]:
        base_path = self._get_file_path(data_type, month)
        if not os.path.exists(base_path):
            return []
        objs = []
        for filename in os.listdir(base_path):
            if filename.endswith(".json"):
                obj_id = filename[:-5]
                obj = self._load_obj(data_type, month, obj_id, cls)
                if obj:
                    objs.append(obj)
        return objs

    def _idempotent_save(self, data_type: str, month: Optional[str], obj: Any, id_attr: str):
        obj_id = getattr(obj, id_attr)
        existing = self._load_obj(data_type, month, obj_id, type(obj))
        if existing is None:
            self._save_obj(data_type, month, obj_id, obj)
            return "created"
        if to_dict(existing) != to_dict(obj):
            self._save_obj(data_type, month, obj_id, obj)
            return "updated"
        return "unchanged"

    def save_employee(self, employee: Employee) -> str:
        return self._idempotent_save("employees", None, employee, "emp_id")

    def get_employee(self, emp_id: str) -> Optional[Employee]:
        return self._load_obj("employees", None, emp_id, Employee)

    def list_employees(self) -> List[Employee]:
        return self._list_objs("employees", None, Employee)

    def save_salary_item(self, item: SalaryItem) -> str:
        return self._idempotent_save("salary_items", item.month, item, "emp_id")

    def get_salary_item(self, emp_id: str, month: str) -> Optional[SalaryItem]:
        return self._load_obj("salary_items", month, emp_id, SalaryItem)

    def list_salary_items(self, month: str) -> List[SalaryItem]:
        return self._list_objs("salary_items", month, SalaryItem)

    def save_attendance(self, attendance: Attendance) -> str:
        return self._idempotent_save("attendances", attendance.month, attendance, "emp_id")

    def get_attendance(self, emp_id: str, month: str) -> Optional[Attendance]:
        return self._load_obj("attendances", month, emp_id, Attendance)

    def list_attendances(self, month: str) -> List[Attendance]:
        return self._list_objs("attendances", month, Attendance)

    def save_leave(self, leave: Leave) -> str:
        return self._idempotent_save("leaves", None, leave, "leave_id")

    def get_leave(self, leave_id: str) -> Optional[Leave]:
        return self._load_obj("leaves", None, leave_id, Leave)

    def list_leaves(self) -> List[Leave]:
        return self._list_objs("leaves", None, Leave)

    def list_leaves_by_emp(self, emp_id: str) -> List[Leave]:
        return [l for l in self.list_leaves() if l.emp_id == emp_id]

    def save_allowance(self, allowance: Allowance) -> str:
        return self._idempotent_save("allowances", allowance.month, allowance, "allowance_id")

    def list_allowances(self, month: str) -> List[Allowance]:
        return self._list_objs("allowances", month, Allowance)

    def list_allowances_by_emp(self, emp_id: str, month: str) -> List[Allowance]:
        return [a for a in self.list_allowances(month) if a.emp_id == emp_id]

    def save_deduction(self, deduction: Deduction) -> str:
        return self._idempotent_save("deductions", deduction.month, deduction, "deduction_id")

    def list_deductions(self, month: str) -> List[Deduction]:
        return self._list_objs("deductions", month, Deduction)

    def list_deductions_by_emp(self, emp_id: str, month: str) -> List[Deduction]:
        return [d for d in self.list_deductions(month) if d.emp_id == emp_id]

    def save_tax(self, tax: Tax) -> str:
        return self._idempotent_save("taxes", tax.month, tax, "emp_id")

    def get_tax(self, emp_id: str, month: str) -> Optional[Tax]:
        return self._load_obj("taxes", month, emp_id, Tax)

    def list_taxes(self, month: str) -> List[Tax]:
        return self._list_objs("taxes", month, Tax)

    def save_bank_response(self, response: BankResponse) -> str:
        return self._idempotent_save("bank_responses", response.month, response, "response_id")

    def list_bank_responses(self, month: str) -> List[BankResponse]:
        return self._list_objs("bank_responses", month, BankResponse)

    def list_bank_responses_by_emp(self, emp_id: str, month: str) -> List[BankResponse]:
        return [r for r in self.list_bank_responses(month) if r.emp_id == emp_id]

    def save_anomaly(self, anomaly: Anomaly):
        self._save_obj("anomalies", anomaly.month, anomaly.anomaly_id, anomaly)

    def get_anomaly(self, anomaly_id: str, month: str) -> Optional[Anomaly]:
        return self._load_obj("anomalies", month, anomaly_id, Anomaly)

    def list_anomalies(self, month: str) -> List[Anomaly]:
        return self._list_objs("anomalies", month, Anomaly)

    def list_anomalies_by_emp(self, emp_id: str, month: str) -> List[Anomaly]:
        return [a for a in self.list_anomalies(month) if a.emp_id == emp_id]

    def save_correction(self, correction: Correction):
        self._save_obj("corrections", correction.month, correction.correction_id, correction)

    def list_corrections(self, month: str) -> List[Correction]:
        return self._list_objs("corrections", month, Correction)

    def list_corrections_by_emp(self, emp_id: str, month: str) -> List[Correction]:
        return [c for c in self.list_corrections(month) if c.emp_id == emp_id]

    def save_import_record(self, record: ImportRecord):
        self._save_obj("import_records", record.month, record.record_id, record)

    def list_import_records(self, month: Optional[str] = None) -> List[ImportRecord]:
        if month:
            return self._list_objs("import_records", month, ImportRecord)
        records = []
        base_path = self._get_file_path("import_records", None)
        if os.path.exists(base_path):
            for subdir in os.listdir(base_path):
                subpath = os.path.join(base_path, subdir)
                if os.path.isdir(subpath):
                    records.extend(self._list_objs("import_records", subdir, ImportRecord))
        return records

    def save_check_run(self, run: CheckRun):
        self._save_obj("check_runs", run.month, run.run_id, run)

    def list_check_runs(self, month: Optional[str] = None) -> List[CheckRun]:
        if month:
            return self._list_objs("check_runs", month, CheckRun)
        runs = []
        base_path = self._get_file_path("check_runs", None)
        if os.path.exists(base_path):
            for subdir in os.listdir(base_path):
                subpath = os.path.join(base_path, subdir)
                if os.path.isdir(subpath):
                    runs.extend(self._list_objs("check_runs", subdir, CheckRun))
        return runs

    def clear_month_data(self, month: str, data_types: Optional[List[str]] = None):
        all_types = ["salary_items", "attendances", "allowances", "deductions", 
                     "taxes", "bank_responses", "anomalies", "corrections", 
                     "import_records", "check_runs"]
        types_to_clear = data_types or all_types
        for data_type in types_to_clear:
            path = self._get_file_path(data_type, month)
            if os.path.exists(path):
                for filename in os.listdir(path):
                    if filename.endswith(".json"):
                        os.remove(os.path.join(path, filename))

    @staticmethod
    def generate_id() -> str:
        return uuid.uuid4().hex[:12]
