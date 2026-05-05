"""配置文件解析器"""

import json
from pathlib import Path
from typing import Dict, Any, Optional, Union

import yaml

from .models import SimulationConfig


class ConfigParser:
    """配置解析器"""
    
    @classmethod
    def parse_file(cls, file_path: Union[str, Path]) -> SimulationConfig:
        """从文件解析配置
        
        支持 YAML 和 JSON 格式
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {file_path}")
        
        content = file_path.read_text()
        
        if file_path.suffix.lower() in ('.yaml', '.yml'):
            return cls.parse_yaml(content)
        elif file_path.suffix.lower() == '.json':
            return cls.parse_json(content)
        else:
            # 尝试自动检测格式
            try:
                return cls.parse_json(content)
            except json.JSONDecodeError:
                return cls.parse_yaml(content)
    
    @classmethod
    def parse_yaml(cls, yaml_content: str) -> SimulationConfig:
        """从 YAML 字符串解析配置"""
        data = yaml.safe_load(yaml_content)
        return cls._build_config(data)
    
    @classmethod
    def parse_json(cls, json_content: str) -> SimulationConfig:
        """从 JSON 字符串解析配置"""
        data = json.loads(json_content)
        return cls._build_config(data)
    
    @classmethod
    def _build_config(cls, data: Dict[str, Any]) -> SimulationConfig:
        """构建配置对象"""
        config = SimulationConfig()
        
        # 线程池配置
        threadpool = data.get('threadpool', {})
        config.worker_count = threadpool.get('worker_count', config.worker_count)
        config.local_queue_capacity = threadpool.get('local_queue_capacity', config.local_queue_capacity)
        config.global_queue_capacity = threadpool.get('global_queue_capacity', config.global_queue_capacity)
        
        # 队列策略
        queue = data.get('queue', {})
        config.use_work_stealing = queue.get('use_work_stealing', config.use_work_stealing)
        config.steal_from = queue.get('steal_from', config.steal_from)
        
        # 背压策略
        backpressure = data.get('backpressure', {})
        config.backpressure_strategy = backpressure.get('strategy', config.backpressure_strategy)
        config.max_queue_wait_time = backpressure.get('max_wait_time', config.max_queue_wait_time)
        
        # 饥饿检测
        starvation = data.get('starvation', {})
        config.starvation_threshold = starvation.get('threshold', config.starvation_threshold)
        
        # 模拟配置
        simulation = data.get('simulation', {})
        config.simulation_duration = simulation.get('duration', config.simulation_duration)
        config.seed = simulation.get('seed', config.seed)
        
        # 任务配置
        config.tasks = data.get('tasks', [])
        
        # 生产者配置
        config.producers = data.get('producers', [])
        
        # 输出配置
        output = data.get('output', {})
        config.verbose = output.get('verbose', config.verbose)
        
        return config
    
    @classmethod
    def to_dict(cls, config: SimulationConfig) -> Dict[str, Any]:
        """将配置转换为字典"""
        return {
            'threadpool': {
                'worker_count': config.worker_count,
                'local_queue_capacity': config.local_queue_capacity,
                'global_queue_capacity': config.global_queue_capacity,
            },
            'queue': {
                'use_work_stealing': config.use_work_stealing,
                'steal_from': config.steal_from,
            },
            'backpressure': {
                'strategy': config.backpressure_strategy,
                'max_wait_time': config.max_queue_wait_time,
            },
            'starvation': {
                'threshold': config.starvation_threshold,
            },
            'simulation': {
                'duration': config.simulation_duration,
                'seed': config.seed,
            },
            'tasks': config.tasks,
            'producers': config.producers,
            'output': {
                'verbose': config.verbose,
            },
        }
    
    @classmethod
    def to_yaml(cls, config: SimulationConfig) -> str:
        """将配置转换为 YAML 字符串"""
        return yaml.dump(cls.to_dict(config), default_flow_style=False, allow_unicode=True)
    
    @classmethod
    def to_json(cls, config: SimulationConfig) -> str:
        """将配置转换为 JSON 字符串"""
        return json.dumps(cls.to_dict(config), indent=2, ensure_ascii=False)
