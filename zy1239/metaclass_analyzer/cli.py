"""Command-line interface for metaclass analyzer."""

import os
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree

from .analyzer import MetaclassAnalyzer
from .errors import (
    FileFormatError,
    MetaclassAnalyzerError,
    format_error,
)
from .reader import JsonlReader, SnippetsReader, YamlReader
from .reporter import JsonReporter, MarkdownReporter
from .storage import SQLiteStorage

console = Console()


@click.group()
@click.version_option(version="0.1.0", prog_name="metaclass-analyzer")
@click.option(
    "--db",
    "db_path",
    default="metaclass_analysis.db",
    show_default=True,
    help="SQLite database path",
)
@click.pass_context
def main(ctx: click.Context, db_path: str):
    """Metaclass Analyzer - Analyze and debug Python metaclass issues.

    This tool helps you analyze class creation processes, metaclass conflicts,
    field registration order, and more.
    """
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db_path


@main.command()
@click.option(
    "--yaml",
    "yaml_path",
    default="class-cases.yaml",
    show_default=True,
    help="Path to class-cases.yaml file",
)
@click.option(
    "--jsonl",
    "jsonl_path",
    default="events.jsonl",
    show_default=True,
    help="Path to events.jsonl file",
)
@click.option(
    "--snippets",
    "snippets_dir",
    default="snippets",
    show_default=True,
    help="Directory containing Python snippets",
)
@click.option(
    "--no-db",
    "skip_db",
    is_flag=True,
    help="Skip saving to database",
)
@click.pass_context
def analyze(
    ctx: click.Context,
    yaml_path: str,
    jsonl_path: str,
    snippets_dir: str,
    skip_db: bool,
):
    """Analyze metaclass-related data from files.

    Reads class-cases.yaml, events.jsonl, and Python snippets, then
    performs comprehensive analysis on metaclass mechanisms.
    """
    db_path = ctx.obj["db_path"]

    console.print("[bold blue]Starting metaclass analysis...[/bold blue]")
    console.print()

    try:
        classes = []
        if Path(yaml_path).exists():
            console.print(f"[cyan]Reading YAML file: {yaml_path}[/cyan]")
            yaml_reader = YamlReader(yaml_path)
            yaml_data = yaml_reader.read()
            classes = yaml_reader.parse_classes(yaml_data)
            console.print(f"  [green]Loaded {len(classes)} classes from YAML[/green]")
        else:
            console.print(f"[yellow]YAML file not found: {yaml_path}[/yellow]")

        events = []
        if Path(jsonl_path).exists():
            console.print(f"[cyan]Reading JSONL file: {jsonl_path}[/cyan]")
            jsonl_reader = JsonlReader(jsonl_path)
            events = jsonl_reader.parse_events()
            console.print(f"  [green]Loaded {len(events)} events from JSONL[/green]")
        else:
            console.print(f"[yellow]JSONL file not found: {jsonl_path}[/yellow]")

        snippet_classes = []
        if Path(snippets_dir).exists():
            console.print(f"[cyan]Reading Python snippets from: {snippets_dir}[/cyan]")
            snippets_reader = SnippetsReader(snippets_dir)
            snippet_classes = snippets_reader.read_all_snippets()
            console.print(f"  [green]Found {len(snippet_classes)} classes in snippets[/green]")
        else:
            console.print(f"[yellow]Snippets directory not found: {snippets_dir}[/yellow]")

        if not classes and not events and not snippet_classes:
            console.print("[red]Error: No data to analyze.[/red]")
            console.print("Please provide at least one of: class-cases.yaml, events.jsonl, or snippets/")
            raise click.Abort()

        console.print()
        console.print("[cyan]Running analysis...[/cyan]")
        analyzer = MetaclassAnalyzer(classes, events, snippet_classes)
        result = analyzer.analyze()

        _display_analysis_summary(result)

        if not skip_db:
            console.print()
            console.print(f"[cyan]Saving to database: {db_path}[/cyan]")
            storage = SQLiteStorage(db_path)
            run_id = storage.save_analysis(result)
            console.print(f"  [green]Analysis saved as run #{run_id}[/green]")

        console.print()
        console.print("[bold green]Analysis complete![/bold green]")

    except FileFormatError as e:
        console.print(f"[red]{format_error(e)}[/red]")
        raise click.Abort()
    except MetaclassAnalyzerError as e:
        console.print(f"[red]Error: {e.message}[/red]")
        raise click.Abort()


@main.command("list")
@click.option(
    "--limit",
    "-n",
    default=10,
    show_default=True,
    help="Number of recent runs to show",
)
@click.pass_context
def list_runs(ctx: click.Context, limit: int):
    """List recent analysis runs."""
    db_path = ctx.obj["db_path"]

    if not Path(db_path).exists():
        console.print(f"[red]Database not found: {db_path}[/red]")
        raise click.Abort()

    storage = SQLiteStorage(db_path)
    runs = storage.list_runs(limit)

    if not runs:
        console.print("[yellow]No analysis runs found.[/yellow]")
        return

    table = Table(title="Recent Analysis Runs")
    table.add_column("ID", style="cyan")
    table.add_column("Run At", style="green")
    table.add_column("Classes", style="blue")
    table.add_column("Events", style="blue")
    table.add_column("Conflicts", style="red")
    table.add_column("Errors", style="red")
    table.add_column("Warnings", style="yellow")

    for run in runs:
        table.add_row(
            str(run["id"]),
            run["run_at"],
            str(run["total_classes"]),
            str(run["total_events"]),
            str(run["conflicts_found"]),
            str(run["errors_count"]),
            str(run["warnings_count"]),
        )

    console.print(table)


@main.command()
@click.argument("run_id", type=int, required=False)
@click.option(
    "--format",
    "-f",
    "output_format",
    type=click.Choice(["json", "md", "markdown", "both"]),
    default="md",
    show_default=True,
    help="Output format",
)
@click.option(
    "--output",
    "-o",
    "output_path",
    default=None,
    help="Output file path (without extension)",
)
@click.pass_context
def export(
    ctx: click.Context,
    run_id: Optional[int],
    output_format: str,
    output_path: Optional[str],
):
    """Export analysis results to JSON or Markdown.

    If RUN_ID is not provided, uses the latest run.
    """
    db_path = ctx.obj["db_path"]

    if not Path(db_path).exists():
        console.print(f"[red]Database not found: {db_path}[/red]")
        raise click.Abort()

    storage = SQLiteStorage(db_path)

    if run_id is None:
        latest = storage.get_latest_run()
        if not latest:
            console.print("[red]No analysis runs found.[/red]")
            raise click.Abort()
        run_id = latest["id"]
        console.print(f"[cyan]Using latest run: #{run_id}[/cyan]")

    result = storage.get_run(run_id)
    if not result:
        console.print(f"[red]Run #{run_id} not found.[/red]")
        raise click.Abort()

    if output_path is None:
        output_path = f"analysis_run_{run_id}"

    console.print(f"[cyan]Exporting run #{run_id}...[/cyan]")

    if output_format in ["json", "both"]:
        json_path = f"{output_path}.json"
        JsonReporter.save(result, json_path)
        console.print(f"  [green]Saved JSON: {json_path}[/green]")

    if output_format in ["md", "markdown", "both"]:
        md_path = f"{output_path}.md"
        MarkdownReporter.save(result, md_path, f"Metaclass Analysis Report - Run #{run_id}")
        console.print(f"  [green]Saved Markdown: {md_path}[/green]")

    console.print()
    console.print("[bold green]Export complete![/bold green]")


@main.command()
@click.argument("class_name")
@click.pass_context
def timeline(ctx: click.Context, class_name: str):
    """Show the event timeline for a specific class."""
    db_path = ctx.obj["db_path"]

    if not Path(db_path).exists():
        console.print(f"[red]Database not found: {db_path}[/red]")
        raise click.Abort()

    storage = SQLiteStorage(db_path)
    events = storage.get_class_timeline(class_name)

    if not events:
        console.print(f"[yellow]No events found for class: {class_name}[/yellow]")
        return

    console.print(f"[bold blue]Event Timeline for: {class_name}[/bold blue]")
    console.print()

    table = Table()
    table.add_column("Order", style="cyan")
    table.add_column("Event Type", style="green")
    table.add_column("Timestamp", style="blue")
    table.add_column("Success", style="magenta")
    table.add_column("Details", style="white")

    for event in events:
        success = "✅" if event.success else "❌"
        details = ", ".join(f"{k}: {v}" for k, v in event.details.items()) if event.details else "-"
        time_str = event.timestamp.strftime('%H:%M:%S.%f')[:-3] if event.timestamp else "-"
        table.add_row(
            str(event.order),
            event.event_type.value,
            time_str,
            success,
            details,
        )

    console.print(table)


@main.command()
@click.argument("pattern")
@click.pass_context
def search(ctx: click.Context, pattern: str):
    """Search for classes by name pattern.

    PATTERN is a SQL LIKE pattern (use % for wildcard).
    Example: '%Meta%' finds classes with 'Meta' in the name.
    """
    db_path = ctx.obj["db_path"]

    if not Path(db_path).exists():
        console.print(f"[red]Database not found: {db_path}[/red]")
        raise click.Abort()

    storage = SQLiteStorage(db_path)
    classes = storage.search_classes(pattern)

    if not classes:
        console.print(f"[yellow]No classes found matching: {pattern}[/yellow]")
        return

    console.print(f"[bold blue]Found {len(classes)} class(es) matching '{pattern}'[/bold blue]")
    console.print()

    table = Table()
    table.add_column("Run ID", style="cyan")
    table.add_column("Class Name", style="green")
    table.add_column("Metaclass", style="blue")
    table.add_column("Bases", style="yellow")
    table.add_column("Has Conflict", style="red")
    table.add_column("Run At", style="white")

    for cls in classes:
        has_conflict = "✅ No" if not cls["has_conflict"] else "❌ Yes"
        bases = ", ".join(cls["bases"]) if cls["bases"] else "None"
        table.add_row(
            str(cls["run_id"]),
            cls["name"],
            cls["metaclass"],
            bases,
            has_conflict,
            cls["run_at"],
        )

    console.print(table)


def _display_analysis_summary(result):
    """Display analysis summary in console."""
    console.print()
    console.print("[bold blue]Analysis Summary[/bold blue]")
    console.print()

    table = Table(show_header=False)
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Total Classes", str(len(result.classes)))
    table.add_row("Total Events", str(len(result.timeline)))
    table.add_row("Conflicts Found", str(len(result.conflicts)))
    table.add_row("Errors", str(len(result.errors)))
    table.add_row("Warnings", str(len(result.warnings)))
    table.add_row("Suggestions", str(len(result.suggestions)))

    console.print(table)

    if result.conflicts:
        console.print()
        console.print("[bold red]Conflicts Detected:[/bold red]")
        for conflict in result.conflicts:
            console.print(f"  [red]- {conflict.class_name} ({conflict.severity.upper()})[/red]")
            console.print(f"    Bases: {', '.join(conflict.bases)}")
            for base, meta in conflict.base_metaclasses.items():
                console.print(f"      {base} → {meta}")

    if result.errors:
        console.print()
        console.print("[bold red]Errors:[/bold red]")
        for error in result.errors:
            console.print(f"  [red]- {error}[/red]")

    if result.warnings:
        console.print()
        console.print("[bold yellow]Warnings:[/bold yellow]")
        for warning in result.warnings:
            console.print(f"  [yellow]- {warning}[/yellow]")

    if result.suggestions:
        console.print()
        console.print("[bold green]Suggestions:[/bold green]")
        for suggestion in result.suggestions:
            console.print(f"  [green]- {suggestion}[/green]")


if __name__ == "__main__":
    main()
