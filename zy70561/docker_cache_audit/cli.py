import os
import sys
import click
from rich.console import Console
from .analyzer import CacheAnalyzer
from .reporter import Reporter
from .__init__ import __version__


console = Console()


@click.group()
@click.version_option(__version__, prog_name="docker-cache-audit")
def main():
    """Docker Cache Audit CLI - Analyze Docker build cache efficiency and optimization opportunities"""
    pass


@main.command()
@click.argument('dockerfile_path', type=click.Path(exists=True, readable=True))
@click.argument('build_log_path', type=click.Path(exists=True, readable=True))
@click.option('--file-changes', '-f', type=click.Path(exists=True, readable=True), help='Path to file changes diff (e.g., git diff output)')
@click.option('--output-dir', '-o', type=click.Path(), help='Directory to output reports (default: ./reports)')
@click.option('--no-console', is_flag=True, help='Skip console output')
@click.option('--no-json', is_flag=True, help='Skip JSON report generation')
@click.option('--no-markdown', is_flag=True, help='Skip Markdown report generation')
def audit(dockerfile_path, build_log_path, file_changes, output_dir, no_console, no_json, no_markdown):
    """Analyze Docker build cache efficiency
    
    DOCKERFILE_PATH: Path to the Dockerfile to analyze
    BUILD_LOG_PATH: Path to the Docker build log file
    """
    try:
        analyzer = CacheAnalyzer()
        
        with console.status("[bold green]Analyzing Docker cache..."):
            result = analyzer.analyze(
                dockerfile_path=dockerfile_path,
                build_log_path=build_log_path,
                file_changes_path=file_changes
            )
        
        reporter = Reporter(result)
        
        if not no_console:
            reporter.print_summary()
        
        paths = {}
        timestamp = None
        
        if not no_json or not no_markdown:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_dir = output_dir or "./reports"
            os.makedirs(output_dir, exist_ok=True)
        
        if not no_json:
            json_path = os.path.join(output_dir, f"cache_audit_{timestamp}.json")
            reporter.export_json(json_path)
            paths['json'] = json_path
            console.print(f"[green]✓[/green] JSON report saved to: [cyan]{paths['json']}[/cyan]")
        
        if not no_markdown:
            md_path = os.path.join(output_dir, f"cache_audit_{timestamp}.md")
            reporter.export_markdown(md_path)
            paths['markdown'] = md_path
            console.print(f"[green]✓[/green] Markdown report saved to: [cyan]{paths['markdown']}[/cyan]")
        
        hit_rate = result.cache_hit_rate * 100
        if hit_rate >= 80:
            emoji = "🎉"
            color = "green"
        elif hit_rate >= 50:
            emoji = "👍"
            color = "yellow"
        else:
            emoji = "⚠️"
            color = "red"
        
        console.print(f"\n[{color}]Analysis complete! {emoji} Cache hit rate: {hit_rate:.1f}%[/{color}]")
        
        if result.parse_errors:
            console.print(f"[yellow]⚠️  {len(result.parse_errors)} parse errors encountered[/yellow]")
    
    except Exception as e:
        console.print(f"[red]Error: {str(e)}[/red]", err=True)
        sys.exit(1)


@main.command(name="examples")
def show_examples():
    """Show usage examples"""
    examples = [
        {
            "title": "Basic audit analysis",
            "command": "docker-cache-audit audit ./Dockerfile ./build.log",
            "description": "Analyze cache efficiency using a Dockerfile and build log"
        },
        {
            "title": "With file changes analysis",
            "command": "docker-cache-audit audit ./Dockerfile ./build.log --file-changes ./changes.diff",
            "description": "Include git diff output to analyze which files caused cache misses"
        },
        {
            "title": "Custom output directory",
            "command": "docker-cache-audit audit ./Dockerfile ./build.log --output-dir ./my-reports",
            "description": "Specify a custom directory for report output"
        },
        {
            "title": "Generate only Markdown report",
            "command": "docker-cache-audit audit ./Dockerfile ./build.log --no-console --no-json",
            "description": "Skip console and JSON output, generate only Markdown report"
        }
    ]
    
    console.print("\n[bold blue]🐳 Docker Cache Audit - Usage Examples[/bold blue]\n")
    
    for i, example in enumerate(examples, 1):
        console.print(f"[bold cyan]{i}. {example['title']}[/bold cyan]")
        console.print(f"   [yellow]$[/yellow] [green]{example['command']}[/green]")
        console.print(f"   [dim]{example['description']}[/dim]\n")
    
    console.print("[bold]Tips:[/bold]")
    console.print("• To capture a build log: [green]docker build . 2>&1 | tee build.log[/green]")
    console.print("• To capture file changes: [green]git diff HEAD~1 HEAD > changes.diff[/green]")
    console.print("• Reports are generated in JSON and Markdown format by default")
    console.print("• Use --help on any command for more options\n")


if __name__ == "__main__":
    main()
