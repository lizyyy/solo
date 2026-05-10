from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.figure import Figure

from .batch_comparator import BatchComparator
from .cupping_analyzer import CupScoreManager
from .heating_rate import HeatingRateCalculator
from .models import ReviewReport, RoastBatch


class ReportGenerator:
    """复盘报告生成器"""

    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate(
        self,
        batches: List[RoastBatch],
        report_id: Optional[str] = None,
        generate_charts: bool = True,
    ) -> ReviewReport:
        """生成复盘报告"""
        if not batches:
            raise ValueError("至少需要一个批次生成报告")

        if report_id is None:
            report_id = f"review_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        comparator = BatchComparator()
        comparison = comparator.compare(batches)

        cup_analyzer = CupScoreManager()
        correlations = cup_analyzer.analyze_correlations(batches)

        heat_calculator = HeatingRateCalculator()
        heating_profiles = [heat_calculator.calculate(b) for b in batches]

        chart_paths = []
        if generate_charts:
            chart_paths = self._generate_charts(batches, heating_profiles, report_id)

        anomalies = self._compile_anomalies(
            comparison["anomalies"], heating_profiles
        )

        recommendations = comparison["recommendations"]
        if "insights" in correlations and correlations["insights"]:
            recommendations.extend(correlations["insights"])

        report = ReviewReport(
            report_id=report_id,
            batch_ids=[b.batch_id for b in batches],
            generated_at=datetime.now(),
            summary={
                **comparison["summary"],
                "correlations": correlations.get("correlations", []),
            },
            comparison_table=comparison["comparison_table"],
            anomalies=anomalies,
            recommendations=recommendations,
            chart_paths=chart_paths,
        )

        return report

    def save_report(self, report: ReviewReport, format: str = "json") -> str:
        """保存报告到文件"""
        formats = ["json", "txt"]
        if format not in formats:
            raise ValueError(f"不支持的报告格式: {format}。支持: {formats}")

        if format == "json":
            return self._save_json_report(report)
        else:
            return self._save_text_report(report)

    def _save_json_report(self, report: ReviewReport) -> str:
        """保存 JSON 格式报告"""
        report_path = self.output_dir / f"{report.report_id}.json"

        report_dict = json.loads(report.model_dump_json())
        report_dict["calculation_methodology"] = self._get_calculation_methodology()

        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2)

        return str(report_path)

    def _save_text_report(self, report: ReviewReport) -> str:
        """保存文本格式报告"""
        report_path = self.output_dir / f"{report.report_id}.txt"

        lines = []
        lines.append("=" * 70)
        lines.append(f"咖啡豆烘焙曲线复盘报告")
        lines.append(f"报告ID: {report.report_id}")
        lines.append(f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"分析批次: {', '.join(report.batch_ids)}")
        lines.append("=" * 70)
        lines.append("")

        lines.append("【计算口径说明】")
        lines.append("-" * 70)
        for line in self._get_calculation_methodology_text().split("\n"):
            lines.append(line)
        lines.append("")

        lines.append("【摘要统计】")
        lines.append("-" * 70)
        summary = report.summary
        lines.append(f"总批次数: {len(report.batch_ids)}")
        lines.append(f"有一爆标记: {summary.get('with_first_crack', 0)}")
        lines.append(f"有杯测分数: {summary.get('with_cup_score', 0)}")

        if "avg_total_time" in summary:
            avg_time = summary["avg_total_time"]
            lines.append(
                f"平均烘焙时间: {int(avg_time // 60)}:{int(avg_time % 60):02d}"
            )
        if "avg_dropout_temp" in summary:
            lines.append(f"平均出炉温度: {summary['avg_dropout_temp']:.1f}°C")
        if "avg_fc_start_temp" in summary:
            lines.append(f"平均一爆温度: {summary['avg_fc_start_temp']:.1f}°C")
        if "avg_cup_score" in summary:
            lines.append(f"平均杯测分数: {summary['avg_cup_score']:.1f}")
            if "best_batch" in summary:
                lines.append(
                    f"最佳批次: {summary['best_batch']} "
                    f"(分数: {summary['max_cup_score']:.1f})"
                )
        lines.append("")

        lines.append("【批次对比表】")
        lines.append("-" * 70)
        headers = [
            "批次", "咖啡", "烘焙时间", "出炉温", "一爆时间",
            "一爆温", "一爆类型", "减重%", "杯测分"
        ]
        header_line = " ".join(f"{h:>10}" for h in headers)
        lines.append(header_line)
        lines.append("-" * len(header_line))

        for row in report.comparison_table:
            values = [
                str(row.get("batch_id", ""))[:10],
                str(row.get("coffee_name", ""))[:10],
                str(row.get("total_time", "--:--"))[:10],
                f"{row.get('dropout_temp', '--'):.1f}" if row.get("dropout_temp") else "---",
                str(row.get("fc_start_time", "--:--"))[:10],
                f"{row.get('fc_start_temp', '--'):.1f}" if row.get("fc_start_temp") else "---",
                str(row.get("fc_crack_type", "---"))[:10],
                f"{row.get('weight_loss_percent', '--'):.1f}" if row.get("weight_loss_percent") else "---",
                f"{row.get('cup_score_total', '--'):.1f}" if row.get("cup_score_total") else "---",
            ]
            lines.append(" ".join(f"{v:>10}" for v in values))
        lines.append("")

        lines.append("【异常检测】")
        lines.append("-" * 70)
        if report.anomalies:
            for anomaly in report.anomalies:
                severity = anomaly.get("severity", "unknown").upper()
                batch = anomaly.get("batch_id", "unknown")
                msg = anomaly.get("message", "")
                lines.append(f"[{severity}] {batch}: {msg}")
        else:
            lines.append("未检测到异常")
        lines.append("")

        lines.append("【相关性分析】")
        lines.append("-" * 70)
        correlations = report.summary.get("correlations", [])
        if correlations:
            for corr in correlations:
                lines.append(
                    f"{corr['factor']}: r={corr['correlation']:.3f} "
                    f"({corr['interpretation']})"
                )
        else:
            lines.append("数据不足，无法进行相关性分析")
        lines.append("")

        lines.append("【建议】")
        lines.append("-" * 70)
        for i, rec in enumerate(report.recommendations, 1):
            lines.append(f"{i}. {rec}")
        lines.append("")

        if report.chart_paths:
            lines.append("【图表文件】")
            lines.append("-" * 70)
            for path in report.chart_paths:
                lines.append(f"- {path}")

        with open(report_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return str(report_path)

    def _generate_charts(
        self,
        batches: List[RoastBatch],
        heating_profiles: List,
        report_id: str,
    ) -> List[str]:
        """生成图表"""
        chart_paths = []

        temp_chart_path = self._generate_temperature_chart(batches, report_id)
        if temp_chart_path:
            chart_paths.append(temp_chart_path)

        rate_chart_path = self._generate_heating_rate_chart(
            batches, heating_profiles, report_id
        )
        if rate_chart_path:
            chart_paths.append(rate_chart_path)

        if any(b.cup_score for b in batches):
            cup_chart_path = self._generate_cup_score_chart(batches, report_id)
            if cup_chart_path:
                chart_paths.append(cup_chart_path)

        return chart_paths

    def _generate_temperature_chart(
        self,
        batches: List[RoastBatch],
        report_id: str,
    ) -> Optional[str]:
        """生成温度曲线图表"""
        fig, ax = plt.subplots(figsize=(12, 6))

        colors = plt.cm.tab10.colors

        for i, batch in enumerate(batches):
            sorted_points = sorted(batch.curve_points, key=lambda p: p.time_seconds)
            times = [p.time_seconds / 60 for p in sorted_points]
            temps = [p.bean_temp for p in sorted_points]

            ax.plot(times, temps, label=batch.batch_id, color=colors[i % len(colors)])

            if batch.first_crack:
                fc_time = batch.first_crack.start_time_seconds / 60
                fc_temp = batch.first_crack.start_temp
                ax.scatter(
                    [fc_time], [fc_temp],
                    color=colors[i % len(colors)],
                    marker="o",
                    s=100,
                    zorder=5,
                    edgecolor="black",
                )
                ax.annotate(
                    f"FC\n{fc_temp}°C",
                    (fc_time, fc_temp),
                    textcoords="offset points",
                    xytext=(0, 10),
                    ha="center",
                    fontsize=8,
                )

        ax.set_xlabel("时间 (分钟)")
        ax.set_ylabel("豆温 (°C)")
        ax.set_title("烘焙温度曲线对比")
        ax.legend(loc="best")
        ax.grid(True, alpha=0.3)

        chart_path = self.output_dir / f"{report_id}_temperature_curves.png"
        fig.savefig(chart_path, dpi=150, bbox_inches="tight")
        plt.close(fig)

        return str(chart_path)

    def _generate_heating_rate_chart(
        self,
        batches: List[RoastBatch],
        heating_profiles: List,
        report_id: str,
    ) -> Optional[str]:
        """生成升温率图表"""
        if not heating_profiles:
            return None

        fig, ax = plt.subplots(figsize=(12, 6))
        colors = plt.cm.tab10.colors

        for i, (batch, profile) in enumerate(zip(batches, heating_profiles)):
            if not profile.rate_points:
                continue

            times = [p["time_seconds"] / 60 for p in profile.rate_points]
            rates = [p["rate"] for p in profile.rate_points]

            ax.plot(
                times, rates,
                label=f"{batch.batch_id}",
                color=colors[i % len(colors)],
            )

            if profile.peak_rate_time is not None:
                peak_time = profile.peak_rate_time / 60
                ax.scatter(
                    [peak_time], [profile.peak_rate],
                    color=colors[i % len(colors)],
                    marker="^",
                    s=100,
                    zorder=5,
                )

        ax.axhline(y=0, color="black", linestyle="-", linewidth=0.5)
        ax.set_xlabel("时间 (分钟)")
        ax.set_ylabel("升温率 (°C/s)")
        ax.set_title("升温率对比")
        ax.legend(loc="best")
        ax.grid(True, alpha=0.3)

        chart_path = self.output_dir / f"{report_id}_heating_rates.png"
        fig.savefig(chart_path, dpi=150, bbox_inches="tight")
        plt.close(fig)

        return str(chart_path)

    def _generate_cup_score_chart(
        self,
        batches: List[RoastBatch],
        report_id: str,
    ) -> Optional[str]:
        """生成杯测分数图表"""
        scored_batches = [b for b in batches if b.cup_score]
        if not scored_batches:
            return None

        fig, ax = plt.subplots(figsize=(10, 6))

        categories = ["香气", "风味", "余韵", "酸质", "醇厚度", "平衡", "一致性", "整体"]
        x = range(len(categories))

        colors = plt.cm.tab10.colors

        for i, batch in enumerate(scored_batches):
            scores = [
                batch.cup_score.aroma,
                batch.cup_score.flavor,
                batch.cup_score.aftertaste,
                batch.cup_score.acidity,
                batch.cup_score.body,
                batch.cup_score.balance,
                batch.cup_score.uniformity,
                batch.cup_score.overall,
            ]
            ax.plot(
                x, scores,
                label=f"{batch.batch_id} (总分: {batch.cup_score.total_score:.1f})",
                color=colors[i % len(colors)],
                marker="o",
            )

        ax.set_xlabel("评价维度")
        ax.set_ylabel("分数 (0-10)")
        ax.set_title("杯测分数对比")
        ax.set_xticks(x)
        ax.set_xticklabels(categories, rotation=45, ha="right")
        ax.set_ylim(0, 10)
        ax.legend(loc="best")
        ax.grid(True, alpha=0.3)

        chart_path = self.output_dir / f"{report_id}_cup_scores.png"
        fig.savefig(chart_path, dpi=150, bbox_inches="tight")
        plt.close(fig)

        return str(chart_path)

    def _compile_anomalies(
        self,
        anomalies: List[Dict[str, Any]],
        heating_profiles: List,
    ) -> List[Dict[str, Any]]:
        """汇总所有异常"""
        all_anomalies = list(anomalies)

        for profile in heating_profiles:
            for anomaly_msg in profile.anomalies:
                all_anomalies.append({
                    "batch_id": profile.batch_id,
                    "type": "heating_rate",
                    "severity": "medium",
                    "message": anomaly_msg,
                    "source": "heating_rate",
                })

        return all_anomalies

    def _get_calculation_methodology(self) -> Dict[str, Any]:
        """获取计算口径说明"""
        return {
            "first_crack_detection": {
                "description": "一爆点基于温度曲线特征检测",
                "method": "检测185-220°C范围内的升温速率变化点",
                "temperature_range": "185-220°C",
                "time_ratio_ranges": {
                    "early": "<50% of total time",
                    "normal": "55-75% of total time",
                    "late": ">80% of total time",
                },
            },
            "heating_rate": {
                "description": "滑动窗口计算升温率",
                "window_seconds": 30,
                "unit": "°C/s",
                "thresholds": {
                    "rising_too_fast": ">1.5°C/s",
                    "stalling": "<-0.1°C/s",
                    "normal_range": "0.05-1.0°C/s",
                },
            },
            "cup_score": {
                "description": "SCAA杯测标准评分",
                "dimensions": ["aroma", "flavor", "aftertaste", "acidity", "body", "balance", "uniformity", "overall"],
                "scale": "0-10分/维度",
                "total_calculation": "sum(dimensions) - defects",
                "quality_levels": {
                    "Excellent": "90+",
                    "Very Good": "85-89.99",
                    "Good": "80-84.99",
                    "Average": "70-79.99",
                    "Below Average": "<70",
                },
            },
            "weight_loss": {
                "formula": "(1 - roasted_weight / green_weight) * 100",
                "normal_range": "10-18%",
            },
            "correlation": {
                "method": "Pearson相关系数",
                "interpretation": {
                    "strong": "|r| >= 0.8",
                    "moderate": "0.5 <= |r| < 0.8",
                    "weak": "0.3 <= |r| < 0.5",
                    "none": "|r| < 0.3",
                },
            },
        }

    def _get_calculation_methodology_text(self) -> str:
        """获取计算口径的文本说明"""
        lines = [
            "一爆检测: 基于185-220°C范围内的升温速率变化点检测",
            "  - 过早(early): 一爆时间 < 总时间的50%",
            "  - 正常(normal): 一爆时间占总时间的55-75%",
            "  - 过晚(late): 一爆时间 > 总时间的80%",
            "",
            "升温率: 30秒滑动窗口计算，单位°C/s",
            "  - 升温过快: >1.5°C/s",
            "  - 停滞/降温: < -0.1°C/s",
            "  - 正常范围: 0.05-1.0°C/s",
            "",
            "杯测分数: SCAA标准，8个维度各0-10分",
            "  - 总分 = 各维度分数之和 - 缺陷分",
            "  - 等级: Excellent(90+), Very Good(85+), Good(80+), Average(70+)",
            "",
            "减重比例: (1 - 熟豆重/生豆重) × 100%",
            "  - 正常范围: 10-18%",
        ]
        return "\n".join(lines)
