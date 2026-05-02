import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict


@dataclass
class ToolCallEvent:
    id: str
    tool_name: str
    arguments: Dict[str, Any]
    timestamp: datetime
    event_type: str
    raw_event: Dict[str, Any]
    response: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    duration_ms: Optional[float] = None
    is_retry: bool = False
    retry_count: int = 0


class TraceParser:
    def __init__(self):
        self.events: List[ToolCallEvent] = []
        self.event_groups: Dict[str, List[ToolCallEvent]] = defaultdict(list)
        self.errors: List[str] = []

    def parse_file(self, file_path: str) -> List[ToolCallEvent]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Trace file not found: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        return self.parse_lines(lines)

    def parse_lines(self, lines: List[str]) -> List[ToolCallEvent]:
        self.events = []
        self.event_groups = defaultdict(list)
        self.errors = []

        for line_num, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue

            try:
                event_data = json.loads(line)
                event = self._parse_event(event_data)
                if event:
                    self.events.append(event)
                    self.event_groups[event.id].append(event)
            except json.JSONDecodeError as e:
                self.errors.append(f"Line {line_num}: JSON parse error: {e}")
            except Exception as e:
                self.errors.append(f"Line {line_num}: Error: {e}")

        self._process_retries()
        return self.events

    def _parse_event(self, event_data: Dict[str, Any]) -> Optional[ToolCallEvent]:
        tool_call_id = self._extract_tool_call_id(event_data)
        if not tool_call_id:
            return None

        tool_name = self._extract_tool_name(event_data)
        arguments = self._extract_arguments(event_data)
        timestamp = self._extract_timestamp(event_data)
        event_type = self._extract_event_type(event_data)
        response = self._extract_response(event_data)
        error = self._extract_error(event_data)
        duration = self._extract_duration(event_data)

        return ToolCallEvent(
            id=tool_call_id,
            tool_name=tool_name,
            arguments=arguments,
            timestamp=timestamp,
            event_type=event_type,
            raw_event=event_data,
            response=response,
            error=error,
            duration_ms=duration,
        )

    def _extract_tool_call_id(self, data: Dict[str, Any]) -> Optional[str]:
        candidates = [
            "tool_call_id",
            "toolCallId",
            "call_id",
            "id",
            "request_id",
        ]
        for key in candidates:
            if key in data and data[key]:
                return str(data[key])

        if "tool_call" in data:
            tc = data["tool_call"]
            if isinstance(tc, dict):
                return tc.get("id") or tc.get("tool_call_id")

        return None

    def _extract_tool_name(self, data: Dict[str, Any]) -> str:
        candidates = [
            "tool_name",
            "toolName",
            "name",
            "function",
        ]
        for key in candidates:
            if key in data and data[key]:
                return str(data[key])

        if "tool_call" in data:
            tc = data["tool_call"]
            if isinstance(tc, dict):
                return tc.get("name") or tc.get("tool_name", "")

        return "unknown"

    def _extract_arguments(self, data: Dict[str, Any]) -> Dict[str, Any]:
        candidates = [
            "arguments",
            "args",
            "parameters",
            "params",
            "input",
        ]
        for key in candidates:
            if key in data:
                val = data[key]
                if isinstance(val, dict):
                    return val
                if isinstance(val, str):
                    try:
                        return json.loads(val)
                    except:
                        return {"raw": val}

        if "tool_call" in data:
            tc = data["tool_call"]
            if isinstance(tc, dict):
                return self._extract_arguments(tc)

        return {}

    def _extract_timestamp(self, data: Dict[str, Any]) -> datetime:
        candidates = [
            "timestamp",
            "time",
            "ts",
            "datetime",
        ]
        for key in candidates:
            if key in data:
                val = data[key]
                try:
                    if isinstance(val, (int, float)):
                        if val > 1e12:
                            return datetime.fromtimestamp(val / 1000)
                        return datetime.fromtimestamp(val)
                    if isinstance(val, str):
                        try:
                            return datetime.fromisoformat(val.replace("Z", "+00:00"))
                        except:
                            pass
                except:
                    pass

        return datetime.now()

    def _extract_event_type(self, data: Dict[str, Any]) -> str:
        candidates = [
            "event_type",
            "eventType",
            "type",
            "status",
        ]
        for key in candidates:
            if key in data and data[key]:
                return str(data[key]).lower()

        if "response" in data or "result" in data:
            return "response"
        if "error" in data:
            return "error"

        return "request"

    def _extract_response(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        candidates = [
            "response",
            "result",
            "output",
            "content",
        ]
        for key in candidates:
            if key in data:
                val = data[key]
                if isinstance(val, dict):
                    return val
                if val is not None:
                    return {"value": val}

        if "tool_result" in data:
            tr = data["tool_result"]
            if isinstance(tr, dict):
                return tr

        return None

    def _extract_error(self, data: Dict[str, Any]) -> Optional[str]:
        candidates = [
            "error",
            "error_message",
            "errorMessage",
            "message",
        ]
        for key in candidates:
            if key in data and data[key]:
                val = data[key]
                if isinstance(val, str):
                    return val
                if isinstance(val, dict):
                    return str(val.get("message", val))

        return None

    def _extract_duration(self, data: Dict[str, Any]) -> Optional[float]:
        candidates = [
            "duration_ms",
            "duration",
            "latency_ms",
            "latency",
        ]
        for key in candidates:
            if key in data:
                val = data[key]
                try:
                    return float(val)
                except:
                    pass

        return None

    def _process_retries(self):
        for call_id, events in self.event_groups.items():
            if len(events) > 1:
                sorted_events = sorted(events, key=lambda e: e.timestamp)
                for idx, event in enumerate(sorted_events):
                    if idx > 0:
                        event.is_retry = True
                        event.retry_count = idx

    def get_events_by_tool_call_id(self, tool_call_id: str) -> List[ToolCallEvent]:
        return self.event_groups.get(tool_call_id, [])

    def get_all_events(self) -> List[ToolCallEvent]:
        return self.events.copy()

    def get_sorted_events(self) -> List[ToolCallEvent]:
        return sorted(self.events, key=lambda e: e.timestamp)

    def get_parse_errors(self) -> List[str]:
        return self.errors.copy()
