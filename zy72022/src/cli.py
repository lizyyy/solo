import os
import sys
import json
from pathlib import Path
from datetime import datetime
import click
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from .database import init_db, get_db, verify_database_integrity
from .importer import import_all_samples, DataImporter
from .processor import process_deposits, DepositProcessor
from .reporter import print_terminal_summary, export_financial_details, TerminalReporter
from .config import SAMPLES_DIR, EXPORTS_DIR, DB_PATH

console = Console()


@click.group()
@click.version_option(version="1.0.0", prog_name="二手车拍卖保证金复核系统")
def cli():
    """二手车拍卖保证金风控复核系统

    用于处理二手车拍卖保证金的导入、匹配、冲突检测和导出。
    """
    init_db()


@cli.command()
@click.option("--dir", "dir_path", type=click.Path(exists=True, file_okay=False),
              default=str(SAMPLES_DIR), help="数据文件目录")
@click.option("--skip-processed/--no-skip-processed", default=True,
              help="跳过已处理过的文件")
def import_data(dir_path, skip_processed):
    """导入数据文件（CSV/Excel）"""
    console.print(Panel.fit(
        "[bold cyan]二手车拍卖保证金 - 数据导入[/bold cyan]",
        border_style="cyan"
    ))

    contracts = {}
    with get_db() as db:
        importer = DataImporter(db)
        results = importer.import_directory(dir_path, skip_processed=skip_processed)

        for result in results:
            if result.get("file_type") == "contract_scan" and "contracts" in result:
                contracts.update(result["contracts"])

    reporter = TerminalReporter()
    reporter.print_import_summary(results)

    if contracts:
        console.print(f"[green]✓[/green] 解析到 {len(contracts)} 份合同扫描件数据")

    return results, contracts


@cli.command()
@click.option("--contracts", "contracts_file", type=click.Path(exists=True, dir_okay=False),
              help="合同数据JSON文件（可选）")
def process(contracts_file):
    """处理二手车拍卖保证金匹配和判断"""
    console.print(Panel.fit(
        "[bold cyan]二手车拍卖保证金 - 核心处理[/bold cyan]",
        border_style="cyan"
    ))

    contracts = {}
    if contracts_file:
        with open(contracts_file, 'r', encoding='utf-8') as f:
            contracts = json.load(f)
        console.print(f"[green]✓[/green] 加载合同数据: {len(contracts)} 条")

    with get_db() as db:
        importer = DataImporter(db)
        results = importer.import_directory(str(SAMPLES_DIR), skip_processed=True)
        for result in results:
            if result.get("file_type") == "contract_scan" and "contracts" in result:
                contracts.update(result["contracts"])

        processor = DepositProcessor(db)
        processing_results = processor.process_all(contracts)

    reporter = TerminalReporter()
    reporter.print_processing_summary(processing_results)

    conflicts = []
    for r in processing_results:
        if r.get("conflicts"):
            conflicts.extend(r["conflicts"])
    reporter.print_conflicts(conflicts)

    return processing_results


@cli.command()
@click.option("--output", "-o", "output_file", type=click.Path(dir_okay=False),
              help="导出文件路径")
def export(output_file):
    """导出财务明细到Excel"""
    console.print(Panel.fit(
        "[bold cyan]二手车拍卖保证金 - 导出明细[/bold cyan]",
        border_style="cyan"
    ))

    output_path, stats = export_financial_details(output_file)

    if not output_path:
        console.print(f"[yellow]⚠ {stats.get('message', '导出失败')}[/yellow]")
        return

    console.print(f"[green]✓[/green] 导出成功: [cyan]{output_path}[/cyan]")
    console.print()

    console.print(f"  总记录数: {stats['total_records']}")
    console.print(f"  已确认金额: [green]¥{stats['total_confirmed']:,.2f}[/green]")
    console.print(f"  挂起金额: [yellow]¥{stats['total_suspended']:,.2f}[/yellow]")
    console.print(f"  已退款金额: [blue]¥{stats['total_refunded']:,.2f}[/blue]")
    console.print()

    console.print("  状态分布:")
    for status, data in stats['status_breakdown'].items():
        status_labels = {
            "confirmed": "已确认",
            "suspended": "挂起",
            "conflict": "冲突",
            "refunded": "已退款",
            "pending": "待处理"
        }
        label = status_labels.get(status, status)
        console.print(f"    {label}: {data['count']} 笔, ¥{data['amount']:,.2f}")

    return output_path, stats


@cli.command()
@click.option("--dir", "dir_path", type=click.Path(exists=True, file_okay=False),
              default=str(SAMPLES_DIR), help="数据文件目录")
@click.option("--output", "-o", "output_file", type=click.Path(dir_okay=False),
              help="导出文件路径")
@click.option("--skip-processed/--no-skip-processed", default=False,
              help="跳过已处理过的文件")
def run_all(dir_path, output_file, skip_processed):
    """完整流程：导入 -> 处理 -> 导出"""
    console.print(Panel.fit(
        "[bold cyan]二手车拍卖保证金 - 完整处理流程[/bold cyan]\n"
        "[grey50]导入 → 匹配 → 冲突检测 → 导出[/grey50]",
        border_style="cyan"
    ))
    console.print()

    start_time = datetime.now()

    contracts = {}
    with get_db() as db:
        importer = DataImporter(db)
        import_results = importer.import_directory(dir_path, skip_processed=skip_processed)

        for result in import_results:
            if result.get("file_type") == "contract_scan" and "contracts" in result:
                contracts.update(result["contracts"])

        processor = DepositProcessor(db)
        processing_results = processor.process_all(contracts)

    print_terminal_summary(import_results, processing_results)

    output_path, stats = export_financial_details(output_file)

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    console.print(Panel.fit(
        f"[bold green]处理完成[/bold green]\n"
        f"耗时: {duration:.2f} 秒\n"
        f"导出文件: [cyan]{output_path}[/cyan]\n"
        f"已确认: [green]¥{stats['total_confirmed']:,.2f}[/green] | "
        f"挂起: [yellow]¥{stats['total_suspended']:,.2f}[/yellow] | "
        f"退款: [blue]¥{stats['total_refunded']:,.2f}[/blue]",
        border_style="green"
    ))

    return {
        "import_results": import_results,
        "processing_results": processing_results,
        "export_file": output_path,
        "stats": stats,
        "duration": duration
    }


@cli.command()
def verify():
    """验证数据库完整性（重启后检查）"""
    console.print(Panel.fit(
        "[bold cyan]二手车拍卖保证金 - 数据完整性验证[/bold cyan]",
        border_style="cyan"
    ))

    integrity = verify_database_integrity()

    if not integrity["db_exists"]:
        console.print(f"[red]✗ 数据库不存在: {DB_PATH}[/red]")
        return integrity

    console.print(f"[green]✓[/green] 数据库存在: {DB_PATH}")
    console.print(f"[green]✓[/green] 保证金记录: {integrity['deposit_count']} 条")
    console.print(f"[green]✓[/green] 证据链记录: {integrity['evidence_link_count']} 条")
    console.print(f"[green]✓[/green] 审计日志: {integrity['audit_log_count']} 条")
    console.print()
    console.print(f"  已确认金额: [green]¥{integrity['total_confirmed_amount']:,.2f}[/green]")
    console.print(f"  挂起金额: [yellow]¥{integrity['total_suspended_amount']:,.2f}[/yellow]")

    if integrity.get("error"):
        console.print(f"[red]✗ 验证错误: {integrity['error']}[/red]")
    else:
        console.print(f"[green]✓ 数据一致性验证通过[/green]")

    console.print()
    console.print("[grey50]提示：历史备注和导出数字已持久化到SQLite，重启服务后数据保持一致[/grey50]")

    return integrity


@cli.command()
@click.argument("transaction_no")
def show_evidence(transaction_no):
    """查看指定交易号的完整证据链"""
    from .models import AuctionDeposit, EvidenceLink, ConflictRecord

    console.print(Panel.fit(
        f"[bold cyan]交易证据链 - {transaction_no}[/bold cyan]",
        border_style="cyan"
    ))

    with get_db() as db:
        deposit = db.query(AuctionDeposit).filter(
            AuctionDeposit.transaction_no == transaction_no
        ).first()

        if not deposit:
            console.print(f"[red]✗ 未找到交易记录: {transaction_no}[/red]")
            return

        console.print()
        console.print(f"[bold]保证金编号:[/bold] {deposit.deposit_no}")
        console.print(f"[bold]交易号:[/bold] {deposit.transaction_no}")
        console.print(f"[bold]付款人:[/bold] {deposit.payer}")
        console.print(f"[bold]批次:[/bold] {deposit.related_batch or '-'}")
        console.print(f"[bold]金额:[/bold] ¥{deposit.amount:,.2f}")
        console.print(f"[bold]状态:[/bold] {deposit.status}")
        console.print(f"[bold]确认金额:[/bold] ¥{deposit.confirmed_amount:,.2f}")
        console.print(f"[bold]挂起金额:[/bold] ¥{deposit.suspended_amount:,.2f}")
        console.print()

        console.print(f"[bold magenta]判断原因:[/bold magenta]")
        console.print(Text(deposit.decision_reason, style="grey50"))
        console.print()

        console.print(f"[bold magenta]判断时间:[/bold magenta] {deposit.decision_time.strftime('%Y-%m-%d %H:%M:%S') if deposit.decision_time else '-'}")
        console.print(f"[bold magenta]判断人:[/bold magenta] {deposit.decision_made_by}")
        console.print()

        evidence_links = db.query(EvidenceLink).filter(
            EvidenceLink.deposit_id == deposit.id
        ).order_by(EvidenceLink.relevance_score.desc()).all()

        if evidence_links:
            console.print(f"[bold magenta]证据链 ({len(evidence_links)} 条):[/bold magenta]")
            type_labels = {
                "payment_flow": "收款流水",
                "refund_request": "退款申请",
                "approval_email": "审批邮件",
                "manual_note": "手写备注",
                "attachment_index": "附件索引"
            }
            for link in evidence_links:
                type_name = type_labels.get(link.evidence_type, link.evidence_type)
                console.print(f"  [{link.relevance_score:.0%}] [cyan]{type_name}[/cyan]: {link.evidence_content}")
                if link.evidence_source:
                    console.print(f"       来源: {link.evidence_source}")

        conflicts = db.query(ConflictRecord).filter(
            ConflictRecord.deposit_id == deposit.id,
            ConflictRecord.resolved == False
        ).all()

        if conflicts:
            console.print()
            console.print(f"[bold red]未解决冲突 ({len(conflicts)} 条):[/bold red]")
            for c in conflicts:
                console.print(f"  类型: {c.conflict_type}")
                console.print(f"  建议: {c.suggested_action}")

    return deposit


@cli.command()
def list_samples():
    """列出样例数据文件"""
    console.print(Panel.fit(
        "[bold cyan]二手车拍卖保证金 - 样例数据文件[/bold cyan]",
        border_style="cyan"
    ))

    for file_path in sorted(SAMPLES_DIR.glob("*")):
        if file_path.is_file():
            size = file_path.stat().st_size
            console.print(f"  [cyan]{file_path.name}[/cyan] ({size} bytes)")

    console.print()
    console.print(f"样例数据目录: [grey50]{SAMPLES_DIR}[/grey50]")


def main():
    try:
        cli()
    except KeyboardInterrupt:
        console.print("\n[yellow]操作已取消[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]错误: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
