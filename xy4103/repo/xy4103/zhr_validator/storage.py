import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from zhr_validator.models import (
    ProjectConfig,
    ObservationRecord,
    ValidationResult,
    QuarantineEntry,
    QuarantineLog,
    ZHRBatchResult,
    ZHRCalculation,
)


DEFAULT_CONFIG_NAME = "zhr_config.json"
DEFAULT_DATA_DIR = "data"
DEFAULT_OUTPUT_DIR = "output"
DEFAULT_QUARANTINE_FILE = "quarantine.json"


class StorageManager:
    def __init__(self, project_dir: Optional[Path] = None):
        if project_dir is None:
            project_dir = Path.cwd()
        self.project_dir = project_dir
        self.config_path = project_dir / DEFAULT_CONFIG_NAME
        self.data_dir = project_dir / DEFAULT_DATA_DIR
        self.output_dir = project_dir / DEFAULT_OUTPUT_DIR
        self.quarantine_path = self.output_dir / DEFAULT_QUARANTINE_FILE

    def ensure_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def is_project_initialized(self) -> bool:
        return self.config_path.exists()

    def initialize_project(
        self,
        config: Optional[ProjectConfig] = None,
    ) -> ProjectConfig:
        if config is None:
            config = ProjectConfig()

        self.ensure_directories()
        self.save_config(config)
        return config

    def load_config(self) -> ProjectConfig:
        if not self.config_path.exists():
            return ProjectConfig()

        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return ProjectConfig(**data)

    def save_config(self, config: ProjectConfig) -> None:
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(
                config.model_dump(),
                f,
                ensure_ascii=False,
                indent=2,
                default=str,
            )

    def read_csv_file(
        self,
        file_path: Path,
    ) -> List[Dict[str, Any]]:
        records: List[Dict[str, Any]] = []

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                row_clean = {
                    k.strip(): v.strip() if isinstance(v, str) else v
                    for k, v in row.items()
                }
                records.append(row_clean)

        return records

    def read_csv_files(
        self,
        file_paths: List[Path],
    ) -> List[Tuple[Dict[str, Any], int, str]]:
        all_records: List[Tuple[Dict[str, Any], int, str]] = []

        for file_path in file_paths:
            file_name = file_path.name
            records = self.read_csv_file(file_path)
            for idx, record in enumerate(records):
                all_records.append((record, idx, file_name))

        return all_records

    def save_valid_records(
        self,
        records: List[ObservationRecord],
        filename: Optional[str] = None,
    ) -> Path:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"valid_records_{timestamp}.json"

        output_path = self.data_dir / filename

        records_data = [
            {
                "observer_name": r.observer_name,
                "observation_date": r.observation_date,
                "start_time": r.start_time,
                "end_time": r.end_time,
                "timezone": r.timezone,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "elevation": r.elevation,
                "cloud_cover": r.cloud_cover,
                "limiting_magnitude": r.limiting_magnitude,
                "meteor_count": r.meteor_count,
                "remarks": r.remarks,
                "source_file": r.source_file,
                "record_index": r.record_index,
            }
            for r in records
        ]

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(records_data, f, ensure_ascii=False, indent=2, default=str)

        return output_path

    def load_valid_records(
        self,
        filename: Optional[str] = None,
    ) -> List[ObservationRecord]:
        if filename is None:
            valid_files = sorted(
                self.data_dir.glob("valid_records_*.json"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if not valid_files:
                return []
            file_path = valid_files[0]
        else:
            file_path = self.data_dir / filename
            if not file_path.exists():
                return []

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        records: List[ObservationRecord] = []
        for item in data:
            try:
                record = ObservationRecord(**item)
                records.append(record)
            except Exception:
                continue

        return records

    def add_to_quarantine(
        self,
        raw_data: Dict[str, Any],
        record_index: int,
        source_file: str,
        issues: List[Any],
    ) -> None:
        quarantine_log = self.load_quarantine()

        entry = QuarantineEntry(
            source_file=source_file,
            record_index=record_index,
            raw_data=raw_data.copy(),
            issues=issues,
        )

        quarantine_log.entries.append(entry)
        self.save_quarantine(quarantine_log)

    def add_batch_to_quarantine(
        self,
        quarantine_items: List[Tuple[Dict[str, Any], int, str, List[Any]]],
    ) -> None:
        for raw_data, record_index, source_file, issues in quarantine_items:
            self.add_to_quarantine(raw_data, record_index, source_file, issues)

    def load_quarantine(self) -> QuarantineLog:
        if not self.quarantine_path.exists():
            return QuarantineLog()

        with open(self.quarantine_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        entries: List[QuarantineEntry] = []
        for entry_data in data.get("entries", []):
            try:
                entry = QuarantineEntry(**entry_data)
                entries.append(entry)
            except Exception:
                continue

        quarantined_at = data.get("quarantined_at")
        if quarantined_at:
            try:
                dt = datetime.fromisoformat(quarantined_at)
            except Exception:
                dt = datetime.now()
        else:
            dt = datetime.now()

        return QuarantineLog(entries=entries, quarantined_at=dt)

    def save_quarantine(self, log: QuarantineLog) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)

        data = {
            "entries": [
                {
                    "source_file": e.source_file,
                    "record_index": e.record_index,
                    "raw_data": e.raw_data,
                    "issues": [
                        {
                            "code": i.code,
                            "severity": i.severity,
                            "message": i.message,
                            "field": i.field,
                            "value": i.value,
                            "suggestion": i.suggestion,
                        }
                        for i in e.issues
                    ],
                    "quarantined_at": e.quarantined_at.isoformat(),
                }
                for e in log.entries
            ],
            "quarantined_at": log.quarantined_at.isoformat(),
        }

        with open(self.quarantine_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def clear_quarantine(self) -> int:
        count = 0
        if self.quarantine_path.exists():
            log = self.load_quarantine()
            count = len(log.entries)
            self.quarantine_path.unlink()
        return count

    def save_zhr_result(
        self,
        result: ZHRBatchResult,
        filename: Optional[str] = None,
    ) -> Path:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"zhr_result_{timestamp}.json"

        output_path = self.output_dir / filename

        data = {
            "shower_name": result.shower_name,
            "observation_date": result.observation_date,
            "total_records": result.total_records,
            "reliable_records": result.reliable_records,
            "unreliable_records": result.unreliable_records,
            "mean_zhr": result.mean_zhr,
            "median_zhr": result.median_zhr,
            "weighted_mean_zhr": result.weighted_mean_zhr,
            "zhr_lower_aggregate": result.zhr_lower_aggregate,
            "zhr_upper_aggregate": result.zhr_upper_aggregate,
            "calculations": [
                {
                    "record_id": c.record_id,
                    "observer_name": c.observer_name,
                    "observation_date": c.observation_date,
                    "utc_start": c.utc_start.isoformat(),
                    "utc_end": c.utc_end.isoformat(),
                    "duration_hours": c.duration_hours,
                    "latitude": c.latitude,
                    "longitude": c.longitude,
                    "meteor_count": c.meteor_count,
                    "cloud_cover": c.cloud_cover,
                    "limiting_magnitude": c.limiting_magnitude,
                    "raw_zhr": c.raw_zhr,
                    "population_index": c.population_index,
                    "cloud_correction_factor": c.cloud_correction_factor,
                    "limiting_mag_correction_factor": c.limiting_mag_correction_factor,
                    "corrected_zhr": c.corrected_zhr,
                    "zhr_lower": c.zhr_lower,
                    "zhr_upper": c.zhr_upper,
                    "confidence_level": c.confidence_level,
                    "observation_weight": c.observation_weight,
                    "is_bad_weather": c.is_bad_weather,
                    "is_reliable": c.is_reliable,
                }
                for c in result.calculations
            ],
            "calculated_at": result.calculated_at.isoformat(),
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return output_path

    def load_zhr_result(
        self,
        filename: Optional[str] = None,
    ) -> Optional[ZHRBatchResult]:
        if filename is None:
            zhr_files = sorted(
                self.output_dir.glob("zhr_result_*.json"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if not zhr_files:
                return None
            file_path = zhr_files[0]
        else:
            file_path = self.output_dir / filename
            if not file_path.exists():
                return None

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            calculations: List[ZHRCalculation] = []
            for calc_data in data.get("calculations", []):
                try:
                    calc = ZHRCalculation(
                        record_id=calc_data["record_id"],
                        observer_name=calc_data["observer_name"],
                        observation_date=calc_data["observation_date"],
                        utc_start=datetime.fromisoformat(calc_data["utc_start"]),
                        utc_end=datetime.fromisoformat(calc_data["utc_end"]),
                        duration_hours=calc_data["duration_hours"],
                        latitude=calc_data["latitude"],
                        longitude=calc_data["longitude"],
                        meteor_count=calc_data["meteor_count"],
                        cloud_cover=calc_data["cloud_cover"],
                        limiting_magnitude=calc_data["limiting_magnitude"],
                        raw_zhr=calc_data["raw_zhr"],
                        population_index=calc_data["population_index"],
                        cloud_correction_factor=calc_data["cloud_correction_factor"],
                        limiting_mag_correction_factor=calc_data["limiting_mag_correction_factor"],
                        corrected_zhr=calc_data["corrected_zhr"],
                        zhr_lower=calc_data["zhr_lower"],
                        zhr_upper=calc_data["zhr_upper"],
                        confidence_level=calc_data["confidence_level"],
                        observation_weight=calc_data["observation_weight"],
                        is_bad_weather=calc_data["is_bad_weather"],
                    )
                    calculations.append(calc)
                except Exception:
                    continue

            calculated_at = data.get("calculated_at")
            if calculated_at:
                try:
                    dt = datetime.fromisoformat(calculated_at)
                except Exception:
                    dt = datetime.now()
            else:
                dt = datetime.now()

            return ZHRBatchResult(
                shower_name=data.get("shower_name", "未指定流星雨"),
                observation_date=data.get("observation_date", ""),
                total_records=data.get("total_records", 0),
                reliable_records=data.get("reliable_records", 0),
                unreliable_records=data.get("unreliable_records", 0),
                mean_zhr=data.get("mean_zhr", 0.0),
                median_zhr=data.get("median_zhr", 0.0),
                weighted_mean_zhr=data.get("weighted_mean_zhr", 0.0),
                zhr_lower_aggregate=data.get("zhr_lower_aggregate", 0.0),
                zhr_upper_aggregate=data.get("zhr_upper_aggregate", 0.0),
                calculations=calculations,
                calculated_at=dt,
            )
        except Exception:
            return None

    def list_data_files(self) -> List[Path]:
        if not self.data_dir.exists():
            return []
        return sorted(self.data_dir.iterdir())

    def list_output_files(self) -> List[Path]:
        if not self.output_dir.exists():
            return []
        return sorted(self.output_dir.iterdir())
