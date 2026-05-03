from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict
import uuid

from models import (
    Deceased, ColdChamberLog, HandoverRecord, Rule,
    TimelineEvent, ChamberStatus, Issue, IssueType, Severity
)
from data_loader import DataLoader


class TimelineBuilder:
    def __init__(self, data_loader: DataLoader):
        self.data_loader = data_loader
        self.events_by_deceased: Dict[str, List[TimelineEvent]] = defaultdict(list)
        self.events_by_chamber: Dict[str, List[TimelineEvent]] = defaultdict(list)
        self.chamber_statuses: Dict[str, ChamberStatus] = {}
        self.all_events: List[TimelineEvent] = []

    def generate_event_id(self) -> str:
        return f"EVT_{uuid.uuid4().hex[:12]}"

    def build_timelines(self) -> Tuple[Dict[str, List[TimelineEvent]], Dict[str, List[TimelineEvent]]]:
        all_events: List[TimelineEvent] = []
        
        deceased_dict = self.data_loader.deceased_dict
        chamber_logs = self.data_loader.chamber_logs
        handover_records = self.data_loader.handover_records
        
        for log in chamber_logs:
            if log.timestamp is None:
                continue
            
            event = TimelineEvent(
                event_id=self.generate_event_id(),
                deceased_id=log.deceased_id or "",
                event_type=log.operation_type or "UNKNOWN",
                timestamp=log.timestamp,
                chamber_id=log.chamber_id,
                details={
                    "temperature": log.temperature,
                    "operator": log.operator,
                    "log_id": log.log_id,
                    "remarks": log.remarks
                },
                source_record=log
            )
            all_events.append(event)
            
            if log.deceased_id:
                self.events_by_deceased[log.deceased_id].append(event)
            if log.chamber_id:
                self.events_by_chamber[log.chamber_id].append(event)
        
        for record in handover_records:
            if record.handover_time is None:
                continue
            
            event = TimelineEvent(
                event_id=self.generate_event_id(),
                deceased_id=record.deceased_id,
                event_type=f"HANDOVER_{record.handover_type}" if record.handover_type else "HANDOVER",
                timestamp=record.handover_time,
                chamber_id=record.to_chamber or record.from_chamber,
                details={
                    "handover_id": record.handover_id,
                    "handover_type": record.handover_type,
                    "from_chamber": record.from_chamber,
                    "to_chamber": record.to_chamber,
                    "from_person": record.from_person,
                    "to_person": record.to_person,
                    "is_signed": record.is_signed,
                    "signed_by": record.signed_by,
                    "remarks": record.remarks
                },
                source_record=record
            )
            all_events.append(event)
            
            self.events_by_deceased[record.deceased_id].append(event)
            if record.to_chamber:
                self.events_by_chamber[record.to_chamber].append(event)
            if record.from_chamber and record.from_chamber != record.to_chamber:
                self.events_by_chamber[record.from_chamber].append(event)
        
        for deceased_id, events in self.events_by_deceased.items():
            events.sort(key=lambda x: x.timestamp)
        
        for chamber_id, events in self.events_by_chamber.items():
            events.sort(key=lambda x: x.timestamp)
        
        all_events.sort(key=lambda x: x.timestamp)
        self.all_events = all_events
        
        self._build_chamber_statuses()
        
        return self.events_by_deceased, self.events_by_chamber

    def _build_chamber_statuses(self):
        for chamber_id, events in self.events_by_chamber.items():
            status = ChamberStatus(chamber_id=chamber_id)
            temp_history = []
            occu_history = []
            
            current_occupant = None
            current_occupant_start = None
            
            for event in events:
                if event.details.get("temperature") is not None:
                    temp_history.append({
                        "timestamp": event.timestamp,
                        "temperature": event.details["temperature"],
                        "operator": event.details.get("operator", "")
                    })
                
                op_type = event.event_type.upper() if event.event_type else ""
                
                if "IN" in op_type or "入柜" in op_type or "存放" in op_type:
                    if current_occupant and current_occupant != event.deceased_id:
                        if current_occupant_start:
                            occu_history.append({
                                "deceased_id": current_occupant,
                                "start_time": current_occupant_start,
                                "end_time": event.timestamp,
                                "chamber_id": chamber_id
                            })
                    current_occupant = event.deceased_id
                    current_occupant_start = event.timestamp
                
                elif "OUT" in op_type or "出柜" in op_type or "取出" in op_type:
                    if current_occupant == event.deceased_id and current_occupant_start:
                        occu_history.append({
                            "deceased_id": current_occupant,
                            "start_time": current_occupant_start,
                            "end_time": event.timestamp,
                            "chamber_id": chamber_id
                        })
                        current_occupant = None
                        current_occupant_start = None
            
            if current_occupant and current_occupant_start:
                occu_history.append({
                    "deceased_id": current_occupant,
                    "start_time": current_occupant_start,
                    "end_time": None,
                    "chamber_id": chamber_id,
                    "is_active": True
                })
                status.current_occupant = current_occupant
                status.current_start_time = current_occupant_start
            
            status.temperature_history = temp_history
            status.occupancy_history = occu_history
            self.chamber_statuses[chamber_id] = status

    def get_deceased_timeline(self, deceased_id: str) -> List[TimelineEvent]:
        return self.events_by_deceased.get(deceased_id, [])

    def get_chamber_timeline(self, chamber_id: str) -> List[TimelineEvent]:
        return self.events_by_chamber.get(chamber_id, [])

    def get_chamber_status(self, chamber_id: str) -> Optional[ChamberStatus]:
        return self.chamber_statuses.get(chamber_id)

    def get_all_chambers(self) -> List[str]:
        return sorted(self.chamber_statuses.keys())

    def get_all_deceased_ids(self) -> List[str]:
        return sorted(self.events_by_deceased.keys())

    def get_events_in_range(self, start_time: datetime, end_time: datetime) -> List[TimelineEvent]:
        return [
            event for event in self.all_events
            if start_time <= event.timestamp <= end_time
        ]
