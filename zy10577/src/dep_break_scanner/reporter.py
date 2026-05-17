import json
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .models import CodeReference, ErrorSample, ImpactLevel, ScanResult, ReferenceType


class ReportGenerator:
    def __init__(self, result: ScanResult, output_dir: Path):
        self.result = result
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.console = Console()

    def _get_output_filename(self, suffix: str, extension: str) -> str:
        timestamp = self.result.scan_timestamp.replace(":", "-").replace(".", "-")
        safe_dep = self.result.dependency_name.replace("/", "_").replace("\\", "_")
        suffix_part = f"_{suffix}" if suffix else ""
        return f"{safe_dep}_{self.result.old_version}_to_{self.result.new_version}_{timestamp}{suffix_part}.{extension}"

    def generate_all(self) -> Dict[str, Path]:
        output_files = {}

        output_files["terminal"] = self.print_terminal_summary()
        output_files["json"] = self.generate_json_report()
        output_files["markdown"] = self.generate_markdown_report()
        if self.result.error_samples:
            output_files["errors"] = self.generate_error_samples()

        return output_files

    def print_terminal_summary(self) -> None:
        self.console.print()

        title = Text("依赖升级破坏面分析报告", style="bold blue")
        self.console.print(Panel(title, expand=False))

        self.console.print("\n[bold]依赖名称:[/bold] %s" % self.result.dependency_name)
        self.console.print("[bold]版本升级:[/bold] %s → %s" % (self.result.old_version, self.result.new_version))
        self.console.print("[bold]扫描时间:[/bold] %s" % self.result.scan_timestamp)
        self.console.print("[bold]扫描文件数:[/bold] %d" % self.result.total_files_scanned)
        self.console.print("[bold]发现引用数:[/bold] %d" % self.result.total_references)
        self.console.print("[bold]相关测试文件:[/bold] %d" % len(self.result.test_files))

        self.console.print("\n[bold underline]影响分组统计:[/bold underline]")
        impact_table = Table(show_header=True, header_style="bold magenta")
        impact_table.add_column("影响级别", style="dim")
        impact_table.add_column("文件数", justify="right")
        impact_table.add_column("引用数", justify="right")
        impact_table.add_column("测试文件", justify="right")

        level_colors = {
            ImpactLevel.CRITICAL: "red",
            ImpactLevel.HIGH: "yellow",
            ImpactLevel.MEDIUM: "blue",
            ImpactLevel.LOW: "green",
        }

        for group in self.result.impact_groups:
            color = level_colors.get(group.impact_level, "white")
            impact_table.add_row(
                f"[{color}]{group.impact_level.value.upper()}[/{color}]",
                str(len(group.affected_files)),
                str(len(group.references)),
                str(len(group.test_files)),
            )

        self.console.print(impact_table)

        self.console.print("\n[bold underline]测试建议:[/bold underline]")
        for suggestion in self.result.test_suggestions:
            priority_color = "red" if suggestion.priority == "P0" else "yellow" if suggestion.priority == "P1" else "blue"
            style_start = f"[{priority_color}][bold]"
            style_end = f"[/bold][/{priority_color}]"
            self.console.print(f"\n  {style_start}{suggestion.priority}{style_end} {suggestion.description}")
            self.console.print(f"    涉及测试文件: {len(suggestion.test_files)} 个")
            self.console.print(f"    行动项:")
            for i, action in enumerate(suggestion.action_items, 1):
                self.console.print(f"      {i}. {action}")

        if self.result.error_samples:
            self.console.print("\n[bold red]⚠️  异常样本:[/bold red] %d 个" % len(self.result.error_samples))
            self.console.print("  详情请查看错误报告文件")

        self.console.print()

    def _serialize_model(self, obj: Any) -> Any:
        if hasattr(obj, "__dataclass_fields__"):
            result = {}
            for field_name in obj.__dataclass_fields__:
                value = getattr(obj, field_name)
                result[field_name] = self._serialize_model(value)
            return result
        elif isinstance(obj, list):
            return [self._serialize_model(item) for item in obj]
        elif isinstance(obj, ImpactLevel):
            return obj.value
        elif isinstance(obj, ReferenceType):
            return obj.value
        else:
            return obj

    def generate_json_report(self) -> Path:
        filename = self._get_output_filename("", "json")
        filepath = self.output_dir / filename

        result_dict = self._serialize_model(self.result)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(result_dict, f, ensure_ascii=False, indent=2)

        return filepath

    def generate_markdown_report(self) -> Path:
        filename = self._get_output_filename("report", "md")
        filepath = self.output_dir / filename

        content = []
        content.append(f"# 依赖升级破坏面分析报告\n")
        content.append(f"**依赖名称**: {self.result.dependency_name}  \n")
        content.append(f"**版本升级**: `{self.result.old_version}` → `{self.result.new_version}`  \n")
        content.append(f"**扫描时间**: {self.result.scan_timestamp}  \n")
        content.append(f"**扫描文件数**: {self.result.total_files_scanned}  \n")
        content.append(f"**发现引用数**: {self.result.total_references}  \n")
        content.append(f"**相关测试文件**: {len(self.result.test_files)}  \n")

        content.append("\n## 影响分组详情\n")

        for group in self.result.impact_groups:
            level_emoji = {
                ImpactLevel.CRITICAL: "🔴",
                ImpactLevel.HIGH: "🟡",
                ImpactLevel.MEDIUM: "🔵",
                ImpactLevel.LOW: "🟢",
            }.get(group.impact_level, "⚪")

            content.append(f"\n### {level_emoji} {group.impact_level.value.upper()}: {group.description}\n")
            content.append(f"- **受影响文件数**: {len(group.affected_files)}\n")
            content.append(f"- **引用数**: {len(group.references)}\n")
            content.append(f"- **相关测试文件**: {len(group.test_files)}\n")

            if group.affected_files:
                content.append(f"\n#### 受影响文件列表:\n")
                for f in sorted(group.affected_files):
                    content.append(f"- `{f}`\n")

            if group.references:
                content.append(f"\n#### 引用详情:\n")
                for ref in group.references[:10]:
                    content.append(f"- `{ref.file_path}:{ref.line_number}`\n")
                    content.append(f"  ```python\n  {ref.code_snippet}\n  ```\n")
                if len(group.references) > 10:
                    content.append(f"\n  ... 还有 {len(group.references) - 10} 个引用未显示\n")

        content.append("\n## 测试建议\n")
        for suggestion in self.result.test_suggestions:
            priority_label = {
                "P0": "🔴 P0 - 紧急",
                "P1": "🟡 P1 - 高",
                "P2": "🔵 P2 - 中",
                "P3": "🟢 P3 - 低",
            }.get(suggestion.priority, suggestion.priority)

            content.append(f"\n### {priority_label}: {suggestion.description}\n")
            content.append(f"\n**行动项:**\n")
            for i, action in enumerate(suggestion.action_items, 1):
                content.append(f"{i}. {action}\n")

            if suggestion.test_files:
                content.append(f"\n**涉及测试文件 ({len(suggestion.test_files)}):**\n")
                for tf in suggestion.test_files[:5]:
                    content.append(f"- `{tf}`\n")
                if len(suggestion.test_files) > 5:
                    content.append(f"- ... 还有 {len(suggestion.test_files) - 5} 个测试文件\n")

        if self.result.error_samples:
            content.append("\n## ⚠️ 异常样本\n")
            content.append(f"共发现 {len(self.result.error_samples)} 个异常:\n\n")
            for err in self.result.error_samples[:5]:
                content.append(f"### {err.error_type}\n")
                content.append(f"- **文件**: `{err.file_path}`\n")
                if err.line_number > 0:
                    content.append(f"- **行号**: {err.line_number}\n")
                content.append(f"- **错误信息**: {err.error_message}\n")
                if err.raw_content:
                    content.append(f"  ```\n  {err.raw_content}\n  ```\n")
            if len(self.result.error_samples) > 5:
                content.append(f"\n... 还有 {len(self.result.error_samples) - 5} 个异常未显示\n")

        content.append("\n---\n")
        content.append(f"*报告由 dep-break-scanner 自动生成于 {self.result.scan_timestamp}*\n")

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("".join(content))

        return filepath

    def generate_error_samples(self) -> Path:
        filename = self._get_output_filename("errors", "json")
        filepath = self.output_dir / filename

        errors_data = {
            "dependency_name": self.result.dependency_name,
            "old_version": self.result.old_version,
            "new_version": self.result.new_version,
            "timestamp": self.result.scan_timestamp,
            "total_errors": len(self.result.error_samples),
            "errors": [
                {
                    "file_path": err.file_path,
                    "line_number": err.line_number,
                    "column": getattr(err, "column", 0),
                    "error_type": err.error_type,
                    "error_message": err.error_message,
                    "raw_content": err.raw_content,
                    "context": err.context,
                }
                for err in self.result.error_samples
            ],
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(errors_data, f, ensure_ascii=False, indent=2)

        return filepath

    def get_output_files_list(self) -> List[str]:
        return list(self.output_dir.glob("*.*"))
