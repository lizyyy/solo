"""现场材料打包功能 - 生成像现场会收到的材料包"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

import pandas as pd
from jinja2 import Template

from .parameter_manager import ParameterManager
from .chart_explainer import ChartExplainer, ChartExplanation
from .data_lineage import DataLineageTracker, DataIssueReport


@dataclass
class MaterialPackage:
    """材料包 - 包含现场会需要的所有材料"""
    package_id: str
    package_name: str
    output_dir: Path
    generated_at: datetime = field(default_factory=datetime.now)
    materials: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "package_id": self.package_id,
            "package_name": self.package_name,
            "output_dir": str(self.output_dir),
            "generated_at": self.generated_at.isoformat(),
            "materials": self.materials,
        }


class MaterialPacker:
    """材料打包器"""
    
    def __init__(
        self,
        parameter_manager: ParameterManager,
        chart_explainer: ChartExplainer,
        lineage_tracker: DataLineageTracker,
    ):
        self.parameter_manager = parameter_manager
        self.chart_explainer = chart_explainer
        self.lineage_tracker = lineage_tracker
    
    def _generate_readme(self, output_dir: Path, package_name: str) -> None:
        """生成材料包README，教研编辑阿宁看README能知道先跑哪条命令、再看哪份历史时间线"""
        readme_content = f"""# {package_name} - 材料包说明

生成时间：{datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}

## 快速开始

### 先看这份历史时间线
1. 打开 `01_版本时间线.html` 或 `01_版本时间线.csv`
2. 查看每一步参数变更，了解哪一步让结果变化

### 再看图表解释
1. 打开 `02_图表解释报告.html`
2. 查看通俗易懂的解释说明
3. 查看关键结论和边界问题

### 遇到问题怎么办
1. 查看 `03_边界问题处理建议.md`
2. 查看 `04_数据溯源报告/` 目录下的追溯报告
3. 运行命令查看详细信息：
   ```bash
   # 查看版本时间线
   python -m src.cli timeline
   
   # 查看指定版本解释
   python -m src.cli explain --version <版本名称>
   
   # 追溯坏数据
   python -m src.cli trace --param <参数名>
   ```

## 材料清单

| 文件 | 说明 |
|------|------|
| `00_材料包说明.md` | 本文件 |
| `01_版本时间线.html` | 可视化版本历史时间线（推荐先看） |
| `01_版本时间线.csv` | 版本时间线（表格格式） |
| `02_图表解释报告.html` | 图表解释（通俗易懂版） |
| `02_图表解释报告.json` | 图表解释（原始数据） |
| `03_边界问题处理建议.md` | 所有边界问题及处理建议 |
| `04_数据溯源报告/` | 各参数溯源报告 |
| `05_参数表/` | 各版本参数表 |
| `06_原始数据副本/` | 原始数据备份 |

## 命令行工具使用

```bash
# 1. 查看版本时间线
python -m src.cli timeline

# 2. 生成图表解释
python -m src.cli explain --version v1

# 3. 追溯坏数据来源
python -m src.cli trace --param 分母

# 4. 打包新材料包
python -m src.cli package --name "6月调参结果公示" --output ./output

# 5. 比较两个版本
python -m src.cli compare --version1 v1 --version2 v2
```

## 联系信息

如有疑问请参考各参数的录入人信息，详见版本时间线中有记录。
"""
        with open(output_dir / "00_材料包说明.md", "w", encoding="utf-8") as f:
            f.write(readme_content)
    
    def _generate_timeline_html(self, output_dir: Path) -> None:
        """生成版本时间线HTML"""
        timeline = self.parameter_manager.get_version_timeline()
        
        html_template = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>版本时间线</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .timeline { position: relative; padding-left: 30px; }
        .timeline::before { content: ''; position: absolute; left: 10px; top: 0; bottom: 0; width: 4px; background: #e0e0e0; }
        .timeline-item { position: relative; margin-bottom: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; }
        .timeline-item::before { content: ''; position: absolute; left: -25px; top: 20px; width: 16px; height: 16px; background: #4CAF50; border-radius: 50%; }
        .timeline-item.active::before { background: #2196F3; }
        .step-badge { display: inline-block; background: #4CAF50; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px; }
        .active .step-badge { background: #2196F3; }
        .meta { color: #666; font-size: 14px; margin: 10px 0; }
        .changes { background: #fff; padding: 15px; border-radius: 4px; margin-top: 10px; }
        .change-item { padding: 5px 0; border-bottom: 1px solid #eee; }
        .source { color: #888; font-size: 12px; }
        .highlight { background: #FFF3CD; padding: 10px; border-left: 4px solid #FFC107; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>📊 优化调参图表解释 - 版本时间线</h1>
    <p>共 {{ timeline | length }} 个版本，点击版本名称查看详细信息</p>
    <div class="timeline">
        {% for item in timeline %}
        <div class="timeline-item {{ 'active' if item.is_active }}">
            <span class="step-badge">第 {{ item.step }} 步</span>
            <h2>
                {{ item.version_name }}
                {% if item.is_active %}<span style="color:#2196F3;">（当前版本）</span>{% endif %}
            </h2>
            <div class="meta">
                📅 {{ item.created_at }} | 👤 {{ item.created_by }} | 📍 来源：{{ item.source }}
            </div>
            {% if item.change_description %}
            <div class="highlight">
                <strong>调整内容：</strong>{{ item.change_description }}
            </div>
            {% endif %}
            {% if item.change_reason %}
            <div class="highlight">
                <strong>调参原因：</strong>{{ item.change_reason }}
            </div>
            {% endif %}
            {% if item.changes %}
            <div class="changes">
                <strong>参数变更：</strong>
                {% for change in item.changes %}
                <div class="change-item">{{ change }}</div>
                {% endfor %}
            </div>
            {% endif %}
            <div class="source">版本ID: {{ item.version_id }}</div>
        </div>
        {% endfor %}
    </div>
</body>
</html>
"""
        template = Template(html_template)
        html_content = template.render(timeline=timeline)
        
        with open(output_dir / "01_版本时间线.html", "w", encoding="utf-8") as f:
            f.write(html_content)
        
        df = self.parameter_manager.export_to_dataframe()
        df.to_csv(output_dir / "01_版本时间线.csv", index=False, encoding="utf-8-sig")
    
    def _generate_explanation_html(
        self,
        output_dir: Path,
        explanation: ChartExplanation,
    ) -> None:
        """生成图表解释HTML - 通俗易懂版"""
        html_template = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>{{ explanation.title }}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #333; }
        .section { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section h2 { margin-top: 0; color: #333; }
        .summary { background: #E3F2FD; border-left: 4px solid #2196F3; padding: 15px; }
        .finding { background: #E8F5E9; border-left: 4px solid #4CAF50; padding: 10px 15px; margin: 10px 0; border-radius: 4px; }
        .issue-high { background: #FFEBEE; border-left: 4px solid #F44336; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .issue-medium { background: #FFF3CD; border-left: 4px solid #FFC107; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .step { background: white; padding: 15px; margin: 10px 0; border-radius: 4px; border: 1px solid #ddd; }
        .formula { font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 4px; display: inline-block; }
        .source-card { background: white; padding: 10px; margin: 5px 0; border-radius: 4px; border: 1px solid #ddd; }
        .change-item { padding: 8px 0; border-bottom: 1px solid #eee; }
        .param-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        .param-table td { padding: 8px; border-bottom: 1px solid #ddd; }
        .param-name { font-weight: bold; width: 150px; }
        code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>📊 {{ explanation.title }}</h1>
    <p>版本：<strong>{{ explanation.version_name }}</strong> | 生成时间：{{ explanation.generated_at.strftime('%Y年%m月%d日 %H:%M:%S') }}</p>
    
    <div class="section">
        <h2>📝 通俗易懂的解释</h2>
        <div class="summary">
            {{ explanation.plain_language_summary | replace('\n', '<br>') | safe }}
        </div>
    </div>
    
    <div class="section">
        <h2>🎯 关键结论</h2>
        {% for finding in explanation.key_findings %}
        <div class="finding">{{ finding }}</div>
        {% endfor %}
    </div>
    
    {% if explanation.boundary_issues %}
    <div class="section">
        <h2>⚠️ 边界问题处理建议</h2>
        {% for issue in explanation.boundary_issues %}
            {% if issue.severity == 'high' %}
            <div class="issue-high">
                <strong>{{ issue.issue_type }}</strong> - {{ issue.location }}
                <p>{{ issue.message }}</p>
                <p><strong>处理建议：</strong></p>
                <p>{{ issue.suggestion | replace('\n', '<br>') | safe }}</p>
            </div>
            {% else %}
            <div class="issue-medium">
                <strong>{{ issue.issue_type }}</strong> - {{ issue.location }}
                <p>{{ issue.message }}</p>
                <p><strong>处理建议：</strong></p>
                <p>{{ issue.suggestion | replace('\n', '<br>') | safe }}</p>
            </div>
            {% endif %}
        {% endfor %}
    </div>
    {% endif %}
    
    <div class="section">
        <h2>🔢 计算过程</h2>
        {% for step in explanation.calculation_steps %}
        <div class="step">
            <h3>{{ step.step_name }}</h3>
            <p>{{ step.description }}</p>
            <p><strong>公式：</strong><span class="formula">{{ step.formula }}</span></p>
            <p><strong>输入：</strong></p>
            <table class="param-table">
                {% for key, value in step.inputs.items() %}
                <tr><td class="param-name">{{ key }}</td><td>{{ value }}</td></tr>
                {% endfor %}
            </table>
            <p><strong>结果：</strong><code>{{ step.output }}</code></p>
        </div>
        {% endfor %}
    </div>
    
    {% if explanation.parameter_changes %}
    <div class="section">
        <h2>🔄 相比上一版本的参数变更</h2>
        {% for change in explanation.parameter_changes %}
        <div class="change-item">{{ change.description }}</div>
        {% endfor %}
    </div>
    {% endif %}
    
    <div class="section">
        <h2>📦 数据来源</h2>
        {% for source in explanation.data_sources %}
        <div class="source-card">
            <strong>{{ source.source_name }}</strong> ({{ source.source_type }})
            <p>ID: {{ source.source_id }}</p>
            <p>首次录入：{{ source.first_seen_at }}</p>
            <p>录入人：{{ source.first_seen_by }}</p>
        </div>
        {% endfor %}
    </div>
</body>
</html>
"""
        template = Template(html_template)
        html_content = template.render(explanation=explanation)
        
        with open(output_dir / "02_图表解释报告.html", "w", encoding="utf-8") as f:
            f.write(html_content)
        
        with open(output_dir / "02_图表解释报告.json", "w", encoding="utf-8") as f:
            json.dump(explanation.to_dict(), f, ensure_ascii=False, indent=2)
    
    def _generate_issue_suggestions(
        self,
        output_dir: Path,
        explanation: ChartExplanation,
    ) -> None:
        """生成边界问题处理建议"""
        content = f"""# 边界问题处理建议

生成时间：{datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}

## 问题汇总

共发现 {len(explanation.boundary_issues)} 个边界问题。

"""
        
        for i, issue in enumerate(explanation.boundary_issues, 1):
            severity_icon = "🔴 严重" if issue.severity == "high" else "🟡 中等"
            content += f"""
---

## 问题 {i}: {severity_icon} {issue.issue_type}

**位置**：{issue.location}

**问题描述**：
{issue.message}

**处理建议**：
{issue.suggestion}

**追溯命令**：
```bash
python -m src.cli trace --param "{issue.param_name}"
```

"""
        
        with open(output_dir / "03_边界问题处理建议.md", "w", encoding="utf-8") as f:
            f.write(content)
    
    def _generate_lineage_reports(
        self,
        output_dir: Path,
        explanation: ChartExplanation,
    ) -> None:
        """生成数据溯源报告"""
        lineage_dir = output_dir / "04_数据溯源报告"
        lineage_dir.mkdir(exist_ok=True)
        
        for issue in explanation.boundary_issues:
            if issue.param_name:
                report = self.lineage_tracker.investigate_issue(issue)
                report_path = lineage_dir / f"{issue.param_name}_溯源报告.json"
                with open(report_path, "w", encoding="utf-8") as f:
                    json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
                
                md_report = lineage_dir / f"{issue.param_name}_溯源报告.md"
                md_content = f"""# {issue.param_name} - 数据溯源报告

生成时间：{datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}

## 问题信息

- **问题类型**：{report.issue_type}
- **严重程度**：{report.severity}
- **当前值**：{report.current_value}
- **问题描述**：{report.description}

## 追溯路径

"""
                if report.first_occurrence:
                    md_content += f"""
### 首次出现

- **版本**：{report.first_occurrence.version_name}
- **来源**：{report.first_occurrence.source_name} (ID: {report.first_occurrence.source_id})
- **录入时间**：{report.first_occurrence.created_at.strftime('%Y年%m月%d日 %H:%M:%S')}
- **录入人**：{report.first_occurrence.created_by}
- **原始数据**：
```json
{json.dumps(report.first_occurrence.raw_data, ensure_ascii=False, indent=2)}
```

"""
                
                md_content += """
### 历史变更记录

| 版本 | 值 | 来源 | 时间 | 录入人 |
|------|----|------|------|--------|
"""
                for node in report.lineage:
                    md_content += f"| {node.version_name} | {node.value} | {node.source_name} | {node.created_at.strftime('%Y-%m-%d %H:%M:%S')} | {node.created_by} |\n"
                
                md_content += """
## 处理建议

"""
                for suggestion in report.suggestions:
                    md_content += f"- {suggestion}\n"
                
                with open(md_report, "w", encoding="utf-8") as f:
                    f.write(md_content)
    
    def _generate_param_tables(self, output_dir: Path) -> None:
        """生成各版本参数表"""
        param_dir = output_dir / "05_参数表"
        param_dir.mkdir(exist_ok=True)
        
        for version in self.parameter_manager.list_versions():
            df = pd.DataFrame([
                {"参数名称": k, "参数值": v} for k, v in version.parameters.items()
            ])
            df.to_csv(param_dir / f"{version.version_name}_参数表.csv", index=False, encoding="utf-8-sig")
            
            with open(param_dir / f"{version.version_name}_参数表.md", "w", encoding="utf-8") as f:
                f.write(f"# {version.version_name} - 参数表\n\n")
                f.write(f"创建时间：{version.created_at.strftime('%Y年%m月%d日 %H:%M:%S')}\n")
                f.write(f"创建人：{version.created_by}\n")
                f.write(f"来源：{version.source.source_name}\n\n")
                f.write(f"变更描述：{version.change_description}\n\n")
                f.write("| 参数名称 | 参数值 |\n|----------|--------|\n")
                for k, v in version.parameters.items():
                    f.write(f"| {k} | {v} |\n")
    
    def _generate_raw_data_backup(self, output_dir: Path) -> None:
        """生成原始数据副本 - 保留原始来源，避免把脏数据修得看不出痕迹"""
        raw_dir = output_dir / "06_原始数据副本"
        raw_dir.mkdir(exist_ok=True)
        
        seen_sources = set()
        
        for version in self.parameter_manager.list_versions():
            source_key = (version.source.source_type, version.source.source_id)
            if source_key not in seen_sources:
                seen_sources.add(source_key)
                
                source_filename = f"{version.source.source_name}_{version.source.source_id}.json"
                safe_filename = source_filename.replace("/", "_").replace("\\", "_")
                with open(raw_dir / safe_filename, "w", encoding="utf-8") as f:
                    json.dump(version.source.raw_data, f, ensure_ascii=False, indent=2)
                
                with open(raw_dir / f"{safe_filename}.md", "w", encoding="utf-8") as f:
                    f.write(f"# {version.source.source_name}\n\n")
                    f.write(f"- 来源类型：{version.source.source_type}\n")
                    f.write(f"- 来源ID：{version.source.source_id}\n")
                    f.write(f"- 导入时间：{version.source.imported_at.strftime('%Y年%m月%d日 %H:%M:%S')}\n")
                    f.write(f"- 备注：{version.source.notes}\n\n")
                    f.write("## 原始数据\n\n")
                    f.write("```json\n")
                    f.write(json.dumps(version.source.raw_data, ensure_ascii=False, indent=2))
                    f.write("\n```\n")
    
    def package(
        self,
        package_name: str,
        output_dir: str,
        version_id: Optional[str] = None,
    ) -> MaterialPackage:
        """
        打包现场材料包
        带一包像现场会收到的材料就行
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        package_dir = output_path / f"{package_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        package_dir.mkdir(exist_ok=True)
        
        explanation = self.chart_explainer.explain(
            version_id=version_id,
            title=f"{package_name} - 图表解释",
        )
        
        materials = []
        
        self._generate_readme(package_dir, package_name)
        materials.append({"name": "材料包说明", "file": "00_材料包说明.md"})
        
        self._generate_timeline_html(package_dir)
        materials.append({"name": "版本时间线", "file": "01_版本时间线.html"})
        materials.append({"name": "版本时间线(CSV)", "file": "01_版本时间线.csv"})
        
        self._generate_explanation_html(package_dir, explanation)
        materials.append({"name": "图表解释报告", "file": "02_图表解释报告.html"})
        materials.append({"name": "图表解释报告(JSON)", "file": "02_图表解释报告.json"})
        
        self._generate_issue_suggestions(package_dir, explanation)
        materials.append({"name": "边界问题处理建议", "file": "03_边界问题处理建议.md"})
        
        self._generate_lineage_reports(package_dir, explanation)
        materials.append({"name": "数据溯源报告", "file": "04_数据溯源报告/"})
        
        self._generate_param_tables(package_dir)
        materials.append({"name": "参数表", "file": "05_参数表/"})
        
        self._generate_raw_data_backup(package_dir)
        materials.append({"name": "原始数据副本", "file": "06_原始数据副本/"})
        
        package = MaterialPackage(
            package_id=str(uuid4()),
            package_name=package_name,
            output_dir=package_dir,
            materials=materials,
        )
        
        manifest_path = package_dir / "manifest.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(package.to_dict(), f, ensure_ascii=False, indent=2)
        
        return package
