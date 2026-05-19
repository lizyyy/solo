import json
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from datetime import datetime
from typing import List, Optional
from .models import (
    MirrorSource,
    PackageVersion,
    BlockedProject,
    FreshnessStatus,
    BlockReason,
)
from .attribution import ReportGenerator, ManualConfirmationManager
from .exporter import ReportExporter
from .data_loader import DataLoader

console = Console()


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """镜像源新鲜度阻塞项目归因排查工具"""
    pass


@cli.command()
@click.option("--mirror-config", "-m", required=True, type=click.Path(exists=True), help="镜像源配置文件路径")
@click.option("--packages", "-p", required=True, type=click.Path(exists=True), help="包版本列表文件路径")
@click.option("--projects", "-j", required=True, type=click.Path(exists=True), help="阻塞项目列表文件路径")
@click.option("--output", "-o", type=click.Path(), help="输出报告文件路径")
@click.option("--format", "-f", "fmt", type=click.Choice(["json", "text", "both"]), default="both", help="输出格式")
@click.option("--confirm-project", multiple=True, help="人工确认放行的项目")
@click.option("--confirm-package", multiple=True, help="人工确认放行的包")
def check(mirror_config, packages, projects, output, fmt, confirm_project, confirm_package):
    """执行镜像源新鲜度检查和阻塞项目归因"""
    try:
        data_loader = DataLoader()

        mirror_source = data_loader.load_mirror_source(mirror_config)
        package_list = data_loader.load_packages(packages)
        project_list = data_loader.load_projects(projects)

        if data_loader.has_issues():
            console.print("[yellow]⚠️  数据加载过程中发现以下问题:[/yellow]")
            for issue in data_loader.get_issues():
                console.print(f"  - {issue.field}: {issue.message}")
            console.print()

        confirmation_manager = ManualConfirmationManager()
        for proj in confirm_project:
            confirmation_manager.confirm_project(proj)
        for pkg in confirm_package:
            confirmation_manager.confirm_package(pkg)

        report_generator = ReportGenerator()
        report = report_generator.generate_report(
            mirror_source,
            package_list,
            project_list,
            confirmation_manager
        )

        report_exporter = ReportExporter()

        if fmt in ["text", "both"]:
            console.print(report_exporter.format_rich_report(report))

        if output:
            if fmt in ["json", "both"]:
                json_path = f"{output}.json" if not output.endswith('.json') else output
                report_exporter.export_json(report, json_path)
                console.print(f"\n[green]✓ 机器可读报告已保存到: {json_path}[/green]")

            if fmt in ["text", "both"]:
                text_path = f"{output}.txt" if not output.endswith('.txt') else output
                report_exporter.export_text(report, text_path)
                console.print(f"[green]✓ 人读报告已保存到: {text_path}[/green]")

        if report.overall_status == FreshnessStatus.CRITICAL:
            raise SystemExit(2)
        elif report.overall_status == FreshnessStatus.WARNING:
            raise SystemExit(1)

    except Exception as e:
        console.print(f"[red]✗ 执行失败: {str(e)}[/red]")
        raise SystemExit(3)


@cli.command()
@click.option("--type", "-t", "sample_type", type=click.Choice(["normal", "dirty", "boundary", "empty"]), default="normal", help="样例类型")
@click.option("--output-dir", "-o", type=click.Path(), default=".", help="输出目录")
def generate_sample(sample_type, output_dir):
    """生成样例数据文件"""
    data_loader = DataLoader()
    files = data_loader.generate_sample_data(sample_type, output_dir)

    console.print(f"[green]✓ {sample_type} 样例数据已生成:[/green]")
    for f in files:
        console.print(f"  - {f}")


@cli.command()
@click.argument("report_file", type=click.Path(exists=True))
def verify(report_file):
    """验证机器可读报告和人读报告的一致性"""
    try:
        with open(report_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        required_fields = [
            "report_id", "generated_at", "mirror_source", "total_packages",
            "fresh_packages", "stale_packages", "critical_packages",
            "average_delay_hours", "project_results", "package_results",
            "overall_status", "summary"
        ]

        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            console.print(f"[red]✗ 缺失字段: {', '.join(missing_fields)}[/red]")
            raise SystemExit(1)

        summary = data.get("summary", {})
        total = data.get("total_packages", 0)
        fresh = data.get("fresh_packages", 0)
        stale = data.get("stale_packages", 0)
        critical = data.get("critical_packages", 0)

        if fresh + stale + critical > total:
            console.print("[red]✗ 数据不一致: 状态包数量之和大于总包数[/red]")
            raise SystemExit(1)

        if summary.get("total_packages") != total:
            console.print("[red]✗ 数据不一致: summary.total_packages 与顶层字段不匹配[/red]")
            raise SystemExit(1)

        console.print("[green]✓ 报告数据一致性验证通过[/green]")
        console.print(f"  报告ID: {data['report_id']}")
        console.print(f"  生成时间: {data['generated_at']}")
        console.print(f"  镜像源: {data['mirror_source']['name']}")
        console.print(f"  总体状态: {data['overall_status']}")

    except json.JSONDecodeError:
        console.print("[red]✗ JSON格式错误[/red]")
        raise SystemExit(2)
    except Exception as e:
        console.print(f"[red]✗ 验证失败: {str(e)}[/red]")
        raise SystemExit(3)


def main():
    cli()


if __name__ == "__main__":
    main()
