import os
from pathlib import Path
from typing import Dict, Any

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .importer import DataImporter
from .validator import CheckpointValidator, AidStationValidator, MedicalEventValidator
from .state_manager import ReviewStateManager
from .exporter import ReportExporter, format_duration

console = Console()


def load_and_validate(data_dir: str, state_dir: str = ".trail_checker") -> Dict[str, Any]:
    importer = DataImporter(data_dir)
    data = importer.import_all()

    if not data["race_config"]:
        console.print("[red]错误: 未找到赛事配置文件 race_config.json[/red]")
        return {}

    race_config = data["race_config"]
    registrations = data["registrations"]
    timing_records = data["timing_records"]
    aid_consumptions = data["aid_station_consumptions"]
    medical_events = data["medical_events"]

    cp_validator = CheckpointValidator(race_config)
    aid_validator = AidStationValidator(race_config)
    medical_validator = MedicalEventValidator(race_config)

    runners = cp_validator.validate_all_runners(
        registrations, timing_records, medical_events
    )
    aid_checks = aid_validator.validate_consumptions(aid_consumptions)
    medical_checks = medical_validator.validate_events(medical_events, registrations)

    state_manager = ReviewStateManager(state_dir)
    state_manager.apply_saved_states(runners, aid_checks, medical_checks)

    runners_started = sum(1 for r in runners if r.start_time is not None)
    runners_finished = sum(1 for r in runners if r.race_status in ["完赛", "完赛(需复核)"])
    runners_not_finished = sum(
        1 for r in runners if r.race_status not in ["完赛", "完赛(需复核)", "未出发"]
    )
    runners_cutoff = sum(1 for r in runners if r.cutoff_violations)
    runners_needs_review = sum(1 for r in runners if r.review_status != "ok")
    aid_anomalies = sum(1 for a in aid_checks if a.anomalies)
    medical_total = len(medical_checks)
    medical_follow_up = sum(1 for m in medical_checks if m.needs_follow_up)

    summary = {
        "total_registrations": len(registrations),
        "runners_started": runners_started,
        "runners_finished": runners_finished,
        "runners_not_finished": runners_not_finished,
        "runners_cutoff": runners_cutoff,
        "runners_needs_review": runners_needs_review,
        "aid_stations_anomalies": aid_anomalies,
        "medical_events_total": medical_total,
        "medical_events_follow_up": medical_follow_up,
    }

    return {
        "race_config": race_config,
        "registrations": registrations,
        "runners": runners,
        "aid_checks": aid_checks,
        "medical_checks": medical_checks,
        "summary": summary,
        "duplicates": data["duplicates_removed"],
        "state_manager": state_manager,
        "timing_records_count": len(timing_records),
        "aid_records_count": len(aid_consumptions),
    }


@click.group()
@click.version_option("0.1.0", prog_name="trail-checker")
def main():
    """越野跑赛事数据校验CLI工具"""
    pass


@main.command()
@click.argument("data_dir", type=click.Path(exists=True, file_okay=False))
@click.option("--state-dir", default=".trail_checker", help="状态文件存储目录")
def check(data_dir: str, state_dir: str):
    """校验赛事数据并显示摘要"""
    result = load_and_validate(data_dir, state_dir)
    if not result:
        return

    race_config = result["race_config"]
    summary = result["summary"]
    runners = result["runners"]
    aid_checks = result["aid_checks"]
    medical_checks = result["medical_checks"]
    duplicates = result["duplicates"]

    console.print(Panel.fit(
        f"[bold blue]{race_config.race_name}[/bold blue]\n"
        f"日期: {race_config.race_date} | 距离: {race_config.distance_km} km",
        title="赛事信息"
    ))

    if duplicates["total"] > 0:
        console.print(f"[yellow]去重统计: 共移除 {duplicates['total']} 条重复记录[/yellow]")

    table = Table(title="总体统计")
    table.add_column("指标", style="cyan")
    table.add_column("数量", style="magenta")
    table.add_row("报名人数", str(summary["total_registrations"]))
    table.add_row("出发人数", str(summary["runners_started"]))
    table.add_row("完赛人数", str(summary["runners_finished"]))
    table.add_row("未完赛人数", str(summary["runners_not_finished"]))
    table.add_row("超时人数", str(summary["runners_cutoff"]))
    table.add_row("需复核选手", str(summary["runners_needs_review"]))
    table.add_row("补给站异常", str(summary["aid_stations_anomalies"]))
    table.add_row("医疗事件", str(summary["medical_events_total"]))
    table.add_row("需回访事件", str(summary["medical_events_follow_up"]))
    console.print(table)

    needs_review = [r for r in runners if r.review_status != "ok"]
    if needs_review:
        table = Table(title="需复核选手")
        table.add_column("参赛号", style="cyan")
        table.add_column("姓名", style="magenta")
        table.add_column("状态", style="yellow")
        table.add_column("缺失检查点", style="red")
        table.add_column("复核状态", style="blue")
        for r in needs_review:
            missing = ", ".join(r.checkpoints_missing) if r.checkpoints_missing else "无"
            table.add_row(r.bib, r.name, r.race_status, missing, r.review_status)
        console.print(table)

    aid_with_anomalies = [a for a in aid_checks if a.anomalies]
    if aid_with_anomalies:
        table = Table(title="补给站异常")
        table.add_column("站点ID", style="cyan")
        table.add_column("名称", style="magenta")
        table.add_column("异常数量", style="red")
        for a in aid_with_anomalies:
            table.add_row(a.station_id, a.station_name, str(len(a.anomalies)))
        console.print(table)

    medical_needs_follow = [m for m in medical_checks if m.needs_follow_up]
    if medical_needs_follow:
        table = Table(title="需回访医疗事件")
        table.add_column("事件ID", style="cyan")
        table.add_column("参赛号", style="magenta")
        table.add_column("姓名", style="blue")
        table.add_column("严重程度", style="red")
        table.add_column("复核状态", style="yellow")
        for m in medical_needs_follow:
            table.add_row(m.event_id, m.bib, m.runner_name, m.severity, m.review_status)
        console.print(table)

    console.print("\n[green]校验完成！使用 'trail-checker export' 导出报告[/green]")


@main.command()
@click.argument("data_dir", type=click.Path(exists=True, file_okay=False))
@click.option("--state-dir", default=".trail_checker", help="状态文件存储目录")
@click.option("--output", "-o", default="race_report.md", help="报告输出路径")
@click.option("--audit-output", "-a", default="audit_package.json", help="审计包输出路径")
def export(data_dir: str, state_dir: str, output: str, audit_output: str):
    """导出Markdown报告和JSON审计包"""
    result = load_and_validate(data_dir, state_dir)
    if not result:
        return

    race_config = result["race_config"]
    runners = result["runners"]
    aid_checks = result["aid_checks"]
    medical_checks = result["medical_checks"]
    summary = result["summary"]

    exporter = ReportExporter(race_config)

    report_content = exporter.generate_markdown_report(
        runners, aid_checks, medical_checks, summary
    )
    exporter.export_report(output, report_content)
    console.print(f"[green]Markdown报告已导出: {output}[/green]")

    audit_package = exporter.generate_audit_package(
        runners,
        aid_checks,
        medical_checks,
        summary,
        total_registrations=summary["total_registrations"],
        total_timing_records=result["timing_records_count"],
        total_aid_records=result["aid_records_count"],
        total_medical_events=len(medical_checks),
    )
    exporter.export_audit_package(audit_output, audit_package)
    console.print(f"[green]JSON审计包已导出: {audit_output}[/green]")


@main.command()
@click.argument("data_dir", type=click.Path(exists=True, file_okay=False))
@click.option("--state-dir", default=".trail_checker", help="状态文件存储目录")
def list_runners(data_dir: str, state_dir: str):
    """列出所有选手状态"""
    result = load_and_validate(data_dir, state_dir)
    if not result:
        return

    runners = result["runners"]

    table = Table(title="选手状态列表")
    table.add_column("参赛号", style="cyan")
    table.add_column("姓名", style="magenta")
    table.add_column("状态", style="yellow")
    table.add_column("用时", style="green")
    table.add_column("复核状态", style="blue")

    for r in sorted(runners, key=lambda x: x.total_time_seconds or float('inf')):
        duration = format_duration(r.total_time_seconds)
        table.add_row(r.bib, r.name, r.race_status, duration, r.review_status)

    console.print(table)


@main.command()
@click.argument("bib", type=str)
@click.argument("status", type=click.Choice(["ok", "pending", "rejected", "verified"]))
@click.option("--notes", "-n", default="", help="复核备注")
@click.option("--state-dir", default=".trail_checker", help="状态文件存储目录")
def review_runner(bib: str, status: str, notes: str, state_dir: str):
    """更新选手复核状态"""
    state_manager = ReviewStateManager(state_dir)
    state_manager.update_runner(bib, status, notes)
    console.print(f"[green]选手 {bib} 复核状态已更新为: {status}[/green]")


@main.command()
@click.argument("station_id", type=str)
@click.argument("status", type=click.Choice(["ok", "pending", "anomaly_confirmed", "verified"]))
@click.option("--state-dir", default=".trail_checker", help="状态文件存储目录")
def review_aid(station_id: str, status: str, state_dir: str):
    """更新补给站复核状态"""
    state_manager = ReviewStateManager(state_dir)
    state_manager.update_aid_station(station_id, status)
    console.print(f"[green]补给站 {station_id} 复核状态已更新为: {status}[/green]")


@main.command()
@click.argument("event_id", type=str)
@click.argument("status", type=click.Choice(["ok", "pending", "follow_up_needed", "urgent", "completed"]))
@click.option("--contacted/--not-contacted", default=False, help="是否已联系")
@click.option("--notes", "-n", default="", help="回访备注")
@click.option("--state-dir", default=".trail_checker", help="状态文件存储目录")
def review_medical(event_id: str, status: str, contacted: bool, notes: str, state_dir: str):
    """更新医疗事件复核状态"""
    state_manager = ReviewStateManager(state_dir)
    state_manager.update_medical(event_id, status, contacted, notes)
    console.print(f"[green]医疗事件 {event_id} 复核状态已更新为: {status}[/green]")


if __name__ == "__main__":
    main()
