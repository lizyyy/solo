import json
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

import pandas as pd

from .models import (
    ProjectConfig,
    ImportRecord,
    CalibrationRecord,
    AlignmentRecord,
    AnalysisRecord,
    HistoryRecord,
)


def generate_id() -> str:
    return uuid.uuid4().hex[:12]


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class ProjectStorage:
    def __init__(self, project_path: Path):
        self.project_path = project_path
        self.config_path = project_path / "config.json"
        self.data_path = project_path / "data"
        self.output_path = project_path / "output"
        self.quarantine_path = project_path / "quarantine"
        self.history_path = project_path / "history"
        self.work_path = project_path / "work"

    def init_directories(self) -> None:
        self.project_path.mkdir(parents=True, exist_ok=True)
        self.data_path.mkdir(exist_ok=True)
        self.output_path.mkdir(exist_ok=True)
        self.quarantine_path.mkdir(exist_ok=True)
        self.history_path.mkdir(exist_ok=True)
        self.work_path.mkdir(exist_ok=True)

    def save_config(self, config: ProjectConfig) -> None:
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=2, ensure_ascii=False, cls=DateTimeEncoder)

    def load_config(self) -> ProjectConfig:
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ProjectConfig.model_validate(data)

    def is_project_initialized(self) -> bool:
        return self.config_path.exists()

    def copy_data_file(self, source_path: Path, original_name: str) -> str:
        stored_name = f"{generate_id()}_{original_name}"
        dest_path = self.data_path / stored_name
        shutil.copy2(source_path, dest_path)
        return stored_name

    def get_data_file_path(self, stored_filename: str) -> Path:
        return self.data_path / stored_filename

    def list_data_files(self) -> List[Path]:
        return list(self.data_path.glob("*"))


class HistoryManager:
    def __init__(self, storage: ProjectStorage):
        self.storage = storage
        self.history_file = storage.history_path / "history.json"
        self._load_history()

    def _load_history(self) -> List[Dict[str, Any]]:
        if not self.history_file.exists():
            return []
        with open(self.history_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_history(self, records: List[Dict[str, Any]]) -> None:
        with open(self.history_file, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, ensure_ascii=False, cls=DateTimeEncoder)

    def add_import(self, record: ImportRecord) -> None:
        self._add_record("import", record.model_dump())

    def add_calibration(self, record: CalibrationRecord) -> None:
        self._add_record("calibration", record.model_dump())

    def add_alignment(self, record: AlignmentRecord) -> None:
        self._add_record("alignment", record.model_dump())

    def add_analysis(self, record: AnalysisRecord) -> None:
        self._add_record("analysis", record.model_dump())

    def _add_record(self, record_type: str, data: Dict[str, Any]) -> None:
        history = self._load_history()
        record = HistoryRecord(record_type=record_type, record=data)
        history.append(record.model_dump())
        self._save_history(history)

    def get_all(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        history = self._load_history()
        if limit:
            return history[-limit:]
        return history

    def get_by_type(self, record_type: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        history = [r for r in self._load_history() if r["record_type"] == record_type]
        if limit:
            return history[-limit:]
        return history

    def get_imports(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        return self.get_by_type("import", limit)

    def get_calibrations(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        return self.get_by_type("calibration", limit)

    def get_alignments(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        return self.get_by_type("alignment", limit)

    def get_analyses(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        return self.get_by_type("analysis", limit)

    def get_latest_calibration(self) -> Optional[Dict[str, Any]]:
        calibrations = self.get_calibrations(limit=1)
        return calibrations[0]["record"] if calibrations else None

    def get_latest_alignment(self) -> Optional[Dict[str, Any]]:
        alignments = self.get_alignments(limit=1)
        return alignments[0]["record"] if alignments else None

    def get_latest_analysis(self) -> Optional[Dict[str, Any]]:
        analyses = self.get_analyses(limit=1)
        return analyses[0]["record"] if analyses else None


class Workspace:
    def __init__(self, storage: ProjectStorage):
        self.storage = storage
        self.work_path = storage.work_path

    def save_dataframe(self, name: str, df: pd.DataFrame) -> Path:
        path = self.work_path / f"{name}.parquet"
        df.to_parquet(path)
        return path

    def load_dataframe(self, name: str) -> pd.DataFrame:
        path = self.work_path / f"{name}.parquet"
        return pd.read_parquet(path)

    def save_json(self, name: str, data: Dict[str, Any]) -> Path:
        path = self.work_path / f"{name}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, cls=DateTimeEncoder)
        return path

    def load_json(self, name: str) -> Dict[str, Any]:
        path = self.work_path / f"{name}.json"
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_work_files(self) -> List[Path]:
        return list(self.work_path.glob("*"))
