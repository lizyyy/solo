import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import uuid
import logging

from eeg_aligner.models import StimulusEvent, EventType, ValidationIssue, IssueType, IssueSeverity

logger = logging.getLogger(__name__)


class EventsJSONLParser:
    REQUIRED_FIELDS = ["event_code", "timestamp", "event_type"]

    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def parse(self, file_path: Path) -> List[StimulusEvent]:
        logger.info(f"Parsing events JSONL: {file_path}")
        self.issues = []
        
        events = []
        
        with open(file_path, "r", encoding="utf-8") as f:
            for line_idx, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    event = self._parse_event(data, line_idx)
                    events.append(event)
                except json.JSONDecodeError as e:
                    self._add_issue(
                        issue_type=IssueType.INVALID_TIMESTAMP,
                        severity=IssueSeverity.CRITICAL,
                        message=f"Line {line_idx}: Invalid JSON - {e}",
                        details={"line": line_idx, "error": str(e)}
                    )
                except Exception as e:
                    self._add_issue(
                        issue_type=IssueType.INVALID_TIMESTAMP,
                        severity=IssueSeverity.ERROR if hasattr(IssueSeverity, 'ERROR') else IssueSeverity.CRITICAL,
                        message=f"Line {line_idx}: {e}",
                        details={"line": line_idx, "error": str(e)}
                    )
        
        events.sort(key=lambda e: e.timestamp)
        
        logger.info(f"Parsed {len(events)} events")
        return events

    def _parse_event(self, data: Dict[str, Any], line_idx: int) -> StimulusEvent:
        for field in self.REQUIRED_FIELDS:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")
        
        try:
            event_code = int(data["event_code"])
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid event_code: {data.get('event_code')} - {e}")
        
        try:
            event_type = EventType(data["event_type"].lower())
        except ValueError:
            valid_types = [t.value for t in EventType]
            raise ValueError(f"Invalid event_type: {data.get('event_type')}. Valid types: {valid_types}")
        
        timestamp = self._parse_timestamp(data["timestamp"])
        
        eeg_timestamp = None
        if "eeg_timestamp" in data:
            try:
                eeg_timestamp = self._parse_timestamp(data["eeg_timestamp"])
            except ValueError as e:
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.WARNING,
                    message=f"Invalid eeg_timestamp: {data.get('eeg_timestamp')} - {e}",
                    details={"line": line_idx, "event_code": event_code}
                )
        
        duration_ms = None
        if "duration_ms" in data:
            try:
                duration_ms = float(data["duration_ms"])
            except ValueError:
                pass
        
        description = data.get("description", "")
        if isinstance(description, str):
            description = description.strip()
        else:
            description = str(description)
        
        metadata = data.get("metadata", {})
        if not isinstance(metadata, dict):
            metadata = {"raw_metadata": metadata}
        
        is_artifact = data.get("is_artifact", False)
        if not isinstance(is_artifact, bool):
            is_artifact = str(is_artifact).lower() in ["true", "1", "yes"]
        
        is_valid = data.get("is_valid", True)
        if not isinstance(is_valid, bool):
            is_valid = str(is_valid).lower() not in ["false", "0", "no"]
        
        event_id = data.get("event_id", f"evt_{line_idx:06d}")
        if not isinstance(event_id, str) or not event_id.strip():
            event_id = str(uuid.uuid4())
        
        return StimulusEvent(
            event_id=event_id,
            event_code=event_code,
            event_type=event_type,
            timestamp=timestamp,
            eeg_timestamp=eeg_timestamp,
            duration_ms=duration_ms,
            description=description,
            metadata=metadata,
            is_artifact=is_artifact,
            is_valid=is_valid
        )

    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S.%f",
            "%d-%m-%Y %H:%M:%S",
            "%m-%d-%Y %H:%M:%S",
        ]
        
        if isinstance(timestamp_str, (int, float)):
            try:
                return datetime.fromtimestamp(timestamp_str)
            except (ValueError, OSError):
                try:
                    return datetime.fromtimestamp(timestamp_str / 1000.0)
                except (ValueError, OSError):
                    pass
        
        timestamp_str = str(timestamp_str).strip()
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
