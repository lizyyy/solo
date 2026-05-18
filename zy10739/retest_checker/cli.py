import os
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from .checker import CoverageChecker
from . import __version__


console = Console()


def print_summary(summary: dict):
    table = Table(title="实验样本结果重测申请对照 - 汇总统计")
    table.add_column("统计项", style="cyan")
    table.add_column("数量", style="magenta")
    table.add_row("总样本数", str(summary["total"]))
    table.add_row("✓ 覆盖正确", str(summary["success"]))
    table.add_row("✗ 覆盖异常", str(summary["fail"]))
    table.add_row("⚠ 仪器失败", str(summary["instrument_fail"]))
    table.add_row("? 待确认", str(summary["pending"]))
    console.print(table)


def print_errors(errors: list):
    if not errors:
        return
    
    console.print(Panel("[bold red]数据验证错误[/bold red]", expand=False))
    for error in errors:
        error_msg = f"[{error.error_type}] {error.message} - 文件: {os.path.basename(error.file)}"
        if error.row:
            error_msg += f", 行号: {error.row}"
        if error.column:
            error_msg += f", 列: {error.column}"
        console.print(f"  ✗ {error_msg}")


def print_warnings(warnings: list):
    if not warnings:
        return
    
    console.print(Panel("[bold yellow]警告信息[/bold yellow]", expand=False))
    for warning in warnings:
        console.print(f"  ⚠ {warning}")


def print_coverage_table(df):
    if df.empty:
        console.print("[yellow]没有对照结果可显示[/yellow]")
        return
    
    console.print(Panel("[bold blue]重测对照表[/bold blue]", expand=False))
    
    table = Table(show_lines=True)
    for col in df.columns:
        table.add_column(col, style="white")
    
    for _, row in df.iterrows():
        styled_row = []
        for val in row:
            val_str = str(val) if pd.notna(val) else ""
            if "✓" in val_str:
                styled_row.append(Text(val_str, style="green"))
            elif "✗" in val_str:
                styled_row.append(Text(val_str, style="red"))
            elif "?" in val_str:
                styled_row.append(Text(val_str, style="yellow"))
            else:
                styled_row.append(val_str)
        table.add_row(*styled_row)
    
    console.print(table)


def print_failures_table(df):
    if df.empty:
        console.print("[green]没有失败记录[/green]")
        return
    
    console.print(Panel("[bold red]失败路径明细[/bold red]", expand=False))
    
    table = Table(show_lines=True)
    for col in df.columns:
        table.add_column(col, style="white")
    
    for _, row in df.iterrows():
        styled_row = [Text(str(val) if pd.notna(val) else "", style="red") for val in row]
        table.add_row(*styled_row)
    
    console.print(table)


import pandas as pd


@click.group()
@click.version_option(version=__version__, prog_name="retest-checker")
def main():
    """实验样本结果重测申请对照 CLI
    
    读取样本结果、重测单、仪器日志，生成重测对照表，检查重测是否覆盖正确。
    """
    pass


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option("--output", "-o", type=click.Path(), help="输出Excel文件路径")
@click.option("--config", "-c", type=click.Path(exists=True, file_okay=False, dir_okay=True), help="配置文件目录")
@click.option("--show-failures/--no-show-failures", default=True, help="是否显示失败明细")
@click.option("--verbose/--no-verbose", default=True, help="是否显示详细输出")
def run(directory, output, config, show_failures, verbose):
    """运行对照检查
    
    DIRECTORY: 包含数据文件的目录路径
    """
    if verbose:
        console.print(f"[bold cyan]实验样本结果重测申请对照工具 v{__version__}[/bold cyan]")
        console.print(f"处理目录: [blue]{directory}[/blue]")
        console.print()
    
    checker = CoverageChecker(config_dir=config)
    result = checker.process_directory(directory)
    
    if verbose:
        print_errors(result["errors"])
        print_warnings(result["warnings"])
        console.print()
        
        print_coverage_table(result["coverage_table"])
        console.print()
        
        if show_failures:
            print_failures_table(result["failures_table"])
            console.print()
        
        print_summary(result["summary"])
    
    if output:
        output_path = output
        if not output_path.endswith(".xlsx"):
            output_path += ".xlsx"
        
        with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
            result["coverage_table"].to_excel(writer, sheet_name="重测对照表", index=False)
            if not result["failures_table"].empty:
                result["failures_table"].to_excel(writer, sheet_name="失败明细", index=False)
            
            errors_data = []
            for error in result["errors"]:
                errors_data.append({
                    "错误类型": error.error_type,
                    "错误信息": error.message,
                    "文件": error.file,
                    "行号": error.row,
                    "列": error.column
                })
            if errors_data:
                pd.DataFrame(errors_data).to_excel(writer, sheet_name="数据错误", index=False)
            
            warnings_data = [{"警告信息": w} for w in result["warnings"]]
            if warnings_data:
                pd.DataFrame(warnings_data).to_excel(writer, sheet_name="警告信息", index=False)
        
        if verbose:
            console.print(f"[green]结果已保存到: {output_path}[/green]")
    
    return 0 if result["summary"]["fail"] == 0 and result["summary"]["instrument_fail"] == 0 else 1


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False, dir_okay=True))
def validate(directory):
    """仅验证数据文件，不进行对照检查"""
    from .reader import DataReader
    
    console.print(f"[bold cyan]验证目录: {directory}[/bold cyan]")
    console.print()
    
    reader = DataReader()
    results = reader.read_directory(directory)
    
    all_errors = []
    all_warnings = []
    
    all_errors.extend(reader.errors)
    all_warnings.extend(reader.warnings)
    
    for file_type, file_results in results.items():
        for result in file_results:
            all_errors.extend(result.errors)
            all_warnings.extend(result.warnings)
    
    print_errors(all_errors)
    print_warnings(all_warnings)
    
    if not all_errors and not all_warnings:
        console.print("[green]✓ 所有数据文件验证通过[/green]")
    
    return 0 if not all_errors else 1


@main.command()
def config():
    """显示当前配置信息"""
    from .config import get_config
    
    config = get_config()
    rules = config.rules
    
    console.print(Panel("[bold cyan]业务规则配置[/bold cyan]", expand=False))
    console.print(f"规则版本: {rules['rules']['version']}")
    console.print(f"规则描述: {rules['rules']['description']}")
    console.print()
    
    console.print(Panel("[bold blue]字段匹配配置[/bold blue]", expand=False))
    for field_type, aliases in rules["match_fields"].items():
        console.print(f"  {field_type}: {', '.join(aliases)}")
    console.print()
    
    console.print(Panel("[bold green]覆盖规则配置[/bold green]", expand=False))
    for rule_name, rule_config in rules["coverage_rules"].items():
        status = "[green]启用[/green]" if rule_config["enabled"] else "[red]禁用[/red]"
        console.print(f"  {rule_name}: {status} - {rule_config['description']}")
    console.print()
    
    console.print(Panel("[bold magenta]输出配置[/bold magenta]", expand=False))
    console.print(f"  成功标记: {rules['output']['success_value']}")
    console.print(f"  失败标记: {rules['output']['fail_value']}")
    console.print(f"  待确认标记: {rules['output']['pending_value']}")
    console.print(f"  失败路径可见: {'是' if rules['failure_visible']['enabled'] else '否'}")


if __name__ == "__main__":
    main()
