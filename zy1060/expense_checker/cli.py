import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .__version__ import __version__
from .config import CheckerConfig, generate_sample_config, load_config
from .csv_parser import CSVParseError, CSVParser
from .file_scanner import FileScanner
from .models import CheckResult, Issue, Severity
from .reporter import Reporter
from .validator import Validator

console = Console()


def print_summary(result: CheckResult) -> None:
    if result.has_errors:
        status_style = "bold red"
        status_text = "检查失败 - 发现错误"
    elif result.warnings:
        status_style = "bold yellow"
        status_text = "检查完成 - 存在警告"
    else:
        status_style = "bold green"
        status_text = "检查通过"
    
    console.print(Panel(
        f"[bold {status_style}]报销材料包体检报告[/bold {status_style}]",
        subtitle=f"版本: {__version__}",
    ))
    
    info_table = Table(show_header=False, box=None)
    info_table.add_column("属性", style="cyan")
    info_table.add_column("值", style="white")
    
    info_table.add_row("检查时间", result.checked_at.strftime("%Y-%m-%d %H:%M:%S"))
    info_table.add_row("报销包路径", result.package_path)
    info_table.add_row("报销记录数", f"{result.total_expenses} 条")
    info_table.add_row("附件文件数", f"{result.total_attachments} 个")
    info_table.add_row("总金额", f"¥{result.total_amount:,.2f}")
    
    console.print(info_table)
    console.print()
    
    console.print(f"[bold]检查结果: [{status_style}]{status_text}[/{status_style}][/bold]")
    console.print(f"  - 错误: {len(result.errors)} 个")
    console.print(f"  - 警告: {len(result.warnings)} 个")
    console.print()
    
    if result.errors:
        console.print("[bold red]❌ 错误列表:[/bold red]")
        for idx, issue in enumerate(result.errors, 1):
            console.print(f"  {idx}. [red]{issue.message}[/red]")
            if issue.reference:
                console.print(f"     参考: {issue.reference}")
        console.print()
    
    if result.warnings:
        console.print("[bold yellow]⚠️ 警告列表:[/bold yellow]")
        for idx, issue in enumerate(result.warnings, 1):
            console.print(f"  {idx}. [yellow]{issue.message}[/yellow]")
            if issue.reference:
                console.print(f"     参考: {issue.reference}")
        console.print()


def create_sample_directory(target_path: Path, config: CheckerConfig) -> None:
    target_path.mkdir(parents=True, exist_ok=True)
    
    csv_content = """expense_id,invoice_number,amount,date,expense_type,project_code,description,attachment_requirements
EXP001,INV202601010001,500.00,2026-01-15,差旅费,PRJ001,北京出差交通费,发票;付款凭证
EXP002,INV202601010002,3500.00,2026-02-20,办公费,PRJ001,采购办公设备,发票
EXP003,INV202601010003,15000.00,2025-11-01,服务费,PRJ002,技术咨询服务费,发票;合同;验收单
EXP004,INV202601010002,2000.00,2026-03-01,办公费,PRJ001,重复发票号测试,发票
EXP005,INV202601019999,800.00,2026-04-01,差旅费,PRJ003,缺少附件测试,发票
"""
    
    csv_file = target_path / config.csv_filename
    csv_file.write_text(csv_content, encoding="utf-8-sig")
    
    (target_path / "发票_INV202601010001.pdf").touch()
    (target_path / "付款_INV202601010001.png").touch()
    (target_path / "发票_INV202601010002.pdf").touch()
    (target_path / "合同_HT20251101.pdf").touch()
    
    subdir = target_path / "subfolder"
    subdir.mkdir(exist_ok=True)
    (subdir / "验收单_YS20251101.pdf").touch()
    
    (target_path / "random_file.jpg").touch()
    
    sample_config = generate_sample_config()
    (target_path / "expense-checker.yaml").write_text(sample_config, encoding="utf-8")
    
    console.print(f"[green]✅ 示例数据已创建: {target_path}[/green]")
    console.print("")
    console.print("[cyan]📁 目录结构:[/cyan]")
    console.print(f"  {target_path}/")
    console.print(f"  ├── {config.csv_filename}")
    console.print(f"  ├── 发票_INV202601010001.pdf")
    console.print(f"  ├── 付款_INV202601010001.png")
    console.print(f"  ├── 发票_INV202601010002.pdf")
    console.print(f"  ├── 合同_HT20251101.pdf")
    console.print(f"  ├── random_file.jpg")
    console.print(f"  ├── expense-checker.yaml")
    console.print(f"  └── subfolder/")
    console.print(f"      └── 验收单_YS20251101.pdf")
    console.print("")
    console.print("[yellow]💡 提示:[/yellow]")
    console.print("  此示例包含一些常见问题，用于演示工具的检测能力:")
    console.print("  - 重复发票号 (INV202601010002)")
    console.print("  - 缺少附件 (INV202601019999)")
    console.print("  - 金额超限 (15000元 > 10000元)")
    console.print("  - 日期超期 (2025-11-01 已超过90天)")
    console.print("  - 缺少验收单 (服务费类型需要验收单)")
    console.print("  - 文件名不规范 (random_file.jpg)")


@click.group()
@click.version_option(version=__version__, prog_name="expense-checker")
@click.pass_context
def main(ctx: click.Context) -> None:
    """报销材料包体检工具 - 本地检查报销附件完整性和一致性"""
    ctx.ensure_object(dict)
    ctx.obj["config"] = load_config()


@main.command()
@click.argument("path", type=click.Path(file_okay=False, writable=True))
@click.option("--force", "-f", is_flag=True, help="如果目录已存在，强制覆盖")
@click.pass_context
def init_sample(ctx: click.Context, path: str, force: bool) -> None:
    """创建示例报销包目录
    
    PATH: 目标目录路径
    """
    config = ctx.obj["config"]
    target_path = Path(path)
    
    if target_path.exists() and target_path.is_dir():
        if not force:
            console.print(f"[red]❌ 目录已存在: {target_path}[/red]")
            console.print("[yellow]使用 --force 选项强制覆盖[/yellow]")
            sys.exit(1)
        
        import shutil
        shutil.rmtree(target_path)
    
    try:
        create_sample_directory(target_path, config)
        console.print("[green]✅ 示例创建完成！[/green]")
        console.print(f"[cyan]运行检查命令: expense-checker check {path}[/cyan]")
    except Exception as e:
        console.print(f"[red]❌ 创建示例失败: {e}[/red]")
        sys.exit(1)


@main.command()
@click.argument("path", type=click.Path(exists=True, file_okay=False, readable=True))
@click.option("--config", "-c", type=click.Path(exists=True, file_okay=True), help="配置文件路径")
@click.option("--output", "-o", type=click.Path(), help="报告输出目录")
@click.option("--format", "-f", "report_format", type=click.Choice(["json", "markdown", "both"]), default="both", help="报告格式")
@click.option("--quiet", "-q", is_flag=True, help="不输出终端摘要")
@click.pass_context
def check(
    ctx: click.Context,
    path: str,
    config: Optional[str],
    output: Optional[str],
    report_format: str,
    quiet: bool,
) -> None:
    """检查报销材料包
    
    PATH: 报销包目录路径
    """
    if config:
        ctx.obj["config"] = load_config(config)
    
    checker_config = ctx.obj["config"]
    package_path = Path(path)
    
    try:
        csv_parser = CSVParser(checker_config)
        csv_path = package_path / checker_config.csv_filename
        
        try:
            expenses = csv_parser.parse(csv_path)
        except CSVParseError as e:
            if not quiet:
                console.print(f"[red]❌ CSV解析失败: {e}[/red]")
            sys.exit(1)
        
        file_scanner = FileScanner(checker_config)
        attachments = file_scanner.scan_directory(package_path)
        
        validator = Validator(checker_config)
        result = validator.validate(
            expenses=expenses,
            attachments=attachments,
            package_path=str(package_path.resolve()),
        )
        
        result.issues.extend(csv_parser.get_issues())
        
        if not quiet:
            print_summary(result)
        
        if output:
            reporter = Reporter()
            output_path = Path(output)
            
            if report_format in ["json", "both"]:
                json_path = output_path / "check-report.json"
                reporter.generate_json_report(result, str(json_path))
                if not quiet:
                    console.print(f"[green]📄 JSON报告已保存: {json_path}[/green]")
            
            if report_format in ["markdown", "both"]:
                md_path = output_path / "check-report.md"
                reporter.generate_markdown_report(result, str(md_path))
                if not quiet:
                    console.print(f"[green]📄 Markdown报告已保存: {md_path}[/green]")
        
        if result.has_errors:
            sys.exit(1)
        else:
            sys.exit(0)
    
    except Exception as e:
        console.print(f"[red]❌ 检查失败: {e}[/red]")
        console.print("[yellow]详细错误信息:[/yellow]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command()
@click.argument("path", type=click.Path(exists=True, file_okay=False, readable=True))
@click.option("--config", "-c", type=click.Path(exists=True, file_okay=True), help="配置文件路径")
@click.option("--output", "-o", type=click.Path(), required=True, help="报告输出目录")
@click.option("--format", "-f", "report_format", type=click.Choice(["json", "markdown", "both"]), default="both", help="报告格式")
@click.option("--quiet", "-q", is_flag=True, help="不输出终端摘要")
@click.pass_context
def report(
    ctx: click.Context,
    path: str,
    config: Optional[str],
    output: str,
    report_format: str,
    quiet: bool,
) -> None:
    """生成检查报告
    
    与 check 命令类似，但强制要求输出目录
    
    PATH: 报销包目录路径
    """
    if config:
        ctx.obj["config"] = load_config(config)
    
    checker_config = ctx.obj["config"]
    package_path = Path(path)
    output_path = Path(output)
    
    try:
        csv_parser = CSVParser(checker_config)
        csv_path = package_path / checker_config.csv_filename
        
        try:
            expenses = csv_parser.parse(csv_path)
        except CSVParseError as e:
            if not quiet:
                console.print(f"[red]❌ CSV解析失败: {e}[/red]")
            sys.exit(1)
        
        file_scanner = FileScanner(checker_config)
        attachments = file_scanner.scan_directory(package_path)
        
        validator = Validator(checker_config)
        result = validator.validate(
            expenses=expenses,
            attachments=attachments,
            package_path=str(package_path.resolve()),
        )
        
        result.issues.extend(csv_parser.get_issues())
        
        if not quiet:
            print_summary(result)
        
        reporter = Reporter()
        
        if report_format in ["json", "both"]:
            json_file = output_path / "check-report.json"
            reporter.generate_json_report(result, str(json_file))
            if not quiet:
                console.print(f"[green]📄 JSON报告已保存: {json_file}[/green]")
        
        if report_format in ["markdown", "both"]:
            md_file = output_path / "check-report.md"
            reporter.generate_markdown_report(result, str(md_file))
            if not quiet:
                console.print(f"[green]📄 Markdown报告已保存: {md_file}[/green]")
        
        if result.has_errors:
            sys.exit(1)
        else:
            sys.exit(0)
    
    except Exception as e:
        console.print(f"[red]❌ 生成报告失败: {e}[/red]")
        console.print("[yellow]详细错误信息:[/yellow]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command()
@click.option("--output", "-o", type=click.Path(), help="输出文件路径（不指定则打印到控制台）")
@click.pass_context
def config_sample(ctx: click.Context, output: Optional[str]) -> None:
    """生成示例配置文件"""
    sample_config = generate_sample_config()
    
    if output:
        output_path = Path(output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(sample_config, encoding="utf-8")
        console.print(f"[green]✅ 配置文件已保存: {output_path}[/green]")
    else:
        console.print(sample_config)


if __name__ == "__main__":
    main()
