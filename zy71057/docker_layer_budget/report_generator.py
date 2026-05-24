import json
import os
from datetime import datetime
from typing import Any, Dict, Optional

from jinja2 import Template

from .budget_engine import BudgetEngine, BudgetResult
from .dockerfile_analyzer import DockerfileAnalysis
from .layer_parser import ImageMetadata
from .utils import format_size, stable_hash


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docker 镜像层预算报告 - {{ report_title }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .meta { opacity: 0.9; font-size: 14px; }
        .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 14px; margin-top: 15px; }
        .status-pass { background: #10b981; }
        .status-fail { background: #ef4444; }
        .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .card h2 { font-size: 20px; margin-bottom: 20px; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .summary-item { text-align: center; padding: 20px; background: #f9fafb; border-radius: 8px; }
        .summary-item .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
        .summary-item .value { font-size: 24px; font-weight: 700; color: #1f2937; margin-top: 5px; }
        .summary-item.error .value { color: #ef4444; }
        .summary-item.warning .value { color: #f59e0b; }
        .progress-bar { width: 100%; height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden; margin-top: 10px; }
        .progress-fill { height: 100%; transition: width 0.3s; }
        .progress-ok { background: #10b981; }
        .progress-warning { background: #f59e0b; }
        .progress-error { background: #ef4444; }
        .violation { padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid; }
        .violation.error { background: #fef2f2; border-color: #ef4444; }
        .violation.warning { background: #fffbeb; border-color: #f59e0b; }
        .violation-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .violation-type { font-weight: 600; font-size: 14px; }
        .violation-layer { font-size: 12px; color: #6b7280; background: #e5e7eb; padding: 2px 8px; border-radius: 4px; }
        .violation-message { color: #374151; margin-bottom: 8px; }
        .violation-details { font-size: 13px; color: #6b7280; background: white; padding: 10px; border-radius: 6px; margin-top: 10px; }
        .layer-table { width: 100%; border-collapse: collapse; }
        .layer-table th, .layer-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        .layer-table th { background: #f9fafb; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #6b7280; }
        .layer-table tr:hover { background: #f9fafb; }
        .status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
        .dot-ok { background: #10b981; }
        .dot-warning { background: #f59e0b; }
        .dot-error { background: #ef4444; }
        .dot-base { background: #9ca3af; }
        .explanation { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 0 8px 8px 0; margin-top: 15px; }
        .explanation h4 { color: #1e40af; margin-bottom: 10px; }
        .explanation ul { margin-left: 20px; color: #374151; }
        .explanation li { margin-bottom: 5px; }
        .code-block { background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 6px; font-family: 'Monaco', monospace; font-size: 13px; overflow-x: auto; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐳 Docker 镜像层预算报告</h1>
            <div class="meta">
                镜像: {{ image_name }} | 生成时间: {{ generated_at }} | 报告 ID: {{ report_id }}
            </div>
            <span class="status-badge {{ 'status-pass' if passed else 'status-fail' }}">
                {{ '✅ 预算检查通过' if passed else '❌ 预算检查未通过' }}
            </span>
        </div>

        <div class="card">
            <h2>📊 概览</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="label">总大小</div>
                    <div class="value">{{ total_size_formatted }}</div>
                    <div class="progress-bar">
                        <div class="progress-fill {{ progress_class }}" style="width: {{ progress_percent }}%"></div>
                    </div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">预算: {{ total_budget_formatted }}</div>
                </div>
                <div class="summary-item">
                    <div class="label">层数</div>
                    <div class="value">{{ layers_count }}</div>
                </div>
                <div class="summary-item error">
                    <div class="label">错误</div>
                    <div class="value">{{ errors_count }}</div>
                </div>
                <div class="summary-item warning">
                    <div class="label">警告</div>
                    <div class="value">{{ warnings_count }}</div>
                </div>
            </div>
        </div>

        {% if violations or warnings %}
        <div class="card">
            <h2>⚠️ 问题发现</h2>
            {% for violation in violations %}
            <div class="violation error">
                <div class="violation-header">
                    <span class="violation-type">❌ 错误 - {{ violation.type }}</span>
                    {% if violation.layer_index is not none %}
                    <span class="violation-layer">第 {{ violation.layer_index }} 层</span>
                    {% endif %}
                </div>
                <div class="violation-message">{{ violation.message }}</div>
                {% if violation.details %}
                <div class="violation-details">
                    <strong>详情：</strong><br>
                    {% if violation.details.command %}
                    命令: <code>{{ violation.details.command }}</code><br>
                    {% endif %}
                    {% if violation.details.files_count %}
                    相关文件数: {{ violation.details.files_count }}<br>
                    {% endif %}
                    {% if violation.details.sample_files %}
                    示例文件:
                    <ul>
                        {% for f in violation.details.sample_files %}
                        <li>{{ f }}</li>
                        {% endfor %}
                    </ul>
                    {% endif %}
                </div>
                {% endif %}
                {% if violation.explanation %}
                <div class="explanation">
                    {{ violation.explanation|safe }}
                </div>
                {% endif %}
            </div>
            {% endfor %}

            {% for warning in warnings %}
            <div class="violation warning">
                <div class="violation-header">
                    <span class="violation-type">⚠️ 警告 - {{ warning.type }}</span>
                    {% if warning.layer_index is not none %}
                    <span class="violation-layer">第 {{ warning.layer_index }} 层</span>
                    {% endif %}
                </div>
                <div class="violation-message">{{ warning.message }}</div>
            </div>
            {% endfor %}
        </div>
        {% endif %}

        <div class="card">
            <h2>📦 层详细分析</h2>
            <table class="layer-table">
                <thead>
                    <tr>
                        <th>层索引</th>
                        <th>状态</th>
                        <th>大小</th>
                        <th>创建命令</th>
                    </tr>
                </thead>
                <tbody>
                    {% for layer in layers %}
                    <tr>
                        <td>{{ layer.index }}</td>
                        <td>
                            {% if layer.is_base_image %}
                            <span class="status-dot dot-base"></span>基础镜像
                            {% elif layer.status == 'error' %}
                            <span class="status-dot dot-error"></span>超限
                            {% elif layer.status == 'warning' %}
                            <span class="status-dot dot-warning"></span>警告
                            {% else %}
                            <span class="status-dot dot-ok"></span>正常
                            {% endif %}
                        </td>
                        <td>{{ layer.size_formatted }}</td>
                        <td><code style="font-size: 12px;">{{ layer.command }}</code></td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        {% if dockerfile_analysis %}
        <div class="card">
            <h2>📝 Dockerfile 分析</h2>
            <p><strong>基础镜像:</strong> <code>{{ dockerfile_analysis.base_image }}</code></p>
            <p><strong>指令数:</strong> {{ dockerfile_analysis.instructions_count }}</p>
            {% if dockerfile_analysis.issues %}
            <h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 16px;">发现的问题:</h3>
            {% for issue in dockerfile_analysis.issues %}
            <div class="violation warning">
                <div class="violation-header">
                    <span class="violation-type">第 {{ issue.line_number }} 行</span>
                </div>
                <div class="violation-message">{{ issue.message }}</div>
                <div class="violation-details">
                    <strong>建议:</strong> {{ issue.suggestion }}
                </div>
            </div>
            {% endfor %}
            {% endif %}
        </div>
        {% endif %}
    </div>
</body>
</html>
"""

MARKDOWN_TEMPLATE = """# Docker 镜像层预算报告

**镜像**: {{ image_name }}
**生成时间**: {{ generated_at }}
**报告 ID**: {{ report_id }}
**状态**: {{ '✅ 预算检查通过' if passed else '❌ 预算检查未通过' }}

---

## 📊 概览

| 指标 | 数值 |
|------|------|
| 总大小 | {{ total_size_formatted }} / {{ total_budget_formatted }} |
| 使用率 | {{ progress_percent }}% |
| 层数 | {{ layers_count }} |
| 错误数 | {{ errors_count }} |
| 警告数 | {{ warnings_count }} |

---

## ⚠️ 问题发现

{% if not violations and not warnings %}
没有发现问题！
{% else %}

### 错误 ({{ errors_count }})

{% for violation in violations %}
#### ❌ {{ violation.type }}
{% if violation.layer_index is not none %}
**层索引**: 第 {{ violation.layer_index }} 层
{% endif %}

**描述**: {{ violation.message }}

**详情**:
{% if violation.details.command %}
- 命令: `{{ violation.details.command }}`
{% endif %}
{% if violation.details.files_count %}
- 相关文件数: {{ violation.details.files_count }}
{% endif %}
{% if violation.details.sample_files %}
- 示例文件:
  {% for f in violation.details.sample_files %}
  - {{ f }}
  {% endfor %}
{% endif %}

{% if violation.explanation %}
{{ violation.explanation }}
{% endif %}

{% endfor %}

### 警告 ({{ warnings_count }})

{% for warning in warnings %}
#### ⚠️ {{ warning.type }}
{% if warning.layer_index is not none %}
**层索引**: 第 {{ warning.layer_index }} 层
{% endif %}

**描述**: {{ warning.message }}

{% endfor %}
{% endif %}

---

## 📦 层详细分析

| 层索引 | 状态 | 大小 | 命令 |
|--------|------|------|------|
{% for layer in layers %}
| {{ layer.index }} | {% if layer.is_base_image %}基础镜像{% elif layer.status == 'error' %}❌ 超限{% elif layer.status == 'warning' %}⚠️ 警告{% else %}✅ 正常{% endif %} | {{ layer.size_formatted }} | `{{ layer.command }}` |
{% endfor %}

---

{% if dockerfile_analysis %}
## 📝 Dockerfile 分析

**基础镜像**: `{{ dockerfile_analysis.base_image }}`
**指令数**: {{ dockerfile_analysis.instructions_count }}

{% if dockerfile_analysis.issues %}
### 发现的问题

{% for issue in dockerfile_analysis.issues %}
- **第 {{ issue.line_number }} 行**: {{ issue.message }}
  - 建议: {{ issue.suggestion }}
{% endfor %}
{% endif %}

{% if dockerfile_analysis.suggestions %}
### 优化建议

{% for suggestion in dockerfile_analysis.suggestions %}
- [{{ suggestion.priority }}] {{ suggestion.message }}
  - 影响: {{ suggestion.impact }}
{% endfor %}
{% endif %}

---
{% endif %}

*报告由 docker-layer-budget 生成*
"""


class ReportGenerator:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = output_dir

    def generate_terminal_summary(
        self,
        metadata: ImageMetadata,
        budget_result: BudgetResult,
        dockerfile_analysis: Optional[DockerfileAnalysis] = None,
    ) -> str:
        lines = []

        status_icon = "✅" if budget_result.passed else "❌"
        lines.append("")
        lines.append("=" * 60)
        lines.append(f"  {status_icon} Docker 镜像层预算检查结果")
        lines.append("=" * 60)
        lines.append("")

        lines.append("📊 镜像信息")
        lines.append("-" * 40)
        lines.append(f"  镜像名称: {metadata.image_name or 'N/A'}")
        lines.append(f"  标签: {metadata.image_tag or 'N/A'}")
        lines.append(f"  总大小: {format_size(metadata.total_size)}")
        lines.append(f"  层数: {metadata.layers_count}")
        lines.append("")

        lines.append("📈 预算使用情况")
        lines.append("-" * 40)
        if budget_result.total_budget > 0:
            usage_percent = (
                (metadata.total_size / budget_result.total_budget) * 100
                if budget_result.total_budget > 0
                else 0
            )
            bar_length = 30
            filled = int(bar_length * usage_percent / 100)
            bar = "█" * filled + "░" * (bar_length - filled)
            lines.append(f"  预算: {format_size(budget_result.total_budget)}")
            lines.append(f"  使用: [{bar}] {usage_percent:.1f}%")
        lines.append(f"  错误: {budget_result.errors_count}")
        lines.append(f"  警告: {budget_result.warnings_count}")
        lines.append("")

        if budget_result.violations or budget_result.warnings:
            lines.append("⚠️  问题列表")
            lines.append("-" * 40)

            for v in budget_result.violations:
                layer_info = f" (层 {v.layer_index})" if v.layer_index is not None else ""
                lines.append(f"  ❌ [{v.type}]{layer_info}")
                lines.append(f"     {v.message}")

            for w in budget_result.warnings:
                layer_info = f" (层 {w.layer_index})" if w.layer_index is not None else ""
                lines.append(f"  ⚠️  [{w.type}]{layer_info}")
                lines.append(f"     {w.message}")

            lines.append("")

        lines.append("📦 层列表")
        lines.append("-" * 40)
        for layer in metadata.layers:
            status = " "
            if layer.is_base_image:
                status = "B"
            elif layer.is_cached:
                status = "C"
            lines.append(
                f"  [{status or ' '}] L{layer.index:2d} {format_size(layer.size):>12} {layer.command_summary}"
            )

        lines.append("")
        lines.append("=" * 60)
        lines.append(
            f"  退出码: {0 if budget_result.passed else 1} ({'通过' if budget_result.passed else '存在违规'})"
        )
        lines.append("=" * 60)
        lines.append("")

        return "\n".join(lines)

    def generate_json(
        self,
        metadata: ImageMetadata,
        budget_result: BudgetResult,
        dockerfile_analysis: Optional[DockerfileAnalysis] = None,
        include_explanations: bool = True,
    ) -> dict:
        report_data = {
            "report_id": stable_hash(
                {
                    "metadata": metadata.to_dict(),
                    "timestamp": datetime.now().isoformat(),
                }
            ),
            "generated_at": datetime.now().isoformat(),
            "passed": budget_result.passed,
            "metadata": metadata.to_dict(),
            "budget_result": budget_result.to_dict(),
            "exit_code": 0 if budget_result.passed else 1,
        }

        if dockerfile_analysis:
            report_data["dockerfile_analysis"] = dockerfile_analysis.to_dict()

        if include_explanations:
            engine = BudgetEngine()
            for v in budget_result.violations:
                explanation = engine.get_explanation(v)
                for v_dict in report_data["budget_result"]["violations"]:
                    if v_dict["type"] == v.type and v_dict["message"] == v.message:
                        v_dict["explanation"] = explanation
                        break

        return report_data

    def generate_markdown(
        self,
        metadata: ImageMetadata,
        budget_result: BudgetResult,
        dockerfile_analysis: Optional[DockerfileAnalysis] = None,
    ) -> str:
        report_data = self.generate_json(metadata, budget_result, dockerfile_analysis)

        progress_percent = 0
        if budget_result.total_budget > 0:
            progress_percent = min(
                100, (metadata.total_size / budget_result.total_budget) * 100
            )

        if progress_percent >= 100:
            progress_class = "progress-error"
        elif progress_percent >= 80:
            progress_class = "progress-warning"
        else:
            progress_class = "progress-ok"

        violations_with_explanation = []
        for v in budget_result.violations:
            v_dict = v.to_dict()
            engine = BudgetEngine()
            v_dict["explanation"] = engine.get_explanation(v)
            violations_with_explanation.append(v_dict)

        layers_combined = []
        for layer in metadata.layers:
            layer_info = layer.to_dict()
            for analysis in budget_result.layer_analysis:
                if analysis["index"] == layer.index:
                    layer_info["status"] = analysis["status"]
                    layer_info["command"] = analysis["command"]
                    break
            layers_combined.append(layer_info)

        template = Template(MARKDOWN_TEMPLATE)
        return template.render(
            report_title=metadata.image_name or "Docker Image",
            report_id=report_data["report_id"],
            generated_at=report_data["generated_at"],
            passed=budget_result.passed,
            image_name=f"{metadata.image_name}:{metadata.image_tag}"
            if metadata.image_tag
            else metadata.image_name
            or "Unknown",
            total_size_formatted=format_size(metadata.total_size),
            total_budget_formatted=format_size(budget_result.total_budget),
            progress_percent=round(progress_percent, 1),
            progress_class=progress_class,
            layers_count=metadata.layers_count,
            errors_count=budget_result.errors_count,
            warnings_count=budget_result.warnings_count,
            violations=violations_with_explanation,
            warnings=[w.to_dict() for w in budget_result.warnings],
            layers=layers_combined,
            dockerfile_analysis=dockerfile_analysis.to_dict() if dockerfile_analysis else None,
        )

    def generate_html(
        self,
        metadata: ImageMetadata,
        budget_result: BudgetResult,
        dockerfile_analysis: Optional[DockerfileAnalysis] = None,
    ) -> str:
        report_data = self.generate_json(metadata, budget_result, dockerfile_analysis)

        progress_percent = 0
        if budget_result.total_budget > 0:
            progress_percent = min(
                100, (metadata.total_size / budget_result.total_budget) * 100
            )

        if progress_percent >= 100:
            progress_class = "progress-error"
        elif progress_percent >= 80:
            progress_class = "progress-warning"
        else:
            progress_class = "progress-ok"

        violations_with_explanation = []
        for v in budget_result.violations:
            v_dict = v.to_dict()
            engine = BudgetEngine()
            v_dict["explanation"] = engine.get_explanation(v)
            violations_with_explanation.append(v_dict)

        layers_combined = []
        for layer in metadata.layers:
            layer_info = layer.to_dict()
            for analysis in budget_result.layer_analysis:
                if analysis["index"] == layer.index:
                    layer_info["status"] = analysis["status"]
                    layer_info["command"] = analysis["command"]
                    break
            layers_combined.append(layer_info)

        template = Template(HTML_TEMPLATE)
        return template.render(
            report_title=metadata.image_name or "Docker Image",
            report_id=report_data["report_id"],
            generated_at=report_data["generated_at"],
            passed=budget_result.passed,
            image_name=f"{metadata.image_name}:{metadata.image_tag}"
            if metadata.image_tag
            else metadata.image_name
            or "Unknown",
            total_size_formatted=format_size(metadata.total_size),
            total_budget_formatted=format_size(budget_result.total_budget),
            progress_percent=round(progress_percent, 1),
            progress_class=progress_class,
            layers_count=metadata.layers_count,
            errors_count=budget_result.errors_count,
            warnings_count=budget_result.warnings_count,
            violations=violations_with_explanation,
            warnings=[w.to_dict() for w in budget_result.warnings],
            layers=layers_combined,
            dockerfile_analysis=dockerfile_analysis.to_dict() if dockerfile_analysis else None,
        )

    def write_reports(
        self,
        metadata: ImageMetadata,
        budget_result: BudgetResult,
        dockerfile_analysis: Optional[DockerfileAnalysis] = None,
        formats: list = ["json", "markdown", "html"],
        overwrite: bool = False,
        prefix: str = "",
    ) -> Dict[str, str]:
        os.makedirs(self.output_dir, exist_ok=True)

        base_filename = (
            f"{prefix}report_{stable_hash(metadata.to_dict())}"
            if not prefix or prefix.endswith("_")
            else f"{prefix}_{stable_hash(metadata.to_dict())}"
        )
        if prefix:
            base_filename = prefix

        output_files = {}

        if "json" in formats:
            json_path = os.path.join(self.output_dir, f"{base_filename}.json")
            if os.path.exists(json_path) and not overwrite:
                raise FileExistsError(
                    f"JSON 报告已存在: {json_path}，使用 --overwrite 覆盖"
                )
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(
                    self.generate_json(metadata, budget_result, dockerfile_analysis),
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            output_files["json"] = json_path

        if "markdown" in formats or "md" in formats:
            md_path = os.path.join(self.output_dir, f"{base_filename}.md")
            if os.path.exists(md_path) and not overwrite:
                raise FileExistsError(
                    f"Markdown 报告已存在: {md_path}，使用 --overwrite 覆盖"
                )
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(self.generate_markdown(metadata, budget_result, dockerfile_analysis))
            output_files["markdown"] = md_path

        if "html" in formats:
            html_path = os.path.join(self.output_dir, f"{base_filename}.html")
            if os.path.exists(html_path) and not overwrite:
                raise FileExistsError(
                    f"HTML 报告已存在: {html_path}，使用 --overwrite 覆盖"
                )
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(self.generate_html(metadata, budget_result, dockerfile_analysis))
            output_files["html"] = html_path

        return output_files
