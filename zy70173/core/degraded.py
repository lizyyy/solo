from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable, Any
from .store import InMemoryStore
from .models import (
    RequestRecord,
    RequestStatus,
    TenantConfig,
    SLOConfig,
    SLOReport,
    BackgroundTaskRecord,
    BackgroundTaskStatus,
)
from .rate_limiter import CircuitBreaker


class DegradedResponseManager:
    def __init__(self, store: InMemoryStore):
        self.store = store
        self._degraded_handlers: Dict[str, Callable] = {}

    def register_degraded_handler(self, handler_type: str, handler: Callable):
        self._degraded_handlers[handler_type] = handler

    def get_degraded_response(self, tenant_id: str, payload: Dict[str, Any], 
                             reason: str) -> Dict[str, Any]:
        config = self.store.get_tenant(tenant_id)
        if not config:
            return self._default_degraded(payload, reason)
        
        for handler_type, handler in self._degraded_handlers.items():
            if handler_type in reason or handler_type in str(payload):
                try:
                    result = handler(tenant_id, payload, reason)
                    if result:
                        return result
                except Exception:
                    pass
        
        return self._default_degraded(payload, reason)

    def _default_degraded(self, payload: Dict[str, Any], reason: str) -> Dict[str, Any]:
        return {
            "degraded": True,
            "reason": reason,
            "warning": "This is a degraded response. Service is under high load or experiencing issues.",
            "original_payload_summary": str(payload)[:100] if payload else None,
            "timestamp": datetime.now().isoformat(),
        }


class RecoveryProbe:
    def __init__(self, store: InMemoryStore, circuit_breaker: CircuitBreaker):
        self.store = store
        self.circuit_breaker = circuit_breaker
        self._probe_interval = 5

    def run_probe(self, tenant_id: str, test_payload: Dict[str, Any] = None) -> Dict[str, Any]:
        state = self.store.get_circuit_breaker(tenant_id)
        if not state:
            return {"error": "Circuit breaker not found"}
        
        result = {
            "tenant_id": tenant_id,
            "probe_time": datetime.now().isoformat(),
            "circuit_state": state.state,
        }
        
        circuit_state = self.circuit_breaker.check_circuit(tenant_id)
        result["checked_state"] = circuit_state
        
        if circuit_state.value == "half_open":
            result["action"] = "System has transitioned to HALF_OPEN state"
            result["message"] = "Circuit breaker is allowing limited requests to test recovery"
        elif circuit_state.value == "closed":
            result["action"] = "Circuit is closed"
            result["message"] = "Service is operating normally"
        else:
            remaining = (state.open_timeout - datetime.now()).total_seconds()
            result["remaining_timeout_seconds"] = max(0, remaining)
            result["action"] = "Waiting for timeout"
            result["message"] = f"Circuit breaker will allow probe requests in {remaining:.1f} seconds"
        
        return result

    def force_half_open(self, tenant_id: str) -> Dict[str, Any]:
        state = self.store.get_circuit_breaker(tenant_id)
        if not state:
            return {"error": "Circuit breaker not found"}
        
        config = self.store.get_tenant(tenant_id)
        if not config:
            return {"error": "Tenant not found"}
        
        state.state = "half_open"
        state.last_state_change = datetime.now()
        state.half_open_success_count = 0
        state.half_open_total_count = 0
        self.store.update_circuit_breaker(state)
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "action": "Force transitioned to HALF_OPEN",
            "message": f"Will allow up to {config.half_open_max_requests} test requests"
        }

    def reset_circuit(self, tenant_id: str) -> Dict[str, Any]:
        state = self.store.get_circuit_breaker(tenant_id)
        if not state:
            return {"error": "Circuit breaker not found"}
        
        state.state = "closed"
        state.last_state_change = datetime.now()
        state.error_count = 0
        state.success_count = 0
        state.request_count = 0
        state.half_open_success_count = 0
        state.half_open_total_count = 0
        self.store.update_circuit_breaker(state)
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "action": "Circuit reset to CLOSED",
            "message": "All error counters have been reset"
        }


class SLOCalculator:
    def __init__(self, store: InMemoryStore):
        self.store = store

    def _calculate_percentile(self, values: List[float], percentile: float) -> float:
        if not values:
            return 0.0
        sorted_vals = sorted(values)
        index = int(len(sorted_vals) * percentile)
        if index >= len(sorted_vals):
            index = len(sorted_vals) - 1
        return sorted_vals[index]

    def generate_report(self, slo_config: SLOConfig) -> SLOReport:
        period_end = datetime.now()
        period_start = period_end - timedelta(days=slo_config.window_days)
        
        history = self.store.get_request_history(
            tenant_id=slo_config.tenant_id,
            start_time=period_start,
            end_time=period_end
        )
        
        total_requests = len(history)
        successful = sum(1 for r in history if r.status == RequestStatus.SUCCESS)
        degraded = sum(1 for r in history if r.status == RequestStatus.DEGRADED)
        rejected = sum(1 for r in history if r.status == RequestStatus.REJECTED)
        failed = sum(1 for r in history if r.status in [RequestStatus.FAILED, RequestStatus.TIMEOUT])
        
        latencies = [r.latency_ms for r in history if r.latency_ms is not None]
        
        success_rate = successful / total_requests if total_requests > 0 else 1.0
        p95_latency = self._calculate_percentile(latencies, 0.95)
        
        breakdown = {}
        for r in history:
            if r.reject_reason:
                key = r.reject_reason.value
                breakdown[key] = breakdown.get(key, 0) + 1
            if r.status == RequestStatus.FAILED and not r.reject_reason:
                breakdown["execution_failed"] = breakdown.get("execution_failed", 0) + 1
            if r.status == RequestStatus.TIMEOUT:
                breakdown["timeout"] = breakdown.get("timeout", 0) + 1
        
        error_budget = 1.0 - slo_config.target_success_rate
        actual_errors = 1.0 - success_rate
        error_budget_remaining = max(0, error_budget - actual_errors)
        
        return SLOReport(
            slo_name=slo_config.name,
            tenant_id=slo_config.tenant_id,
            period_start=period_start,
            period_end=period_end,
            total_requests=total_requests,
            successful_requests=successful,
            success_rate=success_rate,
            target_success_rate=slo_config.target_success_rate,
            success_rate_achieved=success_rate >= slo_config.target_success_rate,
            p95_latency_ms=p95_latency,
            target_p95_latency_ms=slo_config.target_latency_p95_ms,
            latency_achieved=p95_latency <= slo_config.target_latency_p95_ms,
            error_budget_remaining=error_budget_remaining,
            degraded_requests=degraded,
            rejected_requests=rejected,
            breakdown_by_reason=breakdown,
        )

    def generate_all_reports(self) -> List[SLOReport]:
        reports = []
        for config in self.store.get_slo_configs():
            reports.append(self.generate_report(config))
        return reports

    def get_detailed_breakdown(self, tenant_id: str, 
                               start_time: datetime, 
                               end_time: datetime) -> Dict[str, Any]:
        history = self.store.get_request_history(
            tenant_id=tenant_id,
            start_time=start_time,
            end_time=end_time
        )
        
        by_status = {}
        by_reason = {}
        request_ids = []
        
        for r in history:
            status_key = r.status.value
            by_status[status_key] = by_status.get(status_key, 0) + 1
            
            if r.reject_reason:
                reason_key = r.reject_reason.value
                by_reason[reason_key] = by_reason.get(reason_key, 0) + 1
            
            request_ids.append(r.request_id)
        
        return {
            "tenant_id": tenant_id,
            "period_start": start_time.isoformat(),
            "period_end": end_time.isoformat(),
            "total_requests": len(history),
            "by_status": by_status,
            "by_reason": by_reason,
            "request_ids": request_ids,
        }


class BackgroundTaskManager:
    def __init__(self, store: InMemoryStore):
        self.store = store

    def create_task(self, task_type: str, tenant_id: str = None, 
                   max_retries: int = 3) -> BackgroundTaskRecord:
        task = BackgroundTaskRecord(
            task_type=task_type,
            tenant_id=tenant_id,
            status=BackgroundTaskStatus.PENDING,
            created_at=datetime.now(),
            max_retries=max_retries,
        )
        self.store.create_background_task(task)
        return task

    def start_task(self, task_id: str) -> bool:
        task = self.store.get_background_task(task_id)
        if not task or task.status not in [BackgroundTaskStatus.PENDING, BackgroundTaskStatus.RETRY]:
            return False
        
        self.store.update_background_task(
            task_id,
            status=BackgroundTaskStatus.RUNNING,
            started_at=datetime.now(),
        )
        return True

    def complete_task(self, task_id: str, result: Dict[str, Any] = None) -> bool:
        self.store.update_background_task(
            task_id,
            status=BackgroundTaskStatus.SUCCESS,
            completed_at=datetime.now(),
            result=result or {},
        )
        return True

    def fail_task(self, task_id: str, error_message: str) -> Dict[str, Any]:
        task = self.store.get_background_task(task_id)
        if not task:
            return {"error": "Task not found"}
        
        attempts_made = task.retry_count + 1
        
        if attempts_made < task.max_retries:
            new_retry_count = task.retry_count + 1
            next_retry = datetime.now() + timedelta(seconds=2 ** new_retry_count)
            
            self.store.update_background_task(
                task_id,
                status=BackgroundTaskStatus.RETRY,
                retry_count=new_retry_count,
                error_message=error_message,
                next_retry_at=next_retry,
            )
            
            return {
                "status": "retry_scheduled",
                "retry_count": new_retry_count,
                "max_retries": task.max_retries,
                "next_retry_at": next_retry.isoformat(),
                "error_message": error_message,
            }
        else:
            self.store.update_background_task(
                task_id,
                status=BackgroundTaskStatus.FAILED,
                completed_at=datetime.now(),
                error_message=error_message,
            )
            
            return {
                "status": "failed_permanently",
                "retry_count": task.retry_count,
                "max_retries": task.max_retries,
                "error_message": error_message,
                "action_required": "Manual intervention required - max retries exceeded",
            }

    def retry_task(self, task_id: str) -> bool:
        task = self.store.get_background_task(task_id)
        if not task or task.status != BackgroundTaskStatus.FAILED:
            return False
        
        self.store.update_background_task(
            task_id,
            status=BackgroundTaskStatus.PENDING,
            retry_count=0,
            error_message=None,
            next_retry_at=None,
            started_at=None,
            completed_at=None,
        )
        return True

    def get_task_status(self, task_id: str) -> Optional[BackgroundTaskRecord]:
        return self.store.get_background_task(task_id)

    def list_tasks(self, tenant_id: str = None) -> List[BackgroundTaskRecord]:
        return self.store.list_background_tasks(tenant_id)
