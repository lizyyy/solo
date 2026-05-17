from __future__ import annotations

import os
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from . import __version__
from .git_metadata import GitMetadataReader
from .drift_detector import DriftDetector
from .report_generator import ReportGenerator

console = Console()


@click.group()
@click.version_option(version=__version__)
def main():
    """Git Submodule Drift Detection CLI Tool"""
    pass


@main.command()
@click.argument("repo_path", type=click.Path(exists=True), default=".")
@click.option("--json", "json_output", type=click.Path(), help="Output JSON report to file")
@click.option("--markdown", "markdown_output", type=click.Path(), help="Output Markdown report to file")
@click.option("--email", is_flag=True, help="Generate team email content")
@click.option("--remote", "-r", is_flag=True, help="Check remote status (requires network)")
@click.option("--quiet", "-q", is_flag=True, help="Suppress terminal output")
@click.option("--strict", is_flag=True, help="Exit with error if any issues found")
def check(repo_path, json_output, markdown_output, email, remote, quiet, strict):
    """Check submodules for commit drift"""
    try:
        reader = GitMetadataReader(repo_path)
        submodules = reader.get_all_submodule_info()
        
        if not submodules:
            if not quiet:
                console.print("[yellow]No submodules found in this repository[/yellow]")
            return
        
        detector = DriftDetector(repo_path)
        
        if remote:
            if not quiet:
                console.print("[cyan]Fetching remote status...[/cyan]")
            results = detector.detect_with_remote(submodules)
        else:
            results = detector.detect_drift(submodules)
        
        reporter = ReportGenerator()
        
        if not quiet:
            reporter.generate_terminal_summary(results)
        
        if json_output:
            reporter.generate_json(results, json_output)
            if not quiet:
                console.print(f"[green]JSON report written to: {json_output}[/green]")
        
        if markdown_output:
            reporter.generate_markdown(results, markdown_output)
            if not quiet:
                console.print(f"[green]Markdown report written to: {markdown_output}[/green]")
        
        if email:
            email_content = reporter.generate_team_email_content(results)
            console.print(Panel(email_content, title="Team Email Content", border_style="blue"))
        
        if strict:
            has_issues = any(r.has_drift or r.is_missing or r.errors for r in results)
            if has_issues:
                sys.exit(1)
        
    except Exception as e:
        console.print(f"[red]Error: {str(e)}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command(name="list")
@click.argument("repo_path", type=click.Path(exists=True), default=".")
@click.option("--raw", is_flag=True, help="Show raw .gitmodules lines")
def list_submodules(repo_path, raw):
    """List all submodules with basic info"""
    reader = GitMetadataReader(repo_path)
    parse_result = reader.parse_gitmodules()
    
    if not parse_result.submodules:
        console.print("[yellow]No submodules found[/yellow]")
        return
    
    table = Table(title="Submodules List")
    table.add_column("Name", style="cyan")
    table.add_column("Path", style="magenta")
    table.add_column("URL", style="blue")
    table.add_column("Branch", style="green")
    
    for sm in parse_result.submodules:
        table.add_row(
            sm.name,
            sm.path or "(none)",
            sm.url or "(none)",
            sm.branch or "default"
        )
    
    console.print(table)
    
    if raw and parse_result.raw_content:
        console.print(Panel(parse_result.raw_content, title="Raw .gitmodules Content", border_style="dim"))


@main.command()
@click.argument("repo_path", type=click.Path(exists=True), default=".")
@click.option("--no-fetch", is_flag=True, help="Skip fetching (use cached info)")
def remote(repo_path, no_fetch):
    """Check remote status for all submodules"""
    reader = GitMetadataReader(repo_path)
    submodules = reader.get_all_submodule_info()
    
    if not submodules:
        console.print("[yellow]No submodules found[/yellow]")
        return
    
    detector = DriftDetector(repo_path)
    
    with console.status("[cyan]Checking remote status...[/cyan]"):
        remote_statuses = detector.analyze_remote_status(submodules)
    
    table = Table(title="Remote Status")
    table.add_column("Submodule", style="cyan")
    table.add_column("Status", style="magenta")
    table.add_column("Local Commit", style="blue")
    table.add_column("Remote Commit", style="blue")
    
    for sm in submodules:
        status = remote_statuses.get(sm.name, {})
        status_str = status.get("status", "unknown")
        
        if status_str == "in_sync":
            status_display = "[green]IN SYNC[/green]"
        elif status_str == "out_of_sync":
            status_display = "[red]OUT OF SYNC[/red]"
        else:
            status_display = f"[yellow]{status_str.upper()}[/yellow]"
        
        local = status.get("local_commit", "")
        remote = status.get("remote_commit", "")
        
        table.add_row(
            sm.name,
            status_display,
            local[:8] if local else "-",
            remote[:8] if remote else "-"
        )
    
    console.print(table)


@main.command()
@click.argument("repo_path", type=click.Path(exists=True), default=".")
def parse(repo_path):
    """Parse .gitmodules and show detailed info"""
    reader = GitMetadataReader(repo_path)
    parse_result = reader.parse_gitmodules()
    
    console.print(f"[cyan]File:[/cyan] {reader.gitmodules_path}")
    console.print()
    
    if parse_result.errors:
        console.print(f"[red]{len(parse_result.errors)} parse errors:[/red]")
        for error in parse_result.errors:
            line_num = error.get("line_number", "?")
            line_content = error.get("line_content", "")
            msg = error.get("message", "Unknown error")
            console.print(f"  Line {line_num}: [yellow]{msg}[/yellow]")
            if line_content:
                console.print(f"    Content: {line_content}")
        console.print()
    
    for sm in parse_result.submodules:
        console.print(f"[cyan]Submodule: {sm.name}[/cyan]")
        console.print(f"  Path: {sm.path}")
        console.print(f"  URL: {sm.url}")
        console.print(f"  Branch: {sm.branch or 'default'}")
        
        if sm.errors:
            console.print(f"  [red]Errors: {len(sm.errors)}[/red]")
            for error in sm.errors:
                line_num = error.get("line_number", "?")
                msg = error.get("message", "Unknown error")
                console.print(f"    Line {line_num}: {msg}")
        
        if sm.raw_lines:
            console.print(f"  Raw lines:")
            for line_info in sm.raw_lines:
                console.print(f"    Line {line_info.get('line_number', '?')}: {line_info.get('content', '')}")
        
        console.print()


@main.command(name="self-test")
@click.option("--create-fixtures", is_flag=True, help="Create test fixtures")
@click.option("--run-tests", is_flag=True, help="Run actual unit tests")
def selftest(create_fixtures, run_tests):
    """Run self-test to verify installation"""
    console.print("[cyan]Running self-test...[/cyan]")
    console.print()
    
    all_passed = True
    
    checks = [
        ("Python version", lambda: sys.version_info >= (3, 8)),
        ("GitMetadataReader import", lambda: GitMetadataReader is not None),
        ("DriftDetector import", lambda: DriftDetector is not None),
        ("ReportGenerator import", lambda: ReportGenerator is not None),
        ("GitPython available", lambda: __import__("git") is not None),
        ("Click available", lambda: __import__("click") is not None),
        ("Rich available", lambda: __import__("rich") is not None),
    ]
    
    for name, check in checks:
        try:
            passed = check()
            if passed:
                console.print(f"[green]✓ {name}[/green]")
            else:
                console.print(f"[red]✗ {name}[/red]")
                all_passed = False
        except Exception as e:
            console.print(f"[red]✗ {name}: {str(e)}[/red]")
            all_passed = False
    
    console.print()
    
    if create_fixtures:
        console.print("[cyan]Creating test fixtures...[/cyan]")
        test_dir = Path("./test_fixtures")
        test_dir.mkdir(exist_ok=True)
        
        (test_dir / ".gitmodules").write_text("""[submodule "module1"]
    path = lib/module1
    url = https://github.com/example/module1.git
    branch = main
[submodule "module2"]
    path = lib/module2
    url = https://github.com/example/module2.git
malformed_line_here
[submodule "empty-path"]
    url = https://github.com/example/empty.git
""")
        console.print(f"[green]Created test fixtures in {test_dir}[/green]")
        console.print()
    
    if run_tests:
        console.print("[cyan]Running unit tests...[/cyan]")
        import pytest
        result = pytest.main(["-xvs", "src/submodule_drift/test.py"])
        if result != 0:
            all_passed = False
        console.print()
    
    if all_passed:
        console.print("[green]All checks passed! The tool is ready to use.[/green]")
    else:
        console.print("[red]Some checks failed. Please check your installation.[/red]")
        sys.exit(1)


@main.command()
@click.argument("repo_path", type=click.Path(exists=True), default=".")
@click.option("--output", "-o", type=click.Path(), help="Output directory")
def export(repo_path, output):
    """Export all report formats"""
    output_dir = Path(output) if output else Path("./submodule_reports")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    reader = GitMetadataReader(repo_path)
    submodules = reader.get_all_submodule_info()
    
    detector = DriftDetector(repo_path)
    results = detector.detect_drift(submodules)
    
    reporter = ReportGenerator()
    
    json_path = output_dir / "drift_report.json"
    md_path = output_dir / "drift_report.md"
    email_path = output_dir / "team_email.txt"
    
    reporter.generate_json(results, str(json_path))
    reporter.generate_markdown(results, str(md_path))
    email_path.write_text(reporter.generate_team_email_content(results), encoding="utf-8")
    
    console.print(f"[green]All reports exported to: {output_dir}[/green]")
    console.print(f"  - {json_path.name}")
    console.print(f"  - {md_path.name}")
    console.print(f"  - {email_path.name}")


if __name__ == "__main__":
    main()
