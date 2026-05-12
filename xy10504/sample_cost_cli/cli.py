import json
import os
from datetime import datetime
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from .database import init_database, get_connection
from .core import (
    import_records, 
    check_status, 
    get_record_detail, 
    manual_correct,
    generate_report,
    RECORD_TYPES
)

console = Console()

@click.group()
def cli():
    """门店试吃样品成本 CLI - 管理生鲜门店试吃、报损和促销赠品的成本归因"""
    pass

@cli.command()
@click.option("--force", is_flag=True, help="强制覆盖已有数据库")
def init(force):
    """初始化数据库"""
    console.print("[bold blue]正在初始化数据库...[/bold blue]")
    
    result = init_database(force=force)
    
    if result["success"]:
        console.print(Panel.fit(
            f"[green]✓ 数据库初始化成功[/green]\n"
            f"状态: {result['status']}\n"
            f"历史操作: {len(result['history'])} 步",
            title="初始化完成",
            box=box.ROUNDED
        ))
    else:
        console.print(Panel.fit(
            f"[red]✗ 数据库初始化失败[/red]\n"
            f"状态: {result['status']}\n"
            f"错误: {', '.join(result['errors'])}",
            title="初始化失败",
            box=box.ROUNDED
        ))
        raise click.Abort()

@cli.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--operator", default="system", help="操作者名称")
@click.option("--format", "data_format", default="json", type=click.Choice(["json"]), help="数据格式")
def import_data(file_path, operator, data_format):
    """导入试吃/报损/赠品记录"""
    console.print(f"[bold blue]正在导入文件: {file_path}[/bold blue]")
    
    with open(file_path, "r", encoding="utf-8") as f:
        records = json.load(f)
    
    if not isinstance(records, list):
        console.print("[red]✗ 数据格式错误，应为记录列表[/red]")
        raise click.Abort()
    
    console.print(f"读取到 {len(records)} 条记录，开始导入...")
    
    result = import_records(records, file_path, operator)
    
    if result["success"]:
        table = Table(title="导入结果", box=box.ROUNDED)
        table.add_column("指标", style="cyan")
        table.add_column("数值", style="green")
        table.add_row("导入批次ID", result["import_batch_id"])
        table.add_row("总记录数", str(result["total"]))
        table.add_row("成功导入", str(result["imported"]))
        table.add_row("跳过(重复)", str(result["duplicates"]))
        table.add_row("验证失败", str(result["failed"]))
        console.print(table)
        
        if result["history"]:
            history_table = Table(title="导入历史", box=box.ROUNDED)
            history_table.add_column("时间", style="dim")
            history_table.add_column("动作", style="cyan")
            history_table.add_column("记录ID", style="magenta")
            history_table.add_column("状态", style="green")
            for item in result["history"][:10]:
                history_table.add_row(
                    item["timestamp"],
                    item["action"],
                    item.get("record_id", "-"),
                    item.get("status", item.get("reason", "-"))
                )
            if len(result["history"]) > 10:
                history_table.add_row("...", f"还有 {len(result['history']) - 10} 条", "", "")
            console.print(history_table)
        
        if result["errors"]:
            error_panel = Panel.fit(
                "\n".join([
                    f"记录 {e['record_id']}: {', '.join([v['message'] for v in e['validation_errors']])}"
                    for e in result["errors"][:5]
                ]) + (f"\n... 还有 {len(result['errors']) - 5} 条错误" if len(result["errors"]) > 5 else ""),
                title="[red]验证错误详情[/red]",
                box=box.ROUNDED
            )
            console.print(error_panel)
    else:
        console.print(f"[red]✗ 导入失败: {', '.join([str(e) for e in result['errors']])}[/red]")
        raise click.Abort()

@cli.command("check")
def check_cmd():
    """检查系统状态"""
    console.print("[bold blue]检查系统状态...[/bold blue]")
    
    status = check_status()
    
    summary_table = Table(title="系统概览", box=box.ROUNDED)
    summary_table.add_column("数据类型", style="cyan")
    summary_table.add_column("数量", style="green")
    summary_table.add_row("门店数", str(status["stores"]))
    summary_table.add_row("商品数", str(status["products"]))
    summary_table.add_row("批次库存", str(status["batches"]))
    summary_table.add_row("促销活动", str(status["promotions"]))
    summary_table.add_row("记录总数", str(status["records_total"]))
    summary_table.add_row("有效记录", f"[green]{status['records_valid']}[/green]")
    summary_table.add_row("异常记录", f"[red]{status['records_error']}[/red]")
    summary_table.add_row("未解决错误", f"[yellow]{status['unresolved_errors']}[/yellow]")
    summary_table.add_row("导入批次", str(status["import_batches"]))
    console.print(summary_table)
    
    if status["recent_activity"]:
        activity_table = Table(title="最近操作", box=box.ROUNDED)
        activity_table.add_column("时间", style="dim")
        activity_table.add_column("类型", style="cyan")
        activity_table.add_column("动作", style="magenta")
        activity_table.add_column("操作者", style="yellow")
        for activity in status["recent_activity"]:
            activity_table.add_row(
                activity["created_at"],
                activity["entity_type"],
                activity["action"],
                activity["operator"]
            )
        console.print(activity_table)

@cli.command()
@click.argument("record_id")
def detail(record_id):
    """查看记录详情"""
    console.print(f"[bold blue]查询记录详情: {record_id}[/bold blue]")
    
    record = get_record_detail(record_id)
    
    if not record:
        console.print(f"[red]✗ 记录不存在: {record_id}[/red]")
        raise click.Abort()
    
    info_table = Table(title="记录信息", box=box.ROUNDED)
    info_table.add_column("字段", style="cyan")
    info_table.add_column("值", style="white")
    info_table.add_row("记录ID", record["id"])
    info_table.add_row("门店", f"{record['store_id']} - {record['store_name']}")
    info_table.add_row("商品", record["product_name"])
    info_table.add_row("批次ID", record["batch_id"])
    info_table.add_row("类型", record["record_type"])
    info_table.add_row("数量", str(record["quantity"]))
    info_table.add_row("单位成本", f"{record['unit_cost']:.2f}")
    info_table.add_row("总成本", f"[bold green]{record['cost']:.2f}[/bold green]")
    info_table.add_row("记录日期", record["record_date"])
    info_table.add_row("关联活动", record["promotion_name"] or "无")
    info_table.add_row("原因", record["reason"] or "-")
    info_table.add_row("状态", f"[green]有效[/green]" if record["status"] == "valid" else f"[red]异常[/red]")
    info_table.add_row("操作者", record["operator"])
    info_table.add_row("创建时间", record["created_at"])
    console.print(info_table)
    
    if record["validation_errors"]:
        error_table = Table(title="验证错误", box=box.ROUNDED)
        error_table.add_column("错误类型", style="red")
        error_table.add_column("错误信息", style="white")
        for err in record["validation_errors"]:
            error_table.add_row(err["error_type"], err["error_message"])
        console.print(error_table)
    
    if record["audit_history"]:
        audit_table = Table(title="变更历史", box=box.ROUNDED)
        audit_table.add_column("时间", style="dim")
        audit_table.add_column("动作", style="cyan")
        audit_table.add_column("操作者", style="yellow")
        audit_table.add_column("原因", style="white")
        for audit in record["audit_history"]:
            audit_table.add_row(
                audit["created_at"],
                audit["action"],
                audit["operator"],
                audit["reason"] or "-"
            )
        console.print(audit_table)

@cli.command()
@click.argument("record_id")
@click.option("--quantity", type=float, help="修正数量")
@click.option("--record-type", type=click.Choice(RECORD_TYPES), help="修正记录类型")
@click.option("--promotion-id", help="修正关联活动")
@click.option("--reason", help="修正原因备注")
@click.option("--operator", required=True, help="操作者名称")
@click.option("--change-reason", required=True, help="变更原因说明")
def correct(record_id, quantity, record_type, promotion_id, reason, operator, change_reason):
    """人工修正记录"""
    console.print(f"[bold blue]人工修正记录: {record_id}[/bold blue]")
    
    updates = {}
    if quantity is not None:
        updates["quantity"] = quantity
    if record_type is not None:
        updates["record_type"] = record_type
    if promotion_id is not None:
        updates["promotion_id"] = promotion_id
    if reason is not None:
        updates["reason"] = reason
    
    if not updates:
        console.print("[yellow]⚠ 没有指定任何修正字段[/yellow]")
        raise click.Abort()
    
    result = manual_correct(record_id, updates, operator, change_reason)
    
    if result["success"]:
        console.print(Panel.fit(
            f"[green]✓ 修正成功[/green]\n"
            f"记录ID: {record_id}\n"
            f"操作者: {operator}\n"
            f"变更原因: {change_reason}",
            title="修正完成",
            box=box.ROUNDED
        ))
        
        if result["diff"]:
            diff_table = Table(title="前后差异", box=box.ROUNDED)
            diff_table.add_column("字段", style="cyan")
            diff_table.add_column("变更前", style="red")
            diff_table.add_column("变更后", style="green")
            for field, diff in result["diff"].items():
                diff_table.add_row(field, str(diff["before"]), str(diff["after"]))
            console.print(diff_table)
    else:
        console.print(f"[red]✗ 修正失败: {', '.join(result['errors'])}[/red]")
        raise click.Abort()

@cli.command()
@click.option("--store-id", help="按门店过滤")
@click.option("--promotion-id", help="按活动过滤")
@click.option("--start-date", help="开始日期 (YYYY-MM-DD)")
@click.option("--end-date", help="结束日期 (YYYY-MM-DD)")
@click.option("--output", type=click.Path(), help="输出JSON文件路径")
@click.option("--show-details", is_flag=True, help="显示明细数据")
def report(store_id, promotion_id, start_date, end_date, output, show_details):
    """生成成本报表"""
    console.print("[bold blue]生成成本报表...[/bold blue]")
    
    filters = []
    if store_id:
        filters.append(f"门店: {store_id}")
    if promotion_id:
        filters.append(f"活动: {promotion_id}")
    if start_date:
        filters.append(f"开始: {start_date}")
    if end_date:
        filters.append(f"结束: {end_date}")
    
    if filters:
        console.print(f"过滤条件: {', '.join(filters)}")
    
    result = generate_report(store_id, promotion_id, start_date, end_date)
    
    summary = result["summary"]
    
    overview_table = Table(title="报表汇总", box=box.ROUNDED)
    overview_table.add_column("指标", style="cyan")
    overview_table.add_column("数值", style="green")
    overview_table.add_row("总记录数", str(summary["total_records"]))
    overview_table.add_row("有效记录", f"[green]{summary['valid_records']}[/green]")
    overview_table.add_row("异常记录", f"[red]{summary['error_records']}[/red]")
    overview_table.add_row("总成本", f"[bold green]¥{summary['total_cost']:.2f}[/bold green]")
    console.print(overview_table)
    
    if summary["by_type"]:
        type_table = Table(title="按类型统计", box=box.ROUNDED)
        type_table.add_column("类型", style="cyan")
        type_table.add_column("记录数", style="magenta")
        type_table.add_column("成本", style="green")
        type_map = {"sample": "试吃", "promotion_gift": "促销赠品", "loss": "报损"}
        for record_type, data in summary["by_type"].items():
            type_table.add_row(
                type_map.get(record_type, record_type),
                str(data["count"]),
                f"¥{data['cost']:.2f}"
            )
        console.print(type_table)
    
    if summary["by_store"]:
        store_table = Table(title="按门店统计", box=box.ROUNDED)
        store_table.add_column("门店ID", style="cyan")
        store_table.add_column("门店名称", style="magenta")
        store_table.add_column("记录数", style="yellow")
        store_table.add_column("成本", style="green")
        for store_id_val, data in summary["by_store"].items():
            store_table.add_row(
                store_id_val,
                data["name"],
                str(data["count"]),
                f"¥{data['cost']:.2f}"
            )
        console.print(store_table)
    
    if summary["by_promotion"]:
        promo_table = Table(title="按活动统计", box=box.ROUNDED)
        promo_table.add_column("活动ID", style="cyan")
        promo_table.add_column("活动名称", style="magenta")
        promo_table.add_column("记录数", style="yellow")
        promo_table.add_column("成本", style="green")
        for promo_id, data in summary["by_promotion"].items():
            promo_table.add_row(
                promo_id,
                data["name"],
                str(data["count"]),
                f"¥{data['cost']:.2f}"
            )
        console.print(promo_table)
    
    if summary["by_batch"]:
        batch_table = Table(title="按批次统计", box=box.ROUNDED)
        batch_table.add_column("批次ID", style="cyan")
        batch_table.add_column("商品", style="magenta")
        batch_table.add_column("分类", style="yellow")
        batch_table.add_column("使用量", style="blue")
        batch_table.add_column("成本", style="green")
        for batch in summary["by_batch"]:
            batch_table.add_row(
                batch["batch_id"],
                batch["product_name"],
                batch["category"],
                str(batch["used_quantity"]),
                f"¥{batch['cost']:.2f}"
            )
        console.print(batch_table)
    
    if result["errors"]:
        error_table = Table(title="异常登记明细", box=box.ROUNDED)
        error_table.add_column("错误ID", style="red")
        error_table.add_column("记录ID", style="cyan")
        error_table.add_column("错误类型", style="yellow")
        error_table.add_column("错误信息", style="white")
        for err in result["errors"]:
            error_table.add_row(
                str(err["id"]),
                err["sample_record_id"],
                err["error_type"],
                err["error_message"]
            )
        console.print(error_table)
    
    if show_details and result["details"]:
        detail_table = Table(title="记录明细", box=box.ROUNDED)
        detail_table.add_column("记录ID", style="cyan")
        detail_table.add_column("门店", style="magenta")
        detail_table.add_column("商品", style="yellow")
        detail_table.add_column("类型", style="blue")
        detail_table.add_column("数量", style="white")
        detail_table.add_column("成本", style="green")
        detail_table.add_column("状态", style="bold")
        for d in result["details"][:20]:
            status_style = "green" if d["status"] == "valid" else "red"
            detail_table.add_row(
                d["id"],
                d["store_name"],
                d["product_name"],
                type_map.get(d["record_type"], d["record_type"]),
                str(d["quantity"]),
                f"¥{float(d['cost']):.2f}",
                f"[{status_style}]{d['status']}[/{status_style}]"
            )
        if len(result["details"]) > 20:
            detail_table.add_row("...", f"共 {len(result['details'])} 条", "", "", "", "", "")
        console.print(detail_table)
    
    if output:
        with open(output, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        console.print(f"[green]✓ 报表已导出到: {output}[/green]")

def load_master_data():
    """加载内置样例的主数据"""
    samples_dir = os.path.join(os.path.dirname(__file__), "samples")
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        with open(os.path.join(samples_dir, "stores.json"), "r", encoding="utf-8") as f:
            stores = json.load(f)
        for store in stores:
            cursor.execute("""
                INSERT OR IGNORE INTO stores (id, name, location)
                VALUES (?, ?, ?)
            """, (store["id"], store["name"], store.get("location")))
        
        with open(os.path.join(samples_dir, "products.json"), "r", encoding="utf-8") as f:
            products = json.load(f)
        for product in products:
            cursor.execute("""
                INSERT OR IGNORE INTO products (id, name, category, unit)
                VALUES (?, ?, ?, ?)
            """, (product["id"], product["name"], product["category"], product["unit"]))
        
        with open(os.path.join(samples_dir, "batches.json"), "r", encoding="utf-8") as f:
            batches = json.load(f)
        for batch in batches:
            cursor.execute("""
                INSERT OR IGNORE INTO batches 
                (id, product_id, store_id, quantity, unit_cost, production_date, expiry_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                batch["id"], batch["product_id"], batch["store_id"],
                batch["quantity"], batch["unit_cost"],
                batch.get("production_date"), batch.get("expiry_date")
            ))
        
        with open(os.path.join(samples_dir, "promotions.json"), "r", encoding="utf-8") as f:
            promotions = json.load(f)
        for promo in promotions:
            cursor.execute("""
                INSERT OR IGNORE INTO promotions 
                (id, name, store_id, start_date, end_date, status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                promo["id"], promo["name"], promo["store_id"],
                promo["start_date"], promo["end_date"], promo.get("status", "active")
            ))
        
        conn.commit()
        return len(stores), len(products), len(batches), len(promotions)
    finally:
        conn.close()

@cli.command("seed")
@click.option("--clean", is_flag=True, help="先清空再导入")
def seed_data(clean):
    """导入内置样例数据"""
    console.print("[bold blue]导入内置样例数据...[/bold blue]")
    
    if clean:
        if os.path.exists("sample_cost.db"):
            os.remove("sample_cost.db")
        init_database()
    
    store_count, product_count, batch_count, promo_count = load_master_data()
    
    console.print(Panel.fit(
        f"[green]✓ 主数据导入完成[/green]\n"
        f"门店: {store_count} 个\n"
        f"商品: {product_count} 个\n"
        f"批次: {batch_count} 个\n"
        f"活动: {promo_count} 个",
        title="样例数据",
        box=box.ROUNDED
    ))
    
    samples_dir = os.path.join(os.path.dirname(__file__), "samples")
    for sample_file in ["normal_records.json", "error_records.json"]:
        file_path = os.path.join(samples_dir, sample_file)
        with open(file_path, "r", encoding="utf-8") as f:
            records = json.load(f)
        result = import_records(records, sample_file, "demo_user")
        console.print(f"导入 {sample_file}: {result['imported']} 成功, {result['failed']} 失败, {result['duplicates']} 重复")

if __name__ == "__main__":
    cli()
