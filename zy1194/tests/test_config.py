"""配置解析测试"""

import pytest
from pathlib import Path
import tempfile

from tpsim.config import ConfigParser
from tpsim.models import SimulationConfig


class TestConfigParser:
    """配置解析器测试"""
    
    def test_parse_yaml_string(self):
        """测试解析 YAML 字符串"""
        yaml_content = """
threadpool:
  worker_count: 8
  local_queue_capacity: 20
  global_queue_capacity: 200

queue:
  use_work_stealing: true
  steal_from: most_loaded

simulation:
  duration: 100.0
  seed: 12345
"""
        config = ConfigParser.parse_yaml(yaml_content)
        
        assert config.worker_count == 8
        assert config.local_queue_capacity == 20
        assert config.global_queue_capacity == 200
        assert config.use_work_stealing is True
        assert config.steal_from == "most_loaded"
        assert config.simulation_duration == 100.0
        assert config.seed == 12345
    
    def test_parse_json_string(self):
        """测试解析 JSON 字符串"""
        json_content = """
{
  "threadpool": {
    "worker_count": 4,
    "local_queue_capacity": 10,
    "global_queue_capacity": 100
  },
  "simulation": {
    "duration": 50.0,
    "seed": 42
  }
}
"""
        config = ConfigParser.parse_json(json_content)
        
        assert config.worker_count == 4
        assert config.local_queue_capacity == 10
        assert config.global_queue_capacity == 100
        assert config.simulation_duration == 50.0
        assert config.seed == 42
    
    def test_default_values(self):
        """测试默认值"""
        yaml_content = """
threadpool:
  worker_count: 2
"""
        config = ConfigParser.parse_yaml(yaml_content)
        
        # 应该使用默认值
        assert config.worker_count == 2
        assert config.local_queue_capacity == 10  # 默认值
        assert config.global_queue_capacity == 100  # 默认值
        assert config.use_work_stealing is True  # 默认值
        assert config.backpressure_strategy == "drop"  # 默认值
    
    def test_task_config(self):
        """测试任务配置"""
        yaml_content = """
threadpool:
  worker_count: 2

tasks:
  - id: t-0
    name: task-0
    duration: 2.0
    priority: 1
  - id: t-1
    name: task-1
    duration: 3.0
    dependencies: [t-0]
"""
        config = ConfigParser.parse_yaml(yaml_content)
        
        assert len(config.tasks) == 2
        assert config.tasks[0]["id"] == "t-0"
        assert config.tasks[0]["duration"] == 2.0
        assert config.tasks[1]["dependencies"] == ["t-0"]
    
    def test_backpressure_config(self):
        """测试背压配置"""
        yaml_content = """
backpressure:
  strategy: block
  max_wait_time: 120.0
"""
        config = ConfigParser.parse_yaml(yaml_content)
        
        assert config.backpressure_strategy == "block"
        assert config.max_queue_wait_time == 120.0
    
    def test_starvation_config(self):
        """测试饥饿检测配置"""
        yaml_content = """
starvation:
  threshold: 60.0
"""
        config = ConfigParser.parse_yaml(yaml_content)
        
        assert config.starvation_threshold == 60.0
    
    def test_to_dict(self):
        """测试转换为字典"""
        config = SimulationConfig(
            worker_count=4,
            local_queue_capacity=10,
            global_queue_capacity=100,
            use_work_stealing=True
        )
        
        config_dict = ConfigParser.to_dict(config)
        
        assert config_dict["threadpool"]["worker_count"] == 4
        assert config_dict["threadpool"]["local_queue_capacity"] == 10
        assert config_dict["queue"]["use_work_stealing"] is True
    
    def test_to_yaml(self):
        """测试转换为 YAML"""
        config = SimulationConfig(worker_count=4, simulation_duration=50.0)
        yaml_str = ConfigParser.to_yaml(config)
        
        assert "worker_count" in yaml_str
        assert "4" in yaml_str
    
    def test_to_json(self):
        """测试转换为 JSON"""
        config = SimulationConfig(worker_count=4, simulation_duration=50.0)
        json_str = ConfigParser.to_json(config)
        
        assert "worker_count" in json_str
        assert "4" in json_str
        import json
        parsed = json.loads(json_str)
        assert parsed["threadpool"]["worker_count"] == 4


class TestConfigFileParsing:
    """配置文件解析测试"""
    
    def test_parse_yaml_file(self):
        """测试解析 YAML 文件"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            f.write("""
threadpool:
  worker_count: 4
simulation:
  seed: 42
""")
            yaml_path = Path(f.name)
        
        try:
            config = ConfigParser.parse_file(yaml_path)
            assert config.worker_count == 4
            assert config.seed == 42
        finally:
            yaml_path.unlink()
    
    def test_parse_json_file(self):
        """测试解析 JSON 文件"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write("""
{
  "threadpool": {
    "worker_count": 8
  }
}
""")
            json_path = Path(f.name)
        
        try:
            config = ConfigParser.parse_file(json_path)
            assert config.worker_count == 8
        finally:
            json_path.unlink()
    
    def test_file_not_found(self):
        """测试文件不存在"""
        with pytest.raises(FileNotFoundError):
            ConfigParser.parse_file(Path("/nonexistent/config.yaml"))
