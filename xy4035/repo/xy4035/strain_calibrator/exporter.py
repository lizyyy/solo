import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

import pandas as pd

from .models import ProjectConfig
from .storage import DateTimeEncoder


class ReportExporter:
    def __init__(self, config: ProjectConfig):
        self.config = config

    def export_markdown(
        self,
        output_path: Path,
        analysis_result: Dict[str, Any],
        calibration_info: Optional[Dict[str, Any]] = None,
        validation_summary: Optional[Dict[str, Any]] = None,
    ) -> Path:
        lines = []

        lines.append("# 梁板应变试验分析报告")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 项目名称: {self.config.project_name}")
        lines.append("")

        lines.append("## 1. 项目概述")
        lines.append("")
        lines.append(f"- **项目编号**: {self.config.project_id}")
        lines.append(f"- **项目描述**: {self.config.description or '无'}")
        lines.append(f"- **传感器数量**: {len(self.config.sensors)}")
        if self.config.cross_section:
            lines.append(f"- **截面尺寸**: {self.config.cross_section.width * 1000:.0f}mm × {self.config.cross_section.height * 1000:.0f}mm")
        lines.append(f"- **采样率**: {self.config.default_sampling_rate} Hz")
        lines.append("")

        lines.append("## 2. 传感器配置")
        lines.append("")
        lines.append("| 编号 | 类型 | 名称 | 单位 | 位置 | 温度补偿 |")
        lines.append("|------|------|------|------|------|----------|")
        for s in self.config.sensors:
            type_name = {
                "strain_gauge": "应变片",
                "displacement_meter": "位移计",
                "temperature_sensor": "温度传感器",
            }.get(s.type, s.type)
            loc_str = f"{s.location_y * 1000:.0f}mm" if s.location_y else "-"
            temp_comp = s.temperature_compensation_sensor or "-"
            lines.append(f"| {s.sensor_id} | {type_name} | {s.name or '-'} | {s.unit} | {loc_str} | {temp_comp} |")
        lines.append("")

        if validation_summary:
            lines.append("## 3. 数据校验结果")
            lines.append("")
            lines.append(f"- **总校验问题数**: {validation_summary.get('total', 0)}")
            lines.append(f"- **隔离区记录数**: {validation_summary.get('quarantine_count', 0)}")
            lines.append("")

            by_severity = validation_summary.get('by_severity', {})
            if by_severity:
                lines.append("### 3.1 问题严重程度分布")
                lines.append("")
                for sev, count in by_severity.items():
                    lines.append(f"- **{sev}**: {count} 个")
                lines.append("")

            by_type = validation_summary.get('by_type', {})
            if by_type:
                lines.append("### 3.2 问题类型分布")
                lines.append("")
                for typ, count in by_type.items():
                    type_name = {
                        "time_out_of_order": "时间倒序",
                        "duplicate_timestamp": "重复时间戳",
                        "sampling_rate_inconsistency": "采样频率不一致",
                        "unknown_sensor_id": "未知传感器",
                        "missing_value": "缺失值",
                        "value_out_of_range": "值超出范围",
                    }.get(typ, typ)
                    lines.append(f"- **{type_name}**: {count} 个")
                lines.append("")

        if calibration_info:
            lines.append("## 4. 校准信息")
            lines.append("")

            zero_interval = calibration_info.get('zero_load_interval', {})
            if zero_interval:
                start = zero_interval.get('start', 'N/A')
                end = zero_interval.get('end', 'N/A')
                lines.append(f"### 4.1 空载区间")
                lines.append("")
                lines.append(f"- **开始时间**: {start}")
                lines.append(f"- **结束时间**: {end}")
                lines.append("")

            drift_correction = calibration_info.get('drift_correction', {})
            if drift_correction:
                lines.append("### 4.2 零点漂移校正")
                lines.append("")
                lines.append("| 传感器 | 漂移偏移量 |")
                lines.append("|--------|------------|")
                for sensor_id, offset in drift_correction.items():
                    lines.append(f"| {sensor_id} | {offset:.4f} |")
                lines.append("")

            temp_comp = calibration_info.get('temperature_compensation', {})
            if temp_comp:
                lines.append("### 4.3 温度补偿")
                lines.append("")
                lines.append("| 传感器 | 温度传感器 | 补偿系数 |")
                lines.append("|--------|------------|----------|")
                for sensor_id, info in temp_comp.items():
                    ts = info.get('temperature_sensor', '-')
                    coeff = info.get('compensation_coefficient', 0)
                    lines.append(f"| {sensor_id} | {ts} | {coeff:.6f} |")
                lines.append("")

        lines.append("## 5. 分析结果")
        lines.append("")

        load_levels = analysis_result.get('load_levels', [])
        if load_levels:
            lines.append("### 5.1 加载级分布")
            lines.append("")
            lines.append("| 级次 | 开始时间 | 结束时间 | 荷载值 | 状态 |")
            lines.append("|------|----------|----------|--------|------|")
            for level in load_levels:
                status = "加载" if level.get('is_loading') else "卸载/空载"
                lines.append(f"| {level.get('index')} | {level.get('start_time', '')[:19]} | {level.get('end_time', '')[:19]} | {level.get('load_value', 0):.2f} | {status} |")
            lines.append("")

        peak_strains = analysis_result.get('peak_strains', {})
        if peak_strains:
            lines.append("### 5.2 峰值应变")
            lines.append("")
            lines.append("| 传感器 | 峰值应变 (με) |")
            lines.append("|--------|---------------|")
            for sensor_id, peak in peak_strains.items():
                lines.append(f"| {sensor_id} | {peak:.2f} |")
            lines.append("")

        residuals = analysis_result.get('residual_deformations', {})
        if residuals:
            lines.append("### 5.3 残余变形")
            lines.append("")
            lines.append("| 传感器 | 残余变形 |")
            lines.append("|--------|----------|")
            for sensor_id, res in residuals.items():
                lines.append(f"| {sensor_id} | {res:.4f} |")
            lines.append("")

        na_stats = analysis_result.get('neutral_axis_statistics', {})
        if na_stats.get('mean') is not None:
            lines.append("### 5.4 中性轴位置")
            lines.append("")
            mean_na = na_stats.get('mean', 0)
            std_na = na_stats.get('std', 0)
            lines.append(f"- **平均位置**: {mean_na * 1000:.2f} mm (从底部起)")
            lines.append(f"- **标准差**: {std_na * 1000:.2f} mm")
            lines.append("")

        moment_stats = analysis_result.get('moment_statistics', {})
        if moment_stats.get('max') is not None:
            lines.append("### 5.5 弯矩估算")
            lines.append("")
            max_moment = moment_stats.get('max', 0)
            mean_moment = moment_stats.get('mean_abs', 0)
            lines.append(f"- **最大弯矩**: {max_moment / 1000:.2f} kN·m")
            lines.append(f"- **平均弯矩绝对值**: {mean_moment / 1000:.2f} kN·m")
            lines.append("")

        alerts = analysis_result.get('alerts', [])
        if alerts:
            lines.append("## 6. 风险告警")
            lines.append("")

            critical_alerts = [a for a in alerts if a.get('severity') == 'critical']
            warning_alerts = [a for a in alerts if a.get('severity') == 'warning']

            if critical_alerts:
                lines.append("### 6.1 严重告警")
                lines.append("")
                for alert in critical_alerts[:20]:
                    lines.append(f"- **{alert.get('alert_type')}**: {alert.get('message')}")
                    if alert.get('sensor_id'):
                        lines.append(f"  - 传感器: {alert.get('sensor_id')}")
                    if alert.get('time'):
                        lines.append(f"  - 时间: {alert.get('time')}")
                    lines.append("")

            if warning_alerts:
                lines.append("### 6.2 警告")
                lines.append("")
                for alert in warning_alerts[:20]:
                    lines.append(f"- **{alert.get('alert_type')}**: {alert.get('message')}")
                    if alert.get('sensor_id'):
                        lines.append(f"  - 传感器: {alert.get('sensor_id')}")
                    lines.append("")

            total_alerts = len(alerts)
            if total_alerts > 40:
                lines.append(f"> 注: 共计 {total_alerts} 个告警，此处仅显示前40个")
                lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*本报告由梁板应变漂移校准器自动生成*")

        content = "\n".join(lines)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

        return output_path

    def export_csv(
        self,
        output_path: Path,
        df: pd.DataFrame,
    ) -> Path:
        df.to_csv(output_path, encoding="utf-8")
        return output_path

    def export_json(
        self,
        output_path: Path,
        data: Dict[str, Any],
    ) -> Path:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, cls=DateTimeEncoder)
        return output_path

    def export_all(
        self,
        output_dir: Path,
        aligned_data: pd.DataFrame,
        analysis_result: Dict[str, Any],
        calibration_info: Optional[Dict[str, Any]] = None,
        validation_summary: Optional[Dict[str, Any]] = None,
        prefix: str = "result",
    ) -> Dict[str, Path]:
        output_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        report_path = output_dir / f"{prefix}_report_{timestamp}.md"
        self.export_markdown(report_path, analysis_result, calibration_info, validation_summary)

        csv_path = output_dir / f"{prefix}_cleaned_{timestamp}.csv"
        self.export_csv(csv_path, aligned_data)

        json_path = output_dir / f"{prefix}_analysis_{timestamp}.json"
        self.export_json(json_path, analysis_result)

        return {
            "report": report_path,
            "csv": csv_path,
            "json": json_path,
        }
