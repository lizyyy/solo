import click
import sys
import uuid
from pathlib import Path
from typing import Optional

from .database import Database
from .analyzer import AsyncioAnalyzer
from .exporter import MarkdownExporter, JSONExporter
from .parser import Parser, ParseError


@click.group()
@click.option('--db', default='analysis.db', help='SQLite database path')
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
@click.pass_context
def main(ctx, db: str, verbose: bool):
    ctx.ensure_object(dict)
    ctx.obj['db_path'] = db
    ctx.obj['verbose'] = verbose

    database = Database(db)
    database.init_schema()
    ctx.obj['database'] = database


@main.command()
@click.option('--samples-dir', default='./samples', help='Samples directory path')
@click.option('--force', '-f', is_flag=True, help='Force initialization even if directory exists')
@click.pass_context
def init(ctx, samples_dir: str, force: bool):
    click.echo(f"Initializing asyncio analyzer...")
    samples_path = Path(samples_dir)

    if samples_path.exists() and not force:
        click.echo(click.style(f"Error: Samples directory '{samples_dir}' already exists.", fg='red'))
        click.echo("Use --force to override.")
        sys.exit(1)

    samples_path.mkdir(parents=True, exist_ok=True)
    (samples_path / 'snippets').mkdir(parents=True, exist_ok=True)

    async_plan = samples_path / 'async-plan.yaml'
    if not async_plan.exists() or force:
        async_plan.write_text('''# Asyncio 分析计划配置
analysis:
  enabled_checks:
    - event_loop_blocking
    - await_boundary
    - create_task_leak
    - gather_exception
    - timeout_propagation
    - queue_backpressure
    - connection_pool_exhaustion

  thresholds:
    blocking_duration_ms: 100
    task_leak_risk_score: 0.7
    queue_backpressure_ratio: 0.8

  exclude_patterns:
    - "test_*.py"
    - "*_test.py"
''')

    events_file = samples_path / 'events.jsonl'
    if not events_file.exists() or force:
        events_file.write_text('')

    sample_snippet = samples_path / 'snippets' / '01_task_leak.py'
    if not sample_snippet.exists() or force:
        sample_snippet.write_text('''import asyncio

async def background_task():
    """这个任务可能会泄漏，因为没有被正确管理"""
    await asyncio.sleep(10)
    return "done"

async def main():
    # 问题：create_task 没有被 await 或存储引用
    asyncio.create_task(background_task())
    
    # 程序提前退出，后台任务被丢弃
    await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
''')

    click.echo(click.style("✓ Initialization complete!", fg='green'))
    click.echo(f"  Samples directory: {samples_dir}")
    click.echo(f"  Database: {ctx.obj['db_path']}")


@main.command()
@click.option('--samples-dir', default='./samples', help='Samples directory path')
@click.option('--run-id', help='Custom run ID (auto-generated if not provided)')
@click.pass_context
def analyze(ctx, samples_dir: str, run_id: Optional[str]):
    database: Database = ctx.obj['database']
    verbose = ctx.obj['verbose']

    samples_path = Path(samples_dir)
    if not samples_path.exists():
        click.echo(click.style(f"Error: Samples directory '{samples_dir}' does not exist.", fg='red'))
        sys.exit(1)

    run_id = run_id or str(uuid.uuid4())[:8]

    click.echo(f"Starting analysis (run_id: {run_id})...")

    try:
        parser = Parser(samples_path)
        config = parser.parse_yaml('async-plan.yaml')
        events = parser.parse_jsonl('events.jsonl')
        snippets = parser.get_snippets()

        if verbose:
            click.echo(f"  Found {len(snippets)} code snippet(s)")
            click.echo(f"  Found {len(events)} event(s)")

        analyzer = AsyncioAnalyzer(database, run_id, config)
        analyzer.analyze(snippets, events)

        database.create_analysis_run(run_id, samples_dir, config)

        issues = database.get_all_issues(run_id)
        blocking_points = database.get_blocking_points(run_id)
        leak_risks = database.get_leak_risks(run_id)

        click.echo(click.style("\n✓ Analysis complete!", fg='green'))
        click.echo(f"\n  Summary:")
        click.echo(f"    Issues found: {len(issues)}")
        click.echo(f"    Blocking points: {len(blocking_points)}")
        click.echo(f"    Leak risks: {len(leak_risks)}")

        if issues:
            click.echo(f"\n  Issues:")
            for issue in issues:
                severity_color = {'critical': 'red', 'high': 'yellow', 'medium': 'blue', 'low': 'cyan'}
                color = severity_color.get(issue['severity'], 'white')
                click.echo(f"    [{click.style(issue['severity'].upper(), fg=color)}] "
                           f"{issue['title']}")
                if issue['snippet_file']:
                    click.echo(f"      Location: {issue['snippet_file']}:{issue['snippet_line']}")

    except ParseError as e:
        click.echo(click.style(f"\n✗ Parse Error: {e.message}", fg='red'))
        if e.file:
            click.echo(f"  File: {e.file}")
        if e.line:
            click.echo(f"  Line: {e.line}")
        if e.suggestion:
            click.echo(f"  Suggestion: {e.suggestion}")
        sys.exit(1)
    except Exception as e:
        click.echo(click.style(f"\n✗ Error: {e}", fg='red'))
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@main.command()
@click.option('--before', required=True, help='Before analysis database path')
@click.option('--after', required=True, help='After analysis database path')
@click.pass_context
def compare(ctx, before: str, after: str):
    click.echo(f"Comparing analyses...")
    click.echo(f"  Before: {before}")
    click.echo(f"  After: {after}")

    db_before = Database(before)
    db_after = Database(after)

    run_before = db_before.get_latest_run_id()
    run_after = db_after.get_latest_run_id()

    if not run_before:
        click.echo(click.style(f"Error: No analysis found in '{before}'", fg='red'))
        sys.exit(1)

    if not run_after:
        click.echo(click.style(f"Error: No analysis found in '{after}'", fg='red'))
        sys.exit(1)

    issues_before = db_before.get_all_issues(run_before)
    issues_after = db_after.get_all_issues(run_after)

    click.echo(f"\n  Comparison:")
    click.echo(f"    Before issues: {len(issues_before)}")
    click.echo(f"    After issues: {len(issues_after)}")

    diff = len(issues_after) - len(issues_before)
    if diff < 0:
        click.echo(click.style(f"    Improvement: {abs(diff)} issue(s) fixed", fg='green'))
    elif diff > 0:
        click.echo(click.style(f"    Regression: {diff} new issue(s)", fg='red'))
    else:
        click.echo(f"    No change in issue count")


@main.command()
@click.option('--format', '-f', type=click.Choice(['markdown', 'json']), default='markdown', help='Output format')
@click.option('--output', '-o', required=True, help='Output file path')
@click.option('--run-id', help='Run ID to export (latest if not provided)')
@click.pass_context
def export(ctx, format: str, output: str, run_id: Optional[str]):
    database: Database = ctx.obj['database']

    if not run_id:
        run_id = database.get_latest_run_id()
        if not run_id:
            click.echo(click.style("Error: No analysis found. Run 'analyze' first.", fg='red'))
            sys.exit(1)

    click.echo(f"Exporting analysis (run_id: {run_id}) to {format} format...")

    issues = database.get_all_issues(run_id)
    timeline = database.get_timeline(run_id)
    blocking_points = database.get_blocking_points(run_id)
    leak_risks = database.get_leak_risks(run_id)

    data = {
        'run_id': run_id,
        'issues': [dict(row) for row in issues],
        'timeline': [dict(row) for row in timeline],
        'blocking_points': [dict(row) for row in blocking_points],
        'leak_risks': [dict(row) for row in leak_risks],
    }

    output_path = Path(output)

    if format == 'markdown':
        exporter = MarkdownExporter()
        content = exporter.export(data)
        output_path.write_text(content)
    else:
        exporter = JSONExporter()
        content = exporter.export(data)
        output_path.write_text(content)

    click.echo(click.style(f"✓ Exported to {output}", fg='green'))


if __name__ == "__main__":
    main()
