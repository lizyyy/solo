import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

from eeg_aligner.models import SleepStageEpoch, SleepStage, ValidationIssue, IssueType, IssueSeverity
import uuid

logger = logging.getLogger(__name__)


class SleepStagesParser:
    VALID_STAGES = {s.value for s in SleepStage}
    
    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def parse(self, file_path: Path, epoch_duration: float = 30.0) -> List[SleepStageEpoch]:
        logger.info(f"Parsing sleep stages: {file_path}")
        self.issues = []
        
        epochs = []
        
        if file_path.suffix.lower() == ".csv":
            epochs = self._parse_csv(file_path, epoch_duration)
        elif file_path.suffix.lower() == ".txt":
            epochs = self._parse_txt(file_path, epoch_duration)
        elif file_path.suffix.lower() == ".edf":
            raise ValueError("EDF parsing not implemented yet. Please export to CSV or TXT.")
        else:
            raise ValueError(f"Unsupported file format: {file_path.suffix}")
        
        epochs.sort(key=lambda e: e.epoch_number)
        
        logger.info(f"Parsed {len(epochs)} sleep stages")
        return epochs

    def _parse_csv(self, file_path: Path, epoch_duration: float) -> List[SleepStageEpoch]:
        epochs = []
        
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            
            for row_idx, row in enumerate(reader, start=2):
                try:
                    epoch = self._parse_csv_row(row, row_idx, epoch_duration)
                    epochs.append(epoch)
                except Exception as e:
                    self._add_issue(
                        issue_type=IssueType.INVALID_TIMESTAMP,
                        severity=IssueSeverity.WARNING,
                        message=f"Row {row_idx}: Error parsing epoch - {e}",
                        details={"row": row_idx, "error": str(e)}
                    )
        
        return epochs

    def _parse_csv_row(self, row: Dict[str, str], row_idx: int, epoch_duration: float) -> SleepStageEpoch:
        epoch_number = self._get_epoch_number(row, row_idx)
        stage = self._parse_stage(row.get("stage", row.get("sleep_stage", "")), row_idx)
        
        start_time = self._get_start_time(row, epoch_number, epoch_duration, row_idx)
        end_time = start_time + timedelta(seconds=epoch_duration)
        
        confidence = self._parse_confidence(row.get("confidence", "1.0"))
        is_manual = self._parse_manual_flag(row.get("is_manual", "true"))
        notes = row.get("notes", "").strip()
        
        duration = float(row.get("duration_seconds", epoch_duration))
        
        return SleepStageEpoch(
            epoch_number=epoch_number,
            stage=stage,
            start_time=start_time,
            end_time=end_time,
            duration_seconds=duration,
            confidence=confidence,
            is_manual=is_manual,
            notes=notes
        )

    def _parse_txt(self, file_path: Path, epoch_duration: float) -> List[SleepStageEpoch]:
        epochs = []
        
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        start_time = None
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith(";"):
                continue
            
            if line.lower().startswith("start_time:") or line.lower().startswith("start:"):
                try:
                    time_str = line.split(":", 1)[1].strip()
                    start_time = self._parse_timestamp(time_str)
                except ValueError:
                    pass
                continue
            
            parts = line.split()
            if not parts:
                continue
            
            if len(parts) >= 2:
                try:
                    epoch_number = int(parts[0])
                    stage_code = parts[1]
                except ValueError:
                    continue
            else:
                epoch_number = len(epochs) + 1
                stage_code = parts[0]
            
            try:
                stage = self._parse_stage(stage_code, len(epochs) + 2)
                
                if start_time:
                    epoch_start = start_time + timedelta(seconds=(epoch_number - 1) * epoch_duration)
                else:
                    epoch_start = datetime.now() + timedelta(seconds=(epoch_number - 1) * epoch_duration)
                
                epoch_end = epoch_start + timedelta(seconds=epoch_duration)
                
                epochs.append(SleepStageEpoch(
                    epoch_number=epoch_number,
                    stage=stage,
                    start_time=epoch_start,
                    end_time=epoch_end,
                    duration_seconds=epoch_duration
                ))
            except Exception as e:
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.WARNING,
                    message=f"Error parsing stage '{stage_code}': {e}",
                    details={"line": line, "error": str(e)}
                )
        
        return epochs

    def _get_epoch_number(self, row: Dict[str, str], row_idx: int) -> int:
        for key in ["epoch_number", "epoch", "index", "idx"]:
            if key in row and row[key].strip():
                try:
                    return int(row[key])
                except ValueError:
                    pass
        return row_idx - 1

    def _parse_stage(self, stage_str: str, row_idx: int) -> SleepStage:
        stage_str = stage_str.strip().upper()
        
        stage_map = {
            "W": SleepStage.WAKE,
            "WAKE": SleepStage.WAKE,
            "0": SleepStage.WAKE,
            "N1": SleepStage.N1,
            "1": SleepStage.N1,
            "S1": SleepStage.N1,
            "N2": SleepStage.N2,
            "2": SleepStage.N2,
            "S2": SleepStage.N2,
            "N3": SleepStage.N3,
            "3": SleepStage.N3,
            "S3": SleepStage.N3,
            "S4": SleepStage.N3,
            "4": SleepStage.N3,
            "REM": SleepStage.REM,
            "R": SleepStage.REM,
            "5": SleepStage.REM,
            "M": SleepStage.MOVEMENT,
            "MOVEMENT": SleepStage.MOVEMENT,
            "MVT": SleepStage.MOVEMENT,
            "?": SleepStage.UNKNOWN,
            "UNKNOWN": SleepStage.UNKNOWN,
            "X": SleepStage.UNKNOWN,
            "-1": SleepStage.UNKNOWN,
        }
        
        if stage_str in stage_map:
            return stage_map[stage_str]
        
        self._add_issue(
            issue_type=IssueType.STAGE_CONFLICT,
            severity=IssueSeverity.WARNING,
            message=f"Unknown sleep stage '{stage_str}', defaulting to UNKNOWN",
            details={"row": row_idx, "stage_str": stage_str}
        )
        
        return SleepStage.UNKNOWN

    def _get_start_time(self, row: Dict[str, str], epoch_number: int, epoch_duration: float, row_idx: int) -> datetime:
        for key in ["start_time", "start", "time", "timestamp"]:
            if key in row and row[key].strip():
                try:
                    return self._parse_timestamp(row[key])
                except ValueError:
                    pass
        
        return datetime.now() + timedelta(seconds=(epoch_number - 1) * epoch_duration)

    def _parse_confidence(self, confidence_str: str) -> float:
        try:
            confidence = float(confidence_str)
            if 0 <= confidence <= 1:
                return confidence
            elif 0 <= confidence <= 100:
                return confidence / 100.0
        except ValueError:
            pass
        return 1.0

    def _parse_manual_flag(self, flag_str: str) -> bool:
        flag_str = str(flag_str).lower()
        return flag_str in ["true", "1", "yes", "manual", "man", "m"]

    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%H:%M:%S",
            "%H:%M:%S.%f",
        ]
        
        timestamp_str = timestamp_str.strip()
        for fmt in formats:
            try:
                parsed = datetime.strptime(timestamp_str, fmt)
                if fmt in ["%H:%M:%S", "%H:%M:%S.%f"]:
                    today = datetime.now().date()
                    parsed = datetime.combine(today, parsed.time())
                return parsed
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
