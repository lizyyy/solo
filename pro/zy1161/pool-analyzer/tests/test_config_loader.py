import os
import tempfile
import pytest
from pool_analyzer.config_loader import ConfigLoader
from pool_analyzer.models import PoolConfig, Service, TrafficProfile, DatabaseLimits


class TestConfigLoader:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.loader = ConfigLoader()

    def test_load_services(self):
        services_yaml = os.path.join(self.temp_dir, "services.yaml")
        with open(services_yaml, "w") as f:
            f.write("""
services:
  - name: test-service
    type: java
    pool_config: java-default
    instances: 2
    priority: 1
    tenant_id: core
    description: 测试服务
""")

        services = self.loader.load_services(services_yaml)
        
        assert len(services) == 1
        assert services[0].name == "test-service"
        assert services[0].service_type == "java"
        assert services[0].instances == 2
        assert services[0].priority == 1
        assert services[0].tenant_id == "core"

    def test_load_pool_configs(self):
        pool_dir = os.path.join(self.temp_dir, "pool-configs")
        os.makedirs(pool_dir)
        
        config1 = os.path.join(pool_dir, "java-default.yaml")
        with open(config1, "w") as f:
            f.write("""
service_name: java-default
max_pool_size: 10
min_pool_size: 2
connection_timeout: 30.0
idle_timeout: 300.0
max_lifetime: 1800.0
retry_attempts: 3
retry_delay: 1.0
statement_timeout: 60.0
""")

        configs = self.loader.load_pool_configs(pool_dir)
        
        assert len(configs) == 1
        assert "java-default" in configs
        config = configs["java-default"]
        assert config.max_pool_size == 10
        assert config.min_pool_size == 2
        assert config.connection_timeout == 30.0
        assert config.retry_attempts == 3

    def test_load_traffic(self):
        traffic_csv = os.path.join(self.temp_dir, "traffic.csv")
        with open(traffic_csv, "w") as f:
            f.write("""service_name,peak_qps,avg_db_calls_per_request,peak_db_calls_per_request,avg_connection_hold_time_ms,peak_connection_hold_time_ms,time_window_minutes
test-service,100,1.5,3,50,200,5
""")

        traffic = self.loader.load_traffic(traffic_csv)
        
        assert len(traffic) == 1
        assert "test-service" in traffic
        profile = traffic["test-service"]
        assert profile.peak_qps == 100.0
        assert profile.avg_db_calls_per_request == 1.5
        assert profile.avg_connection_hold_time_ms == 50.0

    def test_load_db_limits(self):
        db_limits_yaml = os.path.join(self.temp_dir, "db-limits.yaml")
        with open(db_limits_yaml, "w") as f:
            f.write("""
max_connections: 200
reserved_connections: 10
superuser_reserved_connections: 3
max_connections_per_tenant: 60
max_wal_size: 4GB
shared_buffers: 512MB
""")

        limits = self.loader.load_db_limits(db_limits_yaml)
        
        assert limits.max_connections == 200
        assert limits.reserved_connections == 10
        assert limits.superuser_reserved_connections == 3
        assert limits.max_connections_per_tenant == 60

    def test_load_all(self):
        services_yaml = os.path.join(self.temp_dir, "services.yaml")
        pool_dir = os.path.join(self.temp_dir, "pool-configs")
        traffic_csv = os.path.join(self.temp_dir, "traffic.csv")
        db_limits_yaml = os.path.join(self.temp_dir, "db-limits.yaml")

        with open(services_yaml, "w") as f:
            f.write("services: []\n")
        
        os.makedirs(pool_dir)
        
        with open(traffic_csv, "w") as f:
            f.write("service_name,peak_qps\n")
        
        with open(db_limits_yaml, "w") as f:
            f.write("max_connections: 100\n")

        result = self.loader.load_all(services_yaml, pool_dir, traffic_csv, db_limits_yaml)
        
        assert len(result) == 4
        assert isinstance(result[0], list)
        assert isinstance(result[1], dict)
        assert isinstance(result[2], dict)
        assert isinstance(result[3], DatabaseLimits)

    def test_load_services_file_not_found(self):
        with pytest.raises(ValueError, match="Services config file not found"):
            self.loader.load_services("/nonexistent/services.yaml")

    def test_load_pool_configs_directory_not_found(self):
        with pytest.raises(ValueError, match="Pool config directory not found"):
            self.loader.load_pool_configs("/nonexistent/pool-configs")
