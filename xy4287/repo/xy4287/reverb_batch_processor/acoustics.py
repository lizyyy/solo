"""声学指标计算模块"""

from dataclasses import dataclass
from typing import Optional, Tuple, List, Dict, Any

import numpy as np
from scipy import stats

from .models import (
    MeasurementData, AcousticMetrics, FitResult,
    ValidationResult, ValidationStatus, AnomalyType
)


@dataclass
class AcousticsConfig:
    """声学计算配置"""
    edt_range_db: Tuple[float, float] = (0.0, -10.0)
    rt20_range_db: Tuple[float, float] = (-5.0, -25.0)
    rt30_range_db: Tuple[float, float] = (-5.0, -35.0)

    min_fit_points: int = 10
    min_decay_range_for_rt: float = 25.0

    noise_floor_estimation_window: float = 0.5
    noise_floor_margin_db: float = 5.0

    c80_threshold_ms: float = 80.0
    d50_threshold_ms: float = 50.0


class SchroederIntegrator:
    """Schroeder积分计算器"""

    def __init__(self, config: Optional[AcousticsConfig] = None):
        self.config = config or AcousticsConfig()

    def compute(self, data: MeasurementData) -> Tuple[np.ndarray, np.ndarray, Dict[str, Any]]:
        """
        计算Schroeder积分曲线

        Args:
            data: 测量数据

        Returns:
            (schroeder_time, schroeder_curve, metadata)
        """
        time = data.time
        spl = data.spl

        valid_mask = ~np.isnan(spl)
        time_valid = time[valid_mask]
        spl_valid = spl[valid_mask]

        if len(time_valid) < 10:
            raise ValueError("有效数据点不足，无法计算Schroeder积分")

        peak_idx = np.argmax(spl_valid)
        peak_spl = spl_valid[peak_idx]
        peak_time = time_valid[peak_idx]

        decay_time = time_valid[peak_idx:]
        decay_spl = spl_valid[peak_idx:]

        noise_floor = self._estimate_noise_floor(decay_spl, data.sample_rate)

        decay_linear = 10 ** (decay_spl / 10)

        noise_linear = 10 ** (noise_floor / 10)
        decay_linear_corrected = np.maximum(decay_linear - noise_linear, 0)

        schroeder_linear = np.cumsum(decay_linear_corrected[::-1])[::-1]

        epsilon = 1e-10
        schroeder_db = 10 * np.log10(schroeder_linear + epsilon)

        schroeder_db = schroeder_db - (schroeder_db[0] - peak_spl)

        metadata = {
            'peak_idx': int(peak_idx),
            'peak_time': float(peak_time),
            'peak_spl': float(peak_spl),
            'noise_floor': float(noise_floor),
            'snr': float(peak_spl - noise_floor)
        }

        return decay_time, schroeder_db, metadata

    def _estimate_noise_floor(self, decay_spl: np.ndarray, sample_rate: float) -> float:
        """估计噪声底"""
        window_samples = int(self.config.noise_floor_estimation_window * sample_rate)

        if window_samples < 10:
            window_samples = 10

        if len(decay_spl) < window_samples:
            if len(decay_spl) >= 10:
                return float(np.percentile(decay_spl[-10:], 50))
            return float(np.min(decay_spl))

        tail_samples = decay_spl[-window_samples:]
        noise_floor = np.median(tail_samples)

        return float(noise_floor + self.config.noise_floor_margin_db)


class ReverbTimeCalculator:
    """混响时间计算器"""

    def __init__(self, config: Optional[AcousticsConfig] = None):
        self.config = config or AcousticsConfig()
        self.schroeder = SchroederIntegrator(config)

    def compute_metrics(self, data: MeasurementData) -> AcousticMetrics:
        """
        计算所有声学指标

        Args:
            data: 测量数据

        Returns:
            声学指标结果
        """
        metrics = AcousticMetrics()

        try:
            schroeder_time, schroeder_curve, metadata = self.schroeder.compute(data)
            metrics.schroeder_time = schroeder_time
            metrics.schroeder_curve = schroeder_curve

            metrics.edt = self._calculate_edt(schroeder_time, schroeder_curve)
            metrics.rt20 = self._calculate_rt20(schroeder_time, schroeder_curve)
            metrics.rt30 = self._calculate_rt30(schroeder_time, schroeder_curve)

            c80, d50, center_time = self._calculate_clarity_metrics(data)
            metrics.c80 = c80
            metrics.d50 = d50
            metrics.center_time = center_time

        except Exception as e:
            metrics.validation.add_error(f"声学指标计算失败: {str(e)}")

        return metrics

    def _calculate_edt(
        self,
        time: np.ndarray,
        schroeder: np.ndarray
    ) -> Optional[FitResult]:
        """计算早期衰减时间(EDT)"""
        return self._fit_decay_curve(
            time, schroeder,
            self.config.edt_range_db,
            "EDT",
            decay_multiplier=6.0
        )

    def _calculate_rt20(
        self,
        time: np.ndarray,
        schroeder: np.ndarray
    ) -> Optional[FitResult]:
        """计算RT20"""
        return self._fit_decay_curve(
            time, schroeder,
            self.config.rt20_range_db,
            "RT20",
            decay_multiplier=3.0
        )

    def _calculate_rt30(
        self,
        time: np.ndarray,
        schroeder: np.ndarray
    ) -> Optional[FitResult]:
        """计算RT30"""
        return self._fit_decay_curve(
            time, schroeder,
            self.config.rt30_range_db,
            "RT30",
            decay_multiplier=2.0
        )

    def _fit_decay_curve(
        self,
        time: np.ndarray,
        schroeder: np.ndarray,
        target_range_db: Tuple[float, float],
        metric_name: str,
        decay_multiplier: float
    ) -> Optional[FitResult]:
        """
        拟合衰减曲线

        Args:
            time: 时间轴
            schroeder: Schroeder曲线
            target_range_db: 目标拟合范围 (相对于峰值的dB范围)
            metric_name: 指标名称
            decay_multiplier: 衰减乘数 (EDT:6, RT20:3, RT30:2)

        Returns:
            拟合结果
        """
        peak_db = schroeder[0]

        start_db = peak_db + target_range_db[0]
        end_db = peak_db + target_range_db[1]

        fit_mask = (schroeder <= start_db) & (schroeder >= end_db)

        if np.sum(fit_mask) < self.config.min_fit_points:
            return None

        fit_time = time[fit_mask]
        fit_schroeder = schroeder[fit_mask]

        slope, intercept, r_value, p_value, std_err = stats.linregress(fit_time, fit_schroeder)

        time_to_drop_60db = -60.0 / slope if slope != 0 else np.inf

        actual_start_db = fit_schroeder[0]
        actual_end_db = fit_schroeder[-1]
        actual_start_time = fit_time[0]
        actual_end_time = fit_time[-1]

        confidence = self._calculate_confidence(r_value, fit_time, fit_schroeder, slope)

        anomalies, reasons = self._detect_anomalies(
            fit_time, fit_schroeder, slope, r_value, time, schroeder
        )

        return FitResult(
            rt_value=float(time_to_drop_60db),
            confidence=float(confidence),
            fit_start_db=float(actual_start_db),
            fit_end_db=float(actual_end_db),
            fit_start_time=float(actual_start_time),
            fit_end_time=float(actual_end_time),
            slope=float(slope),
            intercept=float(intercept),
            r_squared=float(r_value ** 2),
            anomalies=anomalies,
            anomaly_reasons=reasons
        )

    def _calculate_confidence(
        self,
        r_value: float,
        fit_time: np.ndarray,
        fit_schroeder: np.ndarray,
        slope: float
    ) -> float:
        """计算置信度"""
        r_squared = r_value ** 2

        residuals = fit_schroeder - (slope * fit_time + (fit_schroeder[0] - slope * fit_time[0]))
        residual_std = np.std(residuals)

        ideal_decay_per_second = -15.0
        normalized_slope = slope / ideal_decay_per_second
        slope_score = np.exp(-abs(1.0 - normalized_slope) * 2)

        residual_score = np.exp(-residual_std * 0.5)

        num_points = len(fit_time)
        points_score = min(1.0, num_points / 50.0)

        confidence = (
            r_squared * 0.4 +
            slope_score * 0.3 +
            residual_score * 0.2 +
            points_score * 0.1
        )

        return max(0.0, min(1.0, confidence))

    def _detect_anomalies(
        self,
        fit_time: np.ndarray,
        fit_schroeder: np.ndarray,
        slope: float,
        r_value: float,
        full_time: np.ndarray,
        full_schroeder: np.ndarray
    ) -> Tuple[List[AnomalyType], List[str]]:
        """检测异常"""
        anomalies: List[AnomalyType] = []
        reasons: List[str] = []

        if r_value ** 2 < 0.95:
            anomalies.append(AnomalyType.NON_LINEAR_DECAY)
            reasons.append(f"线性拟合度较低 (R²={r_value**2:.3f})")

        residuals = fit_schroeder - (slope * fit_time + (fit_schroeder[0] - slope * fit_time[0]))
        residual_std = np.std(residuals)

        if residual_std > 1.5:
            anomalies.append(AnomalyType.MULTIPLE_REFLECTIONS)
            reasons.append(f"残差波动较大 (σ={residual_std:.2f} dB)")

        slope_per_second = slope
        if abs(slope_per_second) < 3.0:
            anomalies.append(AnomalyType.LOW_SNR)
            reasons.append(f"衰减速率过慢 ({abs(slope_per_second):.2f} dB/s)")

        return anomalies, reasons

    def _calculate_clarity_metrics(
        self,
        data: MeasurementData
    ) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        """
        计算清晰度指标: C80, D50, Center Time

        Args:
            data: 测量数据

        Returns:
            (C80, D50, CenterTime)
        """
        time = data.time
        spl = data.spl

        valid_mask = ~np.isnan(spl)
        time_valid = time[valid_mask]
        spl_valid = spl[valid_mask]

        if len(time_valid) < 10:
            return None, None, None

        peak_idx = np.argmax(spl_valid)
        peak_time = time_valid[peak_idx]

        relative_time = time_valid - peak_time
        energy_linear = 10 ** (spl_valid / 10)

        dt = np.diff(relative_time)
        dt = np.append(dt, dt[-1] if len(dt) > 0 else 1.0)

        early_mask_80 = relative_time <= self.config.c80_threshold_ms / 1000.0
        early_energy_80 = np.sum(energy_linear[early_mask_80] * dt[early_mask_80])
        late_energy_80 = np.sum(energy_linear[~early_mask_80] * dt[~early_mask_80])

        c80 = None
        if late_energy_80 > 0:
            c80 = 10 * np.log10(early_energy_80 / late_energy_80)

        early_mask_50 = relative_time <= self.config.d50_threshold_ms / 1000.0
        early_energy_50 = np.sum(energy_linear[early_mask_50] * dt[early_mask_50])
        total_energy = np.sum(energy_linear * dt)

        d50 = None
        if total_energy > 0:
            d50 = early_energy_50 / total_energy

        center_time = None
        if total_energy > 0:
            center_time = np.sum(relative_time * energy_linear * dt) / total_energy

        return c80, d50, center_time


def compute_acoustic_metrics(
    data: MeasurementData,
    config: Optional[AcousticsConfig] = None
) -> AcousticMetrics:
    """
    计算声学指标的便捷函数

    Args:
        data: 测量数据
        config: 计算配置

    Returns:
        声学指标结果
    """
    calculator = ReverbTimeCalculator(config)
    return calculator.compute_metrics(data)
