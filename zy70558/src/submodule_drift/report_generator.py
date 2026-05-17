from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import List

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .drift_detector import DriftResult


class ReportGenerator:
    def __init__(self):
        self.console = Console()

    def generate_terminal_summary(self, results: List[DriftResult]) -> None:
        has_errors = any(r.errors for r in results)
        
        if has_errors:
            self._print_error_summary(results)
        
        table = Table(title="Git Submodule Drift Detection Report")
        
        table.add_column("Submodule", style="cyan")
        table.add_column("Status", style="magenta")
        table.add_column("Drift Type", style="yellow")
        table.add_column("Ahead", style="green")
        table.add_column("Behind", style="red")
        table.add_column("Expected", style="blue")
        table.add_column("Actual", style="blue")
        table.add_column("Remote", style="dim")
        
        for result in results:
            if result.is_missing:
                status = "[red]MISSING[/red]"
                drift_type = "-"
                ahead = "-"
                behind = "-"
            elif result.has_drift:
                status = "[red]DRIFT[/red]"
                drift_type = result.drift_type or "unknown"
                ahead = str(result.commits_ahead)
                behind = str(result.commits_behind)
            else:
                status = "[green]OK[/green]"
                drift_type = "-"
                ahead = "-"
                behind = "-"
            
            expected = result.submodule.expected_commit[:8] if result.submodule.expected_commit else "N/A"
            actual = result.submodule.actual_commit[:8] if result.submodule.actual_commit else "N/A"
            remote = result.remote_status or "-"
            
            table.add_row(
                result.submodule.name,
                status,
                drift_type,
                ahead,
                behind,
                expected,
                actual,
                remote
            )
        
        self.console.print(table)
        
        total = len(results)
        missing = sum(1 for r in results if r.is_missing)
        drifted = sum(1 for r in results if r.has_drift and not r.is_missing)
        ok = total - missing - drifted
        with_errors = sum(1 for r in results if r.errors)
        
        summary_line = (
            f"\nSummary: [green]{ok} OK[/green] | "
            f"[red]{drifted} DRIFT[/red] | "
            f"[yellow]{missing} MISSING[/yellow] | "
            f"[dim]{with_errors} with errors[/dim] | "
            f"Total: {total}"
        )
        self.console.print(summary_line)

    def _print_error_summary(self, results: List[DriftResult]) -> None:
        all_errors = []
        for result in results:
            for error in result.errors:
                all_errors.append((result.submodule.name, error))
        
        if all_errors:
            error_panel = Panel.fit(
                "\n".join([f"[cyan]{name}[/cyan]: {error.get('message', 'Unknown error')}" 
                          for name, error in all_errors[:5]]),
                title=f"⚠️  {len(all_errors)} Errors Found",
                border_style="yellow"
            )
            self.console.print(error_panel)

    def generate_json(self, results: List[DriftResult], output_path: str = None) -> str:
        data = {
            "generated_at": datetime.now().isoformat(),
            "summary": self._build_summary(results),
            "results": [],
            "errors": []
        }
        
        for result in results:
            result_data = {
                "name": result.submodule.name,
                "path": result.submodule.path,
                "url": result.submodule.url,
                "branch": result.submodule.branch,
                "expected_commit": result.submodule.expected_commit,
                "actual_commit": result.submodule.actual_commit,
                "has_drift": result.has_drift,
                "is_missing": result.is_missing,
                "commits_ahead": result.commits_ahead,
                "commits_behind": result.commits_behind,
                "drift_type": result.drift_type,
                "remote_status": result.remote_status,
                "errors": result.errors,
                "raw_lines": result.raw_context.get("raw_lines", [])
            }
            data["results"].append(result_data)
            
            for error in result.errors:
                data["errors"].append({
                    "submodule": result.submodule.name,
                    **error
                })
        
        json_output = json.dumps(data, indent=2, ensure_ascii=False)
        
        if output_path:
            Path(output_path).write_text(json_output, encoding="utf-8")
        
        return json_output

    def generate_markdown(self, results: List[DriftResult], output_path: str = None) -> str:
        lines = [
            "# Git Submodule Drift Detection Report",
            "",
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## Summary",
            ""
        ]
        
        summary = self._build_summary(results)
        lines.extend([
            "| Metric | Count |",
            "|--------|-------|",
            f"| OK | {summary['ok']} |",
            f"| With Drift | {summary['drifted']} |",
            f"| Missing | {summary['missing']} |",
            f"| With Errors | {summary['with_errors']} |",
            f"| **Total** | **{summary['total']}** |",
            "",
            "## Detailed Results",
            "",
            "| Submodule | Status | Drift Type | Ahead | Behind | Expected | Actual | Remote |",
            "|-----------|--------|------------|-------|--------|----------|--------|--------|"
        ])
        
        for result in results:
            if result.is_missing:
                status = "MISSING"
                drift_type = "-"
                ahead = "-"
                behind = "-"
            elif result.has_drift:
                status = "DRIFT"
                drift_type = result.drift_type or "unknown"
                ahead = str(result.commits_ahead)
                behind = str(result.commits_behind)
            else:
                status = "OK"
                drift_type = "-"
                ahead = "-"
                behind = "-"
            
            expected = result.submodule.expected_commit[:8] if result.submodule.expected_commit else "N/A"
            actual = result.submodule.actual_commit[:8] if result.submodule.actual_commit else "N/A"
            remote = result.remote_status or "-"
            
            lines.append(f"| {result.submodule.name} | {status} | {drift_type} | {ahead} | {behind} | {expected} | {actual} | {remote} |")
        
        error_count = sum(len(r.errors) for r in results)
        if error_count > 0:
            lines.extend([
                "",
                "## Errors Found",
                "",
                "| Submodule | Type | Line | Message |",
                "|-----------|------|------|---------|"
            ])
            
            for result in results:
                for error in result.errors:
                    line_num = error.get("line_number", "-")
                    msg = error.get("message", "Unknown error").replace("|", "\\|")
                    lines.append(f"| {result.submodule.name} | {error.get('type', 'unknown')} | {line_num} | {msg} |")
        
        lines.extend([
            "",
            "## Submodule Details",
            ""
        ])
        
        for result in results:
            lines.extend([
                f"### {result.submodule.name}",
                "",
                f"- Path: `{result.submodule.path}`",
                f"- URL: `{result.submodule.url}`",
                f"- Branch: `{result.submodule.branch or 'default'}`"
            ])
            
            if result.submodule.expected_commit:
                lines.append(f"- Expected Commit: `{result.submodule.expected_commit}`")
            if result.submodule.actual_commit:
                lines.append(f"- Actual Commit: `{result.submodule.actual_commit}`")
            
            if result.raw_context.get("raw_lines"):
                lines.append("")
                lines.append("Raw .gitmodules lines:")
                lines.append("```")
                for line_info in result.raw_context["raw_lines"]:
                    lines.append(f"Line {line_info.get('line_number', '?')}: {line_info.get('content', '')}")
                lines.append("```")
            
            lines.append("")
        
        markdown_output = "\n".join(lines)
        
        if output_path:
            Path(output_path).write_text(markdown_output, encoding="utf-8")
        
        return markdown_output

    def _build_summary(self, results: List[DriftResult]) -> dict:
        total = len(results)
        missing = sum(1 for r in results if r.is_missing)
        drifted = sum(1 for r in results if r.has_drift and not r.is_missing)
        ok = total - missing - drifted
        with_errors = sum(1 for r in results if r.errors)
        
        return {
            "total": total,
            "ok": ok,
            "drifted": drifted,
            "missing": missing,
            "with_errors": with_errors
        }

    def generate_team_email_content(self, results: List[DriftResult]) -> str:
        drifted = [r for r in results if r.has_drift and not r.is_missing]
        missing = [r for r in results if r.is_missing]
        ok = [r for r in results if not r.has_drift and not r.is_missing]
        
        lines = [
            "Hi Team,",
            "",
            "This is an automated submodule drift detection report. Please review the issues below.",
            ""
        ]
        
        if drifted:
            lines.extend([
                "### ⚠️ Submodules with Commit Drift",
                "",
                "| Submodule | Drift Type | Ahead | Behind |",
                "|-----------|------------|-------|--------|"
            ])
            for r in drifted:
                lines.append(f"| {r.submodule.name} | {r.drift_type} | {r.commits_ahead} | {r.commits_behind} |")
            lines.append("")
        
        if missing:
            lines.extend([
                "### ❌ Missing Submodules",
                "",
                "The following submodules could not be found:",
                ""
            ])
            for r in missing:
                lines.append(f"- {r.submodule.name} (`{r.submodule.path}`)")
            lines.append("")
        
        lines.extend([
            "### Action Items",
            "",
            "1. Please verify the drifted submodules and update .gitmodules if needed",
            "2. Run `git submodule update --init --recursive` to initialize missing submodules",
            "3. If you made local changes, please commit them or stash them before updating",
            "",
            "Best regards,",
            "Submodule Drift Bot"
        ])
        
        return "\n".join(lines)
