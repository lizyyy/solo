"""
配置解析器 - 读取和解析 YAML 配置文件
"""
import os
from pathlib import Path
from typing import Dict, Any, List, Optional

import yaml

from .models import (
    CaseConfig, Connection, Worker, IOSelectorType, TriggerMode,
    ConfigError
)


class ConfigParser:
    """配置解析器"""
    
    def __init__(self, cases_dir: Optional[str] = None):
        """
        初始化配置解析器
        
        Args:
            cases_dir: 配置文件目录，默认为当前目录下的 cases/
        """
        if cases_dir is None:
            cases_dir = os.path.join(os.getcwd(), "cases")
        self.cases_dir = Path(cases_dir)
    
    def parse_file(self, filepath: str) -> CaseConfig:
        """
        解析单个 YAML 配置文件
        
        Args:
            filepath: 配置文件路径
            
        Returns:
            CaseConfig: 解析后的配置对象
            
        Raises:
            ConfigError: 配置文件解析错误
        """
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                config_data = yaml.safe_load(f)
            
            if not config_data:
                raise ConfigError(f"配置文件为空: {filepath}")
            
            return self._parse_config_data(config_data, filepath)
            
        except yaml.YAMLError as e:
            raise ConfigError(f"YAML 解析错误: {filepath} - {str(e)}")
        except FileNotFoundError:
            raise ConfigError(f"配置文件不存在: {filepath}")
        except IOError as e:
            raise ConfigError(f"读取配置文件失败: {filepath} - {str(e)}")
    
    def parse_all(self) -> Dict[str, CaseConfig]:
        """
        解析配置目录中的所有 YAML 文件
        
        Returns:
            Dict[str, CaseConfig]: 文件名到配置对象的映射
        """
        if not self.cases_dir.exists():
            raise ConfigError(f"配置目录不存在: {self.cases_dir}")
        
        configs = {}
        
        for filepath in self.cases_dir.glob("*.yaml"):
            try:
                config = self.parse_file(str(filepath))
                configs[filepath.stem] = config
            except ConfigError as e:
                print(f"警告: 跳过无效配置文件 {filepath}: {e}")
        
        return configs
    
    def get_case(self, case_name: str) -> CaseConfig:
        """
        获取指定名称的配置
        
        Args:
            case_name: 配置名称（不带 .yaml 后缀）
            
        Returns:
            CaseConfig: 配置对象
            
        Raises:
            ConfigError: 配置不存在或解析错误
        """
        filepath = self.cases_dir / f"{case_name}.yaml"
        
        if not filepath.exists():
            # 尝试查找所有匹配的文件
            for f in self.cases_dir.glob("*.yaml"):
                config = self.parse_file(str(f))
                if config.name == case_name:
                    return config
            raise ConfigError(f"找不到配置: {case_name}")
        
        return self.parse_file(str(filepath))
    
    def list_cases(self) -> List[Dict[str, Any]]:
        """
        列出所有可用的配置
        
        Returns:
            List[Dict]: 配置列表，包含名称、描述等信息
        """
        if not self.cases_dir.exists():
            return []
        
        cases = []
        
        for filepath in sorted(self.cases_dir.glob("*.yaml")):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                
                if data:
                    cases.append({
                        "filename": filepath.name,
                        "name": data.get("name", filepath.stem),
                        "description": data.get("description", ""),
                        "selector_type": data.get("selector_type", "unknown"),
                        "trigger_mode": data.get("trigger_mode", "lt"),
                        "is_good_example": data.get("is_good_example", True),
                        "tags": data.get("tags", [])
                    })
            except Exception:
                continue
        
        return cases
    
    def _parse_config_data(self, data: Dict[str, Any], filepath: str) -> CaseConfig:
        """
        解析配置数据
        
        Args:
            data: YAML 解析后的字典
            filepath: 源文件路径（用于错误提示）
            
        Returns:
            CaseConfig: 配置对象
        """
        # 必需字段验证
        required_fields = ["name", "selector_type"]
        for field in required_fields:
            if field not in data:
                raise ConfigError(f"缺少必需字段 '{field}': {filepath}")
        
        # 解析 selector_type
        try:
            selector_type = IOSelectorType(data["selector_type"].lower())
        except ValueError:
            valid_types = [t.value for t in IOSelectorType]
            raise ConfigError(
                f"无效的 selector_type: {data['selector_type']}。有效值: {valid_types}"
            )
        
        # 解析 trigger_mode
        trigger_mode_str = data.get("trigger_mode", "lt").lower()
        try:
            trigger_mode = TriggerMode(trigger_mode_str)
        except ValueError:
            valid_modes = [m.value for m in TriggerMode]
            raise ConfigError(
                f"无效的 trigger_mode: {trigger_mode_str}。有效值: {valid_modes}"
            )
        
        # 解析 connections
        connections = []
        for i, conn_data in enumerate(data.get("connections", [])):
            conn = self._parse_connection(conn_data, i, filepath)
            connections.append(conn)
        
        # 解析 workers
        workers = []
        global_epollexclusive = data.get("epollexclusive", False)
        
        for i, worker_data in enumerate(data.get("workers", [])):
            worker = self._parse_worker(worker_data, i, filepath, global_epollexclusive)
            workers.append(worker)
        
        # 如果没有配置 workers，创建默认的 worker
        if not workers:
            workers.append(Worker(
                id=0,
                name="default-worker",
                read_chunk_size=512,
                read_delay_ms=0,
                epollexclusive=global_epollexclusive
            ))
        
        return CaseConfig(
            name=data["name"],
            selector_type=selector_type,
            description=data.get("description", ""),
            trigger_mode=trigger_mode,
            connections=connections,
            workers=workers,
            simulation_duration_ms=data.get("simulation_duration_ms", 1000),
            epollexclusive=global_epollexclusive,
            tags=data.get("tags", []),
            is_good_example=data.get("is_good_example", True)
        )
    
    def _parse_connection(self, data: Dict[str, Any], index: int, filepath: str) -> Connection:
        """
        解析单个连接配置
        """
        if "id" not in data and "fd" not in data:
            raise ConfigError(f"连接配置 #{index} 缺少 'id' 或 'fd': {filepath}")
        
        fd = data.get("fd", index + 3)  # 默认从 fd 3 开始
        
        return Connection(
            id=data.get("id", f"conn-{fd}"),
            fd=fd,
            name=data.get("name", f"Connection {fd}"),
            read_buffer_size=data.get("read_buffer_size", 4096),
            write_buffer_size=data.get("write_buffer_size", 4096),
            read_events=data.get("read_events", []),
            write_events=data.get("write_events", []),
            read_data_size=data.get("read_data_size", 1024),
            write_available_size=data.get("write_available_size", 1024)
        )
    
    def _parse_worker(self, data: Dict[str, Any], index: int, filepath: str, 
                       global_epollexclusive: bool) -> Worker:
        """
        解析单个 worker 配置
        """
        # worker 可以覆盖全局的 epollexclusive 设置
        epollexclusive = data.get("epollexclusive", global_epollexclusive)
        
        return Worker(
            id=data.get("id", index),
            name=data.get("name", f"worker-{index}"),
            read_chunk_size=data.get("read_chunk_size", 512),
            read_delay_ms=data.get("read_delay_ms", 0),
            epollexclusive=epollexclusive
        )
