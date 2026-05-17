import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich.text import Text
from .models import TopologyData, ValidationResult
from .diagram import DiagramGenerator


class Reporter:
    def __init__(self, topology: TopologyData, validation_result: ValidationResult,
                 output_dir: Path, report_name: str):
        self.topology = topology
        self.validation_result = validation_result
        self.output_dir = output_dir
        self.report_name = report_name
        self.console = Console()

    def print_console_summary(self):
        self._print_header()
        self._print_statistics()
        self._print_validation_results()
        self._print_parse_errors()

    def _print_header(self):
        self.console.print(Panel.fit(
            "[bold blue]🐇 RabbitMQ 拓扑分析报告[/bold blue]",
            subtitle=f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ))

    def _print_statistics(self):
        table = Table(title="拓扑统计", show_header=True, header_style="bold magenta")
        table.add_column("项目", style="dim")
        table.add_column("数量", justify="right")
        
        table.add_row("Exchanges", str(len(self.topology.exchanges)))
        table.add_row("Queues", str(len(self.topology.queues)))
        table.add_row("Bindings", str(len(self.topology.bindings)))
        table.add_row("Policies", str(len(self.topology.policies)))
        
        self.console.print(table)

    def _print_validation_results(self):
        if not self.validation_result:
            return

        self.console.print("\n[bold yellow]🔍 验证结果[/bold yellow]")
        
        if self.validation_result.orphan_queues:
            self.console.print(f"  [red]⚠️  孤立Queue ({len(self.validation_result.orphan_queues)}个):[/red]")
            for q in self.validation_result.orphan_queues[:5]:
                self.console.print(f"      - {q}")
            if len(self.validation_result.orphan_queues) > 5:
                self.console.print(f"      ... 还有 {len(self.validation_result.orphan_queues) - 5} 个")
        
        if self.validation_result.orphan_exchanges:
            self.console.print(f"  [red]⚠️  孤立Exchange ({len(self.validation_result.orphan_exchanges)}个):[/red]")
            for ex in self.validation_result.orphan_exchanges[:5]:
                self.console.print(f"      - {ex}")
            if len(self.validation_result.orphan_exchanges) > 5:
                self.console.print(f"      ... 还有 {len(self.validation_result.orphan_exchanges) - 5} 个")
        
        if self.validation_result.invalid_bindings:
            self.console.print(f"  [red]❌ 无效Binding ({len(self.validation_result.invalid_bindings)}个):[/red]")
            for b in self.validation_result.invalid_bindings[:5]:
                self.console.print(f"      - {b['message']}")
            if len(self.validation_result.invalid_bindings) > 5:
                self.console.print(f"      ... 还有 {len(self.validation_result.invalid_bindings) - 5} 个")
        
        if self.validation_result.duplicate_bindings:
            self.console.print(f"  [yellow]⚠️  重复Binding ({len(self.validation_result.duplicate_bindings)}个):[/yellow]")
            for b in self.validation_result.duplicate_bindings[:5]:
                self.console.print(f"      - {b['source']} -> {b['destination']} (重复{b['count']}次)")
            if len(self.validation_result.duplicate_bindings) > 5:
                self.console.print(f"      ... 还有 {len(self.validation_result.duplicate_bindings) - 5} 个")
        
        if self.validation_result.warnings:
            self.console.print(f"  [yellow]⚠️  警告 ({len(self.validation_result.warnings)}个):[/yellow]")
            for w in self.validation_result.warnings[:5]:
                self.console.print(f"      - {w}")
            if len(self.validation_result.warnings) > 5:
                self.console.print(f"      ... 还有 {len(self.validation_result.warnings) - 5} 个")
        
        if not any([
            self.validation_result.orphan_queues,
            self.validation_result.orphan_exchanges,
            self.validation_result.invalid_bindings,
            self.validation_result.duplicate_bindings,
            self.validation_result.warnings
        ]):
            self.console.print("  [green]✅ 拓扑验证通过，无异常[/green]")

    def _print_parse_errors(self):
        if self.topology.errors:
            self.console.print(f"\n[bold red]❌ 解析错误 ({len(self.topology.errors)}个):[/bold red]")
            for err in self.topology.errors[:10]:
                line_info = f" [第{err.line_number}行]" if err.line_number else ""
                self.console.print(f"  [red]- [{err.error_type}]{line_info}: {err.message}[/red]")
                if err.raw_data:
                    self.console.print(f"    [dim]原始数据: {err.raw_data[:100]}...[/dim]" if len(err.raw_data) > 100 else f"    [dim]原始数据: {err.raw_data}[/dim]")
            if len(self.topology.errors) > 10:
                self.console.print(f"    ... 还有 {len(self.topology.errors) - 10} 个错误，详见完整报告")

    def print_validation_only(self):
        self._print_validation_results()
        self._print_parse_errors()

    def print_list(self, item_type: str, vhost_filter: str = None):
        if item_type in ['exchanges', 'all']:
            self._print_exchange_list(vhost_filter)
        
        if item_type in ['queues', 'all']:
            self._print_queue_list(vhost_filter)
        
        if item_type in ['bindings', 'all']:
            self._print_binding_list(vhost_filter)

    def _print_exchange_list(self, vhost_filter: str = None):
        exchanges = self.topology.exchanges
        if vhost_filter:
            exchanges = [ex for ex in exchanges if ex.vhost == vhost_filter]
        
        table = Table(title=f"Exchanges ({len(exchanges)}个)", show_header=True, header_style="bold magenta")
        table.add_column("Vhost")
        table.add_column("Name")
        table.add_column("Type")
        table.add_column("Durable")
        
        for ex in exchanges:
            table.add_row(ex.vhost, ex.name, ex.type.value, "✓" if ex.durable else "✗")
        
        self.console.print(table)

    def _print_queue_list(self, vhost_filter: str = None):
        queues = self.topology.queues
        if vhost_filter:
            queues = [q for q in queues if q.vhost == vhost_filter]
        
        table = Table(title=f"Queues ({len(queues)}个)", show_header=True, header_style="bold magenta")
        table.add_column("Vhost")
        table.add_column("Name")
        table.add_column("Durable")
        table.add_column("Exclusive")
        
        for q in queues:
            table.add_row(
                q.vhost, q.name, 
                "✓" if q.durable else "✗",
                "✓" if q.exclusive else "✗"
            )
        
        self.console.print(table)

    def _print_binding_list(self, vhost_filter: str = None):
        bindings = self.topology.bindings
        if vhost_filter:
            bindings = [b for b in bindings if b.vhost == vhost_filter]
        
        table = Table(title=f"Bindings ({len(bindings)}个)", show_header=True, header_style="bold magenta")
        table.add_column("Vhost")
        table.add_column("Source")
        table.add_column("->")
        table.add_column("Destination")
        table.add_column("Routing Key")
        
        for b in bindings:
            table.add_row(
                b.vhost, b.source, "→", b.destination,
                b.routing_key or "(fanout)"
            )
        
        self.console.print(table)

    def generate_machine_readable(self) -> str:
        result: Dict[str, Any] = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "report_name": self.report_name
            },
            "topology": {
                "exchanges_count": len(self.topology.exchanges),
                "queues_count": len(self.topology.queues),
                "bindings_count": len(self.topology.bindings),
                "policies_count": len(self.topology.policies),
                "exchanges": [ex.model_dump() for ex in self.topology.exchanges],
                "queues": [q.model_dump() for q in self.topology.queues],
                "bindings": [b.model_dump() for b in self.topology.bindings],
                "policies": [p.model_dump() for p in self.topology.policies]
            },
            "validation": self.validation_result.model_dump() if self.validation_result else {},
            "parse_errors": [err.model_dump() for err in self.topology.errors]
        }
        return json.dumps(result, ensure_ascii=False, indent=2)

    def generate_all_reports(self) -> Dict[str, Path]:
        paths = {}
        
        paths["json"] = self._generate_json_report()
        paths["markdown"] = self._generate_markdown_report()
        paths["diagram"] = self._generate_diagram()
        
        return paths

    def _generate_json_report(self) -> Path:
        path = self.output_dir / f"{self.report_name}.json"
        content = self.generate_machine_readable()
        path.write_text(content, encoding='utf-8')
        return path

    def _generate_markdown_report(self) -> Path:
        path = self.output_dir / f"{self.report_name}.md"
        
        content = [f"# RabbitMQ 拓扑分析报告 - {self.report_name}"]
        content.append(f"\n**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        content.append("\n## 📊 拓扑统计")
        content.append(f"\n| 项目 | 数量 |")
        content.append(f"|------|------|")
        content.append(f"| Exchanges | {len(self.topology.exchanges)} |")
        content.append(f"| Queues | {len(self.topology.queues)} |")
        content.append(f"| Bindings | {len(self.topology.bindings)} |")
        content.append(f"| Policies | {len(self.topology.policies)} |")
        
        if self.validation_result:
            content.append("\n## 🔍 验证结果")
            
            if self.validation_result.orphan_queues:
                content.append(f"\n### ⚠️  孤立Queue ({len(self.validation_result.orphan_queues)}个)")
                for q in self.validation_result.orphan_queues:
                    content.append(f"- {q}")
            
            if self.validation_result.orphan_exchanges:
                content.append(f"\n### ⚠️  孤立Exchange ({len(self.validation_result.orphan_exchanges)}个)")
                for ex in self.validation_result.orphan_exchanges:
                    content.append(f"- {ex}")
            
            if self.validation_result.invalid_bindings:
                content.append(f"\n### ❌ 无效Binding ({len(self.validation_result.invalid_bindings)}个)")
                for b in self.validation_result.invalid_bindings:
                    content.append(f"- {b['message']}")
            
            if self.validation_result.duplicate_bindings:
                content.append(f"\n### ⚠️  重复Binding ({len(self.validation_result.duplicate_bindings)}个)")
                for b in self.validation_result.duplicate_bindings:
                    content.append(f"- {b['source']} -> {b['destination']} (重复{b['count']}次)")
            
            if self.validation_result.warnings:
                content.append(f"\n### ⚠️  警告 ({len(self.validation_result.warnings)}个)")
                for w in self.validation_result.warnings:
                    content.append(f"- {w}")
        
        if self.topology.errors:
            content.append(f"\n## ❌ 解析错误 ({len(self.topology.errors)}个)")
            for err in self.topology.errors:
                line_info = f" [第{err.line_number}行]" if err.line_number else ""
                content.append(f"\n### [{err.error_type}]{line_info}")
                content.append(f"- 消息: {err.message}")
                if err.raw_data:
                    content.append(f"- 原始数据: `{err.raw_data}`")
        
        content.append("\n## 📋 详细列表")
        
        if self.topology.exchanges:
            content.append("\n### Exchanges")
            content.append("\n| Vhost | Name | Type | Durable |")
            content.append("|-------|------|------|---------|")
            for ex in self.topology.exchanges:
                content.append(f"| {ex.vhost} | {ex.name} | {ex.type.value} | {'✓' if ex.durable else '✗'} |")
        
        if self.topology.queues:
            content.append("\n### Queues")
            content.append("\n| Vhost | Name | Durable | Exclusive |")
            content.append("|-------|------|---------|-----------|")
            for q in self.topology.queues:
                content.append(f"| {q.vhost} | {q.name} | {'✓' if q.durable else '✗'} | {'✓' if q.exclusive else '✗'} |")
        
        if self.topology.bindings:
            content.append("\n### Bindings")
            content.append("\n| Vhost | Source | Destination | Routing Key |")
            content.append("|-------|--------|-------------|-------------|")
            for b in self.topology.bindings:
                content.append(f"| {b.vhost} | {b.source} | {b.destination} | {b.routing_key or '(fanout)'} |")
        
        if self.topology.policies:
            content.append("\n### Policies")
            content.append("\n| Vhost | Name | Pattern | Apply To |")
            content.append("|-------|------|---------|----------|")
            for p in self.topology.policies:
                content.append(f"| {p.vhost} | {p.name} | {p.pattern} | {p.apply_to} |")
        
        path.write_text('\n'.join(content), encoding='utf-8')
        return path

    def _generate_diagram(self) -> Path:
        diagram_gen = DiagramGenerator(self.topology)
        path = self.output_dir / f"{self.report_name}_diagram.mmd"
        path.write_text(diagram_gen.generate_mermaid(), encoding='utf-8')
        return path
