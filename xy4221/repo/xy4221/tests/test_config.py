import os
import tempfile
from pathlib import Path

import pytest

from power_checker.config import (
    ProjectConfig,
    CircuitConfig,
    load_config,
    save_config,
    create_default_config,
    DEFAULT_CONFIG_NAME,
)


class TestConfig:
    def test_create_default_config(self):
        config = create_default_config("测试项目")
        assert config.project_name == "测试项目"
        assert len(config.circuits) == 6
        assert config.time_window_minutes == 5
        assert config.overload_threshold_pct == 110.0

    def test_circuit_config_defaults(self):
        circuit = CircuitConfig(
            id="A1", name="测试回路", phase="A", rated_current=32.0, max_current=40.0
        )
        assert circuit.id == "A1"
        assert circuit.phase == "A"
        assert circuit.rated_current == 32.0

    def test_config_to_dict_and_back(self):
        config = create_default_config("测试项目")
        config_dict = config.to_dict()
        
        restored = ProjectConfig.from_dict(config_dict)
        
        assert restored.project_name == config.project_name
        assert len(restored.circuits) == len(config.circuits)
        assert restored.time_window_minutes == config.time_window_minutes

    def test_save_and_load_config(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config = create_default_config("临时测试")
            
            save_config(config, tmpdir)
            
            config_path = Path(tmpdir) / DEFAULT_CONFIG_NAME
            assert config_path.exists()
            
            loaded = load_config(tmpdir)
            assert loaded is not None
            assert loaded.project_name == "临时测试"

    def test_load_nonexistent_config(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            loaded = load_config(tmpdir)
            assert loaded is None
