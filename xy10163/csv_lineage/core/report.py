from typing import Dict, List, Any
from datetime import datetime
import json

try:
    from jinja2 import Template
    HAS_JINJA2 = True
except ImportError:
    HAS_JINJA2 = False

class ReportGenerator:
    def __init__(self, storage):
        self.storage = storage

    def generate_text_report(self, table_name: str, 
                             comparison: Dict[str, Any],
                             lineage: Dict[str, Any],
                             breaking_changes: Dict[str, Any],
                             old_version: int,
                             new_version: int) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append(f"CSV 字段血缘追踪报告 - {table_name}")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"比较版本: v{old_version} -> v{new_version}")
        lines.append("")
        
        summary = comparison.get("summary", {})
        lines.append("【变更概要】")
        lines.append(f"  原字段数: {summary.get('total_old', 0)}")
        lines.append(f"  新字段数: {summary.get('total_new', 0)}")
        lines.append(f"  新增字段: {summary.get('added_count', 0)}")
        lines.append(f"  删除字段: {summary.get('removed_count', 0)}")
        lines.append(f"  修改字段: {summary.get('changed_count', 0)}")
        lines.append(f"  未变字段: {summary.get('unchanged_count', 0)}")
        lines.append("")
        
        bc = breaking_changes.get("breaking_changes", [])
        warnings = breaking_changes.get("warnings", [])
        
        if bc:
            lines.append("【破坏性变更】" + "!" * 60)
            for i, change in enumerate(bc, 1):
                lines.append(f"  [{i}] {change['message']}")
                lines.append(f"      来源: 版本 {change['source']['version']}")
                lines.append(f"      时间: {change['source']['timestamp']}")
                lines.append("")
        
        if warnings:
            lines.append("【警告】")
            for i, warning in enumerate(warnings, 1):
                lines.append(f"  [{i}] {warning['message']}")
                lines.append(f"      来源: 版本 {warning['source']['version']}")
                lines.append(f"      时间: {warning['source']['timestamp']}")
                lines.append("")
        
        added = comparison.get("added", [])
        if added:
            lines.append("【新增字段】")
            for field in added:
                lines.append(f"  + {field['field']}")
                lines.append(f"      原因: {field['reason']}")
                if field.get("new_schema"):
                    lines.append(f"      类型: {field['new_schema'].get('dtype', 'unknown')}")
                lines.append("")
        
        removed = comparison.get("removed", [])
        if removed:
            lines.append("【删除字段】")
            for field in removed:
                lines.append(f"  - {field['field']}")
                lines.append(f"      原因: {field['reason']}")
                if field.get("old_schema"):
                    lines.append(f"      原类型: {field['old_schema'].get('dtype', 'unknown')}")
                lines.append("")
        
        changed = comparison.get("changed", [])
        if changed:
            lines.append("【修改字段】")
            for field in changed:
                lines.append(f"  ~ {field['field']}")
                lines.append(f"      原因: {field['reason']}")
                lines.append("")
        
        if lineage and lineage.get("fields"):
            lines.append("【字段血缘关系】")
            for canonical, data in lineage["fields"].items():
                aliases = data.get("aliases", [])
                if len(aliases) > 1:
                    lines.append(f"  {canonical}:")
                    for i, alias in enumerate(aliases, 1):
                        marker = " (当前)" if i == len(aliases) else ""
                        lines.append(f"    {i}. {alias}{marker}")
                    lines.append("")
        
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        
        return "\n".join(lines)

    def generate_json_report(self, table_name: str,
                             comparison: Dict[str, Any],
                             lineage: Dict[str, Any],
                             breaking_changes: Dict[str, Any],
                             old_version: int,
                             new_version: int) -> str:
        report = {
            "table_name": table_name,
            "generated_at": datetime.now().isoformat(),
            "versions": {
                "from": old_version,
                "to": new_version
            },
            "summary": comparison.get("summary", {}),
            "breaking_changes": breaking_changes.get("breaking_changes", []),
            "warnings": breaking_changes.get("warnings", []),
            "field_changes": {
                "added": [self._simplify_change(c) for c in comparison.get("added", [])],
                "removed": [self._simplify_change(c) for c in comparison.get("removed", [])],
                "changed": [self._simplify_change(c) for c in comparison.get("changed", [])],
                "unchanged": [c["field"] for c in comparison.get("unchanged", [])]
            },
            "field_lineage": self._extract_field_lineage(lineage)
        }
        return json.dumps(report, indent=2, ensure_ascii=False)

    def _simplify_change(self, change: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "field": change.get("field"),
            "reason": change.get("reason"),
            "old_dtype": change.get("old_schema", {}).get("dtype") if change.get("old_schema") else None,
            "new_dtype": change.get("new_schema", {}).get("dtype") if change.get("new_schema") else None
        }

    def _extract_field_lineage(self, lineage: Dict[str, Any]) -> Dict[str, Any]:
        if not lineage:
            return {}
        
        return {
            canonical: {
                "aliases": data.get("aliases", []),
                "first_seen": data.get("first_seen_version"),
                "last_seen": data.get("last_seen_version"),
                "history": data.get("history", [])
            }
            for canonical, data in lineage.get("fields", {}).items()
        }

    def generate_html_report(self, table_name: str,
                             comparison: Dict[str, Any],
                             lineage: Dict[str, Any],
                             breaking_changes: Dict[str, Any],
                             old_version: int,
                             new_version: int) -> str:
        if not HAS_JINJA2:
            return self.generate_json_report(table_name, comparison, lineage, 
                                            breaking_changes, old_version, new_version)
        
        html_template = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSV 字段血缘追踪报告 - {{ table_name }}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
        .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
        .summary-card .value { font-size: 28px; font-weight: bold; color: #333; }
        .section { margin: 30px 0; }
        .section h2 { color: #333; border-bottom: 2px solid #ddd; padding-bottom: 8px; }
        .breaking { background: #fff5f5; border: 1px solid #ffcdd2; border-radius: 5px; padding: 15px; margin: 10px 0; border-left: 4px solid #f44336; }
        .warning { background: #fffde7; border: 1px solid #fff176; border-radius: 5px; padding: 15px; margin: 10px 0; border-left: 4px solid #ffc107; }
        .change-item { background: #f8f9fa; border-radius: 5px; padding: 15px; margin: 10px 0; }
        .change-item.added { border-left: 4px solid #4caf50; }
        .change-item.removed { border-left: 4px solid #f44336; }
        .change-item.changed { border-left: 4px solid #ff9800; }
        .field-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
        .field-reason { color: #666; font-size: 14px; }
        .source-info { margin-top: 10px; padding: 10px; background: #e3f2fd; border-radius: 4px; font-size: 12px; }
        .alias-list { background: #e8f5e9; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .alias-list .current { font-weight: bold; color: #2e7d32; }
        .timestamp { color: #999; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; }
        tr:hover { background: #fafafa; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .badge.added { background: #c8e6c9; color: #2e7d32; }
        .badge.removed { background: #ffcdd2; color: #c62828; }
        .badge.changed { background: #ffe0b2; color: #e65100; }
    </style>
</head>
<body>
    <div class="container">
        <h1>CSV 字段血缘追踪报告</h1>
        <p class="timestamp">表名: {{ table_name }} | 生成时间: {{ generated_at }} | 版本: v{{ old_version }} &rarr; v{{ new_version }}</p>
        
        <div class="section">
            <h2>变更概要</h2>
            <div class="summary">
                <div class="summary-card">
                    <h3>原字段数</h3>
                    <div class="value">{{ summary.total_old }}</div>
                </div>
                <div class="summary-card">
                    <h3>新字段数</h3>
                    <div class="value">{{ summary.total_new }}</div>
                </div>
                <div class="summary-card">
                    <h3>新增字段</h3>
                    <div class="value" style="color: #4caf50;">{{ summary.added_count }}</div>
                </div>
                <div class="summary-card">
                    <h3>删除字段</h3>
                    <div class="value" style="color: #f44336;">{{ summary.removed_count }}</div>
                </div>
                <div class="summary-card">
                    <h3>修改字段</h3>
                    <div class="value" style="color: #ff9800;">{{ summary.changed_count }}</div>
                </div>
                <div class="summary-card">
                    <h3>未变字段</h3>
                    <div class="value">{{ summary.unchanged_count }}</div>
                </div>
            </div>
        </div>
        
        {% if breaking_changes %}
        <div class="section">
            <h2 style="color: #f44336;">破坏性变更</h2>
            {% for change in breaking_changes %}
            <div class="breaking">
                <div class="field-name">{{ change.field }}</div>
                <div class="field-reason">{{ change.message }}</div>
                <div class="source-info">
                    <strong>来源追踪:</strong><br>
                    版本: {{ change.source.version }}<br>
                    时间: {{ change.source.timestamp }}<br>
                    前一个名称: {{ change.source.previous_name }}
                </div>
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        {% if warnings %}
        <div class="section">
            <h2 style="color: #ff9800;">警告</h2>
            {% for warning in warnings %}
            <div class="warning">
                <div class="field-name">{{ warning.field }}</div>
                <div class="field-reason">{{ warning.message }}</div>
                <div class="source-info">
                    <strong>来源追踪:</strong><br>
                    版本: {{ warning.source.version }}<br>
                    时间: {{ warning.source.timestamp }}
                </div>
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        <div class="section">
            <h2>字段血缘关系</h2>
            <table>
                <thead>
                    <tr>
                        <th>标准名称</th>
                        <th>历史别名</th>
                        <th>首次出现</th>
                        <th>最后出现</th>
                    </tr>
                </thead>
                <tbody>
                    {% for canonical, data in field_lineage.items() %}
                    <tr>
                        <td><strong>{{ canonical }}</strong></td>
                        <td>
                            <div class="alias-list">
                                {% for alias in data.aliases %}
                                {% if loop.last %}
                                <span class="current">{{ alias }} (当前)</span>
                                {% else %}
                                {{ alias }}{% if not loop.last %} &rarr; {% endif %}
                                {% endif %}
                                {% endfor %}
                            </div>
                        </td>
                        <td>v{{ data.first_seen }}</td>
                        <td>v{{ data.last_seen }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        
        {% if field_changes.added %}
        <div class="section">
            <h2>新增字段 <span class="badge added">+{{ field_changes.added|length }}</span></h2>
            {% for field in field_changes.added %}
            <div class="change-item added">
                <div class="field-name">+ {{ field.field }}</div>
                <div class="field-reason">{{ field.reason }}</div>
                {% if field.new_dtype %}
                <div class="source-info">类型: {{ field.new_dtype }}</div>
                {% endif %}
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        {% if field_changes.removed %}
        <div class="section">
            <h2>删除字段 <span class="badge removed">-{{ field_changes.removed|length }}</span></h2>
            {% for field in field_changes.removed %}
            <div class="change-item removed">
                <div class="field-name">- {{ field.field }}</div>
                <div class="field-reason">{{ field.reason }}</div>
                {% if field.old_dtype %}
                <div class="source-info">原类型: {{ field.old_dtype }}</div>
                {% endif %}
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        {% if field_changes.changed %}
        <div class="section">
            <h2>修改字段 <span class="badge changed">~{{ field_changes.changed|length }}</span></h2>
            {% for field in field_changes.changed %}
            <div class="change-item changed">
                <div class="field-name">~ {{ field.field }}</div>
                <div class="field-reason">{{ field.reason }}</div>
                {% if field.old_dtype or field.new_dtype %}
                <div class="source-info">
                    {% if field.old_dtype %}原类型: {{ field.old_dtype }}{% endif %}
                    {% if field.old_dtype and field.new_dtype %} &rarr; {% endif %}
                    {% if field.new_dtype %}新类型: {{ field.new_dtype }}{% endif %}
                </div>
                {% endif %}
            </div>
            {% endfor %}
        </div>
        {% endif %}
        
        <p class="timestamp" style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            报告由 CSV 字段血缘追踪 CLI 生成
        </p>
    </div>
</body>
</html>
"""
        
        template = Template(html_template)
        
        report_data = {
            "table_name": table_name,
            "generated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "old_version": old_version,
            "new_version": new_version,
            "summary": comparison.get("summary", {}),
            "breaking_changes": breaking_changes.get("breaking_changes", []),
            "warnings": breaking_changes.get("warnings", []),
            "field_changes": {
                "added": [self._simplify_change(c) for c in comparison.get("added", [])],
                "removed": [self._simplify_change(c) for c in comparison.get("removed", [])],
                "changed": [self._simplify_change(c) for c in comparison.get("changed", [])]
            },
            "field_lineage": self._extract_field_lineage(lineage)
        }
        
        return template.render(**report_data)
