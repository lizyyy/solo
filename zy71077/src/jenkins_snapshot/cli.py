import os
import sys
import json
from pathlib import Path
from typing import Optional

import click
from rich.console import Console

from . import __version__
from .reader import BuildRecordReader, InputValidator
from .archiver import ParameterArchiver
from .validator import ArtifactValidator, DiffComparator
from .reporter import ReportExporter
from .models import SnapshotReport, BuildRecord


console = Console()

EXIT_SUCCESS = 0
EXIT_ERROR = 1
EXIT_WARNING = 2
EXIT_INPUT_ERROR = 3


@click.group()
@click.version_option(__version__)
@click.option(
    '--output-dir', '-o',
    type=click.Path(file_okay=False),
    default='./snapshots',
    help='快照输出目录'
)
@click.option(
    '--quiet', '-q',
    is_flag=True,
    help='静默模式，减少输出'
)
@click.pass_context
def main(ctx, output_dir: str, quiet: bool):
    """Jenkins 参数快照 CLI - 离线保留每次构建输入和产物"""
    ctx.ensure_object(dict)
    ctx.obj['output_dir'] = output_dir
    ctx.obj['quiet'] = quiet


@main.command()
@click.argument('input_file', type=click.Path(exists=True, dir_okay=False))
@click.option(
    '--output-dir', '-o',
    type=click.Path(file_okay=False),
    help='覆盖全局输出目录'
)
@click.option(
    '--overwrite',
    is_flag=True,
    help='覆盖已存在的快照'
)
@click.option(
    '--rerun-suffix',
    type=str,
    help='为重跑创建变体快照，使用指定后缀'
)
@click.option(
    '--copy-artifacts',
    is_flag=True,
    help='复制产物文件到快照目录'
)
@click.option(
    '--artifact-base-dir',
    type=click.Path(exists=True, file_okay=False),
    help='产物文件的基础目录'
)
@click.option(
    '--skip-validation',
    is_flag=True,
    help='跳过输入校验'
)
@click.option(
    '--compare-with',
    type=str,
    help='与指定的构建号进行差异比较'
)
@click.option(
    '--export-report',
    is_flag=True,
    help='同时导出 JSON 和 Markdown 报告'
)
@click.pass_context
def archive(
    ctx,
    input_file: str,
    output_dir: Optional[str],
    overwrite: bool,
    rerun_suffix: Optional[str],
    copy_artifacts: bool,
    artifact_base_dir: Optional[str],
    skip_validation: bool,
    compare_with: Optional[str],
    export_report: bool,
):
    """归档 Jenkins 构建记录为快照

    INPUT_FILE: Jenkins 构建记录 JSON 文件路径"""
    try:
        actual_output_dir = output_dir or ctx.obj['output_dir']
        quiet = ctx.obj['quiet']

        if not quiet:
            console.print(f"[blue]读取构建记录:[/blue] {input_file}")

        reader = BuildRecordReader()
        record = reader.from_json_file(input_file)

        if not skip_validation:
            validator = InputValidator()
            validation = validator.validate_build_record(record)
            
            if artifact_base_dir:
                art_validation = validator.validate_artifact_paths(record, artifact_base_dir)
                validation.warnings.extend(art_validation.warnings)
                validation.valid = validation.valid and art_validation.valid
        else:
            from .models import SnapshotValidationResult
            validation = SnapshotValidationResult(valid=True)

        if not validation.valid and not quiet:
            console.print(f"[yellow]校验发现 {len(validation.errors)} 个错误，{len(validation.warnings)} 个警告[/yellow]")

        archiver = ParameterArchiver(actual_output_dir)

        if rerun_suffix:
            report, messages = archiver.archive_rerun(
                record=record,
                validation=validation,
                source_file=input_file,
                suffix=rerun_suffix,
                copy_artifacts=copy_artifacts,
                artifact_base_dir=artifact_base_dir,
            )
            created = True
        else:
            try:
                report, created, messages = archiver.archive_build(
                    record=record,
                    validation=validation,
                    source_file=input_file,
                    overwrite=overwrite,
                    copy_artifacts=copy_artifacts,
                    artifact_base_dir=artifact_base_dir,
                )
            except FileExistsError as e:
                console.print(f"[red]错误:[/red] {e}")
                sys.exit(EXIT_ERROR)

        if compare_with:
            old_report = archiver.load_snapshot(
                job_name=record.job_name,
                build_number=int(compare_with),
            )
            if old_report:
                comparator = DiffComparator()
                diff = comparator.compare_builds(old_report.build, record)
                report.diff = diff
                report.notes.append(f"与构建 #{compare_with} 进行了差异比较")

        if not quiet:
            reporter = ReportExporter(actual_output_dir)
            reporter.print_terminal_summary(report)

        if export_report:
            reporter = ReportExporter(actual_output_dir)
            results = reporter.export_all(report)
            if not quiet:
                console.print(f"[green]报告已导出:[/green]")
                for fmt, path in results.items():
                    console.print(f"  {fmt}: {path}")

        if validation.errors:
            sys.exit(EXIT_ERROR)
        if validation.warnings:
            sys.exit(EXIT_WARNING)
        sys.exit(EXIT_SUCCESS)

    except Exception as e:
        console.print(f"[red]归档失败:[/red] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(EXIT_ERROR)


@main.command('list')
@click.option(
    '--job', '-j',
    type=str,
    help='只列出指定 Job 的快照'
)
@click.option(
    '--output-dir', '-o',
    type=click.Path(file_okay=False),
    help='覆盖全局输出目录'
)
@click.option(
    '--format', '-f',
    type=click.Choice(['table', 'json', 'csv']),
    default='table',
    help='输出格式'
)
@click.pass_context
def list_snapshots(ctx, job: Optional[str], output_dir: Optional[str], format: str):
    """列出所有已归档的快照"""
    actual_output_dir = output_dir or ctx.obj['output_dir']
    archiver = ParameterArchiver(actual_output_dir)
    snapshots = archiver.list_snapshots(job)

    if format == 'json':
        print(json.dumps(snapshots, indent=2, ensure_ascii=False))
    elif format == 'csv':
        if snapshots:
            headers = snapshots[0].keys()
            print(','.join(headers))
            for snap in snapshots:
                print(','.join(str(snap.get(h, '')) for h in headers))
    else:
        from rich.table import Table
        table = Table(title="已归档快照")
        table.add_column("Job", style="cyan")
        table.add_column("构建号", style="magenta")
        table.add_column("状态", style="green")
        table.add_column("快照ID", style="yellow")
        table.add_column("创建时间", style="blue")
        table.add_column("路径", style="white")

        for snap in snapshots:
            build_num = snap['build_number']
            if 'rerun_suffix' in snap:
                build_num += f" (rerun: {snap['rerun_suffix']})"
            table.add_row(
                snap['job_name'],
                build_num,
                snap['status'],
                snap['snapshot_id'],
                snap['created_at'],
                snap['path'],
            )
        console.print(table)

    sys.exit(EXIT_SUCCESS)


@main.command()
@click.argument('job_name', type=str)
@click.argument('build_number', type=int)
@click.option(
    '--rerun-suffix',
    type=str,
    help='查看重跑变体快照'
)
@click.option(
    '--output-dir', '-o',
    type=click.Path(file_okay=False),
    help='覆盖全局输出目录'
)
@click.option(
    '--export-json',
    type=click.Path(dir_okay=False),
    help='导出为 JSON 文件'
)
@click.option(
    '--export-md',
    type=click.Path(dir_okay=False),
    help='导出为 Markdown 文件'
)
@click.pass_context
def show(
    ctx,
    job_name: str,
    build_number: int,
    rerun_suffix: Optional[str],
    output_dir: Optional[str],
    export_json: Optional[str],
    export_md: Optional[str],
):
    """查看已归档的快照详情"""
    actual_output_dir = output_dir or ctx.obj['output_dir']
    archiver = ParameterArchiver(actual_output_dir)
    
    report = archiver.load_snapshot(job_name, build_number, rerun_suffix)
    
    if not report:
        console.print(f"[red]未找到快照:[/red] {job_name} #{build_number}")
        sys.exit(EXIT_ERROR)

    reporter = ReportExporter(actual_output_dir)
    reporter.print_terminal_summary(report)

    if export_json:
        path = reporter.export_json(report, export_json)
        console.print(f"[green]JSON 已导出:[/green] {path}")

    if export_md:
        path = reporter.export_markdown(report, export_md)
        console.print(f"[green]Markdown 已导出:[/green] {path}")

    sys.exit(EXIT_SUCCESS if report.validation.valid else EXIT_WARNING)


@main.command()
@click.argument('job_name', type=str)
@click.argument('build_old', type=int)
@click.argument('build_new', type=int)
@click.option(
    '--output-dir', '-o',
    type=click.Path(file_okay=False),
    help='覆盖全局输出目录'
)
@click.option(
    '--export-report',
    is_flag=True,
    help='导出差异报告'
)
@click.pass_context
def diff(
    ctx,
    job_name: str,
    build_old: int,
    build_new: int,
    output_dir: Optional[str],
    export_report: bool,
):
    """比较两个构建快照的差异"""
    actual_output_dir = output_dir or ctx.obj['output_dir']
    archiver = ParameterArchiver(actual_output_dir)
    
    report_old = archiver.load_snapshot(job_name, build_old)
    report_new = archiver.load_snapshot(job_name, build_new)

    if not report_old:
        console.print(f"[red]未找到快照:[/red] {job_name} #{build_old}")
        sys.exit(EXIT_ERROR)
    if not report_new:
        console.print(f"[red]未找到快照:[/red] {job_name} #{build_new}")
        sys.exit(EXIT_ERROR)

    comparator = DiffComparator()
    diff_result = comparator.compare_builds(report_old.build, report_new.build)
    
    report_new.diff = diff_result

    reporter = ReportExporter(actual_output_dir)
    reporter._print_diff_summary(diff_result, console)

    summary = comparator.summarize_changes(diff_result)
    console.print(f"[cyan]变更统计:[/cyan]")
    for key, value in summary.items():
        if value:
            console.print(f"  {key}: {value}")

    if export_report:
        base_filename = f"diff_{job_name.replace('/', '_')}_{build_old}_{build_new}"
        results = reporter.export_all(report_new, base_filename)
        console.print(f"[green]差异报告已导出:[/green]")
        for fmt, path in results.items():
            console.print(f"  {fmt}: {path}")

    has_changes = any([
        diff_result.parameter_changes,
        diff_result.artifacts_added,
        diff_result.artifacts_removed,
        diff_result.artifacts_modified,
    ])
    sys.exit(EXIT_SUCCESS if not has_changes else EXIT_WARNING)


@main.command()
@click.argument('job_name', type=str)
@click.argument('build_number', type=int)
@click.option(
    '--artifact-base-dir',
    type=click.Path(exists=True, file_okay=False),
    help='产物文件的基础目录'
)
@click.option(
    '--output-dir', '-o',
    type=click.Path(file_okay=False),
    help='覆盖全局输出目录'
)
@click.pass_context
def validate(
    ctx,
    job_name: str,
    build_number: int,
    artifact_base_dir: Optional[str],
    output_dir: Optional[str],
):
    """校验快照中的产物文件完整性"""
    actual_output_dir = output_dir or ctx.obj['output_dir']
    archiver = ParameterArchiver(actual_output_dir)
    
    report = archiver.load_snapshot(job_name, build_number)
    
    if not report:
        console.print(f"[red]未找到快照:[/red] {job_name} #{build_number}")
        sys.exit(EXIT_ERROR)

    validator = ArtifactValidator(artifact_base_dir)
    validation = validator.validate_all_artifacts(report.build)

    report.validation = validation

    if validation.valid:
        console.print(f"[green]所有产物文件校验通过[/green]")
    else:
        console.print(f"[yellow]发现 {len(validation.warnings)} 个问题[/yellow]")
        for warn in validation.warnings:
            console.print(f"  [yellow]•[/yellow] {warn.field}: {warn.message}")

    sys.exit(EXIT_SUCCESS if validation.valid else EXIT_WARNING)


@main.command()
def help():
    """显示详细使用说明"""
    help_text = """
[bold blue]Jenkins 参数快照 CLI[/bold blue]

[bold]常用命令:[/bold]

  [cyan]archive[/cyan]    归档 Jenkins 构建记录
    [yellow]示例:[/yellow] jenkins-snapshot archive build.json --export-report

  [cyan]list[/cyan]       列出所有已归档的快照
    [yellow]示例:[/yellow] jenkins-snapshot list --job MyJob

  [cyan]show[/cyan]       查看快照详情
    [yellow]示例:[/yellow] jenkins-snapshot show MyJob 123 --export-md report.md

  [cyan]diff[/cyan]       比较两个构建的差异
    [yellow]示例:[/yellow] jenkins-snapshot diff MyJob 122 123

  [cyan]validate[/cyan]   校验产物文件完整性
    [yellow]示例:[/yellow] jenkins-snapshot validate MyJob 123

[bold]退出码说明:[/bold]
  [green]0[/green] 成功
  [red]1[/red] 错误
  [yellow]2[/yellow] 警告（校验有警告但可继续）
  [red]3[/red] 输入错误

[bold]处理重跑覆盖:[/bold]
  使用 --rerun-suffix 为同一构建号创建多个快照变体
  使用 --overwrite 强制覆盖现有快照

[bold]产物处理:[/bold]
  使用 --copy-artifacts 复制产物到快照目录
  使用 --artifact-base-dir 指定产物查找路径
"""
    console.print(help_text)


if __name__ == '__main__':
    main()
