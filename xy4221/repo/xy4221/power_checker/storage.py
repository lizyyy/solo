import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from .config import ProjectConfig, get_data_dir
from .models import (
    LogRecord,
    PlanRecord,
    AnalysisResult,
    Risk,
    PowerUnit,
    RecordStatus,
    RiskType,
    RiskSeverity,
    ReviewStatus,
)


class DataStorage:
    def __init__(self, config: ProjectConfig, target_dir: str = None):
        self.config = config
        self.data_dir = get_data_dir(config, target_dir)
        self.logs_dir = self.data_dir / "logs"
        self.plans_dir = self.data_dir / "plans"
        self.quarantine_dir = self.data_dir / "quarantine"
        self.analysis_dir = self.data_dir / "analysis"
        self.review_dir = self.data_dir / "review"
        
        self._ensure_dirs()

    def _ensure_dirs(self):
        for dir_path in [
            self.logs_dir, self.plans_dir, self.quarantine_dir,
            self.analysis_dir, self.review_dir
        ]:
            dir_path.mkdir(parents=True, exist_ok=True)

    def save_log_records(self, records: List[LogRecord], source_file: str):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        source_name = Path(source_file).stem
        filename = f"{source_name}_{timestamp}.csv"
        filepath = self.logs_dir / filename
        
        if not records:
            return None

        fieldnames = [
            "id", "timestamp", "circuit_id", "current", "unit",
            "phase", "voltage", "power_factor", "status", "quarantine_reason"
        ]
        
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for record in records:
                row = {
                    "id": record.id,
                    "timestamp": record.timestamp.isoformat(),
                    "circuit_id": record.circuit_id,
                    "current": record.current,
                    "unit": record.unit.value,
                    "phase": record.phase or "",
                    "voltage": record.voltage or "",
                    "power_factor": record.power_factor or "",
                    "status": record.status.value,
                    "quarantine_reason": record.quarantine_reason or "",
                }
                writer.writerow(row)
        
        return filepath

    def save_quarantined_logs(self, records: List[LogRecord], source_file: str):
        if not records:
            return None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        source_name = Path(source_file).stem
        filename = f"logs_{source_name}_{timestamp}.csv"
        filepath = self.quarantine_dir / filename

        fieldnames = [
            "timestamp", "circuit_id", "current", "unit",
            "phase", "voltage", "power_factor", "raw_data", "quarantine_reason"
        ]
        
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for record in records:
                row = {
                    "timestamp": record.timestamp.isoformat(),
                    "circuit_id": record.circuit_id,
                    "current": record.current,
                    "unit": record.unit.value,
                    "phase": record.phase or "",
                    "voltage": record.voltage or "",
                    "power_factor": record.power_factor or "",
                    "raw_data": json.dumps(record.raw_data, ensure_ascii=False),
                    "quarantine_reason": record.quarantine_reason or "",
                }
                writer.writerow(row)
        
        return filepath

    def save_plan_records(self, records: List[PlanRecord], source_file: str):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        source_name = Path(source_file).stem
        filename = f"{source_name}_{timestamp}.csv"
        filepath = self.plans_dir / filename
        
        if not records:
            return None

        fieldnames = [
            "id", "circuit_id", "device_name", "device_id",
            "power_on_time", "power_off_time", "expected_current", "unit",
            "status", "quarantine_reason"
        ]
        
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for record in records:
                row = {
                    "id": record.id,
                    "circuit_id": record.circuit_id,
                    "device_name": record.device_name,
                    "device_id": record.device_id,
                    "power_on_time": record.power_on_time.isoformat() if record.power_on_time else "",
                    "power_off_time": record.power_off_time.isoformat() if record.power_off_time else "",
                    "expected_current": record.expected_current or "",
                    "unit": record.unit.value if record.unit else "",
                    "status": record.status.value,
                    "quarantine_reason": record.quarantine_reason or "",
                }
                writer.writerow(row)
        
        return filepath

    def save_quarantined_plans(self, records: List[PlanRecord], source_file: str):
        if not records:
            return None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        source_name = Path(source_file).stem
        filename = f"plans_{source_name}_{timestamp}.csv"
        filepath = self.quarantine_dir / filename

        fieldnames = [
            "circuit_id", "device_name", "device_id",
            "power_on_time", "power_off_time", "expected_current", "unit",
            "raw_data", "quarantine_reason"
        ]
        
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for record in records:
                row = {
                    "circuit_id": record.circuit_id,
                    "device_name": record.device_name,
                    "device_id": record.device_id,
                    "power_on_time": record.power_on_time.isoformat() if record.power_on_time else "",
                    "power_off_time": record.power_off_time.isoformat() if record.power_off_time else "",
                    "expected_current": record.expected_current or "",
                    "unit": record.unit.value if record.unit else "",
                    "raw_data": json.dumps(record.raw_data, ensure_ascii=False),
                    "quarantine_reason": record.quarantine_reason or "",
                }
                writer.writerow(row)
        
        return filepath

    def load_log_records(self) -> List[LogRecord]:
        records = []
        for file_path in sorted(self.logs_dir.glob("*.csv")):
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        record = LogRecord(
                            id=row.get("id", ""),
                            timestamp=datetime.fromisoformat(row["timestamp"]),
                            circuit_id=row["circuit_id"],
                            current=float(row["current"]),
                            unit=PowerUnit(row["unit"]) if row.get("unit") else PowerUnit.AMPERE,
                            phase=row.get("phase") or None,
                            voltage=float(row["voltage"]) if row.get("voltage") else None,
                            power_factor=float(row["power_factor"]) if row.get("power_factor") else None,
                            raw_data={},
                            status=RecordStatus(row["status"]) if row.get("status") else RecordStatus.VALID,
                            quarantine_reason=row.get("quarantine_reason"),
                        )
                        records.append(record)
                    except (KeyError, ValueError) as e:
                        continue
        return records

    def load_plan_records(self) -> List[PlanRecord]:
        records = []
        for file_path in sorted(self.plans_dir.glob("*.csv")):
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        record = PlanRecord(
                            id=row.get("id", ""),
                            circuit_id=row["circuit_id"],
                            device_name=row["device_name"],
                            device_id=row["device_id"],
                            power_on_time=datetime.fromisoformat(row["power_on_time"]) if row.get("power_on_time") else None,
                            power_off_time=datetime.fromisoformat(row["power_off_time"]) if row.get("power_off_time") else None,
                            expected_current=float(row["expected_current"]) if row.get("expected_current") else None,
                            unit=PowerUnit(row["unit"]) if row.get("unit") else None,
                            raw_data={},
                            status=RecordStatus(row["status"]) if row.get("status") else RecordStatus.VALID,
                            quarantine_reason=row.get("quarantine_reason"),
                        )
                        records.append(record)
                    except (KeyError, ValueError) as e:
                        continue
        return records

    def save_analysis_result(self, result: AnalysisResult):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"analysis_{timestamp}.json"
        filepath = self.analysis_dir / filename

        data = {
            "id": result.id,
            "generated_at": result.generated_at.isoformat(),
            "time_window_minutes": result.time_window_minutes,
            "peak_loads": result.peak_loads,
            "summary": result.summary,
            "risks": [self._risk_to_dict(r) for r in result.all_risks],
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return filepath

    def load_latest_analysis(self) -> Optional[AnalysisResult]:
        files = sorted(self.analysis_dir.glob("analysis_*.json"), reverse=True)
        if not files:
            return None
        
        with open(files[0], "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return self._dict_to_analysis_result(data)

    def load_all_analysis(self) -> List[AnalysisResult]:
        results = []
        for file_path in sorted(self.analysis_dir.glob("analysis_*.json"), reverse=True):
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            results.append(self._dict_to_analysis_result(data))
        return results

    def _risk_to_dict(self, risk: Risk) -> Dict[str, Any]:
        return {
            "id": risk.id,
            "risk_type": risk.risk_type.value,
            "severity": risk.severity.value,
            "message": risk.message,
            "timestamp": risk.timestamp.isoformat(),
            "circuit_id": risk.circuit_id,
            "device_id": risk.device_id,
            "device_name": risk.device_name,
            "related_record_ids": risk.related_record_ids,
            "details": risk.details,
            "review_status": risk.review_status.value,
            "review_note": risk.review_note,
        }

    def _dict_to_risk(self, data: Dict[str, Any]) -> Risk:
        return Risk(
            id=data.get("id", ""),
            risk_type=RiskType(data["risk_type"]),
            severity=RiskSeverity(data["severity"]),
            message=data["message"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
            circuit_id=data.get("circuit_id"),
            device_id=data.get("device_id"),
            device_name=data.get("device_name"),
            related_record_ids=data.get("related_record_ids", []),
            details=data.get("details", {}),
            review_status=ReviewStatus(data.get("review_status", "pending")),
            review_note=data.get("review_note"),
        )

    def _dict_to_analysis_result(self, data: Dict[str, Any]) -> AnalysisResult:
        risks = [self._dict_to_risk(r) for r in data.get("risks", [])]
        
        return AnalysisResult(
            id=data.get("id", ""),
            generated_at=datetime.fromisoformat(data["generated_at"]),
            time_window_minutes=data.get("time_window_minutes", 5),
            peak_loads=data.get("peak_loads", {}),
            all_risks=risks,
            summary=data.get("summary", {}),
        )

    def save_review_state(self, risks: List[Risk]):
        filepath = self.review_dir / "review_state.json"
        
        data = {
            "updated_at": datetime.now().isoformat(),
            "risks": [self._risk_to_dict(r) for r in risks],
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return filepath

    def load_review_state(self) -> Optional[List[Risk]]:
        filepath = self.review_dir / "review_state.json"
        if not filepath.exists():
            return None
        
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return [self._dict_to_risk(r) for r in data.get("risks", [])]
