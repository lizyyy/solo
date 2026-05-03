"""测试声学指标计算"""

import numpy as np
import pytest

from reverb_batch_processor.models import MeasurementData, UnitType
from reverb_batch_processor.acoustics import (
    SchroederIntegrator, ReverbTimeCalculator,
    AcousticsConfig, compute_acoustic_metrics
)


class TestSchroederIntegrator:
    """测试Schroeder积分"""

    def test_basic_decay(self):
        """测试基本衰减曲线"""
        sample_rate = 100.0
        duration = 5.0
        rt60 = 1.0

        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        decay_rate = 60.0 / rt60
        peak_spl = 90.0
        spl = peak_spl - decay_rate * time

        noise_floor = 35.0
        noise_floor_linear = 10 ** (noise_floor / 20)
        spl_linear = 10 ** (spl / 20)
        spl_linear = np.maximum(spl_linear, noise_floor_linear)
        spl = 10 * np.log10(spl_linear)

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=sample_rate,
            unit=UnitType.DB_A
        )

        integrator = SchroederIntegrator()
        schroeder_time, schroeder_curve, metadata = integrator.compute(data)

        assert len(schroeder_time) == len(schroeder_curve)
        assert len(schroeder_time) > 0
        assert metadata['peak_spl'] > 0
        assert 'noise_floor' in metadata


class TestReverbTimeCalculator:
    """测试混响时间计算"""

    def test_ideal_decay(self):
        """测试理想衰减曲线"""
        sample_rate = 100.0
        duration = 5.0
        target_rt60 = 1.5

        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        decay_rate = 60.0 / target_rt60
        peak_spl = 90.0
        spl = peak_spl - decay_rate * time

        noise = np.random.normal(0, 0.3, num_samples)
        spl += noise

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=sample_rate,
            unit=UnitType.DB_A
        )

        calculator = ReverbTimeCalculator()
        metrics = calculator.compute_metrics(data)

        assert metrics.rt20 is not None
        assert metrics.rt30 is not None
        assert metrics.edt is not None

        assert abs(metrics.rt20.rt_value - target_rt60) < 0.2
        assert abs(metrics.rt30.rt_value - target_rt60) < 0.2

    def test_confidence_calculation(self):
        """测试置信度计算"""
        sample_rate = 100.0
        duration = 5.0
        target_rt60 = 1.2

        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        decay_rate = 60.0 / target_rt60
        peak_spl = 90.0
        spl = peak_spl - decay_rate * time

        noise = np.random.normal(0, 0.2, num_samples)
        spl += noise

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=sample_rate,
            unit=UnitType.DB_A
        )

        calculator = ReverbTimeCalculator()
        metrics = calculator.compute_metrics(data)

        assert metrics.rt30 is not None
        assert 0.0 <= metrics.rt30.confidence <= 1.0
        assert metrics.rt30.r_squared > 0.9

    def test_clarity_metrics(self):
        """测试清晰度指标"""
        sample_rate = 100.0
        duration = 5.0
        target_rt60 = 1.0

        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        decay_rate = 60.0 / target_rt60
        peak_spl = 90.0
        spl = peak_spl - decay_rate * time

        noise = np.random.normal(0, 0.3, num_samples)
        spl += noise

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=sample_rate,
            unit=UnitType.DB_A
        )

        calculator = ReverbTimeCalculator()
        metrics = calculator.compute_metrics(data)

        assert metrics.c80 is not None
        assert metrics.d50 is not None
        assert metrics.center_time is not None


class TestComputeAcousticMetrics:
    """测试便捷函数"""

    def test_function_call(self):
        """测试函数调用"""
        sample_rate = 100.0
        duration = 3.0
        target_rt60 = 0.8

        num_samples = int(duration * sample_rate)
        time = np.linspace(0, duration, num_samples)

        decay_rate = 60.0 / target_rt60
        peak_spl = 85.0
        spl = peak_spl - decay_rate * time

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=sample_rate,
            unit=UnitType.DB_A
        )

        metrics = compute_acoustic_metrics(data)

        assert metrics is not None
        assert metrics.rt30 is not None


class TestAcousticsConfig:
    """测试配置"""

    def test_default_config(self):
        """测试默认配置"""
        config = AcousticsConfig()

        assert config.edt_range_db == (0.0, -10.0)
        assert config.rt20_range_db == (-5.0, -25.0)
        assert config.rt30_range_db == (-5.0, -35.0)
        assert config.min_fit_points == 10

    def test_custom_config(self):
        """测试自定义配置"""
        config = AcousticsConfig(
            rt20_range_db=(-3.0, -23.0),
            rt30_range_db=(-3.0, -33.0),
            min_fit_points=20
        )

        assert config.rt20_range_db == (-3.0, -23.0)
        assert config.min_fit_points == 20
