import csv
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

from .calculator import InverseTimeCurve


class Reporter:
    """报告生成器"""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_issues(self, issues: List[Dict[str, Any]]) -> Path:
        """导出问题清单到 CSV"""
        output_file = self.output_dir / "issues.csv"
        
        with open(output_file, 'w', newline='', encoding='utf-8-sig') as f:
            if not issues:
                writer = csv.writer(f)
                writer.writerow(['序号', '问题ID', '规则名称', '严重程度', '类别',
                               '描述', '相关设备', '故障位置', '故障类型', '建议'])
                return output_file
            
            fieldnames = ['序号', 'issue_id', 'rule_name', 'severity', 'category',
                         'description', 'affected_devices', 'fault_location', 
                         'fault_type', 'recommendation']
            
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for idx, issue in enumerate(issues, 1):
                row = {
                    '序号': idx,
                    'issue_id': issue.get('issue_id', ''),
                    'rule_name': issue.get('rule_name', ''),
                    'severity': self._format_severity(issue.get('severity', '')),
                    'category': issue.get('category', ''),
                    'description': issue.get('description', ''),
                    'affected_devices': ', '.join(issue.get('affected_devices', [])),
                    'fault_location': issue.get('fault_location') or '',
                    'fault_type': issue.get('fault_type') or '',
                    'recommendation': issue.get('recommendation', '')
                }
                writer.writerow(row)
        
        return output_file
    
    def _format_severity(self, severity: str) -> str:
        """格式化严重程度"""
        mapping = {
            'critical': '严重',
            'high': '高',
            'medium': '中',
            'low': '低'
        }
        return mapping.get(severity, severity)
    
    def generate_markdown_report(self, coordination_results: Dict[str, Any],
                                 issues: List[Dict[str, Any]],
                                 input_data: Dict[str, Any]) -> Path:
        """生成 Markdown 格式的配合报告"""
        output_file = self.output_dir / "coordination_report.md"
        
        lines = []
        
        lines.append("# 配网馈线保护配合复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        summary = coordination_results.get('coordination_summary', {})
        total_checks = summary.get('total_coordination_checks', 0)
        coordinated = summary.get('coordinated_checks', 0)
        uncoordinated = summary.get('uncoordinated_checks', 0)
        rate = summary.get('coordination_rate', 0.0)
        
        lines.append("## 一、总体概览")
        lines.append("")
        lines.append("### 1.1 配合情况统计")
        lines.append("")
        lines.append(f"| 指标 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| 总配合检查数 | {total_checks} |")
        lines.append(f"| 配合良好 | {coordinated} |")
        lines.append(f"| 配合不良 | {uncoordinated} |")
        lines.append(f"| 配合率 | {rate*100:.1f}% |")
        lines.append("")
        
        if summary.get('avg_time_margin') is not None:
            lines.append("### 1.2 时间级差统计")
            lines.append("")
            lines.append(f"| 指标 | 数值 |")
            lines.append(f"|------|------|")
            lines.append(f"| 平均时间级差 | {summary['avg_time_margin']:.3f}s |")
            lines.append(f"| 最小时间级差 | {summary['min_time_margin']:.3f}s |")
            lines.append(f"| 最大时间级差 | {summary['max_time_margin']:.3f}s |")
            lines.append("")
        
        lines.append("## 二、问题清单")
        lines.append("")
        
        if issues:
            severity_groups = {
                'critical': [i for i in issues if i.get('severity') == 'critical'],
                'high': [i for i in issues if i.get('severity') == 'high'],
                'medium': [i for i in issues if i.get('severity') == 'medium'],
                'low': [i for i in issues if i.get('severity') == 'low']
            }
            
            for severity, group in [('critical', '严重'), ('high', '高'), 
                                    ('medium', '中'), ('low', '低')]:
                group_issues = severity_groups[severity]
                if group_issues:
                    lines.append(f"### 2.1 {group}级别问题 ({len(group_issues)}个)")
                    lines.append("")
                    
                    for idx, issue in enumerate(group_issues, 1):
                        lines.append(f"#### 问题 {idx}: {issue.get('rule_name', '')}")
                        lines.append("")
                        lines.append(f"- **类别**: {issue.get('category', '')}")
                        lines.append(f"- **相关设备**: {', '.join(issue.get('affected_devices', []))}")
                        if issue.get('fault_location'):
                            lines.append(f"- **故障位置**: {issue.get('fault_location')}")
                        if issue.get('fault_type'):
                            lines.append(f"- **故障类型**: {issue.get('fault_type')}")
                        lines.append("")
                        lines.append(f"**描述**: {issue.get('description', '')}")
                        lines.append("")
                        if issue.get('recommendation'):
                            lines.append(f"**建议**: {issue.get('recommendation', '')}")
                        lines.append("")
                        lines.append("---")
                        lines.append("")
        else:
            lines.append("> ✅ 未检测到保护配合问题。")
            lines.append("")
        
        lines.append("## 三、详细配合分析")
        lines.append("")
        
        fault_analyses = coordination_results.get('fault_analyses', {})
        
        for fault_id, analysis in fault_analyses.items():
            fault_location = getattr(analysis, 'fault_location', fault_id)
            fault_type = getattr(analysis, 'fault_type', '')
            fault_current = getattr(analysis, 'fault_current', 0)
            
            lines.append(f"### 3.1 故障: {fault_location} ({fault_type})")
            lines.append("")
            lines.append(f"**故障电流**: {fault_current}A")
            lines.append("")
            
            actions = getattr(analysis, 'protection_actions', [])
            if actions:
                lines.append("#### 保护动作情况")
                lines.append("")
                lines.append(f"| 设备 | 段数 | 动作电流(A) | 故障电流(A) | 动作时间(s) | 灵敏度 | 是否动作 |")
                lines.append(f"|------|------|-------------|-------------|-------------|--------|----------|")
                
                for action in actions:
                    device_id = getattr(action, 'device_id', '')
                    stage = getattr(action, 'stage', 0)
                    pickup = getattr(action, 'pickup_current', 0)
                    fault_seen = getattr(action, 'fault_current_seen', 0)
                    op_time = getattr(action, 'operating_time', float('inf'))
                    sensitivity = getattr(action, 'sensitivity', None)
                    is_operated = getattr(action, 'is_operated', False)
                    
                    time_str = f"{op_time:.3f}" if op_time != float('inf') else "不动作"
                    sens_str = f"{sensitivity:.2f}" if sensitivity else "-"
                    op_str = "是" if is_operated else "否"
                    
                    lines.append(f"| {device_id} | {stage} | {pickup:.2f} | {fault_seen:.2f} | {time_str} | {sens_str} | {op_str} |")
                
                lines.append("")
            
            checks = getattr(analysis, 'coordination_checks', [])
            if checks:
                lines.append("#### 配合情况检查")
                lines.append("")
                lines.append(f"| 上级保护 | 下级保护 | 上级时间(s) | 下级时间(s) | 级差(s) | 是否配合 |")
                lines.append(f"|----------|----------|-------------|-------------|---------|----------|")
                
                for check in checks:
                    upstream = getattr(check, 'upstream_device', '')
                    downstream = getattr(check, 'downstream_device', '')
                    up_time = getattr(check, 'upstream_operating_time', 0)
                    down_time = getattr(check, 'downstream_operating_time', 0)
                    margin = getattr(check, 'time_margin', 0)
                    coordinated = getattr(check, 'is_coordinated', False)
                    
                    coord_str = "✅ 配合" if coordinated else "❌ 不配合"
                    
                    lines.append(f"| {upstream} | {downstream} | {up_time:.3f} | {down_time:.3f} | {margin:.3f} | {coord_str} |")
                
                lines.append("")
        
        lines.append("## 四、设备定值清单")
        lines.append("")
        
        settings = input_data.get('settings', [])
        if settings:
            lines.append(f"| 设备ID | 设备名称 | I段电流(A) | I段时间(s) | II段电流(A) | II段时间(s) | CT变比 |")
            lines.append(f"|--------|----------|------------|------------|-------------|-------------|--------|")
            
            for setting in settings:
                device_id = setting.get('device_id', '')
                device_name = setting.get('device_name', '')
                oc1_current = setting.get('phase_oc1_current') or '-'
                oc1_time = setting.get('phase_oc1_time') or '-'
                oc2_current = setting.get('phase_oc2_current') or '-'
                oc2_time = setting.get('phase_oc2_time') or '-'
                ct_ratio = setting.get('ct_ratio', '-')
                
                lines.append(f"| {device_id} | {device_name} | {oc1_current} | {oc1_time} | {oc2_current} | {oc2_time} | {ct_ratio} |")
            
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告由 feeder-coord 工具自动生成*")
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return output_file
    
    def generate_html_curve_preview(self, coordination_results: Dict[str, Any],
                                      input_data: Dict[str, Any]) -> Path:
        """生成 HTML 曲线预览"""
        output_file = self.output_dir / "curve_preview.html"
        
        settings = input_data.get('settings', [])
        
        curve_data = []
        
        for setting in settings:
            device_id = setting.get('device_id', '')
            device_name = setting.get('device_name', device_id)
            
            oc1_current = setting.get('phase_oc1_current')
            oc1_time = setting.get('phase_oc1_time', 1.0)
            ct_ratio = setting.get('ct_ratio', 1.0)
            curve_type = setting.get('inverse_time_curve', 'SI')
            alpha = setting.get('inverse_time_alpha')
            p = setting.get('inverse_time_p')
            
            if oc1_current and ct_ratio:
                pickup_primary = oc1_current * ct_ratio
                time_dial = oc1_time or 1.0
                
                points = InverseTimeCurve.get_curve_points(
                    pickup_current=pickup_primary,
                    time_dial=time_dial,
                    curve_type=curve_type,
                    alpha=alpha,
                    p=p,
                    current_range=(1.1, 10.0),
                    points=50
                )
                
                curve_data.append({
                    'device_id': device_id,
                    'device_name': device_name,
                    'pickup_current': pickup_primary,
                    'time_dial': time_dial,
                    'curve_type': curve_type,
                    'points': points
                })
        
        colors = [
            '#e6194b', '#3cb44b', '#4363d8', '#f58231',
            '#911eb4', '#46f0f0', '#f032e6', '#bcf60c'
        ]
        
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>保护配合特性曲线预览</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f7fa;
            padding: 20px;
        }}
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        .header {{
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        .header h1 {{
            color: #1a1a2e;
            font-size: 24px;
            margin-bottom: 8px;
        }}
        .header p {{
            color: #666;
            font-size: 14px;
        }}
        .chart-container {{
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        .chart-title {{
            color: #1a1a2e;
            font-size: 18px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #eee;
        }}
        .legend {{
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            margin-top: 16px;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: #444;
        }}
        .legend-color {{
            width: 16px;
            height: 16px;
            border-radius: 3px;
        }}
        .info-panel {{
            background: white;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .info-title {{
            color: #1a1a2e;
            font-size: 16px;
            margin-bottom: 16px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }}
        th, td {{
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }}
        th {{
            background: #f8f9fa;
            color: #444;
            font-weight: 600;
        }}
        tr:hover {{
            background: #f8f9fa;
        }}
        .status-good {{
            color: #3cb44b;
        }}
        .status-warning {{
            color: #f58231;
        }}
        .status-bad {{
            color: #e6194b;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>保护配合特性曲线预览</h1>
            <p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
        
        <div class="chart-container">
            <h2 class="chart-title">反时限特性曲线 (I段保护)</h2>
            <div style="height: 500px;">
                <canvas id="curveChart"></canvas>
            </div>
            <div class="legend" id="curveLegend"></div>
        </div>
        
        <div class="info-panel">
            <h3 class="info-title">保护定值汇总</h3>
            <table>
                <thead>
                    <tr>
                        <th>设备</th>
                        <th>I段电流(一次A)</th>
                        <th>时间常数</th>
                        <th>曲线类型</th>
                    </tr>
                </thead>
                <tbody>
"""
        
        for idx, curve in enumerate(curve_data):
            color = colors[idx % len(colors)]
            html_content += f"""
                    <tr>
                        <td><span style="color:{color}">●</span> {curve['device_name']}</td>
                        <td>{curve['pickup_current']:.2f}</td>
                        <td>{curve['time_dial']:.2f}</td>
                        <td>{curve['curve_type']}</td>
                    </tr>
"""
        
        html_content += f"""
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        const curveData = {json.dumps(curve_data, ensure_ascii=False)};
        const colors = {json.dumps(colors)};
        
        document.addEventListener('DOMContentLoaded', function() {{
            const ctx = document.getElementById('curveChart').getContext('2d');
            
            const datasets = curveData.map((curve, idx) => {{
                const color = colors[idx % colors.length];
                return {{
                    label: curve.device_name,
                    data: curve.points.map(p => ({{x: p[0], y: p[1]}})),
                    borderColor: color,
                    backgroundColor: color + '20',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }};
            }});
            
            const chart = new Chart(ctx, {{
                type: 'line',
                data: {{
                    datasets: datasets
                }},
                options: {{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {{
                        mode: 'index',
                        intersect: false
                    }},
                    plugins: {{
                        legend: {{
                            display: false
                        }},
                        tooltip: {{
                            callbacks: {{
                                label: function(context) {{
                                    return context.dataset.label + ': 电流=' + 
                                           context.parsed.x.toFixed(2) + 'A, 时间=' + 
                                           context.parsed.y.toFixed(3) + 's';
                                }}
                            }}
                        }}
                    }},
                    scales: {{
                        x: {{
                            type: 'linear',
                            position: 'bottom',
                            title: {{
                                display: true,
                                text: '故障电流 (A, 一次侧)'
                            }},
                            grid: {{
                                color: '#f0f0f0'
                            }}
                        }},
                        y: {{
                            type: 'linear',
                            position: 'left',
                            title: {{
                                display: true,
                                text: '动作时间 (s)'
                            }},
                            grid: {{
                                color: '#f0f0f0'
                            }},
                            beginAtZero: true
                        }}
                    }}
                }}
            }});
            
            const legendContainer = document.getElementById('curveLegend');
            curveData.forEach((curve, idx) => {{
                const color = colors[idx % colors.length];
                const item = document.createElement('div');
                item.className = 'legend-item';
                item.innerHTML = '<div class="legend-color" style="background-color:' + color + '"></div>' +
                                 '<span>' + curve.device_name + '</span>';
                legendContainer.appendChild(item);
            }});
        }});
    </script>
</body>
</html>
"""
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return output_file
