import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from typing import Optional, Dict, Any
import io
from parameter_fitting import FittingResult
from residual_diagnosis import ResidualAnalysis


class VibrationVisualizer:
    def __init__(self, t: np.ndarray, x_measured: np.ndarray, dpi: int = 100):
        self.t = t
        self.x_measured = x_measured
        self.dpi = dpi
        plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False
    
    def plot_fitted_comparison(
        self,
        fitting_result: FittingResult,
        title: str = "位移曲线拟合对比",
        highlight_anomalies: Optional[list] = None
    ) -> plt.Figure:
        fig, ax = plt.subplots(figsize=(12, 6), dpi=self.dpi)
        
        ax.plot(self.t, self.x_measured, 'b-', label='实测数据', alpha=0.7, linewidth=1.5)
        ax.plot(self.t, fitting_result.fitted_curve, 'r--', label='拟合曲线', linewidth=2)
        
        if highlight_anomalies and len(highlight_anomalies) > 0:
            ax.scatter(
                self.t[highlight_anomalies],
                self.x_measured[highlight_anomalies],
                c='orange',
                s=100,
                marker='*',
                label='异常点',
                zorder=5
            )
        
        ax.set_xlabel('时间 (s)', fontsize=12)
        ax.set_ylabel('位移 (m)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3)
        
        info_text = (
            f"拟合方法: {fitting_result.method}\n"
            f"弹簧常数 k = {fitting_result.k:.4f} N/m\n"
            f"阻尼比 ζ = {fitting_result.zeta:.6f}\n"
            f"阻尼类型: {fitting_result.damping_type}\n"
            f"R² = {fitting_result.r_squared:.6f}\n"
            f"RMSE = {fitting_result.rmse:.6f} m"
        )
        ax.text(
            0.02, 0.98, info_text,
            transform=ax.transAxes,
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8),
            verticalalignment='top',
            fontsize=10
        )
        
        plt.tight_layout()
        return fig
    
    def plot_residual_analysis(
        self,
        residual_analysis: ResidualAnalysis,
        fitting_result: FittingResult
    ) -> plt.Figure:
        fig = plt.figure(figsize=(14, 10), dpi=self.dpi)
        gs = GridSpec(2, 2, figure=fig)
        
        ax1 = fig.add_subplot(gs[0, 0])
        ax1.plot(self.t, residual_analysis.residuals, 'g-', alpha=0.7)
        ax1.axhline(y=0, color='r', linestyle='--', linewidth=1)
        ax1.axhline(y=2 * residual_analysis.std_residual, color='orange', linestyle='--', alpha=0.5)
        ax1.axhline(y=-2 * residual_analysis.std_residual, color='orange', linestyle='--', alpha=0.5)
        ax1.set_xlabel('时间 (s)', fontsize=10)
        ax1.set_ylabel('残差', fontsize=10)
        ax1.set_title('残差时序图', fontsize=12, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        
        if len(residual_analysis.anomaly_indices) > 0:
            ax1.scatter(
                self.t[residual_analysis.anomaly_indices],
                residual_analysis.residuals[residual_analysis.anomaly_indices],
                c='red',
                s=50,
                marker='o',
                label='异常残差',
                zorder=5
            )
            ax1.legend(fontsize=8)
        
        ax2 = fig.add_subplot(gs[0, 1])
        n, bins, patches = ax2.hist(
            residual_analysis.residuals,
            bins='auto',
            density=True,
            alpha=0.7,
            color='skyblue',
            edgecolor='black'
        )
        
        from scipy.stats import norm
        x_range = np.linspace(
            np.min(residual_analysis.residuals),
            np.max(residual_analysis.residuals),
            100
        )
        ax2.plot(
            x_range,
            norm.pdf(x_range, residual_analysis.mean_residual, residual_analysis.std_residual),
            'r-',
            linewidth=2,
            label='正态分布拟合'
        )
        ax2.set_xlabel('残差', fontsize=10)
        ax2.set_ylabel('概率密度', fontsize=10)
        ax2.set_title('残差直方图', fontsize=12, fontweight='bold')
        ax2.legend(fontsize=8)
        ax2.grid(True, alpha=0.3)
        
        ax3 = fig.add_subplot(gs[1, 0])
        ax3.scatter(fitting_result.fitted_curve, residual_analysis.residuals, alpha=0.6, s=20)
        ax3.axhline(y=0, color='r', linestyle='--', linewidth=1)
        ax3.set_xlabel('拟合值', fontsize=10)
        ax3.set_ylabel('残差', fontsize=10)
        ax3.set_title('残差vs拟合值', fontsize=12, fontweight='bold')
        ax3.grid(True, alpha=0.3)
        
        ax4 = fig.add_subplot(gs[1, 1])
        stats_text = (
            f"残差统计量\n\n"
            f"均值: {residual_analysis.mean_residual:.6f}\n"
            f"标准差: {residual_analysis.std_residual:.6f}\n"
            f"最大绝对值: {residual_analysis.max_abs_residual:.6f}\n"
            f"偏度: {residual_analysis.skewness:.4f}\n"
            f"峰度: {residual_analysis.kurtosis:.4f}\n\n"
            f"JB检验p值: {residual_analysis.jarque_bera_pvalue:.4f}\n"
            f"DW统计量: {residual_analysis.durbin_watson:.4f}\n\n"
            f"正态性: {'通过' if residual_analysis.is_normal else '未通过'}\n"
            f"独立性: {'通过' if residual_analysis.is_independent else '未通过'}\n"
            f"异方差: {'存在' if residual_analysis.has_heteroscedasticity else '不存在'}\n"
            f"异常点数量: {len(residual_analysis.anomaly_indices)}"
        )
        ax4.text(
            0.5, 0.5, stats_text,
            transform=ax4.transAxes,
            ha='center', va='center',
            bbox=dict(boxstyle='round', facecolor='lightgray', alpha=0.8),
            fontsize=10,
            family='monospace'
        )
        ax4.axis('off')
        ax4.set_title('诊断统计', fontsize=12, fontweight='bold')
        
        plt.tight_layout()
        return fig
    
    def plot_peak_analysis(
        self,
        peak_info: Dict[str, Any],
        title: str = "峰值分析"
    ) -> plt.Figure:
        fig, ax = plt.subplots(figsize=(12, 5), dpi=self.dpi)
        
        ax.plot(self.t, self.x_measured, 'b-', label='位移曲线', alpha=0.6)
        
        if peak_info.get('all_peaks'):
            all_peak_indices = np.array(peak_info['all_peaks'])
            ax.scatter(
                self.t[all_peak_indices],
                self.x_measured[all_peak_indices],
                c='green',
                s=80,
                marker='^',
                label='检测到的峰值',
                zorder=5
            )
        
        if peak_info.get('anomalous_peaks'):
            anomalous_indices = np.array(peak_info['anomalous_peaks'])
            ax.scatter(
                self.t[anomalous_indices],
                self.x_measured[anomalous_indices],
                c='red',
                s=150,
                marker='x',
                label='异常峰值',
                zorder=10,
                linewidths=3
            )
        
        ax.set_xlabel('时间 (s)', fontsize=12)
        ax.set_ylabel('位移 (m)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3)
        
        info_text = (
            f"检测到峰值: {peak_info.get('num_peaks', 0)} 个\n"
            f"异常峰值: {peak_info.get('num_anomalous', 0)} 个"
        )
        ax.text(
            0.02, 0.98, info_text,
            transform=ax.transAxes,
            bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8),
            verticalalignment='top',
            fontsize=10
        )
        
        plt.tight_layout()
        return fig
    
    def plot_comprehensive_report(
        self,
        fitting_result: FittingResult,
        residual_analysis: ResidualAnalysis,
        peak_info: Optional[Dict[str, Any]] = None,
        title: str = "弹簧阻尼拟合综合报告"
    ) -> plt.Figure:
        fig = plt.figure(figsize=(16, 12), dpi=self.dpi)
        gs = GridSpec(3, 2, figure=fig, hspace=0.3, wspace=0.25)
        
        ax1 = fig.add_subplot(gs[0, :])
        ax1.plot(self.t, self.x_measured, 'b-', label='实测数据', alpha=0.7, linewidth=1.5)
        ax1.plot(self.t, fitting_result.fitted_curve, 'r--', label='拟合曲线', linewidth=2)
        
        if len(residual_analysis.anomaly_indices) > 0:
            ax1.scatter(
                self.t[residual_analysis.anomaly_indices],
                self.x_measured[residual_analysis.anomaly_indices],
                c='orange',
                s=80,
                marker='*',
                label='异常点',
                zorder=5
            )
        
        ax1.set_xlabel('时间 (s)', fontsize=11)
        ax1.set_ylabel('位移 (m)', fontsize=11)
        ax1.set_title(title, fontsize=16, fontweight='bold')
        ax1.legend(fontsize=10, loc='upper right')
        ax1.grid(True, alpha=0.3)
        
        param_text = (
            f"k = {fitting_result.k:.4f} N/m  |  "
            f"ζ = {fitting_result.zeta:.6f}  |  "
            f"ω_n = {fitting_result.omega_n:.4f} rad/s  |  "
            f"c = {fitting_result.c:.4f} Ns/m\n"
            f"阻尼类型: {fitting_result.damping_type}  |  "
            f"R² = {fitting_result.r_squared:.6f}  |  "
            f"RMSE = {fitting_result.rmse:.6f} m  |  "
            f"方法: {fitting_result.method}"
        )
        ax1.text(
            0.5, -0.15, param_text,
            transform=ax1.transAxes,
            ha='center',
            bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.8),
            fontsize=10
        )
        
        ax2 = fig.add_subplot(gs[1, 0])
        ax2.plot(self.t, residual_analysis.residuals, 'g-', alpha=0.7)
        ax2.axhline(y=0, color='r', linestyle='--', linewidth=1)
        ax2.axhline(y=2 * residual_analysis.std_residual, color='orange', linestyle='--', alpha=0.5)
        ax2.axhline(y=-2 * residual_analysis.std_residual, color='orange', linestyle='--', alpha=0.5)
        ax2.set_xlabel('时间 (s)', fontsize=10)
        ax2.set_ylabel('残差', fontsize=10)
        ax2.set_title('残差时序', fontsize=12, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        
        ax3 = fig.add_subplot(gs[1, 1])
        n, bins, patches = ax3.hist(
            residual_analysis.residuals,
            bins='auto',
            density=True,
            alpha=0.7,
            color='skyblue',
            edgecolor='black'
        )
        from scipy.stats import norm
        x_range = np.linspace(
            np.min(residual_analysis.residuals),
            np.max(residual_analysis.residuals),
            100
        )
        ax3.plot(
            x_range,
            norm.pdf(x_range, residual_analysis.mean_residual, residual_analysis.std_residual),
            'r-',
            linewidth=2
        )
        ax3.set_xlabel('残差', fontsize=10)
        ax3.set_ylabel('概率密度', fontsize=10)
        ax3.set_title('残差分布', fontsize=12, fontweight='bold')
        ax3.grid(True, alpha=0.3)
        
        ax4 = fig.add_subplot(gs[2, 0])
        ax4.scatter(fitting_result.fitted_curve, residual_analysis.residuals, alpha=0.6, s=20)
        ax4.axhline(y=0, color='r', linestyle='--', linewidth=1)
        ax4.set_xlabel('拟合值', fontsize=10)
        ax4.set_ylabel('残差', fontsize=10)
        ax4.set_title('残差vs拟合值', fontsize=12, fontweight='bold')
        ax4.grid(True, alpha=0.3)
        
        ax5 = fig.add_subplot(gs[2, 1])
        diagnosis_text = (
            f"=== 诊断结果 ===\n\n"
            f"[正态性检验]\n"
            f"  JB p值: {residual_analysis.jarque_bera_pvalue:.4f}\n"
            f"  结论: {'通过' if residual_analysis.is_normal else '未通过'}\n\n"
            f"[独立性检验]\n"
            f"  DW统计: {residual_analysis.durbin_watson:.4f}\n"
            f"  结论: {'通过' if residual_analysis.is_independent else '未通过'}\n\n"
            f"[异方差性]\n"
            f"  结论: {'存在异方差' if residual_analysis.has_heteroscedasticity else '方差齐性'}\n\n"
            f"[异常检测]\n"
            f"  异常点数量: {len(residual_analysis.anomaly_indices)}\n"
            f"  残差均值: {residual_analysis.mean_residual:.6f}\n"
            f"  残差标准差: {residual_analysis.std_residual:.6f}"
        )
        ax5.text(
            0.05, 0.5, diagnosis_text,
            transform=ax5.transAxes,
            va='center',
            bbox=dict(boxstyle='round', facecolor='lightgray', alpha=0.8),
            fontsize=9,
            family='monospace'
        )
        ax5.axis('off')
        ax5.set_title('诊断详情', fontsize=12, fontweight='bold')
        
        return fig
    
    def save_figure(self, fig: plt.Figure, filepath: str, close: bool = True) -> None:
        fig.savefig(filepath, dpi=self.dpi, bbox_inches='tight')
        if close:
            plt.close(fig)
    
    def figure_to_bytes(self, fig: plt.Figure, format: str = 'png') -> bytes:
        buf = io.BytesIO()
        fig.savefig(buf, format=format, dpi=self.dpi, bbox_inches='tight')
        buf.seek(0)
        return buf.getvalue()
