#!/usr/bin/env python3
import sys
from pathlib import Path
from typing import Optional
import click
from rich.console import Console
from rich.panel import Panel
from .config import CliConfig, get_default_output_dir
from .plan_parser import PlanParser
from .output_generator import OutputGenerator

console = Console()


@click.group()
@click.version_option(version="0.1.0", prog_name="tf-drift-summary")
def main():
    """Terraform漂移摘要CLI - 从plan输出生成简洁、可操作的漂移报告"""
    pass


@main.command()
@click.argument('input_file', type=click.Path(exists=True, path_type=Path))
@click.option('--output-dir', '-o', type=click.Path(path_type=Path),
              help='输出目录 (默认: ./drift_summaries)')
@click.option('--team-mapping', '-t', type=click.Path(path_type=Path),
              help='团队映射JSON文件路径')
@click.option('--sensitive-fields', '-s', multiple=True,
              help='需要遮蔽的敏感字段名（可多次指定）')
@click.option('--no-mask', is_flag=True, help='禁用敏感字段遮蔽')
@click.option('--show-noop', is_flag=True, help='显示无变更资源')
@click.option('--format', '-f', type=click.Choice(['terminal', 'json', 'html', 'all']),
              default='all', help='输出格式 (默认: all)')
@click.option('--force', is_flag=True, help='强制覆盖已有输出文件')
@click.option('--verbose', '-v', count=True, help='详细输出（可多次使用）')
def generate(
    input_file: Path,
    output_dir: Optional[Path],
    team_mapping: Optional[Path],
    sensitive_fields: tuple,
    no_mask: bool,
    show_noop: bool,
    format: str,
    force: bool,
    verbose: int,
):
    """从Terraform plan文件生成漂移摘要报告"""
    try:
        output_dir = output_dir or get_default_output_dir()
        
        if verbose > 0:
            console.print(f"[blue]输入文件:[/blue] {input_file}")
            console.print(f"[blue]输出目录:[/blue] {output_dir}")
        
        CliConfig.validate_input(input_file)
        CliConfig.validate_output_dir(output_dir, force)
        
        config = CliConfig(
            input_file=input_file,
            output_dir=output_dir,
            team_mapping_file=team_mapping,
            sensitive_fields=list(sensitive_fields) if sensitive_fields else None,
            mask_sensitive=not no_mask,
            show_noop=show_noop,
            format=format,
            force=force,
            verbosity=verbose,
        )
        
        if verbose > 1:
            console.print(Panel.fit("开始解析plan文件...", style="green"))
        
        parser = PlanParser(config)
        summary = parser.parse()
        
        if summary.errors and verbose > 0:
            console.print(f"[yellow]解析过程中发现 {len(summary.errors)} 个错误[/yellow]")
        
        generator = OutputGenerator(config, console)
        
        if format in ['terminal', 'all']:
            generator.print_terminal_summary(summary)
        
        if format in ['json', 'all']:
            json_path = generator.export_json(summary)
            console.print(f"[green]✓[/green] JSON报告已导出: {json_path}")
        
        if format in ['html', 'all']:
            html_path = generator.export_html(summary)
            console.print(f"[green]✓[/green] HTML报告已导出: {html_path}")
        
        console.print(Panel.fit(
            f"摘要生成完成！\n"
            f"总变更: {summary.total_changes} | "
            f"需关注: {summary.changes_requiring_attention} | "
            f"错误: {len(summary.errors)}",
            style="bold green",
            title="完成"
        ))
        
    except Exception as e:
        console.print(f"[red]错误:[/red] {str(e)}")
        if verbose > 0:
            import traceback
            console.print(traceback.format_exc())
        sys.exit(1)


@main.command()
@click.argument('json_file', type=click.Path(exists=True, path_type=Path))
@click.option('--output-dir', '-o', type=click.Path(path_type=Path),
              help='输出目录')
@click.option('--force', is_flag=True, help='强制覆盖')
def reformat(json_file: Path, output_dir: Optional[Path], force: bool):
    """从已有的JSON摘要重新生成其他格式报告"""
    try:
        import json
        from .models import DriftSummary
        
        output_dir = output_dir or json_file.parent
        CliConfig.validate_output_dir(output_dir, force)
        
        config = CliConfig(
            input_file=json_file,
            output_dir=output_dir,
            force=force,
        )
        
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        summary = DriftSummary(**data)
        
        generator = OutputGenerator(config, console)
        generator.print_terminal_summary(summary)
        
        html_path = generator.export_html(summary)
        console.print(f"[green]✓[/green] HTML报告已导出: {html_path}")
        
    except Exception as e:
        console.print(f"[red]错误:[/red] {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
