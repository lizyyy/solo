import pytest
from pathlib import Path
from litigation_precheck.config import ProjectConfig, ConfigManager, MaterialType, NamingRule


class TestConfig:
    def test_create_default_config(self):
        config = ConfigManager.create_default_config("测试项目", case_number="(2024)京民初字第123号")
        
        assert config.project_name == "测试项目"
        assert config.case_number == "(2024)京民初字第123号"
        assert len(config.material_types) > 0
        assert len(config.naming_rules) > 0
    
    def test_material_type_defaults(self):
        for mt in ProjectConfig().material_types:
            assert mt.name is not None
            assert mt.code is not None
    
    def test_required_materials(self):
        config = ProjectConfig()
        required_codes = {mt.code for mt in config.material_types if mt.required}
        
        assert "COMPLAINT" in required_codes
        assert "POA" in required_codes
        assert "EVIDENCE_LIST" in required_codes
        assert "EVIDENCE" in required_codes
        assert "ADDRESS_CONFIRM" in required_codes
    
    def test_config_save_load(self, tmp_path):
        config = ConfigManager.create_default_config("测试保存加载")
        config_path = tmp_path / "test_config.json"
        
        ConfigManager.save_config(config, config_path)
        
        loaded = ConfigManager.load_config(config_path)
        
        assert loaded.project_name == "测试保存加载"
        assert len(loaded.material_types) == len(config.material_types)
    
    def test_find_config(self, tmp_path):
        sub_dir = tmp_path / "subdir" / "deep"
        sub_dir.mkdir(parents=True)
        
        config = ConfigManager.create_default_config("测试查找")
        config_path = tmp_path / ConfigManager.DEFAULT_CONFIG_FILENAME
        ConfigManager.save_config(config, config_path)
        
        found = ConfigManager.find_config(sub_dir)
        
        assert found is not None
        assert found == config_path
