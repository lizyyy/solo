import json
import os
import tempfile
from datetime import datetime
from pool_analyzer.exporter import ReportExporter
from pool_analyzer.models import (
    AnalysisReport, DatabaseLimits, Service, PoolConfig,
    TrafficProfile, ConnectionBudget, RiskAssessment, RiskLevel,
    SimulationResult
)


class TestReportExporter:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        
        self.db_limits = DatabaseLimits(
            max_connections=200,
            reserved_connections=10,
            superuser_reserved_connections=3,
            max_connections_per_tenant=60
        )
        
        self.services = [
            Service(
                name="test-service",
                service_type="java",
                pool_config_name="java-default",
                instances=2,
                priority=1,
                tenant_id="core"
            )
        ]
        
        self.pool_configs = {
            "java-default": PoolConfig(
                service_name="java-default",
                max_pool_size=10,
                min_pool_size=2,
                connection_timeout=30.0,
                idle_timeout=300.0,
                max_lifetime=1800.0,
                retry_attempts=3,
                retry_delay=1.0,
                statement_timeout=60.0
            )
        }
        
        self.traffic_profiles = {
            "test-service": TrafficProfile(
                service_name="test-service",
                peak_qps=100.0,
                avg_db_calls_per_request=1.5,
                peak_db_calls_per_request=3.0,
                avg_connection_hold_time_ms=50.0,
                peak_connection_hold_time_ms=200.0,
                time_window_minutes=5
            )
        }
        
        self.budgets = [
            ConnectionBudget(
                service_name="test-service",
                pool_config=self.pool_configs["java-default"],
                instances=2,
                max_possible_connections=20,
                min_possible_connections=4,
                expected_peak_connections=15.0,
                utilization_ratio=15.0 / 187.0
            )
        ]
        
        self.risks = [
            RiskAssessment(
                risk_type="test_risk",
                risk_level=RiskLevel.MEDIUM,
                service_name="test-service",
                description="这是一个测试风险",
                details={"key": "value"},
                suggested_mitigation="修复建议"
            )
        ]
        
        self.simulation_results = [
            SimulationResult(
                timestamp=datetime.now().isoformat(),
                total_connections=10,
                connections_by_service={"test-service": 10},
                connections_by_tenant={"core": 10},
                wait_queue_size=0,
                timeout_events=0,
                retry_events=0,
                available_connections=177
            )
        ]
        
        self.report = AnalysisReport(
            report_id="pool-report-test-20260504-120000",
            generated_at=datetime.now().isoformat(),
            database_limits=self.db_limits,
            services=self.services,
            pool_configs=self.pool_configs,
            traffic_profiles=self.traffic_profiles,
            connection_budgets=self.budgets,
            total_max_possible=20,
            total_min_possible=4,
            total_expected_peak=15.0,
            remaining_headroom=172,
            utilization_percentage=8.02,
            risks=self.risks,
            simulation_results=self.simulation_results,
            summary="测试报告摘要"
        )

    def test_to_json(self):
        json_str = ReportExporter.to_json(self.report)
        
        assert json_str
        data = json.loads(json_str)
        
        assert data["report_id"] == "pool-report-test-20260504-120000"
        assert data["total_max_possible"] == 20
        assert data["utilization_percentage"] == 8.02
        assert len(data["risks"]) == 1
        assert data["risks"][0]["risk_level"] == "medium"

    def test_to_markdown(self):
        md_str = ReportExporter.to_markdown(self.report)
        
        assert md_str
        assert "# 数据库连接池分析报告" in md_str
        assert "测试报告摘要" in md_str
        assert "test-service" in md_str
        assert "连接预算" in md_str
        assert "风险评估" in md_str

    def test_export_json(self):
        output_path = os.path.join(self.temp_dir, "report.json")
        
        ReportExporter.export_json(self.report, output_path)
        
        assert os.path.exists(output_path)
        
        with open(output_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        assert data["report_id"] == "pool-report-test-20260504-120000"

    def test_export_markdown(self):
        output_path = os.path.join(self.temp_dir, "report.md")
        
        ReportExporter.export_markdown(self.report, output_path)
        
        assert os.path.exists(output_path)
        
        with open(output_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        assert "# 数据库连接池分析报告" in content

    def test_json_with_critical_risk(self):
        risks = [
            RiskAssessment(
                risk_type="critical_risk",
                risk_level=RiskLevel.CRITICAL,
                description="严重风险",
                details={"critical": True},
                suggested_mitigation="立即修复"
            )
        ]
        
        report = AnalysisReport(
            report_id="pool-report-critical",
            generated_at=datetime.now().isoformat(),
            database_limits=self.db_limits,
            services=self.services,
            pool_configs=self.pool_configs,
            traffic_profiles=self.traffic_profiles,
            connection_budgets=self.budgets,
            total_max_possible=20,
            total_min_possible=4,
            total_expected_peak=15.0,
            remaining_headroom=172,
            utilization_percentage=8.02,
            risks=risks,
            simulation_results=[],
            summary="严重风险报告"
        )
        
        json_str = ReportExporter.to_json(report)
        data = json.loads(json_str)
        
        assert data["risks"][0]["risk_level"] == "critical"

    def test_markdown_with_multiple_risks(self):
        risks = [
            RiskAssessment(
                risk_type="critical_risk",
                risk_level=RiskLevel.CRITICAL,
                service_name="service-1",
                description="严重风险1",
                details={},
                suggested_mitigation="修复1"
            ),
            RiskAssessment(
                risk_type="high_risk",
                risk_level=RiskLevel.HIGH,
                service_name="service-2",
                description="高风险1",
                details={},
                suggested_mitigation="修复2"
            ),
            RiskAssessment(
                risk_type="medium_risk",
                risk_level=RiskLevel.MEDIUM,
                description="中等风险1",
                details={},
                suggested_mitigation="修复3"
            )
        ]
        
        report = AnalysisReport(
            report_id="pool-report-multi-risks",
            generated_at=datetime.now().isoformat(),
            database_limits=self.db_limits,
            services=self.services,
            pool_configs=self.pool_configs,
            traffic_profiles=self.traffic_profiles,
            connection_budgets=self.budgets,
            total_max_possible=20,
            total_min_possible=4,
            total_expected_peak=15.0,
            remaining_headroom=172,
            utilization_percentage=8.02,
            risks=risks,
            simulation_results=[],
            summary="多风险报告"
        )
        
        md_str = ReportExporter.to_markdown(report)
        
        assert "严重风险 (1)" in md_str
        assert "高风险 (1)" in md_str
        assert "中等风险 (1)" in md_str
        assert "严重风险1" in md_str
        assert "高风险1" in md_str
        assert "中等风险1" in md_str

    def test_markdown_with_simulation(self):
        md_str = ReportExporter.to_markdown(self.report)
        
        assert "模拟结果" in md_str
        assert "峰值连接" in md_str
        assert "test-service" in md_str
