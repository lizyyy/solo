import json
import sys
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table

from .analyzers import ConfigAnalyzer, AnalysisResult
from .analyzers.migration import MigrationAnalyzer
from .parsers import JsonParser, EnvParser, YamlParser, SqliteParser
from .reports import ReportExporter, ExportFormat
from .security import SecurityAnalyzer


console = Console()


@click.group()
@click.version_option(version="0.1.0")
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose output")
@click.pass_context
def main(ctx, verbose):
    """本地配置仓库诊断 CLI 工具
    
    用于检测多种配置格式混用问题，包括：
    - 配置项来源识别
    - 优先级覆盖分析
    - 版本迁移检测
    - 缺省值分析
    - 敏感字段明文检测
    - 无效枚举检测
    - 回滚风险评估
    """
    ctx.ensure_object(dict)
    ctx.obj['verbose'] = verbose


@main.command()
@click.argument('project_path', type=click.Path(exists=True, file_okay=False))
@click.option('--output', '-o', type=click.Path(), help='Output report file path')
@click.option('--format', '-f', type=click.Choice(['json', 'markdown']), default='markdown',
              help='Output format (json or markdown)')
@click.option('--security-only', is_flag=True, help='Only run security checks')
@click.option('--no-security', is_flag=True, help='Skip security checks')
@click.pass_context
def validate(ctx, project_path, output, format, security_only, no_security):
    """验证配置并生成诊断报告
    
    扫描项目目录中的所有配置文件，执行全面的诊断分析。
    """
    verbose = ctx.obj['verbose']
    
    if verbose:
        console.print(f"[bold blue]Scanning project:[/bold blue] {project_path}")
    
    analyzer = ConfigAnalyzer(project_path)
    parsed_configs = analyzer.scan_project()
    
    if not parsed_configs:
        console.print("[bold red]Error:[/bold red] No configuration files found.")
        sys.exit(1)
    
    if verbose:
        console.print(f"[bold green]Found[/bold green] {len(parsed_configs)} configuration file(s):")
        for config in parsed_configs:
            console.print(f"  - {config.source_path} ({config.config_type.value})")
            if config.errors:
                for error in config.errors:
                    console.print(f"    [yellow]Warning:[/yellow] {error}")
    
    if security_only:
        if verbose:
            console.print("[bold blue]Running security analysis only...[/bold blue]")
        
        security_analyzer = SecurityAnalyzer()
        for config in parsed_configs:
            security_analyzer.add_config(config)
        
        security_result = security_analyzer.analyze()
        
        _display_security_summary(security_result)
        
        if output:
            result = AnalysisResult(project_path=project_path, parsed_configs=parsed_configs)
            result.security_result = security_result
            exporter = ReportExporter(result)
            _save_report(exporter, output, format)
        
        return
    
    if verbose:
        console.print("[bold blue]Running full analysis...[/bold blue]")
    
    result = analyzer.analyze_all()
    
    _display_analysis_summary(result)
    
    if result.security_result and result.security_result.findings:
        _display_security_findings(result.security_result)
    
    if output:
        exporter = ReportExporter(result)
        _save_report(exporter, output, format)
        console.print(f"[bold green]Report saved to:[/bold green] {output}")
    
    if result.security_result and result.security_result.critical_count > 0:
        sys.exit(2)


@main.command()
@click.argument('project_a', type=click.Path(exists=True, file_okay=False))
@click.argument('project_b', type=click.Path(exists=True, file_okay=False))
@click.option('--output', '-o', type=click.Path(), help='Output diff file path')
@click.option('--format', '-f', type=click.Choice(['json', 'text']), default='text',
              help='Output format (json or text)')
@click.option('--show-values', is_flag=True, help='Show actual values in diff')
@click.pass_context
def diff(ctx, project_a, project_b, output, format, show_values):
    """比较两个项目的配置差异
    
    分析两个项目目录之间的配置差异，包括新增、删除和修改的配置项。
    """
    verbose = ctx.obj['verbose']
    
    if verbose:
        console.print(f"[bold blue]Comparing:[/bold blue]")
        console.print(f"  A: {project_a}")
        console.print(f"  B: {project_b}")
    
    analyzer_a = ConfigAnalyzer(project_a)
    analyzer_a.scan_project()
    
    analyzer_b = ConfigAnalyzer(project_b)
    analyzer_b.scan_project()
    
    diff_result = analyzer_a.diff(project_b, include_values=show_values)
    
    if format == 'json':
        output_text = json.dumps(diff_result, indent=2, ensure_ascii=False, default=str)
        if not output:
            console.print(output_text)
    else:
        output_lines = _format_text_diff(diff_result, show_values)
        output_text = "\n".join(output_lines)
        if not output:
            for line in output_lines:
                console.print(line)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(output_text)
        console.print(f"[bold green]Diff saved to:[/bold green] {output}")


@main.command('migrate-plan')
@click.argument('versions', nargs=-1, type=click.Path(exists=True, file_okay=False))
@click.option('--output', '-o', type=click.Path(), help='Output migration plan file path')
@click.option('--format', '-f', type=click.Choice(['json', 'markdown']), default='markdown',
              help='Output format (json or markdown)')
@click.pass_context
def migrate_plan(ctx, versions, output, format):
    """生成版本迁移计划
    
    分析多个版本的配置变化，生成详细的迁移计划和回滚风险评估。
    至少需要提供两个版本目录。
    """
    verbose = ctx.obj['verbose']
    
    if len(versions) < 2:
        console.print("[bold red]Error:[/bold red] At least two versions are required for migration analysis.")
        sys.exit(1)
    
    if verbose:
        console.print(f"[bold blue]Analyzing migration across {len(versions)} versions:[/bold blue]")
        for i, version in enumerate(versions, 1):
            console.print(f"  Version {i}: {version}")
    
    all_parsed_configs = []
    
    for version_path in versions:
        analyzer = ConfigAnalyzer(version_path)
        parsed = analyzer.scan_project()
        all_parsed_configs.append(parsed)
        
        if verbose:
            console.print(f"    Found {len(parsed)} config file(s)")
    
    migration_analyzer = MigrationAnalyzer()
    
    for i, version_configs in enumerate(all_parsed_configs):
        for config in version_configs:
            migration_analyzer.add_version(config, f"v{i + 1}")
    
    migration_result = migration_analyzer.analyze()
    migration_plan = migration_analyzer.generate_migration_plan()
    
    result = AnalysisResult(
        project_path=versions[0],
        parsed_configs=[c for configs in all_parsed_configs for c in configs]
    )
    result.migration_result = migration_result
    
    _display_migration_summary(migration_result, migration_plan)
    
    exporter = ReportExporter(result)
    
    if output:
        _save_report(exporter, output, format)
        console.print(f"[bold green]Migration plan saved to:[/bold green] {output}")
    else:
        if format == 'json':
            console.print(exporter.export_json())
        else:
            console.print(exporter.export_markdown())


@main.command()
@click.argument('project_path', type=click.Path(exists=True, file_okay=False))
@click.argument('output_path', type=click.Path())
@click.option('--format', '-f', type=click.Choice(['json', 'markdown']), default='markdown',
              help='Output format (json or markdown)')
@click.option('--title', '-t', help='Report title')
@click.option('--pretty/--no-pretty', default=True, help='Pretty print JSON output')
@click.pass_context
def export(ctx, project_path, output_path, format, title, pretty):
    """导出配置分析报告
    
    分析项目配置并导出为指定格式的报告文件。
    """
    verbose = ctx.obj['verbose']
    
    if verbose:
        console.print(f"[bold blue]Analyzing project:[/bold blue] {project_path}")
        console.print(f"[bold blue]Exporting to:[/bold blue] {output_path}")
    
    analyzer = ConfigAnalyzer(project_path)
    result = analyzer.analyze_all()
    
    exporter = ReportExporter(result)
    
    if format == 'json':
        exporter.save_json(output_path, pretty=pretty)
    else:
        exporter.save_markdown(output_path, title=title)
    
    console.print(f"[bold green]Report exported successfully:[/bold green] {output_path}")


def _display_analysis_summary(result: AnalysisResult):
    """显示分析摘要"""
    summary = result.summary
    
    table = Table(title="Analysis Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("Project Path", summary.get('project_path', 'N/A'))
    table.add_row("Config Files Found", str(summary.get('configs_found', 0)))
    table.add_row("Total Keys", str(summary.get('total_keys', 0)))
    
    console.print(table)
    
    if result.priority_result and result.priority_result.overridden_keys > 0:
        console.print(f"\n[bold yellow]⚠️  Found {result.priority_result.overridden_keys} overridden key(s)[/bold yellow]")
        
        for key, override in list(result.priority_result.overrides.items())[:5]:
            console.print(f"  - `{key}`: {override.effective_source.value} overrides {len(override.overridden_by)} source(s)")
        
        if len(result.priority_result.overrides) > 5:
            console.print(f"  ... and {len(result.priority_result.overrides) - 5} more")


def _display_security_summary(security_result):
    """显示安全摘要"""
    table = Table(title="Security Analysis")
    table.add_column("Severity", style="cyan")
    table.add_column("Count", style="green")
    
    table.add_row("Critical", str(security_result.critical_count), style="red")
    table.add_row("High", str(security_result.high_count), style="yellow")
    table.add_row("Medium", str(security_result.medium_count), style="blue")
    table.add_row("Low", str(security_result.low_count), style="green")
    table.add_row("Info", str(security_result.info_count), style="cyan")
    
    console.print(table)
    
    if security_result.total_findings > 0:
        console.print(f"\n[bold yellow]⚠️  Total security findings: {security_result.total_findings}[/bold yellow]")


def _display_security_findings(security_result):
    """显示安全发现详情"""
    if not security_result.findings:
        return
    
    console.print("\n[bold red]🔒 Security Findings:[/bold red]")
    
    critical_high = [f for f in security_result.findings if f.severity.value in ['critical', 'high']]
    
    for finding in critical_high[:10]:
        severity_color = "red" if finding.severity.value == "critical" else "yellow"
        console.print(f"\n  [{severity_color}]{finding.severity.value.upper()}[/{severity_color}]: {finding.description}")
        console.print(f"    Key: `{finding.key}`")
        console.print(f"    Source: {finding.source} ({finding.source_path})")
        console.print(f"    Suggestion: {finding.suggestion}")
    
    if len(critical_high) > 10:
        console.print(f"\n  ... and {len(critical_high) - 10} more critical/high severity findings")


def _display_migration_summary(migration_result, migration_plan):
    """显示迁移摘要"""
    table = Table(title="Migration Analysis")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    
    summary = migration_result.summary
    risk_dist = summary.get('risk_distribution', {})
    
    table.add_row("Versions Compared", str(summary.get('versions_compared', 0)))
    table.add_row("Total Changes", str(summary.get('total_changes', 0)))
    table.add_row("Added Keys", str(summary.get('added_keys', 0)))
    table.add_row("Removed Keys", str(summary.get('removed_keys', 0)))
    table.add_row("Modified Keys", str(summary.get('modified_keys', 0)))
    
    console.print(table)
    
    if migration_result.rollback_risks:
        console.print(f"\n[bold red]⚠️  Rollback Risks ({len(migration_result.rollback_risks)}):[/bold red]")
        for risk in migration_result.rollback_risks[:5]:
            console.print(f"  - [{risk.risk_level.value}]{risk.risk_level.value.upper()}[/{risk.risk_level.value}]: {risk.key}")


def _format_text_diff(diff_result: dict, show_values: bool) -> List[str]:
    """格式化文本差异输出"""
    lines = []
    
    lines.append("=" * 60)
    lines.append("CONFIG DIFF")
    lines.append("=" * 60)
    lines.append(f"Left:  {diff_result['left_project']}")
    lines.append(f"Right: {diff_result['right_project']}")
    lines.append("")
    
    summary = diff_result['summary']
    lines.append(f"Summary: +{summary['added']} -{summary['removed']} ~{summary['modified']}")
    lines.append("")
    
    added = diff_result.get('added_keys', [])
    removed = diff_result.get('removed_keys', [])
    modified = diff_result.get('modified_keys', [])
    
    if added:
        lines.append("[green]+ Added Keys:[/green]")
        for key in added[:20]:
            if show_values and isinstance(added, dict):
                lines.append(f"  + {key} = {added[key]}")
            else:
                lines.append(f"  + {key}")
        if len(added) > 20:
            lines.append(f"  ... and {len(added) - 20} more")
        lines.append("")
    
    if removed:
        lines.append("[red]- Removed Keys:[/red]")
        for key in removed[:20]:
            if show_values and isinstance(removed, dict):
                lines.append(f"  - {key} = {removed[key]}")
            else:
                lines.append(f"  - {key}")
        if len(removed) > 20:
            lines.append(f"  ... and {len(removed) - 20} more")
        lines.append("")
    
    if modified:
        lines.append("[yellow]~ Modified Keys:[/yellow]")
        for item in modified[:20]:
            if isinstance(item, dict):
                lines.append(f"  ~ {item['key']}")
                lines.append(f"    - Old: {item['old_value']}")
                lines.append(f"    + New: {item['new_value']}")
            else:
                lines.append(f"  ~ {item}")
        if len(modified) > 20:
            lines.append(f"  ... and {len(modified) - 20} more")
        lines.append("")
    
    return lines


def _save_report(exporter: ReportExporter, path: str, format: str):
    """保存报告到文件"""
    if format == 'json':
        exporter.save_json(path)
    else:
        exporter.save_markdown(path)


if __name__ == "__main__":
    main()
