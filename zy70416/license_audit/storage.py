import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path

from .models import (
    Dependency,
    AuditRecord,
    EvidenceItem,
    DetectionRule,
    DetectionStatus,
    ManualStatus,
    SourceLocation,
    FieldError,
    AuditResult,
)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, (DetectionStatus, ManualStatus)):
            return obj.value
        return super().default(obj)


class Storage:
    def __init__(self, base_dir: str = "data"):
        self.base_dir = Path(base_dir)
        self.raw_dir = self.base_dir / "raw"
        self.audit_dir = self.base_dir / "audit"
        self.results_dir = self.base_dir / "results"

        self._ensure_dirs()

    def _ensure_dirs(self):
        for dir_path in [self.raw_dir, self.audit_dir, self.results_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

    def _to_dict(self, obj: Any) -> Dict:
        if hasattr(obj, "__dataclass_fields__"):
            result = {}
            for field in obj.__dataclass_fields__:
                value = getattr(obj, field)
                if hasattr(value, "__dataclass_fields__"):
                    result[field] = self._to_dict(value)
                elif isinstance(value, list):
                    result[field] = [
                        self._to_dict(item) if hasattr(item, "__dataclass_fields__") else item
                        for item in value
                    ]
                elif isinstance(value, dict):
                    result[field] = value
                else:
                    result[field] = value
            return result
        return obj

    def _from_dict(self, data: Dict, cls: type) -> Any:
        kwargs = {}
        for field_name, field_type in cls.__dataclass_fields__.items():
            if field_name in data:
                value = data[field_name]
                if field_name == "source_location" and value:
                    kwargs[field_name] = self._from_dict(value, SourceLocation)
                elif field_name == "field_errors" and value:
                    kwargs[field_name] = [self._from_dict(e, FieldError) for e in value]
                elif field_name == "system_status" and value:
                    kwargs[field_name] = DetectionStatus(value)
                elif field_name == "manual_status" and value:
                    kwargs[field_name] = ManualStatus(value)
                elif field_name in ["created_at", "updated_at", "generated_at"] and value:
                    kwargs[field_name] = datetime.fromisoformat(value)
                else:
                    kwargs[field_name] = value
        return cls(**kwargs)

    def save_dependencies(self, dependencies: List[Dependency], filename: str):
        file_path = self.raw_dir / f"{filename}.json"
        data = [self._to_dict(dep) for dep in dependencies]
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
        return str(file_path)

    def load_dependencies(self, filename: str) -> List[Dependency]:
        file_path = self.raw_dir / f"{filename}.json"
        if not file_path.exists():
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [self._from_dict(d, Dependency) for d in data]

    def list_dependency_files(self) -> List[str]:
        return [f.stem for f in self.raw_dir.glob("*.json")]

    def save_audit_records(self, records: List[AuditRecord], filename: str):
        file_path = self.audit_dir / f"{filename}_records.json"
        data = [self._to_dict(record) for record in records]
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
        return str(file_path)

    def load_audit_records(self, filename: str) -> List[AuditRecord]:
        file_path = self.audit_dir / f"{filename}_records.json"
        if not file_path.exists():
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [self._from_dict(r, AuditRecord) for r in data]

    def save_evidences(self, evidences: List[EvidenceItem], filename: str):
        file_path = self.audit_dir / f"{filename}_evidences.json"
        data = [self._to_dict(ev) for ev in evidences]
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
        return str(file_path)

    def load_evidences(self, filename: str) -> List[EvidenceItem]:
        file_path = self.audit_dir / f"{filename}_evidences.json"
        if not file_path.exists():
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [self._from_dict(e, EvidenceItem) for e in data]

    def save_result(self, result: AuditResult, filename: str):
        file_path = self.results_dir / f"{filename}.json"
        data = self._to_dict(result)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
        return str(file_path)

    def load_result(self, filename: str) -> Optional[AuditResult]:
        file_path = self.results_dir / f"{filename}.json"
        if not file_path.exists():
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._from_dict(data, AuditResult)

    def list_results(self) -> List[str]:
        return [f.stem for f in self.results_dir.glob("*.json")]

    def find_records_by_environment(self, environment_name: str) -> List[AuditRecord]:
        all_records = []
        for record_file in self.audit_dir.glob("*_records.json"):
            with open(record_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            records = [self._from_dict(r, AuditRecord) for r in data]
            all_records.extend([r for r in records if r.environment_name == environment_name])
        return all_records

    def find_dependency_by_id(self, dependency_id: str) -> Optional[Dependency]:
        for dep_file in self.raw_dir.glob("*.json"):
            with open(dep_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for dep_data in data:
                if dep_data.get("id") == dependency_id:
                    return self._from_dict(dep_data, Dependency)
        return None

    def update_audit_record(self, record: AuditRecord, filename: str):
        records = self.load_audit_records(filename)
        for i, r in enumerate(records):
            if r.id == record.id:
                records[i] = record
                break
        else:
            records.append(record)
        self.save_audit_records(records, filename)
