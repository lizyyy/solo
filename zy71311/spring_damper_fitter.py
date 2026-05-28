import numpy as np
from typing import Optional, Dict, Any, Tuple, List
from dataclasses import dataclass

from vibration_model import SDOFSystem, generate_test_data
from parameter_fitting import ParameterFitter, FittingResult
from residual_diagnosis import (
    ResidualDiagnostic, ResidualAnalysis,
    PeakAnomalyDetector, diagnose_overdamping_misclassification
)
from visualization import VibrationVisualizer
from report_export import ReportExporter, FittingReport


@dataclass
class FittingSession:
    t: np.ndarray
    x: np.ndarray
    m: float
    fs: float
    x0: float
    sample_id: str
    noise_marker: str
    filtered_mask: Optional[np.ndarray] = None


class SpringDamperFitter:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = output_dir
        self.report_exporter = ReportExporter(output_dir)
        self.current_session: Optional[FittingSession] = None
        self.fitting_result: Optional[FittingResult] = None
        self.residual_analysis: Optional[ResidualAnalysis] = None
        self.peak_analysis: Optional[Dict[str, Any]] = None
        self.overdamping_diagnosis: Optional[Dict[str, Any]] = None
        self.sampling_quality: Optional[Dict[str, Any]] = None
    
    def load_data(
        self,
        t: np.ndarray,
        x: np.ndarray,
        m: float,
        sample_id: str,
        fs: Optional[float] = None,
        x0: Optional[float] = None,
        noise_marker: str = "unknown"
    ) -> FittingSession:
        if fs is None:
            if len(t) >= 2:
                fs = 1.0 / (t[1] - t[0])
            else:
                raise ValueError("无法自动计算采样率，请手动提供fs参数")
        
        if x0 is None:
            x0 = x[0]
        
        self.current_session = FittingSession(
            t=t,
            x=x,
            m=m,
            fs=fs,
            x0=x0,
            sample_id=sample_id,
            noise_marker=noise_marker
        )
        
        fitter = ParameterFitter(t, x, m, x0)
        self.sampling_quality = fitter.estimate_sampling_rate_quality()
        
        return self.current_session
    
    def load_from_csv(
        self,
        csv_path: str,
        m: float,
        sample_id: str,
        time_col: str = "time",
        displacement_col: str = "displacement",
        fs: Optional[float] = None,
        x0: Optional[float] = None,
        noise_marker: str = "unknown"
    ) -> FittingSession:
        import pandas as pd
        df = pd.read_csv(csv_path)
        t = df[time_col].values
        x = df[displacement_col].values
        return self.load_data(t, x, m, sample_id, fs, x0, noise_marker)
    
    def filter_data(
        self,
        time_range: Optional[Tuple[float, float]] = None,
        remove_anomalies: bool = False,
        anomaly_threshold: float = 3.0
    ) -> np.ndarray:
        if self.current_session is None:
            raise ValueError("请先加载数据")
        
        session = self.current_session
        mask = np.ones_like(session.t, dtype=bool)
        
        if time_range is not None:
            t_start, t_end = time_range
            mask = mask & (session.t >= t_start) & (session.t <= t_end)
        
        if remove_anomalies and self.residual_analysis:
            anomaly_indices = np.array(self.residual_analysis.anomaly_indices)
            if len(anomaly_indices) > 0:
                mask[anomaly_indices] = False
        
        session.filtered_mask = mask
        return mask
    
    def fit(
        self,
        method: str = "auto",
        use_filtered: bool = False
    ) -> FittingResult:
        if self.current_session is None:
            raise ValueError("请先加载数据")
        
        session = self.current_session
        
        t = session.t
        x = session.x
        
        if use_filtered and session.filtered_mask is not None:
            t = t[session.filtered_mask]
            x = x[session.filtered_mask]
        
        fitter = ParameterFitter(t, x, session.m, session.x0)
        
        if method == "log_decrement":
            self.fitting_result = fitter.fit_log_decrement()
        elif method == "curve_fit":
            self.fitting_result = fitter.fit_curve_fit()
        elif method == "global":
            self.fitting_result = fitter.fit_global_optimization()
        elif method == "auto":
            self.fitting_result = fitter.fit_auto()
        else:
            raise ValueError(f"未知的拟合方法: {method}")
        
        self._post_fit_analysis()
        
        return self.fitting_result
    
    def _post_fit_analysis(self):
        if self.current_session is None or self.fitting_result is None:
            return
        
        session = self.current_session
        t = session.t
        x = session.x
        
        if session.filtered_mask is not None:
            t = t[session.filtered_mask]
            x = x[session.filtered_mask]
        
        diagnostic = ResidualDiagnostic(t, x, self.fitting_result.fitted_curve)
        self.residual_analysis = diagnostic.analyze()
        
        peak_detector = PeakAnomalyDetector(t, x)
        self.peak_analysis = peak_detector.detect_anomalous_peaks()
        
        self.overdamping_diagnosis = diagnose_overdamping_misclassification(
            t, x, session.fs
        )
    
    def generate_visualizations(self) -> Dict[str, Any]:
        if self.current_session is None or self.fitting_result is None:
            raise ValueError("请先完成拟合")
        
        session = self.current_session
        t = session.t
        x = session.x
        
        if session.filtered_mask is not None:
            t = t[session.filtered_mask]
            x = x[session.filtered_mask]
        
        visualizer = VibrationVisualizer(t, x)
        figures = {}
        
        figures['fitted_comparison'] = visualizer.plot_fitted_comparison(
            self.fitting_result,
            highlight_anomalies=self.residual_analysis.anomaly_indices if self.residual_analysis else None
        )
        
        if self.residual_analysis:
            figures['residual_analysis'] = visualizer.plot_residual_analysis(
                self.residual_analysis,
                self.fitting_result
            )
        
        if self.peak_analysis:
            figures['peak_analysis'] = visualizer.plot_peak_analysis(self.peak_analysis)
        
        figures['comprehensive_report'] = visualizer.plot_comprehensive_report(
            self.fitting_result,
            self.residual_analysis,
            self.peak_analysis
        )
        
        return figures
    
    def export_report(
        self,
        sample_id: Optional[str] = None,
        include_figures: bool = True
    ) -> Tuple[FittingReport, Dict[str, str]]:
        if self.current_session is None or self.fitting_result is None:
            raise ValueError("请先完成拟合")
        
        session = self.current_session
        actual_sample_id = sample_id or session.sample_id
        
        t = session.t
        x = session.x
        
        if session.filtered_mask is not None:
            t = t[session.filtered_mask]
            x = x[session.filtered_mask]
        
        report = self.report_exporter.create_report(
            t=t,
            x=x,
            m=session.m,
            fs=session.fs,
            x0=session.x0,
            sample_id=actual_sample_id,
            fitting_result=self.fitting_result,
            residual_analysis=self.residual_analysis,
            sampling_quality=self.sampling_quality or {},
            peak_analysis=self.peak_analysis or {},
            overdamping_diagnosis=self.overdamping_diagnosis or {},
            noise_marker=session.noise_marker
        )
        
        figures = self.generate_visualizations() if include_figures else None
        
        outputs = self.report_exporter.export_all(
            report=report,
            t=t,
            x_measured=x,
            x_fitted=self.fitting_result.fitted_curve,
            residuals=self.residual_analysis.residuals if self.residual_analysis else np.zeros_like(x),
            figures=figures,
            filtered_mask=session.filtered_mask
        )
        
        return report, outputs
    
    def print_summary(self):
        if self.fitting_result is None:
            print("未进行拟合")
            return
        
        print("=" * 60)
        print("弹簧阻尼拟合结果摘要")
        print("=" * 60)
        print(f"拟合方法: {self.fitting_result.method}")
        print(f"弹簧常数 k = {self.fitting_result.k:.6f} N/m")
        print(f"阻尼比 ζ = {self.fitting_result.zeta:.8f}")
        print(f"阻尼类型: {self.fitting_result.damping_type}")
        print(f"R² = {self.fitting_result.r_squared:.6f}")
        print(f"RMSE = {self.fitting_result.rmse:.6f} m")
        print("")
        
        if self.sampling_quality:
            print(f"采样率质量: {self.sampling_quality.get('quality', 'N/A')}")
            print(f"每周期采样点: {self.sampling_quality.get('points_per_cycle', 0):.1f}")
        
        if self.overdamping_diagnosis and self.overdamping_diagnosis.get('is_overdamped'):
            print(f"过阻尼警告: {self.overdamping_diagnosis.get('evidence', '')}")
        
        if self.residual_analysis and len(self.residual_analysis.anomaly_indices) > 0:
            print(f"检测到 {len(self.residual_analysis.anomaly_indices)} 个异常点")
        
        print("=" * 60)


def run_demo():
    print("=" * 60)
    print("弹簧阻尼拟合器 - 演示程序")
    print("=" * 60)
    
    np.random.seed(42)
    
    true_k = 100.0
    true_zeta = 0.05
    m = 1.0
    fs = 100.0
    duration = 10.0
    x0 = 0.1
    noise_level = 0.05
    
    print(f"\n生成测试数据:")
    print(f"  真实k: {true_k} N/m")
    print(f"  真实ζ: {true_zeta}")
    print(f"  质量: {m} kg")
    print(f"  采样率: {fs} Hz")
    print(f"  噪声水平: {noise_level*100:.0f}%")
    
    t, x, meta = generate_test_data(
        m=m,
        k=true_k,
        zeta=true_zeta,
        fs=fs,
        duration=duration,
        x0=x0,
        noise_level=noise_level
    )
    
    print(f"  数据点数: {len(t)}")
    print(f"  阻尼类型: {meta['damping_type']}")
    print(f"  估计SNR: {meta['snr']:.1f} dB")
    
    fitter = SpringDamperFitter(output_dir="demo_output")
    fitter.load_data(
        t=t,
        x=x,
        m=m,
        sample_id="demo_sample_001",
        noise_marker=f"{noise_level*100:.0f}pct_noise"
    )
    
    print("\n执行拟合...")
    result = fitter.fit(method="auto")
    fitter.print_summary()
    
    print(f"\n拟合误差:")
    print(f"  k误差: {abs(result.k - true_k) / true_k * 100:.4f}%")
    print(f"  ζ误差: {abs(result.zeta - true_zeta) / true_zeta * 100:.4f}%")
    
    print("\n导出报告...")
    report, outputs = fitter.export_report()
    
    print(f"\n导出文件:")
    for name, path in outputs.items():
        print(f"  {name}: {path}")
    
    print("\n" + "=" * 60)
    print("演示完成!")
    print("=" * 60)
    
    return fitter, report, outputs


if __name__ == "__main__":
    run_demo()
