"""报告导出模块 - 生成复核报告和可视化"""
import csv
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime

from .parser import Well, ControlConfig
from .rules import ReviewResult, CallStatus, RiskLevel


def export_issues_csv(result: ReviewResult, output_path: Path) -> None:
    """
    导出问题列表为 CSV
    """
    fieldnames = [
        "category", "sample_id", "target", "wells", 
        "severity", "message"
    ]
    
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for issue in result.all_issues:
            writer.writerow(issue)


def generate_markdown_report(
    result: ReviewResult,
    config: ControlConfig,
    plate_layout_path: Path,
    ct_results_path: Path,
    controls_path: Path
) -> str:
    """
    生成 Markdown 格式的复核报告
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    total_wells = len(result.wells)
    total_samples = len([
        g for g in result.replicate_groups.values()
        if g.sample_id not in [
            *[c.sample_id for c in result.positive_controls],
            *[c.sample_id for c in result.negative_controls],
            *[c.sample_id for c in result.ntc_controls]
        ]
    ])
    
    positive_count = len([
        g for g in result.replicate_groups.values()
        if g.call_status == CallStatus.POSITIVE
    ])
    negative_count = len([
        g for g in result.replicate_groups.values()
        if g.call_status == CallStatus.NEGATIVE
    ])
    indeterminate_count = len([
        g for g in result.replicate_groups.values()
        if g.call_status == CallStatus.INDETERMINATE
    ])
    missing_count = len([
        g for g in result.replicate_groups.values()
        if g.call_status == CallStatus.MISSING
    ])
    
    error_count = len([i for i in result.all_issues if i['severity'] == 'error'])
    warning_count = len([i for i in result.all_issues if i['severity'] == 'warning'])
    
    report = f"""# qPCR 96孔板结果复核报告

**生成时间**: {now}

## 输入文件

- 孔板布局: `{plate_layout_path.name}`
- Ct 结果: `{ct_results_path.name}`
- 对照配置: `{controls_path.name}`

## 分析参数

| 参数 | 值 |
|------|-----|
| Ct 阳性阈值 | {config.ct_cutoff} |
| 重复孔容差 | {config.replicate_tolerance} |
| 最小 NTC 数量 | {config.min_ntc_count} |

## 概览

| 统计项 | 数量 |
|--------|------|
| 总孔数 | {total_wells} |
| 独立样本数 | {total_samples} |
| 阳性结果 | {positive_count} |
| 阴性结果 | {negative_count} |
| 不确定结果 | {indeterminate_count} |
| 缺失结果 | {missing_count} |
| 错误数 | {error_count} |
| 警告数 | {warning_count} |

## 风险评估

### 污染风险

**等级**: {result.risk_assessment.contamination_risk.value.upper()}

"""
    
    if result.risk_assessment.contamination_details:
        report += "**详情**:\n"
        for detail in result.risk_assessment.contamination_details:
            report += f"- {detail}\n"
    else:
        report += "未检测到污染风险。\n"
    
    report += """
### 抑制风险

**等级**: """ + result.risk_assessment.inhibition_risk.value.upper() + "\n\n"
    
    if result.risk_assessment.inhibition_details:
        report += "**详情**:\n"
        for detail in result.risk_assessment.inhibition_details:
            report += f"- {detail}\n"
    else:
        report += "未检测到抑制风险。\n"
    
    report += """
## 对照验证

### 阳性对照

| 样本ID | 靶标 | 孔位 | Ct 均值 | 状态 |
|--------|------|------|---------|------|
"""
    
    for ctrl in result.positive_controls:
        wells = ", ".join([w.well_id for w in ctrl.wells])
        ct_mean = f"{ctrl.ct_mean:.2f}" if ctrl.ct_mean is not None else "N/A"
        status = "✅ 通过" if ctrl.passed else "❌ 失败"
        report += f"| {ctrl.sample_id} | {ctrl.target} | {wells} | {ct_mean} | {status} |\n"
    
    report += """
### 阴性对照

| 样本ID | 靶标 | 孔位 | Ct 均值 | 状态 |
|--------|------|------|---------|------|
"""
    
    for ctrl in result.negative_controls:
        wells = ", ".join([w.well_id for w in ctrl.wells])
        ct_mean = f"{ctrl.ct_mean:.2f}" if ctrl.ct_mean is not None else "N/A"
        status = "✅ 通过" if ctrl.passed else "❌ 失败"
        report += f"| {ctrl.sample_id} | {ctrl.target} | {wells} | {ct_mean} | {status} |\n"
    
    report += """
### NTC (无模板对照)

| 样本ID | 靶标 | 孔位 | Ct 均值 | 状态 |
|--------|------|------|---------|------|
"""
    
    for ctrl in result.ntc_controls:
        wells = ", ".join([w.well_id for w in ctrl.wells])
        ct_mean = f"{ctrl.ct_mean:.2f}" if ctrl.ct_mean is not None else "N/A"
        status = "✅ 通过" if ctrl.passed else "❌ 失败"
        report += f"| {ctrl.sample_id} | {ctrl.target} | {wells} | {ct_mean} | {status} |\n"
    
    report += """
## 样本结果

| 样本ID | 靶标 | 孔位 | Ct 均值 | Ct SD | 状态 | 离群孔 |
|--------|------|------|---------|-------|------|--------|
"""
    
    control_sample_ids = set()
    for ctrl_list in [result.positive_controls, result.negative_controls, result.ntc_controls]:
        for ctrl in ctrl_list:
            control_sample_ids.add(ctrl.sample_id)
    
    for key, group in sorted(result.replicate_groups.items()):
        if group.sample_id in control_sample_ids:
            continue
        
        wells = ", ".join([w.well_id for w in group.wells])
        ct_mean = f"{group.ct_mean:.2f}" if group.ct_mean is not None else "N/A"
        ct_std = f"{group.ct_std:.2f}" if group.ct_std is not None else "N/A"
        
        status_mapping = {
            CallStatus.POSITIVE: "🟢 阳性",
            CallStatus.NEGATIVE: "🔴 阴性",
            CallStatus.INDETERMINATE: "🟡 不确定",
            CallStatus.MISSING: "⚪ 缺失"
        }
        status = status_mapping.get(group.call_status, "未知")
        
        outliers = ", ".join([w.well_id for w in group.outlier_wells]) if group.outlier_wells else "无"
        
        report += f"| {group.sample_id} | {group.target} | {wells} | {ct_mean} | {ct_std} | {status} | {outliers} |\n"
    
    if result.all_issues:
        report += """
## 问题列表

### 错误 (需立即处理)

"""
        
        errors = [i for i in result.all_issues if i['severity'] == 'error']
        if errors:
            for idx, issue in enumerate(errors, 1):
                wells = issue['wells'] if issue['wells'] else "N/A"
                sample = issue['sample_id'] if issue['sample_id'] else "N/A"
                target = issue['target'] if issue['target'] else "N/A"
                report += f"{idx}. **[{issue['category']}]** {sample} ({target}) - 孔位: {wells}\n"
                report += f"   - {issue['message']}\n\n"
        else:
            report += "无错误。\n"
        
        report += """
### 警告 (需关注)

"""
        
        warnings = [i for i in result.all_issues if i['severity'] == 'warning']
        if warnings:
            for idx, issue in enumerate(warnings, 1):
                wells = issue['wells'] if issue['wells'] else "N/A"
                sample = issue['sample_id'] if issue['sample_id'] else "N/A"
                target = issue['target'] if issue['target'] else "N/A"
                report += f"{idx}. **[{issue['category']}]** {sample} ({target}) - 孔位: {wells}\n"
                report += f"   - {issue['message']}\n\n"
        else:
            report += "无警告。\n"
    
    report += """
---

*此报告由 qPCR Reviewer 自动生成*
"""
    
    return report


def export_markdown_report(
    result: ReviewResult,
    config: ControlConfig,
    output_path: Path,
    plate_layout_path: Path,
    ct_results_path: Path,
    controls_path: Path
) -> None:
    """
    导出 Markdown 报告到文件
    """
    report_content = generate_markdown_report(
        result, config, plate_layout_path, ct_results_path, controls_path
    )
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(report_content)


def generate_heatmap_html(
    result: ReviewResult,
    config: ControlConfig
) -> str:
    """
    生成交互式 HTML 热图
    """
    rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    cols = list(range(1, 13))
    
    well_data = {}
    for row in rows:
        for col in cols:
            well_id = f"{row}{col}"
            well_data[well_id] = {
                'exists': False,
                'ct_value': None,
                'sample_id': '',
                'target': '',
                'status': 'empty',
                'is_outlier': False,
                'is_control': False,
                'control_type': ''
            }
    
    for well_id, well in result.wells.items():
        row_letter, col_num = well.row, well.col
        key = f"{row_letter}{col_num}"
        
        is_control = False
        control_type = ''
        
        for ctrl in result.positive_controls:
            if well.sample_id == ctrl.sample_id and well.target == ctrl.target:
                is_control = True
                control_type = 'positive'
                break
        
        if not is_control:
            for ctrl in result.negative_controls:
                if well.sample_id == ctrl.sample_id and well.target == ctrl.target:
                    is_control = True
                    control_type = 'negative'
                    break
        
        if not is_control:
            for ctrl in result.ntc_controls:
                if well.sample_id == ctrl.sample_id and well.target == ctrl.target:
                    is_control = True
                    control_type = 'ntc'
                    break
        
        is_outlier = False
        for group in result.replicate_groups.values():
            for outlier_well in group.outlier_wells:
                if outlier_well.well_id == well_id:
                    is_outlier = True
                    break
        
        status = 'unknown'
        if well.ct_missing or well.ct_value is None:
            status = 'missing'
        elif well.ct_value <= config.ct_cutoff:
            status = 'positive'
        else:
            status = 'negative'
        
        well_data[key] = {
            'exists': True,
            'ct_value': well.ct_value,
            'sample_id': well.sample_id,
            'target': well.target,
            'status': status,
            'is_outlier': is_outlier,
            'is_control': is_control,
            'control_type': control_type
        }
    
    wells_json = []
    for row in rows:
        for col in cols:
            well_id = f"{row}{col}"
            data = well_data[well_id]
            data['well_id'] = well_id
            data['row'] = row
            data['col'] = col
            wells_json.append(data)
    
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>qPCR 96孔板热图</title>
    <style>
        * {{
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #333;
            margin-bottom: 20px;
        }}
        .legend {{
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 20px;
            padding: 15px;
            background: #fafafa;
            border-radius: 6px;
        }}
        .legend-item {{
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .legend-color {{
            width: 20px;
            height: 20px;
            border-radius: 4px;
            border: 1px solid #ccc;
        }}
        .plate {{
            overflow-x: auto;
        }}
        .plate-table {{
            border-collapse: collapse;
            margin: 0 auto;
        }}
        .plate-table th,
        .plate-table td {{
            width: 70px;
            height: 50px;
            text-align: center;
            vertical-align: middle;
            border: 1px solid #ddd;
            font-size: 12px;
        }}
        .plate-table th {{
            background-color: #f0f0f0;
            font-weight: bold;
            color: #666;
        }}
        .well {{
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            position: relative;
        }}
        .well:hover {{
            transform: scale(1.05);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 10;
        }}
        .well-empty {{
            background-color: #ffffff;
        }}
        .well-positive {{
            background: linear-gradient(135deg, #4ade80, #22c55e);
            color: white;
        }}
        .well-negative {{
            background: linear-gradient(135deg, #f87171, #ef4444);
            color: white;
        }}
        .well-missing {{
            background: linear-gradient(135deg, #d1d5db, #9ca3af);
            color: #333;
        }}
        .well-unknown {{
            background: linear-gradient(135deg, #fbbf24, #f59e0b);
            color: #333;
        }}
        .well-outlier {{
            border: 3px solid #7c3aed !important;
            box-shadow: inset 0 0 0 2px #7c3aed;
        }}
        .well-control-positive {{
            border: 3px solid #059669 !important;
        }}
        .well-control-negative {{
            border: 3px solid #dc2626 !important;
        }}
        .well-control-ntc {{
            border: 3px solid #2563eb !important;
        }}
        .well-content {{
            display: flex;
            flex-direction: column;
            justify-content: center;
            height: 100%;
        }}
        .well-ct {{
            font-weight: bold;
            font-size: 14px;
        }}
        .well-id {{
            font-size: 10px;
            opacity: 0.8;
        }}
        .tooltip {{
            display: none;
            position: absolute;
            background: #333;
            color: white;
            padding: 10px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 100;
            min-width: 200px;
            text-align: left;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }}
        .well:hover .tooltip {{
            display: block;
        }}
        .info-panel {{
            margin-top: 20px;
            padding: 15px;
            background: #fafafa;
            border-radius: 6px;
        }}
        .info-panel h3 {{
            margin-top: 0;
            color: #333;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>qPCR 96孔板热图</h1>
        
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: linear-gradient(135deg, #4ade80, #22c55e);"></div>
                <span>阳性 (Ct ≤ {config.ct_cutoff})</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: linear-gradient(135deg, #f87171, #ef4444);"></div>
                <span>阴性 (Ct > {config.ct_cutoff})</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: linear-gradient(135deg, #d1d5db, #9ca3af);"></div>
                <span>Ct 缺失</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="border: 3px solid #7c3aed;"></div>
                <span>离群孔</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="border: 3px solid #059669;"></div>
                <span>阳性对照</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="border: 3px solid #dc2626;"></div>
                <span>阴性对照</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="border: 3px solid #2563eb;"></div>
                <span>NTC 对照</span>
            </div>
        </div>
        
        <div class="plate">
            <table class="plate-table">
                <thead>
                    <tr>
                        <th></th>
                        {"".join([f"<th>{c}</th>" for c in cols])}
                    </tr>
                </thead>
                <tbody>
"""
    
    for row in rows:
        html += f"<tr><th>{row}</th>"
        for col in cols:
            well_id = f"{row}{col}"
            data = well_data[well_id]
            
            classes = ["well"]
            if data['exists']:
                classes.append(f"well-{data['status']}")
                if data['is_outlier']:
                    classes.append("well-outlier")
                if data['is_control']:
                    classes.append(f"well-control-{data['control_type']}")
            else:
                classes.append("well-empty")
            
            ct_display = ""
            if data['ct_value'] is not None:
                ct_display = f"{data['ct_value']:.1f}"
            elif data['exists']:
                ct_display = "N/A"
            
            tooltip = ""
            if data['exists']:
                tooltip_parts = [
                    f"<strong>孔位:</strong> {well_id}",
                    f"<strong>样本:</strong> {data['sample_id']}",
                    f"<strong>靶标:</strong> {data['target']}"
                ]
                if data['ct_value'] is not None:
                    tooltip_parts.append(f"<strong>Ct 值:</strong> {data['ct_value']:.2f}")
                else:
                    tooltip_parts.append("<strong>Ct 值:</strong> 缺失")
                if data['is_outlier']:
                    tooltip_parts.append("<strong>状态:</strong> 离群孔")
                if data['is_control']:
                    control_type_name = {
                        'positive': '阳性对照',
                        'negative': '阴性对照',
                        'ntc': 'NTC 对照'
                    }.get(data['control_type'], '对照')
                    tooltip_parts.append(f"<strong>类型:</strong> {control_type_name}")
                tooltip = "<br>".join(tooltip_parts)
            
            html += f"""
                        <td class="{' '.join(classes)}">
                            <div class="well-content">
                                <div class="well-ct">{ct_display}</div>
                                <div class="well-id">{well_id}</div>
                            </div>
                            <div class="tooltip">{tooltip}</div>
                        </td>"""
        html += "</tr>"
    
    html += f"""
                </tbody>
            </table>
        </div>
        
        <div class="info-panel">
            <h3>说明</h3>
            <ul>
                <li>悬停在孔位上查看详细信息</li>
                <li>阳性阈值: Ct ≤ {config.ct_cutoff}</li>
                <li>离群孔以紫色边框标识</li>
                <li>对照孔以不同颜色边框区分</li>
            </ul>
        </div>
    </div>
</body>
</html>
"""
    
    return html


def export_heatmap_html(
    result: ReviewResult,
    config: ControlConfig,
    output_path: Path
) -> None:
    """
    导出热图 HTML 到文件
    """
    html_content = generate_heatmap_html(result, config)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
