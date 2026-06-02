import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from .models import (
    EvaluationRecord,
    EvaluationReport,
    ModelVersion,
    RecordStatus,
)


class ReportStorage:
    def __init__(self, reports_dir: str):
        self.reports_dir = Path(reports_dir)
        self.reports_dir.mkdir(parents=True, exist_ok=True)

    def generate_report_id(self, model_version: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        short_uuid = uuid.uuid4().hex[:8]
        return f"eval_report_{model_version}_{timestamp}_{short_uuid}"

    def save_report(
        self,
        report: EvaluationReport,
        records: List[EvaluationRecord],
    ) -> str:
        report_id = report.report_id
        report_dir = self.reports_dir / report_id
        report_dir.mkdir(parents=True, exist_ok=True)

        report_path = report_dir / "report_summary.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report.model_dump(), f, ensure_ascii=False, indent=2, default=str)

        records_path = report_dir / "evaluation_details.jsonl"
        with open(records_path, "w", encoding="utf-8") as f:
            for record in records:
                f.write(json.dumps(record.model_dump(), ensure_ascii=False, default=str) + "\n")

        return str(report_dir)

    def load_report(self, report_id: str) -> Optional[EvaluationReport]:
        report_path = self.reports_dir / report_id / "report_summary.json"
        if not report_path.exists():
            return None
        
        with open(report_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            data["created_at"] = datetime.fromisoformat(data["created_at"])
            return EvaluationReport(**data)

    def load_report_records(self, report_id: str) -> List[EvaluationRecord]:
        records_path = self.reports_dir / report_id / "evaluation_details.jsonl"
        if not records_path.exists():
            return []
        
        records = []
        with open(records_path, "r", encoding="utf-8") as f:
            for line in f:
                data = json.loads(line.strip())
                data["created_at"] = datetime.fromisoformat(data["created_at"])
                data["modified_at"] = datetime.fromisoformat(data["modified_at"])
                records.append(EvaluationRecord(**data))
        
        return records

    def list_reports(self, model_version: Optional[str] = None) -> List[str]:
        reports = []
        for report_dir in sorted(self.reports_dir.iterdir(), reverse=True):
            if report_dir.is_dir():
                if model_version:
                    if model_version in report_dir.name:
                        reports.append(report_dir.name)
                else:
                    reports.append(report_dir.name)
        return reports

    def get_latest_report(self, model_version: Optional[str] = None) -> Optional[EvaluationReport]:
        reports = self.list_reports(model_version)
        if not reports:
            return None
        return self.load_report(reports[0])


class ModelVersionManager:
    def __init__(self, config_path: str):
        self.config_path = Path(config_path)
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.versions: Dict[str, ModelVersion] = {}
        self._load_versions()

    def _load_versions(self):
        if not self.config_path.exists():
            self._save_versions()
            return
        
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for version_data in data.get("versions", []):
                version_data["created_at"] = datetime.fromisoformat(version_data["created_at"])
                version = ModelVersion(**version_data)
                self.versions[version.version] = version

    def _save_versions(self):
        versions_list = []
        for version in self.versions.values():
            versions_list.append(version.model_dump())
        
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump({"versions": versions_list}, f, ensure_ascii=False, indent=2, default=str)

    def add_version(
        self,
        version: str,
        description: str,
        threshold_config: Optional[Dict[str, float]] = None,
        set_active: bool = False,
    ) -> ModelVersion:
        if version in self.versions:
            raise ValueError(f"模型版本 {version} 已存在")

        model_version = ModelVersion(
            version=version,
            description=description,
            is_active=False,
            threshold_config=threshold_config or {},
        )

        if set_active:
            for v in self.versions.values():
                v.is_active = False
            model_version.is_active = True

        self.versions[version] = model_version
        self._save_versions()
        return model_version

    def get_version(self, version: str) -> Optional[ModelVersion]:
        return self.versions.get(version)

    def list_versions(self) -> List[ModelVersion]:
        return sorted(
            self.versions.values(),
            key=lambda v: v.created_at,
            reverse=True,
        )

    def set_active(self, version: str) -> bool:
        if version not in self.versions:
            return False
        
        for v in self.versions.values():
            v.is_active = False
        
        self.versions[version].is_active = True
        self._save_versions()
        return True

    def get_active_version(self) -> Optional[ModelVersion]:
        for version in self.versions.values():
            if version.is_active:
                return version
        return None
