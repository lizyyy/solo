import os
import yaml
import pandas as pd
from typing import Dict, List, Optional
from .models import (
    PoolConfig, Service, TrafficProfile, DatabaseLimits
)


class ConfigLoader:
    def __init__(self):
        self.pool_configs: Dict[str, PoolConfig] = {}
        self.services: List[Service] = []
        self.traffic_profiles: Dict[str, TrafficProfile] = {}
        self.db_limits: Optional[DatabaseLimits] = None

    def load_pool_configs(self, config_dir: str) -> Dict[str, PoolConfig]:
        if not os.path.isdir(config_dir):
            raise ValueError(f"Pool config directory not found: {config_dir}")

        for filename in os.listdir(config_dir):
            if filename.endswith(('.yaml', '.yml')):
                filepath = os.path.join(config_dir, filename)
                config_name = os.path.splitext(filename)[0]
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                    pool_config = PoolConfig(
                        service_name=data.get('service_name', config_name),
                        max_pool_size=data.get('max_pool_size', 10),
                        min_pool_size=data.get('min_pool_size', 0),
                        connection_timeout=data.get('connection_timeout', 30.0),
                        idle_timeout=data.get('idle_timeout', 300.0),
                        max_lifetime=data.get('max_lifetime', 1800.0),
                        retry_attempts=data.get('retry_attempts', 3),
                        retry_delay=data.get('retry_delay', 1.0),
                        statement_timeout=data.get('statement_timeout', 60.0)
                    )
                    self.pool_configs[config_name] = pool_config

        return self.pool_configs

    def load_services(self, filepath: str) -> List[Service]:
        if not os.path.isfile(filepath):
            raise ValueError(f"Services config file not found: {filepath}")

        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        services_list = data.get('services', []) if data else []
        self.services = []
        
        for svc in services_list:
            service = Service(
                name=svc.get('name', ''),
                service_type=svc.get('type', 'unknown'),
                pool_config_name=svc.get('pool_config', 'default'),
                instances=svc.get('instances', 1),
                priority=svc.get('priority', 5),
                tenant_id=svc.get('tenant_id'),
                description=svc.get('description', '')
            )
            self.services.append(service)

        return self.services

    def load_traffic(self, filepath: str) -> Dict[str, TrafficProfile]:
        if not os.path.isfile(filepath):
            raise ValueError(f"Traffic file not found: {filepath}")

        df = pd.read_csv(filepath)
        self.traffic_profiles = {}

        for _, row in df.iterrows():
            profile = TrafficProfile(
                service_name=str(row.get('service_name', 'unknown')),
                peak_qps=float(row.get('peak_qps', 0)),
                avg_db_calls_per_request=float(row.get('avg_db_calls_per_request', 1)),
                peak_db_calls_per_request=float(row.get('peak_db_calls_per_request', 2)),
                avg_connection_hold_time_ms=float(row.get('avg_connection_hold_time_ms', 100)),
                peak_connection_hold_time_ms=float(row.get('peak_connection_hold_time_ms', 500)),
                time_window_minutes=int(row.get('time_window_minutes', 5))
            )
            self.traffic_profiles[profile.service_name] = profile

        return self.traffic_profiles

    def load_db_limits(self, filepath: str) -> DatabaseLimits:
        if not os.path.isfile(filepath):
            raise ValueError(f"Database limits file not found: {filepath}")

        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        self.db_limits = DatabaseLimits(
            max_connections=data.get('max_connections', 100),
            reserved_connections=data.get('reserved_connections', 10),
            superuser_reserved_connections=data.get('superuser_reserved_connections', 3),
            max_connections_per_tenant=data.get('max_connections_per_tenant'),
            max_wal_size=data.get('max_wal_size', '1GB'),
            shared_buffers=data.get('shared_buffers', '128MB')
        )

        return self.db_limits

    def load_all(
        self,
        services_path: str,
        pool_configs_dir: str,
        traffic_path: str,
        db_limits_path: str
    ) -> tuple:
        self.load_services(services_path)
        self.load_pool_configs(pool_configs_dir)
        self.load_traffic(traffic_path)
        self.load_db_limits(db_limits_path)

        return (
            self.services,
            self.pool_configs,
            self.traffic_profiles,
            self.db_limits
        )
