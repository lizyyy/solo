import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Rectangle
import seaborn as sns
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from matplotlib.backends.backend_pdf import PdfPages
from .quality_control import DEFAULT_QC_CONFIG

sns.set_style("whitegrid")
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False


class Visualizer:
    def __init__(
        self,
        config: Optional[Dict[str, Any]] = None,
        figsize: tuple = (14, 10),
        dpi: int = 100,
    ):
        self.config = config or DEFAULT_QC_CONFIG
        self.figsize = figsize
        self.dpi = dpi
        self.parameter_colors = {
            "pH": "#2E86AB",
            "temperature": "#F24236",
            "dissolved_oxygen": "#35A7FF",
        }
        self.status_colors = {
            "PASS": "#2ECC71",
            "WARNING": "#F39C12",
            "FAIL": "#E74C3C",
            "ERROR": "#9B59B6",
        }

    def plot_single_parameter_curve(
        self,
        ax: plt.Axes,
        df: pd.DataFrame,
        parameter: str,
        y_label: str,
        color: str,
        highlight_violations: Optional[Dict] = None,
        show_range: bool = True,
    ) -> plt.Axes:
        time_col = "time" if "time" in df.columns else df.columns[0]
        valid_data = df[[time_col, parameter]].dropna()

        ax.plot(
            valid_data[time_col],
            valid_data[parameter],
            color=color,
            linewidth=2,
            marker='o',
            markersize=4,
            label=y_label,
        )

        if show_range and parameter in self.config:
            param_config = self.config[parameter]
            if "normal_range" in param_config:
                min_val, max_val = param_config["normal_range"]
                ax.axhspan(
                    min_val, max_val,
                    alpha=0.1,
                    color=color,
                    label=f"正常范围: [{min_val}, {max_val}]",
                )
            if "warning_range" in param_config:
                min_warn, max_warn = param_config["warning_range"]
                ax.axhline(min_warn, color=color, linestyle='--', alpha=0.5)
                ax.axhline(max_warn, color=color, linestyle='--', alpha=0.5)

        if highlight_violations:
            for rule_name, result in highlight_violations.items():
                if result.get("status") != "PASS":
                    for violation in result.get("violations", []):
                        if "index" in violation:
                            if "time" in violation:
                                time_val = violation["time"]
                                try:
                                    value = violation.get("value", 0)
                                    ax.scatter(
                                        [time_val],
                                        [value],
                                        color='red',
                                        s=100,
                                        zorder=5,
                                        label=f"{rule_name} 违规",
                                    )
                                except:
                                    pass

        ax.set_xlabel("时间 (小时)", fontsize=11)
        ax.set_ylabel(y_label, fontsize=11)
        ax.legend(loc='best', fontsize=9)
        ax.grid(True, alpha=0.3)

        return ax

    def plot_sample_curves(
        self,
        df: pd.DataFrame,
        sample_id: str,
        qc_result: Optional[Dict] = None,
    ) -> plt.Figure:
        fig, axes = plt.subplots(3, 1, figsize=self.figsize, sharex=True)
        fig.suptitle(f"样本 {sample_id} 发酵曲线", fontsize=16, fontweight='bold')

        param_info = [
            ("pH", "pH 值", "#2E86AB"),
            ("temperature", "温度 (°C)", "#F24236"),
            ("dissolved_oxygen", "溶氧 (%)", "#35A7FF"),
        ]

        for ax, (param, y_label, color) in zip(axes, param_info):
            if param in df.columns:
                violations = None
                if qc_result and "parameters" in qc_result:
                    violations = qc_result["parameters"].get(param)
                self.plot_single_parameter_curve(
                    ax, df, param, y_label, color, violations
                )

        plt.tight_layout()
        return fig

    def plot_quality_distribution(
        self,
        qc_summary: Dict[str, Any],
    ) -> plt.Figure:
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        status_data = {
            "通过": qc_summary.get("pass_count", 0),
            "警告": qc_summary.get("warning_count", 0),
            "失败": qc_summary.get("fail_count", 0),
        }
        colors = ['#2ECC71', '#F39C12', '#E74C3C']

        ax1 = axes[0]
        labels = list(status_data.keys())
        values = list(status_data.values())
        wedges, texts, autotexts = ax1.pie(
            values,
            labels=labels,
            colors=colors,
            autopct='%1.1f%%',
            startangle=90,
            textprops={'fontsize': 11},
        )
        ax1.set_title("样本质量分布", fontsize=14, fontweight='bold')

        ax2 = axes[1]
        bars = ax2.bar(
            labels,
            values,
            color=colors,
            alpha=0.8,
        )

        for bar, value in zip(bars, values):
            ax2.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + max(values) * 0.02,
                str(value),
                ha='center',
                va='bottom',
                fontsize=12,
            )

        ax2.set_title("样本质量计数", fontsize=14, fontweight='bold')
        ax2.set_ylabel("样本数量", fontsize=11)
        ax2.grid(axis='y', alpha=0.3)

        plt.tight_layout()
        return fig

    def plot_parameter_statistics(
        self,
        processed_samples: Dict[str, Any],
    ) -> plt.Figure:
        parameters = ["pH", "temperature", "dissolved_oxygen"]
        fig, axes = plt.subplots(1, 3, figsize=(16, 5))

        param_labels = ["pH", "温度 (°C)", "溶氧 (%)"]

        for ax, param, label in zip(axes, parameters, param_labels):
            values = []
            sample_ids = []

            for sample_id, data in processed_samples.items():
                if not data.get("success", False):
                    continue
                df = data["dataframe"]
                if param in df.columns:
                    values.append(df[param].mean())
                    sample_ids.append(sample_id)

            if values:
                colors = ['#2E86AB'] * len(values)
                ax.bar(range(len(values)), values, color=colors, alpha=0.7)
                ax.axhline(
                    y=np.mean(values),
                    color='red',
                    linestyle='--',
                    alpha=0.7,
                    label=f'均值: {np.mean(values):.2f}',
                )
                ax.set_title(f"{label} 均值分布", fontsize=13, fontweight='bold')
                ax.set_xlabel("样本", fontsize=10)
                ax.set_ylabel(label, fontsize=10)
                ax.legend()
                ax.grid(axis='y', alpha=0.3)

                if len(values) <= 15:
                    ax.set_xticks(range(len(values)))
                    ax.set_xticklabels(
                        [s[-6:] if len(s) > 6 else s for s in sample_ids],
                        rotation=45,
                        fontsize=8,
                    )
            else:
                ax.text(
                    0.5, 0.5, "无数据",
                    ha='center', va='center',
                    transform=ax.transAxes, fontsize=14,
                )

        plt.tight_layout()
        return fig

    def plot_recheck_recommendations(
        self,
        qc_summary: Dict[str, Any],
    ) -> plt.Figure:
        fig, ax = plt.subplots(figsize=(10, 6))

        recheck_samples = qc_summary.get("recheck_samples", [])
        failed_samples = qc_summary.get("failed_samples", [])

        if not recheck_samples and not failed_samples:
            ax.text(
                0.5, 0.5,
                "所有样本通过质控，无需复检",
                ha='center', va='center',
                transform=ax.transAxes,
                fontsize=16,
                color='#2ECC71',
            )
            ax.axis('off')
            return fig

        samples_for_table = []

        for sample in recheck_samples:
            samples_for_table.append({
                "样本ID": sample["sample_id"],
                "状态": sample.get("status", "UNKNOWN"),
                "原因": sample.get("reason", ""),
            })

        for sample in failed_samples:
            samples_for_table.append({
                "样本ID": sample["sample_id"],
                "状态": "预处理失败",
                "原因": sample.get("reason", ""),
            })

        ax.axis('tight')
        ax.axis('off')

        table_data = []
        row_colors = []
        for s in samples_for_table:
            table_data.append([
                s["样本ID"],
                s["状态"],
                s["原因"][:50] + "..." if len(s["原因"]) > 50 else s["原因"],
            ])
            if s["状态"] in ["FAIL", "ERROR", "预处理失败"]:
                row_colors.append('#FDEDEC')
            elif s["状态"] == "WARNING":
                row_colors.append('#FEF9E7')
            else:
                row_colors.append('#EAF2F8')

        if table_data:
            table = ax.table(
                cellText=table_data,
                colLabels=["样本ID", "状态", "复检原因"],
                cellLoc='left',
                loc='center',
                rowColours=row_colors,
                colColours=['#D6EAF8', '#D6EAF8', '#D6EAF8'],
            )
            table.auto_set_font_size(False)
            table.set_fontsize(10)
            table.scale(1, 1.5)

        ax.set_title("需复检样本列表", fontsize=14, fontweight='bold', pad=20)
        return fig

    def export_pdf_report(
        self,
        processed_samples: Dict[str, Any],
        qc_results: Dict[str, Any],
        output_path: str,
    ) -> None:
        with PdfPages(output_path) as pdf:
            qc_summary = qc_results.get("summary", {})
            fig = self.plot_quality_distribution(qc_summary)
            pdf.savefig(fig, bbox_inches='tight')
            plt.close(fig)

            fig = self.plot_parameter_statistics(processed_samples)
            pdf.savefig(fig, bbox_inches='tight')
            plt.close(fig)

            fig = self.plot_recheck_recommendations(qc_summary)
            pdf.savefig(fig, bbox_inches='tight')
            plt.close(fig)

            for sample_id, data in processed_samples.items():
                if not data.get("success", False):
                    continue

                df = data["dataframe"]
                qc_result = qc_results.get("results", {}).get(sample_id, {})

                fig = self.plot_sample_curves(df, sample_id, qc_result)

                status = qc_result.get("overall_status", "UNKNOWN")
                recheck = "需要复检" if qc_result.get("requires_recheck", False) else "无需复检"

                fig.text(
                    0.02, 0.98,
                    f"状态: {status} | {recheck}",
                    fontsize=12,
                    ha='left', va='top',
                    bbox=dict(
                        boxstyle='round,pad=0.5',
                        facecolor=self.status_colors.get(status, '#CCCCCC'),
                        alpha=0.3,
                    ),
                )

                pdf.savefig(fig, bbox_inches='tight')
                plt.close(fig)

    def save_sample_plot(
        self,
        df: pd.DataFrame,
        sample_id: str,
        output_path: str,
        qc_result: Optional[Dict] = None,
    ) -> None:
        fig = self.plot_sample_curves(df, sample_id, qc_result)
        fig.savefig(output_path, dpi=self.dpi, bbox_inches='tight')
        plt.close(fig)
