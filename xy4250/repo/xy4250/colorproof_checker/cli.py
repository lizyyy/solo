import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from colorproof_checker import __version__
from colorproof_checker.store import WorkspaceManager, DataStore
from colorproof_checker.importer import DataImporter, ImportResult
from colorproof_checker.checker import QualityChecker
from colorproof_checker.state_machine import ProofStateMachine
from colorproof_checker.reporter import ReportExporter
from colorproof_checker.examples import SampleDataGenerator
from colorproof_checker.models import (
    ProofStatus, RiskLevel, ProofTask, CustomerTolerance
)
from colorproof_checker.store import parse_decimal


console = Console()


def get_workspace() -> WorkspaceManager:
    return WorkspaceManager(os.getcwd())


def get_store() -> DataStore:
    workspace = get_workspace()
    return DataStore(workspace)


def ensure_initialized():
    workspace = get_workspace()
    if not workspace.is_initialized():
        console.print(Panel.fit(
            "[bold red]工作区未初始化[/bold red]\n"
            "请先运行 [bold yellow]colorproof init[/bold yellow] 命令",
            title="错误"
        ))
        sys.exit(1)


@click.group()
@click.version_option(version=__version__)
def main():
    """
    专色打样放行员 - 小型印刷厂打样室命令行工具
    
    用于管理打样任务的质量检查、状态管理和报告导出。
    """
    pass


@main.command()
@click.option('--with-samples', is_flag=True, help='同时生成示例数据文件')
def init(with_samples: bool):
    """
    初始化工作区并生成示例数据
    
    在当前目录创建 .colorproof 数据目录和配置。
    使用 --with-samples 可同时生成示例数据文件。
    """
    workspace = get_workspace()
    
    if workspace.is_initialized():
        console.print(Panel.fit(
            "[bold yellow]工作区已存在[/bold yellow]\n"
            f"路径: {workspace.workspace_path}",
            title="提示"
        ))
        return
    
    workspace.initialize()
    
    console.print(Panel.fit(
        "[bold green]工作区初始化成功[/bold green]\n"
        f"路径: {workspace.workspace_path}\n"
        f"配置目录: {workspace.config_dir}",
        title="初始化完成"
    ))
    
    if with_samples:
        samples_dir = workspace.workspace_path / "samples"
        generator = SampleDataGenerator(str(samples_dir))
        paths = generator.generate_all_samples()
        
        table = Table(title="生成的示例文件")
        table.add_column("类型", style="cyan")
        table.add_column("文件路径", style="green")
        
        for name, path in paths.items():
            table.add_row(name.replace('_', ' ').title(), path)
        
        console.print(table)
        console.print(Panel.fit(
            "使用以下命令导入示例数据:\n"
            "[bold yellow]colorproof import --all samples/[/bold yellow]",
            title="下一步"
        ))


@main.group(name="import")
def import_group():
    """
    导入各种数据源
    
    支持导入色差CSV、油墨配方JSON、纸张批次表和干燥记录。
    """
    pass


@import_group.command("measurements")
@click.argument('filepath', type=click.Path(exists=True))
def import_measurements(filepath: str):
    """
    导入分光仪色差CSV数据
    
    FILEPATH: CSV文件路径
    """
    ensure_initialized()
    store = get_store()
    importer = DataImporter(store)
    
    with console.status("[bold green]正在导入色差数据...[/bold green]"):
        result = importer.import_color_measurement_csv(filepath)
    
    display_import_result(result, "色差测量数据")


@import_group.command("formulas")
@click.argument('filepath', type=click.Path(exists=True))
def import_formulas(filepath: str):
    """
    导入油墨配方JSON数据
    
    FILEPATH: JSON文件路径
    """
    ensure_initialized()
    store = get_store()
    importer = DataImporter(store)
    
    with console.status("[bold green]正在导入油墨配方...[/bold green]"):
        result = importer.import_ink_formula_json(filepath)
    
    display_import_result(result, "油墨配方")


@import_group.command("paper")
@click.argument('filepath', type=click.Path(exists=True))
def import_paper(filepath: str):
    """
    导入纸张批次表CSV数据
    
    FILEPATH: CSV文件路径
    """
    ensure_initialized()
    store = get_store()
    importer = DataImporter(store)
    
    with console.status("[bold green]正在导入纸张批次...[/bold green]"):
        result = importer.import_paper_batch_csv(filepath)
    
    display_import_result(result, "纸张批次")


@import_group.command("drying")
@click.argument('filepath', type=click.Path(exists=True))
def import_drying(filepath: str):
    """
    导入干燥记录CSV数据
    
    FILEPATH: CSV文件路径
    """
    ensure_initialized()
    store = get_store()
    importer = DataImporter(store)
    
    with console.status("[bold green]正在导入干燥记录...[/bold green]"):
        result = importer.import_drying_record_csv(filepath)
    
    display_import_result(result, "干燥记录")


@import_group.command("all")
@click.argument('directory', type=click.Path(exists=True, file_okay=False))
def import_all(directory: str):
    """
    从目录批量导入所有类型的数据
    
    目录中应包含:
    - color_measurements.csv - 色差数据
    - ink_formulas.json - 油墨配方
    - paper_batches.csv - 纸张批次
    - drying_records.csv - 干燥记录
    - customer_tolerances.json - 客户容差配置(可选)
    
    DIRECTORY: 数据文件所在目录
    """
    ensure_initialized()
    store = get_store()
    importer = DataImporter(store)
    
    dir_path = Path(directory)
    
    all_results = []
    
    measurements_file = dir_path / "color_measurements.csv"
    if measurements_file.exists():
        with console.status(f"[bold green]正在导入色差数据: {measurements_file.name}[/bold green]"):
            result = importer.import_color_measurement_csv(str(measurements_file))
        all_results.append(("色差测量数据", result))
    
    formulas_file = dir_path / "ink_formulas.json"
    if formulas_file.exists():
        with console.status(f"[bold green]正在导入油墨配方: {formulas_file.name}[/bold green]"):
            result = importer.import_ink_formula_json(str(formulas_file))
        all_results.append(("油墨配方", result))
    
    paper_file = dir_path / "paper_batches.csv"
    if paper_file.exists():
        with console.status(f"[bold green]正在导入纸张批次: {paper_file.name}[/bold green]"):
            result = importer.import_paper_batch_csv(str(paper_file))
        all_results.append(("纸张批次", result))
    
    drying_file = dir_path / "drying_records.csv"
    if drying_file.exists():
        with console.status(f"[bold green]正在导入干燥记录: {drying_file.name}[/bold green]"):
            result = importer.import_drying_record_csv(str(drying_file))
        all_results.append(("干燥记录", result))
    
    tolerances_file = dir_path / "customer_tolerances.json"
    if tolerances_file.exists():
        import json
        from colorproof_checker.store import parse_decimal
        
        with open(tolerances_file, 'r', encoding='utf-8') as f:
            tolerances_data = json.load(f)
        
        count = 0
        for tol_data in tolerances_data:
            special_tolerances = {}
            for k, v in tol_data.get('special_tolerances', {}).items():
                special_tolerances[k] = parse_decimal(v)
            
            tolerance = CustomerTolerance(
                customer_id=tol_data['customer_id'],
                customer_name=tol_data['customer_name'],
                delta_e_tolerance=parse_decimal(tol_data.get('delta_e_tolerance', '2.0')),
                min_drying_hours=parse_decimal(tol_data.get('min_drying_hours', '4')),
                special_tolerances=special_tolerances,
                notes=tol_data.get('notes')
            )
            store.save_customer_tolerance(tolerance)
            count += 1
        
        if count > 0:
            all_results.append(("客户容差配置", ImportResult(
                success=True,
                message=f"成功导入 {count} 条客户容差配置",
                imported_count=count
            )))
    
    console.print("\n" + "="*50)
    console.print("[bold]批量导入结果汇总[/bold]")
    console.print("="*50 + "\n")
    
    total_success = 0
    total_warnings = 0
    total_errors = 0
    
    for name, result in all_results:
        display_import_result(result, name)
        if result.success:
            total_success += result.imported_count
        total_warnings += len(result.warnings)
        total_errors += len(result.errors)
    
    console.print(Panel.fit(
        f"[bold]导入统计[/bold]\n"
        f"成功导入: {total_success} 条\n"
        f"警告: {total_warnings} 条\n"
        f"错误: {total_errors} 条",
        title="汇总"
    ))


def display_import_result(result: ImportResult, data_type: str):
    status_color = "green" if result.success else "red"
    
    console.print(f"\n[bold {status_color}]{data_type} 导入结果[/bold {status_color}]")
    console.print(f"状态: {'[green]成功[/green]' if result.success else '[red]失败[/red]'}")
    console.print(f"消息: {result.message}")
    
    if result.imported_count > 0:
        console.print(f"导入数量: [green]{result.imported_count}[/green] 条")
    
    if result.warnings:
        console.print(f"\n[bold yellow]警告 ({len(result.warnings)} 条):[/bold yellow]")
        for w in result.warnings[:10]:
            console.print(f"  - {w}")
        if len(result.warnings) > 10:
            console.print(f"  ... 还有 {len(result.warnings) - 10} 条警告")
    
    if result.errors:
        console.print(f"\n[bold red]错误 ({len(result.errors)} 条):[/bold red]")
        for e in result.errors[:10]:
            console.print(f"  - {e}")
        if len(result.errors) > 10:
            console.print(f"  ... 还有 {len(result.errors) - 10} 条错误")


@main.command()
@click.argument('proof_id', required=False)
@click.option('--all', is_flag=True, help='检查所有打样任务')
@click.option('--save', is_flag=True, help='保存检查结果到任务')
def check(proof_id: Optional[str], all: bool, save: bool):
    """
    检查打样任务的风险项
    
    检查包括:
    - DeltaE 超标检查
    - 色号混用检查
    - 纸张批次过期检查
    - 干燥时间检查
    
    PROOF_ID: 打样任务ID（不指定且不加--all时显示状态汇总）
    """
    ensure_initialized()
    store = get_store()
    checker = QualityChecker(store)
    
    if all:
        results = checker.run_all_checks()
        
        summary = results['summary']
        console.print(Panel.fit(
            f"[bold]检查汇总[/bold]\n"
            f"总任务数: {summary['total']}\n"
            f"[green]安全: {summary['safe']}[/green]\n"
            f"[yellow]警告: {summary['warning']}[/yellow]\n"
            f"[red]严重: {summary['critical']}[/red]",
            title="检查结果"
        ))
        
        table = Table(title="打样任务检查详情")
        table.add_column("任务编号", style="cyan")
        table.add_column("客户", style="green")
        table.add_column("色号")
        table.add_column("状态", style="blue")
        table.add_column("风险等级", style="bold")
        
        for proof_result in results['proofs']:
            risk_style = {
                'safe': 'green',
                'warning': 'yellow',
                'critical': 'red'
            }.get(proof_result['overall_risk'], 'white')
            
            table.add_row(
                proof_result['task_number'],
                proof_result['customer_name'],
                proof_result['color_code'],
                proof_result['status'],
                f"[{risk_style}]{proof_result['overall_risk']}[/{risk_style}]"
            )
        
        console.print(table)
        return
    
    if proof_id:
        proof = store.get_proof_task(proof_id)
        if not proof:
            console.print(f"[bold red]错误:[/bold red] 找不到打样任务: {proof_id}")
            sys.exit(1)
        
        with console.status("[bold green]正在执行检查...[/bold green]"):
            risk_level, checks, risks = checker.check_proof_task(proof)
        
        console.print(Panel.fit(
            f"任务: {proof.task_number}\n"
            f"客户: {proof.customer_name}\n"
            f"色号: {proof.color_code}\n"
            f"整体风险: [{get_risk_color(risk_level)}]{risk_level.value}[/{get_risk_color(risk_level)}]",
            title="检查结果"
        ))
        
        table = Table(title="检查项详情")
        table.add_column("检查类型", style="cyan")
        table.add_column("结果", style="bold")
        table.add_column("风险等级")
        table.add_column("说明")
        
        for check in checks:
            status_icon = "[green]✓[/green]" if check.passed else "[red]✗[/red]"
            risk_style = get_risk_color(check.risk_level)
            
            table.add_row(
                check.check_type,
                status_icon,
                f"[{risk_style}]{check.risk_level.value}[/{risk_style}]",
                check.message
            )
        
        console.print(table)
        
        if risks:
            console.print(f"\n[bold red]检测到风险项 ({len(risks)} 条):[/bold red]")
            for i, risk in enumerate(risks, 1):
                console.print(f"  {i}. [{get_risk_color(RiskLevel(risk['risk_level']))}]{risk['risk_level']}[/{get_risk_color(RiskLevel(risk['risk_level']))}]: {risk['message']}")
        
        if save:
            proof.risk_level = risk_level
            proof.risks = risks
            
            check_results = {}
            for check in checks:
                check_results[check.check_type] = {
                    'passed': check.passed,
                    'risk_level': check.risk_level.value,
                    'message': check.message,
                    'details': check.details
                }
            proof.check_results = check_results
            
            store.save_proof_task(proof)
            console.print(f"\n[green]检查结果已保存到任务[/green]")
        
        return
    
    proofs = store.list_proof_tasks()
    
    if not proofs:
        console.print(Panel.fit(
            "[yellow]当前没有打样任务[/yellow]\n"
            "请先创建任务或导入数据",
            title="提示"
        ))
        return
    
    table = Table(title="打样任务列表")
    table.add_column("ID", style="cyan")
    table.add_column("任务编号")
    table.add_column("客户", style="green")
    table.add_column("色号")
    table.add_column("状态", style="blue")
    table.add_column("风险等级", style="bold")
    
    for proof in proofs:
        risk_style = get_risk_color(proof.risk_level)
        table.add_row(
            proof.id,
            proof.task_number,
            proof.customer_name,
            proof.color_code,
            proof.status.value,
            f"[{risk_style}]{proof.risk_level.value}[/{risk_style}]"
        )
    
    console.print(table)
    console.print("\n使用 [bold yellow]colorproof check <任务ID>[/bold yellow] 查看详细检查结果")
    console.print("使用 [bold yellow]colorproof check --all[/bold yellow] 检查所有任务")


def get_risk_color(level: RiskLevel) -> str:
    if level == RiskLevel.SAFE:
        return "green"
    elif level == RiskLevel.WARNING:
        return "yellow"
    else:
        return "red"


@main.command()
@click.argument('proof_id')
@click.option('--operator', help='操作人名称')
@click.option('--force', is_flag=True, help='强制放行（即使有严重风险）')
def release(proof_id: str, operator: Optional[str], force: bool):
    """
    放行打样任务
    
    只有状态为"已审核"(approved)的任务才能放行。
    存在严重风险的任务默认不能放行，使用 --force 可强制放行。
    
    PROOF_ID: 打样任务ID
    """
    ensure_initialized()
    store = get_store()
    state_machine = ProofStateMachine(store)
    
    proof = store.get_proof_task(proof_id)
    if not proof:
        console.print(f"[bold red]错误:[/bold red] 找不到打样任务: {proof_id}")
        sys.exit(1)
    
    if proof.status != ProofStatus.APPROVED:
        console.print(f"[bold red]错误:[/bold red] 只有状态为 'approved' 的任务才能放行")
        console.print(f"当前状态: {proof.status.value}")
        sys.exit(1)
    
    with console.status("[bold green]正在执行放行操作...[/bold green]"):
        result = state_machine.release(proof_id, operator=operator, force=force)
    
    if result.success:
        console.print(Panel.fit(
            f"[bold green]放行成功[/bold green]\n"
            f"{result.message}",
            title="放行完成"
        ))
    else:
        console.print(Panel.fit(
            f"[bold red]放行失败[/bold red]\n"
            f"{result.message}",
            title="错误"
        ))
        
        if result.details and result.details.get('risks'):
            console.print(f"\n[bold]风险详情:[/bold]")
            for i, risk in enumerate(result.details['risks'], 1):
                console.print(f"  {i}. {risk['message']}")
        
        sys.exit(1)


@main.command()
@click.argument('proof_id')
@click.argument('reason')
@click.option('--operator', help='操作人名称')
def rollback(proof_id: str, reason: str, operator: Optional[str]):
    """
    回滚已放行的打样任务
    
    只有状态为"已放行"(released)的任务才能回滚。
    
    PROOF_ID: 打样任务ID
    REASON: 回滚原因
    """
    ensure_initialized()
    store = get_store()
    state_machine = ProofStateMachine(store)
    
    proof = store.get_proof_task(proof_id)
    if not proof:
        console.print(f"[bold red]错误:[/bold red] 找不到打样任务: {proof_id}")
        sys.exit(1)
    
    with console.status("[bold green]正在执行回滚操作...[/bold green]"):
        result = state_machine.rollback(proof_id, reason, operator=operator)
    
    if result.success:
        console.print(Panel.fit(
            f"[bold green]回滚成功[/bold green]\n"
            f"{result.message}",
            title="回滚完成"
        ))
    else:
        console.print(Panel.fit(
            f"[bold red]回滚失败[/bold red]\n"
            f"{result.message}",
            title="错误"
        ))
        sys.exit(1)


@main.command()
@click.argument('proof_id')
@click.option('--operator', help='操作人名称')
def approve(proof_id: str, operator: Optional[str]):
    """
    审核通过打样任务
    
    只有状态为"检查中"(checking)的任务才能审核通过。
    
    PROOF_ID: 打样任务ID
    """
    ensure_initialized()
    store = get_store()
    state_machine = ProofStateMachine(store)
    
    proof = store.get_proof_task(proof_id)
    if not proof:
        console.print(f"[bold red]错误:[/bold red] 找不到打样任务: {proof_id}")
        sys.exit(1)
    
    with console.status("[bold green]正在执行审核...[/bold green]"):
        result = state_machine.approve(proof_id, operator=operator)
    
    if result.success:
        console.print(Panel.fit(
            f"[bold green]审核成功[/bold green]\n"
            f"{result.message}",
            title="审核完成"
        ))
    else:
        console.print(Panel.fit(
            f"[bold red]审核失败[/bold red]\n"
            f"{result.message}",
            title="错误"
        ))
        sys.exit(1)


@main.command()
@click.argument('proof_id')
@click.argument('reason')
@click.option('--operator', help='操作人名称')
def reject(proof_id: str, reason: str, operator: Optional[str]):
    """
    驳回打样任务
    
    可以驳回状态为"待处理"(pending)、"检查中"(checking)或"已审核"(approved)的任务。
    
    PROOF_ID: 打样任务ID
    REASON: 驳回原因
    """
    ensure_initialized()
    store = get_store()
    state_machine = ProofStateMachine(store)
    
    proof = store.get_proof_task(proof_id)
    if not proof:
        console.print(f"[bold red]错误:[/bold red] 找不到打样任务: {proof_id}")
        sys.exit(1)
    
    with console.status("[bold green]正在执行驳回...[/bold green]"):
        result = state_machine.reject(proof_id, reason, operator=operator)
    
    if result.success:
        console.print(Panel.fit(
            f"[bold green]驳回成功[/bold green]\n"
            f"{result.message}",
            title="驳回完成"
        ))
    else:
        console.print(Panel.fit(
            f"[bold red]驳回失败[/bold red]\n"
            f"{result.message}",
            title="错误"
        ))
        sys.exit(1)


@main.command()
@click.argument('proof_id')
@click.option('--operator', help='操作人名称')
def reset(proof_id: str, operator: Optional[str]):
    """
    重置打样任务为待处理状态
    
    可以重置状态为"已驳回"(rejected)或"已回滚"(rolled_back)的任务。
    
    PROOF_ID: 打样任务ID
    """
    ensure_initialized()
    store = get_store()
    state_machine = ProofStateMachine(store)
    
    proof = store.get_proof_task(proof_id)
    if not proof:
        console.print(f"[bold red]错误:[/bold red] 找不到打样任务: {proof_id}")
        sys.exit(1)
    
    with console.status("[bold green]正在重置任务...[/bold green]"):
        result = state_machine.reset_to_pending(proof_id, operator=operator)
    
    if result.success:
        console.print(Panel.fit(
            f"[bold green]重置成功[/bold green]\n"
            f"{result.message}",
            title="重置完成"
        ))
    else:
        console.print(Panel.fit(
            f"[bold red]重置失败[/bold red]\n"
            f"{result.message}",
            title="错误"
        ))
        sys.exit(1)


@main.group()
def report():
    """
    导出复核报告
    
    支持导出 Markdown 和 CSV 格式的报告。
    """
    pass


@report.command("single")
@click.argument('proof_id')
@click.option('--format', '-f', type=click.Choice(['markdown', 'md', 'csv']), default='markdown', help='输出格式')
@click.option('--output', '-o', help='输出文件路径（默认导出到工作区exports目录）')
def report_single(proof_id: str, format: str, output: Optional[str]):
    """
    导出单个打样任务的复核报告
    
    PROOF_ID: 打样任务ID
    """
    ensure_initialized()
    store = get_store()
    reporter = ReportExporter(store)
    
    proof = store.get_proof_task(proof_id)
    if not proof:
        console.print(f"[bold red]错误:[/bold red] 找不到打样任务: {proof_id}")
        sys.exit(1)
    
    measurement = None
    if proof.color_measurement_id:
        measurement = store.get_color_measurement(proof.color_measurement_id)
    
    formula = None
    if proof.ink_formula_id:
        formula = store.get_ink_formula(proof.ink_formula_id)
    
    paper_batch = store.get_paper_batch_by_number(proof.paper_batch_number)
    
    drying_record = None
    if proof.drying_record_id:
        drying_record = store.get_drying_record(proof.drying_record_id)
    
    with console.status("[bold green]正在生成报告...[/bold green]"):
        if format in ['markdown', 'md']:
            content = reporter.export_proof_markdown(
                proof, measurement, formula, paper_batch, drying_record
            )
            default_ext = '.md'
            default_name = f"proof_{proof.task_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        else:
            content = reporter.export_proof_csv(
                proof, measurement, formula, paper_batch, drying_record
            )
            default_ext = '.csv'
            default_name = f"proof_{proof.task_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    if output:
        output_path = Path(output)
        if output_path.is_dir():
            output_path = output_path / default_name
    else:
        workspace = get_workspace()
        output_path = workspace.exports_dir / default_name
    
    with console.status(f"[bold green]正在保存报告到: {output_path}[/bold green]"):
        if format in ['markdown', 'md']:
            saved_path = reporter.save_markdown_report(content, str(output_path))
        else:
            saved_path = reporter.save_csv_report(content, str(output_path))
    
    console.print(Panel.fit(
        f"[bold green]报告生成成功[/bold green]\n"
        f"格式: {format}\n"
        f"路径: {saved_path}",
        title="报告导出完成"
    ))


@report.command("summary")
@click.option('--format', '-f', type=click.Choice(['markdown', 'md', 'csv']), default='markdown', help='输出格式')
@click.option('--output', '-o', help='输出文件路径')
@click.option('--status', '-s', multiple=True, help='筛选状态（可多次指定）')
def report_summary(format: str, output: Optional[str], status: tuple):
    """
    导出打样任务汇总报告
    """
    ensure_initialized()
    store = get_store()
    reporter = ReportExporter(store)
    
    proofs = store.list_proof_tasks()
    
    if status:
        status_values = [s.lower() for s in status]
        proofs = [p for p in proofs if p.status.value.lower() in status_values]
    
    if not proofs:
        console.print(Panel.fit(
            "[yellow]没有符合条件的打样任务[/yellow]",
            title="提示"
        ))
        return
    
    with console.status("[bold green]正在生成汇总报告...[/bold green]"):
        if format in ['markdown', 'md']:
            content = reporter.export_summary_markdown(proofs, "打样任务汇总报告")
            default_ext = '.md'
            default_name = f"proof_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        else:
            content = reporter.export_summary_csv(proofs)
            default_ext = '.csv'
            default_name = f"proof_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    if output:
        output_path = Path(output)
        if output_path.is_dir():
            output_path = output_path / default_name
    else:
        workspace = get_workspace()
        output_path = workspace.exports_dir / default_name
    
    with console.status(f"[bold green]正在保存报告到: {output_path}[/bold green]"):
        if format in ['markdown', 'md']:
            saved_path = reporter.save_markdown_report(content, str(output_path))
        else:
            saved_path = reporter.save_csv_report(content, str(output_path))
    
    console.print(Panel.fit(
        f"[bold green]汇总报告生成成功[/bold green]\n"
        f"任务数量: {len(proofs)}\n"
        f"格式: {format}\n"
        f"路径: {saved_path}",
        title="报告导出完成"
    ))


@main.command()
@click.argument('proof_id', required=False)
def history(proof_id: Optional[str]):
    """
    查看状态变更历史
    
    PROOF_ID: 打样任务ID（不指定时查看所有历史）
    """
    ensure_initialized()
    store = get_store()
    state_machine = ProofStateMachine(store)
    
    history = state_machine.get_release_history(proof_id)
    
    if not history:
        console.print(Panel.fit(
            "[yellow]暂无状态变更历史[/yellow]",
            title="提示"
        ))
        return
    
    table = Table(title="状态变更历史")
    table.add_column("时间", style="cyan")
    table.add_column("任务编号")
    table.add_column("从状态", style="red")
    table.add_column("到状态", style="green")
    table.add_column("操作人")
    table.add_column("原因")
    
    for entry in sorted(history, key=lambda x: x.get('timestamp', ''), reverse=True):
        table.add_row(
            entry.get('timestamp', '-')[:19] if entry.get('timestamp') else '-',
            entry.get('task_number', '-'),
            entry.get('from_status', '-'),
            entry.get('to_status', '-'),
            entry.get('operator') or '-',
            entry.get('reason') or '-'
        )
    
    console.print(table)


@main.command()
@click.argument('task_number')
@click.argument('customer_id')
@click.argument('customer_name')
@click.argument('color_code')
@click.argument('color_name')
@click.argument('paper_batch_number')
@click.option('--ink-formula-id', help='关联的油墨配方ID')
@click.option('--color-measurement-id', help='关联的色差测量ID')
@click.option('--drying-record-id', help='关联的干燥记录ID')
def create(
    task_number: str,
    customer_id: str,
    customer_name: str,
    color_code: str,
    color_name: str,
    paper_batch_number: str,
    ink_formula_id: Optional[str],
    color_measurement_id: Optional[str],
    drying_record_id: Optional[str]
):
    """
    创建新的打样任务
    
    TASK_NUMBER: 任务编号
    CUSTOMER_ID: 客户ID
    CUSTOMER_NAME: 客户名称
    COLOR_CODE: 色号
    COLOR_NAME: 颜色名称
    PAPER_BATCH_NUMBER: 纸张批次号
    """
    ensure_initialized()
    store = get_store()
    
    proof = ProofTask(
        id=None,
        task_number=task_number,
        customer_id=customer_id,
        customer_name=customer_name,
        color_code=color_code,
        color_name=color_name,
        paper_batch_number=paper_batch_number,
        ink_formula_id=ink_formula_id or '',
        color_measurement_id=color_measurement_id,
        drying_record_id=drying_record_id
    )
    
    with console.status("[bold green]正在创建打样任务...[/bold green]"):
        proof_id = store.save_proof_task(proof)
    
    console.print(Panel.fit(
        f"[bold green]打样任务创建成功[/bold green]\n"
        f"任务ID: {proof_id}\n"
        f"任务编号: {task_number}\n"
        f"客户: {customer_name} ({customer_id})\n"
        f"色号: {color_code} ({color_name})",
        title="创建完成"
    ))


@main.command()
def status():
    """
    查看工作区状态概览
    """
    ensure_initialized()
    store = get_store()
    state_machine = ProofStateMachine(store)
    
    workspace = get_workspace()
    state = workspace.get_state()
    
    proofs = store.list_proof_tasks()
    status_summary = state_machine.get_status_summary()
    
    console.print(Panel.fit(
        f"[bold]工作区路径:[/bold] {workspace.workspace_path}\n"
        f"[bold]最后更新:[/bold] {state.last_updated.strftime('%Y-%m-%d %H:%M:%S') if state.last_updated else '-'}\n"
        f"[bold]活跃任务数:[/bold] {len(state.active_proof_ids)}\n"
        f"[bold]历史记录数:[/bold] {len(state.release_history)}",
        title="工作区状态"
    ))
    
    if proofs:
        table = Table(title="任务状态统计")
        table.add_column("状态", style="cyan")
        table.add_column("数量", justify="right")
        
        for status_name, count in status_summary.items():
            if count > 0:
                table.add_row(status_name, str(count))
        
        console.print(table)
        
        console.print(f"\n使用 [bold yellow]colorproof check[/bold yellow] 查看任务列表")
        console.print(f"使用 [bold yellow]colorproof history[/bold yellow] 查看状态变更历史")


if __name__ == "__main__":
    main()
