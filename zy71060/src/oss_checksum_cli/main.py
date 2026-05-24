import os
import sys
import time
import uuid
from pathlib import Path
from datetime import datetime
from typing import Optional, List

import click
from rich.console import Console
from rich.panel import Panel

from . import __version__
from .models import (
    Manifest, ValidationReport, ValidationIssue,
    ExitCode, ChecksumAlgorithm
)
from .parser import ManifestParser, ManifestParseError
from .validator import FileValidator
from .region_comparer import RegionComparer
from .reporter import ReportGenerator

console = Console()


class InputValidator:
    @staticmethod
    def validate_manifest_path(ctx, param, value):
        if not value:
            return value
        path = Path(value)
        if not path.exists():
            raise click.BadParameter(f"Manifest file not found: {value}")
        if not path.is_file():
            raise click.BadParameter(f"Path is not a file: {value}")
        return value

    @staticmethod
    def validate_chunks_dir(ctx, param, value):
        if not value:
            return value
        path = Path(value)
        if not path.exists():
            raise click.BadParameter(f"Chunks directory not found: {value}")
        if not path.is_dir():
            raise click.BadParameter(f"Path is not a directory: {value}")
        return value

    @staticmethod
    def validate_output_dir(ctx, param, value):
        if not value:
            return value
        path = Path(value)
        try:
            path.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            raise click.BadParameter(f"Cannot create output directory: {e}")
        return value


@click.group(invoke_without_command=True)
@click.version_option(version=__version__, prog_name="oss-check")
@click.option("--help", "-h", is_flag=True, help="Show this message and exit.")
@click.pass_context
def cli(ctx, help):
    """
    对象存储校验清单 CLI - 校验分片、checksum 和区域副本一致性

    用于验证备份数据上传到对象存储后的完整性，包括:
    - Manifest 清单解析
    - 分片文件完整性校验
    - Checksum 格式转换和验证
    - 多区域副本一致性对比
    - 缺失分片定位
    - 详细校验报告导出
    """
    if ctx.invoked_subcommand is None:
        if help:
            click.echo(ctx.get_help())
            ctx.exit(0)
        else:
            click.echo(ctx.get_help())
            ctx.exit(ExitCode.INPUT_ERROR)


@cli.command()
@click.argument("manifest_path", callback=InputValidator.validate_manifest_path)
@click.option(
    "--chunks-dir", "-c",
    type=click.Path(),
    callback=InputValidator.validate_chunks_dir,
    help="本地分片文件所在目录（用于实际校验分片内容）"
)
@click.option(
    "--output-dir", "-o",
    type=click.Path(),
    default="./reports",
    callback=InputValidator.validate_output_dir,
    help="报告输出目录，默认: ./reports"
)
@click.option(
    "--compare-regions/--no-compare-regions",
    default=True,
    help="是否对比多区域副本一致性，默认: 开启"
)
@click.option(
    "--algorithm", "-a",
    type=click.Choice([a.value for a in ChecksumAlgorithm]),
    multiple=True,
    help="指定校验算法（可多选），默认使用 manifest 中定义的算法"
)
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="显示详细输出"
)
@click.option(
    "--quiet", "-q",
    is_flag=True,
    help="静默模式，只输出最终结果"
)
def validate(
    manifest_path: str,
    chunks_dir: Optional[str],
    output_dir: str,
    compare_regions: bool,
    algorithm: List[str],
    verbose: bool,
    quiet: bool
):
    """
    校验对象存储备份数据的完整性

    MANIFEST_PATH: Manifest 文件路径（支持 JSON/YAML 格式）
    """
    start_time = time.time()

    if not quiet:
        console.print(Panel.fit(
            f"[bold blue]对象存储校验清单 CLI v{__version__}[/bold blue]\n"
            f"开始校验: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            border_style="blue"
        ))

    try:
        parser = ManifestParser()
        manifest = parser.parse(manifest_path)
    except ManifestParseError as e:
        console.print(f"[bold red]✗ Manifest 解析失败:[/bold red] {e}")
        sys.exit(ExitCode.INPUT_ERROR)
    except Exception as e:
        console.print(f"[bold red]✗ 未知错误:[/bold red] {e}")
        sys.exit(ExitCode.UNKNOWN_ERROR)

    if not quiet:
        console.print(f"[green]✓[/green] Manifest 加载成功: {manifest.manifest_id}")
        console.print(f"  - 文件数: {manifest.total_files}")
        console.print(f"  - 分片数: {manifest.total_chunks}")
        console.print(f"  - 总大小: {manifest.total_size:,} bytes")
        console.print(f"  - 区域数: {len(manifest.regions)} ({', '.join(manifest.get_regions())})")

    report = ValidationReport(
        report_id=str(uuid.uuid4()),
        generated_at=datetime.now(),
        manifest_id=manifest.manifest_id
    )

    all_issues: List[ValidationIssue] = []

    if chunks_dir:
        if not quiet:
            console.print()
            console.print("[cyan]正在校验分片文件...[/cyan]")

        file_validator = FileValidator(chunks_dir)
        total_chunks = 0

        for region_name, region_copy in manifest.regions.items():
            for file_id, file in region_copy.files.items():
                issues = file_validator.validate_file(file, chunks_dir)
                all_issues.extend(issues)
                total_chunks += len(file.chunks)

                if verbose and not quiet:
                    status_icon = "[green]✓[/green]" if file.status.value == "ok" else "[red]✗[/red]"
                    console.print(f"  {status_icon} {file.file_name}: {file.present_chunks}/{file.expected_chunks} 分片")

        report.files_checked = manifest.total_files
        report.chunks_checked = total_chunks

    if compare_regions and len(manifest.regions) > 1:
        if not quiet:
            console.print()
            console.print("[cyan]正在对比多区域副本...[/cyan]")

        comparer = RegionComparer()
        region_result, region_issues = comparer.compare_regions(manifest)
        all_issues.extend(region_issues)
        report.region_comparison = region_result

        if verbose and not quiet:
            summary = region_result.get("summary", {})
            console.print(f"  - 对比文件: {summary.get('total_files_checked', 0)}")
            console.print(f"  - 差异文件: {summary.get('files_with_differences', 0)}")
            console.print(f"  - 差异分片: {summary.get('chunks_with_differences', 0)}")

    report.issues = all_issues
    report.duration_seconds = time.time() - start_time

    if not quiet:
        console.print()
        console.print("[cyan]正在生成报告...[/cyan]")

    reporter = ReportGenerator(output_dir=output_dir, verbose=verbose)
    report_paths = reporter.generate_all(report, manifest)

    if not quiet:
        reporter.print_console_summary(report, manifest)

        console.print()
        console.print("[cyan]报告文件已生成:[/cyan]")
        for format_name, path in report_paths.items():
            console.print(f"  - {format_name.upper()}: {path}")

    if report.has_errors:
        sys.exit(ExitCode.VALIDATION_ERROR)
    else:
        sys.exit(ExitCode.SUCCESS)


@cli.command()
@click.argument("manifest_path", callback=InputValidator.validate_manifest_path)
@click.option(
    "--output-format", "-f",
    type=click.Choice(["json", "yaml", "text"]),
    default="text",
    help="输出格式，默认: text"
)
def inspect(manifest_path: str, output_format: str):
    """
    查看 Manifest 文件内容

    MANIFEST_PATH: Manifest 文件路径
    """
    try:
        parser = ManifestParser()
        manifest = parser.parse(manifest_path)
    except ManifestParseError as e:
        console.print(f"[bold red]✗ Manifest 解析失败:[/bold red] {e}")
        sys.exit(ExitCode.INPUT_ERROR)

    if output_format == "json":
        import json
        print(json.dumps({
            "manifest_id": manifest.manifest_id,
            "version": manifest.version,
            "created_at": manifest.created_at.isoformat() if manifest.created_at else None,
            "source": manifest.source,
            "total_files": manifest.total_files,
            "total_chunks": manifest.total_chunks,
            "total_size": manifest.total_size,
            "regions": list(manifest.regions.keys()),
            "checksum_algorithms": [a.value for a in manifest.checksum_algorithms]
        }, indent=2, ensure_ascii=False))
    elif output_format == "yaml":
        try:
            import yaml
            print(yaml.dump({
                "manifest_id": manifest.manifest_id,
                "version": manifest.version,
                "created_at": manifest.created_at,
                "source": manifest.source,
                "total_files": manifest.total_files,
                "total_chunks": manifest.total_chunks,
                "total_size": manifest.total_size,
                "regions": list(manifest.regions.keys()),
                "checksum_algorithms": [a.value for a in manifest.checksum_algorithms]
            }, allow_unicode=True))
        except ImportError:
            console.print("[yellow]⚠ PyYAML 未安装，使用 text 格式替代[/yellow]")
            _print_text_inspect(manifest)
    else:
        _print_text_inspect(manifest)

    sys.exit(ExitCode.SUCCESS)


def _print_text_inspect(manifest: Manifest):
    console.print(Panel.fit("[bold blue]Manifest 信息[/bold blue]"))
    console.print()
    console.print(f"  Manifest ID:  [cyan]{manifest.manifest_id}[/cyan]")
    console.print(f"  版本:         {manifest.version}")
    console.print(f"  创建时间:     {manifest.created_at}")
    console.print(f"  数据源:       {manifest.source}")
    console.print()
    console.print(f"  [bold]统计信息:[/bold]")
    console.print(f"    文件数:     {manifest.total_files}")
    console.print(f"    分片数:     {manifest.total_chunks}")
    console.print(f"    总大小:     {manifest.total_size:,} bytes")
    console.print()
    console.print(f"  [bold]存储区域 ({len(manifest.regions)}):[/bold]")
    for region_name, region_copy in manifest.regions.items():
        console.print(f"    - {region_name}:")
        console.print(f"        Bucket: {region_copy.bucket}")
        console.print(f"        文件:   {len(region_copy.files)}")
        console.print(f"        分片:   {len(region_copy.get_all_chunks())}")
        if region_copy.last_sync:
            console.print(f"        同步:   {region_copy.last_sync}")


@cli.command()
@click.option(
    "--output-dir", "-o",
    type=click.Path(),
    default="./examples",
    help="示例文件输出目录"
)
@click.option(
    "--with-bad-data",
    is_flag=True,
    help="包含坏数据示例（用于测试）"
)
def examples(output_dir: str, with_bad_data: bool):
    """
    生成示例 Manifest 文件和测试数据
    """
    from .example_generator import ExampleGenerator

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    generator = ExampleGenerator(output_path)
    paths = generator.generate_all(include_bad_data=with_bad_data)

    console.print(f"[green]✓[/green] 示例文件已生成到: {output_dir}")
    for name, path in paths.items():
        console.print(f"  - {name}: {path}")

    sys.exit(ExitCode.SUCCESS)


@cli.command()
def list_exit_codes():
    """
    列出所有退出码及其含义
    """
    console.print(Panel.fit("[bold blue]退出码列表[/bold blue]"))
    console.print()

    for code in ExitCode:
        console.print(f"  [cyan]{code.value:2d}[/cyan]  {code.name:18}  -  {_get_exit_code_description(code)}")

    console.print()
    console.print("[dim]提示: 在脚本中可以通过 $? 获取上一条命令的退出码[/dim]")


def _get_exit_code_description(code: ExitCode) -> str:
    descriptions = {
        ExitCode.SUCCESS: "校验成功，没有发现错误",
        ExitCode.VALIDATION_ERROR: "校验失败，发现数据完整性问题",
        ExitCode.INPUT_ERROR: "输入错误（文件不存在、格式错误等）",
        ExitCode.IO_ERROR: "文件读写错误",
        ExitCode.CONFIG_ERROR: "配置错误",
        ExitCode.UNKNOWN_ERROR: "未知错误",
    }
    return descriptions.get(code, "")


if __name__ == "__main__":
    cli()
