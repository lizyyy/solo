import os
import sys
from pathlib import Path
from typing import List, Optional

import click

from .analyzer import OrphanAnalyzer
from .report_generator import ReportGenerator
from .models import AnalysisResult


class ExitCode:
    SUCCESS = 0
    NO_PVCS = 1
    ORPHANS_FOUND = 2
    ERRORS = 3
    INVALID_INPUT = 4


def validate_input_paths(ctx, param, value):
    if not value:
        return value

    if isinstance(value, str):
        value = (value,)

    paths = []
    for path in value:
        p = Path(path)
        if not p.exists():
            raise click.BadParameter(f"Path does not exist: {path}")
        paths.append(str(p))
    return paths


def validate_output_dir(ctx, param, value):
    if not value:
        return value

    p = Path(value)
    if p.exists() and not p.is_dir():
        raise click.BadParameter(f"Output path is not a directory: {value}")
    return str(p)


@click.group()
@click.version_option(version="0.1.0", prog_name="pvc-orphan")
def main():
    """K8s PVC Orphan Finder - Detect unused PersistentVolumeClaims"""
    pass


@main.command()
@click.argument('paths', nargs=-1, callback=validate_input_paths, required=False)
@click.option('-f', '--file', 'files', multiple=True, type=click.Path(),
              callback=validate_input_paths,
              help='YAML file to analyze (can be specified multiple times)')
@click.option('-d', '--directory', type=click.Path(),
              callback=validate_input_paths,
              help='Directory containing YAML files to analyze')
@click.option('-o', '--output-dir', type=click.Path(), default='./pvc-reports',
              callback=validate_output_dir,
              help='Output directory for reports (default: ./pvc-reports)')
@click.option('--no-recursive', is_flag=True, default=False,
              help='Do not scan directories recursively')
@click.option('--format', 'output_format', type=click.Choice(['all', 'terminal', 'markdown', 'csv', 'json']),
              default='all',
              help='Output format (default: all)')
@click.option('--strict', is_flag=True, default=False,
              help='Exit with non-zero code on warnings')
@click.option('--fail-on-orphans', is_flag=True, default=False,
              help='Exit with code 2 if orphan PVCs are found')
@click.option('--namespace', 'namespaces', multiple=True,
              help='Filter by namespace (can be specified multiple times)')
def scan(paths, files, directory, output_dir, no_recursive, output_format,
         strict, fail_on_orphans, namespaces):
    """Scan YAML files for orphan PVCs"""

    all_paths = list(paths) + list(files)

    if not all_paths and not directory:
        click.echo(click.style("Error: No input specified. Provide files or a directory.", fg='red'), err=True)
        click.echo("Use -f for files, -d for directory, or pass paths as arguments.", err=True)
        sys.exit(ExitCode.INVALID_INPUT)

    click.echo(click.style("🔍 K8s PVC Orphan Finder", fg='cyan', bold=True))
    click.echo("")

    analyzer = OrphanAnalyzer()

    file_list = []
    dir_list = []

    if directory:
        if isinstance(directory, (list, tuple)):
            dir_list.extend(directory)
        else:
            dir_list.append(directory)

    for p in all_paths:
        p_path = Path(p)
        if p_path.is_dir():
            dir_list.append(p)
        elif p_path.is_file():
            file_list.append(p)

    try:
        all_resources = []

        for d in dir_list:
            click.echo(f"📂 Scanning directory: {d}")
            all_resources.extend(analyzer.parser.parse_directory(d, recursive=not no_recursive))

        for f in file_list:
            click.echo(f"📄 Analyzing file: {f}")
            all_resources.extend(analyzer.parser.parse_file(f))

        analyzer.errors.extend(analyzer.parser.errors)
        analyzer.warnings.extend(analyzer.parser.warnings)

        result = analyzer.analyze_resources(all_resources)

    except Exception as e:
        click.echo(click.style(f"❌ Fatal error during analysis: {e}", fg='red'), err=True)
        import traceback
        traceback.print_exc()
        sys.exit(ExitCode.ERRORS)

    if namespaces:
        result.pvcs = [p for p in result.pvcs if p.pvc.namespace in namespaces]

    click.echo(f"✅ Analysis complete. {result.total_pvc_count} PVCs, {result.orphan_count} orphan(s) found.")
    click.echo("")

    generator = ReportGenerator(output_dir=output_dir)

    outputs = {}
    if output_format == 'all':
        outputs = generator.generate_all(result)
    elif output_format == 'terminal':
        outputs['terminal'] = generator.generate_terminal_summary(result)
    elif output_format == 'markdown':
        outputs['markdown'] = generator.generate_markdown_report(result)
    elif output_format == 'csv':
        outputs['csv'] = generator.generate_csv_report(result)
    elif output_format == 'json':
        outputs['json'] = generator.generate_json_report(result)

    if 'terminal' in outputs:
        click.echo(outputs['terminal'])

    click.echo("📁 Generated Reports:")
    for fmt, path in outputs.items():
        if fmt != 'terminal':
            click.echo(f"   - {fmt.upper()}: {path}")

    exit_code = determine_exit_code(result, strict, fail_on_orphans)
    sys.exit(exit_code)


@main.command('list-resources')
@click.argument('paths', nargs=-1, callback=validate_input_paths, required=False)
@click.option('-f', '--file', 'files', multiple=True, type=click.Path(),
              callback=validate_input_paths)
@click.option('-d', '--directory', type=click.Path(),
              callback=validate_input_paths)
@click.option('--no-recursive', is_flag=True, default=False)
def list_resources(paths, files, directory, no_recursive):
    """List all resources found in YAML files"""

    all_paths = list(paths) + list(files)

    if not all_paths and not directory:
        click.echo(click.style("Error: No input specified.", fg='red'), err=True)
        sys.exit(ExitCode.INVALID_INPUT)

    file_list = []
    dir_list = []

    if directory:
        if isinstance(directory, (list, tuple)):
            dir_list.extend(directory)
        else:
            dir_list.append(directory)

    for p in all_paths:
        p_path = Path(p)
        if p_path.is_dir():
            dir_list.append(p)
        elif p_path.is_file():
            file_list.append(p)

    from .yaml_parser import YamlParser
    parser = YamlParser()

    resources = []

    for d in dir_list:
        resources.extend(parser.parse_directory(d, recursive=not no_recursive))

    for f in file_list:
        resources.extend(parser.parse_file(f))

    click.echo(f"Found {len(resources)} resources:")
    click.echo("")

    for r in resources:
        source = str(r.source) if r.source else "unknown"
        click.echo(f"  [{r.kind}] {r.namespace}/{r.name}  @ {source}")


def determine_exit_code(result: AnalysisResult, strict: bool, fail_on_orphans: bool) -> int:
    if result.errors:
        return ExitCode.ERRORS

    if strict and result.warnings:
        return ExitCode.ERRORS

    if result.total_pvc_count == 0:
        return ExitCode.NO_PVCS

    if fail_on_orphans and result.orphan_count > 0:
        return ExitCode.ORPHANS_FOUND

    return ExitCode.SUCCESS


if __name__ == '__main__':
    main()
