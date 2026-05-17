import click
import sys
import os
from .config_parser import ConfigParser
from .dependency_graph import DependencyGraph
from .service_runner import ServiceRunner
from .reporter import Reporter
from .models import OrchestrationReport


@click.group()
def cli():
    """Service Orchestrator - Manage service startup order with dependencies"""
    pass


@cli.command()
@click.argument('config_file', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='Output directory for reports')
@click.option('--no-terminal', is_flag=True, help='Disable terminal output')
@click.option('--json/--no-json', default=True, help='Generate JSON report')
@click.option('--markdown/--no-markdown', default=True, help='Generate Markdown report')
def run(config_file, output, no_terminal, json, markdown):
    """Run service orchestration"""
    try:
        parser = ConfigParser(config_file)
        services, validation_errors = parser.parse()
        
        if not services and not validation_errors:
            click.echo(click.style("Error: No valid services found in config", fg="red"))
            sys.exit(1)
        
        report = OrchestrationReport(
            total_services=len(services),
            successful=0,
            failed=0,
            skipped=len(services),
            start_order=[],
            results={},
            validation_errors=validation_errors
        )
        
        if validation_errors:
            reporter = Reporter(report)
            if not no_terminal:
                reporter.print_validation_errors()
            
            click.echo(click.style(f"\nFound {len(validation_errors)} validation errors. Aborting.", fg="yellow"))
            
            if output:
                os.makedirs(output, exist_ok=True)
                if json:
                    reporter.save_json(os.path.join(output, "report.json"))
                if markdown:
                    reporter.save_markdown(os.path.join(output, "report.md"))
            
            sys.exit(1)
        
        runner = ServiceRunner(services)
        report = runner.run_all()
        report.validation_errors = validation_errors
        
        reporter = Reporter(report)
        
        if not no_terminal:
            reporter.print_terminal_summary()
        
        if output:
            os.makedirs(output, exist_ok=True)
            if json:
                reporter.save_json(os.path.join(output, "report.json"))
                click.echo(click.style(f"JSON report saved to: {os.path.join(output, 'report.json')}", fg="green"))
            if markdown:
                reporter.save_markdown(os.path.join(output, "report.md"))
                click.echo(click.style(f"Markdown report saved to: {os.path.join(output, 'report.md')}", fg="green"))
        
        if report.failed > 0 or report.circular_dependencies:
            sys.exit(1)
        
    except Exception as e:
        click.echo(click.style(f"\nUnexpected error: {str(e)}", fg="red"))
        sys.exit(1)


@cli.command()
@click.argument('config_file', type=click.Path(exists=True))
@click.option('--graph', '-g', is_flag=True, help='Output DOT graph')
@click.option('--output', '-o', type=click.Path(), help='Output file for DOT graph')
def plan(config_file, graph, output):
    """Show planned startup order without running services"""
    parser = ConfigParser(config_file)
    services, validation_errors = parser.parse()
    
    if validation_errors:
        report = OrchestrationReport(
            total_services=len(services),
            successful=0,
            failed=0,
            skipped=len(services),
            start_order=[],
            results={},
            validation_errors=validation_errors
        )
        reporter = Reporter(report)
        reporter.print_validation_errors()
        sys.exit(1)
    
    dep_graph = DependencyGraph(services)
    start_order, cycles = dep_graph.get_topological_order()
    
    if cycles:
        report = OrchestrationReport(
            total_services=len(services),
            successful=0,
            failed=0,
            skipped=len(services),
            start_order=[],
            results={},
            circular_dependencies=cycles
        )
        reporter = Reporter(report)
        reporter.print_circular_dependencies()
        sys.exit(1)
    
    click.echo(click.style("\nPlanned Startup Order:\n", fg="blue", bold=True))
    for i, name in enumerate(start_order):
        service = services[name]
        deps = ", ".join(service.dependencies) if service.dependencies else "none"
        click.echo(f"  {i + 1}. {click.style(name, fg='cyan')} (deps: {deps})")
    
    if graph:
        dot_content = dep_graph.as_dot()
        if output:
            with open(output, 'w') as f:
                f.write(dot_content)
            click.echo(click.style(f"\nDependency graph saved to: {output}", fg="green"))
        else:
            click.echo("\nDependency Graph (DOT format):")
            click.echo(dot_content)
    
    click.echo()


@cli.command()
@click.argument('config_file', type=click.Path(exists=True))
def validate(config_file):
    """Validate configuration file"""
    parser = ConfigParser(config_file)
    services, validation_errors = parser.parse()
    
    if not validation_errors:
        click.echo(click.style(f"✅ Configuration is valid! Found {len(services)} services.", fg="green"))
        
        dep_graph = DependencyGraph(services)
        _, cycles = dep_graph.get_topological_order()
        
        if cycles:
            click.echo(click.style("\n❌ Circular dependencies detected:", fg="red"))
            for cycle in cycles:
                click.echo(f"   {' → '.join(cycle + [cycle[0]])}")
            sys.exit(1)
        else:
            click.echo(click.style("✅ No circular dependencies detected.", fg="green"))
    else:
        click.echo(click.style(f"\n❌ Found {len(validation_errors)} validation errors:\n", fg="red"))
        
        for error in validation_errors:
            line = f"Line {error.line}: " if error.line else ""
            field = f"[{error.field}] " if error.field else ""
            click.echo(f"  {line}{field}{error.message}")
            if error.raw_value:
                click.echo(f"    Raw value: {error.raw_value}")
        
        sys.exit(1)


@cli.command()
def example():
    """Generate an example configuration file"""
    example_content = """# Service Orchestrator Configuration Example

services:
  - name: mysql
    port: 3306
    dependencies: []
    start_command: "docker run --rm -e MYSQL_ALLOW_EMPTY_PASSWORD=yes mysql:8.0"
    stop_command: "docker stop mysql"
    wait_before_start: 0
    wait_after_start: 5
    health_check:
      type: tcp
      port: 3306
      timeout: 5
      interval: 2
      max_retries: 30
    env:
      MYSQL_ROOT_PASSWORD: "secret"
    working_dir: "."

  - name: redis
    port: 6379
    dependencies: []
    start_command: "docker run --rm redis:7-alpine"
    wait_after_start: 2
    health_check:
      type: tcp
      port: 6379
      timeout: 5
      interval: 2
      max_retries: 20

  - name: api-gateway
    port: 8080
    dependencies:
      - mysql
      - redis
    start_command: "node /app/api-gateway/server.js"
    wait_after_start: 3
    health_check:
      type: http
      endpoint: "http://localhost:8080/health"
      expected_status: 200
      timeout: 5
      interval: 2
      max_retries: 30
    env:
      NODE_ENV: "development"
      PORT: "8080"

  - name: web-app
    port: 3000
    dependencies:
      - api-gateway
    start_command: "npm start"
    working_dir: "./web-app"
    health_check:
      type: command
      command: "curl -f http://localhost:3000"
      timeout: 10
      interval: 3
      max_retries: 20

  - name: worker
    dependencies:
      - redis
    start_command: "python worker.py"
    health_check:
      type: none
"""
    
    filename = "service-orchestrator-example.yaml"
    with open(filename, 'w') as f:
        f.write(example_content)
    
    click.echo(click.style(f"✅ Example configuration saved to: {filename}", fg="green"))
    click.echo("\nEdit this file to match your services, then run:")
    click.echo(click.style(f"  service-orchestrator run {filename}", fg="cyan"))


def main():
    cli()


if __name__ == "__main__":
    main()
