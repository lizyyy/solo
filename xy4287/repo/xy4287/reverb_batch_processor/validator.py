"""数据校验模块"""

from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Any

import numpy as np

from .models import (
    MeasurementData, ValidationResult, ValidationStatus,
    AnomalyType
)


@dataclass
class ValidationConfig:
    """校验配置"""
    min_sample_rate: float = 1.0
    max_sample_rate: float = 100000.0
    expected_sample_rates: Optional[List[float]] = None

    min_spl: float = -100.0
    max_spl: float = 160.0
    clipping_threshold: float = 150.0

    noise_floor_max_db: float = 40.0
    snr_min_db: float = 15.0

    max_missing_ratio: float = 0.05
    max_time_gap_ratio: float = 0.1

    min_decay_range_db: float = 30.0


class DataValidator:
    """数据校验器"""

    def __init__(self, config: Optional[ValidationConfig] = None):
        self.config = config or ValidationConfig()

    def validate(self, data: MeasurementData) -> ValidationResult:
        """
        执行完整的数据校验

        Args:
            data: 测量数据

        Returns:
            校验结果
        """
        result = ValidationResult(status=ValidationStatus.PASS)

        self._validate_sample_rate(data, result)
        self._validate_time_axis(data, result)
        self._validate_spl_range(data, result)
        self._validate_clipping(data, result)
        self._validate_noise_floor(data, result)
        self._validate_missing_data(data, result)
        self._validate_decay_range(data, result)

        return result

    def _validate_sample_rate(self, data: MeasurementData, result: ValidationResult):
        """校验采样率"""
        sr = data.sample_rate

        if sr < self.config.min_sample_rate:
            result.add_error(
                f"采样率过低: {sr:.2f} Hz，最小值: {self.config.min_sample_rate} Hz",
                {'sample_rate': sr, 'min_required': self.config.min_sample_rate}
            )

        if sr > self.config.max_sample_rate:
            result.add_warning(
                f"采样率过高: {sr:.2f} Hz，建议值: < {self.config.max_sample_rate} Hz",
                {'sample_rate': sr, 'max_recommended': self.config.max_sample_rate}
            )

        if self.config.expected_sample_rates:
            matched = any(abs(sr - expected) < 1e-6 for expected in self.config.expected_sample_rates)
            if not matched:
                result.add_warning(
                    f"采样率异常: {sr:.2f} Hz，期望值: {self.config.expected_sample_rates} Hz",
                    {'sample_rate': sr, 'expected': self.config.expected_sample_rates}
                )

    def _validate_time_axis(self, data: MeasurementData, result: ValidationResult):
        """校验时间轴"""
        time = data.time

        if len(time) < 2:
            result.add_error("时间轴数据点不足，至少需要2个点", {'num_points': len(time)})
            return

        diffs = np.diff(time)
        median_diff = np.median(diffs)

        zero_diffs = np.sum(diffs <= 0)
        if zero_diffs > 0:
            result.add_error(
                f"时间轴存在非递增点，共 {zero_diffs} 处",
                {'zero_diff_count': int(zero_diffs)}
            )

        if median_diff <= 0:
            result.add_error("时间轴中位数间隔为0或负数", {'median_diff': median_diff})
            return

        large_gaps = diffs > median_diff * 2.0
        large_gap_count = np.sum(large_gaps)
        if large_gap_count > 0:
            large_gap_ratio = large_gap_count / len(diffs)
            if large_gap_ratio > self.config.max_time_gap_ratio:
                result.add_error(
                    f"时间轴存在过大间隔，共 {large_gap_count} 处，占比 {large_gap_ratio*100:.1f}%",
                    {'large_gap_count': int(large_gap_count), 'ratio': float(large_gap_ratio)}
                )
            else:
                result.add_warning(
                    f"时间轴存在较大间隔，共 {large_gap_count} 处",
                    {'large_gap_count': int(large_gap_count)}
                )

    def _validate_spl_range(self, data: MeasurementData, result: ValidationResult):
        """校验声压级范围"""
        spl = data.spl
        valid_spl = spl[~np.isnan(spl)]

        if len(valid_spl) == 0:
            result.add_error("声压级数据全部无效", {'num_points': len(spl)})
            return

        min_spl = np.min(valid_spl)
        max_spl = np.max(valid_spl)

        if min_spl < self.config.min_spl:
            result.add_warning(
                f"声压级低于下限: {min_spl:.1f} dB，下限: {self.config.min_spl} dB",
                {'min_spl': float(min_spl), 'limit': self.config.min_spl}
            )

        if max_spl > self.config.max_spl:
            result.add_error(
                f"声压级超出上限: {max_spl:.1f} dB，上限: {self.config.max_spl} dB",
                {'max_spl': float(max_spl), 'limit': self.config.max_spl}
            )

    def _validate_clipping(self, data: MeasurementData, result: ValidationResult):
        """校验削波"""
        spl = data.spl
        valid_spl = spl[~np.isnan(spl)]

        if len(valid_spl) == 0:
            return

        clipping_threshold = self.config.clipping_threshold
        clipped_points = valid_spl >= clipping_threshold
        clipped_count = np.sum(clipped_points)

        if clipped_count > 0:
            max_spl = np.max(valid_spl)
            result.add_error(
                f"检测到削波: {clipped_count} 个点达到或超过 {clipping_threshold} dB，最大值: {max_spl:.1f} dB",
                {
                    'clipped_count': int(clipped_count),
                    'clipping_threshold': clipping_threshold,
                    'max_spl': float(max_spl)
                }
            )

        plateaus = self._detect_plateaus(valid_spl, plateau_length=5)
        if plateaus:
            result.add_warning(
                f"检测到 {len(plateaus)} 个平台区域，可能存在削波或饱和",
                {'plateau_regions': len(plateaus)}
            )

    def _detect_plateaus(self, signal: np.ndarray, plateau_length: int = 5) -> List[Tuple[int, int]]:
        """检测平台区域"""
        if len(signal) < plateau_length:
            return []

        plateaus = []
        i = 0
        while i < len(signal) - 1:
            if abs(signal[i+1] - signal[i]) < 0.01:
                start = i
                while i < len(signal) - 1 and abs(signal[i+1] - signal[i]) < 0.01:
                    i += 1
                if i - start + 1 >= plateau_length:
                    plateaus.append((start, i))
            i += 1

        return plateaus

    def _validate_noise_floor(self, data: MeasurementData, result: ValidationResult):
        """校验噪声底"""
        spl = data.spl
        valid_spl = spl[~np.isnan(spl)]

        if len(valid_spl) < 10:
            return

        noise_floor = self._estimate_noise_floor(valid_spl)

        if noise_floor > self.config.noise_floor_max_db:
            result.add_warning(
                f"噪声底过高: {noise_floor:.1f} dB，建议值: < {self.config.noise_floor_max_db} dB",
                {'noise_floor': float(noise_floor), 'limit': self.config.noise_floor_max_db}
            )

        max_spl = np.max(valid_spl)
        snr = max_spl - noise_floor

        if snr < self.config.snr_min_db:
            result.add_error(
                f"信噪比过低: {snr:.1f} dB，最小值: {self.config.snr_min_db} dB",
                {'snr': float(snr), 'min_required': self.config.snr_min_db}
            )

        result.details['noise_floor'] = float(noise_floor)
        result.details['snr'] = float(snr)

    def _estimate_noise_floor(self, spl: np.ndarray) -> float:
        """估计噪声底"""
        if len(spl) < 20:
            return np.percentile(spl, 10)

        sorted_spl = np.sort(spl)
        lowest_10_percent = sorted_spl[:int(len(sorted_spl) * 0.1)]

        if len(lowest_10_percent) > 0:
            return float(np.median(lowest_10_percent))

        return float(np.percentile(spl, 10))

    def _validate_missing_data(self, data: MeasurementData, result: ValidationResult):
        """校验缺失数据"""
        spl = data.spl

        total_points = len(spl)
        nan_count = np.sum(np.isnan(spl))
        missing_ratio = nan_count / total_points if total_points > 0 else 0

        if missing_ratio > self.config.max_missing_ratio:
            result.add_error(
                f"数据缺失严重: {nan_count}/{total_points} ({missing_ratio*100:.1f}%)，阈值: {self.config.max_missing_ratio*100}%",
                {
                    'missing_count': int(nan_count),
                    'total_count': total_points,
                    'missing_ratio': float(missing_ratio)
                }
            )
        elif missing_ratio > 0:
            result.add_warning(
                f"存在数据缺失: {nan_count}/{total_points} ({missing_ratio*100:.1f}%)",
                {'missing_count': int(nan_count), 'missing_ratio': float(missing_ratio)}
            )

        result.details['missing_ratio'] = float(missing_ratio)

    def _validate_decay_range(self, data: MeasurementData, result: ValidationResult):
        """校验衰减范围"""
        spl = data.spl
        valid_spl = spl[~np.isnan(spl)]

        if len(valid_spl) < 10:
            return

        peak_idx = np.argmax(valid_spl)
        peak_spl = valid_spl[peak_idx]

        if peak_idx >= len(valid_spl) - 1:
            result.add_warning("峰值出现在数据末尾，无法计算衰减", {'peak_index': int(peak_idx)})
            return

        decay_spl = valid_spl[peak_idx:]
        decay_range = peak_spl - np.min(decay_spl)

        if decay_range < self.config.min_decay_range_db:
            result.add_error(
                f"衰减范围不足: {decay_range:.1f} dB，最小值: {self.config.min_decay_range_db} dB",
                {
                    'decay_range': float(decay_range),
                    'min_required': self.config.min_decay_range_db,
                    'peak_spl': float(peak_spl),
                    'min_decay_spl': float(np.min(decay_spl))
                }
            )

        result.details['decay_range'] = float(decay_range)
        result.details['peak_spl'] = float(peak_spl)


def validate_measurement(
    data: MeasurementData,
    config: Optional[ValidationConfig] = None
) -> ValidationResult:
    """
    校验测量数据的便捷函数

    Args:
        data: 测量数据
        config: 校验配置

    Returns:
        校验结果
    """
    validator = DataValidator(config)
    return validator.validate(data)
