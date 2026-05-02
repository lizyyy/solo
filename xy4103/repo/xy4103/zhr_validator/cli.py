import os
from pathlib import Path
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from zhr_validator.models import (
    ProjectConfig,
    ObservationRecord,
    ValidationSeverity,
)
from zhr_validator.storage import StorageManager
from zhr_validator.validation import (
    validate_single_record,
    validate_batch_records,
)
from zhr_validator.astronomy import (
    calculate_single_zhr,
    calculate_aggregate_zhr,
)
from zhr_validator.reporter import Reporter


console = Console()


def get_storage_manager() -> StorageManager:
    return StorageManager(Path.cwd())


def require_project_initialized() -> StorageManager:
    storage = get_storage_manager()
    if not storage.is_project_initialized():
        console.print(
            "[red]错误: 项目未初始化。请先运行 'zhr init' 命令。[/red]"
        )
        raise click.Abort()
    return storage


@click.group()
@click.version_option(package_name="zhr-validator")
def cli():
    """流星雨 ZHR 复核器 - 业余天文社观测记录整理工具"""
    pass


@cli.command()
@click.option("--name", default="流星雨 ZHR 复核项目", help="项目名称")
@click.option("--shower", default="未指定流星雨", help="流星雨名称")
@click.option("--date", default=None, help="观测日期 (YYYY-MM-DD)")
@click.option("--timezone", default="Asia/Shanghai", help="默认时区")
@click.option("--pop-index", default=2.0, type=float, help="人口指数 (r)")
@click.option("--confidence", default=0.68, type=float, help="置信水平")
def init(
    name: str,
    shower: str,
    date: Optional[str],
    timezone: str,
    pop_index: float,
    confidence: float,
):
    """初始化新项目"""
    storage = get_storage_manager()

    if storage.is_project_initialized():
        console.print("[yellow]警告: 项目已存在配置文件[/yellow]")
        if not click.confirm("是否覆盖现有配置?", default=False):
            console.print("操作取消")
            return

    config = ProjectConfig(
        project_name=name,
        shower_name=shower,
        observation_date=date,
        default_timezone=timezone,
        population_index=pop_index,
        confidence_level=confidence,
    )

    storage.initialize_project(config)

    console.print(Panel.fit(
        "[green]✅ 项目初始化成功！[/green]\n\n"
        f"项目名称: [bold]{config.project_name}[/bold]\n"
        f"流星雨: [bold]{config.shower_name}[/bold]\n"
        f"数据目录: [bold]data/[/bold]\n"
        f"输出目录: [bold]output/[/bold]",
        title="初始化完成",
    ))


@cli.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--check-duplicates/--no-check-duplicates", default=True, help="检查重复提交")
@click.option("--check-overlaps/--no-check-overlaps", default=True, help="检查时段重叠")
def import_(files: List[str], check_duplicates: bool, check_overlaps: bool):
    """导入观测记录 CSV 文件"""
    if not files:
        console.print("[red]错误: 请指定至少一个 CSV 文件[/red]")
        raise click.Abort()

    storage = require_project_initialized()
    config = storage.load_config()

    file_paths = [Path(f) for f in files]
    all_records = storage.read_csv_files(file_paths)

    console.print(f"读取了 {len(all_records)} 条记录，正在校验...\n")

    batch_result = validate_batch_records(
        all_records,
        config,
        check_duplicates=check_duplicates,
        check_overlaps=check_overlaps,
    )

    valid_records: List[ObservationRecord] = []
    quarantine_items = []

    for idx, (raw_data, record_idx, source_file) in enumerate(all_records):
        vr = batch_result.detailed_results[idx] if idx < len(batch_result.detailed_results) else None

        if vr and vr.is_valid:
            _, record = validate_single_record(raw_data, record_idx, source_file, config)
            if record:
                valid_records.append(record)
        else:
            if vr:
                quarantine_items.append((raw_data, record_idx, source_file, vr.issues))

    if quarantine_items:
        storage.add_batch_to_quarantine(quarantine_items)

    if valid_records:
        storage.save_valid_records(valid_records)

    table = Table(title="导入结果")
    table.add_column("类别", style="cyan")
    table.add_column("数量", justify="right")
    table.add_row("总记录数", str(batch_result.total_records))
    table.add_row("[green]✅ 有效记录[/green]", str(batch_result.valid_records))
    table.add_row("[red]❌ 无效记录[/red]", str(batch_result.invalid_records))
    table.add_row("[yellow]⚠️ 有警告[/yellow]", str(batch_result.records_with_warnings))
    console.print(table)

    if batch_result.duplicate_observer_groups:
        console.print("\n[yellow]⚠️ 检测到潜在重复提交:[/yellow]")
        for idx, group in enumerate(batch_result.duplicate_observer_groups, 1):
            console.print(f"  组 {idx}: {', '.join(group)}")

    if batch_result.overlapping_period_groups:
        console.print("\n[yellow]⚠️ 检测到时段重叠:[/yellow]")
        for idx, group in enumerate(batch_result.overlapping_period_groups, 1):
            console.print(f"  组 {idx}: {', '.join(group)}")

    if quarantine_items:
        console.print(f"\n[red]❌ {len(quarantine_items)} 条记录已移入隔离区: output/quarantine.json[/red]")

    if valid_records:
        console.print(f"\n[green]✅ {len(valid_records)} 条有效记录已保存[/green]")


@cli.command()
@click.option("--show-details/--no-show-details", default=True, help="显示详细信息")
@click.option("--show-quarantine/--no-show-quarantine", default=False, help="显示隔离区内容")
def check(show_details: bool, show_quarantine: bool):
    """校验已导入的记录"""
    storage = require_project_initialized()
    config = storage.load_config()

    records = storage.load_valid_records()

    if not records:
        console.print("[yellow]没有已导入的有效记录。请先运行 'zhr import'。[/yellow]")
        return

    console.print(f"共有 {len(records)} 条已导入的记录\n")

    records_with_meta = []
    for rec in records:
        raw = rec.raw_data or {}
        records_with_meta.append((raw, rec.record_index or 0, rec.source_file or "unknown"))

    batch_result = validate_batch_records(
        records_with_meta,
        config,
        check_duplicates=True,
        check_overlaps=True,
    )

    table = Table(title="校验汇总")
    table.add_column("类别", style="cyan")
    table.add_column("数量", justify="right")
    table.add_row("总记录数", str(batch_result.total_records))
    table.add_row("[green]✅ 有效记录[/green]", str(batch_result.valid_records))
    table.add_row("[yellow]⚠️ 有警告[/yellow]", str(batch_result.records_with_warnings))
    console.print(table)

    issue_counts = batch_result.issues_by_severity
    if any(issue_counts.values()):
        console.print("\n问题分布:")
        if issue_counts.get(ValidationSeverity.ERROR, 0) > 0:
            console.print(f"  [red]❌ 错误: {issue_counts[ValidationSeverity.ERROR]}[/red]")
        if issue_counts.get(ValidationSeverity.WARNING, 0) > 0:
            console.print(f"  [yellow]⚠️ 警告: {issue_counts[ValidationSeverity.WARNING]}[/yellow]")
        if issue_counts.get(ValidationSeverity.INFO, 0) > 0:
            console.print(f"  [blue]ℹ️ 信息: {issue_counts[ValidationSeverity.INFO]}[/blue]")

    if batch_result.duplicate_observer_groups:
        console.print("\n[yellow]⚠️ 潜在重复提交:[/yellow]")
        for idx, group in enumerate(batch_result.duplicate_observer_groups, 1):
            console.print(f"  组 {idx}: {', '.join(group)}")

    if batch_result.overlapping_period_groups:
        console.print("\n[yellow]⚠️ 时段重叠:[/yellow]")
        for idx, group in enumerate(batch_result.overlapping_period_groups, 1):
            console.print(f"  组 {idx}: {', '.join(group)}")

    if show_details and batch_result.detailed_results:
        for vr in batch_result.detailed_results:
            if vr.issues:
                status = "❌ 失败" if not vr.is_valid else "⚠️ 有警告"
                console.print(f"\n{vr.source_file}: 行 {vr.record_index + 1} - {status}")
                for issue in vr.issues:
                    emoji = "❌" if issue.severity == "error" else "⚠️" if issue.severity == "warning" else "ℹ️"
                    console.print(f"  {emoji} [{issue.code}] {issue.message}")
                    if issue.suggestion:
                        console.print(f"     💡 建议: {issue.suggestion}")

    if show_quarantine:
        quarantine = storage.load_quarantine()
        if quarantine.entries:
            console.print(f"\n[red]📦 隔离区有 {len(quarantine.entries)} 条记录[/red]")
            for entry in quarantine.entries:
                console.print(f"  - {entry.source_file}: 行 {entry.record_index + 1}")
        else:
            console.print("\n[green]隔离区为空[/green]")

    reporter = Reporter(storage.output_dir)
    reporter.save_validation_report(
        batch_result,
        formats=["md", "json"],
    )
    console.print("\n[blue]📄 校验报告已保存到 output/ 目录[/blue]")


@cli.command()
@click.option("--shower", default=None, help="流星雨名称 (覆盖配置)")
@click.option("--pop-index", default=None, type=float, help="人口指数 (覆盖配置)")
@click.option("--confidence", default=None, type=float, help="置信水平 (覆盖配置)")
@click.option("--include-bad-weather", is_flag=True, help="包含坏天气数据")
def calc(
    shower: Optional[str],
    pop_index: Optional[float],
    confidence: Optional[float],
    include_bad_weather: bool,
):
    """计算 ZHR（每小时天顶流量）"""
    storage = require_project_initialized()
    config = storage.load_config()

    if shower:
        config.shower_name = shower
    if pop_index:
        config.population_index = pop_index
    if confidence:
        config.confidence_level = confidence

    records = storage.load_valid_records()

    if not records:
        console.print("[yellow]没有已导入的有效记录。请先运行 'zhr import'。[/yellow]")
        return

    if not include_bad_weather:
        bad_weather_count = sum(1 for r in records if r.is_bad_weather)
        if bad_weather_count > 0:
            console.print(f"[yellow]⚠️ 排除 {bad_weather_count} 条坏天气记录[/yellow]")
            records = [r for r in records if not r.is_bad_weather]

    if not records:
        console.print("[red]❌ 没有可用于计算的记录[/red]")
        return

    console.print(f"计算 {len(records)} 条记录的 ZHR...\n")

    calculations = []
    for rec in records:
        calc = calculate_single_zhr(rec, config)
        calculations.append(calc)

    observation_date = records[0].observation_date if records else ""

    batch_result = calculate_aggregate_zhr(
        calculations,
        config,
        shower_name=config.shower_name,
        observation_date=observation_date,
    )

    storage.save_zhr_result(batch_result)

    table = Table(title=f"{config.shower_name} ZHR 计算结果")
    table.add_column("指标", style="cyan")
    table.add_column("数值", justify="right")
    table.add_row("总记录数", str(batch_result.total_records))
    table.add_row("[green]可靠记录数[/green]", str(batch_result.reliable_records))
    table.add_row("[yellow]不可靠记录数[/yellow]", str(batch_result.unreliable_records))
    table.add_row("")
    table.add_row("[bold green]加权平均 ZHR[/bold green]", f"[bold]{batch_result.weighted_mean_zhr:.2f}[/bold]")
    table.add_row("简单平均 ZHR", f"{batch_result.mean_zhr:.2f}")
    table.add_row("中位数 ZHR", f"{batch_result.median_zhr:.2f}")
    table.add_row(
        f"置信区间 ({int(config.confidence_level*100)}%)",
        f"{batch_result.zhr_lower_aggregate:.2f} - {batch_result.zhr_upper_aggregate:.2f}",
    )
    console.print(table)

    detail_table = Table(title="详细记录")
    detail_table.add_column("观测者", style="cyan")
    detail_table.add_column("时段(UTC)", style="dim")
    detail_table.add_column("流星数", justify="right")
    detail_table.add_column("原始ZHR", justify="right")
    detail_table.add_column("校正ZHR", justify="right", style="green")
    detail_table.add_column("权重", justify="right")
    detail_table.add_column("状态")

    for calc in calculations:
        status = "✅" if calc.is_reliable else "⚠️"
        if calc.is_bad_weather:
            status = "❌"
        time_str = f"{calc.utc_start.strftime('%H:%M')}-{calc.utc_end.strftime('%H:%M')}"
        detail_table.add_row(
            calc.observer_name,
            time_str,
            str(calc.meteor_count),
            f"{calc.raw_zhr:.1f}",
            f"{calc.corrected_zhr:.1f}",
            f"{calc.observation_weight:.2f}",
            status,
        )
    console.print(detail_table)

    console.print("\n[green]✅ ZHR 计算完成，结果已保存[/green]")


@cli.command()
@click.option("--format", "-f", multiple=True, default=["md", "csv", "json"],
              type=click.Choice(["md", "csv", "json"]),
              help="输出格式 (可多次指定)")
@click.option("--output", "-o", default=None, help="输出文件名 (不含扩展名)")
@click.option("--include-quarantine", is_flag=True, help="包含隔离区报告")
def report(format: List[str], output: Optional[str], include_quarantine: bool):
    """导出报告 (Markdown/CSV/JSON)"""
    storage = require_project_initialized()
    reporter = Reporter(storage.output_dir)

    zhr_result = storage.load_zhr_result()

    if not zhr_result:
        console.print("[yellow]没有 ZHR 计算结果。请先运行 'zhr calc'。[/yellow]")
        return

    formats_list = list(format)
    output_files = reporter.save_zhr_report(
        zhr_result,
        formats=formats_list,
        base_filename=output,
    )

    console.print(Panel.fit(
        "[green]✅ 报告导出成功！[/green]\n\n" +
        "\n".join(f"- [bold]{fmt.upper()}[/bold]: {path.name}" for fmt, path in output_files.items()),
        title="导出完成",
    ))

    if include_quarantine:
        quarantine = storage.load_quarantine()
        if quarantine.entries:
            md_content = reporter.generate_quarantine_markdown(quarantine)
            q_path = storage.output_dir / "quarantine_report.md"
            q_path.write_text(md_content, encoding="utf-8")
            console.print(f"\n[blue]📄 隔离区报告: {q_path.name}[/blue]")


@cli.command()
@click.option("--yes", "-y", is_flag=True, help="不提示确认")
def clear(yes: bool):
    """清空隔离区"""
    storage = require_project_initialized()
    quarantine = storage.load_quarantine()

    if not quarantine.entries:
        console.print("[green]隔离区为空[/green]")
        return

    console.print(f"隔离区有 {len(quarantine.entries)} 条记录")

    if not yes:
        if not click.confirm("确定要清空隔离区吗?", default=False):
            console.print("操作取消")
            return

    count = storage.clear_quarantine()
    console.print(f"[green]✅ 已清空 {count} 条隔离记录[/green]")


@cli.command()
def status():
    """显示项目状态"""
    storage = get_storage_manager()

    if not storage.is_project_initialized():
        console.print("[yellow]项目未初始化。请运行 'zhr init'。[/yellow]")
        return

    config = storage.load_config()
    records = storage.load_valid_records()
    quarantine = storage.load_quarantine()
    zhr_result = storage.load_zhr_result()

    table = Table(title="项目状态")
    table.add_column("项目", style="cyan")
    table.add_column("值")
    table.add_row("项目名称", config.project_name)
    table.add_row("流星雨", config.shower_name)
    table.add_row("默认时区", config.default_timezone)
    table.add_row("人口指数 (r)", str(config.population_index))
    table.add_row("置信水平", f"{config.confidence_level*100:.0f}%")
    table.add_row("")
    table.add_row("[bold]数据统计[/bold]", "")
    table.add_row("有效记录数", str(len(records)))
    table.add_row("隔离区记录数", str(len(quarantine.entries)))
    table.add_row("")

    if zhr_result:
        table.add_row("[bold]ZHR 结果[/bold]", "")
        table.add_row("加权平均 ZHR", f"{zhr_result.weighted_mean_zhr:.2f}")
        table.add_row(
            "置信区间",
            f"{zhr_result.zhr_lower_aggregate:.2f} - {zhr_result.zhr_upper_aggregate:.2f}",
        )
    else:
        table.add_row("[yellow]ZHR 未计算[/yellow]", "")

    console.print(table)


if __name__ == "__main__":
    cli()
