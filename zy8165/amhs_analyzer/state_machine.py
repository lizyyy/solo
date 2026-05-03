from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from pathlib import Path
import json
import logging

logger = logging.getLogger(__name__)


class TransferStatus(Enum):
    IDLE = "idle"
    ASSIGNED = "assigned"
    MOVING = "moving"
    QUEUEING = "queueing"
    BLOCKED = "blocked"
    LOADING = "loading"
    UNLOADING = "unloading"
    COMPLETED = "completed"
    FAILED = "failed"


class EventType(Enum):
    TASK_CREATED = "task_created"
    ASSIGNED = "assigned"
    DEPARTED = "departed"
    ARRIVED = "arrived"
    QUEUE_START = "queue_start"
    QUEUE_END = "queue_end"
    REROUTE = "reroute"
    REROUTE_FAILED = "reroute_failed"
    LOAD_START = "load_start"
    LOAD_END = "load_end"
    UNLOAD_START = "unload_start"
    UNLOAD_END = "unload_end"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class TransferEvent:
    foup_id: str
    event_type: EventType
    timestamp: datetime
    node_id: Optional[str] = None
    target_node: Optional[str] = None
    equipment_id: Optional[str] = None
    vehicle_id: Optional[str] = None
    reason: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_json(cls, data: Dict[str, Any]) -> 'TransferEvent':
        event_type_str = data.get('event_type', data.get('type', 'unknown')).upper().replace('-', '_')
        try:
            event_type = EventType[event_type_str]
        except KeyError:
            logger.warning(f"Unknown event type: {event_type_str}, defaulting to ARRIVED")
            event_type = EventType.ARRIVED
        
        ts_str = data.get('timestamp', data.get('ts', ''))
        if ts_str:
            try:
                timestamp = datetime.fromisoformat(ts_str)
            except ValueError:
                timestamp = datetime.now()
        else:
            timestamp = datetime.now()
        
        return cls(
            foup_id=str(data.get('foup_id', data.get('id', 'unknown'))),
            event_type=event_type,
            timestamp=timestamp,
            node_id=data.get('node_id', data.get('node')),
            target_node=data.get('target_node', data.get('destination')),
            equipment_id=data.get('equipment_id'),
            vehicle_id=data.get('vehicle_id'),
            reason=data.get('reason'),
            raw_data=data
        )


@dataclass
class TransferState:
    foup_id: str
    status: TransferStatus = TransferStatus.IDLE
    current_node: Optional[str] = None
    source_node: Optional[str] = None
    target_node: Optional[str] = None
    vehicle_id: Optional[str] = None
    created_at: Optional[datetime] = None
    last_updated_at: Optional[datetime] = None
    last_departure_time: Optional[datetime] = None
    expected_arrival_node: Optional[str] = None
    queue_start_time: Optional[datetime] = None
    total_queue_time_seconds: float = 0.0
    reroute_attempts: int = 0
    failed_reroutes: int = 0
    equipment_occupation_start: Optional[datetime] = None
    equipment_id: Optional[str] = None
    events: List[TransferEvent] = field(default_factory=list)
    anomalies: List[str] = field(default_factory=list)
    issues: List[Dict[str, Any]] = field(default_factory=list)
    
    def record_issue(self, issue_type: str, description: str, timestamp: datetime, **kwargs):
        issue = {
            'foup_id': self.foup_id,
            'issue_type': issue_type,
            'description': description,
            'timestamp': timestamp.isoformat(),
            'current_node': self.current_node,
            'target_node': self.target_node,
            **kwargs
        }
        self.issues.append(issue)
        self.anomalies.append(f"{issue_type}: {description}")


class TransferStateMachine:
    def __init__(self, foup_id: str):
        self.state = TransferState(foup_id=foup_id)
        self._pending_events: List[TransferEvent] = []
    
    def process_event(self, event: TransferEvent) -> bool:
        if event.foup_id != self.state.foup_id:
            return False
        
        if self.state.last_updated_at and event.timestamp < self.state.last_updated_at:
            return self._process_out_of_order_event(event)
        
        self._apply_event(event)
        self.state.events.append(event)
        return True
    
    def _process_out_of_order_event(self, event: TransferEvent) -> bool:
        logger.warning(f"FOUP {self.state.foup_id}: Received out-of-order event {event.event_type} at {event.timestamp}")
        self.state.anomalies.append(f"Out-of-order event: {event.event_type} at {event.timestamp}")
        self.state.events.append(event)
        self._handle_out_of_order_arrival(event)
        return True
    
    def _apply_event(self, event: TransferEvent):
        self.state.last_updated_at = event.timestamp
        
        handler = getattr(self, f'_handle_{event.event_type.value.lower()}', None)
        if handler:
            handler(event)
        else:
            logger.debug(f"No handler for event type: {event.event_type}")
    
    def _handle_task_created(self, event: TransferEvent):
        self.state.status = TransferStatus.IDLE
        self.state.created_at = event.timestamp
        self.state.source_node = event.node_id
        self.state.target_node = event.target_node
    
    def _handle_assigned(self, event: TransferEvent):
        self.state.status = TransferStatus.ASSIGNED
        self.state.vehicle_id = event.vehicle_id
    
    def _handle_departed(self, event: TransferEvent):
        prev_status = self.state.status
        self.state.status = TransferStatus.MOVING
        self.state.current_node = event.node_id
        self.state.last_departure_time = event.timestamp
        
        if event.target_node:
            self.state.expected_arrival_node = event.target_node
        
        if self.state.queue_start_time:
            queue_duration = (event.timestamp - self.state.queue_start_time).total_seconds()
            self.state.total_queue_time_seconds += queue_duration
            if queue_duration > 10:
                self.state.record_issue(
                    'node_queue',
                    f"Waited {queue_duration:.1f}s at node {event.node_id}",
                    event.timestamp,
                    duration_seconds=queue_duration,
                    node_id=event.node_id
                )
            self.state.queue_start_time = None
    
    def _handle_arrived(self, event: TransferEvent):
        self.state.status = TransferStatus.IDLE
        self.state.current_node = event.node_id
        
        if self.state.last_departure_time:
            travel_time = (event.timestamp - self.state.last_departure_time).total_seconds()
            if travel_time > 300:
                self.state.record_issue(
                    'long_travel',
                    f"Unusually long travel time: {travel_time:.1f}s",
                    event.timestamp,
                    duration_seconds=travel_time
                )
            self.state.last_departure_time = None
            self.state.expected_arrival_node = None
        
        self._handle_equipment_arrival(event)
    
    def _handle_equipment_arrival(self, event: TransferEvent):
        if event.equipment_id:
            self.state.equipment_id = event.equipment_id
        elif event.node_id:
            from .topology import Topology
            pass
    
    def _handle_queue_start(self, event: TransferEvent):
        self.state.status = TransferStatus.QUEUEING
        self.state.queue_start_time = event.timestamp
        self.state.current_node = event.node_id
    
    def _handle_queue_end(self, event: TransferEvent):
        if self.state.queue_start_time:
            queue_duration = (event.timestamp - self.state.queue_start_time).total_seconds()
            self.state.total_queue_time_seconds += queue_duration
            if queue_duration > 10:
                self.state.record_issue(
                    'node_queue',
                    f"Waited {queue_duration:.1f}s at node {event.node_id}",
                    event.timestamp,
                    duration_seconds=queue_duration,
                    node_id=event.node_id
                )
        self.state.queue_start_time = None
        self.state.status = TransferStatus.MOVING
    
    def _handle_reroute(self, event: TransferEvent):
        self.state.reroute_attempts += 1
        self.state.status = TransferStatus.MOVING
        if event.target_node:
            self.state.target_node = event.target_node
    
    def _handle_reroute_failed(self, event: TransferEvent):
        self.state.failed_reroutes += 1
        self.state.status = TransferStatus.BLOCKED
        self.state.record_issue(
            'reroute_failed',
            f"Reroute failed: {event.reason or 'unknown reason'}",
            event.timestamp,
            reason=event.reason,
            current_node=event.node_id
        )
    
    def _handle_load_start(self, event: TransferEvent):
        self.state.status = TransferStatus.LOADING
        self.state.equipment_occupation_start = event.timestamp
        if event.equipment_id:
            self.state.equipment_id = event.equipment_id
    
    def _handle_load_end(self, event: TransferEvent):
        if self.state.equipment_occupation_start:
            occupation_time = (event.timestamp - self.state.equipment_occupation_start).total_seconds()
            if occupation_time > 120:
                self.state.record_issue(
                    'equipment_occupation',
                    f"Equipment occupation took {occupation_time:.1f}s",
                    event.timestamp,
                    duration_seconds=occupation_time,
                    equipment_id=self.state.equipment_id
                )
        self.state.equipment_occupation_start = None
        self.state.status = TransferStatus.IDLE
    
    def _handle_unload_start(self, event: TransferEvent):
        self.state.status = TransferStatus.UNLOADING
        self.state.equipment_occupation_start = event.timestamp
        if event.equipment_id:
            self.state.equipment_id = event.equipment_id
    
    def _handle_unload_end(self, event: TransferEvent):
        if self.state.equipment_occupation_start:
            occupation_time = (event.timestamp - self.state.equipment_occupation_start).total_seconds()
            if occupation_time > 120:
                self.state.record_issue(
                    'equipment_occupation',
                    f"Equipment occupation took {occupation_time:.1f}s",
                    event.timestamp,
                    duration_seconds=occupation_time,
                    equipment_id=self.state.equipment_id
                )
        self.state.equipment_occupation_start = None
        self.state.status = TransferStatus.IDLE
    
    def _handle_completed(self, event: TransferEvent):
        self.state.status = TransferStatus.COMPLETED
        self._finalize_state(event)
    
    def _handle_failed(self, event: TransferEvent):
        self.state.status = TransferStatus.FAILED
        self.state.record_issue(
            'transfer_failed',
            f"Transfer failed: {event.reason or 'unknown reason'}",
            event.timestamp,
            reason=event.reason
        )
    
    def _handle_out_of_order_arrival(self, event: TransferEvent):
        if event.event_type == EventType.ARRIVED:
            if self.state.expected_arrival_node and event.node_id != self.state.expected_arrival_node:
                pass
    
    def _finalize_state(self, event: TransferEvent):
        if self.state.last_departure_time is not None:
            self.state.record_issue(
                'missing_arrival',
                f"Departed but no arrival recorded. Last departed at {self.state.last_departure_time}",
                event.timestamp,
                last_departure_node=self.state.current_node
            )
            travel_duration = (event.timestamp - self.state.last_departure_time).total_seconds()
            self.state.record_issue(
                'node_queue',
                f"Assumed waiting at node for {travel_duration:.1f}s due to missing arrival",
                event.timestamp,
                duration_seconds=travel_duration,
                is_inferred=True
            )
            self.state.total_queue_time_seconds += travel_duration


def load_events(jsonl_path: Path) -> List[TransferEvent]:
    events = []
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                event = TransferEvent.from_json(data)
                events.append(event)
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse line {line_num}: {e}")
            except Exception as e:
                logger.warning(f"Error processing line {line_num}: {e}")
    
    events.sort(key=lambda e: e.timestamp)
    return events


def build_state_machines(events: List[TransferEvent]) -> Dict[str, TransferStateMachine]:
    machines: Dict[str, TransferStateMachine] = {}
    
    for event in events:
        foup_id = event.foup_id
        if foup_id not in machines:
            machines[foup_id] = TransferStateMachine(foup_id)
        machines[foup_id].process_event(event)
    
    return machines
