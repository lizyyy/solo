"""配置模型测试"""

import pytest
import tempfile
from pathlib import Path

from beekeeper.config import Config, ConfigManager, Apiary, Hive, Drug


class TestConfig:
    """配置类测试"""
    
    def test_create_config(self):
        """测试创建配置"""
        config = Config()
        assert config.config_version == "1.0"
        assert len(config.apiaries) == 0
        assert len(config.hives) == 0
        assert len(config.drugs) == 0
    
    def test_add_apiary(self):
        """测试添加蜂场"""
        config = Config()
        apiary = config.add_apiary("东山蜂场", location="广东省广州市")
        
        assert config.apiary_exists("东山蜂场")
        assert apiary.name == "东山蜂场"
        assert apiary.location == "广东省广州市"
    
    def test_add_apiary_duplicate(self):
        """测试添加重复蜂场"""
        config = Config()
        config.add_apiary("东山蜂场")
        
        with pytest.raises(ValueError, match="已存在"):
            config.add_apiary("东山蜂场")
    
    def test_add_hive(self):
        """测试添加蜂箱"""
        config = Config()
        config.add_apiary("东山蜂场")
        hive = config.add_hive("A001", "东山蜂场", 2025)
        
        assert config.hive_exists("A001")
        assert hive.hive_number == "A001"
        assert hive.apiary == "东山蜂场"
        assert hive.queen_year == 2025
    
    def test_add_hive_invalid_apiary(self):
        """测试添加蜂箱到不存在的蜂场"""
        config = Config()
        
        with pytest.raises(ValueError, match="蜂场.*不存在"):
            config.add_hive("A001", "不存在的蜂场", 2025)
    
    def test_add_drug(self):
        """测试添加药物"""
        config = Config()
        drug = config.add_drug("氟胺氰菊酯", 21, "治螨药物")
        
        assert config.drug_exists("氟胺氰菊酯")
        assert drug.name == "氟胺氰菊酯"
        assert drug.safety_interval_days == 21
    
    def test_get_hives_by_apiary(self):
        """测试按蜂场获取蜂箱"""
        config = Config()
        config.add_apiary("东山蜂场")
        config.add_apiary("西山蜂场")
        config.add_hive("A001", "东山蜂场", 2025)
        config.add_hive("A002", "东山蜂场", 2024)
        config.add_hive("B001", "西山蜂场", 2025)
        
        east_hives = config.get_hives_by_apiary("东山蜂场")
        assert len(east_hives) == 2
        
        west_hives = config.get_hives_by_apiary("西山蜂场")
        assert len(west_hives) == 1


class TestConfigManager:
    """配置管理器测试"""
    
    def test_init_config(self):
        """测试初始化配置"""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "beekeeper.json"
            manager = ConfigManager(config_path)
            
            config = manager.init_config()
            
            assert config_path.exists()
            assert manager.config_exists()
    
    def test_load_save_config(self):
        """测试加载和保存配置"""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = Path(tmpdir) / "beekeeper.json"
            manager = ConfigManager(config_path)
            
            config = manager.init_config()
            config.add_apiary("东山蜂场")
            config.add_hive("A001", "东山蜂场", 2025)
            config.add_drug("氟胺氰菊酯", 21)
            manager.save_config()
            
            manager2 = ConfigManager(config_path)
            loaded = manager2.load_config()
            
            assert loaded.apiary_exists("东山蜂场")
            assert loaded.hive_exists("A001")
            assert loaded.drug_exists("氟胺氰菊酯")
