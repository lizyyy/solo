import json
import os
from datetime import datetime
from typing import List, Optional, Tuple
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .storage import Storage
from .models import (
    Personnel,
    Certificate,
    RetrainingPlan,
    CertificateStatus,
    RetrainingStatus,
    RecordAction,
)
from .sample_data import get_sample_personnel, get_sample_certificates, get_sample_retraining

app = typer.Typer(
    name="first-aid",
    help="企业急救培训证书到期管理 CLI 工具",
    add_completion=False,
)
console = Console()
storage = Storage()


@app.command()
def init(
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="强制覆盖已有的数据",
    ),
):
    """
    初始化样例数据
    """
    if storage.is_initialized() and not force:
        rprint(Panel(
            "[yellow]数据已存在，使用 --force 参数强制覆盖[/yellow]",
            title="警告",
        ))
        raise typer.Exit(code=1)

    rprint(Panel(
        "[cyan]正在初始化样例数据...[/cyan]",
        title="初始化",
    ))

    storage.data_dir.mkdir(parents=True, exist_ok=True)

    personnel_data = get_sample_personnel()
    personnel_ids = []
    for item in personnel_data:
        p = Personnel.create(
            name=item["name"],
            employee_id=item["employee_id"],
            department=item["department"],
            phone=item["phone"],
            email=item["email"],
        )
        storage.save_personnel(p, record_history=False)
        personnel_ids.append(p.id)

    certificates_data = get_sample_certificates(personnel_ids)
    certificate_ids = []
    for item in certificates_data:
        c = Certificate.create(**item)
        storage.save_certificate(c, record_history=False)
        certificate_ids.append(c.id)

    retraining_data = get_sample_retraining(personnel_ids[:4], certificate_ids)
    for item in retraining_data:
        r = RetrainingPlan.create(**item)
        storage.save_retraining(r, record_history=False)

    from first_aid_cert.models import HistoryRecord

    history_list = storage._read_json(storage.history_file)
    record = HistoryRecord.create(
        entity_type="system",
        entity_id="init",
        action=RecordAction.CREATE.value,
        description="初始化样例数据",
    )
    history_list.append(record.to_dict())
    storage._write_json(storage.history_file, history_list)

    rprint(Panel(
        "[green]✓ 样例数据初始化完成！[/green]\n"
        f"[blue]- 人员档案: {len(personnel_ids)} 人[/blue]\n"
        f"[blue]- 证书记录: {len(certificate_ids)} 张[/blue]\n"
        f"[blue]- 复训计划: {len(retraining_data)} 项[/blue]",
        title="完成",
    ))


@app.command()
def import_data(
    file_path: str = typer.Argument(..., help="JSON 文件路径"),
    data_type: str = typer.Argument(..., help="数据类型: personnel, certificates, retraining"),
):
    """
    从 JSON 文件导入数据
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        rprint(Panel(
            f"[red]文件不存在: {file_path}[/red]",
            title="错误",
        ))
        raise typer.Exit(code=1)
    except json.JSONDecodeError:
        rprint(Panel(
            "[red]JSON 文件格式错误[/red]",
            title="错误",
        ))
        raise typer.Exit(code=1)

    if not isinstance(data, list):
        rprint(Panel(
            "[red]JSON 数据必须是数组格式[/red]",
            title="错误",
        ))
        raise typer.Exit(code=1)

    data_type = data_type.lower()

    if data_type == "personnel":
        success, failed = storage.import_personnel(data)
    elif data_type in ["certificates", "certificate"]:
        success, failed = storage.import_certificates(data)
    elif data_type in ["retraining", "retrainings"]:
        success, failed = storage.import_retraining(data)
    else:
        rprint(Panel(
            f"[red]不支持的数据类型: {data_type}[/red]\n"
            "[yellow]可选值: personnel, certificates, retraining[/yellow]",
            title="错误",
        ))
        raise typer.Exit(code=1)

    rprint(Panel(
        f"[green]✓ 导入完成[/green]\n"
        f"[blue]- 成功: {success} 条[/blue]\n"
        f"[red]- 失败: {failed} 条[/red]",
        title=f"导入 {data_type}",
    ))


@app.command()
def check(
    entity_type: Optional[str] = typer.Option(
        None,
        "--type",
        "-t",
        help="检查类型: certificates, retraining, all",
    ),
    output: Optional[str] = typer.Option(
        None,
        "--output",
        "-o",
        help="输出文件路径",
    ),
):
    """
    执行到期检查，发现即将过期或已过期的证书和复训计划
    """
    check_type = entity_type or "all"

    today = datetime.now().date()
    results = {
        "expired_certificates": [],
        "expiring_certificates": [],
        "overdue_retraining": [],
        "pending_retraining": [],
        "eligible_for_scheduling": [],
    }

    for c in storage.list_certificates():
        status = c.get_status(today)
        expiry_date = datetime.strptime(c.expiry_date, "%Y-%m-%d").date()
        days_remaining = (expiry_date - today).days

        has_active_retraining = False
        for r in storage.get_retraining_by_certificate(c.id):
            if r.status == RetrainingStatus.PENDING.value and not r.completed_date:
                has_active_retraining = True
                break

        cert_info = {
            "id": c.id,
            "personnel_id": c.personnel_id,
            "personnel_name": c.personnel_name,
            "certificate_type": c.certificate_type,
            "certificate_number": c.certificate_number,
            "expiry_date": c.expiry_date,
            "days_remaining": days_remaining,
            "status": status.value,
            "has_active_retraining": has_active_retraining,
        }

        if status == CertificateStatus.EXPIRED:
            results["expired_certificates"].append(cert_info)
        elif status == CertificateStatus.EXPIRING_SOON:
            results["expiring_certificates"].append(cert_info)

    for r in storage.list_retraining():
        status = r.get_status(today)
        planned_date = datetime.strptime(r.planned_date, "%Y-%m-%d").date()
        days_until_planned = (planned_date - today).days

        retraining_info = {
            "id": r.id,
            "certificate_id": r.certificate_id,
            "personnel_name": r.personnel_name,
            "planned_date": r.planned_date,
            "completed_date": r.completed_date,
            "days_until_planned": days_until_planned,
            "status": status.value,
            "trainer": r.trainer,
            "notes": r.notes,
        }

        if status == RetrainingStatus.OVERDUE:
            results["overdue_retraining"].append(retraining_info)
        elif status == RetrainingStatus.PENDING and days_until_planned <= 30:
            results["pending_retraining"].append(retraining_info)

    for cert_info in results["expired_certificates"] + results["expiring_certificates"]:
        if not cert_info.get("has_active_retraining"):
            results["eligible_for_scheduling"].append(cert_info)

    _display_check_results(results, check_type)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            json.dump({
                "check_date": today.isoformat(),
                "results": results,
            }, f, ensure_ascii=False, indent=2)
        rprint(f"\n[green]✓ 结果已导出到: {output}[/green]")

    total_issues = len(results["expired_certificates"]) + len(results["overdue_retraining"])
    if total_issues > 0:
        raise typer.Exit(code=2)


def _display_check_results(results: dict, check_type: str):
    """显示检查结果"""
    console.rule("[bold cyan]到期检查结果[/bold cyan]")

    if check_type in ["all", "certificates"]:
        if results["expired_certificates"]:
            table = Table(title="[bold red]已过期的证书[/bold red]", show_lines=True)
            table.add_column("ID", style="cyan")
            table.add_column("姓名", style="green")
            table.add_column("证书类型", style="blue")
            table.add_column("证书编号", style="yellow")
            table.add_column("过期日期", style="red")
            table.add_column("剩余天数", style="red")

            for item in results["expired_certificates"]:
                table.add_row(
                    item["id"],
                    item["personnel_name"],
                    item["certificate_type"],
                    item["certificate_number"],
                    item["expiry_date"],
                    f"{item['days_remaining']}天",
                )
            console.print(table)

        if results["expiring_certificates"]:
            table = Table(title="[bold yellow]即将过期的证书 (30天内)[/bold yellow]", show_lines=True)
            table.add_column("ID", style="cyan")
            table.add_column("姓名", style="green")
            table.add_column("证书类型", style="blue")
            table.add_column("证书编号", style="yellow")
            table.add_column("过期日期", style="yellow")
            table.add_column("剩余天数", style="yellow")

            for item in results["expiring_certificates"]:
                table.add_row(
                    item["id"],
                    item["personnel_name"],
                    item["certificate_type"],
                    item["certificate_number"],
                    item["expiry_date"],
                    f"{item['days_remaining']}天",
                )
            console.print(table)

        if not results["expired_certificates"] and not results["expiring_certificates"]:
            rprint("[green]✓ 所有证书状态正常[/green]")

    if check_type in ["all", "retraining"]:
        if results["overdue_retraining"]:
            table = Table(title="[bold red]已逾期的复训计划[/bold red]", show_lines=True)
            table.add_column("ID", style="cyan")
            table.add_column("姓名", style="green")
            table.add_column("计划日期", style="red")
            table.add_column("讲师", style="blue")
            table.add_column("状态", style="red")

            for item in results["overdue_retraining"]:
                table.add_row(
                    item["id"],
                    item["personnel_name"],
                    item["planned_date"],
                    item["trainer"] or "-",
                    "已逾期",
                )
            console.print(table)

        if results["pending_retraining"]:
            table = Table(title="[bold yellow]即将开始的复训 (30天内)[/bold yellow]", show_lines=True)
            table.add_column("ID", style="cyan")
            table.add_column("姓名", style="green")
            table.add_column("计划日期", style="yellow")
            table.add_column("讲师", style="blue")
            table.add_column("备注", style="white")

            for item in results["pending_retraining"]:
                table.add_row(
                    item["id"],
                    item["personnel_name"],
                    item["planned_date"],
                    item["trainer"] or "-",
                    item["notes"] or "-",
                )
            console.print(table)

        if not results["overdue_retraining"] and not results["pending_retraining"]:
            rprint("[green]✓ 所有复训计划状态正常[/green]")

    if results["eligible_for_scheduling"]:
        table = Table(
            title="[bold magenta]需要安排复训的人员[/bold magenta]",
            show_lines=True,
            caption="这些人员的证书即将过期或已过期，但没有活跃的复训计划",
        )
        table.add_column("姓名", style="green")
        table.add_column("证书类型", style="blue")
        table.add_column("证书编号", style="yellow")
        table.add_column("状态", style="red")
        table.add_column("剩余天数", style="cyan")

        for item in results["eligible_for_scheduling"]:
            table.add_row(
                item["personnel_name"],
                item["certificate_type"],
                item["certificate_number"],
                item["status"],
                f"{item['days_remaining']}天",
            )
        console.print(table)

    console.rule()


@app.command()
def history(
    entity_type: Optional[str] = typer.Option(
        None,
        "--type",
        "-t",
        help="实体类型: personnel, certificate, retraining",
    ),
    action: Optional[str] = typer.Option(
        None,
        "--action",
        "-a",
        help="操作类型: create, update, delete, import",
    ),
    limit: int = typer.Option(
        50,
        "--limit",
        "-n",
        help="显示记录数量",
    ),
    show_diff: bool = typer.Option(
        False,
        "--diff",
        "-d",
        help="显示详细变化差异",
    ),
):
    """
    查看历史操作记录
    """
    records = storage.list_history(entity_type=entity_type, action=action)[:limit]

    if not records:
        rprint(Panel(
            "[yellow]暂无历史记录[/yellow]",
            title="历史记录",
        ))
        return

    table = Table(title="历史操作记录", show_lines=True)
    table.add_column("时间", style="cyan", no_wrap=True)
    table.add_column("类型", style="blue")
    table.add_column("操作", style="magenta")
    table.add_column("描述", style="green")

    for record in records:
        dt = datetime.fromisoformat(record.timestamp)
        table.add_row(
            dt.strftime("%Y-%m-%d %H:%M:%S"),
            record.entity_type,
            record.action,
            record.description,
        )

    console.print(table)

    if show_diff:
        for record in records[:10]:
            if record.before or record.after:
                console.print(Panel(f"[bold]{record.description}[/bold]", title="操作详情"))
                if record.before:
                    console.print("[red]修改前:[/red]")
                    console.print_json(json.dumps(record.before, ensure_ascii=False, indent=2))
                if record.after:
                    console.print("[green]修改后:[/green]")
                    console.print_json(json.dumps(record.after, ensure_ascii=False, indent=2))


@app.command()
def export(
    output_path: str = typer.Argument(..., help="导出文件路径"),
    format_type: str = typer.Option(
        "json",
        "--format",
        "-f",
        help="导出格式: json",
    ),
):
    """
    导出所有数据
    """
    data = storage.get_all_data()

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    rprint(Panel(
        f"[green]✓ 数据已导出到: {output_path}[/green]\n"
        f"[blue]- 人员: {len(data['personnel'])} 人[/blue]\n"
        f"[blue]- 证书: {len(data['certificates'])} 张[/blue]\n"
        f"[blue]- 复训计划: {len(data['retraining'])} 项[/blue]",
        title="导出完成",
    ))


@app.command(name="list")
def list_cmd(
    entity_type: str = typer.Argument(..., help="实体类型: personnel, certificates, retraining"),
):
    """
    列出数据
    """
    entity_type = entity_type.lower()

    if entity_type == "personnel":
        personnel_list = storage.list_personnel()
        if not personnel_list:
            rprint(Panel("[yellow]暂无人员数据[/yellow]", title="人员列表"))
            return

        table = Table(title="人员档案", show_lines=True)
        table.add_column("ID", style="cyan")
        table.add_column("姓名", style="green")
        table.add_column("工号", style="yellow")
        table.add_column("部门", style="blue")
        table.add_column("电话", style="magenta")

        for p in personnel_list:
            table.add_row(p.id, p.name, p.employee_id, p.department, p.phone)

        console.print(table)

    elif entity_type in ["certificates", "certificate"]:
        certs = storage.list_certificates()
        if not certs:
            rprint(Panel("[yellow]暂无证书数据[/yellow]", title="证书列表"))
            return

        table = Table(title="证书记录", show_lines=True)
        table.add_column("ID", style="cyan")
        table.add_column("姓名", style="green")
        table.add_column("类型", style="blue")
        table.add_column("编号", style="yellow")
        table.add_column("有效期至", style="magenta")
        table.add_column("状态", style="white")

        for c in certs:
            status = c.get_status()
            status_style = "green" if status == CertificateStatus.VALID else "yellow" if status == CertificateStatus.EXPIRING_SOON else "red"
            table.add_row(
                c.id,
                c.personnel_name,
                c.certificate_type,
                c.certificate_number,
                c.expiry_date,
                f"[{status_style}]{status.value}[/{status_style}]",
            )

        console.print(table)

    elif entity_type in ["retraining", "retrainings"]:
        retrainings = storage.list_retraining()
        if not retrainings:
            rprint(Panel("[yellow]暂无复训计划[/yellow]", title="复训计划列表"))
            return

        table = Table(title="复训计划", show_lines=True)
        table.add_column("ID", style="cyan")
        table.add_column("姓名", style="green")
        table.add_column("计划日期", style="blue")
        table.add_column("完成日期", style="yellow")
        table.add_column("讲师", style="magenta")
        table.add_column("状态", style="white")

        for r in retrainings:
            status = r.get_status()
            status_style = "green" if status == RetrainingStatus.COMPLETED else "yellow" if status == RetrainingStatus.PENDING else "red"
            table.add_row(
                r.id,
                r.personnel_name,
                r.planned_date,
                r.completed_date or "-",
                r.trainer or "-",
                f"[{status_style}]{status.value}[/{status_style}]",
            )

        console.print(table)

    else:
        rprint(Panel(
            f"[red]不支持的实体类型: {entity_type}[/red]",
            title="错误",
        ))
        raise typer.Exit(code=1)


@app.command()
def update_certificate(
    cert_id: str = typer.Argument(..., help="证书 ID"),
    expiry_date: Optional[str] = typer.Option(
        None,
        "--expiry-date",
        "-e",
        help="新的过期日期 (YYYY-MM-DD)",
    ),
    certificate_number: Optional[str] = typer.Option(
        None,
        "--number",
        "-n",
        help="新的证书编号",
    ),
):
    """
    更新证书信息（用于补录或修改）
    """
    cert = storage.get_certificate(cert_id)
    if not cert:
        rprint(Panel(f"[red]证书不存在: {cert_id}[/red]", title="错误"))
        raise typer.Exit(code=1)

    before = cert.to_dict()

    if expiry_date:
        cert.expiry_date = expiry_date
    if certificate_number:
        cert.certificate_number = certificate_number

    cert.update_status()
    storage.save_certificate(cert)

    rprint(Panel(
        f"[green]✓ 证书已更新[/green]\n"
        f"[blue]- ID: {cert.id}[/blue]\n"
        f"[blue]- 姓名: {cert.personnel_name}[/blue]\n"
        f"[blue]- 类型: {cert.certificate_type}[/blue]",
        title="更新完成",
    ))


def main():
    app()


if __name__ == "__main__":
    main()
