from datetime import datetime, timedelta
from typing import Dict, Optional
from .store import InMemoryStore
from .models import (
    TenantConfig,
    RequestRecord,
    RequestStatus,
    RejectReason,
    CircuitBreakerState,
    CircuitState,
)


class RateLimiter:
    def __init__(self, store: InMemoryStore):
        self.store = store

    def check_tenant_rate_limit(self, tenant_id: str) -> bool:
        return self.store.check_rate_limit(tenant_id)

    def check_concurrency_limit(self, tenant_id: str) -> bool:
        config = self.store.get_tenant(tenant_id)
        if not config:
            return False
        active = self.store.get_active_requests_count(tenant_id)
        return active < config.max_concurrency


class CircuitBreaker:
    def __init__(self, store: InMemoryStore):
        self.store = store

    def _get_or_create_state(self, tenant_id: str) -> CircuitBreakerState:
        state = self.store.get_circuit_breaker(tenant_id)
        if not state:
            state = CircuitBreakerState(
                tenant_id=tenant_id,
                state=CircuitState.CLOSED,
                last_state_change=datetime.now(),
                open_timeout=datetime.now(),
            )
            self.store.update_circuit_breaker(state)
        return state

    def check_circuit(self, tenant_id: str) -> CircuitState:
        state = self._get_or_create_state(tenant_id)
        now = datetime.now()
        
        if state.state == CircuitState.OPEN:
            if now >= state.open_timeout:
                state.state = CircuitState.HALF_OPEN
                state.last_state_change = now
                state.half_open_success_count = 0
                state.half_open_total_count = 0
                self.store.update_circuit_breaker(state)
        return state.state

    def on_success(self, tenant_id: str):
        state = self._get_or_create_state(tenant_id)
        
        if state.state == CircuitState.HALF_OPEN:
            state.half_open_success_count += 1
            state.half_open_total_count += 1
            
            config = self.store.get_tenant(tenant_id)
            if config and state.half_open_success_count >= config.half_open_max_requests:
                state.state = CircuitState.CLOSED
                state.last_state_change = datetime.now()
                state.error_count = 0
                state.success_count = 0
                state.request_count = 0
        elif state.state == CircuitState.CLOSED:
            state.success_count += 1
            state.request_count += 1
        
        self.store.update_circuit_breaker(state)

    def on_failure(self, tenant_id: str):
        state = self._get_or_create_state(tenant_id)
        config = self.store.get_tenant(tenant_id)
        
        if not config:
            return
        
        if state.state == CircuitState.HALF_OPEN:
            state.state = CircuitState.OPEN
            state.last_state_change = datetime.now()
            state.open_timeout = datetime.now() + timedelta(seconds=config.circuit_breaker_timeout)
        elif state.state == CircuitState.CLOSED:
            state.error_count += 1
            state.request_count += 1
            
            if state.request_count >= 10:
                error_rate = state.error_count / state.request_count
                if error_rate >= config.circuit_breaker_error_threshold:
                    state.state = CircuitState.OPEN
                    state.last_state_change = datetime.now()
                    state.open_timeout = datetime.now() + timedelta(seconds=config.circuit_breaker_timeout)
        
        self.store.update_circuit_breaker(state)

    def get_state(self, tenant_id: str) -> CircuitBreakerState:
        return self._get_or_create_state(tenant_id)


class RequestProcessor:
    def __init__(self, store: InMemoryStore):
        self.store = store
        self.rate_limiter = RateLimiter(store)
        self.circuit_breaker = CircuitBreaker(store)

    def _create_request_record(self, tenant_id: str, payload: dict) -> RequestRecord:
        return RequestRecord(
            tenant_id=tenant_id,
            status=RequestStatus.PENDING,
            queued_at=datetime.now(),
            payload=payload,
        )

    def _reject_request(self, record: RequestRecord, reason: RejectReason, 
                       block_point: str, error_message: str = None) -> RequestRecord:
        previous_record = self.store.get_previous_record(record.tenant_id, record.queued_at)
        previous_id = previous_record.request_id if previous_record else None
        
        record.status = RequestStatus.REJECTED
        record.reject_reason = reason
        record.current_block_point = block_point
        record.previous_processing_record = previous_id
        record.completed_at = datetime.now()
        record.error_message = error_message
        
        self.store.update_request(record.request_id, 
            status=record.status,
            reject_reason=record.reject_reason,
            current_block_point=record.current_block_point,
            previous_processing_record=record.previous_processing_record,
            completed_at=record.completed_at,
            error_message=record.error_message
        )
        return record

    def submit_request(self, tenant_id: str, payload: dict) -> RequestRecord:
        config = self.store.get_tenant(tenant_id)
        
        if not config:
            record = self._create_request_record(tenant_id, payload)
            self.store.save_request(record)
            return self._reject_request(record, RejectReason.TENANT_DISABLED, 
                "tenant_lookup", "Tenant not found")
        
        if not config.enabled:
            record = self._create_request_record(tenant_id, payload)
            self.store.save_request(record)
            return self._reject_request(record, RejectReason.TENANT_DISABLED,
                "tenant_status", "Tenant is disabled")
        
        circuit_state = self.circuit_breaker.check_circuit(tenant_id)
        if circuit_state == CircuitState.OPEN:
            record = self._create_request_record(tenant_id, payload)
            self.store.save_request(record)
            state = self.circuit_breaker.get_state(tenant_id)
            remaining = (state.open_timeout - datetime.now()).total_seconds()
            return self._reject_request(record, RejectReason.CIRCUIT_OPEN,
                "circuit_breaker", f"Circuit breaker is open, will reset in {remaining:.1f} seconds")
        
        if not self.rate_limiter.check_tenant_rate_limit(tenant_id):
            record = self._create_request_record(tenant_id, payload)
            self.store.save_request(record)
            count = self.store.get_rate_limit_count(tenant_id)
            return self._reject_request(record, RejectReason.RATE_LIMIT,
                "rate_limit", f"Rate limit exceeded: {count}/{config.rate_limit_per_minute} per minute")
        
        if not self.rate_limiter.check_concurrency_limit(tenant_id):
            queue_depth = self.store.get_queue_depth(tenant_id)
            if queue_depth >= config.max_queue_size:
                record = self._create_request_record(tenant_id, payload)
                self.store.save_request(record)
                return self._reject_request(record, RejectReason.QUEUE_FULL,
                    "queue_depth", f"Queue is full: {queue_depth}/{config.max_queue_size}")
            
            record = self._create_request_record(tenant_id, payload)
            self.store.save_request(record)
            enqueued = self.store.enqueue_request(tenant_id, record.request_id)
            if not enqueued:
                return self._reject_request(record, RejectReason.QUEUE_FULL,
                    "queue_enqueue", "Failed to enqueue request")
            
            record.status = RequestStatus.PENDING
            self.store.update_request(record.request_id, status=RequestStatus.PENDING)
            return record
        
        record = self._create_request_record(tenant_id, payload)
        self.store.save_request(record)
        return record

    def process_next(self, tenant_id: str) -> Optional[RequestRecord]:
        request_id = self.store.dequeue_request(tenant_id)
        if request_id:
            record = self.store.get_request(request_id)
            if record:
                self.store.update_request(request_id, 
                    status=RequestStatus.PROCESSING,
                    started_at=datetime.now()
                )
                return self.store.get_request(request_id)
        return None

    def complete_request(self, request_id: str, success: bool, 
                        response: dict = None, error_message: str = None,
                        degraded: bool = False, degraded_reason: str = None) -> RequestRecord:
        record = self.store.get_request(request_id)
        if not record:
            return None
        
        completed_at = datetime.now()
        latency = None
        if record.started_at:
            latency = (completed_at - record.started_at).total_seconds() * 1000
        
        status = RequestStatus.SUCCESS if success else RequestStatus.FAILED
        if degraded:
            status = RequestStatus.DEGRADED
        
        updates = {
            'status': status,
            'completed_at': completed_at,
            'latency_ms': latency,
            'response': response or {},
            'error_message': error_message,
            'degraded': degraded,
            'degraded_reason': degraded_reason,
        }
        
        self.store.update_request(request_id, **updates)
        
        if success and not degraded:
            self.circuit_breaker.on_success(record.tenant_id)
        else:
            self.circuit_breaker.on_failure(record.tenant_id)
        
        return self.store.get_request(request_id)

    def timeout_request(self, request_id: str) -> RequestRecord:
        record = self.store.get_request(request_id)
        if not record:
            return None
        
        completed_at = datetime.now()
        latency = None
        if record.started_at:
            latency = (completed_at - record.started_at).total_seconds() * 1000
        
        self.store.update_request(request_id,
            status=RequestStatus.TIMEOUT,
            completed_at=completed_at,
            latency_ms=latency,
            error_message="Request timeout"
        )
        
        self.circuit_breaker.on_failure(record.tenant_id)
        return self.store.get_request(request_id)
