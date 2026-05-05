from typing import Optional, Dict, Any, Tuple, List
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
import time
from collections import defaultdict

from models import (
    RouteConfig, ProtectionPolicy, CircuitBreakerRecord, CircuitBreakerState,
    RequestDecision, RequestLog, DependencyHealth
)
from policy_version_manager import select_policy_version_for_request, get_active_policy_version


class RateLimiter:
    def __init__(self):
        self.request_counters = defaultdict(lambda: {"count": 0, "window_start": time.time()})
        self.token_buckets = {}
    
    def _init_token_bucket(self, route_key: str, burst: int):
        if route_key not in self.token_buckets:
            self.token_buckets[route_key] = {
                "tokens": burst,
                "last_refill": time.time()
            }
    
    def check_rate_limit(
        self,
        route_key: str,
        policy: ProtectionPolicy,
        current_time: Optional[float] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        if not policy.rate_limit_enabled:
            return True, {
                "enabled": False,
                "reason": "Rate limiting is disabled"
            }
        
        if current_time is None:
            current_time = time.time()
        
        limit_type = policy.rate_limit_type
        threshold = policy.rate_limit_threshold
        window_seconds = policy.rate_limit_window_seconds
        burst = policy.rate_limit_burst
        
        if limit_type == "fixed_window":
            return self._check_fixed_window(
                route_key, threshold, window_seconds, current_time
            )
        elif limit_type == "sliding_window":
            return self._check_sliding_window(
                route_key, threshold, window_seconds, current_time
            )
        elif limit_type == "token_bucket":
            return self._check_token_bucket(
                route_key, threshold, burst, window_seconds, current_time
            )
        else:
            return self._check_fixed_window(
                route_key, threshold, window_seconds, current_time
            )
    
    def _check_fixed_window(
        self,
        route_key: str,
        threshold: int,
        window_seconds: int,
        current_time: float
    ) -> Tuple[bool, Dict[str, Any]]:
        counter = self.request_counters[route_key]
        
        if current_time - counter["window_start"] >= window_seconds:
            counter["count"] = 0
            counter["window_start"] = current_time
        
        if counter["count"] >= threshold:
            return False, {
                "type": "fixed_window",
                "threshold": threshold,
                "current_count": counter["count"],
                "window_seconds": window_seconds,
                "window_remaining": window_seconds - (current_time - counter["window_start"]),
                "reason": f"Rate limit exceeded: {counter['count']}/{threshold} requests in window"
            }
        
        counter["count"] += 1
        
        return True, {
            "type": "fixed_window",
            "threshold": threshold,
            "current_count": counter["count"],
            "window_seconds": window_seconds,
            "reason": "Within rate limit"
        }
    
    def _check_sliding_window(
        self,
        route_key: str,
        threshold: int,
        window_seconds: int,
        current_time: float
    ) -> Tuple[bool, Dict[str, Any]]:
        counter = self.request_counters[route_key]
        
        window_start = current_time - window_seconds
        
        if "request_times" not in counter:
            counter["request_times"] = []
        
        counter["request_times"] = [
            t for t in counter["request_times"] if t > window_start
        ]
        
        request_count = len(counter["request_times"])
        
        if request_count >= threshold:
            oldest_in_window = min(counter["request_times"]) if counter["request_times"] else current_time
            return False, {
                "type": "sliding_window",
                "threshold": threshold,
                "current_count": request_count,
                "window_seconds": window_seconds,
                "window_remaining": window_seconds - (current_time - oldest_in_window),
                "reason": f"Rate limit exceeded: {request_count}/{threshold} requests in sliding window"
            }
        
        counter["request_times"].append(current_time)
        
        return True, {
            "type": "sliding_window",
            "threshold": threshold,
            "current_count": len(counter["request_times"]),
            "window_seconds": window_seconds,
            "reason": "Within rate limit"
        }
    
    def _check_token_bucket(
        self,
        route_key: str,
        rate: int,
        burst: int,
        window_seconds: int,
        current_time: float
    ) -> Tuple[bool, Dict[str, Any]]:
        self._init_token_bucket(route_key, burst)
        bucket = self.token_buckets[route_key]
        
        refill_rate = rate / window_seconds
        time_since_last_refill = current_time - bucket["last_refill"]
        tokens_to_add = time_since_last_refill * refill_rate
        
        bucket["tokens"] = min(bucket["tokens"] + tokens_to_add, burst)
        bucket["last_refill"] = current_time
        
        if bucket["tokens"] < 1:
            return False, {
                "type": "token_bucket",
                "rate": rate,
                "burst": burst,
                "current_tokens": bucket["tokens"],
                "reason": f"Token bucket empty: {bucket['tokens']:.2f} tokens available, need 1"
            }
        
        bucket["tokens"] -= 1
        
        return True, {
            "type": "token_bucket",
            "rate": rate,
            "burst": burst,
            "current_tokens": bucket["tokens"],
            "reason": "Token available"
        }
    
    def reset(self, route_key: Optional[str] = None):
        if route_key:
            if route_key in self.request_counters:
                del self.request_counters[route_key]
            if route_key in self.token_buckets:
                del self.token_buckets[route_key]
        else:
            self.request_counters.clear()
            self.token_buckets.clear()


class CircuitBreaker:
    def __init__(self, db: Session):
        self.db = db
    
    def get_or_create_record(
        self,
        route_key: str,
        policy_version_id: Optional[int] = None
    ) -> CircuitBreakerRecord:
        query = self.db.query(CircuitBreakerRecord).filter(
            CircuitBreakerRecord.route_key == route_key
        )
        
        if policy_version_id:
            query = query.filter(CircuitBreakerRecord.policy_version_id == policy_version_id)
        
        record = query.first()
        
        if not record:
            record = CircuitBreakerRecord(
                route_key=route_key,
                policy_version_id=policy_version_id,
                state=CircuitBreakerState.CLOSED,
                failure_count=0,
                success_count=0,
                total_count=0,
                failure_rate=0.0,
                half_open_attempts=0
            )
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)
        
        return record
    
    def check_circuit_breaker(
        self,
        route_key: str,
        policy: ProtectionPolicy,
        policy_version_id: Optional[int] = None
    ) -> Tuple[bool, Dict[str, Any]]:
        if not policy.circuit_breaker_enabled:
            return True, {
                "enabled": False,
                "state": CircuitBreakerState.CLOSED,
                "reason": "Circuit breaker is disabled"
            }
        
        record = self.get_or_create_record(route_key, policy_version_id)
        current_time = datetime.now()
        
        if record.state == CircuitBreakerState.OPEN:
            if record.open_at:
                open_duration = (current_time - record.open_at).total_seconds()
                if open_duration >= policy.cb_open_duration_seconds:
                    record.state = CircuitBreakerState.HALF_OPEN
                    record.previous_state = CircuitBreakerState.OPEN
                    record.half_open_attempts = 0
                    record.reason = f"Transitioning to HALF_OPEN after {policy.cb_open_duration_seconds}s cool down"
                    self.db.commit()
                    self.db.refresh(record)
                    
                    return True, {
                        "enabled": True,
                        "state": CircuitBreakerState.HALF_OPEN,
                        "previous_state": CircuitBreakerState.OPEN,
                        "reason": record.reason,
                        "half_open_attempts_remaining": policy.cb_half_open_max_requests
                    }
            
            return False, {
                "enabled": True,
                "state": CircuitBreakerState.OPEN,
                "open_at": record.open_at.isoformat() if record.open_at else None,
                "open_duration_remaining": policy.cb_open_duration_seconds - ((current_time - record.open_at).total_seconds() if record.open_at else 0),
                "failure_rate": record.failure_rate,
                "failure_threshold": policy.cb_failure_threshold,
                "reason": f"Circuit breaker is OPEN. Failure rate: {record.failure_rate:.2%} exceeds threshold: {policy.cb_failure_threshold:.0%}"
            }
        
        elif record.state == CircuitBreakerState.HALF_OPEN:
            if record.half_open_attempts >= policy.cb_half_open_max_requests:
                return False, {
                    "enabled": True,
                    "state": CircuitBreakerState.HALF_OPEN,
                    "half_open_attempts": record.half_open_attempts,
                    "max_attempts": policy.cb_half_open_max_requests,
                    "reason": f"Half-open attempts exhausted: {record.half_open_attempts}/{policy.cb_half_open_max_requests}"
                }
            
            return True, {
                "enabled": True,
                "state": CircuitBreakerState.HALF_OPEN,
                "half_open_attempts": record.half_open_attempts,
                "half_open_attempts_remaining": policy.cb_half_open_max_requests - record.half_open_attempts,
                "reason": "Allowing test request in HALF_OPEN state"
            }
        
        return True, {
            "enabled": True,
            "state": CircuitBreakerState.CLOSED,
            "failure_rate": record.failure_rate,
            "failure_threshold": policy.cb_failure_threshold,
            "min_requests": policy.cb_min_requests,
            "total_requests": record.total_count,
            "reason": "Circuit is CLOSED, allowing request"
        }
    
    def record_success(
        self,
        route_key: str,
        policy: ProtectionPolicy,
        policy_version_id: Optional[int] = None
    ) -> CircuitBreakerRecord:
        record = self.get_or_create_record(route_key, policy_version_id)
        current_time = datetime.now()
        
        previous_state = record.state
        
        record.success_count += 1
        record.total_count += 1
        
        if record.total_count >= policy.cb_min_requests:
            record.failure_rate = record.failure_count / record.total_count
        
        if record.state == CircuitBreakerState.HALF_OPEN:
            record.half_open_attempts += 1
            
            if record.half_open_attempts >= policy.cb_half_open_max_requests:
                record.state = CircuitBreakerState.CLOSED
                record.previous_state = CircuitBreakerState.HALF_OPEN
                record.failure_count = 0
                record.success_count = 0
                record.total_count = 0
                record.failure_rate = 0.0
                record.half_open_attempts = 0
                record.reason = f"Success in HALF_OPEN, transitioning to CLOSED. All {policy.cb_half_open_max_requests} test requests succeeded."
        
        elif record.state == CircuitBreakerState.CLOSED:
            if record.total_count > policy.cb_sliding_window_size:
                record.total_count = policy.cb_sliding_window_size
                record.success_count = int(policy.cb_sliding_window_size * (1 - record.failure_rate))
                record.failure_count = int(policy.cb_sliding_window_size * record.failure_rate)
        
        self.db.commit()
        self.db.refresh(record)
        return record
    
    def record_failure(
        self,
        route_key: str,
        policy: ProtectionPolicy,
        policy_version_id: Optional[int] = None
    ) -> CircuitBreakerRecord:
        record = self.get_or_create_record(route_key, policy_version_id)
        current_time = datetime.now()
        
        previous_state = record.state
        
        record.failure_count += 1
        record.total_count += 1
        
        if record.total_count >= policy.cb_min_requests:
            record.failure_rate = record.failure_count / record.total_count
        
        if record.state == CircuitBreakerState.HALF_OPEN:
            record.state = CircuitBreakerState.OPEN
            record.previous_state = CircuitBreakerState.HALF_OPEN
            record.open_at = current_time
            record.half_open_attempts = 0
            record.reason = f"Failure in HALF_OPEN, transitioning back to OPEN. Failure rate: {record.failure_rate:.2%}"
        
        elif record.state == CircuitBreakerState.CLOSED:
            if record.total_count >= policy.cb_min_requests and record.failure_rate >= policy.cb_failure_threshold:
                record.state = CircuitBreakerState.OPEN
                record.previous_state = CircuitBreakerState.CLOSED
                record.open_at = current_time
                record.reason = f"Failure rate {record.failure_rate:.2%} exceeds threshold {policy.cb_failure_threshold:.0%}, transitioning to OPEN"
        
        if record.total_count > policy.cb_sliding_window_size:
            record.total_count = policy.cb_sliding_window_size
            record.success_count = int(policy.cb_sliding_window_size * (1 - record.failure_rate))
            record.failure_count = int(policy.cb_sliding_window_size * record.failure_rate)
        
        self.db.commit()
        self.db.refresh(record)
        return record
    
    def force_open(
        self,
        route_key: str,
        policy_version_id: Optional[int] = None,
        reason: str = "Manually forced open"
    ) -> CircuitBreakerRecord:
        record = self.get_or_create_record(route_key, policy_version_id)
        record.previous_state = record.state
        record.state = CircuitBreakerState.OPEN
        record.open_at = datetime.now()
        record.reason = reason
        self.db.commit()
        self.db.refresh(record)
        return record
    
    def force_closed(
        self,
        route_key: str,
        policy_version_id: Optional[int] = None,
        reason: str = "Manually forced closed"
    ) -> CircuitBreakerRecord:
        record = self.get_or_create_record(route_key, policy_version_id)
        record.previous_state = record.state
        record.state = CircuitBreakerState.CLOSED
        record.failure_count = 0
        record.success_count = 0
        record.total_count = 0
        record.failure_rate = 0.0
        record.half_open_attempts = 0
        record.reason = reason
        self.db.commit()
        self.db.refresh(record)
        return record
    
    def get_state(self, route_key: str, policy_version_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        record = self.get_or_create_record(route_key, policy_version_id)
        return {
            "route_key": record.route_key,
            "state": record.state,
            "previous_state": record.previous_state,
            "failure_count": record.failure_count,
            "success_count": record.success_count,
            "total_count": record.total_count,
            "failure_rate": record.failure_rate,
            "open_at": record.open_at.isoformat() if record.open_at else None,
            "half_open_attempts": record.half_open_attempts,
            "reason": record.reason,
            "last_updated": record.created_at.isoformat() if record.created_at else None
        }


class ProtectionEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rate_limiter = RateLimiter()
        self.circuit_breaker = CircuitBreaker(db)
    
    def get_route_policy(
        self,
        path: str,
        method: str = "GET",
        policy_version_id: Optional[int] = None
    ) -> Tuple[Optional[RouteConfig], Optional[ProtectionPolicy]]:
        route = self.db.query(RouteConfig).filter(
            RouteConfig.path == path,
            RouteConfig.method == method
        ).first()
        
        if not route:
            route = self.db.query(RouteConfig).filter(
                RouteConfig.path == path
            ).first()
        
        if not route:
            return None, None
        
        policy_query = self.db.query(ProtectionPolicy).filter(
            ProtectionPolicy.route_key == route.route_key
        )
        
        if policy_version_id:
            policy_query = policy_query.filter(
                ProtectionPolicy.policy_version_id == policy_version_id
            )
        
        policy = policy_query.first()
        
        if not policy:
            policy = self.db.query(ProtectionPolicy).filter(
                ProtectionPolicy.route_key == "default"
            ).first()
        
        return route, policy
    
    def evaluate_request(
        self,
        path: str,
        method: str = "GET",
        request_id: Optional[str] = None,
        headers: Optional[Dict[str, Any]] = None,
        query_params: Optional[Dict[str, Any]] = None,
        body: Optional[str] = None,
        is_dry_run: bool = False,
        request_identifier: Optional[str] = None
    ) -> Dict[str, Any]:
        if not request_id:
            request_id = str(uuid.uuid4())
        
        policy_version = select_policy_version_for_request(self.db, request_identifier)
        policy_version_id = policy_version.id if policy_version else None
        policy_version_str = policy_version.version if policy_version else None
        
        route, policy = self.get_route_policy(path, method, policy_version_id)
        
        route_key = route.route_key if route else f"{method}:{path}"
        
        if not policy:
            policy = ProtectionPolicy(
                policy_key="default",
                route_key=route_key,
                rate_limit_enabled=False,
                circuit_breaker_enabled=False,
                degradation_enabled=False
            )
        
        decision = RequestDecision.ALLOW
        decision_reason = "Request allowed"
        threshold_value = None
        actual_value = None
        cb_state_before = None
        cb_state_after = None
        
        rate_limit_allowed, rate_limit_info = self.rate_limiter.check_rate_limit(
            route_key, policy
        )
        
        if not rate_limit_allowed:
            decision = RequestDecision.RATE_LIMITED
            decision_reason = rate_limit_info["reason"]
            threshold_value = rate_limit_info.get("threshold")
            actual_value = rate_limit_info.get("current_count")
        
        if decision == RequestDecision.ALLOW:
            cb_allowed, cb_info = self.circuit_breaker.check_circuit_breaker(
                route_key, policy, policy_version_id
            )
            
            cb_state_before = cb_info.get("state")
            
            if not cb_allowed:
                if cb_info.get("state") == CircuitBreakerState.OPEN:
                    decision = RequestDecision.CIRCUIT_BREAKER_OPEN
                elif cb_info.get("state") == CircuitBreakerState.HALF_OPEN:
                    decision = RequestDecision.CIRCUIT_BREAKER_HALF_OPEN
                
                decision_reason = cb_info["reason"]
                threshold_value = cb_info.get("failure_threshold")
                actual_value = cb_info.get("failure_rate")
        
        degradation_applied = False
        if decision != RequestDecision.ALLOW and policy.degradation_enabled:
            degradation_applied = True
            degradation_reason = f"Degradation fallback available due to: {decision_reason}"
            
            if policy.degradation_fallback_type == "default_response":
                decision_reason = f"{decision_reason}. {degradation_reason}. Will use default response fallback."
            elif policy.degradation_fallback_type == "cached_response":
                decision_reason = f"{decision_reason}. {degradation_reason}. Will use cached response fallback."
            elif policy.degradation_fallback_type == "static_data":
                decision_reason = f"{decision_reason}. {degradation_reason}. Will use static data fallback: {policy.degradation_fallback_value}"
        
        log_entry = RequestLog(
            request_id=request_id,
            route_key=route_key,
            path=path,
            method=method,
            policy_version_id=policy_version_id,
            policy_version=policy_version_str,
            decision=decision,
            decision_reason=decision_reason,
            threshold_value=threshold_value,
            actual_value=actual_value,
            is_dry_run=is_dry_run,
            headers=headers,
            query_params=query_params,
            body=body,
            circuit_breaker_state=cb_state_before
        )
        
        self.db.add(log_entry)
        self.db.commit()
        self.db.refresh(log_entry)
        
        return {
            "request_id": request_id,
            "route_key": route_key,
            "path": path,
            "method": method,
            "policy_version": policy_version_str,
            "policy_version_id": policy_version_id,
            "decision": decision,
            "decision_reason": decision_reason,
            "threshold_value": threshold_value,
            "actual_value": actual_value,
            "is_dry_run": is_dry_run,
            "circuit_breaker": {
                "state_before": cb_state_before,
                "state_after": cb_state_after
            },
            "rate_limit_info": rate_limit_info,
            "degradation": {
                "enabled": policy.degradation_enabled,
                "applied": degradation_applied,
                "fallback_type": policy.degradation_fallback_type,
                "fallback_value": policy.degradation_fallback_value
            } if policy.degradation_enabled else None,
            "log_id": log_entry.id,
            "timestamp": log_entry.created_at.isoformat() if log_entry.created_at else None
        }
    
    def record_request_result(
        self,
        request_id: str,
        is_success: bool,
        response_status: Optional[int] = None,
        response_time_ms: Optional[float] = None
    ) -> Dict[str, Any]:
        log_entry = self.db.query(RequestLog).filter(
            RequestLog.request_id == request_id
        ).first()
        
        if not log_entry:
            return {"error": f"Request log not found for request_id: {request_id}"}
        
        log_entry.response_status = response_status
        log_entry.response_time_ms = response_time_ms
        
        route, policy = self.get_route_policy(
            log_entry.path, log_entry.method, log_entry.policy_version_id
        )
        
        if policy and policy.circuit_breaker_enabled:
            route_key = log_entry.route_key
            
            if is_success:
                cb_record = self.circuit_breaker.record_success(
                    route_key, policy, log_entry.policy_version_id
                )
            else:
                cb_record = self.circuit_breaker.record_failure(
                    route_key, policy, log_entry.policy_version_id
                )
            
            log_entry.circuit_breaker_state = cb_record.state
        
        self.db.commit()
        self.db.refresh(log_entry)
        
        return {
            "request_id": request_id,
            "is_success": is_success,
            "response_status": response_status,
            "response_time_ms": response_time_ms,
            "circuit_breaker_state": log_entry.circuit_breaker_state
        }
    
    def get_request_log(self, request_id: str) -> Optional[Dict[str, Any]]:
        log_entry = self.db.query(RequestLog).filter(
            RequestLog.request_id == request_id
        ).first()
        
        if not log_entry:
            return None
        
        return {
            "request_id": log_entry.request_id,
            "route_key": log_entry.route_key,
            "path": log_entry.path,
            "method": log_entry.method,
            "policy_version": log_entry.policy_version,
            "decision": log_entry.decision,
            "decision_reason": log_entry.decision_reason,
            "threshold_value": log_entry.threshold_value,
            "actual_value": log_entry.actual_value,
            "is_dry_run": log_entry.is_dry_run,
            "circuit_breaker_state": log_entry.circuit_breaker_state,
            "response_status": log_entry.response_status,
            "response_time_ms": log_entry.response_time_ms,
            "created_at": log_entry.created_at.isoformat() if log_entry.created_at else None
        }
    
    def reset_rate_limiter(self, route_key: Optional[str] = None):
        self.rate_limiter.reset(route_key)
    
    def get_circuit_breaker_state(self, route_key: str) -> Optional[Dict[str, Any]]:
        return self.circuit_breaker.get_state(route_key)
    
    def force_circuit_breaker_open(
        self,
        route_key: str,
        reason: str = "Manually forced open"
    ) -> Dict[str, Any]:
        record = self.circuit_breaker.force_open(route_key, reason=reason)
        return self.circuit_breaker.get_state(route_key)
    
    def force_circuit_breaker_closed(
        self,
        route_key: str,
        reason: str = "Manually forced closed"
    ) -> Dict[str, Any]:
        record = self.circuit_breaker.force_closed(route_key, reason=reason)
        return self.circuit_breaker.get_state(route_key)
