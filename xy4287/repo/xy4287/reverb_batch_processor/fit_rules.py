"""拟合与异常检测规则模块"""

from dataclasses import dataclass
from typing import List, Tuple, Optional, Dict, Any

import numpy as np
from scipy import stats

from .models import AnomalyType, FitResult, ValidationStatus


@dataclass
class FitRulesConfig:
    """拟合规则配置"""
    min_fit_points: int = 10
    max_allowed_residual_std: float = 2.0
    min_r_squared: float = 0.90
    ideal_r_squared: float = 0.98

    min_decay_rate_db_s: float = 3.0
    max_decay_rate_db_s: float = 60.0

    multiple_reflection_threshold: float = 1.5
    noise_interference_threshold: float = 3.0

    confidence_weights: Dict[str, float] = None

    def __post_init__(self):
        if self.confidence_weights is None:
            self.confidence_weights = {
                'r_squared': 0.35,
                'residual': 0.25,
                'decay_rate': 0.20,
                'data_points': 0.20
            }


class FitIntervalSelector:
    """自动拟合区间选择器"""

    def __init__(self, config: Optional[FitRulesConfig] = None):
        self.config = config or FitRulesConfig()

    def select_best_interval(
        self,
        time: np.ndarray,
        schroeder: np.ndarray,
        target_drop_db: float = 20.0
    ) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], Dict[str, Any]]:
        """
        自动选择最佳拟合区间

        Args:
            time: 时间轴
            schroeder: Schroeder曲线
            target_drop_db: 目标衰减范围

        Returns:
            (fit_time, fit_schroeder, metadata)
        """
        if len(time) < self.config.min_fit_points:
            return None, None, {'error': '数据点不足'}

        peak_db = schroeder[0]
        noise_floor = self._estimate_noise_floor(schroeder)

        candidates = self._generate_candidates(time, schroeder, peak_db, noise_floor, target_drop_db)

        if not candidates:
            return None, None, {'error': '未找到有效拟合区间'}

        best_candidate = self._select_best_candidate(candidates)

        return (
            best_candidate['fit_time'],
            best_candidate['fit_schroeder'],
            {
                'start_db': best_candidate['start_db'],
                'end_db': best_candidate['end_db'],
                'r_squared': best_candidate['r_squared'],
                'slope': best_candidate['slope'],
                'confidence': best_candidate['confidence'],
                'candidates_evaluated': len(candidates)
            }
        )

    def _estimate_noise_floor(self, schroeder: np.ndarray) -> float:
        """估计噪声底"""
        if len(schroeder) < 20:
            return float(np.min(schroeder))

        tail = schroeder[-int(len(schroeder) * 0.2):]
        return float(np.median(tail))

    def _generate_candidates(
        self,
        time: np.ndarray,
        schroeder: np.ndarray,
        peak_db: float,
        noise_floor: float,
        target_drop_db: float
    ) -> List[Dict[str, Any]]:
        """生成候选拟合区间"""
        candidates = []

        noise_margin = 5.0
        min_end_db = noise_floor + noise_margin

        start_offsets = [0, -1, -2, -3, -5]
        drop_ranges = [target_drop_db, target_drop_db - 5, target_drop_db + 5, target_drop_db - 10]

        for start_offset in start_offsets:
            start_db = peak_db + start_offset

            for drop_range in drop_ranges:
                end_db = start_db - drop_range

                if end_db < min_end_db:
                    continue

                fit_mask = (schroeder <= start_db) & (schroeder >= end_db)
                fit_indices = np.where(fit_mask)[0]

                if len(fit_indices) < self.config.min_fit_points:
                    continue

                fit_time = time[fit_indices]
                fit_schroeder = schroeder[fit_indices]

                slope, intercept, r_value, _, _ = stats.linregress(fit_time, fit_schroeder)
                r_squared = r_value ** 2

                if r_squared < self.config.min_r_squared:
                    continue

                confidence = self._calculate_confidence(
                    r_squared, fit_time, fit_schroeder, slope
                )

                candidates.append({
                    'fit_time': fit_time,
                    'fit_schroeder': fit_schroeder,
                    'start_db': start_db,
                    'end_db': end_db,
                    'slope': slope,
                    'intercept': intercept,
                    'r_squared': r_squared,
                    'confidence': confidence
                })

        return candidates

    def _select_best_candidate(self, candidates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """选择最佳候选区间"""
        candidates.sort(key=lambda x: (x['confidence'], x['r_squared']), reverse=True)
        return candidates[0]

    def _calculate_confidence(
        self,
        r_squared: float,
        fit_time: np.ndarray,
        fit_schroeder: np.ndarray,
        slope: float
    ) -> float:
        """计算置信度"""
        weights = self.config.confidence_weights

        r_squared_score = min(1.0, r_squared / self.config.ideal_r_squared)

        expected_slope = -15.0
        slope_normalized = abs(slope / expected_slope)
        slope_score = np.exp(-abs(1.0 - slope_normalized) * 2)

        residuals = fit_schroeder - (slope * fit_time + (fit_schroeder[0] - slope * fit_time[0]))
        residual_std = np.std(residuals)
        residual_score = np.exp(-residual_std * 0.5)

        num_points = len(fit_time)
        points_score = min(1.0, num_points / 50.0)

        confidence = (
            r_squared_score * weights['r_squared'] +
            residual_score * weights['residual'] +
            slope_score * weights['decay_rate'] +
            points_score * weights['data_points']
        )

        return max(0.0, min(1.0, confidence))


class AnomalyDetector:
    """异常检测器"""

    def __init__(self, config: Optional[FitRulesConfig] = None):
        self.config = config or FitRulesConfig()

    def detect_all(
        self,
        time: np.ndarray,
        spl: np.ndarray,
        schroeder: Optional[np.ndarray] = None,
        fit_result: Optional[FitResult] = None
    ) -> Tuple[List[AnomalyType], List[str], Dict[str, Any]]:
        """
        检测所有异常

        Args:
            time: 时间轴
            spl: 原始声压级数据
            schroeder: Schroeder曲线
            fit_result: 拟合结果

        Returns:
            (异常类型列表, 异常原因列表, 详细信息)
        """
        anomalies: List[AnomalyType] = []
        reasons: List[str] = []
        details: Dict[str, Any] = {}

        clipping_anomalies, clipping_reasons, clipping_details = self._detect_clipping(spl)
        anomalies.extend(clipping_anomalies)
        reasons.extend(clipping_reasons)
        details.update(clipping_details)

        noise_anomalies, noise_reasons, noise_details = self._detect_noise_interference(time, spl)
        anomalies.extend(noise_anomalies)
        reasons.extend(noise_reasons)
        details.update(noise_details)

        if schroeder is not None:
            reflection_anomalies, reflection_reasons, reflection_details = self._detect_multiple_reflections(
                time, schroeder
            )
            anomalies.extend(reflection_anomalies)
            reasons.extend(reflection_reasons)
            details.update(reflection_details)

        if fit_result is not None:
            linear_anomalies, linear_reasons, linear_details = self._detect_non_linear_decay(fit_result)
            anomalies.extend(linear_anomalies)
            reasons.extend(linear_reasons)
            details.update(linear_details)

            snr_anomalies, snr_reasons, snr_details = self._detect_low_snr(fit_result)
            anomalies.extend(snr_anomalies)
            reasons.extend(snr_reasons)
            details.update(snr_details)

        unique_anomalies = list(dict.fromkeys(anomalies))

        return unique_anomalies, reasons, details

    def _detect_clipping(self, spl: np.ndarray) -> Tuple[List[AnomalyType], List[str], Dict[str, Any]]:
        """检测削波"""
        anomalies: List[AnomalyType] = []
        reasons: List[str] = []
        details: Dict[str, Any] = {}

        valid_spl = spl[~np.isnan(spl)]
        if len(valid_spl) == 0:
            return anomalies, reasons, details

        clipping_threshold = 150.0
        clipped_count = np.sum(valid_spl >= clipping_threshold)

        if clipped_count > 0:
            anomalies.append(AnomalyType.CLIPPING)
            reasons.append(f"检测到削波: {clipped_count} 个点超过 {clipping_threshold} dB")
            details['clipping_count'] = int(clipped_count)
            details['clipping_threshold'] = clipping_threshold

        plateaus = self._find_plateaus(valid_spl, min_length=5)
        if plateaus:
            anomalies.append(AnomalyType.CLIPPING)
            reasons.append(f"检测到 {len(plateaus)} 个平台区域，可能存在削波")
            details['plateau_regions'] = len(plateaus)

        return anomalies, reasons, details

    def _find_plateaus(self, signal: np.ndarray, min_length: int = 5) -> List[Tuple[int, int]]:
        """查找平台区域"""
        plateaus = []
        i = 0
        while i < len(signal) - 1:
            if abs(signal[i + 1] - signal[i]) < 0.01:
                start = i
                while i < len(signal) - 1 and abs(signal[i + 1] - signal[i]) < 0.01:
                    i += 1
                if i - start + 1 >= min_length:
                    plateaus.append((start, i))
            i += 1
        return plateaus

    def _detect_noise_interference(
        self,
        time: np.ndarray,
        spl: np.ndarray
    ) -> Tuple[List[AnomalyType], List[str], Dict[str, Any]]:
        """检测噪声干扰"""
        anomalies: List[AnomalyType] = []
        reasons: List[str] = []
        details: Dict[str, Any] = {}

        valid_mask = ~np.isnan(spl)
        valid_spl = spl[valid_mask]
        valid_time = time[valid_mask]

        if len(valid_spl) < 20:
            return anomalies, reasons, details

        peak_idx = np.argmax(valid_spl)
        peak_spl = valid_spl[peak_idx]

        if peak_idx >= len(valid_spl) - 1:
            return anomalies, reasons, details

        decay_spl = valid_spl[peak_idx:]

        if len(decay_spl) < 20:
            return anomalies, reasons, details

        tail_fraction = 0.3
        tail_start = int(len(decay_spl) * (1 - tail_fraction))
        tail_spl = decay_spl[tail_start:]

        noise_floor = np.median(tail_spl)
        noise_std = np.std(tail_spl)

        snr = peak_spl - noise_floor

        if noise_std > self.config.noise_interference_threshold:
            anomalies.append(AnomalyType.NOISE_FLOOR)
            reasons.append(f"噪声底波动过大 (σ={noise_std:.2f} dB)")
            details['noise_std'] = float(noise_std)

        if snr < 15.0:
            anomalies.append(AnomalyType.LOW_SNR)
            reasons.append(f"信噪比较低: {snr:.1f} dB")
            details['snr'] = float(snr)

        return anomalies, reasons, details

    def _detect_multiple_reflections(
        self,
        time: np.ndarray,
        schroeder: np.ndarray
    ) -> Tuple[List[AnomalyType], List[str], Dict[str, Any]]:
        """检测多次反射干扰"""
        anomalies: List[AnomalyType] = []
        reasons: List[str] = []
        details: Dict[str, Any] = {}

        if len(schroeder) < 10:
            return anomalies, reasons, details

        slope, intercept, r_value, _, _ = stats.linregress(time, schroeder)
        expected = slope * time + intercept
        residuals = schroeder - expected

        residual_std = np.std(residuals)

        if residual_std > self.config.multiple_reflection_threshold:
            anomalies.append(AnomalyType.MULTIPLE_REFLECTIONS)
            reasons.append(f"检测到多次反射干扰，残差标准差: {residual_std:.2f} dB")
            details['residual_std'] = float(residual_std)

        peaks = self._find_residual_peaks(residuals)
        if len(peaks) >= 2:
            anomalies.append(AnomalyType.MULTIPLE_REFLECTIONS)
            reasons.append(f"检测到 {len(peaks)} 个残差峰值，可能存在耦合振动")
            details['residual_peaks'] = len(peaks)

        return anomalies, reasons, details

    def _find_residual_peaks(self, residuals: np.ndarray, threshold: float = 2.0) -> List[int]:
        """查找残差中的峰值"""
        peaks = []
        std = np.std(residuals)

        for i in range(1, len(residuals) - 1):
            if abs(residuals[i]) > abs(residuals[i - 1]) and abs(residuals[i]) > abs(residuals[i + 1]):
                if abs(residuals[i]) > threshold * std:
                    peaks.append(i)

        return peaks

    def _detect_non_linear_decay(
        self,
        fit_result: FitResult
    ) -> Tuple[List[AnomalyType], List[str], Dict[str, Any]]:
        """检测非线性衰减"""
        anomalies: List[AnomalyType] = []
        reasons: List[str] = []
        details: Dict[str, Any] = {}

        if fit_result.r_squared < self.config.min_r_squared:
            anomalies.append(AnomalyType.NON_LINEAR_DECAY)
            reasons.append(f"线性拟合度较低 (R²={fit_result.r_squared:.3f})")
            details['r_squared'] = float(fit_result.r_squared)

        return anomalies, reasons, details

    def _detect_low_snr(
        self,
        fit_result: FitResult
    ) -> Tuple[List[AnomalyType], List[str], Dict[str, Any]]:
        """检测低信噪比"""
        anomalies: List[AnomalyType] = []
        reasons: List[str] = []
        details: Dict[str, Any] = {}

        decay_rate = abs(fit_result.slope)

        if decay_rate < self.config.min_decay_rate_db_s:
            anomalies.append(AnomalyType.LOW_SNR)
            reasons.append(f"衰减速率过慢 ({decay_rate:.2f} dB/s)")
            details['decay_rate'] = float(decay_rate)

        return anomalies, reasons, details


def detect_anomalies(
    time: np.ndarray,
    spl: np.ndarray,
    schroeder: Optional[np.ndarray] = None,
    fit_result: Optional[FitResult] = None,
    config: Optional[FitRulesConfig] = None
) -> Tuple[List[AnomalyType], List[str], Dict[str, Any]]:
    """
    异常检测的便捷函数

    Args:
        time: 时间轴
        spl: 原始声压级数据
        schroeder: Schroeder曲线
        fit_result: 拟合结果
        config: 配置

    Returns:
        (异常类型列表, 异常原因列表, 详细信息)
    """
    detector = AnomalyDetector(config)
    return detector.detect_all(time, spl, schroeder, fit_result)
