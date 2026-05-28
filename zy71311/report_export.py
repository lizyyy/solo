import os
import json
import csv
import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict, field
import pandas as pd

from parameter_fitting import FittingResult
from residual_diagnosis import ResidualAnalysis


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        return super().default(obj)


@dataclass
class FittingReport:
    report_id: str
    timestamp: str
    version: int
    sample_id: str
    
    input_params: Dict[str, Any]
    sampling_quality: Dict[str, Any]
    
    fitting_results: Dict[str, Any]
    intermediate_data: Dict[str, Any]
    
    residual_analysis: Dict[str, Any]
    peak_analysis: Dict[str, Any]
    overdamping_diagnosis: Dict[str, Any]
    
    quality_flags: Dict[str, bool]
    warnings: List[str]
    
    raw_data_hash: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class VersionManager:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = output_dir
        self.ensure_directories()
    
    def ensure_directories(self):
        dirs = [
            self.output_dir,
            os.path.join(self.output_dir, "reports"),
            os.path.join(self.output_dir, "figures"),
            os.path.join(self.output_dir, "data"),
            os.path.join(self.output_dir, "archive")
        ]
        for d in dirs:
            os.makedirs(d, exist_ok=True)
    
    def get_next_version(self, sample_id: str) -> int:
        import re
        report_dir = os.path.join(self.output_dir, "reports")
        existing_versions = []
        
        if os.path.exists(report_dir):
            pattern = re.compile(rf"report_{re.escape(sample_id)}_v(\d+)_.*\.json")
            for filename in os.listdir(report_dir):
                match = pattern.match(filename)
                if match:
                    try:
                        existing_versions.append(int(match.group(1)))
                    except (ValueError):
                        continue
        
        return max(existing_versions) + 1 if existing_versions else 1
    
    def generate_report_id(self, sample_id: str, version: int) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{sample_id}_v{version:03d}_{timestamp}"


class ReportExporter:
    def __init__(self, output_dir: str = "output"):
        self.version_manager = VersionManager(output_dir)
        self.output_dir = output_dir
    
    @staticmethod
    def calculate_data_hash(data: np.ndarray) -> str:
        return str(hash(data.tobytes()))
    
    def create_report(
        self,
        t: np.ndarray,
        x: np.ndarray,
        m: float,
        fs: float,
        x0: float,
        sample_id: str,
        fitting_result: FittingResult,
        residual_analysis: ResidualAnalysis,
        sampling_quality: Dict[str, Any],
        peak_analysis: Dict[str, Any],
        overdamping_diagnosis: Dict[str, Any],
        noise_marker: str = "unknown"
    ) -> FittingReport:
        version = self.version_manager.get_next_version(sample_id)
        report_id = self.version_manager.generate_report_id(sample_id, version)
        
        input_params = {
            "mass_kg": m,
            "sampling_rate_hz": fs,
            "initial_displacement_m": x0,
            "noise_marker": noise_marker,
            "num_data_points": len(t),
            "duration_s": float(t[-1] - t[0]) if len(t) > 1 else 0.0
        }
        
        fitting_dict = {
            "spring_constant_k_Nm": fitting_result.k,
            "damping_ratio_zeta": fitting_result.zeta,
            "mass_m_kg": fitting_result.m,
            "natural_frequency_omega_n_radps": fitting_result.omega_n,
            "damped_frequency_omega_d_radps": fitting_result.omega_d,
            "damping_coefficient_c_Nsm": fitting_result.c,
            "damping_type": fitting_result.damping_type,
            "fitting_method": fitting_result.method,
            "r_squared": fitting_result.r_squared,
            "rmse_m": fitting_result.rmse,
            "nrmse": fitting_result.nrmse
        }
        
        intermediate_simplified = {}
        for key, value in fitting_result.intermediate_data.items():
            if isinstance(value, np.ndarray):
                intermediate_simplified[key] = value.tolist()
            elif isinstance(value, (int, float, str, list, dict)):
                intermediate_simplified[key] = value
            else:
                intermediate_simplified[key] = str(value)
        
        residual_dict = {
            "mean_residual": float(residual_analysis.mean_residual),
            "std_residual": float(residual_analysis.std_residual),
            "max_abs_residual": float(residual_analysis.max_abs_residual),
            "skewness": float(residual_analysis.skewness),
            "kurtosis": float(residual_analysis.kurtosis),
            "jarque_bera_pvalue": float(residual_analysis.jarque_bera_pvalue),
            "durbin_watson": float(residual_analysis.durbin_watson),
            "anomaly_indices": residual_analysis.anomaly_indices,
            "is_normal": residual_analysis.is_normal,
            "is_independent": residual_analysis.is_independent,
            "has_heteroscedasticity": residual_analysis.has_heteroscedasticity,
            "details": residual_analysis.details
        }
        
        quality_flags = {
            "high_r_squared": fitting_result.r_squared > 0.95,
            "normal_residuals": residual_analysis.is_normal,
            "independent_residuals": residual_analysis.is_independent,
            "no_heteroscedasticity": not residual_analysis.has_heteroscedasticity,
            "no_anomalies": len(residual_analysis.anomaly_indices) == 0,
            "good_sampling_rate": sampling_quality.get("quality") == "良好"
        }
        
        warnings = []
        if fitting_result.r_squared < 0.9:
            warnings.append(f"R²较低: {fitting_result.r_squared:.4f}，拟合效果可能不佳")
        if len(residual_analysis.anomaly_indices) > 0:
            warnings.append(f"检测到 {len(residual_analysis.anomaly_indices)} 个异常点")
        if not residual_analysis.is_normal:
            warnings.append("残差不满足正态性假设")
        if not residual_analysis.is_independent:
            warnings.append("残差可能存在自相关")
        if residual_analysis.has_heteroscedasticity:
            warnings.append("残差可能存在异方差性")
        if sampling_quality.get("quality") in ["严重不足", "不足"]:
            warnings.append(f"采样率{sampling_quality.get('quality')}: {sampling_quality.get('recommendation')}")
        if overdamping_diagnosis.get("is_overdamped"):
            warnings.append(f"过阻尼警告: {overdamping_diagnosis.get('evidence')}")
        
        raw_data_hash = self.calculate_data_hash(x)
        
        return FittingReport(
            report_id=report_id,
            timestamp=datetime.now().isoformat(),
            version=version,
            sample_id=sample_id,
            input_params=input_params,
            sampling_quality=sampling_quality,
            fitting_results=fitting_dict,
            intermediate_data=intermediate_simplified,
            residual_analysis=residual_dict,
            peak_analysis=peak_analysis,
            overdamping_diagnosis=overdamping_diagnosis,
            quality_flags=quality_flags,
            warnings=warnings,
            raw_data_hash=raw_data_hash
        )
    
    def export_json_report(self, report: FittingReport) -> str:
        report_path = os.path.join(
            self.output_dir,
            "reports",
            f"report_{report.report_id}.json"
        )
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report.to_dict(), f, indent=2, ensure_ascii=False, cls=NumpyEncoder)
        return report_path
    
    def export_csv_data(
        self,
        t: np.ndarray,
        x_measured: np.ndarray,
        x_fitted: np.ndarray,
        residuals: np.ndarray,
        report: FittingReport,
        filtered_mask: Optional[np.ndarray] = None
    ) -> str:
        if filtered_mask is not None:
            t = t[filtered_mask]
            x_measured = x_measured[filtered_mask]
            x_fitted = x_fitted[filtered_mask]
            residuals = residuals[filtered_mask]
        
        df = pd.DataFrame({
            'time_s': t,
            'measured_displacement_m': x_measured,
            'fitted_displacement_m': x_fitted,
            'residual_m': residuals
        })
        
        data_path = os.path.join(
            self.output_dir,
            "data",
            f"data_{report.report_id}.csv"
        )
        df.to_csv(data_path, index=False, encoding='utf-8-sig')
        return data_path
    
    def export_summary_csv(self, reports: List[FittingReport], filename: str = "summary.csv") -> str:
        rows = []
        for report in reports:
            row = {
                'report_id': report.report_id,
                'sample_id': report.sample_id,
                'version': report.version,
                'timestamp': report.timestamp,
                'k_Nm': report.fitting_results['spring_constant_k_Nm'],
                'zeta': report.fitting_results['damping_ratio_zeta'],
                'omega_n_radps': report.fitting_results['natural_frequency_omega_n_radps'],
                'c_Nsm': report.fitting_results['damping_coefficient_c_Nsm'],
                'damping_type': report.fitting_results['damping_type'],
                'r_squared': report.fitting_results['r_squared'],
                'rmse_m': report.fitting_results['rmse_m'],
                'num_warnings': len(report.warnings)
            }
            rows.append(row)
        
        df = pd.DataFrame(rows)
        summary_path = os.path.join(self.output_dir, filename)
        df.to_csv(summary_path, index=False, encoding='utf-8-sig')
        return summary_path
    
    def export_text_report(self, report: FittingReport) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("弹簧阻尼系统拟合报告")
        lines.append("=" * 60)
        lines.append(f"报告ID: {report.report_id}")
        lines.append(f"样本ID: {report.sample_id}")
        lines.append(f"版本: v{report.version}")
        lines.append(f"时间: {report.timestamp}")
        lines.append("")
        
        lines.append("-" * 60)
        lines.append("输入参数")
        lines.append("-" * 60)
        for key, value in report.input_params.items():
            lines.append(f"  {key}: {value}")
        lines.append("")
        
        lines.append("-" * 60)
        lines.append("采样质量评估")
        lines.append("-" * 60)
        for key, value in report.sampling_quality.items():
            lines.append(f"  {key}: {value}")
        lines.append("")
        
        lines.append("-" * 60)
        lines.append("拟合结果")
        lines.append("-" * 60)
        lines.append(f"  拟合方法: {report.fitting_results['fitting_method']}")
        lines.append(f"  弹簧常数 k = {report.fitting_results['spring_constant_k_Nm']:.6f} N/m")
        lines.append(f"  阻尼比 ζ = {report.fitting_results['damping_ratio_zeta']:.8f}")
        lines.append(f"  固有角频率 ω_n = {report.fitting_results['natural_frequency_omega_n_radps']:.6f} rad/s")
        lines.append(f"  阻尼角频率 ω_d = {report.fitting_results['damped_frequency_omega_d_radps']:.6f} rad/s")
        lines.append(f"  阻尼系数 c = {report.fitting_results['damping_coefficient_c_Nsm']:.6f} N·s/m")
        lines.append(f"  阻尼类型: {report.fitting_results['damping_type']}")
        lines.append("")
        lines.append(f"  决定系数 R² = {report.fitting_results['r_squared']:.8f}")
        lines.append(f"  均方根误差 RMSE = {report.fitting_results['rmse_m']:.8f} m")
        lines.append(f"  归一化RMSE = {report.fitting_results['nrmse']:.8f}")
        lines.append("")
        
        lines.append("-" * 60)
        lines.append("关键中间量")
        lines.append("-" * 60)
        for key, value in report.intermediate_data.items():
            if isinstance(value, list) and len(value) > 10:
                lines.append(f"  {key}: [列表长度={len(value)}]")
            else:
                lines.append(f"  {key}: {value}")
        lines.append("")
        
        lines.append("-" * 60)
        lines.append("残差诊断")
        lines.append("-" * 60)
        lines.append(f"  残差均值: {report.residual_analysis['mean_residual']:.8f}")
        lines.append(f"  残差标准差: {report.residual_analysis['std_residual']:.8f}")
        lines.append(f"  最大绝对残差: {report.residual_analysis['max_abs_residual']:.8f}")
        lines.append(f"  偏度: {report.residual_analysis['skewness']:.6f}")
        lines.append(f"  峰度: {report.residual_analysis['kurtosis']:.6f}")
        lines.append(f"  Jarque-Bera p值: {report.residual_analysis['jarque_bera_pvalue']:.6f}")
        lines.append(f"  Durbin-Watson统计: {report.residual_analysis['durbin_watson']:.6f}")
        lines.append(f"  异常点数量: {len(report.residual_analysis['anomaly_indices'])}")
        if len(report.residual_analysis['anomaly_indices']) > 0:
            lines.append(f"  异常点索引: {report.residual_analysis['anomaly_indices']}")
        lines.append("")
        
        lines.append("-" * 60)
        lines.append("质量标志")
        lines.append("-" * 60)
        for key, value in report.quality_flags.items():
            status = "✓ 通过" if value else "✗ 未通过"
            lines.append(f"  {key}: {status}")
        lines.append("")
        
        if report.warnings:
            lines.append("-" * 60)
            lines.append("警告信息")
            lines.append("-" * 60)
            for i, warning in enumerate(report.warnings, 1):
                lines.append(f"  [{i}] {warning}")
            lines.append("")
        
        lines.append("=" * 60)
        lines.append(f"原始数据哈希: {report.raw_data_hash}")
        lines.append("=" * 60)
        
        text_path = os.path.join(
            self.output_dir,
            "reports",
            f"report_{report.report_id}.txt"
        )
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        return text_path
    
    def export_all(
        self,
        report: FittingReport,
        t: np.ndarray,
        x_measured: np.ndarray,
        x_fitted: np.ndarray,
        residuals: np.ndarray,
        figures: Optional[Dict[str, Any]] = None,
        filtered_mask: Optional[np.ndarray] = None
    ) -> Dict[str, str]:
        outputs = {}
        
        outputs['json_report'] = self.export_json_report(report)
        outputs['text_report'] = self.export_text_report(report)
        outputs['csv_data'] = self.export_csv_data(
            t, x_measured, x_fitted, residuals, report, filtered_mask
        )
        
        if figures:
            from visualization import VibrationVisualizer
            visualizer = VibrationVisualizer(t, x_measured)
            for name, fig in figures.items():
                fig_path = os.path.join(
                    self.output_dir,
                    "figures",
                    f"{name}_{report.report_id}.png"
                )
                visualizer.save_figure(fig, fig_path)
                outputs[f'figure_{name}'] = fig_path
        
        return outputs
