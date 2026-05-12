"""
配置管理模块

读取和管理表规模配置、上线窗口信息等配置。
"""

import os
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import time

import yaml


@dataclass
class TableScaleConfig:
    """表规模配置"""
    name: str
    service: str
    row_count: int = 0
    is_large: bool = False


@dataclass
class DeploymentWindow:
    """上线窗口配置"""
    start_time: time
    end_time: time
    allowed_days: List[int] = field(default_factory=list)  # 0-6, 0=周一


@dataclass
class AppConfig:
    """应用配置"""
    table_scales: Dict[str, TableScaleConfig] = field(default_factory=dict)
    deployment_window: Optional[DeploymentWindow] = None
    default_large_table_threshold: int = 100000
    large_tables: List[str] = field(default_factory=list)


class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_dir: str = None):
        self.config_dir = config_dir or os.getcwd()
        self.config = AppConfig()
    
    def load_table_scale_config(self, config_file: str) -> None:
        """加载表规模配置"""
        file_path = os.path.join(self.config_dir, config_file)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"表规模配置文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
        
        self.config.large_tables = data.get('large_tables', [])
        self.config.default_large_table_threshold = data.get(
            'default_large_table_threshold', 100000
        )
        
        tables = data.get('tables', {})
        for table_name, table_info in tables.items():
            scale = TableScaleConfig(
                name=table_name,
                service=table_info.get('service', 'unknown'),
                row_count=table_info.get('row_count', 0),
                is_large=table_info.get('is_large', table_info.get('row_count', 0) >= self.config.default_large_table_threshold)
            )
            self.config.table_scales[table_name.lower()] = scale
    
    def load_deployment_window(self, config_file: str) -> None:
        """加载上线窗口配置"""
        file_path = os.path.join(self.config_dir, config_file)
        if not os.path.exists(file_path):
            return  # 允许没有上线窗口配置
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
        
        if 'deployment_window' in data:
            dw = data['deployment_window']
            start_time = time.fromisoformat(dw.get('start_time', '00:00'))
            end_time = time.fromisoformat(dw.get('end_time', '23:59'))
            allowed_days = dw.get('allowed_days', list(range(7)))
            
            self.config.deployment_window = DeploymentWindow(
                start_time=start_time,
                end_time=end_time,
                allowed_days=allowed_days
            )
    
    def is_large_table(self, table_name: str) -> bool:
        """判断是否为大表"""
        table_lower = table_name.lower()
        
        if table_lower in self.config.large_tables:
            return True
        
        if table_lower in self.config.table_scales:
            return self.config.table_scales[table_lower].is_large
        
        return False
    
    def get_table_service(self, table_name: str) -> str:
        """获取表所属服务"""
        table_lower = table_name.lower()
        
        if table_lower in self.config.table_scales:
            return self.config.table_scales[table_lower].service
        
        return 'unknown'
    
    def get_services(self) -> List[str]:
        """获取所有服务名称"""
        services = set()
        for table in self.config.table_scales.values():
            services.add(table.service)
        return sorted(services)
