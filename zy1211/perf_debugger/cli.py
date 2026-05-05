"""CLI for Linux Performance Troubleshooting Assistant."""

import click
from rich.console import Console
from rich.table import Table
from pathlib import Path
from datetime import datetime
import json

from .database import init_db, get_session, Session, Sample
from .parsers import detect_parser, parse_file
from .analyzers import analyze_session
from .reporters import generate_report, export_json, export_markdown

console = Console()


@click.group()
@click.version_option()
def main():
    """Linux Performance Troubleshooting Assistant CLI
    
    Import top/htop, vmstat, iostat, netstat/ss, strace, perf script
    or flame graph folded stacks, and automatically analyze performance issues.
    """
    init_db()


@main.group()
def session():
    """Manage debugging sessions."""
    pass


@session.command(name="list")
def list_sessions():
    """List all sessions."""
    db = get_session()
    sessions = db.query(Session).order_by(Session.created_at.desc()).all()
    
    if not sessions:
        console.print("[yellow]No sessions found.[/yellow]")
        return
    
    table = Table(title="Performance Sessions")
    table.add_column("ID", style="cyan")
    table.add_column("Name", style="magenta")
    table.add_column("Samples", style="green")
    table.add_column("Events", style="yellow")
    table.add_column("Created", style="blue")
    
    for sess in sessions:
        table.add_row(
            str(sess.id),
            sess.name,
            str(len(sess.samples)),
            str(len(sess.events)),
            sess.created_at.strftime("%Y-%m-%d %H:%M")
        )
    
    console.print(table)


@session.command(name="create")
@click.argument("name")
@click.option("--description", "-d", help="Session description")
def create_session(name, description):
    """Create a new debugging session."""
    db = get_session()
    
    new_session = Session(
        name=name,
        description=description,
        created_at=datetime.utcnow()
    )
    
    db.add(new_session)
    db.commit()
    
    console.print(f"[green]Created session: {name} (ID: {new_session.id})[/green]")


@session.command(name="show")
@click.argument("session_id", type=int)
def show_session(session_id):
    """Show details of a session."""
    db = get_session()
    sess = db.query(Session).filter_by(id=session_id).first()
    
    if not sess:
        console.print(f"[red]Session {session_id} not found[/red]")
        return
    
    console.print(f"\n[bold cyan]Session: {sess.name}[/bold cyan]")
    console.print(f"Description: {sess.description or 'N/A'}")
    console.print(f"Created: {sess.created_at}")
    console.print(f"Samples: {len(sess.samples)}")
    console.print(f"Events: {len(sess.events)}")
    
    if sess.samples:
        console.print("\n[bold]Samples:[/bold]")
        for sample in sess.samples:
            console.print(f"  - [{sample.sample_type}] {sample.file_path}")
    
    if sess.events:
        console.print("\n[bold]Events:[/bold]")
        for event in sess.events:
            severity_color = {
                'critical': 'red',
                'warning': 'yellow',
                'info': 'blue'
            }.get(event.severity, 'white')
            console.print(f"  - [{severity_color}]{event.severity.upper()}[/{severity_color}] {event.title}")


@main.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--session", "-s", type=int, help="Session ID to import into")
@click.option("--session-name", "-n", help="Create new session with this name")
@click.option("--type", "-t", "sample_type", help="Force sample type (auto-detected if not specified)")
def import_files(files, session, session_name, sample_type):
    """Import sample files into the database.
    
    FILES can be:
    - top/htop output
    - vmstat output
    - iostat output
    - netstat/ss output
    - strace output
    - perf script output
    - flame graph folded stacks
    """
    if not files:
        console.print("[red]No files specified[/red]")
        return
    
    db = get_session()
    
    if session:
        sess = db.query(Session).filter_by(id=session).first()
        if not sess:
            console.print(f"[red]Session {session} not found[/red]")
            return
    elif session_name:
        sess = Session(
            name=session_name,
            created_at=datetime.utcnow()
        )
        db.add(sess)
        db.commit()
        console.print(f"[green]Created new session: {session_name} (ID: {sess.id})[/green]")
    else:
        sess = Session(
            name=f"Import {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
            created_at=datetime.utcnow()
        )
        db.add(sess)
        db.commit()
        console.print(f"[green]Created new session (ID: {sess.id})[/green]")
    
    for file_path in files:
        path = Path(file_path)
        
        if not path.exists():
            console.print(f"[yellow]File not found: {file_path}[/yellow]")
            continue
        
        detected_type = sample_type or detect_parser(path)
        if not detected_type:
            console.print(f"[yellow]Could not detect file type for: {file_path}[/yellow]")
            continue
        
        console.print(f"Importing [{detected_type}] {file_path}...")
        
        try:
            result = parse_file(db, sess, path, detected_type)
            console.print(f"[green]  Imported: {result['metrics_count']} metrics, {result['records_count']} records[/green]")
        except Exception as e:
            console.print(f"[red]  Error importing: {e}[/red]")
    
    db.commit()
    console.print(f"\n[green]Import complete. Session ID: {sess.id}[/green]")


@main.command()
@click.argument("session_id", type=int)
@click.option("--cpu-threshold", default=80.0, type=float, help="CPU spike threshold (%%)")
@click.option("--iowait-threshold", default=30.0, type=float, help="IO wait threshold (%%)")
@click.option("--output", "-o", type=click.Path(), help="Output report file")
@click.option("--format", "-f", "fmt", type=click.Choice(['text', 'json', 'markdown']), default='text', help="Output format")
def analyze(session_id, cpu_threshold, iowait_threshold, output, fmt):
    """Analyze a session for performance issues.
    
    Detects:
    - CPU spikes and high CPU processes
    - IO wait bottlenecks
    - Network connection issues
    - System call blocking
    - Hotspot functions
    """
    db = get_session()
    sess = db.query(Session).filter_by(id=session_id).first()
    
    if not sess:
        console.print(f"[red]Session {session_id} not found[/red]")
        return
    
    console.print(f"[bold cyan]Analyzing session: {sess.name}[/bold cyan]")
    console.print(f"CPU threshold: {cpu_threshold}%, IO wait threshold: {iowait_threshold}%")
    
    result = analyze_session(
        db, sess,
        cpu_threshold=cpu_threshold,
        iowait_threshold=iowait_threshold
    )
    
    db.commit()
    
    console.print(f"\n[bold green]Analysis complete![/bold green]")
    console.print(f"Detected {len(result['events'])} events:")
    
    event_counts = {}
    for event in result['events']:
        etype = event.event_type
        severity = event.severity
        key = f"{etype} ({severity})"
        event_counts[key] = event_counts.get(key, 0) + 1
    
    for key, count in event_counts.items():
        console.print(f"  - {key}: {count}")
    
    if output:
        if fmt == 'json':
            export_json(db, sess, output)
        elif fmt == 'markdown':
            export_markdown(db, sess, output)
        console.print(f"[green]Report written to: {output}[/green]")
    else:
        report = generate_report(db, sess)
        console.print("\n" + "=" * 80)
        console.print(report)
        console.print("=" * 80)


@main.command()
@click.argument("session_ids", nargs=-1, type=int)
@click.option("--output", "-o", type=click.Path(), help="Output file")
@click.option("--format", "-f", "fmt", type=click.Choice(['text', 'json', 'markdown']), default='text', help="Output format")
def compare(session_ids, output, fmt):
    """Compare multiple sessions side by side."""
    if len(session_ids) < 2:
        console.print("[red]Need at least 2 session IDs to compare[/red]")
        return
    
    db = get_session()
    sessions = []
    
    for sid in session_ids:
        sess = db.query(Session).filter_by(id=sid).first()
        if sess:
            sessions.append(sess)
        else:
            console.print(f"[yellow]Session {sid} not found, skipping[/yellow]")
    
    if len(sessions) < 2:
        console.print("[red]Not enough valid sessions to compare[/red]")
        return
    
    table = Table(title="Session Comparison")
    table.add_column("Session", style="cyan")
    table.add_column("Name", style="magenta")
    table.add_column("Samples", style="green")
    table.add_column("Events", style="yellow")
    table.add_column("Critical", style="red")
    table.add_column("Created", style="blue")
    
    for sess in sessions:
        critical_count = sum(1 for e in sess.events if e.severity == 'critical')
        table.add_row(
            str(sess.id),
            sess.name,
            str(len(sess.samples)),
            str(len(sess.events)),
            str(critical_count),
            sess.created_at.strftime("%Y-%m-%d %H:%M")
        )
    
    console.print(table)


@main.command()
@click.argument("session_id", type=int)
@click.argument("output", type=click.Path())
@click.option("--format", "-f", "fmt", type=click.Choice(['json', 'markdown']), default='markdown', help="Export format")
def export(session_id, output, fmt):
    """Export analysis report to file."""
    db = get_session()
    sess = db.query(Session).filter_by(id=session_id).first()
    
    if not sess:
        console.print(f"[red]Session {session_id} not found[/red]")
        return
    
    if fmt == 'json':
        export_json(db, sess, output)
    else:
        export_markdown(db, sess, output)
    
    console.print(f"[green]Report exported to: {output}[/green]")


@main.group()
def seed():
    """Generate sample data for testing."""
    pass


@seed.command(name="good")
@click.option("--output", "-o", type=click.Path(), default=".", help="Output directory")
@click.option("--count", "-c", type=int, default=1, help="Number of samples to generate")
def seed_good(output, count):
    """Generate good (normal) sample data."""
    from .seeds.good_samples import generate_good_samples
    generate_good_samples(output, count)
    console.print(f"[green]Generated {count} good samples in: {output}[/green]")


@seed.command(name="bad")
@click.option("--output", "-o", type=click.Path(), default=".", help="Output directory")
@click.option("--type", "-t", "issue_type", 
              type=click.Choice(['cpu_spike', 'io_wait', 'network_block', 'syscall_block', 'all']),
              default='all', help="Type of bad behavior")
@click.option("--count", "-c", type=int, default=1, help="Number of samples to generate")
def seed_bad(output, issue_type, count):
    """Generate bad (anomaly) sample data for testing."""
    from .seeds.bad_samples import generate_bad_samples
    generate_bad_samples(output, issue_type, count)
    console.print(f"[green]Generated {count} bad samples ({issue_type}) in: {output}[/green]")


if __name__ == "__main__":
    main()
