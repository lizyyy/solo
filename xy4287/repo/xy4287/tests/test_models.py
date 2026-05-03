"""测试数据模型"""

import numpy as np
import pytest

from reverb_batch_processor.models import (
    MeasurementData, UnitType, ValidationStatus,
    ValidationResult, AnomalyType, FitResult
)


class TestMeasurementData:
    """测试测量数据模型"""

    def test_creation(self):
        """测试创建测量数据"""
        time = np.array([0.0, 0.01, 0.02, 0.03, 0.04])
        spl = np.array([90.0, 85.0, 80.0, 75.0, 70.0])

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=100.0,
            unit=UnitType.DB_A
        )

        assert data.num_samples == 5
        assert data.duration == 0.04
        assert data.sample_rate == 100.0
        assert data.unit == UnitType.DB_A

    def test_duration_calculation(self):
        """测试持续时间计算"""
        time = np.array([0.0, 0.5, 1.0, 1.5, 2.0])
        spl = np.array([90.0, 85.0, 80.0, 75.0, 70.0])

        data = MeasurementData(
            time=time,
            spl=spl,
            sample_rate=2.0,
            unit=UnitType.DB
        )

        assert data.duration == 2.0
        assert data.num_samples == 5


class TestValidationResult:
    """测试校验结果"""

    def test_initial_state(self):
        """测试初始状态"""
        result = ValidationResult(status=ValidationStatus.PASS)

        assert result.status == ValidationStatus.PASS
        assert len(result.messages) == 0
        assert len(result.details) == 0

    def test_add_warning(self):
        """测试添加警告"""
        result = ValidationResult(status=ValidationStatus.PASS)

        result.add_warning("测试警告消息", {'detail': 'test'})

        assert result.status == ValidationStatus.WARNING
        assert len(result.messages) == 1
        assert '测试警告消息' in result.messages[0]
        assert result.details['detail'] == 'test'

    def test_add_error(self):
        """测试添加错误"""
        result = ValidationResult(status=ValidationStatus.PASS)

        result.add_error("测试错误消息", {'error_code': 123})

        assert result.status == ValidationStatus.FAIL
        assert len(result.messages) == 1
        assert '测试错误消息' in result.messages[0]
        assert result.details['error_code'] == 123

    def test_error_overrides_warning(self):
        """测试错误覆盖警告"""
        result = ValidationResult(status=ValidationStatus.PASS)

        result.add_warning("警告消息")
        assert result.status == ValidationStatus.WARNING

        result.add_error("错误消息")
        assert result.status == ValidationStatus.FAIL


class TestFitResult:
    """测试拟合结果"""

    def test_creation(self):
        """测试创建拟合结果"""
        fit = FitResult(
            rt_value=1.234,
            confidence=0.95,
            fit_start_db=85.0,
            fit_end_db=55.0,
            fit_start_time=0.1,
            fit_end_time=2.5,
            slope=-24.3,
            intercept=87.5,
            r_squared=0.987
        )

        assert fit.rt_value == 1.234
        assert fit.confidence == 0.95
        assert fit.r_squared == 0.987
        assert len(fit.anomalies) == 0
        assert len(fit.anomaly_reasons) == 0

    def test_with_anomalies(self):
        """测试带异常的拟合结果"""
        fit = FitResult(
            rt_value=0.8,
            confidence=0.75,
            fit_start_db=85.0,
            fit_end_db=55.0,
            fit_start_time=0.1,
            fit_end_time=2.0,
            slope=-30.0,
            intercept=88.0,
            r_squared=0.92,
            anomalies=[AnomalyType.NON_LINEAR_DECAY, AnomalyType.LOW_SNR],
            anomaly_reasons=["拟合度较低", "衰减速率异常"]
        )

        assert len(fit.anomalies) == 2
        assert len(fit.anomaly_reasons) == 2
        assert AnomalyType.NON_LINEAR_DECAY in fit.anomalies


class TestUnitType:
    """测试单位类型"""

    def test_values(self):
        """测试单位类型值"""
        assert UnitType.DB.value == "dB"
        assert UnitType.DB_A.value == "dB(A)"
        assert UnitType.DB_C.value == "dB(C)"
        assert UnitType.DB_Z.value == "dB(Z)"


class TestAnomalyType:
    """测试异常类型"""

    def test_values(self):
        """测试异常类型值"""
        assert AnomalyType.CLIPPING.value == "削波"
        assert AnomalyType.NOISE_FLOOR.value == "噪声底过高"
        assert AnomalyType.MISSING_SEGMENTS.value == "数据缺失"
        assert AnomalyType.MULTIPLE_REFLECTIONS.value == "多次反射干扰"
        assert AnomalyType.NON_LINEAR_DECAY.value == "非线性衰减"
        assert AnomalyType.LOW_SNR.value == "信噪比过低"


class TestValidationStatus:
    """测试校验状态"""

    def test_values(self):
        """测试校验状态值"""
        assert ValidationStatus.PASS.value == "通过"
        assert ValidationStatus.WARNING.value == "警告"
        assert ValidationStatus.FAIL.value == "失败"
