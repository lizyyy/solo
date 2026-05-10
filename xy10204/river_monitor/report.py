"""报告生成模块 - 生成表格和图表报告"""

import pandas as pd
import os
from datetime import datetime
from typing import Dict, List, Optional
import logging

try:
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

from .config import DEFAULT_REPORT_DIR, DEFAULT_TIME_FORMAT

logger = logging.getLogger(__name__)


class ReportGenerator:
    """报告生成器"""

    def __init__(self, report_dir: str = DEFAULT_REPORT_DIR):
        self.report_dir = report_dir
        self._ensure_dir()

    def _ensure_dir(self):
        if not os.path.exists(self.report_dir):
            os.makedirs(self.report_dir)
            logger.info(f"创建报告目录: {self.report_dir}")

    def generate_text_report(self,
                            aligned_data: pd.DataFrame,
                            missing_summary: Dict,
                            anomalies: Dict,
                            station_id: str = None) -> str:
        """生成文本报告"""
        report = []
        report.append("=" * 70)
        report.append("河道水位巡测异常分析报告")
        report.append("=" * 70)
        report.append(f"生成时间: {datetime.now().strftime(DEFAULT_TIME_FORMAT)}")
        if station_id:
            report.append(f"监测站点: {station_id}")
        report.append("")

        report.append("一、分析参数配置")
        report.append("-" * 50)
        report.append(f"采样间隔: 60分钟")
        report.append(f"水位突涨阈值: 0.3 米/小时")
        report.append(f"雨量突增阈值: 10.0 毫米/小时")
        report.append(f"闸门开度突变阈值: 0.5 米/小时")
        report.append("")

        report.append("二、数据概览")
        report.append("-" * 50)
        if not aligned_data.empty:
            min_time = aligned_data["timestamp"].min()
            max_time = aligned_data["timestamp"].max()
            report.append(f"时间范围: {min_time} 至 {max_time}")
            report.append(f"总时间点数: {len(aligned_data)}")
        report.append("")

        report.append("三、缺失数据统计")
        report.append("-" * 50)
        if missing_summary:
            report.append(f"总记录数: {missing_summary.get('total_records', 0)}")
            report.append("")

            if missing_summary.get("missing"):
                report.append("缺失数据:")
                for col, stats in missing_summary["missing"].items():
                    report.append(f"  {col}: {stats['count']} 条 ({stats['percentage']}%)")

            if missing_summary.get("invalid"):
                report.append("")
                report.append("无效数据:")
                for col, stats in missing_summary["invalid"].items():
                    report.append(f"  {col}: {stats['count']} 条 ({stats['percentage']}%)")
        else:
            report.append("无数据")
        report.append("")

        report.append("四、异常检测结果")
        report.append("-" * 50)
        report.append(f"检测到异常总数: {anomalies.get('total_count', 0)}")
        report.append("")

        water_spikes = anomalies.get("water_level_spikes", [])
        rain_spikes = anomalies.get("rainfall_spikes", [])
        gate_changes = anomalies.get("gate_opening_changes", [])
        correlated = anomalies.get("correlated_anomalies", [])

        if water_spikes:
            report.append(f"水位突涨异常 ({len(water_spikes)} 条):")
            for i, anom in enumerate(water_spikes, 1):
                report.append(f"  [{i}] 时间: {anom['timestamp']}")
                report.append(f"      变化速率: {anom['rate_m_per_hour']} 米/小时")
                report.append(f"      水位变化: {anom['previous_level']}m -> {anom['current_level']}m")
                report.append(f"      时间间隔: {anom['time_diff_hours']} 小时")
                report.append(f"      阈值: {anom['threshold']} 米/小时")

        if rain_spikes:
            report.append(f"")
            report.append(f"雨量突增异常 ({len(rain_spikes)} 条):")
            for i, anom in enumerate(rain_spikes, 1):
                report.append(f"  [{i}] 时间: {anom['timestamp']}")
                report.append(f"      变化速率: {anom['rate_mm_per_hour']} 毫米/小时")
                report.append(f"      雨量变化: {anom['previous_rainfall']}mm -> {anom['current_rainfall']}mm")

        if gate_changes:
            report.append(f"")
            report.append(f"闸门开度突变 ({len(gate_changes)} 条):")
            for i, anom in enumerate(gate_changes, 1):
                report.append(f"  [{i}] 时间: {anom['timestamp']}")
                report.append(f"      变化速率: {anom['rate_m_per_hour']} 米/小时")
                report.append(f"      开度变化: {anom['previous_opening']}m -> {anom['current_opening']}m")

        if correlated:
            report.append(f"")
            report.append("五、异常关联分析")
            report.append("-" * 50)
            for i, anom in enumerate(correlated, 1):
                report.append(f"[{i}] 水位突涨 - 时间: {anom['timestamp']}")
                report.append(f"    可能原因: {anom['possible_cause']}")

                if anom.get("correlated_rainfall"):
                    report.append(f"    关联雨量突增 ({len(anom['correlated_rainfall'])} 条):")
                    for rain in anom["correlated_rainfall"]:
                        report.append(f"      - 时间: {rain['anomaly']['timestamp']}, 时差: {rain['time_diff_hours']} 小时")

                if anom.get("correlated_gate"):
                    report.append(f"    关联闸门变化 ({len(anom['correlated_gate'])} 条):")
                    for gate in anom["correlated_gate"]:
                        report.append(f"      - 时间: {gate['anomaly']['timestamp']}, 时差: {gate['time_diff_hours']} 小时")

        report.append("")
        report.append("=" * 70)
        report.append("报告结束")

        return "\n".join(report)

    def generate_chart_report(self,
                             aligned_data: pd.DataFrame,
                             anomalies: Dict,
                             station_id: str = None,
                             filename: str = None) -> Optional[str]:
        """生成图表报告"""
        if not HAS_MATPLOTLIB:
            logger.warning("matplotlib未安装，跳过图表生成")
            return None

        if aligned_data.empty:
            logger.warning("无数据，跳过图表生成")
            return None

        fig, axes = plt.subplots(3, 1, figsize=(14, 12), sharex=True)

        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            station_part = f"_{station_id}" if station_id else ""
            filename = f"chart_report{station_part}_{timestamp}.png"

        filepath = os.path.join(self.report_dir, filename)

        water_spikes = anomalies.get("water_level_spikes", [])
        rain_spikes = anomalies.get("rainfall_spikes", [])
        gate_changes = anomalies.get("gate_opening_changes", [])

        ax1 = axes[0]
        if "water_level_m" in aligned_data.columns:
            ax1.plot(aligned_data["timestamp"], aligned_data["water_level_m"],
                    "b-", linewidth=2, label="水位")

            for anom in water_spikes:
                ax1.axvline(x=anom["timestamp"], color="red",
                           linestyle="--", alpha=0.7)
                ax1.scatter([anom["timestamp"]], [anom["current_level"]],
                          color="red", s=100, zorder=5)

            ax1.set_ylabel("水位 (m)", fontsize=12)
            ax1.legend(loc="upper left")
            ax1.grid(True, alpha=0.3)
            ax1.set_title("水位变化曲线 (红点标记异常)", fontsize=14)

        ax2 = axes[1]
        if "rainfall_mm" in aligned_data.columns:
            ax2.bar(aligned_data["timestamp"], aligned_data["rainfall_mm"],
                   width=0.03, color="green", alpha=0.7, label="雨量")

            for anom in rain_spikes:
                ax2.axvline(x=anom["timestamp"], color="orange",
                           linestyle="--", alpha=0.7)

            ax2.set_ylabel("雨量 (mm)", fontsize=12)
            ax2.legend(loc="upper left")
            ax2.grid(True, alpha=0.3)
            ax2.set_title("雨量变化曲线 (橙线标记异常)", fontsize=14)

        ax3 = axes[2]
        if "gate_opening_m" in aligned_data.columns:
            ax3.plot(aligned_data["timestamp"], aligned_data["gate_opening_m"],
                    "purple", linewidth=2, label="闸门开度")

            for anom in gate_changes:
                ax3.axvline(x=anom["timestamp"], color="red",
                           linestyle="--", alpha=0.7)

            ax3.set_ylabel("闸门开度 (m)", fontsize=12)
            ax3.set_xlabel("时间", fontsize=12)
            ax3.legend(loc="upper left")
            ax3.grid(True, alpha=0.3)
            ax3.set_title("闸门开度变化曲线", fontsize=14)

        for ax in axes:
            ax.xaxis.set_major_formatter(mdates.DateFormatter("%m-%d %H:%M"))
            plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha="right")

        title = "河道水位巡测多源数据图表报告"
        if station_id:
            title += f" - 站点 {station_id}"
        fig.suptitle(title, fontsize=16, y=0.995)

        plt.tight_layout()
        plt.savefig(filepath, dpi=150, bbox_inches="tight")
        plt.close()

        logger.info(f"图表报告已保存: {filepath}")
        return filepath

    def save_text_report(self, text: str, station_id: str = None) -> str:
        """保存文本报告到文件"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        station_part = f"_{station_id}" if station_id else ""
        filename = f"report{station_part}_{timestamp}.txt"
        filepath = os.path.join(self.report_dir, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(text)

        logger.info(f"文本报告已保存: {filepath}")
        return filepath
