"""测试数据校验模块"""

import numpy as np
import pytest

from reverb_batch_processor.models import MeasurementData, UnitType, ValidationStatus
from reverb_batch_processor.validator import (
    DataValidator, ValidationConfig, validate_measurement
)


class TestValidationConfig:
    """测试校验配置"""

    def test_default_config(self):
        """测试默认配置"""
        config = ValidationConfig()

        assert config.min_sample_rate == 1.0
        assert config.max_sample_rate == 100000.0
        assert config.min_spl == -100.0
        assert config.max_spl == 160.0
        assert config.clipping_threshold == 150.0
        assert config.noise_floor_max_db == 40.0
        assert config.snr_min_db == 15.0

    def test_custom_config(self):
        """测试自定义配置"""
        config = ValidationConfig(
            clipping_threshold=140.0,
            snr_min_db=20.0,
            min_decay_range_db=35.0
        )

        assert config.clipping_threshold == 140.0
        assert config.snr_min_db == 20.0
        assert config.min_decay_range_db == 35.0


class TestDataValidator:
    """测试数据校验器"""

    def _create_test_data(self, spl: np.ndarray, sample_rate: float = 100.0) -> MeasurementData:
        """创建测试数据"""
        time = np.linspace(0, len(spl) / sample_rate, len(spl))
        return MeasurementData(
            time=time,
            spl=spl,
            sample_rate=sample_rate,
            unit=UnitType.DB_A
        )

    def test_validate_sample_rate_normal(self):
        """测试正常采样率"""
        spl = np.linspace(90.0, 40.0, 500)
        data = self._create_test_data(spl, sample_rate=100.0)

        validator = DataValidator()
        result = validator.validate(data)

        assert result.status == ValidationStatus.PASS

    def test_validate_sample_rate_too_low(self):
        """测试采样率过低"""
        spl = np.linspace(90.0, 40.0, 10)
        data = self._create_test_data(spl, sample_rate=0.5)

        validator = DataValidator()
        result = validator.validate(data)

        assert result.status == ValidationStatus.FAIL
        assert any("采样率过低" in msg for msg in result.messages)

    def test_validate_clipping(self):
        """测试削波检测"""
        spl = np.concatenate([
            np.full(50, 155.0),
            np.linspace(150.0, 40.0, 450)
        ])
        data = self._create_test_data(spl)

        validator = DataValidator()
        result = validator.validate(data)

        assert result.status == ValidationStatus.FAIL
        assert any("削波" in msg for msg in result.messages)

    def test_validate_high_noise_floor(self):
        """测试高噪声底"""
        spl = np.linspace(60.0, 50.0, 500)
        noise = np.random.normal(0, 2.0, 500)
        spl += noise

        data = self._create_test_data(spl)

        validator = DataValidator()
        result = validator.validate(data)

        assert any("噪声" in msg.lower() for msg in result.messages)

    def test_validate_missing_data(self):
        """测试缺失数据"""
        spl = np.linspace(90.0, 40.0, 500, dtype=np.float64)
        missing_indices = np.random.choice(500, 50, replace=False)
        spl[missing_indices] = np.nan

        data = self._create_test_data(spl)

        validator = DataValidator()
        result = validator.validate(data)

        assert any("缺失" in msg for msg in result.messages)

    def test_validate_insufficient_decay(self):
        """测试衰减范围不足"""
        spl = np.linspace(90.0, 75.0, 500)
        data = self._create_test_data(spl)

        validator = DataValidator()
        result = validator.validate(data)

        assert result.status == ValidationStatus.FAIL
        assert any("衰减范围不足" in msg for msg in result.messages)

    def test_validate_time_axis_non_monotonic(self):
        """测试时间轴非单调"""
        spl = np.linspace(90.0, 40.0, 500)
        time = np.linspace(0, 5.0, 500)
        time[100] = time[99]

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=100.0,
            unit=UnitType.DB_A
        )

        validator = DataValidator()
        result = validator.validate(data)

        assert any("非递增" in msg for msg in result.messages)

    def test_validate_spl_out_of_range(self):
        """测试声压级超出范围"""
        spl = np.linspace(90.0, 40.0, 500)
        spl[0] = 170.0

        data = self._create_test_data(spl)

        validator = DataValidator()
        result = validator.validate(data)

        assert result.status == ValidationStatus.FAIL
        assert any("超出上限" in msg for msg in result.messages)


class TestValidateMeasurementFunction:
    """测试便捷函数"""

    def test_function_call(self):
        """测试函数调用"""
        spl = np.linspace(90.0, 40.0, 500)
        time = np.linspace(0, 5.0, 500)

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=100.0,
            unit=UnitType.DB_A
        )

        result = validate_measurement(data)

        assert result is not None
        assert result.status in [ValidationStatus.PASS, ValidationStatus.WARNING]

    def test_with_custom_config(self):
        """测试自定义配置"""
        spl = np.linspace(90.0, 40.0, 500)
        time = np.linspace(0, 5.0, 500)

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=100.0,
            unit=UnitType.DB_A
        )

        config = ValidationConfig(
            clipping_threshold=140.0,
            snr_min_db=20.0
        )

        result = validate_measurement(data, config)

        assert result is not None
