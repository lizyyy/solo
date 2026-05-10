from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .batch_comparator import BatchComparator
from .curve_importer import CurveImporter, ImportError
from .cupping_analyzer import CupScoreManager
from .first_cracker import FirstCrackDetector
from .heating_rate import HeatingRateCalculator
from .models import RoastBatch
from .report_generator import ReportGenerator


console = Console()

env_storage = os.environ.get("ROAST_REVIEW_STORAGE")
if env_storage:
    STORAGE_DIR = Path(env_storage)
else:
    cwd = Path.cwd()
    STORAGE_DIR = cwd / ".roast_review" / "batches"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def load_batches_from_storage() -> dict:
    """从存储加载所有批次"""
    batches = {}
    for file_path in STORAGE_DIR.glob("*.json"):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            batches[file_path.stem] = RoastBatch.model_validate(data)
        except Exception:
            continue
    return batches


def save_batch_to_storage(batch: RoastBatch):
    """保存批次到存储"""
    file_path = STORAGE_DIR / f"{batch.batch_id}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(batch.model_dump_json(indent=2, by_alias=False))


def get_batch(batch_id: str) -> RoastBatch:
    """获取指定批次"""
    batches = load_batches_from_storage()
    if batch_id not in batches:
        console.print(f"[red]错误: 批次 '{batch_id}' 不存在[/red]")
        sys.exit(1)
    return batches[batch_id]


@click.group()
@click.version_option(version="0.1.0", prog_name="roast")
def main():
    """咖啡豆烘焙曲线复盘 CLI"""
    pass


@main.group()
def import_cmd():
    """导入烘焙曲线数据"""
    pass


@import_cmd.command("file")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--batch-id", help="自定义批次ID (默认使用文件名)")
def import_file(file_path, batch_id):
    """导入单个烘焙曲线文件"""
    importer = CurveImporter()
    try:
        batch = importer.import_file(file_path)
        if batch_id:
            batch = batch.model_copy(update={"batch_id": batch_id})

        save_batch_to_storage(batch)

        console.print(f"[green]✓ 成功导入批次: {batch.batch_id}[/green]")
        console.print(f"  咖啡名称: {batch.coffee_name}")
        console.print(f"  数据点数量: {len(batch.curve_points)}")

        if importer.warnings:
            console.print("\n[yellow]警告:[/yellow]")
            for w in importer.warnings:
                console.print(f"  - {w}")
    except ImportError as e:
        console.print(f"[red]导入失败: {e}[/red]")
        sys.exit(1)


@import_cmd.command("dir")
@click.argument("dir_path", type=click.Path(exists=True, file_okay=False))
def import_directory(dir_path):
    """导入目录下的所有烘焙曲线文件"""
    importer = CurveImporter()
    try:
        batches = importer.import_directory(dir_path)

        for batch in batches:
            save_batch_to_storage(batch)
            console.print(f"[green]✓ {batch.batch_id}: {batch.coffee_name}[/green]")

        console.print(f"\n共导入 {len(batches)} 个批次")

        if importer.errors:
            console.print("\n[red]错误:[/red]")
            for e in importer.errors:
                console.print(f"  - {e}")

        if importer.warnings:
            console.print("\n[yellow]警告:[/yellow]")
            for w in importer.warnings:
                console.print(f"  - {w}")
    except ImportError as e:
        console.print(f"[red]导入失败: {e}[/red]")
        sys.exit(1)


@main.group()
def first_crack():
    """一爆标记管理"""
    pass


@first_crack.command("detect")
@click.argument("batch_id")
def detect_first_crack(batch_id):
    """自动检测一爆点"""
    batch = get_batch(batch_id)
    detector = FirstCrackDetector()

    fc = detector.detect_auto(batch)

    if fc:
        batch = batch.model_copy(update={"first_crack": fc})
        save_batch_to_storage(batch)

        minutes = int(fc.start_time_seconds // 60)
        seconds = int(fc.start_time_seconds % 60)

        console.print(f"[green]✓ 自动检测到一爆:[/green]")
        console.print(f"  时间: {minutes}:{seconds:02d} ({fc.start_time_seconds}s)")
        console.print(f"  温度: {fc.start_temp}°C")
        console.print(f"  类型: {fc.crack_type.value}")
        if fc.notes:
            console.print(f"  备注: {fc.notes}")
    else:
        console.print("[yellow]未能自动检测到一爆点，请使用 'first-crack mark' 手动标记[/yellow]")

    if detector.warnings:
        console.print("\n[yellow]警告:[/yellow]")
        for w in detector.warnings:
            console.print(f"  - {w}")


@first_crack.command("mark")
@click.argument("batch_id")
@click.option("--time", "start_time_seconds", type=float, required=True, help="一爆开始时间（秒）")
@click.option("--temp", "start_temp", type=float, help="一爆开始温度（°C）")
@click.option("--end-time", "end_time_seconds", type=float, help="一爆结束时间（秒）")
@click.option("--end-temp", "end_temp", type=float, help="一爆结束温度（°C）")
@click.option("--intensity", default="medium", type=click.Choice(["low", "medium", "high"]), help="一爆强度")
@click.option("--notes", help="备注")
def mark_first_crack(batch_id, start_time_seconds, start_temp, end_time_seconds, end_temp, intensity, notes):
    """手动标记一爆点"""
    batch = get_batch(batch_id)
    detector = FirstCrackDetector()

    try:
        batch = detector.mark_manual(
            batch=batch,
            start_time_seconds=start_time_seconds,
            start_temp=start_temp,
            end_time_seconds=end_time_seconds,
            end_temp=end_temp,
            intensity=intensity,
            notes=notes,
        )
        save_batch_to_storage(batch)

        fc = batch.first_crack
        minutes = int(fc.start_time_seconds // 60)
        seconds = int(fc.start_time_seconds % 60)

        console.print(f"[green]✓ 已标记一爆:[/green]")
        console.print(f"  时间: {minutes}:{seconds:02d}")
        console.print(f"  温度: {fc.start_temp}°C")
        console.print(f"  类型: {fc.crack_type.value}")
    except ValueError as e:
        console.print(f"[red]标记失败: {e}[/red]")
        sys.exit(1)


@first_crack.command("validate")
@click.argument("batch_id")
def validate_first_crack(batch_id):
    """验证一爆标记"""
    batch = get_batch(batch_id)
    detector = FirstCrackDetector()

    issues = detector.validate_existing(batch)

    if issues:
        console.print(f"[yellow]发现 {len(issues)} 个问题:[/yellow]")
        for issue in issues:
            console.print(f"  - {issue}")
    else:
        console.print("[green]✓ 一爆标记有效[/green]")


@main.group()
def cup_score():
    """杯测分数管理"""
    pass


@cup_score.command("add")
@click.argument("batch_id")
@click.option("--aroma", type=float, required=True, help="香气 (0-10)")
@click.option("--flavor", type=float, required=True, help="风味 (0-10)")
@click.option("--aftertaste", type=float, required=True, help="余韵 (0-10)")
@click.option("--acidity", type=float, required=True, help="酸质 (0-10)")
@click.option("--body", type=float, required=True, help="醇厚度 (0-10)")
@click.option("--balance", type=float, required=True, help="平衡 (0-10)")
@click.option("--uniformity", type=float, required=True, help="一致性 (0-10)")
@click.option("--overall", type=float, required=True, help="整体 (0-10)")
@click.option("--defects", type=float, default=0.0, help="缺陷分")
def add_cup_score(batch_id, aroma, flavor, aftertaste, acidity, body, balance, uniformity, overall, defects):
    """添加杯测分数"""
    batch = get_batch(batch_id)
    manager = CupScoreManager()

    try:
        batch = manager.associate(
            batch=batch,
            aroma=aroma,
            flavor=flavor,
            aftertaste=aftertaste,
            acidity=acidity,
            body=body,
            balance=balance,
            uniformity=uniformity,
            overall=overall,
            defects=defects,
        )
        save_batch_to_storage(batch)

        cs = batch.cup_score
        console.print(f"[green]✓ 已添加杯测分数:[/green]")
        console.print(f"  总分: {cs.total_score}")
        console.print(f"  等级: {cs.quality_level}")
    except ValueError as e:
        console.print(f"[red]添加失败: {e}[/red]")
        sys.exit(1)


@cup_score.command("import")
@click.argument("batch_id")
@click.argument("file_path", type=click.Path(exists=True))
def import_cup_score(batch_id, file_path):
    """从文件导入杯测分数"""
    batch = get_batch(batch_id)
    manager = CupScoreManager()

    try:
        batch = manager.import_from_file(batch, file_path)
        save_batch_to_storage(batch)

        cs = batch.cup_score
        console.print(f"[green]✓ 已导入杯测分数:[/green]")
        console.print(f"  总分: {cs.total_score}")
        console.print(f"  等级: {cs.quality_level}")
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")
        sys.exit(1)


@main.command("list")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def list_batches(verbose):
    """列出所有批次"""
    batches = load_batches_from_storage()

    if not batches:
        console.print("[yellow]没有找到任何批次[/yellow]")
        console.print("使用 'roast import file <path>' 或 'roast import dir <path>' 导入数据")
        return

    table = Table(title=f"烘焙批次列表 ({len(batches)} 个)")
    table.add_column("批次ID", style="cyan")
    table.add_column("咖啡名称")
    table.add_column("烘焙时间")
    table.add_column("一爆标记", justify="center")
    table.add_column("杯测分数", justify="center")

    for batch_id, batch in sorted(batches.items()):
        total_time = "--:--"
        if batch.total_roast_time_seconds:
            minutes = int(batch.total_roast_time_seconds // 60)
            seconds = int(batch.total_roast_time_seconds % 60)
            total_time = f"{minutes}:{seconds:02d}"

        has_fc = "[green]✓[/green]" if batch.first_crack else "[red]✗[/red]"

        cup_score = "--"
        if batch.cup_score:
            cup_score = f"{batch.cup_score.total_score:.1f}"

        table.add_row(batch_id, batch.coffee_name or "--", total_time, has_fc, cup_score)

    console.print(table)

    if verbose:
        for batch_id, batch in sorted(batches.items()):
            console.print(f"\n[bold]{batch_id}[/bold]")
            if batch.origin:
                console.print(f"  产地: {batch.origin}")
            if batch.process_method:
                console.print(f"  处理法: {batch.process_method}")
            if batch.first_crack:
                fc = batch.first_crack
                minutes = int(fc.start_time_seconds // 60)
                seconds = int(fc.start_time_seconds % 60)
                console.print(f"  一爆: {minutes}:{seconds:02d} @ {fc.start_temp}°C ({fc.crack_type.value})")
            if batch.cup_score:
                console.print(f"  杯测: {batch.cup_score.total_score} ({batch.cup_score.quality_level})")


@main.command("show")
@click.argument("batch_id")
def show_batch(batch_id):
    """显示批次详情"""
    batch = get_batch(batch_id)

    console.print(Panel.fit(
        f"[bold cyan]{batch.batch_id}[/bold cyan]\n"
        f"咖啡: {batch.coffee_name}\n"
        f"产地: {batch.origin or '--'}\n"
        f"处理法: {batch.process_method or '--'}\n"
        f"烘焙日期: {batch.roast_date.strftime('%Y-%m-%d')}\n",
        title="批次信息"
    ))

    if batch.curve_points:
        console.print(f"\n[bold]温度曲线:[/bold]")
        console.print(f"  数据点数量: {len(batch.curve_points)}")
        console.print(f"  总烘焙时间: {batch.total_roast_time_seconds or '--'}s")
        console.print(f"  出炉温度: {batch.dropout_temp or '--'}°C")
        console.print(f"  生豆重: {batch.green_weight_g}g")
        if batch.roasted_weight_g:
            console.print(f"  熟豆重: {batch.roasted_weight_g}g")
            console.print(f"  减重: {batch.weight_loss_percent or '--'}%")

    if batch.first_crack:
        fc = batch.first_crack
        minutes = int(fc.start_time_seconds // 60)
        seconds = int(fc.start_time_seconds % 60)
        console.print(f"\n[bold]一爆信息:[/bold]")
        console.print(f"  开始时间: {minutes}:{seconds:02d}")
        console.print(f"  开始温度: {fc.start_temp}°C")
        console.print(f"  类型: {fc.crack_type.value}")
        if fc.duration_seconds:
            console.print(f"  持续时间: {fc.duration_seconds}s")
        if batch.get_first_crack_time_ratio():
            console.print(f"  时间比例: {batch.get_first_crack_time_ratio():.1%}")

    if batch.cup_score:
        cs = batch.cup_score
        console.print(f"\n[bold]杯测分数:[/bold]")
        console.print(f"  总分: {cs.total_score} ({cs.quality_level})")
        table = Table(show_header=True)
        table.add_column("维度")
        table.add_column("分数", justify="right")
        table.add_row("香气", f"{cs.aroma:.1f}")
        table.add_row("风味", f"{cs.flavor:.1f}")
        table.add_row("余韵", f"{cs.aftertaste:.1f}")
        table.add_row("酸质", f"{cs.acidity:.1f}")
        table.add_row("醇厚度", f"{cs.body:.1f}")
        table.add_row("平衡", f"{cs.balance:.1f}")
        table.add_row("一致性", f"{cs.uniformity:.1f}")
        table.add_row("整体", f"{cs.overall:.1f}")
        if cs.defects > 0:
            table.add_row("缺陷", f"-{cs.defects:.1f}")
        console.print(table)


@main.command("compare")
@click.argument("batch_ids", nargs=-1, required=True)
def compare_batches(batch_ids):
    """对比多个批次"""
    batches = load_batches_from_storage()

    missing = [bid for bid in batch_ids if bid not in batches]
    if missing:
        console.print(f"[red]以下批次不存在: {', '.join(missing)}[/red]")
        sys.exit(1)

    selected_batches = [batches[bid] for bid in batch_ids]
    comparator = BatchComparator()
    comparison = comparator.compare(selected_batches)

    console.print(Panel(f"对比批次: {', '.join(batch_ids)}", title="批次对比"))

    table = Table(title="对比摘要")
    table.add_column("批次")
    table.add_column("烘焙时间")
    table.add_column("出炉温")
    table.add_column("一爆时间")
    table.add_column("一爆温")
    table.add_column("一爆类型")
    table.add_column("杯测分")

    for row in comparison["comparison_table"]:
        table.add_row(
            row["batch_id"],
            row.get("total_time", "--:--"),
            f"{row['dropout_temp']:.1f}" if row.get("dropout_temp") else "--",
            row.get("fc_start_time", "--:--"),
            f"{row['fc_start_temp']:.1f}" if row.get("fc_start_temp") else "--",
            row.get("fc_crack_type", "--"),
            f"{row['cup_score_total']:.1f}" if row.get("cup_score_total") else "--",
        )

    console.print(table)

    if comparison["anomalies"]:
        console.print("\n[yellow]异常检测:[/yellow]")
        for anomaly in comparison["anomalies"]:
            severity = anomaly.get("severity", "medium")
            style = "red" if severity == "high" else "yellow"
            console.print(f"  [{style}][{severity.upper()}][/{style}] {anomaly['batch_id']}: {anomaly['message']}")

    if comparison["recommendations"]:
        console.print("\n[green]建议:[/green]")
        for i, rec in enumerate(comparison["recommendations"], 1):
            console.print(f"  {i}. {rec}")


@main.command("report")
@click.argument("batch_ids", nargs=-1)
@click.option("--all", "-a", "use_all", is_flag=True, help="使用所有批次")
@click.option("--report-id", help="自定义报告ID")
@click.option("--output-dir", default="./reports", help="输出目录")
@click.option("--format", "report_format", default="txt", type=click.Choice(["txt", "json"]), help="报告格式")
@click.option("--no-charts", is_flag=True, help="不生成图表")
def generate_report(batch_ids, use_all, report_id, output_dir, report_format, no_charts):
    """生成复盘报告"""
    batches = load_batches_from_storage()

    if use_all:
        if not batches:
            console.print("[red]没有找到任何批次[/red]")
            sys.exit(1)
        selected_batches = list(batches.values())
    else:
        if not batch_ids:
            console.print("[red]请指定批次ID或使用 --all 选项[/red]")
            sys.exit(1)

        missing = [bid for bid in batch_ids if bid not in batches]
        if missing:
            console.print(f"[red]以下批次不存在: {', '.join(missing)}[/red]")
            sys.exit(1)

        selected_batches = [batches[bid] for bid in batch_ids]

    console.print(f"正在生成报告 (共 {len(selected_batches)} 个批次)...")

    generator = ReportGenerator(output_dir=output_dir)

    try:
        report = generator.generate(
            batches=selected_batches,
            report_id=report_id,
            generate_charts=not no_charts,
        )

        report_path = generator.save_report(report, format=report_format)

        console.print(f"\n[green]✓ 报告已生成:[/green]")
        console.print(f"  文件: {report_path}")

        if report.chart_paths:
            console.print(f"\n[green]图表文件:[/green]")
            for path in report.chart_paths:
                console.print(f"  - {path}")

        console.print(f"\n[bold]摘要:[/bold]")
        summary = report.summary
        console.print(f"  总批次数: {len(report.batch_ids)}")
        console.print(f"  有一爆标记: {summary.get('with_first_crack', 0)}")
        console.print(f"  有杯测分数: {summary.get('with_cup_score', 0)}")

        if report.anomalies:
            console.print(f"\n[yellow]检测到 {len(report.anomalies)} 个异常[/yellow]")

        if report.recommendations:
            console.print(f"\n[green]生成 {len(report.recommendations)} 条建议[/green]")

    except Exception as e:
        console.print(f"[red]报告生成失败: {e}[/red]")
        sys.exit(1)


@main.command("analyze")
@click.argument("batch_ids", nargs=-1)
@click.option("--all", "-a", "use_all", is_flag=True, help="使用所有批次")
def analyze_heating_rate(batch_ids, use_all):
    """分析升温率"""
    batches = load_batches_from_storage()

    if use_all:
        if not batches:
            console.print("[red]没有找到任何批次[/red]")
            sys.exit(1)
        selected_batches = list(batches.values())
    else:
        if not batch_ids:
            console.print("[red]请指定批次ID或使用 --all 选项[/red]")
            sys.exit(1)

        missing = [bid for bid in batch_ids if bid not in batches]
        if missing:
            console.print(f"[red]以下批次不存在: {', '.join(missing)}[/red]")
            sys.exit(1)

        selected_batches = [batches[bid] for bid in batch_ids]

    calculator = HeatingRateCalculator()

    console.print(Panel(f"升温率分析", title="升温率剖面"))

    table = Table(title="升温率对比")
    table.add_column("批次")
    table.add_column("峰值升温率", justify="right")
    table.add_column("一爆前平均", justify="right")
    table.add_column("一爆后平均", justify="right")
    table.add_column("异常数", justify="right")

    for batch in selected_batches:
        profile = calculator.calculate(batch)

        peak_rate = f"{profile.peak_rate:.3f}" if profile.peak_rate else "--"
        avg_before = f"{profile.avg_rate_0_to_first_crack:.3f}" if profile.avg_rate_0_to_first_crack else "--"
        avg_after = f"{profile.avg_rate_first_crack_to_drop:.3f}" if profile.avg_rate_first_crack_to_drop else "--"

        table.add_row(
            batch.batch_id,
            peak_rate,
            avg_before,
            avg_after,
            str(len(profile.anomalies)),
        )

        if profile.anomalies:
            for anomaly in profile.anomalies:
                console.print(f"  [yellow]{batch.batch_id}: {anomaly}[/yellow]")

    console.print(table)


@main.command("correlate")
@click.argument("batch_ids", nargs=-1)
@click.option("--all", "-a", "use_all", is_flag=True, help="使用所有批次")
def analyze_correlations(batch_ids, use_all):
    """分析烘焙参数与杯测分数的相关性"""
    batches = load_batches_from_storage()

    if use_all:
        if not batches:
            console.print("[red]没有找到任何批次[/red]")
            sys.exit(1)
        selected_batches = list(batches.values())
    else:
        if not batch_ids:
            console.print("[red]请指定批次ID或使用 --all 选项[/red]")
            sys.exit(1)

        missing = [bid for bid in batch_ids if bid not in batches]
        if missing:
            console.print(f"[red]以下批次不存在: {', '.join(missing)}[/red]")
            sys.exit(1)

        selected_batches = [batches[bid] for bid in batch_ids]

    manager = CupScoreManager()
    result = manager.analyze_correlations(selected_batches)

    if "error" in result:
        console.print(f"[yellow]{result['error']}[/yellow]")
        return

    console.print(Panel(f"相关性分析 ({result['total_batches_analyzed']} 个批次)", title="相关性分析"))

    table = Table(title="烘焙参数与杯测分数相关性")
    table.add_column("因素")
    table.add_column("相关系数", justify="right")
    table.add_column("解释")

    for corr in result["correlations"]:
        table.add_row(
            corr["factor"],
            f"{corr['correlation']:.3f}",
            corr["interpretation"],
        )

    console.print(table)

    if result["insights"]:
        console.print("\n[green]洞察:[/green]")
        for insight in result["insights"]:
            console.print(f"  - {insight}")


if __name__ == "__main__":
    main()
