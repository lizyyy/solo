from typing import Dict, List, Optional, Deque
from datetime import datetime, timedelta
from collections import deque
import threading
import json
import os
from .models import (
    TenantConfig,
    RequestRecord,
    RequestStatus,
    RejectReason,
    CircuitBreakerState,
    CircuitState,
    SLOConfig,
    SLOReport,
    BackgroundTaskRecord,
    BackgroundTaskStatus,
)


class InMemoryStore:
    def __init__(self):
        self._tenants: Dict[str, TenantConfig] = {}
        self._tenant_queues: Dict[str, Deque[str]] = {}
        self._active_requests: Dict[str, RequestRecord] = {}
        self._request_history: Deque[RequestRecord] = deque()
        self._circuit_breakers: Dict[str, CircuitBreakerState] = {}
        self._tenant_rate_limits: Dict[str, Deque[datetime]] = {}
        self._slo_configs: List[SLOConfig] = []
        self._background_tasks: Dict[str, BackgroundTaskRecord] = {}
        self._lock = threading.RLock()
        self._max_history = 10000

    def add_tenant(self, config: TenantConfig) -> None:
        with self._lock:
            self._tenants[config.tenant_id] = config
            self._tenant_queues[config.tenant_id] = deque()
            self._tenant_rate_limits[config.tenant_id] = deque()
            self._circuit_breakers[config.tenant_id] = CircuitBreakerState(
                tenant_id=config.tenant_id,
                state=CircuitState.CLOSED,
                last_state_change=datetime.now(),
                open_timeout=datetime.now(),
            )

    def get_tenant(self, tenant_id: str) -> Optional[TenantConfig]:
        with self._lock:
            return self._tenants.get(tenant_id)

    def list_tenants(self) -> List[TenantConfig]:
        with self._lock:
            return list(self._tenants.values())

    def update_tenant(self, config: TenantConfig) -> None:
        with self._lock:
            self._tenants[config.tenant_id] = config

    def enqueue_request(self, tenant_id: str, request_id: str) -> bool:
        with self._lock:
            config = self._tenants.get(tenant_id)
            if config:
                queue = self._tenant_queues[tenant_id]
                if len(queue) < config.max_queue_size:
                    queue.append(request_id)
                    return True
            return False

    def dequeue_request(self, tenant_id: str) -> Optional[str]:
        with self._lock:
            queue = self._tenant_queues.get(tenant_id)
            if queue and len(queue) > 0:
                return queue.popleft()
            return None

    def get_queue_depth(self, tenant_id: str) -> int:
        with self._lock:
            queue = self._tenant_queues.get(tenant_id)
            return len(queue) if queue else 0

    def save_request(self, record: RequestRecord) -> None:
        with self._lock:
            self._active_requests[record.request_id] = record

    def update_request(self, request_id: str, **kwargs) -> None:
        with self._lock:
            if request_id in self._active_requests:
                record = self._active_requests[request_id]
                for key, value in kwargs.items():
                    if hasattr(record, key):
                        setattr(record, key, value)
                if record.status in [RequestStatus.SUCCESS, RequestStatus.REJECTED, RequestStatus.FAILED, RequestStatus.TIMEOUT, RequestStatus.DEGRADED]:
                    self._request_history.append(record)
                    if len(self._request_history) > self._max_history:
                        self._request_history.popleft()
                    del self._active_requests[request_id]

    def get_request(self, request_id: str) -> Optional[RequestRecord]:
        with self._lock:
            if request_id in self._active_requests:
                return self._active_requests[request_id]
            for record in self._request_history:
                if record.request_id == request_id:
                    return record
            return None

    def get_previous_record(self, tenant_id: str, before_time: datetime) -> Optional[RequestRecord]:
        with self._lock:
            for record in reversed(self._request_history):
                if record.tenant_id == tenant_id and record.completed_at and record.completed_at < before_time:
                    return record
            return None

    def get_active_requests_count(self, tenant_id: str) -> int:
        with self._lock:
            return sum(1 for r in self._active_requests.values() if r.tenant_id == tenant_id)

    def get_circuit_breaker(self, tenant_id: str) -> Optional[CircuitBreakerState]:
        with self._lock:
            return self._circuit_breakers.get(tenant_id)

    def update_circuit_breaker(self, state: CircuitBreakerState) -> None:
        with self._lock:
            self._circuit_breakers[state.tenant_id] = state

    def check_rate_limit(self, tenant_id: str) -> bool:
        with self._lock:
            config = self._tenants.get(tenant_id)
            if not config:
                return False
            now = datetime.now()
            timestamps = self._tenant_rate_limits[tenant_id]
            while timestamps and (now - timestamps[0]).total_seconds() > 60:
                timestamps.popleft()
            if len(timestamps) < config.rate_limit_per_minute:
                timestamps.append(now)
                return True
            return False

    def get_rate_limit_count(self, tenant_id: str) -> int:
        with self._lock:
            timestamps = self._tenant_rate_limits.get(tenant_id, deque())
            now = datetime.now()
            return sum(1 for t in timestamps if (now - t).total_seconds() <= 60)

    def add_slo_config(self, config: SLOConfig) -> None:
        with self._lock:
            self._slo_configs.append(config)

    def get_slo_configs(self) -> List[SLOConfig]:
        with self._lock:
            return list(self._slo_configs)

    def get_request_history(self, tenant_id: Optional[str] = None,
                            start_time: Optional[datetime] = None,
                            end_time: Optional[datetime] = None,
                            status: Optional[RequestStatus] = None) -> List[RequestRecord]:
        with self._lock:
            result = []
            for record in self._request_history:
                if tenant_id and record.tenant_id != tenant_id:
                    continue
                if start_time and record.queued_at < start_time:
                    continue
                if end_time and record.completed_at and record.completed_at > end_time:
                    continue
                if status and record.status != status:
                    continue
                result.append(record)
            return result

    def create_background_task(self, task: BackgroundTaskRecord) -> None:
        with self._lock:
            self._background_tasks[task.task_id] = task

    def update_background_task(self, task_id: str, **kwargs) -> None:
        with self._lock:
            if task_id in self._background_tasks:
                task = self._background_tasks[task_id]
                for key, value in kwargs.items():
                    if hasattr(task, key):
                        setattr(task, key, value)

    def get_background_task(self, task_id: str) -> Optional[BackgroundTaskRecord]:
        with self._lock:
            return self._background_tasks.get(task_id)

    def list_background_tasks(self, tenant_id: Optional[str] = None) -> List[BackgroundTaskRecord]:
        with self._lock:
            tasks = list(self._background_tasks.values())
            if tenant_id:
                tasks = [t for t in tasks if t.tenant_id == tenant_id]
            return tasks
