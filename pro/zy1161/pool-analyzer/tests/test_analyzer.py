import pytest
from pool_analyzer.analyzer import PoolAnalyzer
from pool_analyzer.models import (
    Service, PoolConfig, TrafficProfile, DatabaseLimits,
    RiskLevel
)


class TestPoolAnalyzer:
    def setup_method(self):
        self.db_limits = DatabaseLimits(
            max_connections=100,
            reserved_connections=10,
            superuser_reserved_connections=3
        )
        
        self.services = [
            Service(
                name="service-a",
                service_type="java",
                pool_config_name="config-a",
                instances=2,
                priority=1,
                tenant_id="tenant-1"
            ),
            Service(
                name="service-b",
                service_type="node",
                pool_config_name="config-b",
                instances=3,
                priority=2,
                tenant_id="tenant-1"
            )
        ]
        
        self.pool_configs = {
            "config-a": PoolConfig(
                service_name="config-a",
                max_pool_size=10,
                min_pool_size=2,
                connection_timeout=30.0,
                idle_timeout=300.0,
                max_lifetime=1800.0,
                retry_attempts=3,
                retry_delay=1.0,
                statement_timeout=60.0
            ),
            "config-b": PoolConfig(
                service_name="config-b",
                max_pool_size=15,
                min_pool_size=3,
                connection_timeout=20.0,
                idle_timeout=60.0,
                max_lifetime=600.0,
                retry_attempts=2,
                retry_delay=0.1,
                statement_timeout=30.0
            )
        }
        
        self.traffic_profiles = {
            "service-a": TrafficProfile(
                service_name="service-a",
                peak_qps=100.0,
                avg_db_calls_per_request=1.5,
                peak_db_calls_per_request=3.0,
                avg_connection_hold_time_ms=50.0,
                peak_connection_hold_time_ms=200.0,
                time_window_minutes=5
            ),
            "service-b": TrafficProfile(
                service_name="service-b",
                peak_qps=200.0,
                avg_db_calls_per_request=1.0,
                peak_db_calls_per_request=2.0,
                avg_connection_hold_time_ms=80.0,
                peak_connection_hold_time_ms=300.0,
                time_window_minutes=5
            )
        }

    def test_analyzer_initialization(self):
        analyzer = PoolAnalyzer(
            self.services, self.pool_configs, self.traffic_profiles, self.db_limits
        )
        
        available = 100 - 10 - 3
        assert analyzer.available_connections == available

    def test_calculate_connection_budgets(self):
        analyzer = PoolAnalyzer(
            self.services, self.pool_configs, self.traffic_profiles, self.db_limits
        )
        
        budgets = analyzer.calculate_connection_budgets()
        
        assert len(budgets) == 2
        
        for budget in budgets:
            if budget.service_name == "service-a":
                assert budget.instances == 2
                assert budget.max_possible_connections == 10 * 2
                assert budget.min_possible_connections == 2 * 2
            elif budget.service_name == "service-b":
                assert budget.instances == 3
                assert budget.max_possible_connections == 15 * 3
                assert budget.min_possible_connections == 3 * 3

    def test_assess_risks_no_risks(self):
        db_limits = DatabaseLimits(
            max_connections=1000,
            reserved_connections=10,
            superuser_reserved_connections=3
        )
        
        analyzer = PoolAnalyzer(
            self.services, self.pool_configs, self.traffic_profiles, db_limits
        )
        
        budgets = analyzer.calculate_connection_budgets()
        risks = analyzer.assess_risks(budgets)
        
        critical_high_risks = [r for r in risks if r.risk_level in [RiskLevel.CRITICAL, RiskLevel.HIGH]]
        assert len(critical_high_risks) == 0

    def test_assess_risks_total_max_exceeds(self):
        db_limits = DatabaseLimits(
            max_connections=30,
            reserved_connections=10,
            superuser_reserved_connections=3
        )
        
        analyzer = PoolAnalyzer(
            self.services, self.pool_configs, self.traffic_profiles, db_limits
        )
        
        budgets = analyzer.calculate_connection_budgets()
        risks = analyzer.assess_risks(budgets)
        
        total_max_risk = [r for r in risks if r.risk_type == "total_max_exceeds_capacity"]
        assert len(total_max_risk) == 1
        assert total_max_risk[0].risk_level == RiskLevel.CRITICAL

    def test_assess_risks_timeout_too_short(self):
        pool_configs = self.pool_configs.copy()
        pool_configs["config-a"] = PoolConfig(
            service_name="config-a",
            max_pool_size=10,
            min_pool_size=2,
            connection_timeout=3.0,
            idle_timeout=300.0,
            max_lifetime=1800.0,
            retry_attempts=3,
            retry_delay=1.0,
            statement_timeout=60.0
        )
        
        analyzer = PoolAnalyzer(
            self.services, pool_configs, self.traffic_profiles, self.db_limits
        )
        
        budgets = analyzer.calculate_connection_budgets()
        risks = analyzer.assess_risks(budgets)
        
        timeout_risk = [r for r in risks if r.risk_type == "timeout_too_short"]
        assert len(timeout_risk) == 1
        assert timeout_risk[0].risk_level == RiskLevel.HIGH
        assert timeout_risk[0].service_name == "service-a"

    def test_assess_risks_retry_storm(self):
        pool_configs = self.pool_configs.copy()
        pool_configs["config-b"] = PoolConfig(
            service_name="config-b",
            max_pool_size=15,
            min_pool_size=3,
            connection_timeout=20.0,
            idle_timeout=60.0,
            max_lifetime=600.0,
            retry_attempts=10,
            retry_delay=0.1,
            statement_timeout=30.0
        )
        
        analyzer = PoolAnalyzer(
            self.services, pool_configs, self.traffic_profiles, self.db_limits
        )
        
        budgets = analyzer.calculate_connection_budgets()
        risks = analyzer.assess_risks(budgets)
        
        retry_risk = [r for r in risks if r.risk_type == "retry_storm_risk"]
        assert len(retry_risk) == 1
        assert retry_risk[0].risk_level == RiskLevel.HIGH
        assert retry_risk[0].service_name == "service-b"

    def test_assess_risks_tenant_quota_exceeded(self):
        db_limits = DatabaseLimits(
            max_connections=200,
            reserved_connections=10,
            superuser_reserved_connections=3,
            max_connections_per_tenant=50
        )
        
        services = [
            Service(
                name="service-1",
                service_type="java",
                pool_config_name="config-large",
                instances=3,
                priority=1,
                tenant_id="tenant-1"
            )
        ]
        
        pool_configs = {
            "config-large": PoolConfig(
                service_name="config-large",
                max_pool_size=30,
                min_pool_size=5,
                connection_timeout=30.0,
                idle_timeout=300.0,
                max_lifetime=1800.0,
                retry_attempts=3,
                retry_delay=1.0,
                statement_timeout=60.0
            )
        }
        
        traffic_profiles = {}
        
        analyzer = PoolAnalyzer(services, pool_configs, traffic_profiles, db_limits)
        budgets = analyzer.calculate_connection_budgets()
        risks = analyzer.assess_risks(budgets)
        
        tenant_risk = [r for r in risks if r.risk_type == "tenant_quota_exceeded"]
        assert len(tenant_risk) == 1
        assert tenant_risk[0].risk_level == RiskLevel.CRITICAL
        assert tenant_risk[0].tenant_id == "tenant-1"

    def test_simulate_with_seed(self):
        analyzer = PoolAnalyzer(
            self.services, self.pool_configs, self.traffic_profiles, self.db_limits
        )
        
        results1 = analyzer.simulate(duration_minutes=5, step_seconds=60, seed=42)
        results2 = analyzer.simulate(duration_minutes=5, step_seconds=60, seed=42)
        
        assert len(results1) == len(results2)
        
        for r1, r2 in zip(results1, results2):
            assert r1.total_connections == r2.total_connections

    def test_simulate_returns_results(self):
        analyzer = PoolAnalyzer(
            self.services, self.pool_configs, self.traffic_profiles, self.db_limits
        )
        
        results = analyzer.simulate(duration_minutes=10, step_seconds=60)
        
        assert len(results) == 10
        
        for result in results:
            assert result.total_connections >= 0
            assert result.available_connections <= analyzer.available_connections

    def test_generate_report(self):
        analyzer = PoolAnalyzer(
            self.services, self.pool_configs, self.traffic_profiles, self.db_limits
        )
        
        budgets = analyzer.calculate_connection_budgets()
        risks = analyzer.assess_risks(budgets)
        simulation = analyzer.simulate(duration_minutes=2, step_seconds=60, seed=42)
        
        report = analyzer.generate_report(budgets, risks, simulation)
        
        assert report.report_id.startswith("pool-report-")
        assert report.total_max_possible == sum(b.max_possible_connections for b in budgets)
        assert report.utilization_percentage >= 0
        assert len(report.risks) == len(risks)
        assert len(report.simulation_results) == len(simulation)
