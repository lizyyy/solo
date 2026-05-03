import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import uuid
import logging

from eeg_aligner.models import ClockCalibration, ValidationIssue, IssueType, IssueSeverity

logger = logging.getLogger(__name__)


class ClockCalibrationParser:
    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def parse(self, file_path: Path) -> List[ClockCalibration]:
        logger.info(f"Parsing clock calibration: {file_path}")
        self.issues = []
        
        calibrations = []
        
        if file_path.suffix.lower() == ".csv":
            calibrations = self._parse_csv(file_path)
        elif file_path.suffix.lower() == ".jsonl":
            calibrations = self._parse_jsonl(file_path)
        elif file_path.suffix.lower() == ".json":
            calibrations = self._parse_json(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
        
        calibrations.sort(key=lambda c: c.calibration_time)
        
        logger.info(f"Parsed {len(calibrations)} clock calibrations")
        return calibrations

    def _parse_csv(self, file_path: Path) -> List[ClockCalibration]:
        calibrations = []
        
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            
            for row_idx, row in enumerate(reader, start=2):
                try:
                    calibration = self._parse_row(row, row_idx)
                    calibrations.append(calibration)
                except Exception as e:
                    self._add_issue(
                        issue_type=IssueType.INVALID_TIMESTAMP,
                        severity=IssueSeverity.WARNING,
                        message=f"Row {row_idx}: Error parsing calibration - {e}",
                        details={"row": row_idx, "error": str(e)}
                    )
        
        return calibrations

    def _parse_jsonl(self, file_path: Path) -> List[ClockCalibration]:
        calibrations = []
        
        with open(file_path, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    calibration = self._parse_dict(data, line_idx)
                    calibrations.append(calibration)
                except json.JSONDecodeError as e:
                    self._add_issue(
                        issue_type=IssueType.INVALID_TIMESTAMP,
                        severity=IssueSeverity.ERROR if hasattr(IssueSeverity, 'ERROR') else IssueSeverity.CRITICAL,
                        message=f"Line {line_idx}: Invalid JSON - {e}",
                        details={"line": line_idx, "error": str(e)}
                    )
                except Exception as e:
                    self._add_issue(
                        issue_type=IssueType.INVALID_TIMESTAMP,
                        severity=IssueSeverity.WARNING,
                        message=f"Line {line_idx}: Error - {e}",
                        details={"line": line_idx, "error": str(e)}
                    )
        
        return calibrations

    def _parse_json(self, file_path: Path) -> List[ClockCalibration]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if isinstance(data, list):
            calibrations = []
            for idx, item in enumerate(data):
                try:
                    calibration = self._parse_dict(item, idx + 1)
                    calibrations.append(calibration)
                except Exception as e:
                    self._add_issue(
                        issue_type=IssueType.INVALID_TIMESTAMP,
                        severity=IssueSeverity.WARNING,
                        message=f"Item {idx}: Error - {e}",
                        details={"index": idx, "error": str(e)}
                    )
            return calibrations
        elif isinstance(data, dict):
            return [self._parse_dict(data, 1)]
        else:
            raise ValueError(f"Unexpected JSON format: {type(data)}")

    def _parse_row(self, row: Dict[str, str], row_idx: int) -> ClockCalibration:
        calibration_id = row.get("calibration_id", row.get("id", f"cal_{row_idx:04d}"))
        if not isinstance(calibration_id, str) or not calibration_id.strip():
            calibration_id = str(uuid.uuid4())
        
        calibration_time = self._get_timestamp(row, "calibration_time", "time", "timestamp")
        if calibration_time is None:
            raise ValueError(f"Row {row_idx}: Missing calibration_time")
        
        eeg_clock_time = self._get_timestamp(row, "eeg_time", "eeg_clock_time", "eeg_timestamp")
        if eeg_clock_time is None:
            raise ValueError(f"Row {row_idx}: Missing eeg_clock_time")
        
        stimulus_clock_time = self._get_timestamp(row, "stimulus_time", "stimulus_clock_time", "stimulus_timestamp", "trigger_time")
        if stimulus_clock_time is None:
            raise ValueError(f"Row {row_idx}: Missing stimulus_clock_time")
        
        drift_ms = self._get_drift(row, eeg_clock_time, stimulus_clock_time, row_idx)
        
        sync_event_code = self._get_sync_code(row)
        
        notes = row.get("notes", "").strip()
        
        return ClockCalibration(
            calibration_id=calibration_id,
            calibration_time=calibration_time,
            eeg_clock_time=eeg_clock_time,
            stimulus_clock_time=stimulus_clock_time,
            drift_ms=drift_ms,
            sync_event_code=sync_event_code,
            notes=notes
        )

    def _parse_dict(self, data: Dict[str, Any], idx: int) -> ClockCalibration:
        calibration_id = data.get("calibration_id", data.get("id", f"cal_{idx:04d}"))
        if not isinstance(calibration_id, str) or not calibration_id.strip():
            calibration_id = str(uuid.uuid4())
        
        calibration_time = self._get_timestamp_from_dict(data, "calibration_time", "time", "timestamp")
        if calibration_time is None:
            raise ValueError(f"Item {idx}: Missing calibration_time")
        
        eeg_clock_time = self._get_timestamp_from_dict(data, "eeg_time", "eeg_clock_time", "eeg_timestamp")
        if eeg_clock_time is None:
            raise ValueError(f"Item {idx}: Missing eeg_clock_time")
        
        stimulus_clock_time = self._get_timestamp_from_dict(data, "stimulus_time", "stimulus_clock_time", "stimulus_timestamp", "trigger_time")
        if stimulus_clock_time is None:
            raise ValueError(f"Item {idx}: Missing stimulus_clock_time")
        
        drift_ms = data.get("drift_ms")
        if drift_ms is None:
            delta = (eeg_clock_time - stimulus_clock_time).total_seconds() * 1000
            drift_ms = delta
        else:
            try:
                drift_ms = float(drift_ms)
            except (ValueError, TypeError):
                delta = (eeg_clock_time - stimulus_clock_time).total_seconds() * 1000
                drift_ms = delta
        
        sync_event_code = data.get("sync_event_code")
        if sync_event_code is not None:
            try:
                sync_event_code = int(sync_event_code)
            except (ValueError, TypeError):
                sync_event_code = None
        
        notes = str(data.get("notes", "")).strip()
        
        return ClockCalibration(
            calibration_id=calibration_id,
            calibration_time=calibration_time,
            eeg_clock_time=eeg_clock_time,
            stimulus_clock_time=stimulus_clock_time,
            drift_ms=drift_ms,
            sync_event_code=sync_event_code,
            notes=notes
        )

    def _get_timestamp(self, row: Dict[str, str], *keys: str) -> Optional[datetime]:
        for key in keys:
            if key in row and row[key].strip():
                try:
                    return self._parse_timestamp(row[key])
                except ValueError:
                    pass
        return None

    def _get_timestamp_from_dict(self, data: Dict[str, Any], *keys: str) -> Optional[datetime]:
        for key in keys:
            if key in data and data[key]:
                try:
                    return self._parse_timestamp(data[key])
                except (ValueError, TypeError):
                    pass
        return None

    def _get_drift(self, row: Dict[str, str], eeg_time: datetime, stim_time: datetime, row_idx: int) -> float:
        for key in ["drift_ms", "drift", "clock_drift", "offset_ms", "offset"]:
            if key in row and row[key].strip():
                try:
                    return float(row[key])
                except ValueError:
                    pass
        
        delta = (eeg_time - stim_time).total_seconds() * 1000
        return delta

    def _get_sync_code(self, row: Dict[str, str]) -> Optional[int]:
        for key in ["sync_event_code", "sync_code", "sync", "trigger_code"]:
            if key in row and row[key].strip():
                try:
                    return int(row[key])
                except ValueError:
                    pass
        return None

    def _parse_timestamp(self, timestamp_str: Any) -> datetime:
        if isinstance(timestamp_str, (int, float)):
            try:
                return datetime.fromtimestamp(timestamp_str)
            except (ValueError, OSError):
                try:
                    return datetime.fromtimestamp(timestamp_str / 1000.0)
                except (ValueError, OSError):
                    pass
        
        timestamp_str = str(timestamp_str).strip()
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S.%f",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"Unable to parse timestamp: {timestamp_str}")

    def _add_issue(
        self,
        issue_type: IssueType,
        severity: IssueSeverity,
        message: str,
        details: Optional[Dict[str, Any]] = None
    ):
        issue = ValidationIssue(
            issue_id=str(uuid.uuid4()),
            issue_type=issue_type,
            severity=severity,
            message=message,
            details=details or {},
            suggestion=""
        )
        self.issues.append(issue)

    def get_issues(self) -> List[ValidationIssue]:
        return self.issues
