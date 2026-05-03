"""
排烟联动复核 CLI 主入口
"""

import click
from pathlib import Path
from typing import Optional

from smoke_cli import __version__
from smoke_cli.readers import read_all_data
from smoke_cli.validator import run_full_validation
from smoke_cli.reviewer import run_review
from smoke_cli.exporter import export_issues, export_smoke_review


@click.group()
@click.version_option(__version__, "-v", "--version")
@click.option("--sample-dir", "-d", default="./sample", help="样本数据目录路径", show_default=True)
@click.pass_context
def main(ctx, sample_dir: str):
    """商场消防维保人员离线复核排烟联动 CLI 工具"""
    ctx.ensure_object(dict)
    ctx.obj["sample_dir"] = sample_dir


@main.command()
@click.pass_context
def validate(ctx):
    """验证数据文件的完整性和格式正确性"""
    sample_dir = ctx.obj["sample_dir"]
    click.echo(f"正在验证数据目录: {sample_dir}")
    click.echo("")

    data, read_errors = read_all_data(sample_dir)

    if read_errors:
        click.echo(click.style("读取阶段发现错误:", fg="red"))
        for error in read_errors:
            line_info = f" 第{error.line_number}行" if error.line_number else ""
            click.echo(f"  [{error.issue_type.value}] {error.file_path}{line_info}: {error.message}")
            if error.field_name:
                click.echo(f"    字段: {error.field_name}")
            if error.raw_value:
                click.echo(f"    原始值: {error.raw_value}")
        click.echo("")

    validation_errors = run_full_validation(data)

    if validation_errors:
        click.echo(click.style("验证阶段发现错误:", fg="yellow"))
        for error in validation_errors:
            line_info = f" 第{error.line_number}行" if error.line_number else ""
            click.echo(f"  [{error.issue_type.value}] {error.file_path}{line_info}: {error.message}")
        click.echo("")

    total_errors = len(read_errors) + len(validation_errors)

    if total_errors == 0:
        click.echo(click.style("验证通过！未发现任何错误。", fg="green"))
    else:
        click.echo(click.style(f"验证完成，共发现 {total_errors} 个问题。", fg="yellow"))
        click.echo("请运行 'smoke-cli review' 获取更多分析详情，或 'smoke-cli export' 导出完整报告。")


@main.command()
@click.option("--output", "-o", help="输出目录路径", default="./output")
@click.pass_context
def review(ctx, output: str):
    """复核排烟联动，重建时间线并分析问题"""
    sample_dir = ctx.obj["sample_dir"]
    click.echo(f"正在分析数据目录: {sample_dir}")
    click.echo("")

    data, read_errors = read_all_data(sample_dir)
    validation_errors = run_full_validation(data)

    if not data.get("zones"):
        click.echo(click.style("错误: 未找到有效的防烟分区配置数据", fg="red"))
        ctx.exit(1)

    click.echo("正在重建时间线并分析...")
    analyses = run_review(
        zones=data["zones"],
        fans=data["fans"],
        damper_events=data["damper_events"],
        sensor_minutes=data["sensor_minutes"],
    )

    click.echo("")
    click.echo("=" * 60)
    click.echo("复核结果摘要")
    click.echo("=" * 60)
    click.echo("")

    total_issues = 0
    for analysis in analyses:
        zone_issues = len(analysis.issues)
        total_issues += zone_issues

        status = click.style("正常", fg="green") if zone_issues == 0 else click.style(f"有{zone_issues}个问题", fg="yellow")
        click.echo(f"防烟分区: {analysis.zone_name} ({analysis.zone_id}) - {status}")

        if analysis.start_delay_seconds is not None:
            delay_status = click.style(f"{analysis.start_delay_seconds:.1f}秒", fg="green") if analysis.start_delay_seconds <= 30 else click.style(f"{analysis.start_delay_seconds:.1f}秒 (超标)", fg="red")
            click.echo(f"  启动延迟: {delay_status}")

        if analysis.effective_exhaust_volume is not None:
            click.echo(f"  有效排烟量: {analysis.effective_exhaust_volume:.2f} m³")

        if analysis.issues:
            for issue in analysis.issues:
                issue_type = issue.get("issue_type", "unknown")
                time_str = issue.get("time", "")
                time_info = f" ({time_str})" if time_str else ""
                click.echo(f"    - [{issue_type}] {issue.get('description', '')}{time_info}")
        click.echo("")

    total_all_issues = total_issues + len(read_errors) + len(validation_errors)

    if total_all_issues == 0:
        click.echo(click.style("所有防烟分区复核通过，未发现问题！", fg="green"))
    else:
        click.echo(click.style(f"复核完成，共发现 {total_all_issues} 个问题。", fg="yellow"))

    click.echo("")
    click.echo(f"运行 'smoke-cli export --output {output}' 可导出完整报告。")


@main.command()
@click.option("--output", "-o", help="输出目录路径", default="./output")
@click.pass_context
def export(ctx, output: str):
    """导出复核报告 (issues.csv 和 smoke_review.md)"""
    sample_dir = ctx.obj["sample_dir"]
    output_dir = Path(output)

    click.echo(f"正在从 {sample_dir} 读取数据...")

    data, read_errors = read_all_data(sample_dir)

    if not data.get("zones") and not read_errors:
        click.echo(click.style("警告: 未找到防烟分区配置数据", fg="yellow"))

    validation_errors = run_full_validation(data)
    analyses = []

    if data.get("zones"):
        click.echo("正在进行复核分析...")
        analyses = run_review(
            zones=data["zones"],
            fans=data["fans"],
            damper_events=data["damper_events"],
            sensor_minutes=data["sensor_minutes"],
        )

    output_dir.mkdir(parents=True, exist_ok=True)

    click.echo("正在导出 issues.csv...")
    issues_path = export_issues(
        analyses=analyses,
        validation_errors=read_errors + validation_errors,
        output_path=str(output_dir / "issues.csv"),
    )

    click.echo("正在导出 smoke_review.md...")
    review_path = export_smoke_review(
        analyses=analyses,
        validation_errors=read_errors + validation_errors,
        output_path=str(output_dir / "smoke_review.md"),
    )

    click.echo("")
    click.echo(click.style("导出完成！", fg="green"))
    click.echo(f"  - 问题列表: {issues_path}")
    click.echo(f"  - 复核报告: {review_path}")


if __name__ == "__main__":
    main()
