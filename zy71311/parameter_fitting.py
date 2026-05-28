import numpy as np
from scipy.optimize import curve_fit, minimize
from scipy.signal import find_peaks
from typing import Tuple, Optional, Dict, Any
from dataclasses import dataclass
from vibration_model import SDOFSystem


@dataclass
class FittingResult:
    k: float
    zeta: float
    m: float
    omega_n: float
    omega_d: float
    c: float
    damping_type: str
    method: str
    r_squared: float
    rmse: float
    nrmse: float
    fitted_curve: np.ndarray
    intermediate_data: Dict[str, Any]


class ParameterFitter:
    def __init__(self, t: np.ndarray, x: np.ndarray, m: float, x0: Optional[float] = None):
        self.t = t
        self.x = x
        self.m = m
        self.x0 = x0 if x0 is not None else x[0]
        self.fs = 1.0 / (t[1] - t[0])
        self._validate_input()
    
    def _validate_input(self):
        if len(self.t) != len(self.x):
            raise ValueError("时间序列和位移序列长度不匹配")
        if len(self.t) < 10:
            raise ValueError("数据点过少，至少需要10个点")
        if self.m <= 0:
            raise ValueError("质量必须为正数")
        if self.fs <= 0:
            raise ValueError("采样率必须为正数")
    
    def _residual_function(self, params: np.ndarray) -> float:
        k, zeta = params
        if k <= 0 or zeta < 0:
            return 1e10
        system = SDOFSystem(self.m, k, zeta)
        x_fit = system.free_vibration_analytical(self.t, self.x0, 0.0)
        return np.sum((self.x - x_fit) ** 2)
    
    @staticmethod
    def _fitting_function(t, k, zeta, m, x0):
        system = SDOFSystem(m, k, zeta)
        return system.free_vibration_analytical(t, x0, 0.0)
    
    def fit_log_decrement(self) -> FittingResult:
        peaks, peak_props = find_peaks(self.x, height=0.1 * np.max(self.x))
        if len(peaks) < 3:
            raise ValueError("峰值数量不足，无法使用对数衰减法")
        
        peak_heights = self.x[peaks]
        peak_times = self.t[peaks]
        
        log_decrements = []
        for i in range(len(peak_heights) - 1):
            if peak_heights[i] > 0 and peak_heights[i+1] > 0:
                delta = np.log(peak_heights[i] / peak_heights[i+1])
                log_decrements.append(delta)
        
        if len(log_decrements) < 2:
            raise ValueError("有效峰值对数量不足")
        
        delta_avg = np.mean(log_decrements)
        zeta = delta_avg / np.sqrt(4 * np.pi**2 + delta_avg**2)
        
        periods = np.diff(peak_times)
        Td_avg = np.mean(periods)
        omega_d = 2 * np.pi / Td_avg
        omega_n = omega_d / np.sqrt(1 - zeta**2)
        k = self.m * omega_n**2
        
        system = SDOFSystem(self.m, k, zeta)
        x_fit = system.free_vibration_analytical(self.t, self.x0, 0.0)
        
        metrics = self._calculate_metrics(self.x, x_fit)
        
        return FittingResult(
            k=k,
            zeta=zeta,
            m=self.m,
            omega_n=omega_n,
            omega_d=omega_d,
            c=2 * zeta * np.sqrt(k * self.m),
            damping_type=system.classify_damping(),
            method="对数衰减法",
            fitted_curve=x_fit,
            intermediate_data={
                "peak_indices": peaks,
                "peak_heights": peak_heights,
                "peak_times": peak_times,
                "log_decrements": log_decrements,
                "delta_avg": delta_avg,
                "Td_avg": Td_avg
            },
            **metrics
        )
    
    def fit_curve_fit(self) -> FittingResult:
        def fit_func(t, k, zeta):
            return self._fitting_function(t, k, zeta, self.m, self.x0)
        
        k_guess = 100.0
        zeta_guess = 0.05
        
        try:
            popt, pcov = curve_fit(
                fit_func,
                self.t,
                self.x,
                p0=[k_guess, zeta_guess],
                bounds=([1e-6, 0], [1e6, 10]),
                maxfev=10000
            )
        except RuntimeError:
            popt, pcov = curve_fit(
                fit_func,
                self.t,
                self.x,
                p0=[k_guess, zeta_guess],
                bounds=([1e-6, 0], [1e6, 10]),
                maxfev=50000
            )
        
        k, zeta = popt
        system = SDOFSystem(self.m, k, zeta)
        x_fit = system.free_vibration_analytical(self.t, self.x0, 0.0)
        
        metrics = self._calculate_metrics(self.x, x_fit)
        
        return FittingResult(
            k=k,
            zeta=zeta,
            m=self.m,
            omega_n=system.omega_n,
            omega_d=system.omega_d,
            c=system.c,
            damping_type=system.classify_damping(),
            method="非线性最小二乘法",
            fitted_curve=x_fit,
            intermediate_data={
                "popt": popt,
                "pcov": pcov,
                "param_uncertainty": np.sqrt(np.diag(pcov)) if pcov is not None else None
            },
            **metrics
        )
    
    def fit_global_optimization(self) -> FittingResult:
        bounds = [(1e-6, 1e6), (0, 10)]
        
        result = minimize(
            self._residual_function,
            x0=[100.0, 0.05],
            bounds=bounds,
            method='L-BFGS-B',
            options={'maxiter': 10000}
        )
        
        k, zeta = result.x
        system = SDOFSystem(self.m, k, zeta)
        x_fit = system.free_vibration_analytical(self.t, self.x0, 0.0)
        
        metrics = self._calculate_metrics(self.x, x_fit)
        
        return FittingResult(
            k=k,
            zeta=zeta,
            m=self.m,
            omega_n=system.omega_n,
            omega_d=system.omega_d,
            c=system.c,
            damping_type=system.classify_damping(),
            method="全局优化法",
            fitted_curve=x_fit,
            intermediate_data={
                "optimization_result": result,
                "nfev": result.nfev,
                "nit": result.nit
            },
            **metrics
        )
    
    def fit_auto(self) -> FittingResult:
        try:
            result_log = self.fit_log_decrement()
            if result_log.r_squared > 0.9:
                return result_log
        except Exception:
            pass
        
        try:
            result_curve = self.fit_curve_fit()
            return result_curve
        except Exception:
            return self.fit_global_optimization()
    
    @staticmethod
    def _calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0.0
        
        rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
        nrmse = rmse / (np.max(y_true) - np.min(y_true)) if (np.max(y_true) - np.min(y_true)) > 0 else 0
        
        return {
            "r_squared": r_squared,
            "rmse": rmse,
            "nrmse": nrmse
        }
    
    def estimate_sampling_rate_quality(self) -> Dict[str, Any]:
        peaks, _ = find_peaks(self.x, height=0.1 * np.max(np.abs(self.x)))
        if len(peaks) < 2:
            return {"quality": "unknown", "points_per_cycle": 0, "recommendation": "无法评估"}
        
        periods = np.diff(self.t[peaks])
        avg_period = np.mean(periods)
        points_per_cycle = avg_period * self.fs
        
        if points_per_cycle < 5:
            quality = "严重不足"
            recommendation = "采样率严重不足，建议提高采样率至少10倍"
        elif points_per_cycle < 10:
            quality = "不足"
            recommendation = "采样率偏低，建议提高以获得更准确结果"
        elif points_per_cycle < 20:
            quality = "一般"
            recommendation = "采样率基本满足要求"
        else:
            quality = "良好"
            recommendation = "采样率充足"
        
        return {
            "quality": quality,
            "points_per_cycle": points_per_cycle,
            "avg_period": avg_period,
            "recommendation": recommendation
        }
