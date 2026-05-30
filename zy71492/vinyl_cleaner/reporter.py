import json
from datetime import datetime
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any
from .models import DatabaseState, CleaningStatus, ConflictType, SourceType
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box


console = Console()


class Reporter:
    def __init__(self, db_state: DatabaseState, output_dir: str):
        self.db = db_state
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def print_terminal_summary(self):
        console.print(Panel.fit(
            "[bold cyan]黑胶清洗养护记录 - 执行摘要[/bold cyan]",
            border_style="cyan"
        ))

        self._print_import_summary()
        self._print_status_summary()
        self._print_conflict_summary()
        self._print_source_trail_summary()

    def _print_import_summary(self):
        table = Table(title="导入统计", box=box.SIMPLE, show_header=True)
        table.add_column("数据类型", style="cyan")
        table.add_column("数量", justify="right", style="green")

        table.add_row("来源文件", str(len(self.db.sources)))
        table.add_row("顾客记录", str(len(self.db.customers)))
        table.add_row("唱片记录", str(len(self.db.vinyl_records)))
        table.add_row("清洗记录", str(len(self.db.cleaning_records)))
        table.add_row("划痕记录", str(len(self.db.scratches)))
        table.add_row("试听记录", str(len(self.db.listening_tests)))
        table.add_row("照片留痕", str(len(self.db.photos)))

        console.print(table)

    def _print_status_summary(self):
        status_counts = defaultdict(int)
        for record in self.db.vinyl_records.values():
            status_counts[record.status.value] += 1

        table = Table(title="唱片清洗状态分布", box=box.SIMPLE, show_header=True)
        table.add_column("状态", style="cyan")
        table.add_column("数量", justify="right", style="green")

        for status in CleaningStatus:
            count = status_counts.get(status.value, 0)
            table.add_row(status.value, str(count))

        console.print(table)

    def _print_conflict_summary(self):
        conflict_counts = defaultdict(int)
        for conflict in self.db.conflicts:
            conflict_counts[conflict.conflict_type.value] += 1

        unresolved = len([c for c in self.db.conflicts if not c.resolved])

        console.print(f"\n[bold yellow]⚠️  冲突检测结果[/bold yellow] - 共 {len(self.db.conflicts)} 个冲突，{unresolved} 个未解决")

        if conflict_counts:
            table = Table(box=box.SIMPLE, show_header=True)
            table.add_column("冲突类型", style="red")
            table.add_column("数量", justify="right", style="yellow")

            for ctype in ConflictType:
                count = conflict_counts.get(ctype.value, 0)
                if count > 0:
                    table.add_row(ctype.value, str(count))

            console.print(table)

    def _print_source_trail_summary(self):
        console.print(f"\n[bold blue]📋 来源溯源统计[/bold blue]")
        for source_id, source in self.db.sources.items():
            console.print(f"  [cyan]{source.file_name}[/cyan] ({source.source_type.value}) → {source_id}")

    def generate_detailed_report(self) -> str:
        report_path = self.output_dir / "detailed_report.md"
        content = []

        content.append("# 黑胶清洗养护记录 - 详细报告")
        content.append(f"生成时间: {datetime.now().isoformat()}")
        content.append("")

        content.append("## 1. 导入汇总")
        content.append(f"- 来源文件: {len(self.db.sources)} 个")
        content.append(f"- 顾客记录: {len(self.db.customers)} 条")
        content.append(f"- 唱片记录: {len(self.db.vinyl_records)} 条")
        content.append(f"- 清洗记录: {len(self.db.cleaning_records)} 条")
        content.append(f"- 划痕记录: {len(self.db.scratches)} 条")
        content.append(f"- 试听记录: {len(self.db.listening_tests)} 条")
        content.append("")

        content.append("## 2. 来源文件明细")
        content.append("| 来源ID | 文件名称 | 数据类型 | 导入时间 |")
        content.append("|--------|----------|----------|----------|")
        for sid, source in self.db.sources.items():
            content.append(f"| {sid} | {source.file_name} | {source.source_type.value} | {source.imported_at.strftime('%Y-%m-%d %H:%M')} |")
        content.append("")

        content.append("## 3. 唱片清洗状态分布")
        status_counts = defaultdict(int)
        for record in self.db.vinyl_records.values():
            status_counts[record.status.value] += 1
        for status in CleaningStatus:
            content.append(f"- **{status.value}**: {status_counts.get(status.value, 0)} 张")
        content.append("")

        content.append("## 4. 唱片清洗记录明细")
        content.append("")
        for rid, record in self.db.vinyl_records.items():
            content.append(f"### 唱片: {record.catalog_number} (`{rid}`)")
            content.append(f"- **艺术家**: {record.artist or '未知'}")
            content.append(f"- **专辑**: {record.album_title or '未知'}")
            content.append(f"- **当前状态**: {record.status.value}")
            content.append(f"- **清洗次数**: {record.total_cleanings}")
            content.append(f"- **数据来源**: {record.source_id} ({self.db.sources.get(record.source_id, {}).file_name if record.source_id in self.db.sources else '未知'})")

            if record.customer_id and record.customer_id in self.db.customers:
                customer = self.db.customers[record.customer_id]
                content.append(f"- **顾客**: {customer.name} (`{record.customer_id}`)")

            if record.cleaning_records:
                content.append(f"- **清洗记录**:")
                for cid in sorted(record.cleaning_records):
                    if cid in self.db.cleaning_records:
                        cr = self.db.cleaning_records[cid]
                        content.append(f"  - 第{cr.sequence}次清洗: {cr.status.value} (来源: {cr.source_id})")
                        content.append(f"    - 清洗机: {cr.machine or '-'}, 清洁剂: {cr.cleaning_agent or '-'}")
                        if cr.started_at:
                            content.append(f"    - 开始: {cr.started_at.strftime('%Y-%m-%d %H:%M')}")
                        if cr.completed_at:
                            content.append(f"    - 完成: {cr.completed_at.strftime('%Y-%m-%d %H:%M')}")

            if record.scratches:
                content.append(f"- **划痕记录** ({len(record.scratches)}条):")
                for sid in record.scratches:
                    if sid in self.db.scratches:
                        scratch = self.db.scratches[sid]
                        content.append(f"  - [{scratch.severity.value}] {scratch.location} - {scratch.description}")
                        content.append(f"    来源: {scratch.source_id}, 记录时间: {scratch.recorded_at.strftime('%Y-%m-%d')}")

            if record.listening_tests:
                content.append(f"- **试听记录** ({len(record.listening_tests)}条):")
                for tid in record.listening_tests:
                    if tid in self.db.listening_tests:
                        test = self.db.listening_tests[tid]
                        content.append(f"  - {test.side}面: {test.result.value} (评分: {test.overall_score:.1f}/10)")
                        content.append(f"    爆裂声: {test.crackle}, 底噪: {test.surface_noise}, 爆音: {test.pops}, 失真: {test.distortion}")
                        content.append(f"    来源: {test.source_id}, 试听时间: {test.tested_at.strftime('%Y-%m-%d')}")

            content.append("")

        content.append("## 5. 冲突检测报告")
        unresolved = [c for c in self.db.conflicts if not c.resolved]
        content.append(f"### 未解决冲突: {len(unresolved)} 个")
        content.append("")

        for conflict in unresolved:
            content.append(f"#### {conflict.conflict_type.value}")
            content.append(f"- **消息**: {conflict.message}")
            content.append(f"- **涉及来源**: {', '.join(conflict.source_ids)}")
            content.append(f"- **下一步**: {conflict.details.get('next_step', '待确认')}")
            if conflict.details:
                content.append(f"- **详细信息**:")
                for k, v in conflict.details.items():
                    if k != 'next_step':
                        content.append(f"  - {k}: {v}")
            content.append("")

        resolved = [c for c in self.db.conflicts if c.resolved]
        if resolved:
            content.append(f"### 已解决冲突: {len(resolved)} 个")
            for conflict in resolved:
                content.append(f"- {conflict.conflict_type.value}: {conflict.resolution}")

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(content))

        return str(report_path)

    def export_json_state(self) -> str:
        json_path = self.output_dir / "database_state.json"
        data = json.loads(self.db.model_dump_json(indent=2))
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return str(json_path)

    def export_source_audit_trail(self) -> str:
        audit_path = self.output_dir / "source_audit_trail.json"
        audit_data = {
            "generated_at": datetime.now().isoformat(),
            "sources": {}
        }

        for sid, source in self.db.sources.items():
            audit_data["sources"][sid] = {
                "file_name": source.file_name,
                "source_type": source.source_type.value,
                "imported_at": source.imported_at.isoformat(),
                "imported_by": source.imported_by,
                "affected_records": {
                    "vinyl_records": [rid for rid, r in self.db.vinyl_records.items() if r.source_id == sid],
                    "customers": [cid for cid, c in self.db.customers.items() if c.source_id == sid],
                    "cleaning_records": [cid for cid, c in self.db.cleaning_records.items() if c.source_id == sid],
                    "scratches": [scid for scid, s in self.db.scratches.items() if s.source_id == sid],
                    "listening_tests": [tid for tid, t in self.db.listening_tests.items() if t.source_id == sid]
                }
            }

        with open(audit_path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)

        return str(audit_path)
