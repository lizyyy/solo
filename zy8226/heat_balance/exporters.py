import csv
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict

import plotly.graph_objects as go
from plotly.subplots import make_subplots

from .models import AnalysisResult, TimeSliceResult, AnomalyType


class ReportExporter:
    def __init__(self, analysis_result: AnalysisResult):
        self.result = analysis_result

    def export_all(self, output_dir: str):
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        md_path = output_path / "imbalance_report.md"
        csv_path = output_path / "issues.csv"
        html_path = output_path / "hydraulic_balance_charts.html"

        self._export_markdown(str(md_path))
        self._export_issues_csv(str(csv_path))
        self._export_html_charts(str(html_path))

        return {
            "markdown": str(md_path),
            "issues_csv": str(csv_path),
            "charts_html": str(html_path),
        }

    def _format_float(self, value: Optional[float], decimals: int = 2) -> str:
        if value is None:
            return "N/A"
        return f"{value:.{decimals}f}"

    def _format_datetime(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def _get_severity_level(self, heat_deficit_ratio: Optional[float]) -> str:
        if heat_deficit_ratio is None:
            return "未知"
        abs_ratio = abs(heat_deficit_ratio)
        if abs_ratio > 0.30:
            return "严重"
        elif abs_ratio > 0.15:
            return "中等"
        else:
            return "轻微"

    def _group_results_by_unit(self) -> Dict[str, List[TimeSliceResult]]:
        grouped = defaultdict(list)
        for r in self.result.results:
            grouped[r.unit_id].append(r)
        return dict(grouped)

    def _group_results_by_time(self) -> Dict[datetime, List[TimeSliceResult]]:
        grouped = defaultdict(list)
        for r in self.result.results:
            grouped[r.timestamp].append(r)
        return dict(grouped)

    def _export_markdown(self, filepath: str):
        summary = self.result.summary
        lines = []

        lines.append("# 水力失衡分析报告")
        lines.append("")
        lines.append(f"**项目名称**: {self.result.project_name}")
        lines.append(f"**分析时间**: {self._format_datetime(self.result.analysis_time)}")
        lines.append("")

        lines.append("## 一、整体概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总单元数 | {summary['total_units']} |")
        lines.append(f"| 时间片数 | {summary['total_time_slices']} |")
        lines.append(f"| 总测量次数 | {summary['total_measurements']} |")
        lines.append(f"| 失衡次数 | {summary['unbalanced_count']} |")
        lines.append(f"| 失衡比例 | {summary['unbalanced_ratio']*100:.1f}% |")
        lines.append(f"| 有问题单元数 | {summary['units_with_issues_count']} |")
        lines.append("")

        lines.append("## 二、异常统计")
        lines.append("")
        lines.append(f"- **总异常数**: {summary['total_anomalies']}")
        lines.append(f"- **传感器缺失**: {summary['sensor_missing_count']} 次")
        lines.append(f"- **阀门越界**: {summary['valve_out_of_bounds_count']} 次")
        lines.append("")

        stats = summary['heat_deficit_stats']
        if stats['average'] is not None:
            lines.append("## 三、热量缺口统计")
            lines.append("")
            lines.append(f"- **平均缺口**: {self._format_float(stats['average'])} kW")
            lines.append(f"- **最大缺口**: {self._format_float(stats['maximum'])} kW")
            lines.append(f"- **最小缺口**: {self._format_float(stats['minimum'])} kW")
            lines.append("")

        lines.append("## 四、单元失衡详情")
        lines.append("")

        grouped_by_unit = self._group_results_by_unit()

        for unit_id, results in grouped_by_unit.items():
            unit = self.result.units.get(unit_id)
            unit_name = unit.name if unit else unit_id

            unbalanced_results = [r for r in results if not r.is_balanced]
            if not unbalanced_results:
                continue

            valid_results = [r for r in results if r.heat_deficit is not None]
            avg_deficit = sum(r.heat_deficit for r in valid_results) / len(valid_results) if valid_results else None
            worst_result = max(unbalanced_results, key=lambda r: abs(r.heat_deficit or 0))

            lines.append(f"### 单元: {unit_name} ({unit_id})")
            lines.append("")
            lines.append(f"- **单元类型**: {unit.unit_type if unit else '未知'}")
            lines.append(f"- **设计热负荷**: {self._format_float(unit.design_heat_load if unit else None)} kW")
            lines.append(f"- **失衡次数**: {len(unbalanced_results)}/{len(results)}")
            lines.append(f"- **平均缺口**: {self._format_float(avg_deficit)} kW")
            lines.append(f"- **严重程度**: {self._get_severity_level(worst_result.heat_deficit and (worst_result.heat_deficit / worst_result.required_heat_rate) if worst_result.required_heat_rate else None)}")
            lines.append("")

            lines.append("#### 各时间片详情")
            lines.append("")
            lines.append("| 时间 | 供水温度 | 回水温度 | 流量 | 温差 | 实际热功率 | 需求热功率 | 热量缺口 | 阀门开度 | 建议调节 |")
            lines.append("|------|----------|----------|------|------|------------|------------|----------|----------|----------|")

            for r in results:
                status_marker = "✓" if r.is_balanced else "⚠️"
                lines.append(
                    f"| {self._format_datetime(r.timestamp)} {status_marker} | "
                    f"{self._format_float(r.supply_temp)}°C | "
                    f"{self._format_float(r.return_temp)}°C | "
                    f"{self._format_float(r.flow_rate)} m³/h | "
                    f"{self._format_float(r.temp_diff)}°C | "
                    f"{self._format_float(r.actual_heat_rate)} kW | "
                    f"{self._format_float(r.required_heat_rate)} kW | "
                    f"{self._format_float(r.heat_deficit)} kW | "
                    f"{self._format_float(r.current_valve_open)}% | "
                    f"{self._format_float(r.recommended_valve_adjust)}% |"
                )
            lines.append("")

            valve_adjust = [r for r in results if r.recommended_valve_adjust is not None and abs(r.recommended_valve_adjust) > 0.5]
            if valve_adjust:
                latest_result = max(results, key=lambda r: r.timestamp)
                if latest_result.recommended_valve_adjust is not None and latest_result.current_valve_open is not None:
                    adjust = latest_result.recommended_valve_adjust
                    target = latest_result.current_valve_open + adjust
                    lines.append("#### 阀门调节建议")
                    lines.append("")
                    if adjust > 0:
                        lines.append(f"**建议增大阀门开度**: +{abs(adjust):.1f}%")
                        lines.append(f"")
                        lines.append(f"- 当前开度: {latest_result.current_valve_open:.1f}%")
                        lines.append(f"- 目标开度: {target:.1f}%")
                        lines.append(f"- 预期效果: 增加流量，减少热量缺口")
                    else:
                        lines.append(f"**建议减小阀门开度**: -{abs(adjust):.1f}%")
                        lines.append(f"")
                        lines.append(f"- 当前开度: {latest_result.current_valve_open:.1f}%")
                        lines.append(f"- 目标开度: {target:.1f}%")
                        lines.append(f"- 预期效果: 减少流量，避免过热")
                    lines.append("")

            anomalies = []
            for r in results:
                for a in r.anomalies:
                    a_with_time = a.copy()
                    a_with_time["timestamp"] = r.timestamp
                    anomalies.append(a_with_time)

            if anomalies:
                lines.append("#### 检测到的异常")
                lines.append("")
                for a in anomalies:
                    a_type = a.get("type", "unknown")
                    if a_type == AnomalyType.SENSOR_MISSING.value:
                        missing = ", ".join(a.get("missing_fields", []))
                        lines.append(f"- ⚠️ [{self._format_datetime(a['timestamp'])}] 传感器数据缺失: {missing}")
                    elif a_type == AnomalyType.VALVE_OUT_OF_BOUNDS.value:
                        lines.append(
                            f"- ⚠️ [{self._format_datetime(a['timestamp'])}] 阀门越界: "
                            f"当前 {a.get('current_value')}%，范围 [{a.get('min_bound')}%, {a.get('max_bound')}%]"
                        )
                    elif a_type == AnomalyType.TEMPERATURE_INVERSION.value:
                        lines.append(
                            f"- ⚠️ [{self._format_datetime(a['timestamp'])}] 温度反转: "
                            f"回水 {a.get('return_temp')}°C > 供水 {a.get('supply_temp')}°C"
                        )
                    elif a_type == AnomalyType.NEGATIVE_FLOW.value:
                        lines.append(
                            f"- ⚠️ [{self._format_datetime(a['timestamp'])}] 负流量: {a.get('flow_rate')}"
                        )
                    else:
                        lines.append(f"- ⚠️ [{self._format_datetime(a['timestamp'])}] {a.get('message', '未知异常')}")
                lines.append("")

        lines.append("## 五、调节建议汇总")
        lines.append("")

        valid_adjustments = []
        for r in self.result.results:
            if (r.recommended_valve_adjust is not None 
                and abs(r.recommended_valve_adjust) > 1.0
                and r.current_valve_open is not None):
                valid_adjustments.append(r)

        if valid_adjustments:
            lines.append("| 单元 | 时间 | 当前开度 | 建议调节 | 目标开度 |")
            lines.append("|------|------|----------|----------|----------|")

            latest_by_unit = {}
            for r in valid_adjustments:
                if r.unit_id not in latest_by_unit or r.timestamp > latest_by_unit[r.unit_id].timestamp:
                    latest_by_unit[r.unit_id] = r

            for unit_id, r in latest_by_unit.items():
                target = r.current_valve_open + r.recommended_valve_adjust
                adjust_sign = "+" if r.recommended_valve_adjust > 0 else ""
                lines.append(
                    f"| {self.result.units.get(unit_id, lambda x: x).name if hasattr(self.result.units.get(unit_id), 'name') else unit_id} | "
                    f"{self._format_datetime(r.timestamp)} | "
                    f"{r.current_valve_open:.1f}% | "
                    f"{adjust_sign}{r.recommended_valve_adjust:.1f}% | "
                    f"{target:.1f}% |"
                )
        else:
            lines.append("系统当前水力平衡状态良好，无需调整阀门。")
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append(f"*报告生成时间: {self._format_datetime(datetime.now())}*")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def _export_issues_csv(self, filepath: str):
        all_issues = []

        for r in self.result.results:
            base_row = {
                "timestamp": self._format_datetime(r.timestamp),
                "unit_id": r.unit_id,
                "unit_name": self.result.units.get(r.unit_id, type('obj', (object,), {'name': ''})).name if self.result.units.get(r.unit_id) else "",
            }

            if not r.is_balanced and r.heat_deficit is not None:
                issue_row = base_row.copy()
                issue_row["issue_type"] = "imbalance"
                issue_row["severity"] = self._get_severity_level(
                    r.heat_deficit / r.required_heat_rate if r.required_heat_rate else None
                )
                issue_row["description"] = f"热量缺口: {self._format_float(r.heat_deficit)} kW"
                issue_row["current_valve"] = self._format_float(r.current_valve_open)
                issue_row["recommended_adjust"] = self._format_float(r.recommended_valve_adjust)
                all_issues.append(issue_row)

            for a in r.anomalies:
                issue_row = base_row.copy()
                issue_row["issue_type"] = a.get("type", "unknown")
                issue_row["severity"] = "高"
                issue_row["description"] = a.get("message", "")
                issue_row["current_valve"] = self._format_float(r.current_valve_open)
                issue_row["recommended_adjust"] = "检查设备"
                all_issues.append(issue_row)

        fieldnames = [
            "timestamp", "unit_id", "unit_name", "issue_type",
            "severity", "description", "current_valve", "recommended_adjust"
        ]

        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in all_issues:
                writer.writerow(row)

    def _export_html_charts(self, filepath: str):
        grouped_by_unit = self._group_results_by_unit()
        grouped_by_time = self._group_results_by_time()

        num_units = len(grouped_by_unit)
        num_cols = 2
        num_rows = (num_units + num_cols - 1) // num_cols + 1

        fig = make_subplots(
            rows=num_rows,
            cols=num_cols,
            subplot_titles=["整体热量缺口趋势"] + [f"单元: {uid}" for uid in list(grouped_by_unit.keys())[:(num_rows-1)*num_cols]],
            specs=[[{"secondary_y": True}, {"secondary_y": True}]] + [[{}, {}] for _ in range(num_rows - 1)]
        )

        time_slices = sorted(grouped_by_time.keys())
        time_labels = [ts.strftime("%H:%M") for ts in time_slices]

        avg_deficits = []
        for ts in time_slices:
            results_at_ts = grouped_by_time[ts]
            valid_deficits = [r.heat_deficit for r in results_at_ts if r.heat_deficit is not None]
            avg = sum(valid_deficits) / len(valid_deficits) if valid_deficits else 0
            avg_deficits.append(avg)

        fig.add_trace(
            go.Bar(
                x=time_labels,
                y=avg_deficits,
                name="平均热量缺口 (kW)",
                marker_color="rgba(255, 99, 71, 0.7)",
            ),
            row=1, col=1, secondary_y=False,
        )

        unit_count = len(grouped_by_unit)
        balanced_units = sum(
            1 for results in grouped_by_unit.values()
            if all(r.is_balanced for r in results)
        )
        imbalance_units = unit_count - balanced_units

        fig.add_trace(
            go.Pie(
                labels=["平衡", "失衡"],
                values=[balanced_units, imbalance_units],
                name="单元平衡状态",
                marker_colors=["rgba(50, 205, 50, 0.7)", "rgba(255, 99, 71, 0.7)"],
            ),
            row=1, col=2,
        )

        row_idx = 2
        col_idx = 1

        for unit_id, results in grouped_by_unit.items():
            if row_idx > num_rows:
                break

            sorted_results = sorted(results, key=lambda r: r.timestamp)
            ts_labels = [r.timestamp.strftime("%H:%M") for r in sorted_results]

            actual_heats = [r.actual_heat_rate if r.actual_heat_rate is not None else 0 for r in sorted_results]
            required_heats = [r.required_heat_rate if r.required_heat_rate is not None else 0 for r in sorted_results]
            deficits = [r.heat_deficit if r.heat_deficit is not None else 0 for r in sorted_results]

            fig.add_trace(
                go.Scatter(
                    x=ts_labels,
                    y=actual_heats,
                    mode="lines+markers",
                    name=f"{unit_id} 实际",
                    line=dict(color="blue"),
                ),
                row=row_idx, col=col_idx,
            )

            fig.add_trace(
                go.Scatter(
                    x=ts_labels,
                    y=required_heats,
                    mode="lines+markers",
                    name=f"{unit_id} 需求",
                    line=dict(color="green", dash="dash"),
                ),
                row=row_idx, col=col_idx,
            )

            col_idx += 1
            if col_idx > num_cols:
                col_idx = 1
                row_idx += 1

        fig.update_layout(
            height=400 * num_rows,
            title_text=f"水力平衡分析 - {self.result.project_name}",
            showlegend=True,
        )

        for i in range(1, num_rows + 1):
            for j in range(1, num_cols + 1):
                try:
                    fig.update_xaxes(title_text="时间", row=i, col=j)
                    fig.update_yaxes(title_text="功率 (kW)", row=i, col=j)
                except Exception:
                    pass

        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>水力平衡分析图表</title>
    <script src="https://cdn.plot.ly/plotly-2.24.1.min.js"></script>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #333;
            border-bottom: 2px solid #4a90d9;
            padding-bottom: 10px;
        }}
        .info-panel {{
            background: #e8f4fd;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }}
        .info-panel h3 {{
            margin-top: 0;
            color: #2c5aa0;
        }}
        #chart {{
            width: 100%;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>水力平衡分析图表</h1>
        <div class="info-panel">
            <h3>分析信息</h3>
            <p><strong>项目:</strong> {self.result.project_name}</p>
            <p><strong>分析时间:</strong> {self._format_datetime(self.result.analysis_time)}</p>
            <p><strong>单元数:</strong> {self.result.summary['total_units']}</p>
            <p><strong>时间片数:</strong> {self.result.summary['total_time_slices']}</p>
        </div>
        <div id="chart"></div>
    </div>
    <script>
        var plotData = {fig.to_json()};
        Plotly.newPlot('chart', plotData.data, plotData.layout);
    </script>
</body>
</html>
"""

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html_content)
