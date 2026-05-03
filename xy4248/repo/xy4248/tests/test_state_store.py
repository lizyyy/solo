"""
状态存储模块测试
"""

import os
import tempfile
import json
import pytest
from pathlib import Path

from field_recording_tool.state_store import (
    StateStore, 
    MaterialStatus, 
    MaterialState,
    ProjectState,
    create_state_store
)


class TestMaterialStatus:
    """MaterialStatus枚举测试"""
    
    def test_enum_values(self):
        """测试枚举值"""
        assert MaterialStatus.PENDING.value == "pending"
        assert MaterialStatus.AVAILABLE.value == "available"
        assert MaterialStatus.NEED_RERECORD.value == "need_rerecord"
        assert MaterialStatus.HAS_PRIVACY.value == "has_privacy"
    
    def test_enum_from_string(self):
        """测试从字符串创建枚举"""
        assert MaterialStatus("pending") == MaterialStatus.PENDING
        assert MaterialStatus("available") == MaterialStatus.AVAILABLE
        assert MaterialStatus("need_rerecord") == MaterialStatus.NEED_RERECORD
        assert MaterialStatus("has_privacy") == MaterialStatus.HAS_PRIVACY


class TestMaterialState:
    """MaterialState数据类测试"""
    
    def test_material_state_creation(self):
        """测试MaterialState对象创建"""
        material = MaterialState(
            file_path="/path/to/audio.wav",
            file_name="audio.wav",
            file_hash="abc123"
        )
        
        assert material.file_path == "/path/to/audio.wav"
        assert material.file_name == "audio.wav"
        assert material.file_hash == "abc123"
        assert material.status == MaterialStatus.PENDING  # 默认值
        assert material.is_environment == False
        assert material.is_wild_track == False
        assert material.needs_review == False
    
    def test_material_state_with_metadata(self):
        """测试带元数据的MaterialState"""
        metadata = {
            'duration_seconds': 60.0,
            'sample_rate': 48000,
            'channels': 2
        }
        
        material = MaterialState(
            file_path="/path/to/audio.wav",
            file_name="audio.wav",
            metadata=metadata
        )
        
        assert material.metadata['duration_seconds'] == 60.0
        assert material.metadata['sample_rate'] == 48000
    
    def test_material_state_defaults(self):
        """测试默认值"""
        material = MaterialState(
            file_path="/test/file.wav",
            file_name="file.wav"
        )
        
        assert material.manual_tags == []
        assert material.manual_notes == ""
        assert material.created_time is not None
        assert material.modified_time is not None


class TestProjectState:
    """ProjectState数据类测试"""
    
    def test_project_state_creation(self):
        """测试ProjectState对象创建"""
        project = ProjectState(
            project_name="测试项目",
            project_path="/path/to/project"
        )
        
        assert project.project_name == "测试项目"
        assert project.project_path == "/path/to/project"
        assert project.total_materials == 0
        assert len(project.materials) == 0


class TestStateStore:
    """StateStore类测试"""
    
    def setup_method(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.mkdtemp()
        
        # 创建一些测试文件
        self.test_files = [
            "audio1.wav",
            "audio2.mp3",
        ]
        
        for filename in self.test_files:
            file_path = Path(self.temp_dir) / filename
            with open(file_path, 'w') as f:
                f.write(f"Test content for {filename}")
    
    def teardown_method(self):
        """清理临时目录"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_store_initialization(self):
        """测试状态存储器初始化"""
        store = StateStore(project_path=self.temp_dir)
        
        assert store.project_path == self.temp_dir
        assert store.state.project_path == ""  # 初始为空
        assert store.state.total_materials == 0
    
    def test_store_initialization_without_path(self):
        """测试不带路径的初始化"""
        store = StateStore()
        
        # 应该使用当前目录
        assert store.index_file is not None
    
    def test_add_material(self):
        """测试添加素材"""
        store = StateStore(project_path=self.temp_dir)
        
        # 添加素材
        material = store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash123",
            metadata={'sample_rate': 48000}
        )
        
        assert material is not None
        assert material.file_name == "audio1.wav"
        assert store.state.total_materials == 1
        assert "hash123" in store.state.materials
    
    def test_add_duplicate_material(self):
        """测试添加重复素材（更新）"""
        store = StateStore(project_path=self.temp_dir)
        
        # 第一次添加
        material1 = store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash123"
        )
        
        # 第二次添加（相同哈希，应该更新）
        material2 = store.add_material(
            file_path="/test/audio1_renamed.wav",
            file_name="audio1_renamed.wav",
            file_hash="hash123",
            metadata={'new_key': 'value'}
        )
        
        # 总数应该还是1
        assert store.state.total_materials == 1
        # 应该是同一个对象
        assert material1 is material2
    
    def test_get_material_by_hash(self):
        """测试通过哈希获取素材"""
        store = StateStore(project_path=self.temp_dir)
        
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash123"
        )
        
        material = store.get_material(file_hash="hash123")
        
        assert material is not None
        assert material.file_name == "audio1.wav"
    
    def test_get_material_by_path(self):
        """测试通过路径获取素材"""
        store = StateStore(project_path=self.temp_dir)
        
        test_path = "/test/audio1.wav"
        store.add_material(
            file_path=test_path,
            file_name="audio1.wav",
            file_hash="hash123"
        )
        
        material = store.get_material(file_path=test_path)
        
        assert material is not None
        assert material.file_hash == "hash123"
    
    def test_get_material_not_found(self):
        """测试获取不存在的素材"""
        store = StateStore(project_path=self.temp_dir)
        
        material = store.get_material(file_hash="nonexistent")
        
        assert material is None
    
    def test_update_material_status(self):
        """测试更新素材状态"""
        store = StateStore(project_path=self.temp_dir)
        
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash123"
        )
        
        # 更新状态
        result = store.update_material_status(
            MaterialStatus.AVAILABLE,
            file_hash="hash123"
        )
        
        assert result == True
        
        material = store.get_material(file_hash="hash123")
        assert material.status == MaterialStatus.AVAILABLE
    
    def test_tag_functions(self):
        """测试各种标记函数"""
        store = StateStore(project_path=self.temp_dir)
        
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash123"
        )
        
        # 测试可用标记
        store.tag_as_available(file_hash="hash123")
        assert store.get_material(file_hash="hash123").status == MaterialStatus.AVAILABLE
        
        # 测试需返录标记
        store.tag_as_need_rerecord(file_hash="hash123")
        assert store.get_material(file_hash="hash123").status == MaterialStatus.NEED_RERECORD
        
        # 测试含隐私标记
        store.tag_as_has_privacy(file_hash="hash123")
        assert store.get_material(file_hash="hash123").status == MaterialStatus.HAS_PRIVACY
    
    def test_add_manual_tag(self):
        """测试添加人工标签"""
        store = StateStore(project_path=self.temp_dir)
        
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash123"
        )
        
        result = store.add_manual_tag("重要素材", file_hash="hash123")
        
        assert result == True
        
        material = store.get_material(file_hash="hash123")
        assert "重要素材" in material.manual_tags
    
    def test_set_manual_notes(self):
        """测试设置人工备注"""
        store = StateStore(project_path=self.temp_dir)
        
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash123"
        )
        
        test_notes = "这个素材需要进一步处理，背景有噪音"
        result = store.set_manual_notes(test_notes, file_hash="hash123")
        
        assert result == True
        
        material = store.get_material(file_hash="hash123")
        assert material.manual_notes == test_notes
    
    def test_mark_environment_and_wild(self):
        """测试标记环境声和补录声"""
        store = StateStore(project_path=self.temp_dir)
        
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash123"
        )
        
        # 标记为环境声
        store.mark_as_environment(True, file_hash="hash123")
        assert store.get_material(file_hash="hash123").is_environment == True
        
        # 标记为补录声
        store.mark_as_wild_track(True, file_hash="hash123")
        assert store.get_material(file_hash="hash123").is_wild_track == True
        
        # 取消标记
        store.mark_as_environment(False, file_hash="hash123")
        assert store.get_material(file_hash="hash123").is_environment == False
    
    def test_get_all_materials(self):
        """测试获取所有素材"""
        store = StateStore(project_path=self.temp_dir)
        
        # 添加多个素材
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash1"
        )
        store.add_material(
            file_path="/test/audio2.wav",
            file_name="audio2.wav",
            file_hash="hash2"
        )
        
        materials = store.get_all_materials()
        
        assert len(materials) == 2
    
    def test_get_all_materials_with_filter(self):
        """测试带状态过滤的获取素材"""
        store = StateStore(project_path=self.temp_dir)
        
        # 添加素材并设置不同状态
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash1"
        )
        store.tag_as_available(file_hash="hash1")
        
        store.add_material(
            file_path="/test/audio2.wav",
            file_name="audio2.wav",
            file_hash="hash2"
        )
        # 保持pending状态
        
        # 获取可用素材
        available = store.get_all_materials(status_filter=MaterialStatus.AVAILABLE)
        assert len(available) == 1
        assert available[0].file_name == "audio1.wav"
        
        # 获取待处理素材
        pending = store.get_all_materials(status_filter=MaterialStatus.PENDING)
        assert len(pending) == 1
        assert pending[0].file_name == "audio2.wav"
    
    def test_get_statistics(self):
        """测试获取统计信息"""
        store = StateStore(project_path=self.temp_dir)
        
        # 添加素材
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash1"
        )
        store.tag_as_available(file_hash="hash1")
        
        store.add_material(
            file_path="/test/audio2.wav",
            file_name="audio2.wav",
            file_hash="hash2"
        )
        store.tag_as_need_rerecord(file_hash="hash2")
        
        store.add_material(
            file_path="/test/audio3.wav",
            file_name="audio3.wav",
            file_hash="hash3"
        )
        store.tag_as_has_privacy(file_hash="hash3")
        store.mark_as_environment(True, file_hash="hash3")
        
        stats = store.get_statistics()
        
        assert stats['total_materials'] == 3
        assert stats['status_breakdown']['available'] == 1
        assert stats['status_breakdown']['need_rerecord'] == 1
        assert stats['status_breakdown']['has_privacy'] == 1
        assert stats['track_types']['environment'] == 1
    
    def test_save_and_load(self):
        """测试保存和加载"""
        store = StateStore(project_path=self.temp_dir)
        
        # 添加素材
        store.add_material(
            file_path="/test/audio1.wav",
            file_name="audio1.wav",
            file_hash="hash123"
        )
        store.tag_as_available(file_hash="hash123")
        store.set_manual_notes("测试备注", file_hash="hash123")
        
        # 保存
        save_result = store.save()
        assert save_result == True
        
        # 验证文件存在
        assert store.index_file.exists()
        
        # 创建新的存储实例，应该自动加载
        store2 = StateStore(project_path=self.temp_dir)
        
        # 验证加载的数据
        assert store2.state.total_materials == 1
        
        material = store2.get_material(file_hash="hash123")
        assert material is not None
        assert material.file_name == "audio1.wav"
        assert material.status == MaterialStatus.AVAILABLE
        assert material.manual_notes == "测试备注"


class TestCreateStateStoreFunction:
    """create_state_store便捷函数测试"""
    
    def setup_method(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        """清理临时目录"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_create_state_store(self):
        """测试便捷函数"""
        store = create_state_store(self.temp_dir)
        
        assert store is not None
        assert store.project_path == self.temp_dir
