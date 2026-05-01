#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from battery_log_lab.parser import DataSet
from battery_log_lab.calculator import (
    ChargeDirection,
    IntegrationResult,
    TrapezoidalIntegrator,
)
from battery_log_lab.anomaly import Anomaly, AnomalySeverity, AnomalyDetector
from battery_log_lab.segmenter import ChargeDischargeSegment, get_segments_summary


@dataclass
class AnalysisResult:
    dataset: DataSet
    integration_result: IntegrationResult
    segments: List[ChargeDischargeSegment]
    segments_summary: Dict[str, Any]
    anomalies: List[Anomaly]
    anomaly_summary: Dict[str, Any]
    generated_at: str


def _format_duration(seconds: float) -> str:
    if seconds < 60:
        return f"{seconds:.1f} 秒"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f} 分钟"
    else:
        hours = seconds / 3600
        return f"{hours:.2f} 小时"


def _format_charge_direction(direction: ChargeDirection) -> str:
    names = {
        ChargeDirection.CHARGE: "充电",
        ChargeDirection.DISCHARGE: "放电",
        ChargeDirection.IDLE: "静置",
    }
    return names.get(direction, str(direction.value))


class MarkdownReporter:
    def __init__(self, title: str = "电池日志分析报告"):
        self.title = title
    
    def generate(self, result: AnalysisResult) -> str:
        lines = []
        
        lines.append(f"# {self.title}")
        lines.append("")
        lines.append(f"> 生成时间: {result.generated_at}")
        lines.append(f"> 源文件: {result.dataset.filename}")
        lines.append("")
        
        lines.append("## 1. 摘要")
        lines.append("")
        lines.append(self._generate_summary_section(result))
        lines.append("")
        
        lines.append("## 2. 异常检测")
        lines.append("")
        lines.append(self._generate_anomaly_section(result))
        lines.append("")
        
        lines.append("## 3. 分段分析")
        lines.append("")
        lines.append(self._generate_segments_section(result))
        lines.append("")
        
        lines.append("## 4. 曲线数据预览")
        lines.append("")
        lines.append(self._generate_curve_preview(result))
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 battery-log-lab 生成*")
        
        return "\n".join(lines)
    
    def _generate_summary_section(self, result: AnalysisResult) -> str:
        lines = []
        
        ds = result.dataset
        summary = result.segments_summary
        total_result = result.integration_result
        
        lines.append("### 基本信息")
        lines.append("")
        lines.append(f"| 项目 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| 数据点数 | {ds.row_count} |")
        lines.append(f"| 总时长 | {_format_duration(ds.duration_seconds)} |")
        lines.append(f"| 平均电流 | {total_result.avg_current_ma:.2f} mA |")
        lines.append(f"| 平均电压 | {total_result.avg_voltage_v:.3f} V |")
        lines.append(f"| 起始电压 | {total_result.start_voltage_v:.3f} V |")
        lines.append(f"| 终止电压 | {total_result.end_voltage_v:.3f} V |")
        lines.append("")
        
        if summary['efficiency_percent'] is not None:
            lines.append("### 充放电统计")
            lines.append("")
            
            charge = summary['charge']
            discharge = summary['discharge']
            idle = summary['idle']
            
            lines.append(f"| 类型 | 段数 | 总容量 | 总能量 | 总时长 |")
            lines.append(f"|------|------|--------|--------|--------|")
            lines.append(f"| **充电** | {charge['count']} | {charge['total_capacity_mah']:.2f} mAh | {charge['total_energy_wh']:.3f} Wh | {_format_duration(charge['total_time_seconds'])} |")
            lines.append(f"| **放电** | {discharge['count']} | {discharge['total_capacity_mah']:.2f} mAh | {discharge['total_energy_wh']:.3f} Wh | {_format_duration(discharge['total_time_seconds'])} |")
            lines.append(f"| **静置** | {idle['count']} | - | - | {_format_duration(idle['total_time_seconds'])} |")
            lines.append("")
            
            lines.append(f"**充放电效率**: {summary['efficiency_percent']:.1f}%")
            lines.append("")
        
        if summary['avg_resistance_ohm'] is not None:
            lines.append("### 内阻估算")
            lines.append("")
            lines.append(f"| 项目 | 数值 |")
            lines.append(f"|------|------|")
            lines.append(f"| 估算平均内阻 | {summary['avg_resistance_ohm'] * 1000:.2f} mΩ |")
            lines.append(f"| 有效估算次数 | {summary['resistance_estimate_count']} |")
            lines.append("")
        
        return "\n".join(lines)
    
    def _generate_anomaly_section(self, result: AnalysisResult) -> str:
        lines = []
        
        anomaly_summary = result.anomaly_summary
        anomalies = result.anomalies
        
        lines.append("### 异常统计")
        lines.append("")
        lines.append(f"| 严重程度 | 数量 |")
        lines.append(f"|----------|------|")
        lines.append(f"| 严重 | {anomaly_summary['by_severity'].get('critical', 0)} |")
        lines.append(f"| 高 | {anomaly_summary['by_severity'].get('high', 0)} |")
        lines.append(f"| 中 | {anomaly_summary['by_severity'].get('medium', 0)} |")
        lines.append(f"| 低 | {anomaly_summary['by_severity'].get('low', 0)} |")
        lines.append(f"| **总计** | **{anomaly_summary['total']}** |")
        lines.append("")
        
        if not anomalies:
            lines.append("✅ 未检测到任何异常")
            lines.append("")
            return "\n".join(lines)
        
        lines.append("### 异常清单")
        lines.append("")
        
        for i, anomaly in enumerate(anomalies, 1):
            severity_marker = {
                AnomalySeverity.CRITICAL: "🔴",
                AnomalySeverity.HIGH: "🟠",
                AnomalySeverity.MEDIUM: "🟡",
                AnomalySeverity.LOW: "🟢",
            }.get(anomaly.severity, "⚪")
            
            lines.append(f"#### {severity_marker} 异常 #{i}")
            lines.append("")
            lines.append(f"- **类型**: {anomaly.type_name}")
            lines.append(f"- **严重程度**: {anomaly.severity_name}")
            if anomaly.row_index >= 0:
                lines.append(f"- **位置**: 第 {anomaly.row_index + 1} 行 (时间: {anomaly.time_seconds:.2f}s)")
            lines.append(f"- **描述**: {anomaly.message}")
            
            if anomaly.details:
                lines.append(f"- **详情**:")
                for key, value in anomaly.details.items():
                    if isinstance(value, float):
                        lines.append(f"  - {key}: {value:.6f}")
                    else:
                        lines.append(f"  - {key}: {value}")
            
            lines.append("")
        
        return "\n".join(lines)
    
    def _generate_segments_section(self, result: AnalysisResult) -> str:
        lines = []
        segments = result.segments
        
        if not segments:
            lines.append("无分段数据")
            lines.append("")
            return "\n".join(lines)
        
        lines.append("### 分段列表")
        lines.append("")
        
        lines.append("| 段号 | 类型 | 起始行 | 结束行 | 时长 | 容量 | 能量 | 起始电压 | 终止电压 |")
        lines.append("|------|------|--------|--------|------|------|------|----------|----------|")
        
        for seg in segments:
            type_icon = {
                ChargeDirection.CHARGE: "🔋",
                ChargeDirection.DISCHARGE: "⚡",
                ChargeDirection.IDLE: "⏸️",
            }.get(seg.direction, "?")
            
            type_name = _format_charge_direction(seg.direction)
            
            lines.append(
                f"| {seg.segment_id + 1} | {type_icon} {type_name} | "
                f"{seg.start_idx + 1} | {seg.end_idx + 1} | "
                f"{_format_duration(seg.duration_seconds)} | "
                f"{seg.capacity_mah:.2f} mAh | "
                f"{seg.energy_wh:.3f} Wh | "
                f"{seg.start_voltage_v:.3f} V | "
                f"{seg.end_voltage_v:.3f} V |"
            )
        
        lines.append("")
        
        has_resistance = any(seg.resistance_estimates for seg in segments)
        if has_resistance:
            lines.append("### 内阻估算详情")
            lines.append("")
            
            for seg in segments:
                if not seg.resistance_estimates:
                    continue
                
                type_name = _format_charge_direction(seg.direction)
                lines.append(f"#### 段 {seg.segment_id + 1} ({type_name})")
                lines.append("")
                lines.append("| 行号 | 时间 | 电流变化 | 电压变化 | 估算内阻 | 置信度 |")
                lines.append("|------|------|----------|----------|----------|--------|")
                
                for est in seg.resistance_estimates:
                    confidence_icon = {
                        'high': "⭐⭐⭐",
                        'medium': "⭐⭐",
                        'low': "⭐",
                    }.get(est.confidence, "?")
                    
                    lines.append(
                        f"| {est.row_index + 1} | {est.time_seconds:.1f}s | "
                        f"{est.current_delta_ma:+.0f} mA | "
                        f"{est.voltage_delta_v:+.4f} V | "
                        f"{est.estimated_resistance_ohm * 1000:.2f} mΩ | "
                        f"{confidence_icon} {est.confidence} |"
                    )
                
                lines.append("")
        
        return "\n".join(lines)
    
    def _generate_curve_preview(self, result: AnalysisResult) -> str:
        lines = []
        ds = result.dataset
        
        sample_rate = max(1, len(ds.time) // 50)
        
        lines.append("### 数据采样 (每 {} 点采样一个)".format(sample_rate))
        lines.append("")
        lines.append("| 行号 | 时间 | 电流 | 电压 |")
        lines.append("|------|------|------|------|")
        
        for i in range(0, len(ds.time), sample_rate):
            lines.append(
                f"| {i + 1} | {ds.time[i]:.1f}s | "
                f"{ds.current[i]:.1f} mA | "
                f"{ds.voltage[i]:.3f} V |"
            )
        
        lines.append("")
        
        lines.append("### 数据范围")
        lines.append("")
        lines.append("| 指标 | 最小值 | 最大值 | 范围 |")
        lines.append("|------|--------|--------|------|")
        
        if ds.current:
            current_min = min(ds.current)
            current_max = max(ds.current)
            lines.append(
                f"| **电流** | {current_min:.1f} mA | {current_max:.1f} mA | "
                f"{current_max - current_min:.1f} mA |"
            )
        
        if ds.voltage:
            voltage_min = min(ds.voltage)
            voltage_max = max(ds.voltage)
            lines.append(
                f"| **电压** | {voltage_min:.3f} V | {voltage_max:.3f} V | "
                f"{voltage_max - voltage_min:.3f} V |"
            )
        
        lines.append("")
        
        return "\n".join(lines)


class HTMLReporter:
    def __init__(self, title: str = "电池日志分析报告"):
        self.title = title
    
    def generate(self, result: AnalysisResult) -> str:
        html_parts = []
        
        html_parts.append("""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>""" + self.title + """</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        h2 {
            color: #2c3e50;
            margin-top: 30px;
            margin-bottom: 15px;
            border-left: 4px solid #3498db;
            padding-left: 10px;
        }
        h3 {
            color: #34495e;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        h4 {
            color: #555;
            margin-top: 15px;
            margin-bottom: 8px;
        }
        .meta {
            color: #7f8c8d;
            font-size: 0.9em;
            margin-bottom: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }
        tr:hover {
            background-color: #f8f9fa;
        }
        .severity-critical { background-color: #fff5f5; border-left: 4px solid #e74c3c; }
        .severity-high { background-color: #fffbf5; border-left: 4px solid #e67e22; }
        .severity-medium { background-color: #fffef5; border-left: 4px solid #f1c40f; }
        .severity-low { background-color: #f5fff5; border-left: 4px solid #2ecc71; }
        .anomaly-box {
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .anomaly-box h4 { margin-top: 0; }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.85em;
            font-weight: 600;
            margin-right: 5px;
        }
        .badge-charge { background: #d4edda; color: #155724; }
        .badge-discharge { background: #f8d7da; color: #721c24; }
        .badge-idle { background: #e2e3e5; color: #383d41; }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card.charge {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }
        .summary-card.discharge {
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
        }
        .summary-card.metrics {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .summary-card-value {
            font-size: 1.8em;
            font-weight: bold;
            margin: 5px 0;
        }
        .summary-card-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #7f8c8d;
            font-size: 0.9em;
        }
        .status-ok {
            color: #2ecc71;
            font-weight: bold;
        }
        .chart-container {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .chart-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: #2c3e50;
        }
        .ascii-chart {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.2;
            overflow-x: auto;
            white-space: pre;
        }
    </style>
</head>
<body>
    <div class="container">
""")
        
        html_parts.append(f"""
        <h1>{self.title}</h1>
        <div class="meta">
            <strong>生成时间:</strong> {result.generated_at}<br>
            <strong>源文件:</strong> {result.dataset.filename}
        </div>
""")
        
        html_parts.append(self._generate_summary_html(result))
        html_parts.append(self._generate_anomaly_html(result))
        html_parts.append(self._generate_segments_html(result))
        html_parts.append(self._generate_curve_html(result))
        
        html_parts.append("""
        <div class="footer">
            此报告由 <strong>battery-log-lab</strong> 生成
        </div>
    </div>
</body>
</html>
""")
        
        return "".join(html_parts)
    
    def _generate_summary_html(self, result: AnalysisResult) -> str:
        ds = result.dataset
        summary = result.segments_summary
        
        html = "<h2>1. 摘要</h2>"
        
        html += """
        <div class="summary-grid">
            <div class="summary-card metrics">
                <div class="summary-card-label">数据点数</div>
                <div class="summary-card-value">{}</div>
                <div class="summary-card-label">总时长</div>
                <div class="summary-card-value">{}</div>
            </div>
""".format(ds.row_count, _format_duration(ds.duration_seconds))
        
        if summary['charge']['count'] > 0:
            html += """
            <div class="summary-card charge">
                <div class="summary-card-label">充电容量</div>
                <div class="summary-card-value">{:.1f} mAh</div>
                <div class="summary-card-label">充电能量</div>
                <div class="summary-card-value">{:.3f} Wh</div>
            </div>
""".format(summary['charge']['total_capacity_mah'], summary['charge']['total_energy_wh'])
        
        if summary['discharge']['count'] > 0:
            html += """
            <div class="summary-card discharge">
                <div class="summary-card-label">放电容量</div>
                <div class="summary-card-value">{:.1f} mAh</div>
                <div class="summary-card-label">放电能量</div>
                <div class="summary-card-value">{:.3f} Wh</div>
            </div>
""".format(summary['discharge']['total_capacity_mah'], summary['discharge']['total_energy_wh'])
        
        if summary['efficiency_percent'] is not None:
            html += """
            <div class="summary-card">
                <div class="summary-card-label">充放电效率</div>
                <div class="summary-card-value">{:.1f}%</div>
            </div>
""".format(summary['efficiency_percent'])
        
        if summary['avg_resistance_ohm'] is not None:
            html += """
            <div class="summary-card">
                <div class="summary-card-label">估算内阻</div>
                <div class="summary-card-value">{:.2f} mΩ</div>
            </div>
""".format(summary['avg_resistance_ohm'] * 1000)
        
        html += "</div>"
        
        html += """
        <h3>详细指标</h3>
        <table>
            <tr><th>指标</th><th>数值</th></tr>
            <tr><td>平均电流</td><td>{:.2f} mA</td></tr>
            <tr><td>平均电压</td><td>{:.3f} V</td></tr>
            <tr><td>起始电压</td><td>{:.3f} V</td></tr>
            <tr><td>终止电压</td><td>{:.3f} V</td></tr>
        </table>
""".format(
            result.integration_result.avg_current_ma,
            result.integration_result.avg_voltage_v,
            result.integration_result.start_voltage_v,
            result.integration_result.end_voltage_v,
        )
        
        return html
    
    def _generate_anomaly_html(self, result: AnalysisResult) -> str:
        anomalies = result.anomalies
        summary = result.anomaly_summary
        
        html = "<h2>2. 异常检测</h2>"
        
        html += """
        <table>
            <tr><th>严重程度</th><th>数量</th></tr>
            <tr><td>🔴 严重</td><td>{}</td></tr>
            <tr><td>🟠 高</td><td>{}</td></tr>
            <tr><td>🟡 中</td><td>{}</td></tr>
            <tr><td>🟢 低</td><td>{}</td></tr>
            <tr><th>总计</th><th>{}</th></tr>
        </table>
""".format(
            summary['by_severity'].get('critical', 0),
            summary['by_severity'].get('high', 0),
            summary['by_severity'].get('medium', 0),
            summary['by_severity'].get('low', 0),
            summary['total'],
        )
        
        if not anomalies:
            html += '<p class="status-ok">✅ 未检测到任何异常</p>'
            return html
        
        html += "<h3>异常清单</h3>"
        
        for i, anomaly in enumerate(anomalies, 1):
            severity_class = {
                AnomalySeverity.CRITICAL: 'severity-critical',
                AnomalySeverity.HIGH: 'severity-high',
                AnomalySeverity.MEDIUM: 'severity-medium',
                AnomalySeverity.LOW: 'severity-low',
            }.get(anomaly.severity, '')
            
            html += f"""
        <div class="anomaly-box {severity_class}">
            <h4>异常 #{i}: {anomaly.type_name}</h4>
            <p><strong>严重程度:</strong> {anomaly.severity_name}</p>
"""
            
            if anomaly.row_index >= 0:
                html += f"            <p><strong>位置:</strong> 第 {anomaly.row_index + 1} 行 (时间: {anomaly.time_seconds:.2f}s)</p>\n"
            
            html += f"            <p><strong>描述:</strong> {anomaly.message}</p>\n"
            
            if anomaly.details:
                html += "            <p><strong>详情:</strong></p>\n"
                html += "            <ul>\n"
                for key, value in anomaly.details.items():
                    if isinstance(value, float):
                        html += f"                <li>{key}: {value:.6f}</li>\n"
                    else:
                        html += f"                <li>{key}: {value}</li>\n"
                html += "            </ul>\n"
            
            html += "        </div>\n"
        
        return html
    
    def _generate_segments_html(self, result: AnalysisResult) -> str:
        segments = result.segments
        
        html = "<h2>3. 分段分析</h2>"
        
        if not segments:
            html += "<p>无分段数据</p>"
            return html
        
        html += """
        <h3>分段列表</h3>
        <table>
            <tr>
                <th>段号</th>
                <th>类型</th>
                <th>起始行</th>
                <th>结束行</th>
                <th>时长</th>
                <th>容量</th>
                <th>能量</th>
                <th>起始电压</th>
                <th>终止电压</th>
            </tr>
"""
        
        for seg in segments:
            type_badge = {
                ChargeDirection.CHARGE: '<span class="badge badge-charge">充电</span>',
                ChargeDirection.DISCHARGE: '<span class="badge badge-discharge">放电</span>',
                ChargeDirection.IDLE: '<span class="badge badge-idle">静置</span>',
            }.get(seg.direction, '')
            
            html += f"""
            <tr>
                <td>{seg.segment_id + 1}</td>
                <td>{type_badge}</td>
                <td>{seg.start_idx + 1}</td>
                <td>{seg.end_idx + 1}</td>
                <td>{_format_duration(seg.duration_seconds)}</td>
                <td>{seg.capacity_mah:.2f} mAh</td>
                <td>{seg.energy_wh:.3f} Wh</td>
                <td>{seg.start_voltage_v:.3f} V</td>
                <td>{seg.end_voltage_v:.3f} V</td>
            </tr>
"""
        
        html += "        </table>\n"
        
        has_resistance = any(seg.resistance_estimates for seg in segments)
        if has_resistance:
            html += "<h3>内阻估算详情</h3>\n"
            
            for seg in segments:
                if not seg.resistance_estimates:
                    continue
                
                type_name = _format_charge_direction(seg.direction)
                html += f"<h4>段 {seg.segment_id + 1} ({type_name})</h4>\n"
                html += """
                <table>
                    <tr>
                        <th>行号</th>
                        <th>时间</th>
                        <th>电流变化</th>
                        <th>电压变化</th>
                        <th>估算内阻</th>
                        <th>置信度</th>
                    </tr>
"""
                
                for est in seg.resistance_estimates:
                    confidence_stars = {
                        'high': '⭐⭐⭐',
                        'medium': '⭐⭐',
                        'low': '⭐',
                    }.get(est.confidence, '?')
                    
                    html += f"""
                    <tr>
                        <td>{est.row_index + 1}</td>
                        <td>{est.time_seconds:.1f}s</td>
                        <td>{est.current_delta_ma:+.0f} mA</td>
                        <td>{est.voltage_delta_v:+.4f} V</td>
                        <td>{est.estimated_resistance_ohm * 1000:.2f} mΩ</td>
                        <td>{confidence_stars} {est.confidence}</td>
                    </tr>
"""
                
                html += "                </table>\n"
        
        return html
    
    def _generate_curve_html(self, result: AnalysisResult) -> str:
        ds = result.dataset
        
        html = "<h2>4. 曲线数据预览</h2>"
        
        sample_rate = max(1, len(ds.time) // 50)
        
        html += f"<p>数据采样 (每 {sample_rate} 点采样一个)</p>"
        html += """
        <table>
            <tr><th>行号</th><th>时间</th><th>电流</th><th>电压</th></tr>
"""
        
        for i in range(0, len(ds.time), sample_rate):
            html += f"""
            <tr>
                <td>{i + 1}</td>
                <td>{ds.time[i]:.1f}s</td>
                <td>{ds.current[i]:.1f} mA</td>
                <td>{ds.voltage[i]:.3f} V</td>
            </tr>
"""
        
        html += "        </table>\n"
        
        if ds.current and ds.voltage:
            current_min = min(ds.current)
            current_max = max(ds.current)
            voltage_min = min(ds.voltage)
            voltage_max = max(ds.voltage)
            
            html += "<h3>数据范围</h3>"
            html += """
            <table>
                <tr><th>指标</th><th>最小值</th><th>最大值</th><th>范围</th></tr>
                <tr><td>电流</td><td>{:.1f} mA</td><td>{:.1f} mA</td><td>{:.1f} mA</td></tr>
                <tr><td>电压</td><td>{:.3f} V</td><td>{:.3f} V</td><td>{:.3f} V</td></tr>
            </table>
""".format(
                current_min, current_max, current_max - current_min,
                voltage_min, voltage_max, voltage_max - voltage_min,
            )
            
            html += self._generate_ascii_chart(ds)
        
        return html
    
    def _generate_ascii_chart(self, ds: 'DataSet') -> str:
        if len(ds.time) < 10:
            return ""
        
        sample_rate = max(1, len(ds.time) // 60)
        sampled_time = ds.time[::sample_rate]
        sampled_current = ds.current[::sample_rate]
        sampled_voltage = ds.voltage[::sample_rate]
        
        if not sampled_voltage or not sampled_current:
            return ""
        
        html = """
        <div class="chart-container">
            <div class="chart-title">电压/电流趋势 (ASCII 图)</div>
            <pre class="ascii-chart">
"""
        
        n = len(sampled_voltage)
        v_min = min(sampled_voltage)
        v_max = max(sampled_voltage)
        v_range = v_max - v_min if v_max > v_min else 1
        
        i_min = min(sampled_current)
        i_max = max(sampled_current)
        i_range = i_max - i_min if i_max > i_min else 1
        
        height = 15
        width = n
        
        chart_lines = []
        
        for row in range(height, -1, -1):
            line_chars = [' '] * width
            
            v_level = v_min + (row / height) * v_range
            for col in range(width):
                v = sampled_voltage[col]
                v_ratio = (v - v_min) / v_range
                v_row = int(v_ratio * height)
                if v_row == row:
                    line_chars[col] = '■'
                elif abs(v_row - row) <= 1:
                    line_chars[col] = '·'
            
            i_level = i_min + (row / height) * i_range
            for col in range(width):
                i = sampled_current[col]
                i_ratio = (i - i_min) / i_range
                i_row = int(i_ratio * height)
                if i_row == row:
                    if line_chars[col] in ['■', '·']:
                        line_chars[col] = '◆'
                    else:
                        line_chars[col] = '●'
            
            label = ""
            if row == height:
                label = f"{v_max:.2f}V "
            elif row == height // 2:
                label = f"{(v_min + v_max)/2:.2f}V "
            elif row == 0:
                label = f"{v_min:.2f}V "
            
            chart_lines.append(label + "│" + "".join(line_chars))
        
        chart_lines.append("        └" + "─" * width)
        chart_lines.append(f"        电压 ■  电流 ●  交点 ◆  样本数: {width}")
        
        html += "\n".join(chart_lines)
        html += """
            </pre>
        </div>
"""
        
        return html


def save_report(
    result: AnalysisResult,
    output_dir: str,
    base_filename: Optional[str] = None,
) -> Tuple[str, str]:
    os.makedirs(output_dir, exist_ok=True)
    
    if base_filename is None:
        base_filename = os.path.splitext(result.dataset.filename)[0]
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = f"{base_filename}_{timestamp}"
    
    md_filename = os.path.join(output_dir, f"{base_name}.md")
    html_filename = os.path.join(output_dir, f"{base_name}.html")
    
    md_reporter = MarkdownReporter()
    md_content = md_reporter.generate(result)
    with open(md_filename, 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    html_reporter = HTMLReporter()
    html_content = html_reporter.generate(result)
    with open(html_filename, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    return md_filename, html_filename
