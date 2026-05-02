import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
from .rules import DetectedIssue, IssueType, IssueSeverity, issues_to_dataframe


def generate_markdown_report(
    turbine_df: pd.DataFrame,
    all_statistics: Dict[str, Dict[str, Any]],
    all_issues: List[DetectedIssue],
    rules: Dict[str, Any],
    output_path: Path
) -> None:
    """生成 Markdown 格式的分析报告"""
    
    total_turbines = len(turbine_df)
    turbines_with_issues = len(set(issue.turbine_id for issue in all_issues))
    
    critical_issues = [i for i in all_issues if i.severity == IssueSeverity.CRITICAL]
    high_issues = [i for i in all_issues if i.severity == IssueSeverity.HIGH]
    medium_issues = [i for i in all_issues if i.severity == IssueSeverity.MEDIUM]
    low_issues = [i for i in all_issues if i.severity == IssueSeverity.LOW]
    
    total_power_loss = sum(
        stats.get("total_power_loss_kwh", 0) 
        for stats in all_statistics.values() 
        if stats.get("has_data", False)
    )
    
    report_lines = []
    
    report_lines.append("# 风电机组偏航效率复核报告")
    report_lines.append("")
    report_lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append("")
    
    report_lines.append("## 执行摘要")
    report_lines.append("")
    report_lines.append(f"- **分析机组总数**: {total_turbines} 台")
    report_lines.append(f"- **存在问题机组**: {turbines_with_issues} 台")
    report_lines.append(f"- **估算总功率损失**: {total_power_loss:.2f} kWh")
    report_lines.append("")
    report_lines.append("### 问题统计")
    report_lines.append("")
    report_lines.append("| 严重程度 | 数量 |")
    report_lines.append("|----------|------|")
    report_lines.append(f"| 严重 (Critical) | {len(critical_issues)} |")
    report_lines.append(f"| 高 (High) | {len(high_issues)} |")
    report_lines.append(f"| 中 (Medium) | {len(medium_issues)} |")
    report_lines.append(f"| 低 (Low) | {len(low_issues)} |")
    report_lines.append("")
    
    if all_issues:
        report_lines.append("## 问题详情")
        report_lines.append("")
        
        for severity in [IssueSeverity.CRITICAL, IssueSeverity.HIGH, IssueSeverity.MEDIUM, IssueSeverity.LOW]:
            severity_issues = [i for i in all_issues if i.severity == severity]
            if severity_issues:
                report_lines.append(f"### {severity.value.upper()} 级问题")
                report_lines.append("")
                
                for issue in severity_issues:
                    report_lines.append(f"#### 机组 {issue.turbine_id}: {issue.issue_type.value}")
                    report_lines.append("")
                    report_lines.append(f"- **描述**: {issue.description}")
                    report_lines.append(f"- **检测值**: {issue.metric_value:.4f} (阈值: {issue.threshold})")
                    report_lines.append(f"- **影响采样点**: {issue.affected_samples}")
                    if issue.start_time:
                        report_lines.append(f"- **开始时间**: {issue.start_time}")
                    if issue.end_time:
                        report_lines.append(f"- **结束时间**: {issue.end_time}")
                    report_lines.append(f"- **建议**: {issue.recommendation}")
                    report_lines.append("")
    
    report_lines.append("## 机组详细统计")
    report_lines.append("")
    
    for turbine_id in sorted(all_statistics.keys()):
        stats = all_statistics[turbine_id]
        turbine_info = turbine_df[turbine_df["turbine_id"] == turbine_id]
        
        report_lines.append(f"### 机组 {turbine_id}")
        report_lines.append("")
        
        if not turbine_info.empty:
            rated_power = turbine_info.iloc[0].get("rated_power", "N/A")
            report_lines.append(f"- **额定功率**: {rated_power} kW")
        
        if stats.get("has_data", False):
            report_lines.append(f"- **总采样点**: {stats['total_samples']}")
            report_lines.append(f"- **有效采样点**: {stats['valid_samples']}")
            report_lines.append(f"- **数据缺口**: {stats['missing_samples_count']} 处")
            report_lines.append("")
            report_lines.append("#### 偏航误差统计")
            report_lines.append("")
            report_lines.append(f"- **平均偏航误差**: {stats['mean_yaw_error_deg']:.2f}°")
            report_lines.append(f"- **中位数偏航误差**: {stats['median_yaw_error_deg']:.2f}°")
            report_lines.append(f"- **平均绝对误差**: {stats['mean_absolute_yaw_error_deg']:.2f}°")
            report_lines.append(f"- **最大绝对误差**: {stats['max_absolute_yaw_error_deg']:.2f}°")
            report_lines.append("")
            report_lines.append("#### 功率损失估算")
            report_lines.append("")
            report_lines.append(f"- **总估算损失**: {stats['total_power_loss_kwh']:.2f} kWh")
            report_lines.append(f"- **平均损失功率**: {stats['mean_power_loss_kw']:.2f} kW")
            report_lines.append("")
            if stats.get("yaw_threshold_exceed_rate", 0) > 0:
                report_lines.append(f"- **超过误差阈值采样点**: {stats['samples_exceeding_yaw_threshold']} 个")
                report_lines.append(f"- **超限比例**: {stats['yaw_threshold_exceed_rate']*100:.1f}%")
                report_lines.append("")
            report_lines.append("#### 数据覆盖")
            report_lines.append("")
            report_lines.append(f"- **数据起始时间**: {stats['data_start_time']}")
            report_lines.append(f"- **数据结束时间**: {stats['data_end_time']}")
            report_lines.append(f"- **覆盖时长**: {stats['coverage_hours']:.1f} 小时")
        else:
            report_lines.append(f"- **状态**: 无有效数据")
            report_lines.append(f"- **总采样点**: {stats.get('total_samples', 0)}")
        
        report_lines.append("")
    
    report_lines.append("## 规则配置")
    report_lines.append("")
    report_lines.append("| 参数 | 值 | 说明 |")
    report_lines.append("|------|-----|------|")
    report_lines.append(f"| 偏航误差阈值 | {rules.get('yaw_error_threshold', 15.0)}° | 超过此值标记为过度误差 |")
    report_lines.append(f"| 功率损失系数 | {rules.get('power_loss_factor', 0.0015)} | 用于功率损失估算 |")
    report_lines.append(f"| 风向仪漂移阈值 | {rules.get('anemometer_drift_threshold', 5.0)}° | 平均偏差超过此值触发警告 |")
    report_lines.append(f"| 长期偏差阈值 | {rules.get('long_term_bias_threshold', 8.0)}° | 时间段平均偏差阈值 |")
    report_lines.append(f"| 长期偏差周期 | {rules.get('long_term_bias_period_hours', 24)} 小时 | 统计周期 |")
    report_lines.append(f"| 有效风速范围 | {rules.get('valid_wind_speed_range', [3.0, 25.0])[0]} - {rules.get('valid_wind_speed_range', [3.0, 25.0])[1]} m/s | 分析时使用的风速范围 |")
    report_lines.append("")
    
    report_content = "\n".join(report_lines)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report_content)


def generate_issues_csv(
    issues: List[DetectedIssue],
    output_path: Path
) -> None:
    """生成问题列表 CSV 文件"""
    df = issues_to_dataframe(issues)
    df.to_csv(output_path, index=False, encoding="utf-8-sig")


def generate_timeline_html(
    all_timelines: Dict[str, pd.DataFrame],
    all_statistics: Dict[str, Dict[str, Any]],
    rules: Dict[str, Any],
    output_path: Path
) -> None:
    """生成交互式时间线 HTML 文件"""
    
    html_template = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>风电机组偏航效率时间线</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1600px; margin: 0 auto; }
        h1 { color: #1a1a1a; margin-bottom: 20px; text-align: center; }
        .summary { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .summary-item { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .summary-item .label { font-size: 12px; color: #666; margin-bottom: 5px; }
        .summary-item .value { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .turbine-section { background: white; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
        .turbine-header { background: #2c3e50; color: white; padding: 15px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
        .turbine-header:hover { background: #34495e; }
        .turbine-stats { display: flex; gap: 20px; font-size: 14px; }
        .turbine-content { padding: 20px; display: none; }
        .turbine-content.expanded { display: block; }
        .chart-container { position: relative; height: 300px; margin-bottom: 20px; }
        .chart-canvas { width: 100%; height: 100%; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .data-table th, .data-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
        .data-table th { background: #f8f9fa; font-weight: 600; }
        .data-table tr:hover { background: #f8f9fa; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
        .status-good { background: #d4edda; color: #155724; }
        .status-warning { background: #fff3cd; color: #856404; }
        .status-danger { background: #f8d7da; color: #721c24; }
        .toggle-icon { transition: transform 0.3s; }
        .toggle-icon.rotated { transform: rotate(180deg); }
        .legend { display: flex; gap: 20px; justify-content: center; padding: 15px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; }
        .legend-color { width: 20px; height: 4px; }
        .no-data { text-align: center; padding: 40px; color: #999; }
    </style>
</head>
<body>
    <div class="container">
        <h1>风电机组偏航效率时间线</h1>
        
        <div class="summary">
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="label">分析机组数</div>
                    <div class="value" id="totalTurbines">0</div>
                </div>
                <div class="summary-item">
                    <div class="label">总功率损失 (kWh)</div>
                    <div class="value" id="totalPowerLoss">0.00</div>
                </div>
                <div class="summary-item">
                    <div class="label">平均绝对偏航误差 (°)</div>
                    <div class="value" id="avgYawError">0.00</div>
                </div>
                <div class="summary-item">
                    <div class="label">数据覆盖时长 (小时)</div>
                    <div class="value" id="totalCoverage">0.0</div>
                </div>
            </div>
        </div>

        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #3498db;"></div>
                <span>风向</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #2ecc71;"></div>
                <span>机舱角度</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #e74c3c;"></div>
                <span>偏航误差</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #f39c12;"></div>
                <span>功率损失</span>
            </div>
        </div>

        <div id="turbineList"></div>
    </div>

    <script>
        const allData = {{ALL_DATA}};
        const rules = {{RULES}};
        
        function init() {
            document.getElementById('totalTurbines').textContent = Object.keys(allData.timelines).length;
            document.getElementById('totalPowerLoss').textContent = allData.summary.totalPowerLoss.toFixed(2);
            document.getElementById('avgYawError').textContent = allData.summary.avgYawError.toFixed(2);
            document.getElementById('totalCoverage').textContent = allData.summary.totalCoverage.toFixed(1);
            
            renderTurbines();
        }
        
        function renderTurbines() {
            const container = document.getElementById('turbineList');
            
            for (const [turbineId, timeline] of Object.entries(allData.timelines)) {
                const stats = allData.statistics[turbineId] || {};
                const section = document.createElement('div');
                section.className = 'turbine-section';
                
                const hasData = stats.has_data;
                const avgError = stats.mean_absolute_yaw_error_deg || 0;
                const statusClass = avgError > rules.yaw_error_threshold ? 'status-danger' : 
                                    avgError > rules.yaw_error_threshold * 0.5 ? 'status-warning' : 'status-good';
                
                section.innerHTML = `
                    <div class="turbine-header" onclick="toggleSection(this)">
                        <div>
                            <strong>机组 ${turbineId}</strong>
                            <span class="status-badge ${statusClass}" style="margin-left: 15px;">
                                ${hasData ? '有数据' : '无数据'}
                            </span>
                        </div>
                        <div class="turbine-stats">
                            ${hasData ? `
                                <span>平均误差: ${avgError.toFixed(2)}°</span>
                                <span>损失: ${stats.total_power_loss_kwh.toFixed(2)} kWh</span>
                                <span>采样: ${stats.valid_samples}</span>
                            ` : ''}
                            <span class="toggle-icon">▼</span>
                        </div>
                    </div>
                    <div class="turbine-content">
                        ${hasData ? renderTurbineContent(turbineId, timeline, stats) : '<div class="no-data">无有效数据</div>'}
                    </div>
                `;
                
                container.appendChild(section);
            }
        }
        
        function renderTurbineContent(turbineId, timeline, stats) {
            return `
                <div class="chart-container">
                    <canvas id="chart-${turbineId}" class="chart-canvas"></canvas>
                </div>
                ${renderDataTable(timeline)}
            `;
        }
        
        function renderDataTable(timeline) {
            const recentData = timeline.slice(-20);
            let html = `
                <h4 style="margin: 20px 0 10px; color: #2c3e50;">最近 20 条数据预览</h4>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>时间</th>
                            <th>风向 (°)</th>
                            <th>机舱角度 (°)</th>
                            <th>偏航误差 (°)</th>
                            <th>绝对误差 (°)</th>
                            <th>风速 (m/s)</th>
                            <th>功率 (kW)</th>
                            <th>估算损失 (kW)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            for (const row of recentData) {
                const errorClass = Math.abs(row.yaw_error_deg) > rules.yaw_error_threshold ? 
                    'style="color: #e74c3c; font-weight: bold;"' : '';
                html += `
                    <tr>
                        <td>${row.timestamp}</td>
                        <td>${row.wind_direction.toFixed(1)}</td>
                        <td>${row.nacelle_angle.toFixed(1)}</td>
                        <td ${errorClass}>${row.yaw_error_deg.toFixed(2)}</td>
                        <td ${errorClass}>${row.absolute_yaw_error_deg.toFixed(2)}</td>
                        <td>${row.wind_speed.toFixed(1)}</td>
                        <td>${row.active_power.toFixed(1)}</td>
                        <td>${row.estimated_power_loss_kw.toFixed(3)}</td>
                    </tr>
                `;
            }
            
            html += '</tbody></table>';
            return html;
        }
        
        function toggleSection(header) {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.toggle-icon');
            
            content.classList.toggle('expanded');
            icon.classList.toggle('rotated');
        }
        
        init();
    </script>
</body>
</html>
"""
    
    timelines_json = {}
    for turbine_id, df in all_timelines.items():
        if not df.empty:
            records = df[[
                "timestamp", "wind_direction", "nacelle_angle", 
                "yaw_error_deg", "absolute_yaw_error_deg", 
                "wind_speed", "active_power", "estimated_power_loss_kw"
            ]].copy()
            records["timestamp"] = records["timestamp"].astype(str)
            timelines_json[turbine_id] = records.to_dict(orient="records")
        else:
            timelines_json[turbine_id] = []
    
    total_power_loss = sum(
        s.get("total_power_loss_kwh", 0) 
        for s in all_statistics.values() 
        if s.get("has_data", False)
    )
    
    valid_stats = [s for s in all_statistics.values() if s.get("has_data", False)]
    avg_yaw_error = (
        sum(s.get("mean_absolute_yaw_error_deg", 0) for s in valid_stats) / len(valid_stats)
        if valid_stats else 0
    )
    
    total_coverage = sum(
        s.get("coverage_hours", 0) 
        for s in all_statistics.values() 
        if s.get("has_data", False)
    )
    
    summary = {
        "totalPowerLoss": total_power_loss,
        "avgYawError": avg_yaw_error,
        "totalCoverage": total_coverage
    }
    
    import json
    all_data = {
        "timelines": timelines_json,
        "statistics": all_statistics,
        "summary": summary
    }
    
    html_content = html_template.replace(
        "{{ALL_DATA}}", json.dumps(all_data, default=str, ensure_ascii=False)
    ).replace(
        "{{RULES}}", json.dumps(rules, default=str, ensure_ascii=False)
    )
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)


def generate_all_reports(
    turbine_df: pd.DataFrame,
    all_timelines: Dict[str, pd.DataFrame],
    all_statistics: Dict[str, Dict[str, Any]],
    all_issues: List[DetectedIssue],
    rules: Dict[str, Any],
    output_dir: Path
) -> Dict[str, Path]:
    """生成所有报告文件
    
    Returns:
        生成的文件路径字典
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    report_md_path = output_dir / "report.md"
    issues_csv_path = output_dir / "issues.csv"
    timeline_html_path = output_dir / "turbine_timeline.html"
    
    generate_markdown_report(turbine_df, all_statistics, all_issues, rules, report_md_path)
    generate_issues_csv(all_issues, issues_csv_path)
    generate_timeline_html(all_timelines, all_statistics, rules, timeline_html_path)
    
    return {
        "report_md": report_md_path,
        "issues_csv": issues_csv_path,
        "timeline_html": timeline_html_path
    }