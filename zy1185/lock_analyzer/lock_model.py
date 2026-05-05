from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Set


class LockType(Enum):
    UNLOCKED = "unlocked"
    SHARED = "shared"
    RESERVED = "reserved"
    PENDING = "pending"
    EXCLUSIVE = "exclusive"


@dataclass
class LockRequest:
    connection_id: str
    lock_type: LockType
    requested_at: datetime
    granted_at: Optional[datetime] = None
    timeout_at: Optional[datetime] = None
    reason: str = ""


@dataclass
class LockHolder:
    connection_id: str
    lock_type: LockType
    acquired_at: datetime


class LockManager:
    COMPATIBILITY: Dict[LockType, Set[LockType]] = {
        LockType.UNLOCKED: {LockType.SHARED, LockType.RESERVED},
        LockType.SHARED: {LockType.SHARED, LockType.RESERVED},
        LockType.RESERVED: {LockType.SHARED},
        LockType.PENDING: set(),
        LockType.EXCLUSIVE: set(),
    }

    UPGRADE_PATH: Dict[LockType, LockType] = {
        LockType.UNLOCKED: LockType.SHARED,
        LockType.SHARED: LockType.RESERVED,
        LockType.RESERVED: LockType.PENDING,
        LockType.PENDING: LockType.EXCLUSIVE,
    }

    def __init__(self, busy_timeout_ms: int = 5000):
        self.current_lock: LockType = LockType.UNLOCKED
        self.holders: Dict[str, LockHolder] = {}
        self.wait_queue: List[LockRequest] = []
        self.busy_timeout_ms = busy_timeout_ms
        self.lock_history: List[LockEvent] = []

    def can_acquire(self, lock_type: LockType, connection_id: str) -> bool:
        current_holders = list(self.holders.values())
        
        if not current_holders:
            return True
        
        other_holders = [h for h in current_holders if h.connection_id != connection_id]
        
        if not other_holders:
            return self._can_upgrade(self.holders[connection_id].lock_type, lock_type)
        
        for holder in other_holders:
            if lock_type not in self.COMPATIBILITY[holder.lock_type]:
                return False
        
        return True

    def _can_upgrade(self, current: LockType, target: LockType) -> bool:
        if current == target:
            return True
        
        upgrade_chain = []
        current_type = current
        while current_type in self.UPGRADE_PATH:
            next_type = self.UPGRADE_PATH[current_type]
            upgrade_chain.append(next_type)
            current_type = next_type
        
        return target in upgrade_chain

    def request_lock(
        self,
        connection_id: str,
        lock_type: LockType,
        requested_at: datetime,
        reason: str = "",
    ) -> LockRequest:
        request = LockRequest(
            connection_id=connection_id,
            lock_type=lock_type,
            requested_at=requested_at,
            timeout_at=(
                datetime.fromtimestamp(requested_at.timestamp() + self.busy_timeout_ms / 1000)
                if self.busy_timeout_ms > 0
                else None
            ),
            reason=reason,
        )

        if self.can_acquire(lock_type, connection_id):
            self._grant_lock(request, requested_at)
        else:
            self.wait_queue.append(request)
            self._record_event(
                event_type="WAIT",
                connection_id=connection_id,
                lock_type=lock_type,
                timestamp=requested_at,
                reason=reason,
            )

        return request

    def _grant_lock(self, request: LockRequest, granted_at: datetime):
        request.granted_at = granted_at
        
        if request.connection_id in self.holders:
            old_type = self.holders[request.connection_id].lock_type
            self.holders[request.connection_id].lock_type = request.lock_type
            self.holders[request.connection_id].acquired_at = granted_at
            self._record_event(
                event_type="UPGRADE",
                connection_id=request.connection_id,
                lock_type=request.lock_type,
                from_type=old_type,
                timestamp=granted_at,
                reason=request.reason,
            )
        else:
            self.holders[request.connection_id] = LockHolder(
                connection_id=request.connection_id,
                lock_type=request.lock_type,
                acquired_at=granted_at,
            )
            self._record_event(
                event_type="ACQUIRE",
                connection_id=request.connection_id,
                lock_type=request.lock_type,
                timestamp=granted_at,
                reason=request.reason,
            )
        
        self._update_current_lock()

    def release_lock(self, connection_id: str, released_at: datetime) -> bool:
        if connection_id not in self.holders:
            return False
        
        holder = self.holders.pop(connection_id)
        self._record_event(
            event_type="RELEASE",
            connection_id=connection_id,
            lock_type=holder.lock_type,
            timestamp=released_at,
        )
        
        self._update_current_lock()
        self._process_wait_queue(released_at)
        
        return True

    def _update_current_lock(self):
        if not self.holders:
            self.current_lock = LockType.UNLOCKED
            return
        
        lock_types = [h.lock_type for h in self.holders.values()]
        
        if LockType.EXCLUSIVE in lock_types:
            self.current_lock = LockType.EXCLUSIVE
        elif LockType.PENDING in lock_types:
            self.current_lock = LockType.PENDING
        elif LockType.RESERVED in lock_types:
            self.current_lock = LockType.RESERVED
        else:
            self.current_lock = LockType.SHARED

    def _process_wait_queue(self, current_time: datetime):
        granted = []
        remaining = []
        
        for request in self.wait_queue:
            if request.timeout_at and current_time >= request.timeout_at:
                self._record_event(
                    event_type="TIMEOUT",
                    connection_id=request.connection_id,
                    lock_type=request.lock_type,
                    timestamp=current_time,
                    reason="Busy timeout expired",
                )
                continue
            
            if self.can_acquire(request.lock_type, request.connection_id):
                self._grant_lock(request, current_time)
                granted.append(request)
            else:
                remaining.append(request)
        
        self.wait_queue = remaining

    def check_deadlock(self, connection_id: str, current_time: datetime) -> Optional[DeadlockInfo]:
        if not self.wait_queue:
            return None
        
        waiting_for: Dict[str, Set[str]] = {}
        
        for request in self.wait_queue:
            blockers = self._get_blockers(request)
            if blockers:
                waiting_for[request.connection_id] = blockers
        
        for holder in self.holders.values():
            for request in self.wait_queue:
                if holder.connection_id not in waiting_for:
                    waiting_for[holder.connection_id] = set()
                
                if self._is_blocking(holder, request):
                    waiting_for[holder.connection_id].add(request.connection_id)
        
        cycle = self._find_cycle(waiting_for)
        if cycle:
            return DeadlockInfo(
                connections=cycle,
                detected_at=current_time,
                waiting_graph=waiting_for,
            )
        
        return None

    def _get_blockers(self, request: LockRequest) -> Set[str]:
        blockers = set()
        for holder in self.holders.values():
            if holder.connection_id == request.connection_id:
                continue
            if request.lock_type not in self.COMPATIBILITY[holder.lock_type]:
                blockers.add(holder.connection_id)
        return blockers

    def _is_blocking(self, holder: LockHolder, request: LockRequest) -> bool:
        if holder.connection_id == request.connection_id:
            return False
        return request.lock_type not in self.COMPATIBILITY[holder.lock_type]

    def _find_cycle(self, graph: Dict[str, Set[str]]) -> Optional[List[str]]:
        visited = set()
        rec_stack = set()
        
        def dfs(node: str, path: List[str]) -> Optional[List[str]]:
            if node in rec_stack:
                cycle_start = path.index(node)
                return path[cycle_start:] + [node]
            if node in visited:
                return None
            
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in graph.get(node, set()):
                result = dfs(neighbor, path)
                if result:
                    return result
            
            path.pop()
            rec_stack.remove(node)
            return None
        
        for node in graph:
            result = dfs(node, [])
            if result:
                return result
        
        return None

    def check_starvation_risk(
        self, connection_id: str, current_time: datetime, threshold_ms: int = 30000
    ) -> Optional[StarvationInfo]:
        for request in self.wait_queue:
            if request.connection_id != connection_id:
                continue
            
            wait_time_ms = (current_time - request.requested_at).total_seconds() * 1000
            
            if wait_time_ms >= threshold_ms:
                blockers = self._get_blockers(request)
                return StarvationInfo(
                    connection_id=connection_id,
                    waiting_since=request.requested_at,
                    wait_time_ms=wait_time_ms,
                    blocked_by=list(blockers),
                    threshold_ms=threshold_ms,
                )
        
        return None

    def _record_event(
        self,
        event_type: str,
        connection_id: str,
        lock_type: LockType,
        timestamp: datetime,
        from_type: Optional[LockType] = None,
        reason: str = "",
    ):
        self.lock_history.append(
            LockEvent(
                event_type=event_type,
                connection_id=connection_id,
                lock_type=lock_type,
                from_type=from_type,
                timestamp=timestamp,
                reason=reason,
            )
        )

    def get_status(self) -> LockStatus:
        return LockStatus(
            current_lock=self.current_lock,
            holders=[
                HolderInfo(
                    connection_id=h.connection_id,
                    lock_type=h.lock_type,
                    acquired_at=h.acquired_at,
                )
                for h in self.holders.values()
            ],
            waiting=[
                WaitInfo(
                    connection_id=r.connection_id,
                    lock_type=r.lock_type,
                    requested_at=r.requested_at,
                    reason=r.reason,
                )
                for r in self.wait_queue
            ],
        )


@dataclass
class LockEvent:
    event_type: str
    connection_id: str
    lock_type: LockType
    timestamp: datetime
    from_type: Optional[LockType] = None
    reason: str = ""


@dataclass
class HolderInfo:
    connection_id: str
    lock_type: LockType
    acquired_at: datetime


@dataclass
class WaitInfo:
    connection_id: str
    lock_type: LockType
    requested_at: datetime
    reason: str = ""


@dataclass
class LockStatus:
    current_lock: LockType
    holders: List[HolderInfo] = field(default_factory=list)
    waiting: List[WaitInfo] = field(default_factory=list)


@dataclass
class DeadlockInfo:
    connections: List[str]
    detected_at: datetime
    waiting_graph: Dict[str, Set[str]]


@dataclass
class StarvationInfo:
    connection_id: str
    waiting_since: datetime
    wait_time_ms: float
    blocked_by: List[str]
    threshold_ms: int
