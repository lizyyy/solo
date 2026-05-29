from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
import re

import click
from colorama import Fore, Style, init
from tabulate import tabulate

from .models import PrintRecord, PrintStatus, HistoryEntry, Severity
from .storage import Storage
from .validator import EditionValidator, CertificateTracker, ReturnRollback
from .exporter import ReportExporter


init(autoreset=True)


def load_config(base_dir: Path) -> Dict[str, Any]:
    config_path = base_dir / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text(encoding="utf-8"))
    return {
        "data_dirs": {
            "input": "data/input",
            "output": "data/output",
            "errors": "data/errors",
            "history": "data/history"
        },
        "edition_formats": {
            "regular": r"^(\d+)/(\d+)$",
            "ap": r"^AP\s+(\d+)/(\d+)$"
        },
        "conflict_severity": {
            "duplicate_edition": "critical",
            "missing_certificate": "warning",
            "stale_return_status": "info"
        }
    }


def get_storage(base_dir: Path) -> Storage:
    config = load_config(base_dir)
    return Storage(base_dir, config)


def parse_input_data(raw_data: List[Dict[str, Any]], storage: Storage) -> List[PrintRecord]:
    records = []
    for i, item in enumerate(raw_data):
        try:
            edition = item.get("edition_number", "")
            is_ap = bool(re.match(r"^AP\s+(\d+)/(\d+)$", edition))

            status = item.get("status", "available")
            if isinstance(status, str):
                try:
                    status_enum = PrintStatus(status.lower())
                except ValueError:
                    status_enum = PrintStatus.AVAILABLE
            else:
                status_enum = PrintStatus.AVAILABLE

            record = PrintRecord(
                series=item.get("series", "").strip(),
                edition_number=edition.strip(),
                is_ap=is_ap,
                buyer=item.get("buyer", "").strip() or None,
                certificate_number=item.get("certificate_number", "").strip() or None,
                verification_report=item.get("verification_report", "").strip() or None,
                remarks=item.get("remarks", "").strip() or None,
                receipt=item.get("receipt", "").strip() or None,
                status=status_enum,
                record_id=item.get("record_id") or storage.generate_record_id()
            )
            records.append(record)
        except Exception as e:
            click.echo(f"{Fore.RED}错误: 第{i+1}条数据解析失败: {e}{Style.RESET_ALL}")
            raise
    return records


@click.group()
@click.option("--base-dir", type=click.Path(), default=str(Path.cwd()), help="工作目录")
@click.pass_context
def cli(ctx: click.Context, base_dir: str) -> None:
    """版画编号防重CLI工具 - 管理限量版画的编号、证书和销售状态"""
    base_dir_path = Path(base_dir).resolve()
    ctx.ensure_object(dict)
    ctx.obj["base_dir"] = base_dir_path
    ctx.obj["storage"] = get_storage(base_dir_path)
    ctx.obj["validator"] = EditionValidator(ctx.obj["storage"])
    ctx.obj["cert_tracker"] = CertificateTracker(ctx.obj["storage"])
    ctx.obj["rollback"] = ReturnRollback(ctx.obj["storage"])
    ctx.obj["exporter"] = ReportExporter(ctx.obj["storage"])


@cli.command()
@click.option("--input", "-i", type=click.Path(exists=True), required=True, help="输入JSON文件路径")
@click.option("--batch-id", "-b", help="指定批次ID，不指定则自动生成")
@click.option("--no-validate", is_flag=True, help="跳过自动校验")
@click.pass_context
def add(ctx: click.Context, input: str, batch_id: Optional[str], no_validate: bool) -> None:
    """录入一批版画材料"""
    storage: Storage = ctx.obj["storage"]
    validator: EditionValidator = ctx.obj["validator"]
    input_path = Path(input)

    try:
        raw_data = json.loads(input_path.read_text(encoding="utf-8"))
        import builtins
        if not isinstance(raw_data, builtins.list):
            raise ValueError("输入文件必须是JSON数组")
    except Exception as e:
        click.echo(f"{Fore.RED}读取输入文件失败: {e}{Style.RESET_ALL}")
        sys.exit(1)

    if not batch_id:
        batch_id = storage.generate_batch_id()

    click.echo(f"\n{Fore.CYAN}=== 录入批次 {batch_id} ==={Style.RESET_ALL}")
    click.echo(f"输入文件: {input_path}")
    click.echo(f"记录数量: {len(raw_data)}")

    try:
        records = parse_input_data(raw_data, storage)
    except Exception as e:
        click.echo(f"{Fore.RED}数据解析失败，已终止{Style.RESET_ALL}")
        sys.exit(1)

    storage.save_input_backup(batch_id, raw_data)
    storage.save_records(records, batch_id)

    click.echo(f"{Fore.GREEN}✓ {len(records)} 条记录已保存{Style.RESET_ALL}")

    if not no_validate:
        click.echo(f"\n{Fore.YELLOW}正在执行校验...{Style.RESET_ALL}")
        result = validator.validate_batch(batch_id, [])
        click.echo(ctx.obj["exporter"].format_console_output(result))

        history_entry = HistoryEntry(
            operation="add_with_validation",
            batch_id=batch_id,
            record_count=len(records),
            conflict_count=len(result.conflicts),
            details={
                "input_file": str(input_path),
                "is_valid": result.is_valid
            }
        )
        storage.add_history_entry(history_entry)

        if not result.is_valid:
            click.echo(f"\n{Fore.RED}⚠ 存在严重冲突，请查看错误清单后处理{Style.RESET_ALL}")
            error_file = storage.save_error_report(batch_id, result.conflicts)
            click.echo(f"错误清单已保存到: {error_file}")
            sys.exit(1)
    else:
        history_entry = HistoryEntry(
            operation="add_skip_validation",
            batch_id=batch_id,
            record_count=len(records),
            details={"input_file": str(input_path)}
        )
        storage.add_history_entry(history_entry)

    click.echo(f"\n批次ID: {Fore.CYAN}{batch_id}{Style.RESET_ALL}")
    click.echo(f"后续可使用此ID进行校验、导出等操作")


@cli.command()
@click.option("--batch-id", "-b", help="指定批次ID，不指定则校验最新批次")
@click.pass_context
def check(ctx: click.Context, batch_id: Optional[str]) -> None:
    """校验批次的编号、证书和状态"""
    storage: Storage = ctx.obj["storage"]
    validator: EditionValidator = ctx.obj["validator"]
    exporter: ReportExporter = ctx.obj["exporter"]

    if not batch_id:
        batch_ids = storage.get_batch_ids()
        if not batch_ids:
            click.echo(f"{Fore.RED}没有找到任何批次记录{Style.RESET_ALL}")
            sys.exit(1)
        batch_id = batch_ids[-1]
        click.echo(f"{Fore.YELLOW}未指定批次，自动使用最新批次: {batch_id}{Style.RESET_ALL}")

    click.echo(f"\n{Fore.CYAN}=== 校验批次 {batch_id} ==={Style.RESET_ALL}")

    result = validator.validate_batch(batch_id, [])
    click.echo(exporter.format_console_output(result))

    error_file = exporter.export_error_list(batch_id)
    click.echo(f"\n{Fore.BLUE}错误清单已保存到: {error_file}{Style.RESET_ALL}")

    history_entry = HistoryEntry(
        operation="check",
        batch_id=batch_id,
        record_count=result.total_records,
        conflict_count=len(result.conflicts),
        details={"is_valid": result.is_valid}
    )
    storage.add_history_entry(history_entry)

    cert_tracker: CertificateTracker = ctx.obj["cert_tracker"]
    cert_status = cert_tracker.verify_certificate_chain(batch_id)
    click.echo(f"\n{Fore.CYAN}--- 证书追踪状态 ---{Style.RESET_ALL}")
    click.echo(f"已售总数: {cert_status['total_sold']}")
    click.echo(f"已有证书: {cert_status['with_certificate']}")
    click.echo(f"缺少证书: {Fore.YELLOW}{cert_status['without_certificate']}{Style.RESET_ALL}")
    click.echo(f"完成率: {Fore.GREEN if cert_status['completion_rate'] == 1.0 else Fore.YELLOW}{cert_status['completion_rate']:.1%}{Style.RESET_ALL}")

    if not result.is_valid:
        sys.exit(1)


@cli.command()
@click.argument("record_id")
@click.option("--clear-cert/--keep-cert", default=True, help="是否清除证书号")
@click.pass_context
def return_item(ctx: click.Context, record_id: str, clear_cert: bool) -> None:
    """处理退货，将作品状态改为已退货"""
    storage: Storage = ctx.obj["storage"]
    rollback: ReturnRollback = ctx.obj["rollback"]

    try:
        record = rollback.process_return(record_id, clear_certificate=clear_cert)
        click.echo(f"{Fore.GREEN}✓ 退货处理成功{Style.RESET_ALL}")
        click.echo(f"作品: {record.series} {record.edition_number}")
        click.echo(f"状态: {Fore.YELLOW}{record.status.value}{Style.RESET_ALL}")
        if record.remarks:
            click.echo(f"备注: {record.remarks}")

        if record.batch_id:
            history_entry = HistoryEntry(
                operation="return",
                batch_id=record.batch_id,
                record_count=1,
                details={
                    "record_id": record_id,
                    "edition": record.get_edition_key(),
                    "clear_certificate": clear_cert
                }
            )
            storage.add_history_entry(history_entry)
    except ValueError as e:
        click.echo(f"{Fore.RED}错误: {e}{Style.RESET_ALL}")
        sys.exit(1)


@cli.command()
@click.argument("record_id")
@click.option("--buyer", help="恢复购买人")
@click.option("--certificate", help="恢复证书号")
@click.pass_context
def rollback(ctx: click.Context, record_id: str, buyer: Optional[str], certificate: Optional[str]) -> None:
    """撤销退货，恢复为已售状态"""
    storage: Storage = ctx.obj["storage"]
    rollback_mgr: ReturnRollback = ctx.obj["rollback"]

    try:
        record = rollback_mgr.rollback_return(
            record_id,
            restore_buyer=buyer,
            restore_certificate=certificate
        )
        click.echo(f"{Fore.GREEN}✓ 撤销退货成功{Style.RESET_ALL}")
        click.echo(f"作品: {record.series} {record.edition_number}")
        click.echo(f"状态: {Fore.GREEN}{record.status.value}{Style.RESET_ALL}")
        if record.buyer:
            click.echo(f"购买人: {record.buyer}")
        if record.certificate_number:
            click.echo(f"证书号: {record.certificate_number}")

        if record.batch_id:
            history_entry = HistoryEntry(
                operation="rollback_return",
                batch_id=record.batch_id,
                record_count=1,
                details={
                    "record_id": record_id,
                    "edition": record.get_edition_key()
                }
            )
            storage.add_history_entry(history_entry)
    except ValueError as e:
        click.echo(f"{Fore.RED}错误: {e}{Style.RESET_ALL}")
        sys.exit(1)


@cli.command()
@click.option("--batch-id", "-b", help="指定批次ID，不指定则使用最新批次")
@click.option("--format", "-f", type=click.Choice(["json", "csv", "txt"]), default="txt", help="导出格式")
@click.pass_context
def export(ctx: click.Context, batch_id: Optional[str], format: str) -> None:
    """导出核对报告"""
    storage: Storage = ctx.obj["storage"]
    exporter: ReportExporter = ctx.obj["exporter"]

    if not batch_id:
        batch_ids = storage.get_batch_ids()
        if not batch_ids:
            click.echo(f"{Fore.RED}没有找到任何批次记录{Style.RESET_ALL}")
            sys.exit(1)
        batch_id = batch_ids[-1]
        click.echo(f"{Fore.YELLOW}未指定批次，自动使用最新批次: {batch_id}{Style.RESET_ALL}")

    try:
        output_file = exporter.export_validation_report(batch_id, format=format)
        click.echo(f"{Fore.GREEN}✓ 报告已导出到: {output_file}{Style.RESET_ALL}")

        validation_result = storage.load_validation_result(batch_id)
        if validation_result:
            export_count = validation_result.total_records
        else:
            export_count = len(storage.get_records_by_batch(batch_id))

        history_entry = HistoryEntry(
            operation=f"export_{format}",
            batch_id=batch_id,
            record_count=export_count,
            export_count=export_count,
            details={
                "format": format,
                "output_file": str(output_file)
            }
        )
        storage.add_history_entry(history_entry)

        click.echo(f"导出记录数: {export_count}")
    except ValueError as e:
        click.echo(f"{Fore.RED}错误: {e}{Style.RESET_ALL}")
        sys.exit(1)


@cli.command()
@click.option("--limit", "-n", type=int, default=10, help="显示最近N条记录")
@click.option("--batch-id", "-b", help="显示指定批次的历史")
@click.pass_context
def history(ctx: click.Context, limit: int, batch_id: Optional[str]) -> None:
    """查看操作历史记录"""
    storage: Storage = ctx.obj["storage"]

    if batch_id:
        history_entries = [
            e for e in storage.load_history()
            if e.batch_id == batch_id
        ]
        click.echo(f"\n{Fore.CYAN}=== 批次 {batch_id} 的操作历史 ==={Style.RESET_ALL}")
    else:
        history_entries = storage.load_history(limit=limit)
        click.echo(f"\n{Fore.CYAN}=== 最近 {limit} 条操作历史 ==={Style.RESET_ALL}")

    if not history_entries:
        click.echo(f"{Fore.YELLOW}暂无历史记录{Style.RESET_ALL}")
        return

    table_data = []
    for entry in history_entries:
        ts = entry.timestamp.strftime("%Y-%m-%d %H:%M:%S") if isinstance(entry.timestamp, datetime) else entry.timestamp
        conflict_str = str(entry.conflict_count) if entry.conflict_count > 0 else "-"
        export_str = str(entry.export_count) if entry.export_count is not None else "-"
        table_data.append([
            ts,
            entry.operation,
            entry.batch_id[:20] + "..." if len(entry.batch_id) > 20 else entry.batch_id,
            entry.record_count,
            conflict_str,
            export_str
        ])

    headers = ["时间", "操作", "批次ID", "记录数", "冲突数", "导出数"]
    click.echo(tabulate(table_data, headers=headers, tablefmt="grid"))

    total_exports = sum(
        e.export_count or 0
        for e in history_entries
        if e.export_count is not None
    )
    if total_exports > 0:
        click.echo(f"\n{Fore.BLUE}累计导出记录数: {total_exports}{Style.RESET_ALL}")


@cli.command()
@click.option("--batch-id", "-b", help="指定批次ID，不指定则显示所有批次")
@click.pass_context
def list(ctx: click.Context, batch_id: Optional[str]) -> None:
    """列出版画记录"""
    storage: Storage = ctx.obj["storage"]

    if batch_id:
        records = storage.get_records_by_batch(batch_id)
        click.echo(f"\n{Fore.CYAN}=== 批次 {batch_id} 的记录 ({len(records)}条) ==={Style.RESET_ALL}")
    else:
        records = storage.load_all_records()
        click.echo(f"\n{Fore.CYAN}=== 所有记录 ({len(records)}条) ==={Style.RESET_ALL}")

    if not records:
        click.echo(f"{Fore.YELLOW}暂无记录{Style.RESET_ALL}")
        return

    table_data = []
    for r in records:
        status_color = {
            PrintStatus.AVAILABLE: Fore.WHITE,
            PrintStatus.SOLD: Fore.GREEN,
            PrintStatus.RETURNED: Fore.YELLOW,
            PrintStatus.RESERVED: Fore.CYAN
        }.get(r.status, Fore.WHITE)

        table_data.append([
            r.record_id[:10],
            r.series,
            r.edition_number,
            "是" if r.is_ap else "否",
            r.buyer or "-",
            r.certificate_number or "-",
            status_color + r.status.value + Style.RESET_ALL,
            (r.remarks or "")[:20]
        ])

    headers = ["记录ID", "系列", "版号", "AP", "购买人", "证书号", "状态", "备注"]
    click.echo(tabulate(table_data, headers=headers, tablefmt="grid"))


@cli.command()
@click.argument("record_id")
@click.option("--certificate", "-c", required=True, help="证书号")
@click.pass_context
def add_cert(ctx: click.Context, record_id: str, certificate: str) -> None:
    """补充证书号"""
    storage: Storage = ctx.obj["storage"]
    cert_tracker: CertificateTracker = ctx.obj["cert_tracker"]

    try:
        record = cert_tracker.track_certificate(record_id, certificate)
        click.echo(f"{Fore.GREEN}✓ 证书号已更新{Style.RESET_ALL}")
        click.echo(f"作品: {record.series} {record.edition_number}")
        click.echo(f"证书号: {Fore.CYAN}{record.certificate_number}{Style.RESET_ALL}")

        if record.batch_id:
            history_entry = HistoryEntry(
                operation="add_certificate",
                batch_id=record.batch_id,
                record_count=1,
                details={
                    "record_id": record_id,
                    "certificate_number": certificate
                }
            )
            storage.add_history_entry(history_entry)
    except ValueError as e:
        click.echo(f"{Fore.RED}错误: {e}{Style.RESET_ALL}")
        sys.exit(1)


@cli.command()
@click.pass_context
def audit(ctx: click.Context) -> None:
    """全面审计：检查所有退货状态和证书问题"""
    rollback: ReturnRollback = ctx.obj["rollback"]
    cert_tracker: CertificateTracker = ctx.obj["cert_tracker"]

    click.echo(f"\n{Fore.CYAN}=== 全面审计 ==={Style.RESET_ALL}")

    return_conflicts = rollback.audit_return_status()
    if return_conflicts:
        click.echo(f"\n{Fore.YELLOW}退货状态问题 ({len(return_conflicts)}项):{Style.RESET_ALL}")
        for c in return_conflicts:
            click.echo(f"  - {c.description}")
    else:
        click.echo(f"\n{Fore.GREEN}✓ 退货状态正常{Style.RESET_ALL}")

    missing_certs = cert_tracker.get_untracked_certificates()
    if missing_certs:
        click.echo(f"\n{Fore.YELLOW}缺少证书 ({len(missing_certs)}项):{Style.RESET_ALL}")
        for r in missing_certs:
            click.echo(f"  - {r.get_edition_key()} (购买人: {r.buyer}, 记录ID: {r.record_id})")
    else:
        click.echo(f"{Fore.GREEN}✓ 所有已售作品都有证书{Style.RESET_ALL}")

    if return_conflicts or missing_certs:
        sys.exit(1)


def main() -> None:
    cli(obj={})


if __name__ == "__main__":
    main()
