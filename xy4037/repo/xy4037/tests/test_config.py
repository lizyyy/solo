"""
配置模块测试
"""

import tempfile
import json
from pathlib import Path

import pytest

from ticket_cluster_helper.config import Config, init_config, load_config, is_project_initialized


class TestConfig:
    def test_default_values(self):
        config = Config()
        
        assert config.stopwords is not None
        assert len(config.stopwords) > 0
        assert config.sensitive_fields is not None
        assert len(config.sensitive_fields) > 0
        assert config.clustering_params is not None
        assert config.similarity_threshold == 0.8
    
    def test_to_dict(self):
        config = Config(project_root=Path("/test"))
        data = config.to_dict()
        
        assert "stopwords" in data
        assert "sensitive_fields" in data
        assert "clustering_params" in data
        assert "similarity_threshold" in data
        assert data["similarity_threshold"] == 0.8
    
    def test_from_dict(self):
        data = {
            "stopwords": ["test1", "test2"],
            "sensitive_fields": ["test_field"],
            "clustering_params": {"algorithm": "dbscan"},
            "similarity_threshold": 0.9,
            "channels": ["APP", "网页端"],
            "product_lines": ["用户账户", "订单退款"]
        }
        
        config = Config.from_dict(data, Path("/test"))
        
        assert "test1" in config.stopwords
        assert "test_field" in config.sensitive_fields
        assert config.clustering_params["algorithm"] == "dbscan"
        assert config.similarity_threshold == 0.9
        assert "APP" in config.channels


class TestConfigFunctions:
    def setup_method(self):
        self.temp_dir = tempfile.mkdtemp()
        self.project_path = Path(self.temp_dir)
    
    def test_init_config(self):
        assert not is_project_initialized(self.project_path)
        
        config = init_config(self.project_path)
        
        assert is_project_initialized(self.project_path)
        assert (self.project_path / "config.json").exists()
        assert (self.project_path / "data").exists()
        assert (self.project_path / "output").exists()
        assert (self.project_path / "models").exists()
    
    def test_load_config(self):
        init_config(self.project_path)
        
        config = load_config(self.project_path)
        
        assert isinstance(config, Config)
        assert len(config.stopwords) > 0
    
    def test_load_config_not_exist(self):
        with pytest.raises(FileNotFoundError):
            load_config(self.project_path)
    
    def test_is_project_initialized(self):
        assert not is_project_initialized(self.project_path)
        
        init_config(self.project_path)
        
        assert is_project_initialized(self.project_path)
    
    def test_config_file_content(self):
        init_config(self.project_path)
        
        config_file = self.project_path / "config.json"
        with open(config_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assert "stopwords" in data
        assert "sensitive_fields" in data
        assert "text_cleaning_rules" in data
        assert "clustering_params" in data
        assert "similarity_threshold" in data
