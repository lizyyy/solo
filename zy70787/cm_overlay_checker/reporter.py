import json
from typing import Dict, Any
from dataclasses import asdict
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich.panel import Panel
from .models import AnalysisReport, ConfigMapResult, CoverageItem


class Reporter:
    def __init__(self, report: AnalysisReport):
        self.report = report
        self.console = Console()

    def generate_human_readable(self) -> str:
        output = []
        output.append("=" * 80)
        output.append("ConfigMap Overlay Coverage Report")
        output.append("=" * 80)
        output.append("")

        output.append(f"Base Directory: {self.report.base_dir}")
        output.append(f"Layers Analyzed: {', '.join(self.report.layers)}")
        output.append(f"Total Overrides: {self.report.total_overrides_count}")
        output.append(f"Total Conflicts: {self.report.total_conflicts_count}")
        output.append("")

        if self.report.errors:
            output.append("ERRORS:")
            for err in self.report.errors:
                output.append(f"  ✗ {err}")
            output.append("")

        if self.report.warnings:
            output.append("WARNINGS:")
            for warn in self.report.warnings:
                output.append(f"  ⚠ {warn}")
            output.append("")

        output.append("-" * 80)
        output.append("CONFIGMAP DETAILS")
        output.append("-" * 80)
        output.append("")

        for cm in self.report.configmaps:
            output.extend(self._format_configmap(cm))

        output.append("")
        output.append("=" * 80)
        output.append("END OF REPORT")
        output.append("=" * 80)

        return "\n".join(output)

    def _format_configmap(self, cm: ConfigMapResult) -> list:
        output = []
        output.append(f"ConfigMap: {cm.namespace}/{cm.name}")
        output.append("")

        if cm.conflicts:
            output.append("  CONFLICTS:")
            for conflict in cm.conflicts:
                output.append(f"    ⚠ {conflict}")
            output.append("")

        output.append("  Final Values with Coverage Chain:")
        output.append("")

        for key in sorted(cm.final_data.keys()):
            chain = cm.coverage_chain.get(key, [])
            output.append(f"  {key}:")
            output.append(f"    Final Value: {repr(cm.final_data[key])}")
            output.append(f"    Coverage Chain ({len(chain)} layers):")

            for idx, item in enumerate(chain):
                prefix = "    →" if idx == len(chain) - 1 else "    │"
                override_mark = " [OVERRIDE]" if item.is_override else ""
                output.append(f"{prefix} [{item.source_layer}] = {repr(item.value)}{override_mark}")
                if item.is_override and item.previous_value is not None:
                    output.append(f"    │     (overrode {repr(item.previous_value)} from {item.previous_layer})")

            output.append("")

        return output

    def generate_machine_readable(self, pretty: bool = True) -> str:
        report_dict = self._report_to_dict(self.report)
        indent = 2 if pretty else None
        return json.dumps(report_dict, indent=indent, ensure_ascii=False)

    def _report_to_dict(self, report: AnalysisReport) -> Dict[str, Any]:
        return {
            "metadata": {
                "base_dir": report.base_dir,
                "layers": report.layers,
                "generated_at": "TODO",
                "version": "0.1.0"
            },
            "summary": {
                "total_configmaps": len(report.configmaps),
                "total_overrides": report.total_overrides_count,
                "total_conflicts": report.total_conflicts_count,
                "total_errors": len(report.errors),
                "total_warnings": len(report.warnings)
            },
            "errors": report.errors,
            "warnings": report.warnings,
            "configmaps": [
                self._configmap_to_dict(cm)
                for cm in report.configmaps
            ]
        }

    def _configmap_to_dict(self, cm: ConfigMapResult) -> Dict[str, Any]:
        return {
            "name": cm.name,
            "namespace": cm.namespace,
            "final_data": cm.final_data,
            "conflicts": cm.conflicts,
            "coverage_chain": {
                key: [
                    {
                        "key": item.key,
                        "value": item.value,
                        "source_layer": item.source_layer,
                        "source_file": item.source_file,
                        "is_override": item.is_override,
                        "previous_value": item.previous_value,
                        "previous_layer": item.previous_layer
                    }
                    for item in chain
                ]
                for key, chain in cm.coverage_chain.items()
            }
        }

    def print_rich(self):
        self.console.print(Panel.fit(
            "[bold blue]ConfigMap Overlay Coverage Report[/bold blue]",
            border_style="blue"
        ))

        self.console.print(f"[dim]Base:[/dim] {self.report.base_dir}")
        self.console.print(f"[dim]Layers:[/dim] {', '.join(self.report.layers)}")
        self.console.print("")

        if self.report.errors:
            self.console.print("[bold red]Errors:[/bold red]")
            for err in self.report.errors:
                self.console.print(f"  [red]✗[/red] {err}")
            self.console.print("")

        if self.report.warnings:
            self.console.print("[bold yellow]Warnings:[/bold yellow]")
            for warn in self.report.warnings:
                self.console.print(f"  [yellow]⚠[/yellow] {warn}")
            self.console.print("")

        summary_table = Table(title="Summary")
        summary_table.add_column("Metric", style="cyan")
        summary_table.add_column("Count", style="magenta")
        summary_table.add_row("ConfigMaps", str(len(self.report.configmaps)))
        summary_table.add_row("Total Overrides", str(self.report.total_overrides_count))
        summary_table.add_row("Total Conflicts", str(self.report.total_conflicts_count))
        self.console.print(summary_table)
        self.console.print("")

        for cm in self.report.configmaps:
            self._print_configmap_rich(cm)

    def _print_configmap_rich(self, cm: ConfigMapResult):
        cm_title = f"ConfigMap: [bold]{cm.namespace}[/bold]/[bold]{cm.name}[/bold]"
        tree = Tree(cm_title)

        if cm.conflicts:
            conflict_node = tree.add("[yellow]Conflicts[/yellow]")
            for conflict in cm.conflicts:
                conflict_node.add(f"[yellow]⚠[/yellow] {conflict}")

        values_node = tree.add("[green]Final Values with Coverage Chain[/green]")

        for key in sorted(cm.final_data.keys()):
            key_node = values_node.add(f"[cyan]{key}[/cyan] = [magenta]{repr(cm.final_data[key])}[/magenta]")
            chain = cm.coverage_chain.get(key, [])

            for idx, item in enumerate(chain):
                is_last = idx == len(chain) - 1
                prefix = "→ " if is_last else "│ "
                style = "green" if is_last else "dim"
                override_mark = " [red][OVERRIDE][/red]" if item.is_override else ""
                chain_item = f"{prefix}[{style}]{item.source_layer}[/{style}] = {repr(item.value)}{override_mark}"
                key_node.add(chain_item)

                if item.is_override and item.previous_value is not None:
                    key_node.add(f"  │     [dim](overrode {repr(item.previous_value)} from {item.previous_layer})[/dim]")

        self.console.print(tree)
        self.console.print("")
