import json
import yaml
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich.panel import Panel
from rich.syntax import Syntax
from rich.text import Text
from .differ import EnvironmentDiff, ResourceDiff
from .renderer import RenderResult
from .masker import MaskedItem
import logging

logger = logging.getLogger(__name__)


class ReportGenerator:
    def __init__(self, output_dir: str = "helm-diff-reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.console = Console()

    def generate_terminal_summary(
        self,
        env_diff: EnvironmentDiff,
        masked_items: Optional[List[MaskedItem]] = None
    ) -> None:
        self.console.print("\n")
        self.console.print(Panel.fit(
            f"[bold blue]Helm Template Diff Report[/bold blue]\n"
            f"[dim]Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/dim]",
            title="📊 Overview"
        ))

        self._print_summary_table(env_diff)
        self._print_changes_by_kind(env_diff)
        
        if env_diff.summary.get("has_changes", False):
            self._print_changed_resources(env_diff)
        
        if masked_items:
            self._print_masked_summary(masked_items)
        
        self._print_errors(env_diff)
        
        self.console.print("\n")

    def _print_summary_table(self, env_diff: EnvironmentDiff) -> None:
        table = Table(title=f"Comparison: {env_diff.left_env} ↔ {env_diff.right_env}")
        table.add_column("Metric", style="cyan")
        table.add_column(env_diff.left_env, style="magenta")
        table.add_column(env_diff.right_env, style="green")
        table.add_column("Diff", style="yellow")

        summary = env_diff.summary
        left_total = summary["total_resources"][env_diff.left_env]
        right_total = summary["total_resources"][env_diff.right_env]
        
        table.add_row(
            "Total Resources",
            str(left_total),
            str(right_total),
            f"{right_total - left_total:+d}"
        )
        table.add_row(
            "Unchanged",
            "-",
            "-",
            str(summary["unchanged_count"]),
            style="green"
        )
        table.add_row(
            "Changed",
            "-",
            "-",
            str(summary["changed_count"]),
            style="yellow"
        )
        table.add_row(
            "Added",
            "-",
            "-",
            str(summary["added_count"]),
            style="green"
        )
        table.add_row(
            "Removed",
            "-",
            "-",
            str(summary["removed_count"]),
            style="red"
        )

        self.console.print(table)

    def _print_changes_by_kind(self, env_diff: EnvironmentDiff) -> None:
        kind_counts = env_diff.summary["kind_counts"]
        if not kind_counts:
            return

        table = Table(title="Changes by Resource Kind")
        table.add_column("Kind", style="cyan")
        table.add_column("Unchanged", style="green")
        table.add_column("Changed", style="yellow")
        table.add_column("Added", style="blue")
        table.add_column("Removed", style="red")

        for kind in sorted(kind_counts.keys()):
            counts = kind_counts[kind]
            table.add_row(
                kind,
                str(counts.get("unchanged", 0)),
                str(counts.get("changed", 0)),
                str(counts.get("added", 0)),
                str(counts.get("removed", 0))
            )

        self.console.print(table)

    def _print_changed_resources(self, env_diff: EnvironmentDiff) -> None:
        changed = [rd for rd in env_diff.resource_diffs if rd.status != "unchanged"]
        
        if not changed:
            return

        table = Table(title="Changed Resources", show_lines=True)
        table.add_column("Status", style="cyan")
        table.add_column("Kind", style="magenta")
        table.add_column("Namespace", style="blue")
        table.add_column("Name", style="green")

        status_styles = {
            "changed": "yellow",
            "added": "green",
            "removed": "red"
        }

        for rd in sorted(changed, key=lambda x: (x.status, x.kind, x.name)):
            style = status_styles.get(rd.status, "white")
            table.add_row(
                Text(rd.status.upper(), style=style),
                rd.kind,
                rd.namespace or "-",
                rd.name
            )

        self.console.print(table)

    def _print_masked_summary(self, masked_items: List[MaskedItem]) -> None:
        if not masked_items:
            return

        table = Table(title="Sensitive Data Masked")
        table.add_column("Pattern", style="cyan")
        table.add_column("Count", style="magenta")

        counts = {}
        for item in masked_items:
            counts[item.pattern_name] = counts.get(item.pattern_name, 0) + 1

        for pattern, count in sorted(counts.items()):
            table.add_row(pattern, str(count))

        self.console.print(table)

    def _print_errors(self, env_diff: EnvironmentDiff) -> None:
        has_errors = False
        errors_content = []

        for env, result in [
            (env_diff.left_env, env_diff.left_result),
            (env_diff.right_env, env_diff.right_result)
        ]:
            if result.errors:
                has_errors = True
                errors_content.append(f"\n[bold red]Errors in {env}:[/bold red]")
                for err in result.errors:
                    errors_content.append(f"  - {err}")

        if has_errors:
            self.console.print(Panel("\n".join(errors_content), title="⚠️ Render Errors", border_style="red"))

    def generate_json_report(
        self,
        env_diff: EnvironmentDiff,
        masked_items: Optional[List[MaskedItem]] = None,
        filename: Optional[str] = None
    ) -> str:
        if filename is None:
            filename = f"diff-{env_diff.left_env}-{env_diff.right_env}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

        output_path = self.output_dir / filename

        report_data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "left_environment": env_diff.left_env,
                "right_environment": env_diff.right_env,
                "left_values_file": env_diff.left_result.values_file,
                "right_values_file": env_diff.right_result.values_file,
            },
            "summary": env_diff.summary,
            "resource_diffs": [
                self._resource_diff_to_dict(rd)
                for rd in env_diff.resource_diffs
            ],
            "render_errors": {
                env_diff.left_env: env_diff.left_result.errors,
                env_diff.right_env: env_diff.right_result.errors
            }
        }

        if masked_items:
            report_data["sensitive_data"] = {
                "total_masked": len(masked_items),
                "masked_fields": [
                    {
                        "path": item.path,
                        "pattern_name": item.pattern_name,
                        "masked_value": item.masked_value
                    }
                    for item in masked_items
                ]
            }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)

        logger.info(f"JSON report written to: {output_path}")
        return str(output_path)

    def _resource_diff_to_dict(self, rd: ResourceDiff) -> Dict[str, Any]:
        result = {
            "resource_key": rd.resource_key,
            "kind": rd.kind,
            "name": rd.name,
            "namespace": rd.namespace,
            "status": rd.status,
        }

        if rd.diff:
            result["diff"] = rd.diff

        if rd.left_source:
            result["left_source"] = {
                "source_position": rd.left_source.source_position,
                "normalized": rd.left_source.normalized
            }

        if rd.right_source:
            result["right_source"] = {
                "source_position": rd.right_source.source_position,
                "normalized": rd.right_source.normalized
            }

        return result

    def generate_markdown_report(
        self,
        env_diff: EnvironmentDiff,
        masked_items: Optional[List[MaskedItem]] = None,
        filename: Optional[str] = None
    ) -> str:
        if filename is None:
            filename = f"diff-{env_diff.left_env}-{env_diff.right_env}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.md"

        output_path = self.output_dir / filename

        lines = []
        lines.append(f"# Helm Template Diff Report: {env_diff.left_env} ↔ {env_diff.right_env}")
        lines.append("")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        summary = env_diff.summary
        lines.append("## Summary")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Total Resources ({env_diff.left_env}) | {summary['total_resources'][env_diff.left_env]} |")
        lines.append(f"| Total Resources ({env_diff.right_env}) | {summary['total_resources'][env_diff.right_env]} |")
        lines.append(f"| Unchanged | {summary['unchanged_count']} |")
        lines.append(f"| Changed | {summary['changed_count']} |")
        lines.append(f"| Added | {summary['added_count']} |")
        lines.append(f"| Removed | {summary['removed_count']} |")
        lines.append("")

        if summary.get("has_changes", False):
            lines.append("## Changed Resources")
            lines.append("")
            lines.append("| Status | Kind | Namespace | Name |")
            lines.append("|--------|------|-----------|------|")
            
            changed = [rd for rd in env_diff.resource_diffs if rd.status != "unchanged"]
            for rd in sorted(changed, key=lambda x: (x.status, x.kind, x.name)):
                lines.append(f"| {rd.status.upper()} | {rd.kind} | {rd.namespace or '-'} | {rd.name} |")
            lines.append("")

            lines.append("## Detailed Changes")
            lines.append("")
            for rd in [r for r in env_diff.resource_diffs if r.status == "changed"]:
                lines.append(f"### {rd.kind}: {rd.namespace or ''}/{rd.name}")
                lines.append("")
                
                if rd.diff:
                    lines.append("```yaml")
                    lines.append(yaml.safe_dump(rd.diff, default_flow_style=False, indent=2))
                    lines.append("```")
                lines.append("")

        if masked_items:
            lines.append("## Sensitive Data Masked")
            lines.append("")
            lines.append(f"Total masked fields: {len(masked_items)}")
            lines.append("")
            lines.append("| Pattern | Path |")
            lines.append("|---------|------|")
            for item in masked_items:
                lines.append(f"| {item.pattern_name} | {item.path} |")
            lines.append("")

        left_errors = env_diff.left_result.errors
        right_errors = env_diff.right_result.errors
        if left_errors or right_errors:
            lines.append("## Render Errors")
            lines.append("")
            if left_errors:
                lines.append(f"### {env_diff.left_env}")
                for err in left_errors:
                    lines.append(f"- {err}")
                lines.append("")
            if right_errors:
                lines.append(f"### {env_diff.right_env}")
                for err in right_errors:
                    lines.append(f"- {err}")
                lines.append("")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        logger.info(f"Markdown report written to: {output_path}")
        return str(output_path)

    def save_raw_manifests(
        self,
        render_results: Dict[str, RenderResult],
        filename_prefix: str = "manifests"
    ) -> Dict[str, str]:
        output_files = {}
        
        for env_name, result in render_results.items():
            filename = f"{filename_prefix}-{env_name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.yaml"
            output_path = self.output_dir / filename
            
            docs = []
            for manifest in result.manifests:
                docs.append("---")
                docs.append(yaml.safe_dump(manifest, default_flow_style=False))
            
            with open(output_path, "w", encoding="utf-8") as f:
                f.write("\n".join(docs))
            
            output_files[env_name] = str(output_path)
            logger.info(f"Raw manifests for {env_name} written to: {output_path}")
        
        return output_files
