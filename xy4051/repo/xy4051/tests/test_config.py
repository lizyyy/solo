import tempfile
from pathlib import Path

import pytest

from firmware_delivery.config import Config, ConfigModel


class TestConfig:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.config_path = Path(self.tmpdir) / "test-config.json"
    
    def test_create_config(self):
        config = Config.create(
            self.config_path,
            project_name="测试项目",
            device_models=["巡检终端X1"],
            regions=["华东区域"],
            allowed_firmware_versions=["v1.0.0"],
            calibration_validity_days=180,
            delivery_directory="./test-delivery",
            audit_directory="./test-audit",
            manifest_version="1.0"
        )
        
        assert config.project_name == "测试项目"
        assert config.device_models == ["巡检终端X1"]
        assert config.regions == ["华东区域"]
        assert config.allowed_firmware_versions == ["v1.0.0"]
        assert config.calibration_validity_days == 180
        assert self.config_path.exists()
    
    def test_load_config(self):
        config1 = Config.create(
            self.config_path,
            project_name="测试项目",
            device_models=["巡检终端X1"]
        )
        
        config2 = Config.load(self.config_path)
        
        assert config2.project_name == "测试项目"
        assert config2.device_models == ["巡检终端X1"]
    
    def test_add_device_model(self):
        config = Config.create(
            self.config_path,
            project_name="测试项目"
        )
        
        config.add_device_model("巡检终端X1")
        config.add_device_model("传感器网关G2")
        
        assert "巡检终端X1" in config.device_models
        assert "传感器网关G2" in config.device_models
    
    def test_add_region(self):
        config = Config.create(
            self.config_path,
            project_name="测试项目"
        )
        
        config.add_region("华东区域")
        
        assert "华东区域" in config.regions
    
    def test_add_allowed_version(self):
        config = Config.create(
            self.config_path,
            project_name="测试项目"
        )
        
        config.add_allowed_version("v1.0.0")
        
        assert "v1.0.0" in config.allowed_firmware_versions
    
    def test_delivery_directory_resolved(self):
        config = Config.create(
            self.config_path,
            project_name="测试项目",
            delivery_directory="./delivery"
        )
        
        delivery_dir = config.delivery_directory
        assert delivery_dir.is_absolute()
        assert "delivery" in str(delivery_dir)
    
    def test_audit_directory_resolved(self):
        config = Config.create(
            self.config_path,
            project_name="测试项目",
            audit_directory="./audit"
        )
        
        audit_dir = config.audit_directory
        assert audit_dir.is_absolute()
    
    def test_load_nonexistent_config(self):
        nonexistent_path = Path(self.tmpdir) / "nonexistent.json"
        
        with pytest.raises(FileNotFoundError):
            Config.load(nonexistent_path)
    
    def test_calibration_validity_timedelta(self):
        config = Config.create(
            self.config_path,
            project_name="测试项目",
            calibration_validity_days=365
        )
        
        validity = config.calibration_validity
        assert validity.days == 365
