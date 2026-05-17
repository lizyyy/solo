import json
from datetime import datetime
from typing import Optional
from jinja2 import Template
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from .models import ValidationResult, ErrorType


class Reporter:
    def __init__(self, result: ValidationResult):
        self.result = result
        self.console = Console()

    def print_terminal_summary(self):
        status = "✅ 通过" if self.result.is_valid else "❌ 失败"
        title = Text(f"TOML 配置校验报告 - {status}", style="bold")
        self.console.print(Panel(title))

        self.console.print(f"📄 文件: {self.result.file_path}")
        self.console.print(f"📅 校验时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.console.print()

        if self.result.errors:
            error_table = Table(title=f"错误 ({len(self.result.errors)})", show_lines=True)
            error_table.add_column("序号", style="dim", width=4)
            error_table.add_column("错误类型", style="red", width=15)
            error_table.add_column("字段路径", style="yellow")
            error_table.add_column("位置", style="cyan", width=10)
            error_table.add_column("消息", style="white")

            for idx, error in enumerate(self.result.errors, 1):
                location = f"L{error.line}" if error.line else "-"
                error_table.add_row(
                    str(idx),
                    error.error_type.value,
                    error.field_path or "(全局)",
                    location,
                    error.message
                )

            self.console.print(error_table)
            self.console.print()

        if self.result.defaults_applied:
            defaults_table = Table(title="默认值补全", show_lines=True)
            defaults_table.add_column("字段路径", style="green")
            defaults_table.add_column("默认值", style="blue")

            for path, value in self.result.defaults_applied.items():
                defaults_table.add_row(path, str(value))

            self.console.print(defaults_table)
            self.console.print()

        summary = Text()
        summary.append(f"总计: {len(self.result.errors)} 个错误")
        if self.result.defaults_applied:
            summary.append(f", {len(self.result.defaults_applied)} 个默认值已补全")
        self.console.print(summary)

    def to_json(self, pretty: bool = True) -> str:
        indent = 2 if pretty else None
        return json.dumps(self.result.model_dump(), indent=indent, ensure_ascii=False)

    def to_markdown(self, title: Optional[str] = None) -> str:
        template_str = """
# {{ title or "TOML 配置校验报告" }}

## 基本信息

| 项目 | 内容 |
|------|------|
| 文件路径 | `{{ result.file_path }}` |
| 校验时间 | {{ now }} |
| 校验结果 | {% if result.is_valid %}✅ 通过{% else %}❌ 失败{% endif %} |
| 错误数量 | {{ result.errors|length }} |
| 默认值补全 | {{ result.defaults_applied|length }} 项 |

## 错误详情

{% if result.errors %}

| 序号 | 错误类型 | 字段路径 | 行号 | 消息 |
|------|----------|----------|------|------|
{% for error in result.errors %}
| {{ loop.index }} | `{{ error.error_type.value }}` | `{{ error.field_path }}` | {{ error.line or "-" }} | {{ error.message }} |
{% endfor %}

{% else %}

✅ 没有发现错误

{% endif %}

{% if result.defaults_applied %}

## 默认值补全

| 字段路径 | 补全的值 |
|----------|----------|
{% for path, value in result.defaults_applied.items() %}
| `{{ path }}` | `{{ value }}` |
{% endfor %}

{% endif %}

---
*此报告由 TOML 配置校验工具自动生成*
        """
        template = Template(template_str.strip())
        return template.render(
            result=self.result,
            now=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            title=title
        )

    def save_json(self, output_path: str):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(self.to_json())

    def save_markdown(self, output_path: str, title: Optional[str] = None):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(self.to_markdown(title))
