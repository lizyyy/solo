"""
报告导出模块
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import defaultdict

from jinja2 import Environment, PackageLoader, select_autoescape, Template

from .models import (
    BatchData,
    QCIssue,
    QCIssueType,
    SampleType,
    CalibrationCurve,
    InjectionRecord,
)


MARKDOWN_REPORT_TEMPLATE = """# 法医毒物实验室质谱批次质量控制报告

## 批次概览
- **报告生成时间**: {{ report_time }}
- **总进样数**: {{ total_injections }}
- **校准品数**: {{ calibrator_count }}
- **质控样数**: {{ qc_count }}
- **未知样本数**: {{ unknown_count }}
- **检出问题数**: {{ issue_count }}

---

## 问题汇总

### 按严重程度分类
{% for severity, issues in issues_by_severity.items() %}
#### {{ severity }} ({{ issues|length }} 个问题)
{% for issue in issues %}
- **{{ issue.issue_type.value }}**: {{ issue.description }}
  - 样本: {{ ", ".join(issue.sample_ids) }}
{% if issue.details %}
  - 详情: {{ issue.details_json }}
{% endif %}
{% endfor %}
{% endfor %}

---

## 校准曲线分析
{% for compound, curve in calibration_curves.items() %}
### {{ compound }}
- **内标**: {{ curve.internal_standard }}
- **回归方程**: y = {{ "%.4f"|format(curve.slope) }}x + {{ "%.4f"|format(curve.intercept) }}
- **R²**: {{ "%.4f"|format(curve.r_squared) }}
- **LOD**: {{ "%.4f"|format(curve.lod) }} ng/mL
- **LOQ**: {{ "%.4f"|format(curve.loq) }} ng/mL

#### 校准点
| 浓度 (ng/mL) | 峰面积 | 内标面积 | 响应比 |
|--------------|--------|----------|--------|
{% for point in curve.points %}| {{ "%.4f"|format(point.concentration) }} | {{ "%.0f"|format(point.peak_area) }} | {{ "%.0f"|format(point.internal_standard_area) }} | {{ "%.4f"|format(point.ratio) }} |
{% endfor %}
{% endfor %}

---

## 内标漂移分析
{% if internal_standard_drift %}
| 样本ID | 内标 | 漂移 (%) |
|--------|------|----------|
{% for sample_id, is_data in internal_standard_drift.items() %}
{% for is_name, drift in is_data.items() %}| {{ sample_id }} | {{ is_name }} | {{ "%.1f"|format(drift) }} |
{% endfor %}
{% endfor %}
{% else %}
无内标漂移数据
{% endif %}

---

## 质控样偏差分析
{% if qc_deviations %}
| 样本ID | 化合物 | 偏差 (%) |
|--------|--------|----------|
{% for sample_id, compound_data in qc_deviations.items() %}
{% for compound, deviation in compound_data.items() %}| {{ sample_id }} | {{ compound }} | {{ "%.1f"|format(deviation) }} |
{% endfor %}
{% endfor %}
{% else %}
无质控样偏差数据
{% endif %}

---

## LOD/LOQ 检出情况
{% if lod_loq_hits %}
| 样本ID | 化合物 | 浓度 (ng/mL) | LOD (ng/mL) | LOQ (ng/mL) | 状态 |
|--------|--------|---------------|-------------|-------------|------|
{% for hit in lod_loq_hits %}
| {{ hit.sample_id }} | {{ hit.compound }} | {{ "%.4f"|format(hit.concentration) }} | {{ "%.4f"|format(hit.lod) }} | {{ "%.4f"|format(hit.loq) }} | {{ hit.status }} |
{% endfor %}
{% else %}
无 LOD/LOQ 检出
{% endif %}

---

## 进样顺序
| 序号 | 样本ID | 进样时间 | 样本类型 | 瓶位 |
|------|--------|----------|----------|------|
{% for idx, inj in enumerate(injection_sequence, 1) %}
| {{ idx }} | {{ inj.sample_id }} | {{ inj.injection_time.strftime('%Y-%m-%d %H:%M:%S') }} | {{ inj.sample_type.value }} | {{ inj.vial_position }} |
{% endfor %}

---

## 附录: 问题类型说明
- **duplicate_sample_id**: 重复样本编号
- **chain_of_custody_break**: 交接记录断链或异常
- **cross_midnight_injection**: 跨午夜进样归属可能错误
- **internal_standard_missing**: 内标峰面积为0或缺失
- **internal_standard_drift**: 内标漂移超过阈值
- **qc_out_of_range**: 质控样偏差超过阈值
- **lod_hit**: 定性检出(高于LOD但低于LOQ)
- **loq_hit**: 定量检出(高于LOQ)
- **calibration_failed**: 校准曲线构建失败
"""


HTML_TREND_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>峰面积趋势分析 - 质谱批次复核</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 24px; }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { font-size: 14px; opacity: 0.9; }
        .content { padding: 24px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .summary-card { background: #f8f9fa; border-radius: 8px; padding: 16px; border-left: 4px solid #2d5a87; }
        .summary-card h3 { font-size: 12px; color: #666; margin-bottom: 4px; text-transform: uppercase; }
        .summary-card .value { font-size: 28px; font-weight: bold; color: #1e3a5f; }
        .section { margin-bottom: 32px; }
        .section h2 { font-size: 18px; color: #1e3a5f; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e9ecef; }
        .chart-container { background: #fafbfc; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        .chart-title { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 12px; }
        .svg-chart { width: 100%; height: 300px; }
        .grid-line { stroke: #e9ecef; stroke-width: 1; }
        .trend-line { fill: none; stroke-width: 2; }
        .data-point { cursor: pointer; }
        .tooltip { position: absolute; background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; pointer-events: none; display: none; z-index: 100; }
        .legend { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #666; }
        .legend-color { width: 12px; height: 12px; border-radius: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e9ecef; }
        th { background: #f8f9fa; font-weight: 600; color: #333; }
        tr:hover { background: #fafbfc; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
        .badge-critical { background: #fef2f2; color: #dc2626; }
        .badge-high { background: #fff7ed; color: #ea580c; }
        .badge-medium { background: #fefce8; color: #ca8a04; }
        .badge-low { background: #f0fdf4; color: #16a34a; }
        .axis-label { font-size: 11px; fill: #666; }
        .issue-table { margin-top: 16px; }
        .compound-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .compound-tab { padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; font-size: 13px; transition: all 0.2s; }
        .compound-tab:hover { background: #f8f9fa; }
        .compound-tab.active { background: #2d5a87; color: white; border-color: #2d5a87; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>峰面积趋势分析</h1>
            <p>报告生成时间: {{ report_time }}</p>
        </div>
        
        <div class="content">
            <div class="summary">
                <div class="summary-card">
                    <h3>总进样数</h3>
                    <div class="value">{{ total_injections }}</div>
                </div>
                <div class="summary-card">
                    <h3>化合物数</h3>
                    <div class="value">{{ compound_count }}</div>
                </div>
                <div class="summary-card">
                    <h3>问题数</h3>
                    <div class="value" style="color: {% if issue_count > 0 %}#dc2626{% else %}#16a34a{% endif %}">{{ issue_count }}</div>
                </div>
                <div class="summary-card">
                    <h3>内标漂移率</h3>
                    <div class="value">{{ avg_is_drift }}%</div>
                </div>
            </div>

            <div class="section">
                <h2>峰面积趋势图</h2>
                <div class="compound-tabs">
                    {% for compound in compounds %}
                    <button class="compound-tab {% if loop.first %}active{% endif %}" data-compound="{{ compound }}">{{ compound }}</button>
                    {% endfor %}
                </div>
                {% for compound in compounds %}
                <div class="chart-container compound-chart" data-compound="{{ compound }}" {% if not loop.first %}style="display:none"{% endif %}>
                    <div class="chart-title">{{ compound }} 峰面积趋势</div>
                    <svg class="svg-chart" viewBox="0 0 1000 300">
                        <line x1="50" y1="250" x2="950" y2="250" class="grid-line" stroke="#ddd"/>
                        <line x1="50" y1="50" x2="50" y2="250" class="grid-line" stroke="#ddd"/>
                        {% for i in range(1, 5) %}
                        <line x1="50" y1="{{ 50 + i * 50 }}" x2="950" y2="{{ 50 + i * 50 }}" class="grid-line" stroke="#ddd" stroke-dasharray="4"/>
                        {% endfor %}
                        {% set points = compound_data[compound] %}
                        {% if points|length > 1 %}
                        <polyline points="{% for p in points %}{{ p.x }},{{ p.y }}{% if not loop.last %} {% endif %}{% endfor %}" 
                                  class="trend-line" stroke="{{ color_map[compound] if compound in color_map else '#2d5a87' }}"/>
                        {% endif %}
                        {% for p in points %}
                        <circle cx="{{ p.x }}" cy="{{ p.y }}" r="5" class="data-point" 
                                fill="{{ color_map[compound] if compound in color_map else '#2d5a87' }}"
                                data-sample="{{ p.sample_id }}" data-area="{{ p.area }}" data-index="{{ p.index }}"/>
                        {% endfor %}
                        <text x="500" y="285" text-anchor="middle" class="axis-label">进样顺序</text>
                        <text x="20" y="150" text-anchor="middle" transform="rotate(-90 20 150)" class="axis-label">峰面积</text>
                    </svg>
                    <div class="legend">
                        <div class="legend-item">
                            <span class="legend-color" style="background: {{ color_map[compound] if compound in color_map else '#2d5a87' }}"></span>
                            <span>{{ compound }}</span>
                        </div>
                    </div>
                </div>
                {% endfor %}
            </div>

            <div class="section">
                <h2>内标趋势图</h2>
                {% for is_name, is_data in internal_standard_trend.items() %}
                <div class="chart-container">
                    <div class="chart-title">{{ is_name }} 内标峰面积趋势</div>
                    <svg class="svg-chart" viewBox="0 0 1000 300">
                        <line x1="50" y1="250" x2="950" y2="250" class="grid-line" stroke="#ddd"/>
                        <line x1="50" y1="50" x2="50" y2="250" class="grid-line" stroke="#ddd"/>
                        {% for i in range(1, 5) %}
                        <line x1="50" y1="{{ 50 + i * 50 }}" x2="950" y2="{{ 50 + i * 50 }}" class="grid-line" stroke="#ddd" stroke-dasharray="4"/>
                        {% endfor %}
                        {% if is_data.points|length > 1 %}
                        <polyline points="{% for p in is_data.points %}{{ p.x }},{{ p.y }}{% if not loop.last %} {% endif %}{% endfor %}" 
                                  class="trend-line" stroke="#8b5cf6"/>
                        {% endif %}
                        {% for p in is_data.points %}
                        <circle cx="{{ p.x }}" cy="{{ p.y }}" r="5" class="data-point" fill="#8b5cf6"
                                data-sample="{{ p.sample_id }}" data-area="{{ p.area }}"/>
                        {% endfor %}
                        {% if is_data.baseline %}
                        <line x1="50" y1="{{ is_data.baseline_y }}" x2="950" y2="{{ is_data.baseline_y }}" 
                              stroke="#ef4444" stroke-width="1" stroke-dasharray="4"/>
                        <line x1="50" y1="{{ is_data.upper_limit_y }}" x2="950" y2="{{ is_data.upper_limit_y }}" 
                              stroke="#f97316" stroke-width="1" stroke-dasharray="2"/>
                        <line x1="50" y1="{{ is_data.lower_limit_y }}" x2="950" y2="{{ is_data.lower_limit_y }}" 
                              stroke="#f97316" stroke-width="1" stroke-dasharray="2"/>
                        {% endif %}
                    </svg>
                    <div class="legend">
                        <div class="legend-item">
                            <span class="legend-color" style="background: #8b5cf6"></span>
                            <span>{{ is_name }} 峰面积</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color" style="background: #ef4444"></span>
                            <span>基线</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color" style="background: #f97316"></span>
                            <span>±20% 范围</span>
                        </div>
                    </div>
                </div>
                {% endfor %}
            </div>

            <div class="section">
                <h2>质量控制问题</h2>
                {% if issues %}
                <table class="issue-table">
                    <thead>
                        <tr>
                            <th>严重程度</th>
                            <th>问题类型</th>
                            <th>样本ID</th>
                            <th>描述</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for issue in issues %}
                        <tr>
                            <td><span class="badge badge-{{ issue.severity }}">{{ issue.severity }}</span></td>
                            <td>{{ issue.issue_type.value }}</td>
                            <td>{{ ", ".join(issue.sample_ids) }}</td>
                            <td>{{ issue.description }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
                {% else %}
                <p style="color: #16a34a; padding: 20px; background: #f0fdf4; border-radius: 8px;">
                    ✓ 未发现质量控制问题
                </p>
                {% endif %}
            </div>

            <div class="section">
                <h2>进样明细</h2>
                <table>
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>样本ID</th>
                            <th>进样时间</th>
                            <th>样本类型</th>
                            <th>瓶位</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for idx, inj in enumerate(injection_sequence, 1) %}
                        <tr>
                            <td>{{ idx }}</td>
                            <td>{{ inj.sample_id }}</td>
                            <td>{{ inj.injection_time.strftime('%Y-%m-%d %H:%M:%S') }}</td>
                            <td>{{ inj.sample_type.value }}</td>
                            <td>{{ inj.vial_position }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="tooltip" id="tooltip"></div>

    <script>
        document.querySelectorAll('.compound-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.compound-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                const compound = this.dataset.compound;
                document.querySelectorAll('.compound-chart').forEach(chart => {
                    if (chart.dataset.compound === compound) {
                        chart.style.display = 'block';
                    } else {
                        chart.style.display = 'none';
                    }
                });
            });
        });

        const tooltip = document.getElementById('tooltip');
        document.querySelectorAll('.data-point').forEach(point => {
            point.addEventListener('mouseenter', function(e) {
                const sample = this.dataset.sample;
                const area = this.dataset.area;
                const index = this.dataset.index;
                
                tooltip.innerHTML = `样本: ${sample}<br>进样序号: ${index}<br>峰面积: ${parseFloat(area).toLocaleString()}`;
                tooltip.style.display = 'block';
                tooltip.style.left = (e.pageX + 10) + 'px';
                tooltip.style.top = (e.pageY - 10) + 'px';
            });
            
            point.addEventListener('mouseleave', function() {
                tooltip.style.display = 'none';
            });
        });
    </script>
</body>
</html>
"""


def _to_json_safe(obj: Any) -> str:
    def default_converter(o):
        if isinstance(o, datetime):
            return o.isoformat()
        return str(o)
    return json.dumps(obj, ensure_ascii=False, default=default_converter)


def generate_markdown_report(
    batch_data: BatchData,
    calibration_curves: Dict[str, CalibrationCurve],
    output_path: str,
) -> None:
    env = Environment(autoescape=select_autoescape(["html", "xml"]))
    template = env.from_string(MARKDOWN_REPORT_TEMPLATE)
    
    issues_by_severity = defaultdict(list)
    for issue in batch_data.qc_issues:
        issue_wrapper = type('IssueWrapper', (), {
            'issue_type': issue.issue_type,
            'sample_ids': issue.sample_ids,
            'description': issue.description,
            'details': issue.details,
            'details_json': _to_json_safe(issue.details) if issue.details else None,
        })()
        issues_by_severity[issue.severity].append(issue_wrapper)
    
    lod_loq_hits = []
    for issue in batch_data.qc_issues:
        if issue.issue_type in [QCIssueType.LOD_HIT, QCIssueType.LOQ_HIT]:
            lod_loq_hits.append({
                "sample_id": issue.sample_ids[0] if issue.sample_ids else "N/A",
                "compound": issue.details.get("compound", "N/A"),
                "concentration": issue.details.get("concentration", 0),
                "lod": issue.details.get("lod", 0),
                "loq": issue.details.get("loq", 0),
                "status": "定量检出" if issue.issue_type == QCIssueType.LOQ_HIT else "定性检出",
            })
    
    total_injections = len(batch_data.run_sequence)
    calibrator_count = len([i for i in batch_data.run_sequence if i.sample_type == SampleType.CALIBRATOR])
    qc_count = len([i for i in batch_data.run_sequence if i.sample_type == SampleType.QC])
    unknown_count = len([i for i in batch_data.run_sequence if i.sample_type == SampleType.UNKNOWN])
    
    context = {
        "report_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_injections": total_injections,
        "calibrator_count": calibrator_count,
        "qc_count": qc_count,
        "unknown_count": unknown_count,
        "issue_count": len(batch_data.qc_issues),
        "issues_by_severity": dict(issues_by_severity),
        "calibration_curves": calibration_curves,
        "internal_standard_drift": batch_data.internal_standard_drift,
        "qc_deviations": batch_data.qc_deviations,
        "lod_loq_hits": lod_loq_hits,
        "injection_sequence": batch_data.run_sequence,
        "enumerate": enumerate,
    }
    
    content = template.render(context)
    
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def generate_html_trend_report(
    batch_data: BatchData,
    calibration_curves: Dict[str, CalibrationCurve],
    output_path: str,
) -> None:
    env = Environment(autoescape=select_autoescape(["html", "xml"]))
    template = env.from_string(HTML_TREND_TEMPLATE)
    
    compounds = list(calibration_curves.keys())
    
    color_map = {}
    colors = ["#2d5a87", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]
    for idx, compound in enumerate(compounds):
        color_map[compound] = colors[idx % len(colors)]
    
    compound_data = {}
    for compound in compounds:
        areas = []
        for inj in batch_data.run_sequence:
            area = inj.peak_data.get(compound, 0)
            if area > 0:
                areas.append(area)
        
        if not areas:
            continue
        
        max_area = max(areas) if areas else 1
        min_area = min(areas) if areas else 0
        y_range = max(max_area - min_area, max_area * 0.1)
        
        points = []
        for idx, inj in enumerate(batch_data.run_sequence):
            area = inj.peak_data.get(compound, 0)
            if area > 0:
                x = 50 + (idx / max(len(batch_data.run_sequence) - 1, 1)) * 900
                if y_range > 0:
                    y = 250 - ((area - min_area) / y_range) * 200
                else:
                    y = 150
                points.append({
                    "x": x,
                    "y": max(min(y, 245), 55),
                    "area": area,
                    "sample_id": inj.sample_id,
                    "index": idx + 1,
                })
        
        compound_data[compound] = points
    
    internal_standard_trend = {}
    for compound, curve in calibration_curves.items():
        is_name = curve.internal_standard
        if is_name in internal_standard_trend:
            continue
        
        areas = []
        for inj in batch_data.run_sequence:
            area = inj.internal_standard_area.get(
                is_name, inj.peak_data.get(is_name, 0)
            )
            if area > 0:
                areas.append(area)
        
        if not areas:
            continue
        
        baseline = sum(areas) / len(areas)
        upper_limit = baseline * 1.2
        lower_limit = baseline * 0.8
        
        all_areas = []
        for inj in batch_data.run_sequence:
            area = inj.internal_standard_area.get(
                is_name, inj.peak_data.get(is_name, 0)
            )
            all_areas.append(area)
        
        max_display = max(upper_limit * 1.1, max(all_areas) if all_areas else 1)
        min_display = min(lower_limit * 0.9, min(all_areas) if all_areas else 0)
        y_range = max(max_display - min_display, max_display * 0.1)
        
        points = []
        for idx, inj in enumerate(batch_data.run_sequence):
            area = inj.internal_standard_area.get(
                is_name, inj.peak_data.get(is_name, 0)
            )
            x = 50 + (idx / max(len(batch_data.run_sequence) - 1, 1)) * 900
            if y_range > 0:
                y = 250 - ((area - min_display) / y_range) * 200
            else:
                y = 150
            points.append({
                "x": x,
                "y": max(min(y, 245), 55),
                "area": area,
                "sample_id": inj.sample_id,
            })
        
        if y_range > 0:
            baseline_y = 250 - ((baseline - min_display) / y_range) * 200
            upper_limit_y = 250 - ((upper_limit - min_display) / y_range) * 200
            lower_limit_y = 250 - ((lower_limit - min_display) / y_range) * 200
        else:
            baseline_y = upper_limit_y = lower_limit_y = 150
        
        internal_standard_trend[is_name] = {
            "points": points,
            "baseline": baseline,
            "baseline_y": max(min(baseline_y, 245), 55),
            "upper_limit_y": max(min(upper_limit_y, 245), 55),
            "lower_limit_y": max(min(lower_limit_y, 245), 55),
        }
    
    avg_is_drift = 0.0
    if batch_data.internal_standard_drift:
        all_drifts = []
        for sample_data in batch_data.internal_standard_drift.values():
            all_drifts.extend(sample_data.values())
        if all_drifts:
            avg_is_drift = sum(all_drifts) / len(all_drifts)
    
    context = {
        "report_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_injections": len(batch_data.run_sequence),
        "compound_count": len(compounds),
        "issue_count": len(batch_data.qc_issues),
        "avg_is_drift": f"{avg_is_drift:.1f}",
        "compounds": compounds,
        "color_map": color_map,
        "compound_data": compound_data,
        "internal_standard_trend": internal_standard_trend,
        "issues": sorted(batch_data.qc_issues, key=lambda x: {
            "critical": 0, "high": 1, "medium": 2, "low": 3
        }.get(x.severity, 4)),
        "injection_sequence": batch_data.run_sequence,
        "enumerate": enumerate,
        "range": range,
    }
    
    content = template.render(context)
    
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
