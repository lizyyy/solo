import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from datetime import datetime
import os

from .calculation_engine import PondCalculationResult, OxygenBalanceResult
from .scheduling_optimizer import ScheduleResult, AeratorSchedule
from .config import DEFAULT_CONFIG


class ReportExporter:
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or DEFAULT_CONFIG
        self.critical_do = self.config["oxygen"]["critical_level"]
        self.warning_do = self.config["oxygen"]["warning_level"]

    def export_markdown_report(
        self,
        pond_results: Dict[str, PondCalculationResult],
        schedule_results: Dict[str, ScheduleResult],
        output_path: str,
        input_data_info: Optional[Dict] = None,
        warnings: Optional[List[str]] = None,
    ) -> str:
        report_lines = []

        report_lines.append("# 鱼塘增氧调度计算报告")
        report_lines.append("")
        report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")

        if input_data_info:
            report_lines.append("## 输入数据概览")
            report_lines.append("")
            if "pond_count" in input_data_info:
                report_lines.append(f"- **池塘数量**: {input_data_info['pond_count']}")
            if "time_range" in input_data_info:
                report_lines.append(f"- **时间范围**: {input_data_info['time_range']}")
            if "record_count" in input_data_info:
                report_lines.append(f"- **数据记录数**: {input_data_info['record_count']}")
            report_lines.append("")

        if warnings:
            report_lines.append("## ⚠️ 数据警告")
            report_lines.append("")
            for warning in warnings:
                report_lines.append(f"- {warning}")
            report_lines.append("")

        report_lines.append("## 风险汇总")
        report_lines.append("")

        risk_summary = self._generate_risk_summary(pond_results)
        report_lines.append(risk_summary)
        report_lines.append("")

        report_lines.append("## 各池塘详细分析")
        report_lines.append("")

        for pond_id, pond_result in pond_results.items():
            schedule_result = schedule_results.get(pond_id)
            pond_report = self._generate_pond_report(
                pond_result, schedule_result
            )
            report_lines.append(pond_report)
            report_lines.append("")
            report_lines.append("---")
            report_lines.append("")

        total_stats = self._generate_total_stats(schedule_results)
        report_lines.append("## 总体调度统计")
        report_lines.append("")
        report_lines.append(total_stats)
        report_lines.append("")

        report_lines.append("## 附录：模型参数说明")
        report_lines.append("")
        report_lines.append(self._generate_parameter_appendix())
        report_lines.append("")

        report_content = "\n".join(report_lines)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report_content)

        return output_path

    def _generate_risk_summary(
        self, pond_results: Dict[str, PondCalculationResult]
    ) -> str:
        lines = []

        total_ponds = len(pond_results)
        critical_ponds = 0
        warning_ponds = 0
        normal_ponds = 0

        for pond_result in pond_results.values():
            risk = pond_result.summary["overall_risk"]
            if risk == "critical":
                critical_ponds += 1
            elif risk == "warning":
                warning_ponds += 1
            else:
                normal_ponds += 1

        lines.append("| 风险等级 | 池塘数量 | 占比 |")
        lines.append("|----------|----------|------|")
        lines.append(
            f"| 🔴 严重 | {critical_ponds} | {critical_ponds/total_ponds*100:.1f}% |"
        )
        lines.append(
            f"| 🟡 警告 | {warning_ponds} | {warning_ponds/total_ponds*100:.1f}% |"
        )
        lines.append(
            f"| 🟢 正常 | {normal_ponds} | {normal_ponds/total_ponds*100:.1f}% |"
        )
        lines.append("")

        if critical_ponds > 0:
            lines.append("⚠️ **重要提示**: 存在严重缺氧风险的池塘，请立即采取措施！")
        elif warning_ponds > 0:
            lines.append("ℹ️ **提示**: 存在警告风险的池塘，建议按调度计划执行。")

        return "\n".join(lines)

    def _generate_pond_report(
        self,
        pond_result: PondCalculationResult,
        schedule_result: Optional[ScheduleResult],
    ) -> str:
        lines = []

        pond_id = pond_result.pond_id
        summary = pond_result.summary

        risk_emoji = "🔴" if summary["overall_risk"] == "critical" else (
            "🟡" if summary["overall_risk"] == "warning" else "🟢"
        )

        lines.append(f"### 池塘 {pond_id}")
        lines.append("")
        lines.append(f"**整体风险**: {risk_emoji} {summary['overall_risk'].upper()}")
        lines.append("")

        lines.append("#### 溶氧统计")
        lines.append("")
        lines.append(f"- **最低溶氧**: {summary['min_do']} mg/L")
        lines.append(f"- **最高溶氧**: {summary['max_do']} mg/L")
        lines.append(f"- **平均溶氧**: {summary['avg_do']:.2f} mg/L")
        lines.append(f"- **夜间最低溶氧**: {summary['min_night_do']} mg/L")
        lines.append(f"- **夜间平均溶氧**: {summary['avg_night_do']:.2f} mg/L")
        lines.append("")

        lines.append("#### 风险时段统计")
        lines.append("")
        lines.append(f"- **严重风险时段**: {summary['night_critical_count']} 小时")
        lines.append(f"- **警告风险时段**: {summary['night_warning_count']} 小时")
        lines.append(f"- **建议增氧时长**: {summary['night_aeration_hours_needed']} 小时")
        lines.append("")

        lines.append("#### 池塘信息")
        lines.append("")
        lines.append(f"- **池塘面积**: {summary['pond_area']} ha")
        lines.append(f"- **水深**: {summary['water_depth']} m")
        lines.append(f"- **水体体积**: {summary['water_volume']:,.0f} m³")
        lines.append("")

        if schedule_result and schedule_result.schedules:
            lines.append("#### 建议增氧排班")
            lines.append("")

            lines.append("| 开始时间 | 结束时间 | 时长(小时) | 增氧机数 | 预估电费 | 原因 |")
            lines.append("|----------|----------|------------|----------|----------|------|")

            for schedule in schedule_result.schedules:
                priority_mark = "⭐" if schedule.priority == 1 else ""
                lines.append(
                    f"| {schedule.start_time.strftime('%m-%d %H:%M')} | "
                    f"{schedule.end_time.strftime('%m-%d %H:%M')} | "
                    f"{schedule.duration_hours} | "
                    f"{schedule.aerator_count} | "
                    f"¥{schedule.estimated_cost:.2f} | "
                    f"{schedule.reason}{priority_mark} |"
                )

            lines.append("")
            lines.append(f"**总计**: {schedule_result.total_hours} 小时, "
                         f"{schedule_result.total_kwh:.2f} kWh, "
                         f"¥{schedule_result.total_cost:.2f}")
            lines.append("")

            if schedule_result.optimization_notes:
                lines.append("**优化说明**:")
                for note in schedule_result.optimization_notes:
                    lines.append(f"- {note}")
                lines.append("")

        elif schedule_result:
            lines.append("#### 增氧建议")
            lines.append("")
            lines.append("✅ 预测溶氧水平安全，无需增氧。")
            if schedule_result.optimization_notes:
                for note in schedule_result.optimization_notes:
                    lines.append(f"- {note}")
            lines.append("")

        return "\n".join(lines)

    def _generate_total_stats(
        self, schedule_results: Dict[str, ScheduleResult]
    ) -> str:
        lines = []

        total_hours = 0.0
        total_kwh = 0.0
        total_cost = 0.0
        total_schedules = 0
        ponds_with_risk = 0

        for schedule_result in schedule_results.values():
            total_hours += schedule_result.total_hours
            total_kwh += schedule_result.total_kwh
            total_cost += schedule_result.total_cost
            total_schedules += len(schedule_result.schedules)
            if schedule_result.schedules:
                ponds_with_risk += 1

        lines.append(f"- **总增氧时长**: {total_hours:.1f} 小时")
        lines.append(f"- **总耗电量**: {total_kwh:.2f} kWh")
        lines.append(f"- **总预估电费**: ¥{total_cost:.2f}")
        lines.append(f"- **需增氧池塘数**: {ponds_with_risk} / {len(schedule_results)}")
        lines.append(f"- **排班数量**: {total_schedules} 个")

        return "\n".join(lines)

    def _generate_parameter_appendix(self) -> str:
        lines = []

        lines.append("### 溶氧风险阈值")
        lines.append("")
        lines.append(f"- **临界值**: < {self.critical_do} mg/L (鱼类可能死亡)")
        lines.append(f"- **警告值**: < {self.warning_do} mg/L (鱼类应激)")
        lines.append("")

        lines.append("### 增氧机参数")
        lines.append("")
        lines.append(f"- **单台功率**: {self.config['aerator']['power_per_unit']} kW")
        lines.append(f"- **增氧效率**: {self.config['aerator']['efficiency']} kg O₂/kWh")
        lines.append("")

        lines.append("### 电价时段")
        lines.append("")
        lines.append("- **峰时 (9:00-12:00)**: ¥1.2/kWh")
        lines.append("- **平时 (7:00-9:00, 12:00-23:00)**: ¥0.8/kWh")
        lines.append("- **谷时 (23:00-7:00)**: ¥0.4/kWh")
        lines.append("")

        lines.append("### 模型说明")
        lines.append("")
        lines.append("**溶氧消耗项**:")
        lines.append("- 鱼类呼吸: 与温度、密度正相关")
        lines.append("- 浮游植物呼吸: 夜间持续消耗")
        lines.append("- 底质耗氧: 有机物分解消耗")
        lines.append("")
        lines.append("**溶氧补充项**:")
        lines.append("- 光合作用: 白天有光照时产生")
        lines.append("- 大气复氧: 与溶氧饱和度差相关")
        lines.append("- 机械增氧: 增氧机运行时补充")

        return "\n".join(lines)

    def export_csv_results(
        self,
        pond_results: Dict[str, PondCalculationResult],
        schedule_results: Dict[str, ScheduleResult],
        output_dir: str,
    ) -> Dict[str, str]:
        os.makedirs(output_dir, exist_ok=True)

        output_files = {}

        hourly_data = []
        for pond_id, result in pond_results.items():
            for hourly in result.hourly_results:
                hourly_data.append({
                    "timestamp": hourly.timestamp,
                    "pond_id": hourly.pond_id,
                    "dissolved_oxygen": hourly.dissolved_oxygen,
                    "saturation_do": hourly.saturation_do,
                    "do_percent_saturation": hourly.do_percent_saturation,
                    "fish_respiration": hourly.fish_respiration,
                    "phytoplankton_respiration": hourly.phytoplankton_respiration,
                    "sediment_oxygen_demand": hourly.sediment_oxygen_demand,
                    "total_oxygen_consumption": hourly.total_oxygen_consumption,
                    "photosynthesis": hourly.photosynthesis,
                    "reaeration": hourly.reaeration,
                    "total_oxygen_production": hourly.total_oxygen_production,
                    "net_oxygen_change": hourly.net_oxygen_change,
                    "predicted_do_next_hour": hourly.predicted_do_next_hour,
                    "risk_level": hourly.risk_level,
                    "aeration_needed": hourly.aeration_needed,
                })

        hourly_df = pd.DataFrame(hourly_data)
        hourly_path = os.path.join(output_dir, "hourly_results.csv")
        hourly_df.to_csv(hourly_path, index=False, encoding="utf-8-sig")
        output_files["hourly"] = hourly_path

        summary_data = []
        for pond_id, result in pond_results.items():
            row = {"pond_id": pond_id}
            row.update(result.summary)
            summary_data.append(row)

        summary_df = pd.DataFrame(summary_data)
        summary_path = os.path.join(output_dir, "pond_summary.csv")
        summary_df.to_csv(summary_path, index=False, encoding="utf-8-sig")
        output_files["summary"] = summary_path

        schedule_data = []
        for pond_id, result in schedule_results.items():
            for schedule in result.schedules:
                schedule_data.append({
                    "pond_id": pond_id,
                    "start_time": schedule.start_time,
                    "end_time": schedule.end_time,
                    "duration_hours": schedule.duration_hours,
                    "aerator_count": schedule.aerator_count,
                    "estimated_power_kwh": schedule.estimated_power_kwh,
                    "estimated_cost": schedule.estimated_cost,
                    "reason": schedule.reason,
                    "priority": schedule.priority,
                })

        if schedule_data:
            schedule_df = pd.DataFrame(schedule_data)
            schedule_path = os.path.join(output_dir, "aeration_schedules.csv")
            schedule_df.to_csv(schedule_path, index=False, encoding="utf-8-sig")
            output_files["schedules"] = schedule_path

        schedule_summary_data = []
        for pond_id, result in schedule_results.items():
            schedule_summary_data.append({
                "pond_id": pond_id,
                "total_hours": result.total_hours,
                "total_kwh": result.total_kwh,
                "total_cost": result.total_cost,
                "risk_mitigation_score": result.risk_mitigation_score,
                "schedule_count": len(result.schedules),
                "notes": "; ".join(result.optimization_notes),
            })

        schedule_summary_df = pd.DataFrame(schedule_summary_data)
        schedule_summary_path = os.path.join(output_dir, "schedule_summary.csv")
        schedule_summary_df.to_csv(schedule_summary_path, index=False, encoding="utf-8-sig")
        output_files["schedule_summary"] = schedule_summary_path

        return output_files
