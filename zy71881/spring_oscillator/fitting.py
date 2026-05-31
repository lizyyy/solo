"""弹簧振子拟合算法。

实现周期-质量拟合模型，包含弹簧等效质量修正，
计算弹簧劲度系数 k 及相关不确定度。
"""

from typing import List, Tuple, Optional, Dict, Any
import numpy as np
from scipy.optimize import curve_fit

from .models import (
    ExperimentRecord,
    FitResult,
    ProcessingSummary,
)
from .errors import (
    FittingError,
    DataValidationError,
    wrap_technical_error,
)


class SpringOscillatorFitter:
    """弹簧振子数据拟合器。

    基于周期-质量关系拟合弹簧劲度系数 k 和等效质量 m0。

    物理模型：
        T = 2π√[(m + m0) / k]
    其中：
        T  - 振动周期
        m  - 砝码质量
        m0 - 弹簧等效质量（约为弹簧质量的1/3）
        k  - 弹簧劲度系数

    线性化形式（用于初始参数估计）：
        T² = (4π²/k)·m + (4π²/k)·m0
    """

    def __init__(self, r_squared_threshold: float = 0.99):
        self.r_squared_threshold = r_squared_threshold
        self.summary = ProcessingSummary()

    @staticmethod
    def period_model(m: np.ndarray, k: float, m0: float) -> np.ndarray:
        """周期-质量理论模型。

        T(m) = 2π√[(m + m0) / k]

        Args:
            m: 质量数组 (kg)
            k: 弹簧劲度系数 (N/m)
            m0: 弹簧等效质量 (kg)

        Returns:
            周期数组 (s)
        """
        return 2 * np.pi * np.sqrt((m + m0) / k)

    @wrap_technical_error(
        error_class=FittingError,
        default_message="曲线拟合失败",
        default_suggestion="请检查数据质量，确保质量和周期都是正数且分布合理。",
    )
    def fit(
        self,
        records: List[ExperimentRecord],
        method: str = "nonlinear",
    ) -> FitResult:
        """执行弹簧振子数据拟合。

        Args:
            records: 实验记录列表（应为已清洗的有效记录）
            method: 拟合方法，'nonlinear' 为非线性最小二乘，'linear' 为线性拟合

        Returns:
            拟合结果对象
        """
        if len(records) < 5:
            raise DataValidationError.insufficient_data(len(records), 5)

        masses = np.array([r.mass_kg for r in records], dtype=float)
        periods = np.array([r.period_s for r in records], dtype=float)

        valid_mask = (masses > 0) & (periods > 0)
        masses = masses[valid_mask]
        periods = periods[valid_mask]

        if len(masses) < 5:
            raise DataValidationError.insufficient_data(len(masses), 5)

        if method == "linear":
            return self._linear_fit(masses, periods, records)
        else:
            return self._nonlinear_fit(masses, periods, records)

    def _nonlinear_fit(
        self,
        masses: np.ndarray,
        periods: np.ndarray,
        records: List[ExperimentRecord],
    ) -> FitResult:
        """非线性最小二乘拟合。

        直接拟合 T = 2π√[(m + m0) / k] 模型。
        """
        k_init, m0_init = self._estimate_initial_params(masses, periods)

        try:
            params, covariance = curve_fit(
                self.period_model,
                masses,
                periods,
                p0=[k_init, m0_init],
                absolute_sigma=True,
                maxfev=10000,
            )
        except Exception as e:
            raise FittingError.fit_failed(str(e))

        k, m0 = params
        k_err, m0_err = np.sqrt(np.diag(covariance)) if covariance is not None else (0.0, 0.0)

        periods_pred = self.period_model(masses, k, m0)
        residuals = periods - periods_pred

        r_squared = self._calculate_r_squared(periods, residuals)
        chi_squared = np.sum((residuals / np.std(periods)) ** 2) if np.std(periods) > 0 else 0.0
        dof = len(masses) - 2

        if r_squared < self.r_squared_threshold:
            warning = FittingError.poor_fit_quality(r_squared, self.r_squared_threshold)
            self.summary.warnings.append(warning.user_message)

        result = FitResult(
            spring_constant_k=float(k),
            spring_constant_uncertainty=float(k_err),
            equivalent_mass_kg=float(m0),
            equivalent_mass_uncertainty=float(m0_err),
            r_squared=float(r_squared),
            chi_squared=float(chi_squared),
            degrees_of_freedom=dof,
            fit_method="非线性最小二乘拟合 (Levenberg-Marquardt)",
            used_records_count=len(masses),
            mass_range_kg=(float(masses.min()), float(masses.max())),
            period_range_s=(float(periods.min()), float(periods.max())),
            formula="T = 2π√[(m + m₀) / k]",
            notes=f"弹簧劲度系数 k = {k:.3f} ± {k_err:.3f} N/m, 等效质量 m₀ = {m0*1000:.2f} ± {m0_err*1000:.2f} g",
        )

        return result

    def _linear_fit(
        self,
        masses: np.ndarray,
        periods: np.ndarray,
        records: List[ExperimentRecord],
    ) -> FitResult:
        """线性拟合（T² vs m）。

        将模型线性化为 T² = (4π²/k)·m + (4π²/k)·m0
        """
        T_squared = periods ** 2

        slope, intercept = np.polyfit(masses, T_squared, 1)

        k = 4 * np.pi ** 2 / slope
        m0 = intercept / slope

        T_squared_pred = slope * masses + intercept
        residuals = T_squared - T_squared_pred

        r_squared = self._calculate_r_squared(T_squared, residuals)

        n = len(masses)
        std_residuals = np.std(residuals, ddof=2)
        std_slope = std_residuals / np.sqrt(np.sum((masses - np.mean(masses)) ** 2))
        std_intercept = std_slope * np.sqrt(np.sum(masses ** 2) / n)

        k_err = k * std_slope / slope
        m0_err = np.sqrt(
            (std_intercept / slope) ** 2 + (intercept * std_slope / slope ** 2) ** 2
        )

        chi_squared = np.sum((residuals / np.std(T_squared)) ** 2) if np.std(T_squared) > 0 else 0.0
        dof = n - 2

        if r_squared < self.r_squared_threshold:
            warning = FittingError.poor_fit_quality(r_squared, self.r_squared_threshold)
            self.summary.warnings.append(warning.user_message)

        result = FitResult(
            spring_constant_k=float(k),
            spring_constant_uncertainty=float(k_err),
            equivalent_mass_kg=float(m0),
            equivalent_mass_uncertainty=float(m0_err),
            r_squared=float(r_squared),
            chi_squared=float(chi_squared),
            degrees_of_freedom=dof,
            fit_method="线性拟合 (T² vs m)",
            used_records_count=n,
            mass_range_kg=(float(masses.min()), float(masses.max())),
            period_range_s=(float(periods.min()), float(periods.max())),
            formula="T² = (4π²/k)·m + (4π²/k)·m₀",
            notes=f"弹簧劲度系数 k = {k:.3f} ± {k_err:.3f} N/m, 等效质量 m₀ = {m0*1000:.2f} ± {m0_err*1000:.2f} g",
        )

        return result

    def _estimate_initial_params(
        self,
        masses: np.ndarray,
        periods: np.ndarray,
    ) -> Tuple[float, float]:
        """估计初始参数，用于非线性拟合。

        使用线性拟合结果作为初始猜测。
        """
        T_squared = periods ** 2
        slope, intercept = np.polyfit(masses, T_squared, 1)

        k_init = 4 * np.pi ** 2 / slope
        m0_init = max(intercept / slope, 0.001)

        return k_init, m0_init

    def _calculate_r_squared(self, y: np.ndarray, residuals: np.ndarray) -> float:
        """计算决定系数 R²。"""
        ss_res = np.sum(residuals ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)

        if ss_tot == 0:
            return 1.0

        return 1 - (ss_res / ss_tot)

    def calculate_residuals(
        self,
        fit_result: FitResult,
        records: List[ExperimentRecord],
    ) -> Dict[str, Any]:
        """计算拟合残差，用于诊断。

        Args:
            fit_result: 拟合结果
            records: 实验记录

        Returns:
            包含残差信息的字典
        """
        masses = np.array([r.mass_kg for r in records if r.mass_kg > 0 and r.period_s > 0])
        periods = np.array([r.period_s for r in records if r.mass_kg > 0 and r.period_s > 0])

        periods_pred = self.period_model(
            masses,
            fit_result.spring_constant_k,
            fit_result.equivalent_mass_kg,
        )

        residuals = periods - periods_pred
        relative_residuals = (residuals / periods) * 100

        return {
            "masses_kg": masses.tolist(),
            "periods_s": periods.tolist(),
            "predicted_periods_s": periods_pred.tolist(),
            "residuals_s": residuals.tolist(),
            "relative_residuals_percent": relative_residuals.tolist(),
            "mean_absolute_residual_s": float(np.mean(np.abs(residuals))),
            "max_absolute_residual_s": float(np.max(np.abs(residuals))),
            "mean_relative_residual_percent": float(np.mean(np.abs(relative_residuals))),
        }

    def generate_fit_curve_data(
        self,
        fit_result: FitResult,
        num_points: int = 100,
    ) -> Dict[str, Any]:
        """生成拟合曲线数据，用于绘图。

        Args:
            fit_result: 拟合结果
            num_points: 曲线点数

        Returns:
            包含拟合曲线数据的字典
        """
        m_min, m_max = fit_result.mass_range_kg
        m_curve = np.linspace(max(0, m_min - 0.01), m_max + 0.01, num_points)

        T_curve = self.period_model(
            m_curve,
            fit_result.spring_constant_k,
            fit_result.equivalent_mass_kg,
        )

        return {
            "mass_curve_kg": m_curve.tolist(),
            "period_curve_s": T_curve.tolist(),
        }
