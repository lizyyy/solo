"""Parser for events.jsonl call event logs."""

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from decorator_analyzer.models import CallEvent


class JsonlParseError(Exception):
    """Exception raised when JSONL parsing fails."""
    pass


class JsonlParser:
    """Parser for events.jsonl call event logs."""

    def __init__(self, jsonl_path: Path):
        self.jsonl_path = jsonl_path

    def parse(self) -> list[CallEvent]:
        """Parse the JSONL file and return list of CallEvent objects."""
        self._validate_file()
        lines = self._read_lines()
        return self._parse_lines(lines)

    def _validate_file(self) -> None:
        """Validate that the JSONL file exists and is readable."""
        if not self.jsonl_path.exists():
            raise JsonlParseError(f"JSONL file not found: {self.jsonl_path}")
        if not self.jsonl_path.is_file():
            raise JsonlParseError(f"Path is not a file: {self.jsonl_path}")

    def _read_lines(self) -> list[str]:
        """Read all non-empty lines from the JSONL file."""
        try:
            with open(self.jsonl_path, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip()]
        except UnicodeDecodeError as e:
            raise JsonlParseError(f"File encoding error: {e}") from e
        except IOError as e:
            raise JsonlParseError(f"File read error: {e}") from e
        
        return lines

    def _parse_lines(self, lines: list[str]) -> list[CallEvent]:
        """Parse JSON lines into CallEvent objects."""
        results: list[CallEvent] = []
        
        for line_num, line in enumerate(lines, 1):
            try:
                event_data = json.loads(line)
            except json.JSONDecodeError as e:
                raise JsonlParseError(f"Line {line_num}: Invalid JSON: {e}") from e
            
            event = self._parse_event(event_data, line_num)
            results.append(event)
        
        return results

    def _parse_event(self, data: dict[str, Any], line_num: int) -> CallEvent:
        """Parse a single event dictionary into a CallEvent object."""
        self._validate_event(data, line_num)
        
        function_id = data.get("function_id", data.get("function_name", "unknown"))
        timestamp = self._parse_timestamp(data.get("timestamp"))
        
        event_id = self._generate_id(f"{function_id}:{timestamp.isoformat()}:{line_num}")
        
        return CallEvent(
            id=event_id,
            function_id=function_id,
            timestamp=timestamp,
            caller=data.get("caller"),
            args=tuple(data.get("args", [])),
            kwargs=data.get("kwargs", {}),
            return_value=data.get("return_value"),
            exception=data.get("exception"),
            decorator_stack=data.get("decorator_stack", []),
            duration_ms=data.get("duration_ms"),
        )

    def _validate_event(self, data: dict[str, Any], line_num: int) -> None:
        """Validate that required fields are present in the event data."""
        if not isinstance(data, dict):
            raise JsonlParseError(f"Line {line_num}: Event must be a JSON object")
        
        required_fields = ["function_id", "timestamp"]
        for field in required_fields:
            if field not in data and "function_name" not in data:
                raise JsonlParseError(f"Line {line_num}: Missing required field: {field}")

    def _parse_timestamp(self, ts_value: Any) -> datetime:
        """Parse a timestamp value into a datetime object."""
        if ts_value is None:
            return datetime.now()
        
        if isinstance(ts_value, datetime):
            return ts_value
        
        if isinstance(ts_value, (int, float)):
            try:
                return datetime.fromtimestamp(ts_value)
            except (OSError, ValueError):
                return datetime.now()
        
        if isinstance(ts_value, str):
            for fmt in [
                "%Y-%m-%dT%H:%M:%S.%f",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S.%f",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
            ]:
                try:
                    return datetime.strptime(ts_value, fmt)
                except ValueError:
                    continue
            
            try:
                from datetime import timezone
                return datetime.fromisoformat(ts_value.replace("Z", "+00:00"))
            except ValueError:
                pass
        
        return datetime.now()

    def _generate_id(self, identifier: str) -> str:
        """Generate a unique ID from an identifier string."""
        return hashlib.sha256(identifier.encode()).hexdigest()[:16]
