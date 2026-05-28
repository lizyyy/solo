import numpy as np
from scipy import stats
from scipy.signal import find_peaks
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass
import warnings


@dataclass
class ResidualAnalysis:
    residuals: np.ndarray
    mean_residual: float
    std_residual: float
    max_abs_residual: float
    skewness: float
    kurtosis: float
    jarque_bera_pvalue: float
    durbin_watson: float
    anomaly_indices: List[int]
    anomaly_scores: np.ndarray
    is_normal: bool
    is_independent: bool
    has_heteroscedasticity: bool
    details: Dict[str, Any]


class ResidualDiagnostic:
    def __init__(self, t: np.ndarray, x_measured: np.ndarray, x_fitted: np.ndarray):
        self.t = t
        self.x_measured = x_measured
        self.x_fitted = x_fitted
        self.residuals = x_measured - x_fitted
        self.n = len(self.residuals)
    
    def analyze(self, confidence_level: float = 0.95) -> ResidualAnalysis:
        mean_res = np.mean(self.residuals)
        std_res = np.std(self.residuals, ddof=1)
        max_abs_res = np.max(np.abs(self.residuals))
        
        skewness = stats.skew(self.residuals)
        kurtosis_val = stats.kurtosis(self.residuals)
        
        jb_stat, jb_pvalue = self._jarque_bera_test()
        
        dw_stat = self._durbin_watson()
        
        anomaly_indices, anomaly_scores = self._detect_anomalies()
        
        alpha = 1 - confidence_level
        is_normal = jb_pvalue > alpha
        
        is_independent = 1.5 < dw_stat < 2.5
        
        has_heteroscedasticity = self._check_heteroscedasticity()
        
        details = {
            "normality_test": "通过" if is_normal else "未通过",
            "independence_test": "通过" if is_independent else "未通过",
            "homoscedasticity_test": "通过" if not has_heteroscedasticity else "未通过",
            "residual_range": [np.min(self.residuals), np.max(self.residuals)],
            "percentiles": np.percentile(self.residuals, [25, 50, 75]).tolist()
        }
        
        return ResidualAnalysis(
            residuals=self.residuals,
            mean_residual=mean_res,
            std_residual=std_res,
            max_abs_residual=max_abs_res,
            skewness=skewness,
            kurtosis=kurtosis_val,
            jarque_bera_pvalue=jb_pvalue,
            durbin_watson=dw_stat,
            anomaly_indices=anomaly_indices,
            anomaly_scores=anomaly_scores,
            is_normal=is_normal,
            is_independent=is_independent,
            has_heteroscedasticity=has_heteroscedasticity,
            details=details
        )
    
    def _jarque_bera_test(self) -> Tuple[float, float]:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            stat, pvalue = stats.jarque_bera(self.residuals)
        return stat, pvalue
    
    def _durbin_watson(self) -> float:
        diff_res = np.diff(self.residuals)
        ss_res = np.sum(self.residuals ** 2)
        if ss_res < 1e-10:
            return 2.0
        dw = np.sum(diff_res ** 2) / ss_res
        return dw
    
    def _detect_anomalies(self, method: str = "zscore", threshold: float = 3.0) -> Tuple[List[int], np.ndarray]:
        if method == "zscore":
            z_scores = np.abs(stats.zscore(self.residuals))
            anomaly_indices = np.where(z_scores > threshold)[0].tolist()
            return anomaly_indices, z_scores
        
        elif method == "mad":
            median = np.median(self.residuals)
            mad = np.median(np.abs(self.residuals - median))
            if mad < 1e-10:
                return [], np.zeros_like(self.residuals)
            modified_z = 0.6745 * (self.residuals - median) / mad
            anomaly_indices = np.where(np.abs(modified_z) > threshold)[0].tolist()
            return anomaly_indices, np.abs(modified_z)
        
        elif method == "iqr":
            q1, q3 = np.percentile(self.residuals, [25, 75])
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            anomaly_indices = np.where(
                (self.residuals < lower_bound) | (self.residuals > upper_bound)
            )[0].tolist()
            scores = np.zeros_like(self.residuals)
            for i, res in enumerate(self.residuals):
                if res > upper_bound:
                    scores[i] = (res - upper_bound) / iqr if iqr > 0 else 0
                elif res < lower_bound:
                    scores[i] = (lower_bound - res) / iqr if iqr > 0 else 0
            return anomaly_indices, scores
        
        else:
            return [], np.zeros_like(self.residuals)
    
    def _check_heteroscedasticity(self, window_size: int = 20) -> bool:
        if self.n < 2 * window_size:
            window_size = max(5, self.n // 4)
        
        half = self.n // 2
        std1 = np.std(self.residuals[:half], ddof=1)
        std2 = np.std(self.residuals[half:], ddof=1)
        
        if min(std1, std2) < 1e-10:
            return False
        
        ratio = max(std1, std2) / min(std1, std2)
        return ratio > 2.0
    
    def rolling_analysis(self, window_size: int = 20) -> Dict[str, np.ndarray]:
        if self.n < window_size:
            window_size = max(5, self.n // 2)
        
        rolling_mean = []
        rolling_std = []
        
        for i in range(self.n):
            start = max(0, i - window_size // 2)
            end = min(self.n, i + window_size // 2)
            window = self.residuals[start:end]
            rolling_mean.append(np.mean(window))
            rolling_std.append(np.std(window, ddof=1))
        
        return {
            "rolling_mean": np.array(rolling_mean),
            "rolling_std": np.array(rolling_std)
        }
    
    def auto_correlation(self, max_lag: int = 20) -> np.ndarray:
        acf = []
        var = np.var(self.residuals)
        if var < 1e-10:
            return np.zeros(max_lag)
        
        for lag in range(max_lag):
            if lag == 0:
                acf.append(1.0)
            else:
                cov = np.mean((self.residuals[lag:] - np.mean(self.residuals)) * 
                              (self.residuals[:-lag] - np.mean(self.residuals)))
                acf.append(cov / var)
        
        return np.array(acf)


class PeakAnomalyDetector:
    def __init__(self, t: np.ndarray, x: np.ndarray):
        self.t = t
        self.x = x
    
    def detect_anomalous_peaks(
        self,
        height_threshold: float = 0.5,
        prominence_threshold: float = 0.3
    ) -> Dict[str, Any]:
        x_normalized = np.abs(self.x) / np.max(np.abs(self.x))
        
        peaks, properties = find_peaks(
            x_normalized,
            height=height_threshold,
            prominence=prominence_threshold
        )
        
        peak_heights = self.x[peaks]
        
        if len(peaks) >= 3:
            median_height = np.median(np.abs(peak_heights))
            mad = np.median(np.abs(np.abs(peak_heights) - median_height))
            if mad > 1e-10:
                z_scores = 0.6745 * (np.abs(peak_heights) - median_height) / mad
            else:
                z_scores = np.zeros_like(peak_heights)
            
            anomalous_peak_indices = peaks[np.where(z_scores > 2.0)[0]]
        else:
            anomalous_peak_indices = np.array([], dtype=int)
            z_scores = np.zeros_like(peak_heights)
        
        return {
            "all_peaks": peaks.tolist(),
            "all_peak_heights": peak_heights.tolist(),
            "anomalous_peaks": anomalous_peak_indices.tolist(),
            "peak_z_scores": z_scores.tolist(),
            "num_peaks": len(peaks),
            "num_anomalous": len(anomalous_peak_indices)
        }


def diagnose_overdamping_misclassification(
    t: np.ndarray,
    x: np.ndarray,
    fs: float
) -> Dict[str, Any]:
    peaks, _ = find_peaks(np.abs(x), height=0.1 * np.max(np.abs(x)))
    
    if len(peaks) < 2:
        return {
            "is_overdamped": True,
            "confidence": 0.8,
            "evidence": "不足两个峰值，可能为过阻尼",
            "num_peaks": len(peaks)
        }
    
    peak_times = t[peaks]
    intervals = np.diff(peak_times)
    
    if len(intervals) >= 2:
        interval_variation = np.std(intervals) / np.mean(intervals)
    else:
        interval_variation = 0
    
    decay_rates = []
    for i in range(len(peaks) - 1):
        ratio = np.abs(x[peaks[i+1]]) / np.abs(x[peaks[i]])
        if ratio > 0:
            decay_rates.append(-np.log(ratio))
    
    if len(decay_rates) > 0:
        decay_rate_variation = np.std(decay_rates) / np.mean(decay_rates) if np.mean(decay_rates) > 0 else 0
    else:
        decay_rate_variation = 0
    
    is_overdamped = (
        len(peaks) < 5 or
        interval_variation > 0.3 or
        decay_rate_variation > 0.5
    )
    
    if is_overdamped:
        confidence = 0.6 + 0.4 * min(1.0, decay_rate_variation)
        evidence = f"峰值数量: {len(peaks)}, 间隔变异: {interval_variation:.2f}, 衰减变异: {decay_rate_variation:.2f}"
    else:
        confidence = 0.9
        evidence = "振动规律稳定，为欠阻尼"
    
    return {
        "is_overdamped": is_overdamped,
        "confidence": confidence,
        "evidence": evidence,
        "num_peaks": len(peaks),
        "interval_variation": interval_variation,
        "decay_rate_variation": decay_rate_variation
    }
