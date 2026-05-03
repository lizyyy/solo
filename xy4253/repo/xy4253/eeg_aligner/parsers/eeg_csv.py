import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
import logging

from eeg_aligner.models import EEGChannelSummary

logger = logging.getLogger(__name__)


class EEGCSVParser:
    REQUIRED_COLUMNS = [
        "channel_name",
        "sampling_rate",
        "start_time",
        "end_time",
        "total_samples",
        "valid_samples",
        "artifact_percentage",
    ]

    def __init__(self):
        self.issues: List[Dict[str, Any]] = []

    def parse(self, file_path: Path) -> List[EEGChannelSummary]:
        logger.info(f"Parsing EEG CSV: {file_path}")
        self.issues = []
        
        summaries = []
        
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            
            self._validate_columns(reader.fieldnames or [])
            
            for row_idx, row in enumerate(reader, start=2):
                try:
                    summary = self._parse_row(row, row_idx)
                    summaries.append(summary)
                except Exception as e:
                    self.issues.append({
                        "row": row_idx,
                        "error": str(e),
                        "severity": "error"
                    })
                    logger.warning(f"Error parsing row {row_idx}: {e}")
        
        logger.info(f"Parsed {len(summaries)} channel summaries")
        return summaries

    def _validate_columns(self, columns: List[str]):
        missing = []
        for col in self.REQUIRED_COLUMNS:
            if col not in columns:
                missing.append(col)
        
        if missing:
            raise ValueError(f"Missing required columns in EEG CSV: {', '.join(missing)}")

    def _parse_row(self, row: Dict[str, str], row_idx: int) -> EEGChannelSummary:
        channel_name = row["channel_name"].strip()
        if not channel_name:
            raise ValueError(f"Row {row_idx}: channel_name cannot be empty")
        
        try:
            sampling_rate = float(row["sampling_rate"])
            if sampling_rate <= 0:
                raise ValueError(f"Invalid sampling rate: {sampling_rate}")
        except ValueError as e:
            raise ValueError(f"Row {row_idx}: Invalid sampling_rate - {e}")
        
        try:
            start_time = self._parse_timestamp(row["start_time"])
        except ValueError as e:
            raise ValueError(f"Row {row_idx}: Invalid start_time - {e}")
        
        try:
            end_time = self._parse_timestamp(row["end_time"])
        except ValueError as e:
            raise ValueError(f"Row {row_idx}: Invalid end_time - {e}")
        
        if end_time <= start_time:
            self.issues.append({
                "row": row_idx,
                "channel": channel_name,
                "warning": "end_time is before or equal to start_time",
                "severity": "warning"
            })
        
        try:
            total_samples = int(row["total_samples"])
            if total_samples < 0:
                raise ValueError(f"Total samples cannot be negative: {total_samples}")
        except ValueError as e:
            raise ValueError(f"Row {row_idx}: Invalid total_samples - {e}")
        
        try:
            valid_samples = int(row["valid_samples"])
            if valid_samples < 0:
                raise ValueError(f"Valid samples cannot be negative: {valid_samples}")
        except ValueError as e:
            raise ValueError(f"Row {row_idx}: Invalid valid_samples - {e}")
        
        if valid_samples > total_samples:
            self.issues.append({
                "row": row_idx,
                "channel": channel_name,
                "warning": "valid_samples exceeds total_samples",
                "severity": "warning"
            })
        
        try:
            artifact_percentage = float(row["artifact_percentage"])
            if not (0 <= artifact_percentage <= 100):
                raise ValueError(f"Artifact percentage must be between 0 and 100: {artifact_percentage}")
        except ValueError as e:
            raise ValueError(f"Row {row_idx}: Invalid artifact_percentage - {e}")
        
        quality_metrics = {}
        for key, value in row.items():
            if key not in self.REQUIRED_COLUMNS and value.strip():
                try:
                    quality_metrics[key] = float(value)
                except ValueError:
                    pass
        
        return EEGChannelSummary(
            channel_name=channel_name,
            sampling_rate=sampling_rate,
            start_time=start_time,
            end_time=end_time,
            total_samples=total_samples,
            valid_samples=valid_samples,
            artifact_percentage=artifact_percentage,
            quality_metrics=quality_metrics
        )

    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%d/%m/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
        ]
        
        timestamp_str = timestamp_str.strip()
        for fmt in formats:
            try:
                return datetime.strptime(timestamp_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"Unable to parse timestamp: {timestamp_str}")

    def get_issues(self) -> List[Dict[str, Any]]:
        return self.issues
