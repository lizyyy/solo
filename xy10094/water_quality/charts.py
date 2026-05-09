"""图表生成模块"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import base64
import io
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

plt.rcParams["font.sans-serif"] = ["Arial Unicode MS", "SimHei", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False


@dataclass
class ChartResult:
    """图表结果"""
    name: str
    title: str
    image_base64: str = ""
    image_path: str = ""
    chart_type: str = ""
    description: str = ""


class ChartGenerator:
    """图表生成器 - 生成 Base64 编码图表"""

    def generate_all_charts(self, df: pd.DataFrame, qc_result) -> List[ChartResult]:
        """生成所有图表"""
        charts = []

        try:
            charts.append(self._generate_sample_type_distribution(df))
        except Exception as e:
            pass

        try:
            charts.append(self._generate_parameter_boxplot(df))
        except Exception as e:
            pass

        try:
            charts.append(self._generate_qc_summary_chart(qc_result))
        except Exception as e:
            pass

        try:
            if len(qc_result.failures) > 0:
                charts.append(self._generate_failures_chart(qc_result))
        except Exception as e:
            pass

        return charts

    def _generate_sample_type_distribution(self, df: pd.DataFrame) -> ChartResult:
        """样品类型分布饼图"""
        if "sample_type" not in df.columns:
            return ChartResult(name="sample_type_dist", title="样品类型分布", description="无 sample_type 列")

        type_counts = df["sample_type"].value_counts()
        labels_map = {"blank": "空白样", "parallel": "平行样", "spike": "加标回收", "sample": "样品"}
        labels = [labels_map.get(str(t), str(t)) for t in type_counts.index]

        fig, ax = plt.subplots(figsize=(8, 6))
        colors = ["#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#607D8B"]
        wedges, texts, autotexts = ax.pie(
            type_counts.values,
            labels=labels,
            autopct="%1.1f%%",
            colors=colors[:len(type_counts)],
            startangle=90,
            textprops={"fontsize": 10}
        )
        ax.set_title("样品类型分布", fontsize=14, fontweight="bold")
        ax.axis("equal")

        return ChartResult(
            name="sample_type_dist",
            title="样品类型分布",
            image_base64=self._fig_to_base64(fig),
            chart_type="pie",
            description=f"共 {len(df)} 个样品",
        )

    def _generate_parameter_boxplot(self, df: pd.DataFrame) -> ChartResult:
        """各检测项目箱线图"""
        if "parameter" not in df.columns or "value" not in df.columns:
            return ChartResult(name="parameter_boxplot", title="各指标分布", description="缺少必要列")

        parameters = df["parameter"].unique()
        if len(parameters) == 0:
            return ChartResult(name="parameter_boxplot", title="各指标分布", description="无检测指标")

        n_params = min(len(parameters), 10)
        fig, axes = plt.subplots(1, 1, figsize=(12, 6))

        data_list = []
        labels = []
        for param in parameters[:10]:
            vals = df[df["parameter"] == param]["value"].dropna().values
            if len(vals) > 0:
                data_list.append(vals)
                labels.append(str(param)[:15])

        if len(data_list) == 0:
            plt.close(fig)
            return ChartResult(name="parameter_boxplot", title="各指标分布", description="无有效数据")

        bp = axes.boxplot(data_list, patch_artist=True, labels=labels, showfliers=True)

        colors = ["#E3F2FD", "#BBDEFB", "#90CAF9", "#64B5F6", "#42A5F5"]
        for i, patch in enumerate(bp["boxes"]):
            patch.set_facecolor(colors[i % len(colors)])
            patch.set_alpha(0.7)

        for flier in bp["fliers"]:
            flier.set(marker="o", markerfacecolor="red", markersize=6, alpha=0.6)

        axes.set_title("各检测指标值分布 (异常值以红点标记)", fontsize=14, fontweight="bold")
        axes.set_ylabel("检测值", fontsize=12)
        axes.set_xticklabels(labels, rotation=45, ha="right")
        axes.grid(True, alpha=0.3, axis="y")
        plt.tight_layout()

        return ChartResult(
            name="parameter_boxplot",
            title="各指标分布箱线图",
            image_base64=self._fig_to_base64(fig),
            chart_type="boxplot",
            description=f"显示前 {len(data_list)} 个指标",
        )

    def _generate_qc_summary_chart(self, qc_result) -> ChartResult:
        """质控检查结果摘要条形图"""
        check_names = [c.rule_name for c in qc_result.checks]
        passed = [1 if c.passed else 0 for c in qc_result.checks]
        failure_counts = [len(c.failures) for c in qc_result.checks]

        if not check_names:
            return ChartResult(name="qc_summary", title="质控检查摘要", description="无质控检查")

        fig, ax = plt.subplots(figsize=(10, 6))
        x = np.arange(len(check_names))
        width = 0.35

        colors_pass = ["#4CAF50" if p else "#F44336" for p in passed]
        bars = ax.bar(x, [1] * len(check_names), width, color=colors_pass, alpha=0.7)

        ax.set_ylim(0, max(failure_counts) if max(failure_counts) > 0 else ax.set_ylim(0, 1))
        ax.set_xticks(x)
        ax.set_xticklabels(check_names, rotation=30, ha="right")
        ax.set_title("质控检查结果摘要", fontsize=14, fontweight="bold")
        ax.set_ylabel("通过情况", fontsize=12)

        if max(failure_counts) > 0:
            ax2 = ax.twinx()
            ax2.bar(x + width, failure_counts, width, color="#FF9800", alpha=0.5, label="失败数")
            ax2.set_ylabel("失败数量", fontsize=12)

        pass_patch = mpatches.Patch(color="#4CAF50", label="通过")
        fail_patch = mpatches.Patch(color="#F44336", label="不通过")
        count_patch = mpatches.Patch(color="#FF9800", label="失败数量")
        ax.legend(handles=[pass_patch, fail_patch, count_patch], loc="upper right")

        plt.tight_layout()

        return ChartResult(
            name="qc_summary",
            title="质控检查摘要",
            image_base64=self._fig_to_base64(fig),
            chart_type="bar",
            description=f"{sum(passed)}/{len(check_names)} 项检查通过",
        )

    def _generate_failures_chart(self, qc_result) -> ChartResult:
        """失败类型分布"""
        failure_types = {}
        for f in qc_result.failures:
            failure_types[f.failure_type] = failure_types.get(f.failure_type, 0) + 1

        if not failure_types:
            return ChartResult(name="failures", title="失败类型分布", description="无失败")

        fig, ax = plt.subplots(figsize=(10, 6))
        types_list = list(failure_types.keys())
        counts = list(failure_types.values())

        colors = plt.cm.Set3(np.linspace(0, 1, len(types_list)))
        bars = ax.barh(types_list, counts, color=colors, alpha=0.8)

        ax.set_xlabel("数量", fontsize=12)
        ax.set_title("失败类型分布", fontsize=14, fontweight="bold")
        ax.invert_yaxis()

        for i, (bar, count) in enumerate(zip(bars, counts)):
            ax.text(count, i, f" {count}", va="center", fontweight="bold")

        plt.tight_layout()

        return ChartResult(
            name="failures",
            title="失败类型分布",
            image_base64=self._fig_to_base64(fig),
            chart_type="barh",
            description=f"共 {sum(counts)} 个失败",
        )

    def _fig_to_base64(self, fig) -> str:
        """将 matplotlib 图转换为 base64"""
        buffer = io.BytesIO()
        fig.savefig(buffer, format="png", dpi=120, bbox_inches="tight")
        plt.close(fig)
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode("utf-8")
        return image_base64
