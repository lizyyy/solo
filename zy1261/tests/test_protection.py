import pytest
import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import tempfile
import time

from database import Base
from models import (
    PolicyVersion, PolicyStatus, RouteConfig, ProtectionPolicy,
    RequestDecision, CircuitBreakerState, CircuitBreakerRecord,
    RequestLog, DependencyHealth, RequestSample
)
from protection_engine import ProtectionEngine, RateLimiter, CircuitBreaker
from policy_version_manager import (
    create_policy_version, get_policy_version, get_active_policy_version,
    activate_policy_version, start_canary_release, update_canary_percentage,
    rollback_policy_version
)
from health_manager import HealthManager
from report_exporter import ReportExporter


@pytest.fixture
def db_session():
    """创建内存数据库会话"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    yield session
    
    session.close()


@pytest.fixture
def sample_routes(db_session):
    """创建示例路由"""
    routes = [
        RouteConfig(
            route_key="GET:/api/v1/users",
            path="/api/v1/users",
            method="GET",
            service_name="user-service",
            endpoint_name="list_users"
        ),
        RouteConfig(
            route_key="POST:/api/v1/orders",
            path="/api/v1/orders",
            method="POST",
            service_name="order-service",
            endpoint_name="create_order"
        )
    ]
    for route in routes:
        db_session.add(route)
    db_session.commit()
    return routes


@pytest.fixture
def sample_policies(db_session):
    """创建示例保护策略"""
    policies = [
        ProtectionPolicy(
            policy_key="policy-users-read",
            route_key="GET:/api/v1/users",
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=10,
            rate_limit_window_seconds=60,
            rate_limit_burst=3,
            circuit_breaker_enabled=True,
            cb_failure_threshold=0.5,
            cb_min_requests=5,
            cb_half_open_max_requests=2,
            cb_open_duration_seconds=10,
            cb_sliding_window_size=50,
            degradation_enabled=True,
            degradation_fallback_type="cached_response",
            degradation_fallback_value={"users": []}
        ),
        ProtectionPolicy(
            policy_key="policy-orders-write",
            route_key="POST:/api/v1/orders",
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=5,
            rate_limit_window_seconds=60,
            rate_limit_burst=2,
            circuit_breaker_enabled=True,
            cb_failure_threshold=0.3,
            cb_min_requests=3,
            cb_half_open_max_requests=1,
            cb_open_duration_seconds=30,
            cb_sliding_window_size=20,
            degradation_enabled=False,
            degradation_fallback_type="default_response",
            degradation_fallback_value=None
        ),
        ProtectionPolicy(
            policy_key="default",
            route_key="default",
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
            degradation_fallback_type="default_response",
            degradation_fallback_value={"error": "Service unavailable"}
        )
    ]
    for policy in policies:
        db_session.add(policy)
    db_session.commit()
    return policies


class TestRateLimiter:
    """限流器测试"""
    
    def test_fixed_window_allow(self):
        """测试固定窗口限流 - 允许请求"""
        limiter = RateLimiter()
        
        policy = ProtectionPolicy(
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=5,
            rate_limit_window_seconds=60
        )
        
        for i in range(5):
            allowed, info = limiter.check_rate_limit("test-route", policy)
            assert allowed is True
            assert info["current_count"] == i + 1
    
    def test_fixed_window_reject(self):
        """测试固定窗口限流 - 拒绝请求"""
        limiter = RateLimiter()
        
        policy = ProtectionPolicy(
            rate_limit_enabled=True,
            rate_limit_type="fixed_window",
            rate_limit_threshold=3,
            rate_limit_window_seconds=60
        )
        
        for i in range(3):
            allowed, _ = limiter.check_rate_limit("test-route", policy)
            assert allowed is True
        
        allowed, info = limiter.check_rate_limit("test-route", policy)
        assert allowed is False
        assert info["reason"].startswith("Rate limit exceeded")
    
    def test_rate_limit_disabled(self):
        """测试限流禁用"""
        limiter = RateLimiter()
        
        policy = ProtectionPolicy(
            rate_limit_enabled=False,
            rate_limit_threshold=1
        )
        
        for i in range(10):
            allowed, info = limiter.check_rate_limit("test-route", policy)
            assert allowed is True
            assert info["enabled"] is False
    
    def test_token_bucket(self):
        """测试令牌桶限流"""
        limiter = RateLimiter()
        
        policy = ProtectionPolicy(
            rate_limit_enabled=True,
            rate_limit_type="token_bucket",
            rate_limit_threshold=10,
            rate_limit_window_seconds=60,
            rate_limit_burst=5
        )
        
        for i in range(5):
            allowed, info = limiter.check_rate_limit("test-route", policy)
            assert allowed is True
        
        allowed, info = limiter.check_rate_limit("test-route", policy)
        assert allowed is False
        assert "token" in info["reason"].lower()


class TestCircuitBreaker:
    """熔断器测试"""
    
    def test_initial_state_closed(self, db_session):
        """测试初始状态为 Closed"""
        cb = CircuitBreaker(db_session)
        
        record = cb.get_or_create_record("test-route")
        
        assert record.state == CircuitBreakerState.CLOSED
    
    def test_check_closed_allows_requests(self, db_session, sample_policies):
        """测试 Closed 状态允许请求"""
        cb = CircuitBreaker(db_session)
        
        policy = sample_policies[0]
        
        allowed, info = cb.check_circuit_breaker("test-route", policy)
        
        assert allowed is True
        assert info["state"] == CircuitBreakerState.CLOSED
    
    def test_record_success(self, db_session, sample_policies):
        """测试记录成功请求"""
        cb = CircuitBreaker(db_session)
        
        policy = sample_policies[0]
        
        cb.get_or_create_record("test-route")
        
        record = cb.record_success("test-route", policy)
        
        assert record.success_count == 1
        assert record.total_count == 1
        assert record.state == CircuitBreakerState.CLOSED
    
    def test_record_failure_not_enough_for_open(self, db_session, sample_policies):
        """测试失败次数不足时不打开熔断"""
        cb = CircuitBreaker(db_session)
        
        policy = sample_policies[0]
        
        cb.get_or_create_record("test-route")
        
        for i in range(3):
            record = cb.record_failure("test-route", policy)
        
        assert record.failure_count == 3
        assert record.total_count == 3
        assert record.state == CircuitBreakerState.CLOSED
    
    def test_circuit_opens_after_threshold(self, db_session, sample_policies):
        """测试超过阈值后熔断打开"""
        cb = CircuitBreaker(db_session)
        
        policy = sample_policies[0]
        
        cb.get_or_create_record("test-route")
        
        for i in range(3):
            cb.record_success("test-route", policy)
        
        for i in range(3):
            record = cb.record_failure("test-route", policy)
        
        assert record.total_count == 6
        assert record.failure_rate == 3 / 6
        assert record.failure_rate >= policy.cb_failure_threshold
        assert record.state == CircuitBreakerState.OPEN
    
    def test_open_circuit_rejects_requests(self, db_session, sample_policies):
        """测试打开状态拒绝请求"""
        cb = CircuitBreaker(db_session)
        
        policy = sample_policies[0]
        
        cb.force_open("test-route", reason="Test open")
        
        allowed, info = cb.check_circuit_breaker("test-route", policy)
        
        assert allowed is False
        assert info["state"] == CircuitBreakerState.OPEN
    
    def test_force_closed(self, db_session, sample_policies):
        """测试手动关闭熔断"""
        cb = CircuitBreaker(db_session)
        
        cb.force_open("test-route", reason="Test open")
        
        record = cb.force_closed("test-route", reason="Manual reset")
        
        assert record.state == CircuitBreakerState.CLOSED
        assert record.failure_count == 0
        assert record.success_count == 0


class TestProtectionEngine:
    """保护引擎测试"""
    
    def test_evaluate_allow_request(self, db_session, sample_routes, sample_policies):
        """测试正常请求被放行"""
        engine = ProtectionEngine(db_session)
        
        result = engine.evaluate_request(
            path="/api/v1/users",
            method="GET"
        )
        
        assert result["decision"] == RequestDecision.ALLOW
        assert "request_id" in result
        assert result["path"] == "/api/v1/users"
    
    def test_evaluate_rate_limited(self, db_session, sample_routes, sample_policies):
        """测试请求被限流"""
        engine = ProtectionEngine(db_session)
        
        policy = db_session.query(ProtectionPolicy).filter(
            ProtectionPolicy.route_key == "GET:/api/v1/users"
        ).first()
        
        threshold = policy.rate_limit_threshold
        
        for i in range(threshold):
            result = engine.evaluate_request(
                path="/api/v1/users",
                method="GET",
                request_identifier="test-user"
            )
        
        result = engine.evaluate_request(
            path="/api/v1/users",
            method="GET",
            request_identifier="test-user"
        )
        
        assert result["decision"] == RequestDecision.RATE_LIMITED
        assert "Rate limit" in result["decision_reason"]
    
    def test_evaluate_dry_run(self, db_session, sample_routes, sample_policies):
        """测试 Dry Run 模式"""
        engine = ProtectionEngine(db_session)
        
        result = engine.evaluate_request(
            path="/api/v1/users",
            method="GET",
            is_dry_run=True
        )
        
        assert result["is_dry_run"] is True
        assert "log_id" in result
    
    def test_evaluate_unmatched_route(self, db_session, sample_policies):
        """测试未配置的路由使用默认策略"""
        engine = ProtectionEngine(db_session)
        
        result = engine.evaluate_request(
            path="/api/v1/unknown",
            method="GET"
        )
        
        assert result["decision"] == RequestDecision.ALLOW
        assert result["route_key"] == "GET:/api/v1/unknown"
    
    def test_record_request_result_success(self, db_session, sample_routes, sample_policies):
        """测试记录成功请求结果"""
        engine = ProtectionEngine(db_session)
        
        eval_result = engine.evaluate_request(
            path="/api/v1/users",
            method="GET"
        )
        
        request_id = eval_result["request_id"]
        
        result = engine.record_request_result(
            request_id=request_id,
            is_success=True,
            response_status=200,
            response_time_ms=150.5
        )
        
        assert result["is_success"] is True
        assert result["response_status"] == 200
        assert result["response_time_ms"] == 150.5
    
    def test_record_request_result_failure(self, db_session, sample_routes, sample_policies):
        """测试记录失败请求结果"""
        engine = ProtectionEngine(db_session)
        
        eval_result = engine.evaluate_request(
            path="/api/v1/users",
            method="GET"
        )
        
        request_id = eval_result["request_id"]
        
        result = engine.record_request_result(
            request_id=request_id,
            is_success=False,
            response_status=500,
            response_time_ms=2000.0
        )
        
        assert result["is_success"] is False
        assert result["response_status"] == 500


class TestPolicyVersionManager:
    """策略版本管理测试"""
    
    def test_create_policy_version(self, db_session):
        """测试创建策略版本"""
        version = create_policy_version(
            db_session,
            version="v1.0.0",
            description="Test version"
        )
        
        assert version.version == "v1.0.0"
        assert version.description == "Test version"
        assert version.status == PolicyStatus.DRAFT
    
    def test_activate_policy_version(self, db_session):
        """测试激活策略版本"""
        version = create_policy_version(
            db_session,
            version="v1.0.0",
            description="Test version"
        )
        
        activated = activate_policy_version(db_session, version.id)
        
        assert activated.status == PolicyStatus.ACTIVE
        assert activated.canary_percentage == 100
    
    def test_get_active_policy_version(self, db_session):
        """测试获取活动版本"""
        version = create_policy_version(
            db_session,
            version="v1.0.0",
            description="Test version"
        )
        activate_policy_version(db_session, version.id)
        
        active = get_active_policy_version(db_session)
        
        assert active is not None
        assert active.version == "v1.0.0"
    
    def test_start_canary_release(self, db_session):
        """测试启动灰度发布"""
        version1 = create_policy_version(
            db_session,
            version="v1.0.0",
            description="Stable version"
        )
        activate_policy_version(db_session, version1.id)
        
        version2 = create_policy_version(
            db_session,
            version="v2.0.0",
            description="New version"
        )
        
        canary = start_canary_release(
            db_session,
            version_id=version2.id,
            canary_percentage=10,
            keep_old_active=True
        )
        
        assert canary.status == PolicyStatus.CANARY
        assert canary.canary_percentage == 10
    
    def test_update_canary_percentage(self, db_session):
        """测试更新灰度比例"""
        version = create_policy_version(
            db_session,
            version="v1.0.0",
            description="Test version"
        )
        
        start_canary_release(
            db_session,
            version_id=version.id,
            canary_percentage=10
        )
        
        updated = update_canary_percentage(
            db_session,
            version_id=version.id,
            canary_percentage=50
        )
        
        assert updated.canary_percentage == 50
    
    def test_rollback_policy_version(self, db_session):
        """测试回滚策略版本"""
        version1 = create_policy_version(
            db_session,
            version="v1.0.0",
            description="Stable version"
        )
        activate_policy_version(db_session, version1.id)
        
        version2 = create_policy_version(
            db_session,
            version="v2.0.0",
            description="New version"
        )
        activate_policy_version(db_session, version2.id)
        
        result = rollback_policy_version(
            db_session,
            from_version_id=version2.id,
            to_version_id=version1.id
        )
        
        assert result["rolled_back_from"]["version"] == "v2.0.0"
        assert result["rolled_back_to"]["version"] == "v1.0.0"
        
        active = get_active_policy_version(db_session)
        assert active.version == "v1.0.0"


class TestHealthManager:
    """健康管理测试"""
    
    def test_report_health_healthy(self, db_session):
        """测试上报健康依赖"""
        manager = HealthManager(db_session)
        
        health = manager.report_health(
            dependency_key="test-service:api",
            is_healthy=True,
            error_rate=0.01,
            latency_p99_ms=150,
            success_count=9900,
            failure_count=100
        )
        
        assert health.dependency_key == "test-service:api"
        assert health.is_healthy is True
    
    def test_report_health_unhealthy(self, db_session):
        """测试上报不健康依赖"""
        manager = HealthManager(db_session)
        
        health = manager.report_health(
            dependency_key="failing-service:api",
            is_healthy=False,
            error_rate=0.6,
            latency_p99_ms=2000,
            success_count=400,
            failure_count=600
        )
        
        assert health.is_healthy is False
        assert health.error_rate == 0.6
    
    def test_get_dependency_health(self, db_session):
        """测试获取依赖健康状态"""
        manager = HealthManager(db_session)
        
        manager.report_health(
            dependency_key="test-service:api",
            is_healthy=True,
            error_rate=0.01
        )
        
        health = manager.get_dependency_health("test-service:api")
        
        assert health is not None
        assert health["dependency_key"] == "test-service:api"
    
    def test_list_dependencies_health(self, db_session):
        """测试列出所有依赖健康状态"""
        manager = HealthManager(db_session)
        
        manager.report_health(
            dependency_key="healthy-service:api",
            is_healthy=True
        )
        manager.report_health(
            dependency_key="unhealthy-service:api",
            is_healthy=False
        )
        
        all_deps = manager.list_dependencies_health()
        assert len(all_deps) == 2
        
        healthy = manager.list_dependencies_health(healthy_only=True)
        assert len(healthy) == 1
        
        unhealthy = manager.list_dependencies_health(unhealthy_only=True)
        assert len(unhealthy) == 1
    
    def test_get_health_summary(self, db_session):
        """测试获取健康摘要"""
        manager = HealthManager(db_session)
        
        manager.report_health(
            dependency_key="healthy-1:api",
            is_healthy=True
        )
        manager.report_health(
            dependency_key="healthy-2:api",
            is_healthy=True
        )
        manager.report_health(
            dependency_key="unhealthy:api",
            is_healthy=False
        )
        
        summary = manager.get_health_summary()
        
        assert summary["dependencies"]["total"] == 3
        assert summary["dependencies"]["healthy"] == 2
        assert summary["dependencies"]["unhealthy"] == 1


class TestReportExporter:
    """报告导出测试"""
    
    def test_export_json_report(self, db_session, sample_routes, sample_policies):
        """测试导出 JSON 报告"""
        exporter = ReportExporter(db_session)
        
        engine = ProtectionEngine(db_session)
        for i in range(5):
            engine.evaluate_request(
                path="/api/v1/users",
                method="GET"
            )
        
        report = exporter.export_json_report()
        
        assert isinstance(report, str)
        report_dict = json.loads(report)
        
        assert report_dict["report_type"] == "protection_policy_report"
        assert "request_stats" in report_dict
        assert "circuit_breaker_summary" in report_dict
        assert "dependency_health_summary" in report_dict
    
    def test_export_markdown_report(self, db_session, sample_routes, sample_policies):
        """测试导出 Markdown 报告"""
        exporter = ReportExporter(db_session)
        
        engine = ProtectionEngine(db_session)
        engine.evaluate_request(path="/api/v1/users", method="GET")
        
        report = exporter.export_markdown_report()
        
        assert isinstance(report, str)
        assert "# 接口保护策略报告" in report
        assert "请求统计" in report
        assert "熔断状态" in report
    
    def test_get_request_stats(self, db_session, sample_routes, sample_policies):
        """测试获取请求统计"""
        exporter = ReportExporter(db_session)
        
        engine = ProtectionEngine(db_session)
        for i in range(10):
            engine.evaluate_request(
                path="/api/v1/users",
                method="GET"
            )
        
        stats = exporter.get_request_stats()
        
        assert stats["total_requests"] == 10
        assert "by_decision" in stats
        assert "by_route" in stats
    
    def test_get_circuit_breaker_summary(self, db_session, sample_routes, sample_policies):
        """测试获取熔断摘要"""
        exporter = ReportExporter(db_session)
        
        summary = exporter.get_circuit_breaker_summary()
        
        assert "total" in summary
        assert "by_state" in summary
        assert "circuits" in summary


class TestIntegration:
    """集成测试"""
    
    def test_full_flow_rate_limit(self, db_session, sample_routes, sample_policies):
        """测试完整限流流程"""
        engine = ProtectionEngine(db_session)
        
        policy = db_session.query(ProtectionPolicy).filter(
            ProtectionPolicy.route_key == "GET:/api/v1/users"
        ).first()
        
        threshold = policy.rate_limit_threshold
        
        for i in range(threshold):
            result = engine.evaluate_request(
                path="/api/v1/users",
                method="GET",
                request_identifier="integration-test"
            )
            assert result["decision"] == RequestDecision.ALLOW
        
        result = engine.evaluate_request(
            path="/api/v1/users",
            method="GET",
            request_identifier="integration-test"
        )
        
        assert result["decision"] == RequestDecision.RATE_LIMITED
        assert result["threshold_value"] == threshold
        assert result["actual_value"] == threshold
    
    def test_full_flow_circuit_breaker(self, db_session, sample_routes, sample_policies):
        """测试完整熔断流程"""
        engine = ProtectionEngine(db_session)
        
        policy = db_session.query(ProtectionPolicy).filter(
            ProtectionPolicy.route_key == "POST:/api/v1/orders"
        ).first()
        
        min_requests = policy.cb_min_requests
        threshold = policy.cb_failure_threshold
        
        success_count = int(min_requests * (1 - threshold)) - 1
        failure_count = min_requests - success_count
        
        for i in range(success_count):
            eval_result = engine.evaluate_request(
                path="/api/v1/orders",
                method="POST"
            )
            engine.record_request_result(
                request_id=eval_result["request_id"],
                is_success=True
            )
        
        for i in range(failure_count):
            eval_result = engine.evaluate_request(
                path="/api/v1/orders",
                method="POST"
            )
            engine.record_request_result(
                request_id=eval_result["request_id"],
                is_success=False
            )
        
        result = engine.evaluate_request(
            path="/api/v1/orders",
            method="POST"
        )
        
        db_session.refresh(policy)
        
        cb = db_session.query(CircuitBreakerRecord).first()
        
        assert result["decision"] in [
            RequestDecision.ALLOW,
            RequestDecision.CIRCUIT_BREAKER_OPEN
        ]
