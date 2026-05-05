"""CLI Contract Validator 命令行入口"""

import os
from pathlib import Path
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from . import __version__
from .contract_loader import ContractLoader, ContractParseError
from .executor import CommandExecutor, ExecutionError
from .storage import Storage
from .reporter import Reporter
from .models import ValidationStatus

console = Console()
err_console = Console(stderr=True)


@click.group()
@click.version_option(__version__, "-v", "--version", prog_name="ccv")
def main():
    """CLI Contract Validator - 本地 CLI 契约验收器
    
    用于验证命令行工具的子命令参数、输出和返回码是否符合预期。
    """
    pass


@main.command()
@click.argument("contract_file", type=click.Path(exists=True))
@click.option("--tags", "-t", multiple=True, help="按标签过滤测试用例")
@click.option("--db", "-d", default="ccv_results.db", help="SQLite 数据库路径")
@click.option("--no-save", is_flag=True, help="不保存到数据库")
@click.option("--verbose", "-V", is_flag=True, help="显示详细输出")
def run(contract_file, tags, db, no_save, verbose):
    """运行契约验证
    
    CONTRACT_FILE: 契约文件路径（支持 YAML/JSON）
    
    示例:
        ccv run mytool_contract.yaml
        ccv run mytool_contract.yaml --tags smoke --tags critical
    """
    try:
        console.print(f"[bold blue]加载契约文件:[/bold blue] {contract_file}")
        contract = ContractLoader.load(contract_file)
        console.print(f"[green]✓[/green] 契约名称: {contract.name} (v{contract.version})")
        console.print(f"[green]✓[/green] 目标工具: {contract.tool_path}")
        
        total_test_cases = sum(len(s.test_cases) for s in contract.subcommands)
        console.print(f"[green]✓[/green] 子命令数: {len(contract.subcommands)}, 测试用例数: {total_test_cases}")
        
    except ContractParseError as e:
        err_console.print(f"[bold red]错误:[/bold red] {e}")
        raise click.Abort()

    try:
        executor = CommandExecutor(contract)
    except ExecutionError as e:
        err_console.print(f"[bold red]错误:[/bold red] {e}")
        raise click.Abort()

    console.print("\n[bold blue]开始执行测试...[/bold blue]\n")
    
    tags_list = list(tags) if tags else None
    if tags_list:
        console.print(f"[yellow]按标签过滤:[/yellow] {', '.join(tags_list)}\n")

    matrix = executor.run_all(tags=tags_list)

    table = Table(title="执行结果汇总")
    table.add_column("状态", style="bold")
    table.add_column("数量", justify="right")
    table.add_column("占比", justify="right")

    if matrix.total_tests > 0:
        table.add_row(
            "[green]通过[/green]",
            str(matrix.passed_tests),
            f"{matrix.passed_tests/matrix.total_tests*100:.1f}%",
        )
        table.add_row(
            "[red]失败[/red]",
            str(matrix.failed_tests),
            f"{matrix.failed_tests/matrix.total_tests*100:.1f}%",
        )
        table.add_row(
            "[yellow]错误[/yellow]",
            str(matrix.error_tests),
            f"{matrix.error_tests/matrix.total_tests*100:.1f}%",
        )
        table.add_row(
            "[dim]跳过[/dim]",
            str(matrix.skipped_tests),
            f"{matrix.skipped_tests/matrix.total_tests*100:.1f}%",
        )

    console.print(table)

    if not no_save:
        storage = Storage(db)
        run_id = storage.save_matrix(matrix)
        console.print(f"\n[green]✓[/green] 结果已保存到数据库: {db} (run_id={run_id})")

    if verbose:
        for result in matrix.results:
            if result.status != ValidationStatus.PASS:
                console.print(f"\n[bold red]失败:[/bold red] {result.subcommand_name} - {result.test_case_name}")
                console.print(f"  命令: {result.command}")
                console.print(f"  退出码: 期望 {result.expected_exit_code}, 实际 {result.actual_exit_code}")
                for failure in result.failures:
                    console.print(f"  [red]- {failure}[/red]")

    if matrix.failed_tests > 0 or matrix.error_tests > 0:
        raise click.Abort()


@main.command()
@click.option("--run-id", "-r", type=int, help="指定运行 ID，默认使用最近一次")
@click.option("--contract", "-c", help="契约名称，用于查找最近运行")
@click.option("--db", "-d", default="ccv_results.db", help="SQLite 数据库路径")
@click.option("--output", "-o", required=True, help="输出文件路径（支持 .md 或 .json）")
@click.option("--no-details", is_flag=True, help="不包含详细输出")
@click.option("--no-full-output", is_flag=True, help="JSON 格式不包含完整 stdout/stderr")
def report(run_id, contract, db, output, no_details, no_full_output):
    """生成报告
    
    从数据库读取结果并生成 Markdown 或 JSON 报告。
    
    示例:
        ccv report --run-id 1 -o report.md
        ccv report --contract mytool -o report.json
    """
    storage = Storage(db)

    if run_id is None:
        if contract is None:
            err_console.print("[bold red]错误:[/bold red] 必须指定 --run-id 或 --contract")
            raise click.Abort()
        
        run_id = storage.get_latest_run(contract)
        if run_id is None:
            err_console.print(f"[bold red]错误:[/bold red] 未找到契约 '{contract}' 的运行记录")
            raise click.Abort()
        
        console.print(f"[yellow]使用最近运行:[/yellow] run_id={run_id}")

    results = storage.get_results_by_run(run_id)
    if not results:
        err_console.print(f"[bold red]错误:[/bold red] 未找到 run_id={run_id} 的结果")
        raise click.Abort()

    runs = storage.list_runs(limit=1)
    run_info = next((r for r in runs if r["id"] == run_id), None)

    from .models import ValidationMatrix
    from datetime import datetime

    matrix = ValidationMatrix(
        contract_name=run_info["contract_name"] if run_info else "unknown",
        contract_version=run_info["contract_version"] if run_info else "unknown",
        generated_at=datetime.now(),
        total_tests=len(results),
        results=results,
    )

    output_path = Path(output)
    suffix = output_path.suffix.lower()

    if suffix == ".md":
        Reporter.generate_markdown(matrix, output, include_details=not no_details)
        console.print(f"[green]✓[/green] Markdown 报告已生成: {output}")
    elif suffix == ".json":
        Reporter.generate_json(matrix, output, include_full_output=not no_full_output)
        console.print(f"[green]✓[/green] JSON 报告已生成: {output}")
    else:
        err_console.print(f"[bold red]错误:[/bold red] 不支持的输出格式: {suffix}")
        console.print("[yellow]提示:[/yellow] 使用 .md 或 .json 扩展名")
        raise click.Abort()


@main.command()
@click.argument("result_id", type=int)
@click.option("--db", "-d", default="ccv_results.db", help="SQLite 数据库路径")
@click.option("--notes", "-n", required=True, help="人工复核备注")
def note(result_id, db, notes):
    """添加人工复核备注
    
    RESULT_ID: 测试结果 ID
    
    示例:
        ccv note 123 --notes "这是预期行为，因为..."
    """
    storage = Storage(db)
    
    result = storage.get_result(result_id)
    if result is None:
        err_console.print(f"[bold red]错误:[/bold red] 未找到 result_id={result_id}")
        raise click.Abort()

    storage.update_notes(result_id, notes)
    console.print(f"[green]✓[/green] 备注已添加到 result_id={result_id}")
    console.print(f"  测试用例: {result.subcommand_name} - {result.test_case_name}")
    console.print(f"  备注: {notes}")


@main.command()
@click.option("--contract", "-c", help="按契约名称过滤")
@click.option("--db", "-d", default="ccv_results.db", help="SQLite 数据库路径")
@click.option("--limit", "-n", default=10, help="显示最近 N 条记录")
def history(contract, db, limit):
    """查看运行历史
    
    示例:
        ccv history
        ccv history --contract mytool -n 20
    """
    storage = Storage(db)
    runs = storage.list_runs(contract_name=contract, limit=limit)

    if not runs:
        console.print("[yellow]没有运行记录[/yellow]")
        return

    table = Table(title="运行历史")
    table.add_column("ID", style="cyan")
    table.add_column("契约名称")
    table.add_column("版本")
    table.add_column("运行时间")
    table.add_column("结果", style="bold")

    for run in runs:
        total = run["total_tests"]
        passed = run["passed_tests"]
        failed = run["failed_tests"]
        error = run["error_tests"]
        
        if failed == 0 and error == 0:
            result_str = f"[green]{passed}/{total} 通过[/green]"
        else:
            result_str = f"[red]{failed} 失败, {error} 错误[/red]"

        table.add_row(
            str(run["id"]),
            run["contract_name"],
            run["contract_version"],
            run["run_at"][:19] if "T" in run["run_at"] else run["run_at"],
            result_str,
        )

    console.print(table)


@main.command()
@click.argument("contract_file", type=click.Path(exists=True))
def validate(contract_file):
    """验证契约文件格式
    
    CONTRACT_FILE: 契约文件路径
    
    仅验证契约文件的语法和结构，不执行测试。
    
    示例:
        ccv validate mytool_contract.yaml
    """
    try:
        console.print(f"[bold blue]验证契约文件:[/bold blue] {contract_file}")
        contract = ContractLoader.load(contract_file)
        
        console.print(f"\n[green]✓ 契约格式正确[/green]")
        console.print(f"\n[bold]契约信息:[/bold]")
        console.print(f"  名称: {contract.name}")
        console.print(f"  版本: {contract.version}")
        console.print(f"  工具路径: {contract.tool_path}")
        console.print(f"  子命令数: {len(contract.subcommands)}")
        
        for sub in contract.subcommands:
            console.print(f"\n  [bold]子命令: {sub.name}[/bold]")
            if sub.description:
                console.print(f"    描述: {sub.description}")
            console.print(f"    参数数: {len(sub.parameters)}")
            console.print(f"    测试用例数: {len(sub.test_cases)}")
            
            for param in sub.parameters:
                required = " [必填]" if param.required else ""
                console.print(f"      - --{param.name}{required} ({param.type})")

    except ContractParseError as e:
        err_console.print(f"[bold red]错误:[/bold red] {e}")
        raise click.Abort()


if __name__ == "__main__":
    main()
