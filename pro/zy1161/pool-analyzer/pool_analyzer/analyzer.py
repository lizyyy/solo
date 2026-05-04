import random
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from .models import (
    PoolConfig, Service, TrafficProfile, DatabaseLimits,
    ConnectionBudget, RiskAssessment, RiskLevel,
    SimulationResult, AnalysisReport
)


class PoolAnalyzer:
    def __init__(
        self,
        services: List[Service],
        pool_configs: Dict[str, PoolConfig],
        traffic_profiles: Dict[str, TrafficProfile],
        db_limits: DatabaseLimits
    ):
        self.services = services
        self.pool_configs = pool_configs
        self.traffic_profiles = traffic_profiles
        self.db_limits = db_limits
        self.available_connections = (
            db_limits.max_connections - 
            db_limits.reserved_connections - 
            db_limits.superuser_reserved_connections
        )

    def calculate_connection_budgets(self) -> List[ConnectionBudget]:
        budgets = []
        
        for service in self.services:
            pool_config = self.pool_configs.get(service.pool_config_name)
            if not pool_config:
                continue
            
            traffic = self.traffic_profiles.get(service.name)
            
            max_possible = pool_config.max_pool_size * service.instances
            min_possible = pool_config.min_pool_size * service.instances
            
            if traffic:
                peak_concurrent_calls = (
                    traffic.peak_qps * 
                    traffic.peak_db_calls_per_request * 
                    (traffic.peak_connection_hold_time_ms / 1000.0)
                )
                expected_peak = min(peak_concurrent_calls, max_possible)
            else:
                expected_peak = max_possible * 0.7
            
            utilization_ratio = expected_peak / self.available_connections
            
            budget = ConnectionBudget(
                service_name=service.name,
                pool_config=pool_config,
                instances=service.instances,
                max_possible_connections=max_possible,
                min_possible_connections=min_possible,
                expected_peak_connections=expected_peak,
                utilization_ratio=utilization_ratio
            )
            budgets.append(budget)
        
        return budgets

    def assess_risks(self, budgets: List[ConnectionBudget]) -> List[RiskAssessment]:
        risks = []
        
        total_max_possible = sum(b.max_possible_connections for b in budgets)
        total_expected_peak = sum(b.expected_peak_connections for b in budgets)
        
        if total_max_possible > self.available_connections:
            risks.append(RiskAssessment(
                risk_type="total_max_exceeds_capacity",
                risk_level=RiskLevel.CRITICAL,
                description="理论最大连接数超过数据库可用容量",
                details={
                    "total_max_possible": total_max_possible,
                    "available_connections": self.available_connections,
                    "exceed_by": total_max_possible - self.available_connections
                },
                suggested_mitigation="减少各服务的max_pool_size或减少服务实例数"
            ))
        
        if total_expected_peak > self.available_connections:
            excess_ratio = total_expected_peak / self.available_connections
            if excess_ratio > 1.5:
                risk_level = RiskLevel.CRITICAL
            elif excess_ratio > 1.2:
                risk_level = RiskLevel.HIGH
            else:
                risk_level = RiskLevel.MEDIUM
            
            risks.append(RiskAssessment(
                risk_type="expected_peak_exceeds_capacity",
                risk_level=risk_level,
                description="预期峰值连接数超过数据库可用容量",
                details={
                    "total_expected_peak": round(total_expected_peak, 2),
                    "available_connections": self.available_connections,
                    "excess_ratio": round(excess_ratio, 2)
                },
                suggested_mitigation="优化连接池配置或扩容数据库"
            ))
        
        for budget in budgets:
            service = next((s for s in self.services if s.name == budget.service_name), None)
            if not service:
                continue
            
            pool_config = budget.pool_config
            
            if pool_config.connection_timeout < 5.0:
                risks.append(RiskAssessment(
                    risk_type="timeout_too_short",
                    risk_level=RiskLevel.HIGH,
                    service_name=service.name,
                    description="连接超时时间过短",
                    details={
                        "connection_timeout": pool_config.connection_timeout,
                        "recommended_min": 5.0
                    },
                    suggested_mitigation="将connection_timeout增加到至少5秒"
                ))
            
            if pool_config.retry_attempts > 5:
                risks.append(RiskAssessment(
                    risk_type="retry_storm_risk",
                    risk_level=RiskLevel.HIGH,
                    service_name=service.name,
                    description="重试次数过多可能导致重试风暴",
                    details={
                        "retry_attempts": pool_config.retry_attempts,
                        "instances": service.instances,
                        "max_pool_size": pool_config.max_pool_size
                    },
                    suggested_mitigation="减少重试次数或添加退避策略"
                ))
            
            if budget.max_possible_connections > self.available_connections * 0.5:
                risks.append(RiskAssessment(
                    risk_type="single_service_dominance",
                    risk_level=RiskLevel.MEDIUM,
                    service_name=service.name,
                    description="单个服务可能占用超过一半的连接容量",
                    details={
                        "service": service.name,
                        "max_possible": budget.max_possible_connections,
                        "available": self.available_connections,
                        "percentage": round(budget.max_possible_connections / self.available_connections * 100, 1)
                    },
                    suggested_mitigation="考虑限制该服务的连接池大小或分离数据库"
                ))
        
        tenant_connections: Dict[str, int] = {}
        for service in self.services:
            if service.tenant_id:
                budget = next((b for b in budgets if b.service_name == service.name), None)
                if budget:
                    tenant_connections[service.tenant_id] = (
                        tenant_connections.get(service.tenant_id, 0) + 
                        budget.max_possible_connections
                    )
        
        if self.db_limits.max_connections_per_tenant:
            for tenant_id, conn_count in tenant_connections.items():
                if conn_count > self.db_limits.max_connections_per_tenant:
                    risks.append(RiskAssessment(
                        risk_type="tenant_quota_exceeded",
                        risk_level=RiskLevel.CRITICAL,
                        tenant_id=tenant_id,
                        description="租户连接配额超限",
                        details={
                            "tenant_id": tenant_id,
                            "max_connections": conn_count,
                            "quota": self.db_limits.max_connections_per_tenant
                        },
                        suggested_mitigation="减少该租户服务的连接池配置或增加租户配额"
                    ))
        
        return risks

    def simulate(
        self,
        duration_minutes: int = 60,
        step_seconds: int = 5,
        seed: Optional[int] = None
    ) -> List[SimulationResult]:
        if seed is not None:
            random.seed(seed)
        
        results = []
        start_time = datetime.now()
        
        total_steps = (duration_minutes * 60) // step_seconds
        
        for step in range(total_steps):
            timestamp = (start_time + timedelta(seconds=step * step_seconds)).isoformat()
            
            hour_factor = 1.0 + 0.5 * math.sin(step / total_steps * math.pi)
            random_factor = random.uniform(0.7, 1.3)
            
            connections_by_service: Dict[str, int] = {}
            connections_by_tenant: Dict[str, int] = {}
            total_connections = 0
            wait_queue_size = 0
            timeout_events = 0
            retry_events = 0
            
            for service in self.services:
                pool_config = self.pool_configs.get(service.pool_config_name)
                traffic = self.traffic_profiles.get(service.name)
                
                if not pool_config:
                    continue
                
                max_per_instance = pool_config.max_pool_size
                min_per_instance = pool_config.min_pool_size
                
                if traffic:
                    base_connections = (
                        traffic.peak_qps * 0.3 *
                        traffic.avg_db_calls_per_request *
                        (traffic.avg_connection_hold_time_ms / 1000.0)
                    )
                    scaled_connections = base_connections * hour_factor * random_factor
                    
                    service_connections = min(
                        int(scaled_connections) + min_per_instance * service.instances,
                        max_per_instance * service.instances
                    )
                else:
                    service_connections = random.randint(
                        min_per_instance * service.instances,
                        max_per_instance * service.instances
                    )
                
                if total_connections + service_connections > self.available_connections:
                    overflow = total_connections + service_connections - self.available_connections
                    wait_queue_size += overflow
                    service_connections = self.available_connections - total_connections
                    
                    if service_connections < 0:
                        service_connections = 0
                    
                    if random.random() < 0.3:
                        timeout_events += 1
                    
                    if pool_config.retry_attempts > 0 and random.random() < 0.5:
                        retry_events += 1
                
                connections_by_service[service.name] = service_connections
                total_connections += service_connections
                
                if service.tenant_id:
                    connections_by_tenant[service.tenant_id] = (
                        connections_by_tenant.get(service.tenant_id, 0) + service_connections
                    )
            
            result = SimulationResult(
                timestamp=timestamp,
                total_connections=total_connections,
                connections_by_service=connections_by_service,
                connections_by_tenant=connections_by_tenant,
                wait_queue_size=wait_queue_size,
                timeout_events=timeout_events,
                retry_events=retry_events,
                available_connections=self.available_connections - total_connections
            )
            results.append(result)
        
        return results

    def generate_report(
        self,
        budgets: List[ConnectionBudget],
        risks: List[RiskAssessment],
        simulation_results: List[SimulationResult]
    ) -> AnalysisReport:
        total_max_possible = sum(b.max_possible_connections for b in budgets)
        total_min_possible = sum(b.min_possible_connections for b in budgets)
        total_expected_peak = sum(b.expected_peak_connections for b in budgets)
        
        remaining_headroom = max(0, self.available_connections - int(total_expected_peak))
        utilization_percentage = (total_expected_peak / self.available_connections) * 100 if self.available_connections > 0 else 100
        
        critical_risks = [r for r in risks if r.risk_level == RiskLevel.CRITICAL]
        high_risks = [r for r in risks if r.risk_level == RiskLevel.HIGH]
        medium_risks = [r for r in risks if r.risk_level == RiskLevel.MEDIUM]
        
        if simulation_results:
            max_sim_connections = max(r.total_connections for r in simulation_results)
            total_timeouts = sum(r.timeout_events for r in simulation_results)
            total_retries = sum(r.retry_events for r in simulation_results)
            
            simulation_summary = (
                f"模拟时长: {len(simulation_results) * 5 // 60}分钟, "
                f"峰值连接: {max_sim_connections}, "
                f"超时事件: {total_timeouts}, "
                f"重试事件: {total_retries}"
            )
        else:
            simulation_summary = "未执行模拟"
        
        summary = (
            f"数据库可用连接: {self.available_connections}, "
            f"理论最大: {total_max_possible}, "
            f"预期峰值: {round(total_expected_peak, 1)}, "
            f"利用率: {round(utilization_percentage, 1)}%, "
            f"风险: 严重={len(critical_risks)}, 高={len(high_risks)}, 中={len(medium_risks)}. "
            f"{simulation_summary}"
        )
        
        return AnalysisReport(
            report_id=f"pool-report-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            generated_at=datetime.now().isoformat(),
            database_limits=self.db_limits,
            services=self.services,
            pool_configs=self.pool_configs,
            traffic_profiles=self.traffic_profiles,
            connection_budgets=budgets,
            total_max_possible=total_max_possible,
            total_min_possible=total_min_possible,
            total_expected_peak=total_expected_peak,
            remaining_headroom=remaining_headroom,
            utilization_percentage=utilization_percentage,
            risks=risks,
            simulation_results=simulation_results,
            summary=summary
        )
