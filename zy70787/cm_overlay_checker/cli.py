import os
import sys
import click
from typing import Optional, List
from .kustomize_parser import KustomizeParser
from .overlay_resolver import OverlayResolver
from .reporter import Reporter


@click.group()
def cli():
    pass


@cli.command()
@click.argument('base_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--layers', '-l', default='base,staging,prod', help='Comma-separated layer order')
@click.option('--output', '-o', type=click.Choice(['text', 'json', 'rich']), default='rich', help='Output format')
@click.option('--json-output', '-j', type=click.Path(dir_okay=False), help='Write JSON output to file')
@click.option('--text-output', '-t', type=click.Path(dir_okay=False), help='Write text report to file')
@click.option('--filter-cm', '-f', help='Filter by ConfigMap name (supports partial match)')
def check(base_dir: str, layers: str, output: str, json_output: Optional[str],
          text_output: Optional[str], filter_cm: Optional[str]):

    layer_list = [x.strip() for x in layers.split(',') if x.strip()]

    parser = KustomizeParser(base_dir, layer_list)
    layer_data = parser.parse_all_layers()

    if not layer_data:
        click.echo("Error: No valid layers found", err=True)
        sys.exit(1)

    resolver = OverlayResolver(layer_data, layer_list)
    report = resolver.generate_report(base_dir)

    report.errors.extend(parser.errors)
    report.warnings.extend(parser.warnings)
    report.total_conflicts_count += len(parser.warnings)

    if filter_cm:
        report.configmaps = [
            cm for cm in report.configmaps
            if filter_cm.lower() in cm.name.lower()
        ]

    reporter = Reporter(report)

    if output == 'text':
        text_report = reporter.generate_human_readable()
        click.echo(text_report)
    elif output == 'json':
        json_report = reporter.generate_machine_readable(pretty=True)
        click.echo(json_report)
    elif output == 'rich':
        reporter.print_rich()

    if json_output:
        with open(json_output, 'w', encoding='utf-8') as f:
            f.write(reporter.generate_machine_readable(pretty=True))
        click.echo(f"JSON report written to: {json_output}")

    if text_output:
        with open(text_output, 'w', encoding='utf-8') as f:
            f.write(reporter.generate_human_readable())
        click.echo(f"Text report written to: {text_output}")

    exit_code = 1 if report.errors or report.total_conflicts_count > 0 else 0
    sys.exit(exit_code)


@cli.command()
@click.argument('base_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
def list_layers(base_dir: str):
    parser = KustomizeParser(base_dir)
    layers = parser.discover_layers()
    if layers:
        click.echo("Available layers:")
        for layer in layers:
            click.echo(f"  - {layer}")
    else:
        click.echo("No valid layers found", err=True)


@cli.command()
@click.argument('base_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
def list_configmaps(base_dir: str):
    parser = KustomizeParser(base_dir)
    layer_data = parser.parse_all_layers()

    all_cms = set()
    for layer_name, layer in layer_data.items():
        for cm_key in layer.configmaps:
            all_cms.add(cm_key)

    if all_cms:
        click.echo("ConfigMaps found:")
        for cm in sorted(all_cms):
            click.echo(f"  - {cm}")
    else:
        click.echo("No ConfigMaps found")


if __name__ == '__main__':
    cli()
