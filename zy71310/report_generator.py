import os
import json
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from dataclasses import asdict
from models import (
    StudentRecord,
    WavelengthResult,
    ExperimentReport,
    AnalysisStep,
    Anomaly,
    SourceType,
)


def safe_json_default(obj: Any) -> Any:
    """自定义JSON序列化处理"""
    if hasattr(obj, '__dict__'):
        return str(obj)
    elif hasattr(obj, '__str__'):
        return str(obj)
    else:
        return str(obj)


def format_value(value: float, unit: str = "", sig_figs: int = 4) -> str:
    if abs(value) < 1e-9 or abs(value) > 1e6:
        return f"{value:.{sig_figs-1}e} {unit}".strip()
    return f"{value:.{sig_figs}g} {unit}".strip()


def generate_json_report(
    report: ExperimentReport,
    output_path: str,
) -> Tuple[str, Dict[str, Any]]:
    report_dict = {
        "report_id": report.source_id,
        "student_record_id": report.student_record_id,
        "generated_at": report.created_at.isoformat(),
        "steps": [],
        "anomalies": [],
        "wavelength_results": [],
        "final_result": {},
        "traceability": {},
    }

    for step in report.steps:
        step_dict = {
            "step_id": step.source_id,
            "step_name": step.step_name,
            "status": step.status,
            "input_data": step.input_data,
            "output_data": step.output_data,
            "trace": step.trace(),
            "parent_ids": step.parent_ids,
            "error_message": step.error_message,
        }
        report_dict["steps"].append(step_dict)

    for anomaly in report.anomalies:
        anomaly_dict = {
            "anomaly_id": anomaly.source_id,
            "type": anomaly.anomaly_type,
            "severity": anomaly.severity,
            "description": anomaly.description,
            "suggestion": anomaly.suggestion,
            "affected_ids": anomaly.affected_ids,
            "trace": anomaly.trace(),
        }
        report_dict["anomalies"].append(anomaly_dict)

    for result in report.wavelength_results:
        result_dict = {
            "result_id": result.source_id,
            "order": result.order,
            "wavelength_m": result.value,
            "wavelength_nm": result.value * 1e9,
            "uncertainty_m": result.uncertainty,
            "uncertainty_nm": result.uncertainty * 1e9,
            "relative_uncertainty_percent": (
                result.uncertainty / result.value * 100 if result.value != 0 else 0
            ),
            "fringe_id": result.fringe_id,
            "trace": result.trace(),
        }
        report_dict["wavelength_results"].append(result_dict)

    report_dict["final_result"] = {
        "final_wavelength_m": report.final_wavelength,
        "final_wavelength_nm": report.final_wavelength * 1e9 if report.final_wavelength else None,
        "final_uncertainty_m": report.final_uncertainty,
        "final_uncertainty_nm": report.final_uncertainty * 1e9 if report.final_uncertainty else None,
        "relative_error_percent": report.relative_error,
        "conclusion": report.conclusion,
    }

    report_dict["chart_paths"] = report.chart_paths
    report_dict["report_trace"] = report.trace()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report_dict, f, ensure_ascii=False, indent=2, default=safe_json_default)

    trace = {
        "report_type": "json",
        "output_path": output_path,
        "step_count": len(report.steps),
        "anomaly_count": len(report.anomalies),
        "result_count": len(report.wavelength_results),
    }

    return output_path, trace


def generate_html_report(
    student_record: StudentRecord,
    report: ExperimentReport,
    output_path: str,
) -> Tuple[str, Dict[str, Any]]:
    html_content = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>光栅衍射测波长 - 实验分析报告</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
            line-height: 1.6;
            color: #2c3e50;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f7fa;
        }}
        .header {{
            background: linear-gradient(135deg, #3498db, #2c3e50);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }}
        .header h1 {{ font-size: 28px; margin-bottom: 10px; }}
        .header .meta {{ opacity: 0.9; font-size: 14px; }}
        .section {{
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }}
        .section h2 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 20px;
        }}
        .section h3 {{
            color: #34495e;
            margin: 15px 0 10px;
            font-size: 16px;
        }}
        .info-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }}
        .info-card {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }}
        .info-card .label {{
            font-size: 12px;
            color: #7f8c8d;
            text-transform: uppercase;
            margin-bottom: 5px;
        }}
        .info-card .value {{
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
        }}
        .info-card .trace {{
            font-size: 11px;
            color: #95a5a6;
            margin-top: 5px;
            font-family: monospace;
        }}
        .result-highlight {{
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            color: white;
            padding: 25px;
            border-radius: 10px;
            text-align: center;
            margin: 20px 0;
        }}
        .result-highlight .value {{
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }}
        .result-highlight .uncertainty {{
            font-size: 16px;
            opacity: 0.9;
        }}
        .result-highlight .error {{
            font-size: 14px;
            margin-top: 10px;
            padding: 5px 15px;
            background: rgba(255,255,255,0.2);
            border-radius: 20px;
            display: inline-block;
        }}
        .anomaly {{
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid;
        }}
        .anomaly.error {{
            background: #ffebee;
            border-color: #e74c3c;
        }}
        .anomaly.warning {{
            background: #fff3cd;
            border-color: #f39c12;
        }}
        .anomaly .type {{
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 5px;
        }}
        .anomaly.error .type {{ color: #c0392b; }}
        .anomaly.warning .type {{ color: #d35400; }}
        .anomaly .desc {{ font-size: 13px; margin-bottom: 5px; }}
        .anomaly .suggestion {{
            font-size: 12px;
            color: #7f8c8d;
            font-style: italic;
        }}
        .anomaly .affected {{
            font-size: 11px;
            color: #95a5a6;
            margin-top: 5px;
            font-family: monospace;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 13px;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }}
        th {{
            background: #34495e;
            color: white;
            font-weight: 600;
        }}
        tr:hover {{ background: #f8f9fa; }}
        tr.anomaly-row {{ background: #ffebee; }}
        .step {{
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid #2ecc71;
        }}
        .step.completed {{ border-color: #2ecc71; }}
        .step.failed {{ border-color: #e74c3c; }}
        .step.running {{ border-color: #f39c12; }}
        .step .name {{
            font-weight: bold;
            font-size: 15px;
            margin-bottom: 5px;
        }}
        .step .status {{
            display: inline-block;
            padding: 2px 10px;
            border-radius: 10px;
            font-size: 11px;
            margin-left: 10px;
        }}
        .step.completed .status {{ background: #2ecc71; color: white; }}
        .step.failed .status {{ background: #e74c3c; color: white; }}
        .step.running .status {{ background: #f39c12; color: white; }}
        .step .trace-info {{
            font-size: 11px;
            color: #95a5a6;
            margin-top: 8px;
            font-family: monospace;
        }}
        .charts-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        .chart-card {{
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .chart-card img {{
            width: 100%;
            height: auto;
            display: block;
        }}
        .chart-card .caption {{
            padding: 10px 15px;
            font-size: 13px;
            color: #7f8c8d;
            background: #f8f9fa;
        }}
        .conclusion {{
            background: #e8f5e9;
            border-left: 4px solid #2ecc71;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
        }}
        .conclusion h3 {{ color: #27ae60; }}
        .trace-section {{
            background: #fafafa;
            border: 1px solid #e0e0e0;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
            font-size: 12px;
        }}
        .trace-section summary {{
            cursor: pointer;
            font-weight: bold;
            color: #3498db;
        }}
        .trace-section pre {{
            margin-top: 10px;
            white-space: pre-wrap;
            word-wrap: break-word;
            background: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            font-size: 11px;
        }}
        .footer {{
            text-align: center;
            padding: 20px;
            color: #95a5a6;
            font-size: 12px;
            margin-top: 30px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🔬 光栅衍射测波长 - 实验分析报告</h1>
        <div class="meta">
            学生: {student_record.student_name or '未知'} ({student_record.student_id or '未知学号'})
            | 实验: {student_record.experiment_name}
            | 生成时间: {report.created_at.strftime('%Y-%m-%d %H:%M:%S')}
        </div>
        <div class="meta" style="margin-top: 5px;">
            报告ID: <code>{report.source_id}</code>
            | 学生记录ID: <code>{report.student_record_id}</code>
        </div>
    </div>
"""

    html_content += """
    <div class="section">
        <h2>📋 实验参数输入</h2>
        <div class="info-grid">
"""

    if student_record.grating_constant:
        gc = student_record.grating_constant
        html_content += f"""
            <div class="info-card">
                <div class="label">光栅常数 (d)</div>
                <div class="value">{format_value(gc.value, 'm')}</div>
                <div class="value" style="font-size: 14px; color: #7f8c8d;">
                    = {format_value(gc.value * 1e6, 'μm')}
                </div>
                <div class="trace">不确定度: ±{format_value(gc.uncertainty, 'm')}</div>
                <div class="trace">ID: {gc.source_id[:8]}...</div>
            </div>
"""

    if student_record.screen_distance:
        sd = student_record.screen_distance
        html_content += f"""
            <div class="info-card">
                <div class="label">屏距 (L)</div>
                <div class="value">{format_value(sd.value, 'm')}</div>
                <div class="value" style="font-size: 14px; color: #7f8c8d;">
                    = {format_value(sd.value * 100, 'cm')}
                </div>
                <div class="trace">不确定度: ±{format_value(sd.uncertainty, 'm')}</div>
                <div class="trace">ID: {sd.source_id[:8]}...</div>
            </div>
"""

    if student_record.reference_wavelength:
        rw = student_record.reference_wavelength
        html_content += f"""
            <div class="info-card">
                <div class="label">参考波长</div>
                <div class="value">{format_value(rw * 1e9, 'nm')}</div>
                <div class="value" style="font-size: 14px; color: #7f8c8d;">
                    = {format_value(rw, 'm')}
                </div>
                <div class="trace">来源: 标准值</div>
            </div>
"""

    html_content += f"""
            <div class="info-card">
                <div class="label">记录条纹数</div>
                <div class="value">{len(student_record.fringes)} 条</div>
                <div class="trace">级次范围: {min(abs(f.order) for f in student_record.fringes) if student_record.fringes else 0} - {max(abs(f.order) for f in student_record.fringes) if student_record.fringes else 0}</div>
            </div>
        </div>
"""

    html_content += """
        <h3>📏 条纹位置记录</h3>
        <table>
            <thead>
                <tr>
                    <th>级次 k</th>
                    <th>侧别</th>
                    <th>位置 (m)</th>
                    <th>位置 (mm)</th>
                    <th>不确定度 (m)</th>
                    <th>数据来源</th>
                    <th>ID</th>
                </tr>
            </thead>
            <tbody>
"""

    anomaly_ids = set()
    for anomaly in report.anomalies:
        anomaly_ids.update(anomaly.affected_ids)

    for fringe in sorted(student_record.fringes, key=lambda f: f.order):
        row_class = "anomaly-row" if fringe.source_id in anomaly_ids else ""
        html_content += f"""
                <tr class="{row_class}">
                    <td>{fringe.order}</td>
                    <td>{fringe.side}</td>
                    <td>{fringe.position:.6e}</td>
                    <td>{fringe.position * 1000:.3f}</td>
                    <td>±{fringe.uncertainty:.6e}</td>
                    <td>{fringe.source_type.value}</td>
                    <td><code>{fringe.source_id[:8]}...</code></td>
                </tr>
"""

    html_content += """
            </tbody>
        </table>
    </div>
"""

    html_content += """
    <div class="section">
        <h2>⚠️ 异常检测结果</h2>
"""

    if not report.anomalies:
        html_content += """
        <div class="conclusion">
            <h3>✅ 未检测到异常</h3>
            <p>所有数据看起来正常，可以继续分析。</p>
        </div>
"""
    else:
        error_count = sum(1 for a in report.anomalies if a.severity == "error")
        warning_count = sum(1 for a in report.anomalies if a.severity == "warning")
        html_content += f"""
        <div style="margin-bottom: 15px;">
            <span style="background: #e74c3c; color: white; padding: 5px 15px; border-radius: 20px; margin-right: 10px;">
                ❌ {error_count} 个严重错误
            </span>
            <span style="background: #f39c12; color: white; padding: 5px 15px; border-radius: 20px;">
                ⚠️ {warning_count} 个警告
            </span>
        </div>
"""

        for anomaly in report.anomalies:
            html_content += f"""
            <div class="anomaly {anomaly.severity}">
                <div class="type">
                    [{anomaly.severity.upper()}] {anomaly.anomaly_type}
                </div>
                <div class="desc">{anomaly.description}</div>
                <div class="suggestion">💡 建议: {anomaly.suggestion}</div>
                <div class="affected">影响数据ID: {', '.join(anomaly.affected_ids)}</div>
                <details class="trace-section">
                    <summary>查看追溯信息</summary>
                    <pre>{json.dumps(anomaly.trace(), ensure_ascii=False, indent=2)}</pre>
                </details>
            </div>
"""

    html_content += """
    </div>
"""

    html_content += """
    <div class="section">
        <h2>📊 波长计算结果</h2>
        <table>
            <thead>
                <tr>
                    <th>级次 k</th>
                    <th>波长 (nm)</th>
                    <th>不确定度 (nm)</th>
                    <th>相对不确定度</th>
                    <th>与参考值偏差</th>
                    <th>数据来源</th>
                    <th>ID</th>
                </tr>
            </thead>
            <tbody>
"""

    for result in sorted(report.wavelength_results, key=lambda r: r.order):
        wl_nm = result.value * 1e9
        unc_nm = result.uncertainty * 1e9
        rel_unc = result.uncertainty / result.value * 100 if result.value != 0 else 0

        deviation = ""
        if student_record.reference_wavelength:
            dev = (result.value - student_record.reference_wavelength) / student_record.reference_wavelength * 100
            color = "#27ae60" if abs(dev) < 5 else "#e74c3c"
            deviation = f'<span style="color: {color};">{dev:+.2f}%</span>'

        row_class = "anomaly-row" if result.source_id in anomaly_ids else ""
        html_content += f"""
                <tr class="{row_class}">
                    <td>{result.order}</td>
                    <td><strong>{wl_nm:.3f}</strong></td>
                    <td>±{unc_nm:.3f}</td>
                    <td>{rel_unc:.2f}%</td>
                    <td>{deviation}</td>
                    <td>{result.source_type.value}</td>
                    <td><code>{result.source_id[:8]}...</code></td>
                </tr>
"""

    html_content += """
            </tbody>
        </table>
"""

    if report.final_wavelength and report.final_uncertainty:
        final_wl_nm = report.final_wavelength * 1e9
        final_unc_nm = report.final_uncertainty * 1e9
        html_content += f"""
        <div class="result-highlight">
            <div style="font-size: 14px; opacity: 0.9;">最终测量结果（加权平均）</div>
            <div class="value">{final_wl_nm:.2f} ± {final_unc_nm:.2f} nm</div>
            <div class="uncertainty">
                = ({report.final_wavelength:.6e} ± {report.final_uncertainty:.6e}) m
            </div>
"""

        if report.relative_error is not None:
            error_color = "#27ae60" if abs(report.relative_error) < 5 else "#e74c3c"
            html_content += f"""
            <div class="error" style="background: {error_color};">
                与参考值相对误差: {report.relative_error:+.2f}%
            </div>
"""

        html_content += """
        </div>
"""

    html_content += """
    </div>
"""

    html_content += """
    <div class="section">
        <h2>📈 分析过程追溯</h2>
"""

    for step in report.steps:
        html_content += f"""
        <div class="step {step.status}">
            <div class="name">
                {step.step_name}
                <span class="status">{step.status.upper()}</span>
            </div>
            <div style="font-size: 12px; color: #7f8c8d; margin-top: 5px;">
                输入: {json.dumps(step.input_data, ensure_ascii=False, default=str)}
            </div>
            <div style="font-size: 12px; color: #7f8c8d; margin-top: 5px;">
                输出: {json.dumps(step.output_data, ensure_ascii=False, default=str)}
            </div>
            <details class="trace-section">
                <summary>查看完整追溯信息</summary>
                <pre>{json.dumps(step.trace(), ensure_ascii=False, indent=2)}</pre>
            </details>
        </div>
"""

    html_content += """
    </div>
"""

    if report.chart_paths:
        html_content += """
    <div class="section">
        <h2>🖼️ 可视化图表</h2>
        <div class="charts-grid">
"""

        chart_names = {
            "fringe_positions": "条纹位置分布",
            "wavelength_comparison": "波长计算结果对比",
            "error_contribution": "误差来源分析",
            "grating_diagram": "光栅衍射原理图",
        }

        for key, path in report.chart_paths.items():
            if path and os.path.exists(path):
                rel_path = os.path.relpath(path, os.path.dirname(output_path))
                html_content += f"""
            <div class="chart-card">
                <img src="{rel_path}" alt="{chart_names.get(key, key)}">
                <div class="caption">{chart_names.get(key, key)}</div>
            </div>
"""

        html_content += """
        </div>
    </div>
"""

    html_content += f"""
    <div class="section">
        <h2>📝 结论</h2>
        <div class="conclusion">
            <h3>🎯 实验结论</h3>
            <p>{report.conclusion or '暂无结论'}</p>
        </div>
    </div>

    <div class="footer">
        <p>本报告由光栅衍射分析系统自动生成 | 所有数据均可追溯 | 报告ID: {report.source_id}</p>
    </div>
</body>
</html>
"""

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    trace = {
        "report_type": "html",
        "output_path": output_path,
        "step_count": len(report.steps),
        "anomaly_count": len(report.anomalies),
        "result_count": len(report.wavelength_results),
        "chart_count": len(report.chart_paths),
    }

    return output_path, trace


def generate_markdown_report(
    student_record: StudentRecord,
    report: ExperimentReport,
    output_path: str,
) -> Tuple[str, Dict[str, Any]]:
    md_content = f"""# 光栅衍射测波长 - 实验分析报告

> **学生**: {student_record.student_name or '未知'} ({student_record.student_id or '未知学号'})
> **实验**: {student_record.experiment_name}
> **生成时间**: {report.created_at.strftime('%Y-%m-%d %H:%M:%S')}
> **报告ID**: `{report.source_id}`
> **学生记录ID**: `{report.student_record_id}`

---

## 1. 实验参数输入

### 1.1 基本参数

| 参数 | 值 | 不确定度 | 来源ID |
|------|----|----------|--------|
"""

    if student_record.grating_constant:
        gc = student_record.grating_constant
        md_content += f"| 光栅常数 d | {gc.value:.6e} m ({gc.value*1e6:.2f} μm) | ±{gc.uncertainty:.6e} m | `{gc.source_id[:8]}...` |\n"

    if student_record.screen_distance:
        sd = student_record.screen_distance
        md_content += f"| 屏距 L | {sd.value:.4f} m ({sd.value*100:.2f} cm) | ±{sd.uncertainty:.6e} m | `{sd.source_id[:8]}...` |\n"

    if student_record.reference_wavelength:
        rw = student_record.reference_wavelength
        md_content += f"| 参考波长 λ₀ | {rw*1e9:.2f} nm | - | 标准值 |\n"

    md_content += f"\n### 1.2 条纹位置记录 (共 {len(student_record.fringes)} 条)\n\n"
    md_content += "| 级次 k | 侧别 | 位置 (m) | 位置 (mm) | 不确定度 (m) | 来源ID |\n"
    md_content += "|--------|------|----------|-----------|--------------|--------|\n"

    for fringe in sorted(student_record.fringes, key=lambda f: f.order):
        md_content += f"| {fringe.order} | {fringe.side} | {fringe.position:.6e} | {fringe.position*1000:.3f} | ±{fringe.uncertainty:.6e} | `{fringe.source_id[:8]}...` |\n"

    md_content += "\n---\n\n## 2. 异常检测结果\n\n"

    if not report.anomalies:
        md_content += "✅ **未检测到异常** - 所有数据看起来正常，可以继续分析。\n\n"
    else:
        error_count = sum(1 for a in report.anomalies if a.severity == "error")
        warning_count = sum(1 for a in report.anomalies if a.severity == "warning")
        md_content += f"⚠️  **检测到 {error_count} 个严重错误, {warning_count} 个警告**\n\n"

        for i, anomaly in enumerate(report.anomalies, 1):
            icon = "❌" if anomaly.severity == "error" else "⚠️"
            md_content += f"### {i}. {icon} {anomaly.anomaly_type} ({anomaly.severity.upper()})\n\n"
            md_content += f"**描述**: {anomaly.description}\n\n"
            md_content += f"**建议**: {anomaly.suggestion}\n\n"
            md_content += f"**影响数据**: {', '.join(anomaly.affected_ids)}\n\n"
            md_content += f"<details><summary>查看追溯信息</summary>\n\n```json\n{json.dumps(anomaly.trace(), ensure_ascii=False, indent=2)}\n```\n\n</details>\n\n"

    md_content += "---\n\n## 3. 波长计算结果\n\n"
    md_content += "| 级次 k | 波长 (nm) | 不确定度 (nm) | 相对不确定度 |\n"
    md_content += "|--------|-----------|---------------|--------------|\n"

    for result in sorted(report.wavelength_results, key=lambda r: r.order):
        wl_nm = result.value * 1e9
        unc_nm = result.uncertainty * 1e9
        rel_unc = result.uncertainty / result.value * 100 if result.value != 0 else 0
        md_content += f"| {result.order} | {wl_nm:.3f} | ±{unc_nm:.3f} | {rel_unc:.2f}% |\n"

    if report.final_wavelength and report.final_uncertainty:
        final_wl_nm = report.final_wavelength * 1e9
        final_unc_nm = report.final_uncertainty * 1e9
        md_content += f"\n### 3.1 最终结果（加权平均）\n\n"
        md_content += f"**λ = ({final_wl_nm:.2f} ± {final_unc_nm:.2f}) nm**\n\n"
        md_content += f"= ({report.final_wavelength:.6e} ± {report.final_uncertainty:.6e}) m\n\n"

        if report.relative_error is not None:
            sign = "+" if report.relative_error >= 0 else ""
            md_content += f"与参考值相对误差: **{sign}{report.relative_error:.2f}%**\n\n"

    md_content += "---\n\n## 4. 分析过程追溯\n\n"

    for step in report.steps:
        status_icon = "✅" if step.status == "completed" else "❌" if step.status == "failed" else "⏳"
        md_content += f"### {status_icon} {step.step_name} ({step.status.upper()})\n\n"
        md_content += f"**输入**: `{json.dumps(step.input_data, ensure_ascii=False, default=str)}`\n\n"
        md_content += f"**输出**: `{json.dumps(step.output_data, ensure_ascii=False, default=str)}`\n\n"
        md_content += f"<details><summary>查看完整追溯信息</summary>\n\n```json\n{json.dumps(step.trace(), ensure_ascii=False, indent=2)}\n```\n\n</details>\n\n"

    if report.chart_paths:
        md_content += "---\n\n## 5. 可视化图表\n\n"
        chart_names = {
            "fringe_positions": "条纹位置分布",
            "wavelength_comparison": "波长计算结果对比",
            "error_contribution": "误差来源分析",
            "grating_diagram": "光栅衍射原理图",
        }

        for key, path in report.chart_paths.items():
            if path and os.path.exists(path):
                rel_path = os.path.relpath(path, os.path.dirname(output_path))
                md_content += f"### 5.{list(chart_names.keys()).index(key)+1} {chart_names.get(key, key)}\n\n"
                md_content += f"![{chart_names.get(key, key)}]({rel_path})\n\n"

    md_content += "---\n\n## 6. 结论\n\n"
    md_content += f"{report.conclusion or '暂无结论'}\n\n"
    md_content += "---\n\n*本报告由光栅衍射分析系统自动生成 | 所有数据均可追溯*\n"

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    trace = {
        "report_type": "markdown",
        "output_path": output_path,
        "step_count": len(report.steps),
        "anomaly_count": len(report.anomalies),
        "result_count": len(report.wavelength_results),
        "chart_count": len(report.chart_paths),
    }

    return output_path, trace


def generate_all_reports(
    student_record: StudentRecord,
    report: ExperimentReport,
    output_dir: str = "output/reports",
) -> Tuple[Dict[str, str], Dict[str, Any]]:
    report_paths = {}
    traces = {}

    json_path, trace = generate_json_report(
        report,
        os.path.join(output_dir, "report.json"),
    )
    report_paths["json"] = json_path
    traces["json"] = trace

    html_path, trace = generate_html_report(
        student_record,
        report,
        os.path.join(output_dir, "report.html"),
    )
    report_paths["html"] = html_path
    traces["html"] = trace

    md_path, trace = generate_markdown_report(
        student_record,
        report,
        os.path.join(output_dir, "report.md"),
    )
    report_paths["markdown"] = md_path
    traces["markdown"] = trace

    return report_paths, traces
