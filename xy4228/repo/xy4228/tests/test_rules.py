"""规则引擎测试。"""

import pytest

from fits_quality_checker.models.models import (
    FITSMetadata,
    FileType,
    ImageQualityMetrics,
    FileStatus,
)
from fits_quality_checker.rules.rules import (
    BaseRule,
    CloudRule,
    StarTrailRule,
    ExposureMatchRule,
    FilterMatchRule,
    TemperatureMatchRule,
)
from fits_quality_checker.rules.engine import RulesEngine


class TestBaseRule:
    """BaseRule基类测试。"""

    def test_abstract_class(self):
        """测试基类是抽象的。"""
        with pytest.raises(TypeError):
            BaseRule()


class TestCloudRule:
    """CloudRule云检测规则测试。"""

    def test_cloud_detected_high_noise(self, sample_config):
        """测试高噪声云检测。"""
        rule = CloudRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
        )

        metrics = ImageQualityMetrics(
            file_path="/test.fits",
            background_noise=sample_config.noise_threshold * 3,
            star_count=5,
            median_flux=100.0,
        )

        result = rule.evaluate(metadata, metrics)
        assert result.rule_name == "CloudDetection"
        assert result.passed is False

    def test_cloud_detected_low_stars(self, sample_config):
        """测试少星云检测。"""
        rule = CloudRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
        )

        metrics = ImageQualityMetrics(
            file_path="/test.fits",
            background_noise=sample_config.noise_threshold * 0.5,
            star_count=2,
            median_flux=100.0,
        )

        result = rule.evaluate(metadata, metrics)
        assert result.passed is False

    def test_no_cloud(self, sample_config):
        """测试无云情况。"""
        rule = CloudRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
        )

        metrics = ImageQualityMetrics(
            file_path="/test.fits",
            background_noise=sample_config.noise_threshold * 0.5,
            star_count=100,
            median_flux=1000.0,
        )

        result = rule.evaluate(metadata, metrics)
        assert result.passed is True

    def test_dark_file_skipped(self, sample_config):
        """测试暗场文件被跳过。"""
        rule = CloudRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.DARK,
        )

        metrics = ImageQualityMetrics(
            file_path="/test.fits",
            background_noise=sample_config.noise_threshold * 3,
            star_count=0,
            median_flux=10.0,
        )

        result = rule.evaluate(metadata, metrics)
        assert result.passed is True


class TestStarTrailRule:
    """StarTrailRule星点拖线规则测试。"""

    def test_trail_detected_low_roundness(self, sample_config):
        """测试低圆度拖线检测。"""
        rule = StarTrailRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
        )

        metrics = ImageQualityMetrics(
            file_path="/test.fits",
            roundness=sample_config.roundness_threshold * 0.5,
            fwhm=sample_config.fwhm_threshold * 0.5,
        )

        result = rule.evaluate(metadata, metrics)
        assert result.passed is False

    def test_trail_detected_high_fwhm(self, sample_config):
        """测试高FWHM拖线检测。"""
        rule = StarTrailRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
        )

        metrics = ImageQualityMetrics(
            file_path="/test.fits",
            roundness=sample_config.roundness_threshold * 1.1,
            fwhm=sample_config.fwhm_threshold * 2,
        )

        result = rule.evaluate(metadata, metrics)
        assert result.passed is False

    def test_no_trail(self, sample_config):
        """测试无拖线情况。"""
        rule = StarTrailRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
        )

        metrics = ImageQualityMetrics(
            file_path="/test.fits",
            roundness=sample_config.roundness_threshold * 1.1,
            fwhm=sample_config.fwhm_threshold * 0.8,
        )

        result = rule.evaluate(metadata, metrics)
        assert result.passed is True

    def test_dark_file_skipped(self, sample_config):
        """测试暗场文件被跳过。"""
        rule = StarTrailRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.DARK,
        )

        metrics = ImageQualityMetrics(
            file_path="/test.fits",
            roundness=0.3,
            fwhm=10.0,
        )

        result = rule.evaluate(metadata, metrics)
        assert result.passed is True


class TestExposureMatchRule:
    """ExposureMatchRule曝光匹配规则测试。"""

    def test_exposure_match(self, sample_config):
        """测试曝光匹配。"""
        sample_config.expected_exposures = {"L": 10}
        rule = ExposureMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
            filter_name="L",
            exposure_time=300.0,
        )

        group_metadatas = [
            FITSMetadata(
                file_path=f"/test{i}.fits",
                file_name=f"test{i}.fits",
                file_type=FileType.LIGHT,
                filter_name="L",
                exposure_time=300.0,
            )
            for i in range(10)
        ]

        result = rule.evaluate(metadata, None, group_metadatas=group_metadatas)
        assert result.passed is True

    def test_exposure_mismatch(self, sample_config):
        """测试曝光不匹配。"""
        sample_config.expected_exposures = {"L": 10}
        rule = ExposureMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
            filter_name="L",
            exposure_time=150.0,
        )

        group_metadatas = [
            FITSMetadata(
                file_path=f"/test{i}.fits",
                file_name=f"test{i}.fits",
                file_type=FileType.LIGHT,
                filter_name="L",
                exposure_time=300.0,
            )
            for i in range(5)
        ]
        group_metadatas.append(metadata)

        result = rule.evaluate(metadata, None, group_metadatas=group_metadatas)
        assert result.passed is False

    def test_no_expected_exposures(self, sample_config):
        """测试无期望曝光配置。"""
        sample_config.expected_exposures = {}
        rule = ExposureMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
        )

        result = rule.evaluate(metadata, None, group_metadatas=[])
        assert result.passed is True


class TestFilterMatchRule:
    """FilterMatchRule滤镜匹配规则测试。"""

    def test_filter_in_expected(self, sample_config):
        """测试滤镜在期望列表中。"""
        sample_config.expected_exposures = {"L": 10, "R": 5, "G": 5, "B": 5}
        rule = FilterMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
            filter_name="L",
        )

        result = rule.evaluate(metadata, None)
        assert result.passed is True

    def test_filter_not_in_expected(self, sample_config):
        """测试滤镜不在期望列表中。"""
        sample_config.expected_exposures = {"L": 10, "R": 5}
        rule = FilterMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
            filter_name="Ha",
        )

        result = rule.evaluate(metadata, None)
        assert result.passed is False

    def test_no_expected_filters(self, sample_config):
        """测试无期望滤镜配置。"""
        sample_config.expected_exposures = {}
        rule = FilterMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.LIGHT,
            filter_name="Ha",
        )

        result = rule.evaluate(metadata, None)
        assert result.passed is True

    def test_non_light_skipped(self, sample_config):
        """测试非光场文件被跳过。"""
        rule = FilterMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.DARK,
            filter_name="Unknown",
        )

        result = rule.evaluate(metadata, None)
        assert result.passed is True


class TestTemperatureMatchRule:
    """TemperatureMatchRule温度匹配规则测试。"""

    def test_temperature_match(self, sample_config):
        """测试温度匹配。"""
        sample_config.expected_temperature = -10.0
        rule = TemperatureMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.DARK,
            temperature=-10.1,
        )

        result = rule.evaluate(metadata, None)
        assert result.passed is True

    def test_temperature_mismatch(self, sample_config):
        """测试温度不匹配。"""
        sample_config.expected_temperature = -10.0
        sample_config.temperature_tolerance = 0.5
        rule = TemperatureMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.DARK,
            temperature=-8.0,
        )

        result = rule.evaluate(metadata, None)
        assert result.passed is False

    def test_no_expected_temperature(self, sample_config):
        """测试无期望温度配置。"""
        sample_config.expected_temperature = None
        rule = TemperatureMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.DARK,
            temperature=-5.0,
        )

        result = rule.evaluate(metadata, None)
        assert result.passed is True

    def test_no_temperature_data(self, sample_config):
        """测试无温度数据。"""
        sample_config.expected_temperature = -10.0
        rule = TemperatureMatchRule(sample_config)

        metadata = FITSMetadata(
            file_path="/test.fits",
            file_name="test.fits",
            file_type=FileType.DARK,
            temperature=None,
        )

        result = rule.evaluate(metadata, None)
        assert result.passed is True


class TestRulesEngine:
    """RulesEngine规则引擎测试。"""

    def test_engine_creation(self, sample_config):
        """测试引擎创建。"""
        engine = RulesEngine(sample_config)
        assert engine.config == sample_config
        assert len(engine.rules) > 0

    def test_batch_evaluate(self, sample_config, sample_metadata_batch):
        """测试批量评估。"""
        engine = RulesEngine(sample_config)

        metrics_dict = {}
        for m in sample_metadata_batch:
            metrics_dict[m.file_path] = ImageQualityMetrics(
                file_path=m.file_path,
                fwhm=2.5,
                roundness=0.9,
                background_noise=8.0,
            )

        results = engine.batch_evaluate(sample_metadata_batch, metrics_dict)

        assert len(results) == len(sample_metadata_batch)
        for r in results:
            assert r.file_path is not None
            assert r.status is not None

    def test_get_statistics(self, sample_config):
        """测试获取统计。"""
        from fits_quality_checker.models.models import QualityResult

        engine = RulesEngine(sample_config)

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
                file_type=FileType.LIGHT,
                status=FileStatus.ISOLATE,
                overall_score=55.0,
            ),
            QualityResult(
                file_path="/test3.fits",
                file_name="test3.fits",
                file_type=FileType.DARK,
                status=FileStatus.RETRY,
                overall_score=25.0,
            ),
        ]

        stats = engine.get_statistics(results)

        assert stats["total"] == 3
        assert stats["by_status"]["keep"] == 1
        assert stats["by_status"]["isolate"] == 1
        assert stats["by_status"]["retry"] == 1
        assert stats["avg_score"] == pytest.approx(55.0, rel=1e-9)

    def test_scoring_logic(self, sample_config):
        """测试评分逻辑。"""
        engine = RulesEngine(sample_config)

        from fits_quality_checker.rules.rules import RuleResult

        rule_results = [
            RuleResult(
                rule_name="CloudDetection",
                rule_type="quality",
                passed=True,
                message="OK",
            ),
            RuleResult(
                rule_name="StarTrailDetection",
                rule_type="quality",
                passed=True,
                message="OK",
            ),
            RuleResult(
                rule_name="TemperatureMatch",
                rule_type="temperature",
                passed=True,
                message="OK",
            ),
        ]

        score, issues, recommendations = engine._calculate_score_and_issues(rule_results)

        assert score > 80
        assert issues == []

    def test_failed_rule_scoring(self, sample_config):
        """测试失败规则的评分。"""
        engine = RulesEngine(sample_config)

        from fits_quality_checker.rules.rules import RuleResult

        rule_results = [
            RuleResult(
                rule_name="CloudDetection",
                rule_type="quality",
                passed=False,
                message="检测到云",
                severity="error",
            ),
            RuleResult(
                rule_name="StarTrailDetection",
                rule_type="quality",
                passed=True,
                message="OK",
            ),
        ]

        score, issues, recommendations = engine._calculate_score_and_issues(rule_results)

        assert score < 70
        assert len(issues) > 0
        assert "云" in "".join(issues)
