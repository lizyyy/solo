#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
状态存储模块测试 - Storage Tests

测试方案保存和加载功能。
"""

import pytest
import json
from pathlib import Path
from datetime import datetime

from pvchecker.storage import (
    SchemeStorage,
    SavedScheme,
    StorageError,
    save_current_analysis,
    _custom_json_encoder,
    _dict_to_dataclass,
)
from pvchecker.solver import SolutionType


class TestSchemeStorage:
    """方案存储管理器测试"""
    
    def test_create_storage(self, temp_dir: Path):
        """测试创建存储"""
        storage = SchemeStorage(temp_dir)
        
        assert storage.storage_dir == temp_dir
        assert (temp_dir / "schemes").exists()
        assert (temp_dir / "index.json").exists()
    
    def test_save_scheme(self, temp_dir: Path, test_module, test_roof_zones, test_inverter):
        """测试保存方案"""
        storage = SchemeStorage(temp_dir)
        
        scheme_id = storage.save(
            name="Test Scheme",
            module=test_module,
            roof_zones=test_roof_zones,
            inverter=test_inverter,
            description="Test description",
        )
        
        assert scheme_id is not None
        assert scheme_id.startswith("scheme_")
        
        scheme_file = temp_dir / "schemes" / f"{scheme_id}.json"
        assert scheme_file.exists()
    
    def test_load_scheme(self, temp_dir: Path, test_module, test_roof_zones, test_inverter):
        """测试加载方案"""
        storage = SchemeStorage(temp_dir)
        
        scheme_id = storage.save(
            name="Test Scheme",
            module=test_module,
            roof_zones=test_roof_zones,
            inverter=test_inverter,
            description="Test description",
        )
        
        loaded = storage.load(scheme_id)
        
        assert loaded is not None
        assert loaded.name == "Test Scheme"
        assert loaded.description == "Test description"
        assert loaded.module_params is not None
        assert loaded.module_params['model'] == test_module.model
    
    def test_load_nonexistent_scheme(self, temp_dir: Path):
        """测试加载不存在的方案"""
        storage = SchemeStorage(temp_dir)
        
        loaded = storage.load("nonexistent_scheme")
        
        assert loaded is None
    
    def test_list_schemes(self, temp_dir: Path, test_module, test_roof_zones, test_inverter):
        """测试列出方案"""
        storage = SchemeStorage(temp_dir)
        
        storage.save(name="Scheme 1", module=test_module, roof_zones=test_roof_zones, inverter=test_inverter)
        storage.save(name="Scheme 2", module=test_module, roof_zones=test_roof_zones, inverter=test_inverter)
        
        schemes = storage.list()
        
        assert len(schemes) == 2
    
    def test_delete_scheme(self, temp_dir: Path, test_module, test_roof_zones, test_inverter):
        """测试删除方案"""
        storage = SchemeStorage(temp_dir)
        
        scheme_id = storage.save(
            name="To Delete",
            module=test_module,
            roof_zones=test_roof_zones,
            inverter=test_inverter,
        )
        
        assert len(storage.list()) == 1
        
        result = storage.delete(scheme_id)
        
        assert result == True
        assert len(storage.list()) == 0
        assert storage.load(scheme_id) is None
    
    def test_delete_nonexistent_scheme(self, temp_dir: Path):
        """测试删除不存在的方案"""
        storage = SchemeStorage(temp_dir)
        
        result = storage.delete("nonexistent")
        
        assert result == False
    
    def test_search_schemes(self, temp_dir: Path, test_module, test_roof_zones, test_inverter):
        """测试搜索方案"""
        storage = SchemeStorage(temp_dir)
        
        storage.save(
            name="Solar Roof A",
            module=test_module,
            roof_zones=test_roof_zones,
            inverter=test_inverter,
            description="First project",
        )
        storage.save(
            name="Solar Roof B",
            module=test_module,
            roof_zones=test_roof_zones,
            inverter=test_inverter,
            description="Second project",
        )
        
        results_a = storage.search("Solar")
        
        assert len(results_a) == 2
        
        results_b = storage.search("Roof B")
        
        assert len(results_b) == 1
        assert results_b[0]['name'] == "Solar Roof B"
    
    def test_copy_scheme(self, temp_dir: Path, test_module, test_roof_zones, test_inverter):
        """测试复制方案"""
        storage = SchemeStorage(temp_dir)
        
        original_id = storage.save(
            name="Original Scheme",
            module=test_module,
            roof_zones=test_roof_zones,
            inverter=test_inverter,
        )
        
        new_id = storage.copy(original_id, "Copied Scheme")
        
        assert new_id is not None
        assert new_id != original_id
        
        original = storage.load(original_id)
        copied = storage.load(new_id)
        
        assert original.name == "Original Scheme"
        assert copied.name == "Copied Scheme"
        assert copied.module_params['model'] == original.module_params['model']
    
    def test_copy_nonexistent_scheme(self, temp_dir: Path):
        """测试复制不存在的方案"""
        storage = SchemeStorage(temp_dir)
        
        result = storage.copy("nonexistent", "New Name")
        
        assert result is None
    
    def test_export_import_scheme(self, temp_dir: Path, test_module, test_roof_zones, test_inverter):
        """测试导出和导入方案"""
        storage = SchemeStorage(temp_dir)
        
        scheme_id = storage.save(
            name="Export Test",
            module=test_module,
            roof_zones=test_roof_zones,
            inverter=test_inverter,
            description="Export test description",
        )
        
        export_path = temp_dir / "exported_scheme.json"
        
        result = storage.export_to_file(scheme_id, export_path)
        
        assert result == True
        assert export_path.exists()
        
        new_storage = SchemeStorage(temp_dir / "imported")
        
        imported_id = new_storage.import_from_file(export_path, "Imported Scheme")
        
        assert imported_id is not None
        
        imported = new_storage.load(imported_id)
        
        assert imported.name == "Imported Scheme"
        assert imported.module_params['model'] == test_module.model
    
    def test_get_statistics(self, temp_dir: Path, test_module, test_roof_zones, test_inverter):
        """测试获取统计信息"""
        storage = SchemeStorage(temp_dir)
        
        storage.save(name="Scheme 1", module=test_module, roof_zones=test_roof_zones, inverter=test_inverter)
        storage.save(name="Scheme 2", module=test_module, roof_zones=test_roof_zones, inverter=test_inverter)
        
        stats = storage.get_statistics()
        
        assert stats['total_schemes'] == 2
        assert stats['storage_dir'] == str(temp_dir)


class TestSaveCurrentAnalysis:
    """测试保存当前分析便捷函数测试"""
    
    def test_save_current_analysis(self, temp_dir: Path, test_module, test_roof_zones, test_inverter):
        """测试保存当前分析"""
        from pvchecker.solver import ConfigurationSolver
        
        solver = ConfigurationSolver(
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        solutions = solver.solve()
        
        scheme_id = save_current_analysis(
            name="Analysis Test",
            module=test_module,
            roof_zones=test_roof_zones,
            inverter=test_inverter,
            shading_matrix=None,
            solutions=solutions,
            risks=[],
            environment_params={'min_temp': -10.0, 'max_temp': 60.0},
            storage_dir=temp_dir,
        )
        
        assert scheme_id is not None
        
        storage = SchemeStorage(temp_dir)
        loaded = storage.load(scheme_id)
        
        assert loaded is not None
        assert loaded.name == "Analysis Test"
        assert loaded.environment_params['min_temp'] == -10.0


class TestJsonEncoder:
    """测试JSON编解码器测试"""
    
    def test_custom_json_encoder(self, test_module):
        """测试自定义JSON编码器"""
        data = {
            'module': test_module,
            'solution_type': SolutionType.OPTIMAL,
        }
        
        encoded = json.dumps(data, default=_custom_json_encoder, ensure_ascii=False)
        
        assert '"model"' in encoded
        assert '"optimal"' in encoded
