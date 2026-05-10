"""CLI 主入口"""

import os
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

from .core import (
    check_route_completion,
    find_abnormal_records,
    merge_duplicate_records,
    merge_supplementary_with_scan,
    validate_supplementary_records,
)
from .data_loader import (
    load_device_points,
    load_scan_records,
    load_supplementary_records,
)
from .report import export_csv_report, format_datetime, generate_text_report

console = Console()


def ensure_output_dir(output_path: str) -> None:
    dir_name = os.path.dirname(output_path)
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name)


@click.group()
@click.version_option()
def cli():
    """设备巡检二维码补录 CLI 工具"""
    pass


@cli.command("import")
@click.option("--points", "-p", required=True, help="设备点位文件 (CSV/Excel)")
@click.option("--scan", "-s", help="扫码巡检记录文件 (CSV/Excel)")
@click.option("--supplementary", "-t", help="离线补录表文件 (CSV/Excel)")
def import_data(points: str, scan: Optional[str], supplementary: Optional[str]):
    """导入设备点位、扫码巡检记录和离线补录表"""
    try:
        console.print("[bold green]正在导入数据...[/bold green]")

        points_data = load_device_points(points)
        console.print(f"✅ 成功导入设备点位: [bold cyan]{len(points_data)}[/bold cyan] 条")

        if scan:
            scan_records = load_scan_records(scan)
            console.print(f"✅ 成功导入扫码记录: [bold cyan]{len(scan_records)}[/bold cyan] 条")

        if supplementary:
            supp_records = load_supplementary_records(supplementary)
            console.print(f"✅ 成功导入补录记录: [bold cyan]{len(supp_records)}[/bold cyan] 条")

        console.print("\n[bold green]数据导入完成[/bold green]")
    except Exception as e:
        console.print(f"[bold red]❌ 导入失败: {e}[/bold red]")
        raise click.Abort()


@cli.command("merge")
@click.option("--points", "-p", required=True, help="设备点位文件")
@click.option("--scan", "-s", required=True, help="扫码巡检记录文件")
@click.option("--supplementary", "-t", required=True, help="离线补录表文件")
@click.option("--output", "-o", help="输出文件路径")
def merge_records(points: str, scan: str, supplementary: str, output: Optional[str]):
    """合并扫码记录和补录记录，处理重复扫码"""
    try:
        console.print("[bold green]正在合并记录...[/bold green]")

        points_data = load_device_points(points)
        scan_records = load_scan_records(scan)
        supp_records = load_supplementary_records(supplementary)

        console.print(f"原始扫码记录: {len(scan_records)} 条")
        console.print(f"原始补录记录: {len(supp_records)} 条")

        merged_scan = merge_duplicate_records(scan_records)
        console.print(f"合并重复扫码后: {len(merged_scan)} 条")

        all_records = merge_supplementary_with_scan(merged_scan, supp_records)
        console.print(f"合并补录记录后: {len(all_records)} 条")

        validation_errors = validate_supplementary_records(points_data, supp_records)

        if validation_errors:
            console.print(f"\n[bold red]⚠️  发现 {len(validation_errors)} 个校验错误:[/bold red]")
            for err in validation_errors:
                console.print(f"  - [{err.error_type}] {err.point_name}: {err.message}")
        else:
            console.print("\n[bold green]✅ 补录记录校验通过[/bold green]")

        if output:
            import csv
            ensure_output_dir(output)
            with open(output, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(["记录ID", "点位ID", "扫码时间", "状态", "备注", "巡检人", "来源", "是否合并"])
                for r in all_records:
                    writer.writerow([
                        r.record_id,
                        r.point_id,
                        format_datetime(r.scan_time),
                        r.status.value,
                        r.remark or "",
                        r.inspector or "",
                        r.source.value,
                        "是" if r.is_merged else "否",
                    ])
            console.print(f"\n[bold green]✅ 合并结果已保存到: {output}[/bold green]")

    except Exception as e:
        console.print(f"[bold red]❌ 合并失败: {e}[/bold red]")
        raise click.Abort()


@cli.command("check-route")
@click.option("--points", "-p", required=True, help="设备点位文件")
@click.option("--scan", "-s", required=True, help="扫码巡检记录文件")
@click.option("--supplementary", "-t", help="离线补录表文件")
def check_route(points: str, scan: str, supplementary: Optional[str]):
    """检查巡检路线完成情况，检查漏检"""
    try:
        console.print("[bold green]正在检查路线...[/bold green]")

        points_data = load_device_points(points)
        scan_records = load_scan_records(scan)
        supp_records = load_supplementary_records(supplementary) if supplementary else []

        merged_scan = merge_duplicate_records(scan_records)
        all_records = merge_supplementary_with_scan(merged_scan, supp_records)

        results, errors = check_route_completion(points_data, all_records)

        table = Table(title="路线检查结果")
        table.add_column("路线", style="cyan")
        table.add_column("负责人", style="magenta")
        table.add_column("进度", style="green")
        table.add_column("状态", style="yellow")
        table.add_column("漏检", style="red")
        table.add_column("异常", style="orange3")
        table.add_column("需复核", style="bold red")

        for result in results:
            status_style = "green" if result.status in ["全部完成"] else "yellow" if result.status == "部分完成" else "red"
            table.add_row(
                f"{result.route_name}\n({result.route_id})",
                result.inspector or "未分配",
                f"{result.completed_points}/{result.total_points}",
                f"[{status_style}]{result.status}[/{status_style}]",
                str(len(result.missing_points)),
                str(len(result.abnormal_points)),
                str(len(result.need_review)),
            )

        console.print(table)

        if errors:
            console.print(f"\n[bold red]⚠️  严重错误 ({len(errors)} 个):[/bold red]")
            for err in errors:
                console.print(f"  [bold red]✗[/bold red] [{err.error_type}] {err.point_name} ({err.point_id}): {err.message}")

    except Exception as e:
        console.print(f"[bold red]❌ 检查失败: {e}[/bold red]")
        raise click.Abort()


@cli.command("view-abnormal")
@click.option("--points", "-p", required=True, help="设备点位文件")
@click.option("--scan", "-s", required=True, help="扫码巡检记录文件")
@click.option("--supplementary", "-t", help="离线补录表文件")
def view_abnormal(points: str, scan: str, supplementary: Optional[str]):
    """查看异常记录，检查异常备注是否填写"""
    try:
        console.print("[bold green]正在分析异常记录...[/bold green]")

        points_data = load_device_points(points)
        scan_records = load_scan_records(scan)
        supp_records = load_supplementary_records(supplementary) if supplementary else []

        abnormal_records, errors = find_abnormal_records(points_data, scan_records, supp_records)

        if abnormal_records:
            table = Table(title=f"异常巡检记录 ({len(abnormal_records)} 条)")
            table.add_column("点位ID", style="cyan")
            table.add_column("记录ID", style="magenta")
            table.add_column("时间", style="green")
            table.add_column("来源", style="yellow")
            table.add_column("巡检人", style="blue")
            table.add_column("备注", style="red")

            for record in abnormal_records:
                has_remark = record.remark and record.remark.strip()
                table.add_row(
                    record.point_id,
                    record.record_id,
                    format_datetime(record.scan_time),
                    record.source.value,
                    record.inspector or "-",
                    f"[green]{record.remark}[/green]" if has_remark else "[bold red]⚠️  无备注[/bold red]",
                )

            console.print(table)
        else:
            console.print("[bold green]✅ 无异常巡检记录[/bold green]")

        if errors:
            console.print(f"\n[bold red]⚠️  发现 {len(errors)} 个异常无备注错误:[/bold red]")
            for err in errors:
                console.print(f"  [bold red]✗[/bold red] {err.point_name} ({err.point_id}): {err.message}")

    except Exception as e:
        console.print(f"[bold red]❌ 分析失败: {e}[/bold red]")
        raise click.Abort()


@cli.command("export-report")
@click.option("--points", "-p", required=True, help="设备点位文件")
@click.option("--scan", "-s", required=True, help="扫码巡检记录文件")
@click.option("--supplementary", "-t", help="离线补录表文件")
@click.option("--output", "-o", required=True, help="输出文件路径 (.txt 或 .csv)")
def export_report(points: str, scan: str, supplementary: Optional[str], output: str):
    """导出巡检报告"""
    try:
        console.print("[bold green]正在生成巡检报告...[/bold green]")

        points_data = load_device_points(points)
        scan_records = load_scan_records(scan)
        supp_records = load_supplementary_records(supplementary) if supplementary else []

        merged_scan = merge_duplicate_records(scan_records)
        all_records = merge_supplementary_with_scan(merged_scan, supp_records)

        results, route_errors = check_route_completion(points_data, all_records)
        abnormal_records, abnormal_errors = find_abnormal_records(points_data, scan_records, supp_records)
        supp_errors = validate_supplementary_records(points_data, supp_records)

        all_errors = route_errors + abnormal_errors + supp_errors

        ensure_output_dir(output)
        ext = os.path.splitext(output)[1].lower()

        if ext == ".csv":
            export_csv_report(results, all_errors, abnormal_records, output)
        else:
            text_report = generate_text_report(results, all_errors, abnormal_records)
            with open(output, "w", encoding="utf-8") as f:
                f.write(text_report)

        console.print(f"[bold green]✅ 报告已导出到: {output}[/bold green]")

    except Exception as e:
        console.print(f"[bold red]❌ 导出失败: {e}[/bold red]")
        raise click.Abort()


@cli.command("full-check")
@click.option("--points", "-p", required=True, help="设备点位文件")
@click.option("--scan", "-s", required=True, help="扫码巡检记录文件")
@click.option("--supplementary", "-t", help="离线补录表文件")
@click.option("--report", "-r", help="报告输出路径")
def full_check(points: str, scan: str, supplementary: Optional[str], report: Optional[str]):
    """执行完整检查：导入、合并、检查路线、查看异常、导出报告"""
    try:
        console.print("[bold green]========== 设备巡检完整检查 ==========[/bold green]\n")

        points_data = load_device_points(points)
        scan_records = load_scan_records(scan)
        supp_records = load_supplementary_records(supplementary) if supplementary else []

        console.print(f"[bold cyan]数据概览:[/bold cyan]")
        console.print(f"  设备点位: {len(points_data)} 条")
        console.print(f"  扫码记录: {len(scan_records)} 条")
        console.print(f"  补录记录: {len(supp_records)} 条\n")

        merged_scan = merge_duplicate_records(scan_records)
        all_records = merge_supplementary_with_scan(merged_scan, supp_records)

        results, route_errors = check_route_completion(points_data, all_records)
        abnormal_records, abnormal_errors = find_abnormal_records(points_data, scan_records, supp_records)
        supp_errors = validate_supplementary_records(points_data, supp_records)

        all_errors = route_errors + abnormal_errors + supp_errors

        console.print(f"[bold cyan]路线检查:[/bold cyan]")
        for result in results:
            status_icon = "✅" if result.status == "全部完成" else "⚠️" if result.status == "部分完成" else "❌"
            console.print(f"  {status_icon} {result.route_name}: {result.completed_points}/{result.total_points} [{result.status}]")
            if result.missing_points:
                console.print(f"     漏检: {', '.join(result.missing_points)}")

        console.print(f"\n[bold cyan]异常记录:[/bold cyan] {len(abnormal_records)} 条")
        for rec in abnormal_records:
            has_remark = rec.remark and rec.remark.strip()
            remark_status = "✅ 有备注" if has_remark else "❌ 无备注"
            console.print(f"  - {rec.point_id}: {remark_status}")

        if all_errors:
            console.print(f"\n[bold red]校验错误 ({len(all_errors)} 个):[/bold red]")
            for err in all_errors:
                console.print(f"  ❌ [{err.error_type}] {err.point_name}: {err.message}")
        else:
            console.print(f"\n[bold green]✅ 全部校验通过[/bold green]")

        if report:
            ext = os.path.splitext(report)[1].lower()
            if ext == ".csv":
                export_csv_report(results, all_errors, abnormal_records, report)
            else:
                text_report = generate_text_report(results, all_errors, abnormal_records)
                with open(report, "w", encoding="utf-8") as f:
                    f.write(text_report)
            console.print(f"\n[bold green]✅ 报告已保存到: {report}[/bold green]")

        console.print("\n[bold green]========== 检查完成 ==========[/bold green]")

        if all_errors:
            raise click.Abort()

    except click.Abort:
        raise
    except Exception as e:
        console.print(f"[bold red]❌ 检查失败: {e}[/bold red]")
        raise click.Abort()


if __name__ == "__main__":
    cli()
