import click
from pathlib import Path
from typing import List, Tuple, Optional
from tabulate import tabulate
from datetime import date

from .models import DocumentType, ReconciliationStatus
from .importer import FileImporter
from .validator import DataValidator
from .deduplicator import Deduplicator
from .reconciler import Reconciler
from .exporter import ReportExporter
from .history import HistoryManager


@click.group()
@click.version_option(version="1.0.0")
def cli():
    pass


@cli.command()
@click.option("--invoice", "-i", multiple=True, type=click.Path(exists=True),
              help="发票文件路径，可多次指定")
@click.option("--grn", "-g", multiple=True, type=click.Path(exists=True),
              help="收货单文件路径，可多次指定")
@click.option("--payment", "-p", multiple=True, type=click.Path(exists=True),
              help="付款文件路径，可多次指定")
@click.option("--output", "-o", type=click.Path(), default="./reports",
              help="报告输出目录")
@click.option("--history-dir", type=click.Path(), default="./reconciliation_history",
              help="历史记录目录")
@click.option("--period", type=click.Choice(["month", "quarter", "year"]),
              default="month", help="账期类型")
@click.option("--tolerance", type=float, default=0.01,
              help="金额匹配容差")
@click.option("--skip-dedupe", is_flag=True, help="跳过重复凭证检测")
@click.option("--no-save", is_flag=True, help="不保存到历史记录")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def reconcile(invoice, grn, payment, output, history_dir, period, 
              tolerance, skip_dedupe, no_save, verbose):
    importer = FileImporter(DataValidator(strict=False))
    documents = []
    
    for inv_file in invoice:
        docs = importer.import_file(inv_file, DocumentType.INVOICE)
        documents.extend(docs)
        if verbose:
            click.echo(f"已导入发票文件: {inv_file} ({len(docs)} 条记录)")
    
    for grn_file in grn:
        docs = importer.import_file(grn_file, DocumentType.GRN)
        documents.extend(docs)
        if verbose:
            click.echo(f"已导入收货单文件: {grn_file} ({len(docs)} 条记录)")
    
    for pay_file in payment:
        docs = importer.import_file(pay_file, DocumentType.PAYMENT)
        documents.extend(docs)
        if verbose:
            click.echo(f"已导入付款文件: {pay_file} ({len(docs)} 条记录)")
    
    if not documents:
        click.echo("未导入任何凭证，请检查文件参数")
        return 1
    
    if importer.import_errors:
        click.echo(f"\n⚠️  发现 {len(importer.import_errors)} 条导入错误:")
        for err in importer.import_errors[:5]:
            click.echo(f"  - 文件 {err['file']} 第 {err['row']} 行: {', '.join(err['errors'])}")
        if len(importer.import_errors) > 5:
            click.echo(f"  ... 还有 {len(importer.import_errors) - 5} 条错误")
    
    if not skip_dedupe:
        deduplicator = Deduplicator(tolerance=tolerance)
        documents = deduplicator.mark_duplicates(documents)
        dup_summary = deduplicator.get_duplicate_summary()
        if dup_summary:
            click.echo(f"\n🔍 检测到重复凭证:")
            for doc_type, count in dup_summary.items():
                click.echo(f"  - {doc_type}: {count} 条")
    
    reconciler = Reconciler(tolerance=tolerance)
    run = reconciler.reconcile(documents, period_type=period)
    
    exporter = ReportExporter(output_dir=output)
    files = exporter.export_all(run)
    
    if not no_save:
        history = HistoryManager(history_dir=history_dir)
        history.save_run(run)
        click.echo(f"\n💾 已保存到历史记录: {run.run_id}")
    
    summary = run.summary
    click.echo("\n" + "=" * 60)
    click.echo("对账完成")
    click.echo("=" * 60)
    click.echo(f"总凭证数: {summary['total_documents']}")
    click.echo(f"有效凭证: {summary['valid_documents']}")
    click.echo(f"无效凭证: {summary['invalid_documents']}")
    click.echo(f"总金额: {summary['total_amount']:,.2f}")
    click.echo(f"已匹配金额: {summary['matched_amount']:,.2f}")
    click.echo(f"匹配率: {summary['match_rate'] * 100:.2f}%")
    
    click.echo(f"\n📄 报告已导出:")
    for fmt, path in files.items():
        click.echo(f"  - {fmt.upper()}: {path}")
    
    if verbose:
        _print_results_table(run)
    
    return 0


@cli.command("history")
@click.option("--limit", "-n", type=int, default=10, help="显示最近N条记录")
@click.option("--history-dir", type=click.Path(), default="./reconciliation_history",
              help="历史记录目录")
@click.argument("run_id", required=False)
def show_history(limit, history_dir, run_id):
    history = HistoryManager(history_dir=history_dir)
    
    if run_id:
        run = history.get_run(run_id)
        if not run:
            click.echo(f"未找到运行记录: {run_id}")
            return 1
        
        click.echo(f"运行ID: {run['run_id']}")
        click.echo(f"运行时间: {run['run_date']}")
        click.echo(f"对账期间: {run['period']}")
        click.echo(f"\n摘要信息:")
        for key, value in run.get("summary", {}).items():
            click.echo(f"  {key}: {value}")
        return 0
    
    runs = history.list_runs(limit=limit)
    if not runs:
        click.echo("暂无历史记录")
        return 0
    
    table = []
    for i, run in enumerate(runs, 1):
        table.append([
            i,
            run["run_id"],
            run["run_date"][:19] if "T" in run["run_date"] else run["run_date"],
            run["period"],
            run["total_documents"],
            f"{run.get('match_rate', 0) * 100:.1f}%",
        ])
    
    headers = ["#", "运行ID", "运行时间", "账期", "凭证数", "匹配率"]
    click.echo(tabulate(table, headers=headers, tablefmt="simple"))
    return 0


@cli.command("validate")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--doc-type", "-t", required=True,
              type=click.Choice(["invoice", "grn", "payment"]),
              help="凭证类型")
@click.option("--strict", is_flag=True, help="严格模式")
def validate_file(file_path, doc_type, strict):
    type_map = {
        "invoice": DocumentType.INVOICE,
        "grn": DocumentType.GRN,
        "payment": DocumentType.PAYMENT,
    }
    
    validator = DataValidator(strict=strict)
    importer = FileImporter(validator)
    
    documents = importer.import_file(file_path, type_map[doc_type])
    
    click.echo(f"文件: {file_path}")
    click.echo(f"凭证类型: {doc_type}")
    click.echo(f"总记录数: {len(documents)}")
    click.echo(f"有效记录: {len([d for d in documents if d.is_valid])}")
    click.echo(f"无效记录: {len([d for d in documents if not d.is_valid])}")
    
    if importer.import_errors:
        click.echo(f"\n错误详情:")
        for err in importer.import_errors:
            row = err.get('row', '?')
            click.echo(f"  第 {row} 行:")
            for e in err['errors']:
                click.echo(f"    - {e}")
    
    return 0


@cli.command("export")
@click.argument("run_id")
@click.option("--format", "-f", "fmt",
              type=click.Choice(["json", "csv", "summary", "all"]),
              default="all", help="导出格式")
@click.option("--output", "-o", type=click.Path(), default="./reports",
              help="输出目录")
@click.option("--history-dir", type=click.Path(), default="./reconciliation_history",
              help="历史记录目录")
def export_report(run_id, fmt, output, history_dir):
    history = HistoryManager(history_dir=history_dir)
    run_data = history.get_run(run_id)
    
    if not run_data:
        click.echo(f"未找到运行记录: {run_id}")
        return 1
    
    from datetime import datetime
    from .models import ReconciliationRun, Document, DocumentType, ReconciliationItem, ReconciliationStatus
    
    documents = []
    for d in run_data["documents"]:
        doc_date = None
        if d.get("doc_date"):
            doc_date = datetime.fromisoformat(d["doc_date"]).date()
        
        due_date = None
        if d.get("due_date"):
            due_date = datetime.fromisoformat(d["due_date"]).date()
        
        documents.append(Document(
            doc_type=DocumentType(d["doc_type"]),
            doc_number=d["doc_number"],
            supplier_id=d["supplier_id"],
            supplier_name=d["supplier_name"],
            amount=d["amount"],
            doc_date=doc_date or date.today(),
            due_date=due_date,
            description=d.get("description", ""),
            reference=d.get("reference", ""),
            metadata=d.get("metadata", {}),
            validation_errors=d.get("validation_errors", []),
            is_valid=d.get("is_valid", True),
        ))
    
    results = []
    for r in run_data["results"]:
        doc = next((d for d in documents if f"{d.doc_type.value}:{d.doc_number}:{d.supplier_id}" == r.get("document_key", "")), 
                   documents[0] if documents else None)
        if doc:
            results.append(ReconciliationItem(
                document=doc,
                matched_amount=r["matched_amount"],
                matched_documents=r.get("matched_documents", []),
                status=ReconciliationStatus(r["status"]),
                aging_days=r["aging_days"],
                period=r["period"],
            ))
    
    run = ReconciliationRun(
        run_id=run_data["run_id"],
        run_date=datetime.fromisoformat(run_data["run_date"]),
        period=run_data["period"],
        documents=documents,
        results=results,
        summary=run_data.get("summary", {}),
        errors=run_data.get("errors", []),
    )
    
    exporter = ReportExporter(output_dir=output)
    
    if fmt == "all":
        files = exporter.export_all(run)
        for f_type, path in files.items():
            click.echo(f"已导出 {f_type.upper()}: {path}")
    else:
        if fmt == "json":
            path = exporter.export_json(run)
        elif fmt == "csv":
            path = exporter.export_csv(run)
        else:
            path = exporter.export_summary(run)
        click.echo(f"已导出: {path}")
    
    return 0


def _print_results_table(run):
    status_map = {
        ReconciliationStatus.MATCHED: "已匹配",
        ReconciliationStatus.PARTIAL: "部分匹配",
        ReconciliationStatus.UNMATCHED: "未匹配",
        ReconciliationStatus.DUPLICATE: "重复",
        ReconciliationStatus.INVALID: "无效",
    }
    
    type_map = {
        DocumentType.INVOICE: "发票",
        DocumentType.GRN: "收货单",
        DocumentType.PAYMENT: "付款",
    }
    
    table = []
    for r in run.results:
        doc = r.document
        table.append([
            type_map.get(doc.doc_type, doc.doc_type.value),
            doc.doc_number,
            doc.supplier_name,
            f"{doc.amount:,.2f}",
            f"{r.matched_amount:,.2f}",
            f"{r.remaining_amount:,.2f}",
            status_map.get(r.status, r.status.value),
            r.period,
        ])
    
    headers = ["类型", "凭证号", "供应商", "金额", "已匹配", "剩余", "状态", "账期"]
    click.echo("\n" + tabulate(table, headers=headers, tablefmt="grid"))


if __name__ == "__main__":
    cli()
