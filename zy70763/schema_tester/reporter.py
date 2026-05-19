import json
import os
from typing import List, Dict, Any
from datetime import datetime

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .generator import Sample, SampleType


class Reporter:
    def __init__(self, samples: List[Sample], output_dir: str, schema_name: str):
        self.samples = samples
        self.output_dir = output_dir
        self.schema_name = schema_name
        self.console = Console()

    def generate_all(self) -> None:
        os.makedirs(self.output_dir, exist_ok=True)

        self._write_sample_files()
        self._write_index_json()
        self._write_human_report()

    def _write_sample_files(self) -> None:
        type_dirs = {
            SampleType.VALID: os.path.join(self.output_dir, "valid"),
            SampleType.BOUNDARY: os.path.join(self.output_dir, "boundary"),
            SampleType.INVALID: os.path.join(self.output_dir, "invalid"),
            SampleType.EDGE_CASE: os.path.join(self.output_dir, "edge_case"),
        }

        for dir_path in type_dirs.values():
            os.makedirs(dir_path, exist_ok=True)

        for sample in self.samples:
            file_path = os.path.join(type_dirs[sample.type], f"{sample.id}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(sample.data, f, indent=2, ensure_ascii=False)

    def _write_index_json(self) -> None:
        index = {
            "schema": self.schema_name,
            "generated_at": datetime.now().isoformat(),
            "total_samples": len(self.samples),
            "samples_by_type": {
                "valid": len([s for s in self.samples if s.type == SampleType.VALID]),
                "boundary": len([s for s in self.samples if s.type == SampleType.BOUNDARY]),
                "invalid": len([s for s in self.samples if s.type == SampleType.INVALID]),
                "edge_case": len([s for s in self.samples if s.type == SampleType.EDGE_CASE]),
            },
            "samples": [sample.to_dict() for sample in self.samples]
        }

        index_path = os.path.join(self.output_dir, "index.json")
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2, ensure_ascii=False)

    def _write_human_report(self) -> None:
        report_lines = []
        report_lines.append("=" * 80)
        report_lines.append(f"JSON Schema 测试样本报告 - {self.schema_name}")
        report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("=" * 80)
        report_lines.append("")

        report_lines.append("📊 统计汇总")
        report_lines.append("-" * 40)
        report_lines.append(f"  总样本数: {len(self.samples)}")
        report_lines.append(f"  正常样本 (valid): {len([s for s in self.samples if s.type == SampleType.VALID])}")
        report_lines.append(f"  边界样本 (boundary): {len([s for s in self.samples if s.type == SampleType.BOUNDARY])}")
        report_lines.append(f"  非法样本 (invalid): {len([s for s in self.samples if s.type == SampleType.INVALID])}")
        report_lines.append(f"  边缘案例 (edge_case): {len([s for s in self.samples if s.type == SampleType.EDGE_CASE])}")
        report_lines.append("")

        report_lines.append("📁 目录结构")
        report_lines.append("-" * 40)
        report_lines.append("  valid/      - 正常输入样本")
        report_lines.append("  boundary/   - 边界条件样本")
        report_lines.append("  invalid/    - 非法输入样本（脏数据）")
        report_lines.append("  edge_case/  - 边缘案例（空值、冲突等）")
        report_lines.append("  index.json  - 机器可读索引文件")
        report_lines.append("  report.txt  - 本报告文件")
        report_lines.append("")

        report_lines.append("🔍 样本索引")
        report_lines.append("-" * 80)

        for i, sample in enumerate(self.samples, 1):
            type_markers = {
                SampleType.VALID: "✅",
                SampleType.BOUNDARY: "⚠️",
                SampleType.INVALID: "❌",
                SampleType.EDGE_CASE: "🔲",
            }
            marker = type_markers[sample.type]
            report_lines.append(f"{i:3d}. {marker} [{sample.type.value:8s}] {sample.id}")
            if sample.field:
                report_lines.append(f"     字段: {sample.field}")
            if sample.reason:
                report_lines.append(f"     说明: {sample.reason}")
            report_lines.append(f"     文件: {sample.type.value}/{sample.id}.json")
            report_lines.append("")

        report_path = os.path.join(self.output_dir, "report.txt")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("\n".join(report_lines))

    def print_summary(self) -> None:
        console = Console()

        title = Text("JSON Schema 边界样本排查 CLI", style="bold blue")
        console.print(Panel(title))

        table = Table(title="样本生成统计")
        table.add_column("类型", style="cyan")
        table.add_column("数量", justify="right", style="magenta")
        table.add_column("说明", style="green")

        type_info = [
            ("valid", "✅", SampleType.VALID, "正常输入样本"),
            ("boundary", "⚠️", SampleType.BOUNDARY, "边界条件（极值）"),
            ("invalid", "❌", SampleType.INVALID, "非法输入（脏数据）"),
            ("edge_case", "🔲", SampleType.EDGE_CASE, "边缘案例（空值等）"),
        ]

        for name, icon, enum_val, desc in type_info:
            count = len([s for s in self.samples if s.type == enum_val])
            table.add_row(f"{icon} {name}", str(count), desc)

        console.print(table)

        console.print(f"\n📂 输出目录: [bold]{self.output_dir}[/bold]")
        console.print(f"📋 查看报告: {self.output_dir}/report.txt")
        console.print(f"🔧 索引导出: {self.output_dir}/index.json")
