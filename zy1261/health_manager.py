from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from models import DependencyHealth, CircuitBreakerRecord, CircuitBreakerState
from protection_engine import CircuitBreaker


class HealthManager:
    def __init__(self, db: Session):
        self.db = db
        self.circuit_breaker = CircuitBreaker(db)
    
    def report_health(
        self,
        dependency_key: str,
        is_healthy: bool,
        error_rate: float = 0.0,
        latency_p99_ms: float = 0.0,
        success_count: int = 0,
        failure_count: int = 0,
        total_requests: Optional[int] = None,
        service_name: Optional[str] = None,
        endpoint: Optional[str] = None
    ) -> DependencyHealth:
        existing = self.db.query(DependencyHealth).filter(
            DependencyHealth.dependency_key == dependency_key
        ).first()
        
        if total_requests is None:
            total_requests = success_count + failure_count
        
        if existing:
            existing.is_healthy = is_healthy
            existing.error_rate = error_rate
            existing.latency_p99_ms = latency_p99_ms
            existing.success_count = success_count
            existing.failure_count = failure_count
            existing.total_requests = total_requests
            if service_name:
                existing.service_name = service_name
            if endpoint:
                existing.endpoint = endpoint
            existing.reported_at = datetime.now()
            health = existing
        else:
            health = DependencyHealth(
                dependency_key=dependency_key,
                service_name=service_name,
                endpoint=endpoint,
                is_healthy=is_healthy,
                error_rate=error_rate,
                latency_p99_ms=latency_p99_ms,
                success_count=success_count,
                failure_count=failure_count,
                total_requests=total_requests,
                reported_at=datetime.now()
            )
            self.db.add(health)
        
        self.db.commit()
        self.db.refresh(health)
        return health
    
    def get_dependency_health(
        self,
        dependency_key: str
    ) -> Optional[Dict[str, Any]]:
        health = self.db.query(DependencyHealth).filter(
            DependencyHealth.dependency_key == dependency_key
        ).first()
        
        if not health:
            return None
        
        return {
            "dependency_key": health.dependency_key,
            "service_name": health.service_name,
            "endpoint": health.endpoint,
            "is_healthy": health.is_healthy,
            "error_rate": health.error_rate,
            "latency_p99_ms": health.latency_p99_ms,
            "success_count": health.success_count,
            "failure_count": health.failure_count,
            "total_requests": health.total_requests,
            "last_check_at": health.last_check_at.isoformat() if health.last_check_at else None,
            "reported_at": health.reported_at.isoformat() if health.reported_at else None
        }
    
    def list_dependencies_health(
        self,
        healthy_only: bool = False,
        unhealthy_only: bool = False
    ) -> List[Dict[str, Any]]:
        query = self.db.query(DependencyHealth)
        
        if healthy_only:
            query = query.filter(DependencyHealth.is_healthy == True)
        elif unhealthy_only:
            query = query.filter(DependencyHealth.is_healthy == False)
        
        health_records = query.all()
        
        return [
            {
                "dependency_key": h.dependency_key,
                "service_name": h.service_name,
                "endpoint": h.endpoint,
                "is_healthy": h.is_healthy,
                "error_rate": h.error_rate,
                "latency_p99_ms": h.latency_p99_ms,
                "success_count": h.success_count,
                "failure_count": h.failure_count,
                "total_requests": h.total_requests,
                "reported_at": h.reported_at.isoformat() if h.reported_at else None
            }
            for h in health_records
        ]
    
    def get_circuit_breaker_status(
        self,
        route_key: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if route_key:
            record = self.circuit_breaker.get_or_create_record(route_key)
            return [self.circuit_breaker.get_state(route_key)]
        
        records = self.db.query(CircuitBreakerRecord).all()
        
        return [
            {
                "route_key": r.route_key,
                "state": r.state,
                "previous_state": r.previous_state,
                "failure_count": r.failure_count,
                "success_count": r.success_count,
                "total_count": r.total_count,
                "failure_rate": r.failure_rate,
                "open_at": r.open_at.isoformat() if r.open_at else None,
                "half_open_attempts": r.half_open_attempts,
                "reason": r.reason,
                "last_updated": r.created_at.isoformat() if r.created_at else None
            }
            for r in records
        ]
    
    def get_open_circuits(self) -> List[Dict[str, Any]]:
        records = self.db.query(CircuitBreakerRecord).filter(
            CircuitBreakerRecord.state.in_([
                CircuitBreakerState.OPEN,
                CircuitBreakerState.HALF_OPEN
            ])
        ).all()
        
        return [
            {
                "route_key": r.route_key,
                "state": r.state,
                "failure_rate": r.failure_rate,
                "open_at": r.open_at.isoformat() if r.open_at else None,
                "reason": r.reason
            }
            for r in records
        ]
    
    def force_circuit_open(
        self,
        route_key: str,
        reason: str = "Manually forced open by health manager"
    ) -> Dict[str, Any]:
        return self.circuit_breaker.force_open(route_key, reason=reason)
    
    def force_circuit_closed(
        self,
        route_key: str,
        reason: str = "Manually forced closed by health manager"
    ) -> Dict[str, Any]:
        return self.circuit_breaker.force_closed(route_key, reason=reason)
    
    def get_health_summary(self) -> Dict[str, Any]:
        total_deps = self.db.query(DependencyHealth).count()
        healthy_deps = self.db.query(DependencyHealth).filter(
            DependencyHealth.is_healthy == True
        ).count()
        unhealthy_deps = total_deps - healthy_deps
        
        total_cbs = self.db.query(CircuitBreakerRecord).count()
        closed_cbs = self.db.query(CircuitBreakerRecord).filter(
            CircuitBreakerRecord.state == CircuitBreakerState.CLOSED
        ).count()
        open_cbs = self.db.query(CircuitBreakerRecord).filter(
            CircuitBreakerRecord.state == CircuitBreakerState.OPEN
        ).count()
        half_open_cbs = self.db.query(CircuitBreakerRecord).filter(
            CircuitBreakerRecord.state == CircuitBreakerState.HALF_OPEN
        ).count()
        
        return {
            "dependencies": {
                "total": total_deps,
                "healthy": healthy_deps,
                "unhealthy": unhealthy_deps,
                "health_percentage": (healthy_deps / total_deps * 100) if total_deps > 0 else 100
            },
            "circuit_breakers": {
                "total": total_cbs,
                "closed": closed_cbs,
                "open": open_cbs,
                "half_open": half_open_cbs,
                "healthy_percentage": (closed_cbs / total_cbs * 100) if total_cbs > 0 else 100
            },
            "timestamp": datetime.now().isoformat()
        }
