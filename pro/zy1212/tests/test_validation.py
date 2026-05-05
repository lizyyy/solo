import pytest
from datetime import datetime, timedelta
from pydantic import ValidationError

from app.schemas.project import ProjectCreate, ProjectUpdate
from app.schemas.interface import InterfaceCreate
from app.schemas.traffic_model import TrafficModelCreate
from app.schemas.load_test_batch import LoadTestBatchCreate, LoadTestBatchRawDataImport
from app.schemas.optimization_action import OptimizationActionCreate, StatusTransitionRequest
from app.schemas.monitoring_snapshot import MonitoringSnapshotCreate
from app.schemas.common import OptimizationStatusEnum


class TestProjectValidation:
    def test_project_create_valid(self):
        project = ProjectCreate(
            name="有效项目名称",
            description="项目描述",
            service_name="test-service",
            environment="production",
        )
        assert project.name == "有效项目名称"
        
    def test_project_create_name_too_short(self):
        with pytest.raises(ValidationError):
            ProjectCreate(name="", service_name="test")
            
    def test_project_create_name_too_long(self):
        long_name = "a" * 201
        with pytest.raises(ValidationError):
            ProjectCreate(name=long_name, service_name="test")
            
    def test_project_create_invalid_environment(self):
        with pytest.raises(ValidationError):
            ProjectCreate(name="test", service_name="test", environment="invalid_env")


class TestInterfaceValidation:
    def test_interface_create_valid(self):
        interface = InterfaceCreate(
            name="用户登录",
            path="/api/v1/auth/login",
            method="POST",
        )
        assert interface.path == "/api/v1/auth/login"
        
    def test_interface_create_path_must_start_with_slash(self):
        with pytest.raises(ValidationError):
            InterfaceCreate(
                name="测试",
                path="api/v1/test",
                method="GET",
            )
            
    def test_interface_create_invalid_method(self):
        with pytest.raises(ValidationError):
            InterfaceCreate(
                name="测试",
                path="/api/v1/test",
                method="INVALID",
            )
            
    def test_interface_create_negative_expected_qps(self):
        with pytest.raises(ValidationError):
            InterfaceCreate(
                name="测试",
                path="/api/v1/test",
                method="GET",
                expected_qps=-100,
            )


class TestTrafficModelValidation:
    def test_traffic_model_create_valid(self):
        model = TrafficModelCreate(
            name="标准流量模型",
            total_users=1000,
            concurrent_users=200,
            test_duration_seconds=1800,
        )
        assert model.total_users == 1000
        
    def test_traffic_model_negative_users(self):
        with pytest.raises(ValidationError):
            TrafficModelCreate(
                name="测试",
                total_users=-100,
                concurrent_users=50,
                test_duration_seconds=300,
            )
            
    def test_traffic_model_invalid_distribution(self):
        with pytest.raises(ValidationError):
            TrafficModelCreate(
                name="测试",
                total_users=100,
                concurrent_users=50,
                test_duration_seconds=300,
                distribution_pattern="invalid_pattern",
            )
            
    def test_traffic_model_invalid_think_time(self):
        with pytest.raises(ValidationError):
            TrafficModelCreate(
                name="测试",
                total_users=100,
                concurrent_users=50,
                test_duration_seconds=300,
                think_time_min_ms=3000,
                think_time_max_ms=1000,
            )


class TestLoadTestBatchValidation:
    def test_batch_create_valid(self):
        batch = LoadTestBatchCreate(
            name="V1.0.0 压测",
            test_type="baseline",
            status="completed",
            qps=500.0,
            avg_response_time_ms=100.0,
            p50_response_time_ms=80.0,
            p95_response_time_ms=200.0,
            p99_response_time_ms=400.0,
            error_rate=0.005,
        )
        assert batch.qps == 500.0
        
    def test_batch_invalid_error_rate(self):
        with pytest.raises(ValidationError):
            LoadTestBatchCreate(
                name="测试",
                test_type="baseline",
                status="completed",
                error_rate=1.5,
            )
            
        with pytest.raises(ValidationError):
            LoadTestBatchCreate(
                name="测试",
                test_type="baseline",
                status="completed",
                error_rate=-0.01,
            )
            
    def test_batch_invalid_test_type(self):
        with pytest.raises(ValidationError):
            LoadTestBatchCreate(
                name="测试",
                test_type="invalid_type",
                status="completed",
            )
            
    def test_batch_invalid_percentile_order(self):
        with pytest.raises(ValidationError):
            LoadTestBatchCreate(
                name="测试",
                test_type="baseline",
                status="completed",
                p50_response_time_ms=200.0,
                p95_response_time_ms=150.0,
            )
            
    def test_raw_data_import_valid(self):
        import_data = LoadTestBatchRawDataImport(
            name="原始数据导入",
            test_type="regression",
            raw_response_times=[50, 60, 70, 80, 90, 100],
            duration_seconds=60,
            total_requests=1000,
            total_errors=0,
        )
        assert len(import_data.raw_response_times) == 6
        
    def test_raw_data_import_negative_errors(self):
        with pytest.raises(ValidationError):
            LoadTestBatchRawDataImport(
                name="测试",
                test_type="regression",
                raw_response_times=[100],
                duration_seconds=60,
                total_requests=1000,
                total_errors=-1,
            )


class TestMonitoringSnapshotValidation:
    def test_monitoring_snapshot_valid(self):
        snapshot = MonitoringSnapshotCreate(
            hostname="server-01",
            cpu_utilization_percent=75.5,
            memory_utilization_percent=62.0,
        )
        assert snapshot.cpu_utilization_percent == 75.5
        
    def test_monitoring_invalid_cpu_percent(self):
        with pytest.raises(ValidationError):
            MonitoringSnapshotCreate(
                hostname="server-01",
                cpu_utilization_percent=150.0,
            )
            
        with pytest.raises(ValidationError):
            MonitoringSnapshotCreate(
                hostname="server-01",
                cpu_utilization_percent=-10.0,
            )
            
    def test_monitoring_invalid_cache_hit_rate(self):
        with pytest.raises(ValidationError):
            MonitoringSnapshotCreate(
                hostname="server-01",
                cache_hit_rate=110.0,
            )


class TestOptimizationActionValidation:
    def test_action_create_valid(self):
        action = OptimizationActionCreate(
            title="优化数据库连接池",
            description="连接池配置过小",
            action_type="configuration",
            priority="high",
        )
        assert action.title == "优化数据库连接池"
        
    def test_action_invalid_action_type(self):
        with pytest.raises(ValidationError):
            OptimizationActionCreate(
                title="测试",
                description="测试",
                action_type="invalid_type",
                priority="high",
            )
            
    def test_action_invalid_priority(self):
        with pytest.raises(ValidationError):
            OptimizationActionCreate(
                title="测试",
                description="测试",
                action_type="code",
                priority="invalid_priority",
            )
            
    def test_status_transition_valid(self):
        request = StatusTransitionRequest(
            new_status=OptimizationStatusEnum.IN_PROGRESS,
            reason="开始实施优化",
        )
        assert request.new_status == OptimizationStatusEnum.IN_PROGRESS
        
    def test_status_transition_invalid(self):
        with pytest.raises(ValidationError):
            StatusTransitionRequest(
                new_status="invalid_status",
            )


class TestEdgeCases:
    def test_zero_values_allowed(self):
        batch = LoadTestBatchCreate(
            name="零值测试",
            test_type="baseline",
            status="completed",
            qps=0.0,
            error_rate=0.0,
        )
        assert batch.qps == 0.0
        assert batch.error_rate == 0.0
        
    def test_large_values(self):
        batch = LoadTestBatchCreate(
            name="大值测试",
            test_type="baseline",
            status="completed",
            qps=100000.0,
            avg_response_time_ms=10000.0,
            p99_response_time_ms=60000.0,
            total_requests=999999999,
        )
        assert batch.qps == 100000.0
        
    def test_optional_fields(self):
        project = ProjectCreate(
            name="测试",
            service_name="test",
        )
        assert project.description is None
        assert project.environment is not None
