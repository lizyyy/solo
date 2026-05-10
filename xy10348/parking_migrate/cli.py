import click
from pathlib import Path
from datetime import date, timedelta
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .db import Database
from .core import ParkingService
from .importer import DataImporter, DataExporter

console = Console()

def get_db(db_path: str = None) -> Database:
    return Database(Path(db_path) if db_path else None)

def get_service(db_path: str = None) -> ParkingService:
    return ParkingService(get_db(db_path))


@click.group()
@click.option("--db", "db_path", help="数据库文件路径（默认 ~/.parking_migrate.db）")
@click.pass_context
def cli(ctx: click.Context, db_path: str):
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db_path


@cli.command()
@click.pass_context
def init(ctx: click.Context):
    db = get_db(ctx.obj.get("db_path"))
    db.connect()
    db.close()
    console.print("[green]数据库初始化完成[/green]")


@cli.group()
def import_data():
    pass


@import_data.command("cards")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--operator", default="import", help="操作人")
@click.pass_context
def import_cards(ctx: click.Context, file_path: str, operator: str):
    db = get_db(ctx.obj.get("db_path"))
    service = ParkingService(db)
    importer = DataImporter(db, service)
    result = importer.import_cards(Path(file_path), operator=operator)
    _print_import_result("月卡档案", result)


@import_data.command("payments")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--operator", default="import", help="操作人")
@click.pass_context
def import_payments(ctx: click.Context, file_path: str, operator: str):
    db = get_db(ctx.obj.get("db_path"))
    service = ParkingService(db)
    importer = DataImporter(db, service)
    result = importer.import_payments(Path(file_path), operator=operator)
    _print_import_result("续费记录", result)


@import_data.command("plates")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--operator", default="import", help="操作人")
@click.pass_context
def import_plates(ctx: click.Context, file_path: str, operator: str):
    db = get_db(ctx.obj.get("db_path"))
    service = ParkingService(db)
    importer = DataImporter(db, service)
    result = importer.import_plate_changes(Path(file_path), operator=operator)
    _print_import_result("车牌变更", result)


@import_data.command("spaces")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--operator", default="import", help="操作人")
@click.option("--force", is_flag=True, help="强制调整冲突车位")
@click.pass_context
def import_spaces(ctx: click.Context, file_path: str, operator: str, force: bool):
    db = get_db(ctx.obj.get("db_path"))
    service = ParkingService(db)
    importer = DataImporter(db, service)
    result = importer.import_space_changes(Path(file_path), operator=operator, force=force)
    _print_import_result("车位变更", result)


def _print_import_result(name: str, result: dict):
    console.print(Panel(f"[bold]{name}导入结果[/bold]"))
    console.print(f"总计: {result['total']} 条")
    console.print(f"成功: [green]{result['success']}[/green] 条")
    console.print(f"失败: [red]{result['failed']}[/red] 条")
    
    need_review = [d for d in result['details'] if d.get('需复核')]
    if need_review:
        console.print(f"[yellow]需人工复核: {len(need_review)} 条[/yellow]")
        table = Table(title="需复核记录")
        table.add_column("行")
        table.add_column("月卡号")
        table.add_column("消息")
        for d in need_review:
            table.add_row(str(d["行"]), d.get("月卡号", ""), d["消息"])
        console.print(table)
    
    failures = [d for d in result['details'] if not d['成功']]
    if failures:
        table = Table(title="失败记录")
        table.add_column("行")
        table.add_column("月卡号")
        table.add_column("错误")
        for d in failures:
            table.add_row(str(d["行"]), d.get("月卡号", ""), d["消息"])
        console.print(table)


@cli.command("renew")
@click.argument("card_no")
@click.option("--payment-no", required=True, help="支付流水号")
@click.option("--payment-date", required=True, help="支付日期 (YYYY-MM-DD)")
@click.option("--amount", type=float, required=True, help="金额")
@click.option("--days", "duration_days", type=int, default=30, help="续费天数")
@click.option("--start-date", help="起始日期（默认从当前有效期结束次日开始）")
@click.option("--operator", default="manual", help="操作人")
@click.pass_context
def renew(
    ctx: click.Context,
    card_no: str,
    payment_no: str,
    payment_date: str,
    amount: float,
    duration_days: int,
    start_date: str,
    operator: str
):
    service = get_service(ctx.obj.get("db_path"))
    if not start_date:
        start_date = payment_date
    result = service.process_payment(
        card_no=card_no,
        payment_no=payment_no,
        payment_date=payment_date,
        amount=amount,
        duration_days=duration_days,
        start_date=start_date,
        source="manual",
        operator=operator
    )
    _print_result(result)


@cli.command("change-plate")
@click.argument("card_no")
@click.argument("new_plate")
@click.option("--reason", required=True, help="变更原因")
@click.option("--effective-date", help="生效日期")
@click.option("--operator", default="manual", help="操作人")
@click.pass_context
def change_plate(
    ctx: click.Context,
    card_no: str,
    new_plate: str,
    reason: str,
    effective_date: str,
    operator: str
):
    service = get_service(ctx.obj.get("db_path"))
    result = service.change_plate(
        card_no=card_no,
        new_plate=new_plate,
        reason=reason,
        effective_date=effective_date,
        source="manual",
        operator=operator
    )
    _print_result(result)


@cli.command("change-space")
@click.argument("card_no")
@click.argument("new_space")
@click.option("--reason", required=True, help="变更原因")
@click.option("--effective-date", help="生效日期")
@click.option("--operator", default="manual", help="操作人")
@click.option("--force", is_flag=True, help="强制调整（会释放原车主车位）")
@click.pass_context
def change_space(
    ctx: click.Context,
    card_no: str,
    new_space: str,
    reason: str,
    effective_date: str,
    operator: str,
    force: bool
):
    service = get_service(ctx.obj.get("db_path"))
    result = service.change_space(
        card_no=card_no,
        new_space=new_space,
        reason=reason,
        effective_date=effective_date,
        source="manual",
        operator=operator,
        force=force
    )
    _print_result(result)


def _print_result(result):
    if result.success:
        console.print(f"[green]{result.message}[/green]")
    else:
        console.print(f"[red]{result.message}[/red]")
    if result.requires_review:
        console.print("[yellow]⚠️  此操作需要人工复核[/yellow]")
    if result.details:
        for k, v in result.details.items():
            console.print(f"  {k}: {v}")


@cli.command("status")
@click.argument("card_no", required=False)
@click.pass_context
def status(ctx: click.Context, card_no: str):
    service = get_service(ctx.obj.get("db_path"))
    
    if card_no:
        s = service.get_card_status(card_no)
        if not s:
            console.print(f"[red]月卡 {card_no} 不存在[/red]")
            return
        
        table = Table(title=f"月卡状态: {card_no}")
        table.add_column("项目")
        table.add_column("值")
        table.add_row("车主", s.owner_name)
        table.add_row("车牌", s.plate_number)
        table.add_row("车位", s.space_no)
        table.add_row("有效期起", s.valid_start.strftime("%Y-%m-%d") if s.valid_start else "-")
        table.add_row("有效期止", s.valid_end.strftime("%Y-%m-%d") if s.valid_end else "-")
        table.add_row("剩余天数", f"[green]{s.remaining_days}[/green]" if s.remaining_days > 0 else "[red]0 (已过期)[/red]")
        table.add_row("累计缴费", f"¥{s.total_paid:.2f}")
        status_str = "[green]正常[/green]"
        if s.is_expired:
            status_str = "[red]已过期[/red]"
        elif s.remaining_days <= 7:
            status_str = "[yellow]即将过期[/yellow]"
        table.add_row("状态", status_str)
        console.print(table)
    else:
        statuses = service.get_all_cards_status()
        table = Table(title="所有月卡状态")
        table.add_column("月卡号")
        table.add_column("车主")
        table.add_column("车牌")
        table.add_column("车位")
        table.add_column("有效期止")
        table.add_column("剩余天数")
        table.add_column("状态")
        
        for s in statuses:
            status_str = "正常"
            style = ""
            if s.is_expired:
                status_str = "已过期"
                style = "[red]"
            elif s.remaining_days <= 7:
                status_str = "即将过期"
                style = "[yellow]"
            
            table.add_row(
                s.card_no,
                s.owner_name,
                s.plate_number,
                s.space_no,
                s.valid_end.strftime("%Y-%m-%d") if s.valid_end else "-",
                f"{style}{s.remaining_days}" if style else str(s.remaining_days),
                f"{style}{status_str}" if style else status_str
            )
        
        console.print(table)


@cli.command("history")
@click.argument("card_no", required=False)
@click.option("--limit", type=int, default=50, help="显示条数")
@click.pass_context
def history(ctx: click.Context, card_no: str, limit: int):
    db = get_db(ctx.obj.get("db_path"))
    service = ParkingService(db)
    
    card_id = None
    if card_no:
        card = db.get_card_by_no(card_no)
        if not card:
            console.print(f"[red]月卡 {card_no} 不存在[/red]")
            return
        card_id = card["id"]
    
    records = db.get_history(card_id=card_id, limit=limit)
    
    if not records:
        console.print("[yellow]暂无历史记录[/yellow]")
        return
    
    title = f"月卡 {card_no} 历史记录" if card_no else "系统历史记录"
    table = Table(title=title)
    table.add_column("时间")
    table.add_column("月卡号")
    table.add_column("操作类型")
    table.add_column("操作描述")
    table.add_column("操作人")
    table.add_column("来源")
    table.add_column("需复核")
    
    for h in records:
        card_no_val = ""
        if h["card_id"]:
            card = db.query_one(
                "SELECT card_no FROM monthly_cards WHERE id = ?",
                (h["card_id"],)
            )
            if card:
                card_no_val = card["card_no"]
        
        review_flag = "[yellow]是[/yellow]" if h["requires_review"] else "否"
        
        table.add_row(
            h["created_at"],
            card_no_val,
            h["operation_type"],
            h["operation_desc"],
            h["operator"] or "-",
            h["source"] or "-",
            review_flag
        )
    
    console.print(table)


@cli.group()
def export():
    pass


@export.command("reconciliation")
@click.argument("file_path", type=click.Path())
@click.pass_context
def export_reconciliation(ctx: click.Context, file_path: str):
    db = get_db(ctx.obj.get("db_path"))
    service = ParkingService(db)
    exporter = DataExporter(db, service)
    count = exporter.export_reconciliation(Path(file_path))
    console.print(f"[green]已导出 {count} 条对账记录至 {file_path}[/green]")


@export.command("history")
@click.argument("file_path", type=click.Path())
@click.option("--card-no", help="指定月卡号")
@click.option("--limit", type=int, default=1000, help="导出条数")
@click.pass_context
def export_history(ctx: click.Context, file_path: str, card_no: str, limit: int):
    db = get_db(ctx.obj.get("db_path"))
    service = ParkingService(db)
    exporter = DataExporter(db, service)
    count = exporter.export_history(Path(file_path), card_no=card_no, limit=limit)
    console.print(f"[green]已导出 {count} 条历史记录至 {file_path}[/green]")


@export.command("pending-review")
@click.argument("file_path", type=click.Path())
@click.pass_context
def export_pending_review(ctx: click.Context, file_path: str):
    db = get_db(ctx.obj.get("db_path"))
    service = ParkingService(db)
    exporter = DataExporter(db, service)
    count = exporter.export_pending_review(Path(file_path))
    if count == 0:
        console.print("[green]暂无待复核记录[/green]")
    else:
        console.print(f"[green]已导出 {count} 条待复核记录至 {file_path}[/green]")


@cli.command("explain")
@click.argument("card_no", required=False)
@click.pass_context
def explain(ctx: click.Context, card_no: str):
    console.print(Panel("[bold]有效期计算规则[/bold]"))
    console.print("""
[bold]1. 基本规则:[/bold]
   - 第一次续费: 从指定的起始日期开始计算
   - 后续续费: 从上一次有效期结束的次日开始累加
   - 重叠处理: 如果新续费起始日期早于当前有效期结束日期，从结束日次日开始

[bold]2. 剩余天数计算:[/bold]
   - 剩余天数 = 有效期截止日 - 今天 + 1（截止日当天仍有效）
   - 已过期的月卡剩余天数显示为 0

[bold]3. 支付流水去重:[/bold]
   - 同一支付流水号只能导入一次
   - 重复导入不会延长有效期，但会记录到历史（需人工复核）
   - 同一流水归属不同月卡会触发冲突警告

[bold]4. 车牌/车位规则:[/bold]
   - 同一车牌只能绑定一个有效月卡
   - 换车牌后，旧车牌自动失效
   - 车位冲突默认拦截，可使用 --force 强制调整
   - 任何手动调整都要求填写原因并记录到历史

[bold]5. 历史记录字段:[/bold]
   - 操作时间: 精确到秒的 ISO 时间戳
   - 操作类型: CREATE_CARD / PAYMENT / PLATE_CHANGE / SPACE_CHANGE 等
   - 操作人: 记录是谁执行的操作
   - 来源: manual（手动）/ import（批量导入）/ batch_import（批量）
   - 原因: 手动调整时必填的变更理由
   - 需复核: 标记是否需要人工确认
""")
    
    if card_no:
        service = get_service(ctx.obj.get("db_path"))
        s = service.get_card_status(card_no)
        if s:
            console.print(Panel(f"[bold]月卡 {card_no} 详细说明[/bold]"))
            console.print(f"当前车牌: {s.plate_number}")
            console.print(f"当前车位: {s.space_no}")
            console.print(f"有效期范围: {s.valid_start} ~ {s.valid_end}")
            console.print(f"剩余天数: {s.remaining_days} 天")


@cli.command("review")
@click.pass_context
def list_pending_review(ctx: click.Context):
    db = get_db(ctx.obj.get("db_path"))
    records = db.get_pending_review()
    
    if not records:
        console.print("[green]暂无待复核记录[/green]")
        return
    
    console.print(f"[yellow]共有 {len(records)} 条记录需要人工复核[/yellow]")
    
    table = Table(title="待人工复核记录")
    table.add_column("ID")
    table.add_column("时间")
    table.add_column("月卡号")
    table.add_column("操作类型")
    table.add_column("操作描述")
    table.add_column("原因")
    table.add_column("操作人")
    
    for h in records:
        card_no_val = ""
        if h["card_id"]:
            card = db.query_one(
                "SELECT card_no FROM monthly_cards WHERE id = ?",
                (h["card_id"],)
            )
            if card:
                card_no_val = card["card_no"]
        
        table.add_row(
            str(h["id"]),
            h["created_at"],
            card_no_val,
            h["operation_type"],
            h["operation_desc"],
            h["reason"] or "-",
            h["operator"] or "-"
        )
    
    console.print(table)


def main():
    cli(obj={})


if __name__ == "__main__":
    main()
