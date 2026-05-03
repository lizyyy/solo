"""存储模块测试。"""

import pytest
import json
from pathlib import Path
from datetime import datetime

from fits_quality_checker.models.models import (
    ObservationConfig,
    FITSMetadata,
    FileType,
    FileStatus,
    QualityResult,
    AnalysisResult,
    ImageQualityMetrics,
)
from fits_quality_checker.storage.config import ConfigManager
from fits_quality_checker.storage.persistence import DataStore


class TestConfigManager:
    """ConfigManager配置管理器测试。"""

    def test_init_workspace(self, temp_workspace):
        """测试初始化工作空间。"""
        manager = ConfigManager(str(temp_workspace))
        manager.init_workspace()

        config_dir = temp_workspace / ".fitsqc" / "configs"
        assert config_dir.exists()
        assert config_dir.is_dir()

    def test_create_config(self, temp_workspace):
        """测试创建配置。"""
        manager = ConfigManager(str(temp_workspace))

        config = manager.create_config(
            config_name="test",
            observer="Test Observer",
            telescope="Test Telescope",
            focal_length=2000.0,
            pixel_size=3.76,
            target_name="M42",
            expected_temperature=-10.0,
        )

        assert config.config_name == "test"
        assert config.observer == "Test Observer"
        assert config.telescope == "Test Telescope"
        assert config.focal_length == 2000.0
        assert config.pixel_size == 3.76
        assert config.target_name == "M42"
        assert config.expected_temperature == -10.0

    def test_save_and_load_config(self, temp_workspace, sample_config):
        """测试保存和加载配置。"""
        manager = ConfigManager(str(temp_workspace))
        manager.init_workspace()

        saved_path = manager.save_config(sample_config)
        assert Path(saved_path).exists()

        loaded = manager.load_config(sample_config.config_name)
        assert loaded.config_name == sample_config.config_name
        assert loaded.observer == sample_config.observer
        assert loaded.telescope == sample_config.telescope

    def test_list_configs(self, temp_workspace, sample_config):
        """测试列出配置。"""
        manager = ConfigManager(str(temp_workspace))
        manager.init_workspace()

        configs = manager.list_configs()
        assert configs == []

        manager.save_config(sample_config)

        configs = manager.list_configs()
        assert len(configs) == 1
        assert sample_config.config_name in configs

    def test_delete_config(self, temp_workspace, sample_config):
        """测试删除配置。"""
        manager = ConfigManager(str(temp_workspace))
        manager.init_workspace()

        manager.save_config(sample_config)
        assert len(manager.list_configs()) == 1

        manager.delete_config(sample_config.config_name)
        assert manager.list_configs() == []

    def test_get_default_config(self, temp_workspace):
        """测试获取默认配置。"""
        manager = ConfigManager(str(temp_workspace))

        default = manager.get_default_config()
        assert default.config_name == "default"
        assert default.temperature_tolerance == 0.5
        assert default.fwhm_threshold == 3.0

    def test_save_config_overwrite_false(self, temp_workspace, sample_config):
        """测试不覆盖保存配置。"""
        manager = ConfigManager(str(temp_workspace))
        manager.init_workspace()

        manager.save_config(sample_config)

        with pytest.raises(FileExistsError):
            manager.save_config(sample_config, overwrite=False)

    def test_save_config_overwrite_true(self, temp_workspace, sample_config):
        """测试覆盖保存配置。"""
        manager = ConfigManager(str(temp_workspace))
        manager.init_workspace()

        manager.save_config(sample_config)

        sample_config.observer = "Updated Observer"
        saved_path = manager.save_config(sample_config, overwrite=True)

        loaded = manager.load_config(sample_config.config_name)
        assert loaded.observer == "Updated Observer"


class TestDataStore:
    """DataStore数据存储测试。"""

    def test_init_workspace(self, temp_workspace):
        """测试初始化工作空间。"""
        store = DataStore(str(temp_workspace))
        store.init_workspace()

        data_dir = temp_workspace / ".fitsqc" / "data"
        assert data_dir.exists()
        assert data_dir.is_dir()

    def test_save_and_load_metadata(self, temp_workspace, sample_metadata_batch):
        """测试保存和加载元数据。"""
        store = DataStore(str(temp_workspace))
        store.init_workspace()

        saved_path = store.save_metadata(sample_metadata_batch, "test")
        assert Path(saved_path).exists()

        loaded = store.load_metadata("test")
        assert len(loaded) == len(sample_metadata_batch)
        assert loaded[0].file_path == sample_metadata_batch[0].file_path

    def test_save_and_load_results(self, temp_workspace, sample_config):
        """测试保存和加载质量结果。"""
        from fits_quality_checker.models.models import QualityResult

        store = DataStore(str(temp_workspace))
        store.init_workspace()

        results = [
            QualityResult(
                file_path="/test1.fits",
                file_name="test1.fits",
                file_type=FileType.LIGHT,
                status=FileStatus.KEEP,
                overall_score=85.0,
            ),
            QualityResult(
                file_path="/test2.fits",
                file_name="test2.fits",
                file_type=FileType.DARK,
                status=FileStatus.ISOLATE,
                overall_score=55.0,
            ),
        ]

        saved_path = store.save_results(results, "test")
        assert Path(saved_path).exists()

        loaded = store.load_results("test")
        assert len(loaded) == 2
        assert loaded[0].file_path == "/test1.fits"
        assert loaded[0].status == FileStatus.KEEP

    def test_save_and_load_analysis(self, temp_workspace, sample_config):
        """测试保存和加载分析结果。"""
        store = DataStore(str(temp_workspace))
        store.init_workspace()

        analysis = AnalysisResult(
            config_name="test",
            total_files=50,
            light_files=40,
            dark_files=10,
            keep_count=45,
            isolate_count=3,
            retry_count=2,
            results=[],
            summary={"avg_fwhm": 2.3},
        )

        saved_path = store.save_analysis(analysis, "test")
        assert Path(saved_path).exists()

        loaded = store.load_analysis("test")
        assert loaded.config_name == "test"
        assert loaded.total_files == 50
        assert loaded.summary == {"avg_fwhm": 2.3}

    def test_list_saved_data(self, temp_workspace, sample_metadata_batch):
        """测试列出已保存的数据。"""
        store = DataStore(str(temp_workspace))
        store.init_workspace()

        assert store.list_metadata() == []

        store.save_metadata(sample_metadata_batch, "test1")
        store.save_metadata(sample_metadata_batch, "test2")

        saved = store.list_metadata()
        assert len(saved) == 2
        assert "test1" in saved
        assert "test2" in saved

    def test_export_to_csv(self, temp_workspace, sample_config):
        """测试导出为CSV。"""
        from fits_quality_checker.models.models import QualityResult, ImageQualityMetrics

        store = DataStore(str(temp_workspace))
        store.init_workspace()

        results = [
            QualityResult(
                file_path="/test1.fits",
                file_name="test1.fits",
                file_type=FileType.LIGHT,
                status=FileStatus.KEEP,
                overall_score=85.0,
                metrics=ImageQualityMetrics(
                    file_path="/test1.fits",
                    fwhm=2.5,
                    roundness=0.9,
                    background_noise=8.0,
                ),
            ),
        ]

        csv_path = store.export_to_csv(results, temp_workspace / "test.csv")
        assert csv_path.exists()

        with open(csv_path, "r") as f:
            content = f.read()
            assert "test1.fits" in content
            assert "KEEP" in content

    def test_load_nonexistent_metadata(self, temp_workspace):
        """测试加载不存在的元数据。"""
        store = DataStore(str(temp_workspace))
        store.init_workspace()

        with pytest.raises(FileNotFoundError):
            store.load_metadata("nonexistent")

    def test_load_nonexistent_analysis(self, temp_workspace):
        """测试加载不存在的分析结果。"""
        store = DataStore(str(temp_workspace))
        store.init_workspace()

        with pytest.raises(FileNotFoundError):
            store.load_analysis("nonexistent")
