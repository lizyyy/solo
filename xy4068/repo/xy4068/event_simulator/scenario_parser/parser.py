import csv
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from dateutil import parser as date_parser

from event_simulator.models.event import Event, EventSource


class EventSourceType(str):
    CSV = "csv"
    JSON = "json"


class ScenarioParser:
    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path.cwd()
    
    def parse_file(self, file_path: Union[str, Path]) -> List[Event]:
        file_path = Path(file_path)
        if not file_path.is_absolute():
            file_path = self.base_dir / file_path
        
        if not file_path.exists():
            raise FileNotFoundError(f"Event file not found: {file_path}")
        
        suffix = file_path.suffix.lower()
        if suffix == ".csv":
            return self.parse_csv(file_path)
        elif suffix == ".json":
            return self.parse_json(file_path)
        else:
            raise ValueError(f"Unsupported file format: {suffix}")
    
    def parse_csv(self, file_path: Union[str, Path]) -> List[Event]:
        file_path = Path(file_path)
        events = []
        
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    event = self._parse_csv_row(row, row_num)
                    events.append(event)
                except Exception as e:
                    raise ValueError(f"Error parsing CSV row {row_num}: {e}") from e
        
        return events
    
    def _parse_csv_row(self, row: Dict[str, str], row_num: int) -> Event:
        event_id = row.get("id") or row.get("event_id") or str(uuid.uuid4())
        event_type = row.get("event_type") or row.get("type")
        if not event_type:
            raise ValueError("Missing required field: event_type")
        
        timestamp_str = row.get("timestamp") or row.get("time")
        if not timestamp_str:
            raise ValueError("Missing required field: timestamp")
        
        try:
            timestamp = date_parser.isoparse(timestamp_str)
        except Exception:
            try:
                timestamp = datetime.fromisoformat(timestamp_str)
            except Exception:
                raise ValueError(f"Invalid timestamp format: {timestamp_str}")
        
        camera_id = row.get("camera_id")
        if not camera_id:
            raise ValueError("Missing required field: camera_id")
        
        area_id = row.get("area_id") or row.get("area")
        
        severity = row.get("severity", "info")
        
        confidence_str = row.get("confidence")
        confidence = None
        if confidence_str:
            try:
                confidence = float(confidence_str)
            except ValueError:
                pass
        
        payload = {}
        payload_str = row.get("payload")
        if payload_str:
            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                payload = {"raw": payload_str}
        
        for key, value in row.items():
            if key not in ["id", "event_id", "event_type", "type", "timestamp", "time", 
                          "camera_id", "area_id", "area", "severity", "confidence", "payload"]:
                if key not in payload:
                    payload[key] = value
        
        return Event(
            id=event_id,
            event_type=event_type,
            timestamp=timestamp,
            camera_id=camera_id,
            area_id=area_id,
            severity=severity,
            source=EventSource.CSV,
            confidence=confidence,
            payload=payload,
        )
    
    def parse_json(self, file_path: Union[str, Path]) -> List[Event]:
        file_path = Path(file_path)
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if isinstance(data, list):
            events = []
            for i, item in enumerate(data):
                try:
                    event = self._parse_json_event(item)
                    events.append(event)
                except Exception as e:
                    raise ValueError(f"Error parsing JSON item at index {i}: {e}") from e
            return events
        elif isinstance(data, dict):
            if "events" in data and isinstance(data["events"], list):
                events = []
                for i, item in enumerate(data["events"]):
                    try:
                        event = self._parse_json_event(item)
                        events.append(event)
                    except Exception as e:
                        raise ValueError(f"Error parsing JSON events[{i}]: {e}") from e
                return events
            else:
                return [self._parse_json_event(data)]
        else:
            raise ValueError(f"Unexpected JSON structure: {type(data)}")
    
    def _parse_json_event(self, data: Dict[str, Any]) -> Event:
        event_id = data.get("id") or data.get("event_id") or str(uuid.uuid4())
        event_type = data.get("event_type") or data.get("type")
        if not event_type:
            raise ValueError("Missing required field: event_type")
        
        timestamp_str = data.get("timestamp") or data.get("time")
        if not timestamp_str:
            raise ValueError("Missing required field: timestamp")
        
        try:
            if isinstance(timestamp_str, datetime):
                timestamp = timestamp_str
            elif isinstance(timestamp_str, (int, float)):
                timestamp = datetime.fromtimestamp(timestamp_str)
            else:
                try:
                    timestamp = date_parser.isoparse(str(timestamp_str))
                except Exception:
                    timestamp = datetime.fromisoformat(str(timestamp_str))
        except Exception:
            raise ValueError(f"Invalid timestamp format: {timestamp_str}")
        
        camera_id = data.get("camera_id")
        if not camera_id:
            raise ValueError("Missing required field: camera_id")
        
        area_id = data.get("area_id") or data.get("area")
        severity = data.get("severity", "info")
        confidence = data.get("confidence")
        payload = data.get("payload", {})
        
        if not isinstance(payload, dict):
            payload = {"value": payload}
        
        for key, value in data.items():
            if key not in ["id", "event_id", "event_type", "type", "timestamp", "time",
                          "camera_id", "area_id", "area", "severity", "confidence", "payload",
                          "metadata", "created_at", "source"]:
                if key not in payload:
                    payload[key] = value
        
        metadata = data.get("metadata", {})
        
        return Event(
            id=event_id,
            event_type=event_type,
            timestamp=timestamp,
            camera_id=camera_id,
            area_id=area_id,
            severity=severity,
            source=EventSource.JSON,
            confidence=confidence,
            payload=payload,
            metadata=metadata if isinstance(metadata, dict) else {},
        )
    
    def sort_events(self, events: List[Event]) -> List[Event]:
        return sorted(events, key=lambda e: e.timestamp)
    
    def get_time_range(self, events: List[Event]) -> Optional[Dict[str, datetime]]:
        if not events:
            return None
        sorted_events = self.sort_events(events)
        return {
            "start": sorted_events[0].timestamp,
            "end": sorted_events[-1].timestamp,
        }
