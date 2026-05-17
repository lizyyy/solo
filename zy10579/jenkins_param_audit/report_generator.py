import json
from datetime import datetime
from typing import Dict, Any, List
from dataclasses import asdict
from jinja2 import Template
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from .models import JobAuditResult, RiskLevel


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if hasattr(obj, 'value'):
            return obj.value
        return super().default(obj)


class ReportGenerator:
    MARKDOWN_TEMPLATE = """# Jenkins Job 参数审计报告

> 审计时间: {{ audit_time }}
> Job名称: {{ result.job_name }}
> 配置文件: {{ result.file_path }}

## 📊 审计摘要

| 指标 | 数值 |
|------|------|
| 总参数数量 | {{ result.summary.total_parameters }} |
| 有默认值的参数 | {{ result.summary.parameters_with_default }} |
| 无默认值的参数 | {{ result.summary.parameters_without_default }} |
| 总构建步骤 | {{ result.summary.total_build_steps }} |
| 危险步骤数量 | {{ result.summary.dangerous_steps }} |
| 解析错误数量 | {{ result.summary.parse_errors }} |

### 风险分布

| 风险等级 | 数量 |
|----------|------|
{% for level, count in result.summary.risk_distribution.items() %}
| {{ level }} | {{ count }} |
{% endfor %}

---

## ⚠️ 高风险参数 (CRITICAL/DANGER)

{% for param in high_risk_params %}
### {{ param.name }} ({{ param.risk_level.value }})

- **参数类型**: {{ param.param_type.value }}
- **默认值**: `{{ param.default_value or "无" }}`
- **位置**: 第 {{ param.line_number }} 行
- **风险原因**: {{ param.risk_reason }}
- **使用位置**: {% if param.used_in_steps %}步骤 {{ format_step_indices(param.used_in_steps) }}{% else %}未使用{% endif %}
- **描述**: {{ param.description or "无" }}

{% endfor %}

---

## 📋 所有参数详情

| 参数名 | 类型 | 默认值 | 风险等级 | 行号 | 备注 |
|--------|------|--------|----------|------|------|
{% for param in result.parameters %}
| {{ param.name }} | {{ param.param_type.value }} | `{{ param.default_value or "无" }}` | {{ param.risk_level.value }} | {{ param.line_number }} | {{ param.risk_reason or "-" }} |
{% endfor %}

---

## 🚨 危险构建步骤

{% for step in dangerous_steps %}
### 步骤 #{{ loop.index0 }} - {{ step.step_type }}

- **位置**: 第 {{ step.line_number }} 行
- **危险原因**: {{ step.danger_reason }}
- **使用参数**: {{ ', '.join(step.uses_params) or "无" }}

{% endfor %}

---

## ❌ 解析错误

{% for error in result.parse_errors %}
### {{ error.error_type }} - 第 {{ error.line_number }} 行

- **文件**: {{ error.file_path }}
- **消息**: {{ error.message }}

**原始内容**:
```xml
{{ error.raw_content }}
```

{% endfor %}

---

## 💡 审计建议

1. **高风险参数**: 请重点检查标记为 CRITICAL 和 DANGER 的参数，确认其默认值是否合理
2. **无默认值参数**: 无默认值的参数需要每次构建时人工输入，建议添加合理的默认值
3. **冗余参数**: 未被任何步骤使用的参数建议清理
4. **危险步骤**: 包含危险命令的构建步骤需要添加额外的确认机制
"""

    def __init__(self, result: JobAuditResult):
        self.result = result
        self.console = Console()

    def _to_serializable_dict(self) -> Dict[str, Any]:
        data = asdict(self.result)
        data['audit_time'] = datetime.now().isoformat()
        return data

    def generate_terminal_summary(self) -> None:
        console = self.console
        
        console.print(Panel.fit(
            f"[bold blue]Jenkins Job 参数审计报告[/bold blue]\n"
            f"Job: [yellow]{self.result.job_name}[/yellow]\n"
            f"文件: {self.result.file_path}",
            title="审计完成",
            border_style="blue"
        ))

        summary_table = Table(title="审计摘要")
        summary_table.add_column("指标", style="cyan")
        summary_table.add_column("数值", style="magenta", justify="right")
        
        summary_table.add_row("总参数数量", str(self.result.summary['total_parameters']))
        summary_table.add_row("有默认值", str(self.result.summary['parameters_with_default']))
        summary_table.add_row("无默认值", str(self.result.summary['parameters_without_default']))
        summary_table.add_row("总构建步骤", str(self.result.summary['total_build_steps']))
        summary_table.add_row("危险步骤", str(self.result.summary['dangerous_steps']))
        summary_table.add_row("解析错误", str(self.result.summary['parse_errors']))
        
        console.print(summary_table)

        risk_table = Table(title="风险分布")
        risk_table.add_column("风险等级", style="bold")
        risk_table.add_column("数量", justify="right")
        
        risk_styles = {
            'SAFE': 'green',
            'WARNING': 'yellow',
            'DANGER': 'orange',
            'CRITICAL': 'red'
        }
        
        for level, count in self.result.summary['risk_distribution'].items():
            style = risk_styles.get(level, 'white')
            risk_table.add_row(
                Text(level, style=style),
                str(count)
            )
        
        console.print(risk_table)

        high_risk_params = [
            p for p in self.result.parameters 
            if p.risk_level in [RiskLevel.CRITICAL, RiskLevel.DANGER]
        ]
        
        if high_risk_params:
            console.print("\n[bold red]⚠️ 高风险参数:[/bold red]")
            param_table = Table(show_header=True)
            param_table.add_column("参数名", style="cyan")
            param_table.add_column("风险等级", style="bold")
            param_table.add_column("默认值", style="magenta")
            param_table.add_column("行号", justify="right")
            
            for param in high_risk_params:
                style = 'red' if param.risk_level == RiskLevel.CRITICAL else 'orange'
                param_table.add_row(
                    param.name,
                    Text(param.risk_level.value, style=style),
                    param.default_value or "无",
                    str(param.line_number)
                )
            
            console.print(param_table)

        dangerous_steps = [s for s in self.result.build_steps if s.is_dangerous]
        if dangerous_steps:
            console.print("\n[bold red]🚨 危险构建步骤:[/bold red]")
            for step in dangerous_steps:
                console.print(f"  - 第 {step.line_number} 行: [yellow]{step.step_type}[/yellow]")
                console.print(f"    原因: {step.danger_reason}")
                if step.uses_params:
                    console.print(f"    使用参数: {', '.join(step.uses_params)}")

        if self.result.parse_errors:
            console.print(f"\n[bold yellow]⚠️ 解析错误 ({len(self.result.parse_errors)} 个):[/bold yellow]")
            for error in self.result.parse_errors:
                console.print(f"  - 第 {error.line_number} 行: {error.error_type} - {error.message}")

    def generate_json(self, output_path: str) -> None:
        data = self._to_serializable_dict()
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=EnhancedJSONEncoder)

    def generate_markdown(self, output_path: str) -> None:
        def format_step_indices(steps):
            return ', '.join(str(s) for s in steps)
        
        template = Template(self.MARKDOWN_TEMPLATE)
        
        high_risk_params = [
            p for p in self.result.parameters 
            if p.risk_level in [RiskLevel.CRITICAL, RiskLevel.DANGER]
        ]
        
        dangerous_steps = [s for s in self.result.build_steps if s.is_dangerous]
        
        markdown_content = template.render(
            audit_time=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            result=self.result,
            high_risk_params=high_risk_params,
            dangerous_steps=dangerous_steps,
            format_step_indices=format_step_indices
        )
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
