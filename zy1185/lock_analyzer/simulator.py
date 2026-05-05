from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from .lock_model import (
    DeadlockInfo,
    LockEvent,
    LockManager,
    LockStatus,
    LockType,
    StarvationInfo,
)
from .parser import LockConfig, OperationType, WorkloadEvent


class EventStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    TIMEOUT = "timeout"
    ABORTED = "aborted"


@dataclass
class TimelineEvent:
    event_id: str
    connection_id: str
    operation: OperationType
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: int = 0
    status: EventStatus = EventStatus.PENDING
    lock_type: Optional[LockType] = None
    blocking_reason: str = ""
    blocked_by: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ConnectionState:
    connection_id: str
    in_transaction: bool = False
    transaction_start: Optional[datetime] = None
    held_lock: Optional[LockType] = None
    current_event: Optional[TimelineEvent] = None
    completed_events: List[TimelineEvent] = field(default_factory=list)


@dataclass
class SimulationResult:
    success: bool
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    total_events: int = 0
    completed_events: int = 0
    blocked_events: int = 0
    timeout_events: int = 0
    deadlocks: List[DeadlockInfo] = field(default_factory=list)
    starvation_risks: List[StarvationInfo] = field(default_factory=list)
    timeline: List[TimelineEvent] = field(default_factory=list)
    lock_history: List[LockEvent] = field(default_factory=list)
    lock_statuses: List[LockStatus] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class Simulator:
    def __init__(self, config: LockConfig):
        self.config = config
        self.lock_manager = LockManager(busy_timeout_ms=config.busy_timeout_ms)
        self.connections: Dict[str, ConnectionState] = {}
        self.timeline: List[TimelineEvent] = []
        self.event_counter = 0

    def simulate(self, events: List[WorkloadEvent]) -> SimulationResult:
        if not events:
            return SimulationResult(
                success=True,
                errors=["No events to simulate"],
            )

        sorted_events = sorted(events, key=lambda e: e.timestamp)
        start_time = sorted_events[0].timestamp
        end_time = sorted_events[-1].timestamp

        for event in sorted_events:
            if event.connection_id not in self.connections:
                self.connections[event.connection_id] = ConnectionState(
                    connection_id=event.connection_id
                )

        result = SimulationResult(
            success=True,
            start_time=start_time,
            end_time=end_time,
            total_events=len(sorted_events),
        )

        event_queue = sorted_events.copy()
        in_progress: List[TimelineEvent] = []
        current_time = start_time

        while event_queue or in_progress:
            next_event_time = None
            if event_queue:
                next_event_time = event_queue[0].timestamp
            
            next_complete_time = None
            if in_progress:
                next_complete = min(
                    in_progress,
                    key=lambda e: e.end_time if e.end_time else datetime.max,
                )
                next_complete_time = next_complete.end_time

            if next_event_time and next_complete_time:
                current_time = min(next_event_time, next_complete_time)
            elif next_event_time:
                current_time = next_event_time
            elif next_complete_time:
                current_time = next_complete_time

            completed = [e for e in in_progress if e.end_time and e.end_time <= current_time]
            for timeline_event in completed:
                self._complete_event(timeline_event, current_time, result)
                in_progress.remove(timeline_event)

            while event_queue and event_queue[0].timestamp <= current_time:
                workload_event = event_queue.pop(0)
                timeline_event = self._create_timeline_event(workload_event, current_time)
                
                conn_state = self.connections[workload_event.connection_id]
                
                if conn_state.current_event:
                    timeline_event.status = EventStatus.BLOCKED
                    timeline_event.blocking_reason = (
                        f"Connection busy with {conn_state.current_event.operation.value}"
                    )
                    timeline_event.blocked_by = [conn_state.current_event.connection_id]
                    self.timeline.append(timeline_event)
                    result.blocked_events += 1
                    continue

                can_start, lock_needed = self._check_operation_needs_lock(
                    workload_event, conn_state
                )

                if lock_needed and not self.lock_manager.can_acquire(
                    lock_needed, workload_event.connection_id
                ):
                    timeline_event.status = EventStatus.BLOCKED
                    timeline_event.lock_type = lock_needed
                    blockers = self._get_blockers_for_lock(lock_needed, workload_event.connection_id)
                    timeline_event.blocked_by = blockers
                    timeline_event.blocking_reason = (
                        f"Cannot acquire {lock_needed.value} lock"
                    )
                    self.timeline.append(timeline_event)
                    result.blocked_events += 1

                    self.lock_manager.request_lock(
                        workload_event.connection_id,
                        lock_needed,
                        current_time,
                        reason=f"{workload_event.operation.value} operation",
                    )
                    continue

                if lock_needed:
                    self.lock_manager.request_lock(
                        workload_event.connection_id,
                        lock_needed,
                        current_time,
                        reason=f"{workload_event.operation.value} operation",
                    )
                    timeline_event.lock_type = lock_needed

                timeline_event.status = EventStatus.RUNNING
                timeline_event.end_time = current_time + timedelta(
                    milliseconds=workload_event.duration_ms
                )
                conn_state.current_event = timeline_event
                in_progress.append(timeline_event)
                self.timeline.append(timeline_event)

            for conn_id in list(self.connections.keys()):
                conn_state = self.connections[conn_id]
                
                if self.config.enable_deadlock_detection:
                    deadlock = self.lock_manager.check_deadlock(conn_id, current_time)
                    if deadlock and not any(
                        d.connections == deadlock.connections for d in result.deadlocks
                    ):
                        result.deadlocks.append(deadlock)
                        result.success = False
                
                starvation = self.lock_manager.check_starvation_risk(
                    conn_id, current_time, self.config.starvation_threshold_ms
                )
                if starvation and not any(
                    s.connection_id == starvation.connection_id for s in result.starvation_risks
                ):
                    result.starvation_risks.append(starvation)

            status = self.lock_manager.get_status()
            result.lock_statuses.append(status)

        result.lock_history = self.lock_manager.lock_history
        result.completed_events = len(
            [e for e in self.timeline if e.status == EventStatus.COMPLETED]
        )
        result.timeout_events = len(
            [e for e in self.timeline if e.status == EventStatus.TIMEOUT]
        )
        result.blocked_events = len(
            [e for e in self.timeline if e.status == EventStatus.BLOCKED]
        )

        return result

    def _create_timeline_event(
        self, workload_event: WorkloadEvent, start_time: datetime
    ) -> TimelineEvent:
        self.event_counter += 1
        return TimelineEvent(
            event_id=f"evt-{self.event_counter:06d}",
            connection_id=workload_event.connection_id,
            operation=workload_event.operation,
            start_time=start_time,
            duration_ms=workload_event.duration_ms,
            status=EventStatus.PENDING,
            details={
                "table": workload_event.table,
                "row_id": workload_event.row_id,
                "data": workload_event.data,
            },
        )

    def _check_operation_needs_lock(
        self, event: WorkloadEvent, conn_state: ConnectionState
    ) -> tuple[bool, Optional[LockType]]:
        if event.operation == OperationType.BEGIN:
            return True, None
        
        if event.operation in [OperationType.COMMIT, OperationType.ROLLBACK]:
            return False, None
        
        if event.operation == OperationType.READ:
            if conn_state.held_lock == LockType.SHARED:
                return False, None
            return True, LockType.SHARED
        
        if event.operation == OperationType.WRITE:
            if conn_state.held_lock == LockType.EXCLUSIVE:
                return False, None
            if conn_state.held_lock == LockType.RESERVED:
                return True, LockType.PENDING
            if conn_state.held_lock == LockType.SHARED:
                return True, LockType.RESERVED
            return True, LockType.RESERVED
        
        return False, None

    def _get_blockers_for_lock(self, lock_type: LockType, connection_id: str) -> List[str]:
        blockers = set()
        status = self.lock_manager.get_status()
        
        for holder in status.holders:
            if holder.connection_id == connection_id:
                continue
            if lock_type not in LockManager.COMPATIBILITY[holder.lock_type]:
                blockers.add(holder.connection_id)
        
        for waiter in status.waiting:
            if waiter.connection_id == connection_id:
                continue
            if lock_type not in LockManager.COMPATIBILITY.get(waiter.lock_type, set()):
                blockers.add(waiter.connection_id)
        
        return list(blockers)

    def _complete_event(
        self, timeline_event: TimelineEvent, current_time: datetime, result: SimulationResult
    ):
        conn_state = self.connections[timeline_event.connection_id]
        conn_state.current_event = None
        conn_state.completed_events.append(timeline_event)

        if timeline_event.operation == OperationType.BEGIN:
            conn_state.in_transaction = True
            conn_state.transaction_start = current_time
        elif timeline_event.operation in [OperationType.COMMIT, OperationType.ROLLBACK]:
            conn_state.in_transaction = False
            conn_state.transaction_start = None
            self.lock_manager.release_lock(timeline_event.connection_id, current_time)
            conn_state.held_lock = None
        elif timeline_event.operation == OperationType.WRITE:
            status = self.lock_manager.get_status()
            for holder in status.holders:
                if holder.connection_id == timeline_event.connection_id:
                    conn_state.held_lock = holder.lock_type
                    break
        elif timeline_event.operation == OperationType.READ:
            status = self.lock_manager.get_status()
            for holder in status.holders:
                if holder.connection_id == timeline_event.connection_id:
                    conn_state.held_lock = holder.lock_type
                    break

        timeline_event.status = EventStatus.COMPLETED
        result.completed_events += 1

    def explain_block(self, connection_id: str) -> Dict[str, Any]:
        status = self.lock_manager.get_status()
        conn_state = self.connections.get(connection_id)
        
        if not conn_state:
            return {"error": f"Connection {connection_id} not found"}
        
        waiting_for = None
        for waiter in status.waiting:
            if waiter.connection_id == connection_id:
                waiting_for = waiter
                break
        
        blockers = []
        if waiting_for:
            for holder in status.holders:
                if holder.connection_id == connection_id:
                    continue
                if waiting_for.lock_type not in LockManager.COMPATIBILITY[holder.lock_type]:
                    blockers.append({
                        "connection_id": holder.connection_id,
                        "lock_type": holder.lock_type.value,
                        "acquired_at": holder.acquired_at.isoformat() if holder.acquired_at else None,
                    })
        
        return {
            "connection_id": connection_id,
            "in_transaction": conn_state.in_transaction,
            "held_lock": conn_state.held_lock.value if conn_state.held_lock else None,
            "waiting_for": {
                "lock_type": waiting_for.lock_type.value if waiting_for else None,
                "requested_at": waiting_for.requested_at.isoformat() if waiting_for else None,
                "reason": waiting_for.reason if waiting_for else None,
            } if waiting_for else None,
            "blocked_by": blockers,
            "current_lock_state": status.current_lock.value,
        }
