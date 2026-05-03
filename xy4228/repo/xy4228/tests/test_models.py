"""数据模型测试。"""

import pytest
from datetime import datetime

from fits_quality_checker.models.models import (
    FileStatus,
    FileType,
    ObservationConfig,
    FITSMetadata,
    ImageQualityMetrics,
    RuleResult,
    QualityResult,
    AnalysisResult,
)


class TestFileStatus:
    """FileStatus枚举测试。"""

    def test_values(self):
        """测试枚举值。"""
        assert FileStatus.KEEP.value == "keep"
        assert FileStatus.ISOLATE.value == "isolate"
        assert FileStatus.RETRY.value == "retry"
        assert FileStatus.UNKNOWN.value == "unknown"

    def test_from_string(self):
        """测试从字符串转换。"""
        assert FileStatus("keep") == FileStatus.KEEP
        assert FileStatus("isolate") == FileStatus.ISOLATE
        assert FileStatus("retry") == FileStatus.RETRY
        assert FileStatus("unknown") == FileStatus.UNKNOWN


class TestFileType:
    """FileType枚举测试。"""

    def test_values(self):
        """测试枚举值。"""
        assert FileType.LIGHT.value == "light"
        assert FileType.DARK.value == "dark"
        assert FileType.FLAT.value == "flat"
        assert FileType.BIAS.value == "bias"

    def test_from_string(self):
        """测试从字符串转换。"""
        assert FileType("light") == FileType.LIGHT
        assert FileType("dark") == FileType.DARK
        assert FileType("flat") == FileType.FLAT
        assert FileType("bias") == FileType.BIAS


class TestObservationConfig:
    """ObservationConfig模型测试。"""

    def test_default_values(self):
        """测试默认值。"""
        config = ObservationConfig(config_name="test")
        assert config.config_name == "test"
        assert config.temperature_tolerance == 0.5
        assert config.fwhm_threshold == 3.0
        assert config.roundness_threshold == 0.8
        assert config.noise_threshold == 10.0

    def test_custom_values(self):
        """测试自定义值。"""
        config = ObservationConfig(
            config_name="test",
            observer="Test Observer",
            telescope="Test Telescope",
            camera="Test Camera",
            focal_length=2000.0,
            aperture=203.0,
            pixel_size=3.76,
            target_name="M42",
            expected_exposures={"L": 10, "R": 5},
            expected_temperature=-10.0,
            temperature_tolerance=1.0,
            fwhm_threshold=4.0,
            roundness_threshold=0.7,
            noise_threshold=15.0,
        )
        assert config.observer == "Test Observer"
        assert config.telescope == "Test Telescope"
        assert config.camera == "Test Camera"
        assert config.focal_length == 2000.0
        assert config.aperture == 203.0
        assert config.pixel_size == 3.76
        assert config.target_name == "M42"
        assert config.expected_exposures == {"L": 10, "R": 5}
        assert config.expected_temperature == -10.0
        assert config.temperature_tolerance == 1.0
        assert config.fwhm_threshold == 4.0
        assert config.roundness_threshold == 0.7
        assert config.noise_threshold == 15.0

    def test_json_serialization(self):
        """测试JSON序列化。"""
        config = ObservationConfig(config_name="test")
        json_str = config.model_dump_json()
        assert "config_name" in json_str


class TestFITSMetadata:
    """FITSMetadata模型测试。"""

    def test_creation(self, sample_light_metadata):
        """测试创建。"""
        m = sample_light_metadata
        assert m.file_path == "/data/light_0001.fits"
        assert m.file_name == "light_0001.fits"
        assert m.file_type == FileType.LIGHT
        assert m.exposure_time == 300.0
        assert m.filter_name == "L"
        assert m.temperature == -10.0

    def test_use_enum_values(self):
        """测试枚举值序列化。"""
        m = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.DARK,
        )
        data = m.model_dump()
        assert data["file_type"] == "dark"

    def test_default_import_time(self):
        """测试默认导入时间。"""
        m = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
        )
        assert isinstance(m.import_time, datetime)


class TestImageQualityMetrics:
    """ImageQualityMetrics模型测试。"""

    def test_creation(self):
        """测试创建。"""
        metrics = ImageQualityMetrics(
            file_path="/test.fits",
            fwhm=2.5,
            fwhm_arcsec=1.2,
            roundness=0.92,
            background_noise=8.5,
            star_count=150,
            median_flux=1000.0,
            temperature_deviation=0.2,
        )
        assert metrics.fwhm == 2.5
        assert metrics.fwhm_arcsec == 1.2
        assert metrics.roundness == 0.92
        assert metrics.background_noise == 8.5
        assert metrics.star_count == 150
        assert metrics.median_flux == 1000.0
        assert metrics.temperature_deviation == 0.2

    def test_optional_fields(self):
        """测试可选字段。"""
        metrics = ImageQualityMetrics(file_path="/test.fits")
        assert metrics.fwhm is None
        assert metrics.roundness is None
        assert metrics.background_noise is None


class TestRuleResult:
    """RuleResult模型测试。"""

    def test_creation(self):
        """测试创建。"""
        result = RuleResult(
            rule_name="TemperatureCheck",
            rule_type="temperature",
            passed=True,
            message="温度在容差范围内",
            severity="info",
            details={"actual_temp": -10.0, "expected_temp": -10.0},
        )
        assert result.rule_name == "TemperatureCheck"
        assert result.rule_type == "temperature"
        assert result.passed is True
        assert result.message == "温度在容差范围内"
        assert result.severity == "info"
        assert result.details == {"actual_temp": -10.0, "expected_temp": -10.0}

    def test_default_severity(self):
        """测试默认严重程度。"""
        result = RuleResult(
            rule_name="Test",
            rule_type="test",
            passed=True,
            message="Test",
        )
        assert result.severity == "warning"


class TestQualityResult:
    """QualityResult模型测试。"""

    def test_creation(self, sample_light_metadata):
        """测试创建。"""
        result = QualityResult(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
            status=FileStatus.KEEP,
            overall_score=85.5,
            issues=[],
            recommendations=["可以用于叠加"],
            metadata=sample_light_metadata,
        )
        assert result.file_path == "/test.fits"
        assert result.status == FileStatus.KEEP
        assert result.overall_score == 85.5
        assert result.issues == []
        assert result.recommendations == ["可以用于叠加"]

    def test_default_status(self):
        """测试默认状态。"""
        result = QualityResult(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
        )
        assert result.status == FileStatus.UNKNOWN


class TestAnalysisResult:
    """AnalysisResult模型测试。"""

    def test_creation(self):
        """测试创建。"""
        result = AnalysisResult(
            config_name="test_config",
            total_files=50,
            light_files=40,
            dark_files=10,
            flat_files=0,
            keep_count=45,
            isolate_count=3,
            retry_count=2,
            unknown_count=0,
            results=[],
            summary={"avg_fwhm": 2.3, "avg_roundness": 0.91},
        )
        assert result.config_name == "test_config"
        assert result.total_files == 50
        assert result.light_files == 40
        assert result.dark_files == 10
        assert result.flat_files == 0
        assert result.keep_count == 45
        assert result.isolate_count == 3
        assert result.retry_count == 2
        assert result.summary == {"avg_fwhm": 2.3, "avg_roundness": 0.91}

    def test_default_values(self):
        """测试默认值。"""
        result = AnalysisResult(config_name="test")
        assert result.total_files == 0
        assert result.light_files == 0
        assert result.dark_files == 0
        assert result.flat_files == 0
        assert result.keep_count == 0
        assert result.isolate_count == 0
        assert result.retry_count == 0
        assert result.unknown_count == 0
        assert result.results == []
        assert result.summary == {}
