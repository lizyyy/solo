#!/usr/bin/env python3
"""
Seed 数据初始化脚本
用于初始化示例配置和测试数据
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import engine, SessionLocal, init_db, Base
from models import (
    PolicyVersion, PolicyStatus, RouteConfig, ProtectionPolicy,
    DependencyHealth, RequestSample, CircuitBreakerRecord,
    CircuitBreakerState, RequestDecision
)
from config_importer import import_all_configs
from datetime import datetime


def create_sample_policy_version(db: Session):
    """创建示例策略版本"""
    version = PolicyVersion(
        version="v1.0.0",
        description="Initial seed version - 初始种子版本",
        status=PolicyStatus.DRAFT,
        canary_percentage=0
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


def create_sample_routes(db: Session, version_id: int):
    """创建示例路由配置"""
    routes = [
        RouteConfig(
            route_key="GET:/api/v1/users",
            path="/api/v1/users",
            method="GET",
            service_name="user-service",
            endpoint_name="list_users",
            policy_version_id=version_id
        ),
        RouteConfig(
            route_key="POST:/api/v1/users",
            path="/api/v1/users",
            method="POST",
            service_name="user-service",
            endpoint_name="create_user",
            policy_version_id=version_id
        ),
        RouteConfig(
            route_key="GET:/api/v1/orders",
            path="/api/v1/orders",
            method="GET",
            service_name="order-service",
            endpoint_name="list_orders",
            policy_version_id=version_id
        ),
        RouteConfig(
            route_key="POST:/api/v1/orders",
            path="/api/v1/orders",
            method="POST",
            service_name="order-service",
            endpoint_name="create_order",
            policy_version_id=version_id
        ),
        RouteConfig(
            route_key="GET:/api/v1/products",
            path="/api/v1/products",
            method="GET",
            service_name="product-service",
            endpoint_name="list_products",
            policy_version_id=version_id
        ),
        RouteConfig(
            route_key="POST:/api/v1/payments",
            path="/api/v1/payments",
            method="POST",
            service_name="payment-service",
            endpoint_name="create_payment",
            policy_version_id=version_id
        )
    ]
    
    for route in routes:
        existing = db.query(RouteConfig).filter(
            RouteConfig.route_key == route.route_key
        ).first()
        if not existing:
            db.add(route)
    
    db.commit()


def create_sample_policies(db: Session, version_id: int):
    """创建示例保护策略"""
    policies = [
        ProtectionPolicy(
            policy_key="policy-users-read",
            route_key="GET:/api/v1/users",
            policy_version_id=version_id,
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=100,
            rate_limit_window_seconds=60,
            rate_limit_burst=20,
            circuit_breaker_enabled=True,
            cb_failure_threshold=0.5,
            cb_min_requests=10,
            cb_half_open_max_requests=3,
            cb_open_duration_seconds=30,
            cb_sliding_window_size=100,
            degradation_enabled=True,
            degradation_fallback_type="cached_response",
            degradation_fallback_value={"users": [], "from_cache": True}
        ),
        ProtectionPolicy(
            policy_key="policy-users-write",
            route_key="POST:/api/v1/users",
            policy_version_id=version_id,
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=50,
            rate_limit_window_seconds=60,
            rate_limit_burst=10,
            circuit_breaker_enabled=True,
            cb_failure_threshold=0.3,
            cb_min_requests=5,
            cb_half_open_max_requests=2,
            cb_open_duration_seconds=60,
            cb_sliding_window_size=50,
            degradation_enabled=True,
            degradation_fallback_type="default_response",
            degradation_fallback_value={"success": False, "message": "Service temporarily unavailable"}
        ),
        ProtectionPolicy(
            policy_key="policy-orders-read",
            route_key="GET:/api/v1/orders",
            policy_version_id=version_id,
            rate_limit_enabled=True,
            rate_limit_type="sliding_window",
            rate_limit_threshold=80,
            rate_limit_window_seconds=60,
            rate_limit_burst=15,
            circuit_breaker_enabled=True,
            cb_failure_threshold=0.6,
            cb_min_requests=15,
            cb_half_open_max_requests=4,
            cb_open_duration_seconds=20,
            cb_sliding_window_size=100,
            degradation_enabled=True,
            degradation_fallback_type="cached_response",
            degradation_fallback_value={"orders": []}
        ),
        ProtectionPolicy(
            policy_key="policy-orders-write",
            route_key="POST:/api/v1/orders",
            policy_version_id=version_id,
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=30,
            rate_limit_window_seconds=60,
            rate_limit_burst=5,
            circuit_breaker_enabled=True,
            cb_failure_threshold=0.25,
            cb_min_requests=3,
            cb_half_open_max_requests=1,
            cb_open_duration_seconds=120,
            cb_sliding_window_size=30,
            degradation_enabled=False,
            degradation_fallback_type="default_response",
            degradation_fallback_value=None
        ),
        ProtectionPolicy(
            policy_key="policy-products",
            route_key="GET:/api/v1/products",
            policy_version_id=version_id,
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=500,
            rate_limit_window_seconds=60,
            rate_limit_burst=100,
            circuit_breaker_enabled=True,
            cb_failure_threshold=0.7,
            cb_min_requests=20,
            cb_half_open_max_requests=5,
            cb_open_duration_seconds=15,
            cb_sliding_window_size=200,
            degradation_enabled=True,
            degradation_fallback_type="static_data",
            degradation_fallback_value={
                "products": [
                    {"id": "p1", "name": "Default Product", "price": 0},
                    {"id": "p2", "name": "Sample Product", "price": 99}
                ]
            }
        ),
        ProtectionPolicy(
            policy_key="policy-payments",
            route_key="POST:/api/v1/payments",
            policy_version_id=version_id,
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=20,
            rate_limit_window_seconds=60,
            rate_limit_burst=3,
            circuit_breaker_enabled=True,
            cb_failure_threshold=0.2,
            cb_min_requests=2,
            cb_half_open_max_requests=1,
            cb_open_duration_seconds=300,
            cb_sliding_window_size=20,
            degradation_enabled=True,
            degradation_fallback_type="default_response",
            degradation_fallback_value={
                "status": "pending",
                "message": "Payment processing degraded"
            }
        ),
        ProtectionPolicy(
            policy_key="default",
            route_key="default",
            policy_version_id=version_id,
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=1000,
            rate_limit_window_seconds=60,
            rate_limit_burst=100,
            circuit_breaker_enabled=True,
            cb_failure_threshold=0.5,
            cb_min_requests=10,
            cb_half_open_max_requests=3,
            cb_open_duration_seconds=30,
            cb_sliding_window_size=100,
            degradation_enabled=True,
            degradation_fallback_type="default_response",
            degradation_fallback_value={"error": "Service unavailable", "code": 503}
        )
    ]
    
    for policy in policies:
        existing = db.query(ProtectionPolicy).filter(
            ProtectionPolicy.policy_key == policy.policy_key
        ).first()
        if not existing:
            db.add(policy)
    
    db.commit()


def create_sample_dependencies(db: Session):
    """创建示例依赖健康数据"""
    dependencies = [
        DependencyHealth(
            dependency_key="user-service:list",
            service_name="user-service",
            endpoint="/api/v1/users",
            is_healthy=True,
            error_rate=0.01,
            latency_p99_ms=150,
            success_count=9900,
            failure_count=100,
            total_requests=10000
        ),
        DependencyHealth(
            dependency_key="user-service:create",
            service_name="user-service",
            endpoint="/api/v1/users",
            is_healthy=True,
            error_rate=0.02,
            latency_p99_ms=200,
            success_count=4900,
            failure_count=100,
            total_requests=5000
        ),
        DependencyHealth(
            dependency_key="order-service:list",
            service_name="order-service",
            endpoint="/api/v1/orders",
            is_healthy=True,
            error_rate=0.03,
            latency_p99_ms=300,
            success_count=7760,
            failure_count=240,
            total_requests=8000
        ),
        DependencyHealth(
            dependency_key="order-service:create",
            service_name="order-service",
            endpoint="/api/v1/orders",
            is_healthy=False,
            error_rate=0.45,
            latency_p99_ms=1500,
            success_count=1650,
            failure_count=1350,
            total_requests=3000
        ),
        DependencyHealth(
            dependency_key="product-service:list",
            service_name="product-service",
            endpoint="/api/v1/products",
            is_healthy=True,
            error_rate=0.001,
            latency_p99_ms=50,
            success_count=49950,
            failure_count=50,
            total_requests=50000
        ),
        DependencyHealth(
            dependency_key="payment-service:create",
            service_name="payment-service",
            endpoint="/api/v1/payments",
            is_healthy=False,
            error_rate=0.6,
            latency_p99_ms=2000,
            success_count=800,
            failure_count=1200,
            total_requests=2000
        )
    ]
    
    for dep in dependencies:
        existing = db.query(DependencyHealth).filter(
            DependencyHealth.dependency_key == dep.dependency_key
        ).first()
        if not existing:
            db.add(dep)
    
    db.commit()


def create_sample_request_logs(db: Session):
    """创建示例请求日志"""
    from models import RequestLog
    import uuid
    
    logs = [
        RequestLog(
            request_id=str(uuid.uuid4()),
            route_key="GET:/api/v1/users",
            path="/api/v1/users",
            method="GET",
            policy_version="v1.0.0",
            decision=RequestDecision.ALLOW,
            decision_reason="Request allowed - within rate limit",
            is_dry_run=False,
            response_status=200,
            response_time_ms=150.5
        ),
        RequestLog(
            request_id=str(uuid.uuid4()),
            route_key="GET:/api/v1/users",
            path="/api/v1/users",
            method="GET",
            policy_version="v1.0.0",
            decision=RequestDecision.ALLOW,
            decision_reason="Request allowed",
            is_dry_run=False,
            response_status=200,
            response_time_ms=120.3
        ),
        RequestLog(
            request_id=str(uuid.uuid4()),
            route_key="POST:/api/v1/orders",
            path="/api/v1/orders",
            method="POST",
            policy_version="v1.0.0",
            decision=RequestDecision.RATE_LIMITED,
            decision_reason="Rate limit exceeded: 31/30 requests",
            threshold_value=30,
            actual_value=31,
            is_dry_run=False
        ),
        RequestLog(
            request_id=str(uuid.uuid4()),
            route_key="POST:/api/v1/payments",
            path="/api/v1/payments",
            method="POST",
            policy_version="v1.0.0",
            decision=RequestDecision.CIRCUIT_BREAKER_OPEN,
            decision_reason="Circuit breaker OPEN - failure rate 60% exceeds threshold 20%",
            threshold_value=0.2,
            actual_value=0.6,
            is_dry_run=False,
            circuit_breaker_state=CircuitBreakerState.OPEN
        ),
        RequestLog(
            request_id=str(uuid.uuid4()),
            route_key="GET:/api/v1/products",
            path="/api/v1/products",
            method="GET",
            policy_version="v1.0.0",
            decision=RequestDecision.DEGRADED,
            decision_reason="Degraded fallback triggered due to rate limiting",
            is_dry_run=True
        )
    ]
    
    for log in logs:
        db.add(log)
    
    db.commit()


def create_sample_request_samples(db: Session):
    """创建示例请求样本（包含坏样例）"""
    samples = [
        RequestSample(
            sample_key="sample-users-list-normal",
            route_key="GET:/api/v1/users",
            path="/api/v1/users",
            method="GET",
            headers={"X-User-Id": "user123"},
            query_params={"page": "1", "limit": "20"},
            expected_decision=RequestDecision.ALLOW,
            expected_reason="Normal request",
            is_bad_sample=False
        ),
        RequestSample(
            sample_key="sample-users-create-normal",
            route_key="POST:/api/v1/users",
            path="/api/v1/users",
            method="POST",
            headers={"Content-Type": "application/json"},
            body='{"name": "John", "email": "john@example.com"}',
            expected_decision=RequestDecision.ALLOW,
            expected_reason="Normal write request",
            is_bad_sample=False
        ),
        RequestSample(
            sample_key="sample-rate-limit-test",
            route_key="GET:/api/v1/users",
            path="/api/v1/users",
            method="GET",
            headers={"X-User-Id": "spam-user"},
            expected_decision=RequestDecision.RATE_LIMITED,
            expected_reason="Rate limit should be triggered",
            is_bad_sample=True,
            bad_sample_hint="提示：要触发限流，需要在1分钟内发送超过100个相同请求。建议批量发送请求来验证限流逻辑。"
        ),
        RequestSample(
            sample_key="sample-circuit-breaker-test",
            route_key="POST:/api/v1/orders",
            path="/api/v1/orders",
            method="POST",
            expected_decision=RequestDecision.CIRCUIT_BREAKER_OPEN,
            expected_reason="Circuit breaker should open after failures",
            is_bad_sample=True,
            bad_sample_hint="提示：要触发熔断，需要：1) 先发送超过 min_requests (3) 个失败请求，2) 失败率超过 threshold (25%)。"
        ),
        RequestSample(
            sample_key="sample-degradation-test",
            route_key="POST:/api/v1/payments",
            path="/api/v1/payments",
            method="POST",
            expected_decision=RequestDecision.DEGRADED,
            expected_reason="Degradation should trigger after rate limit or circuit open",
            is_bad_sample=True,
            bad_sample_hint="提示：降级会在限流或熔断触发后才会生效。需要先触发限流或熔断条件。"
        )
    ]
    
    for sample in samples:
        existing = db.query(RequestSample).filter(
            RequestSample.sample_key == sample.sample_key
        ).first()
        if not existing:
            db.add(sample)
    
    db.commit()


def main():
    """主函数"""
    print("=" * 60)
    print("初始化接口保护策略验证服务 - Seed 数据初始化")
    print("=" * 60)
    print()
    
    print("[1/6] 初始化数据库...")
    init_db()
    print("      数据库初始化完成")
    print()
    
    db = SessionLocal()
    
    try:
        print("[2/6] 创建策略版本...")
        version = create_sample_policy_version(db)
        print(f"      创建版本: {version.version} (ID: {version.id})")
        print()
        
        print("[3/6] 创建路由配置...")
        create_sample_routes(db, version.id)
        routes_count = db.query(RouteConfig).count()
        print(f"      创建路由数量: {routes_count}")
        print()
        
        print("[4/6] 创建保护策略...")
        create_sample_policies(db, version.id)
        policies_count = db.query(ProtectionPolicy).count()
        print(f"      创建策略数量: {policies_count}")
        print()
        
        print("[5/6] 创建依赖健康数据...")
        create_sample_dependencies(db)
        deps_count = db.query(DependencyHealth).count()
        print(f"      创建依赖数量: {deps_count}")
        print()
        
        print("[6/6] 创建示例请求样本...")
        create_sample_request_samples(db)
        samples_count = db.query(RequestSample).count()
        print(f"      创建样本数量: {samples_count}")
        print()
        
        print("=" * 60)
        print("Seed 数据初始化完成!")
        print("=" * 60)
        print()
        print("数据库文件: protection.db")
        print()
        print("启动服务命令:")
        print("  python main.py")
        print()
        print("访问 API 文档:")
        print("  http://127.0.0.1:8000/docs")
        print()
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
