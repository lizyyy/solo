import click
import sys
from tabulate import tabulate

from core.database import init_database, is_initialized, get_db_path, get_connection
from core.importer import import_csv, IMPORT_CONFIGS
from core.engine import (
    process_pending_requests, confirm_requests, get_history, get_batches,
    DECISION_APPROVE, DECISION_REJECT, DECISION_MANUAL
)
from core.exporter import (
    export_process_results, export_history, get_pending_requests, 
    get_processed_requests, get_batches_for_export
)

@click.group()
def cli():
    """电商直播赠品补发 CLI 工具"""
    pass

@cli.command()
def init():
    """初始化数据库和系统"""
    if is_initialized():
        click.echo(f"数据库已存在: {get_db_path()}")
        if not click.confirm("是否重新初始化？（会清空所有数据）"):
            click.echo("已取消")
            return
        import os
        os.remove(get_db_path())
    
    init_database()
    click.echo(f"✅ 初始化完成，数据库位于: {get_db_path()}")

@cli.group(name="import")
def import_cmd():
    """导入数据"""
    pass

@import_cmd.command("sessions")
@click.argument("file_path")
@click.option("--skip-duplicates/--no-skip-duplicates", default=True, help="跳过重复数据")
def import_sessions(file_path, skip_duplicates):
    """导入直播场次数据"""
    result = import_csv("sessions", file_path, skip_duplicates)
    _print_import_result(result)

@import_cmd.command("products")
@click.argument("file_path")
@click.option("--skip-duplicates/--no-skip-duplicates", default=True, help="跳过重复数据")
def import_products(file_path, skip_duplicates):
    """导入商品数据"""
    result = import_csv("products", file_path, skip_duplicates)
    _print_import_result(result)

@import_cmd.command("rules")
@click.argument("file_path")
@click.option("--skip-duplicates/--no-skip-duplicates", default=True, help="跳过重复数据")
def import_rules(file_path, skip_duplicates):
    """导入赠品规则"""
    result = import_csv("rules", file_path, skip_duplicates)
    _print_import_result(result)

@import_cmd.command("orders")
@click.argument("file_path")
@click.option("--skip-duplicates/--no-skip-duplicates", default=True, help="跳过重复数据")
def import_orders(file_path, skip_duplicates):
    """导入订单数据"""
    result = import_csv("orders", file_path, skip_duplicates)
    _print_import_result(result)

@import_cmd.command("order-items")
@click.argument("file_path")
@click.option("--skip-duplicates/--no-skip-duplicates", default=True, help="跳过重复数据")
def import_order_items(file_path, skip_duplicates):
    """导入订单明细"""
    result = import_csv("order_items", file_path, skip_duplicates)
    _print_import_result(result)

@import_cmd.command("inventory")
@click.argument("file_path")
@click.option("--skip-duplicates/--no-skip-duplicates", default=True, help="跳过重复数据")
def import_inventory(file_path, skip_duplicates):
    """导入库存数据"""
    result = import_csv("inventory", file_path, skip_duplicates)
    _print_import_result(result)

@import_cmd.command("requests")
@click.argument("file_path")
@click.option("--skip-duplicates/--no-skip-duplicates", default=True, help="跳过重复数据")
def import_requests(file_path, skip_duplicates):
    """导入补发申请"""
    result = import_csv("requests", file_path, skip_duplicates)
    _print_import_result(result)

def _print_import_result(result):
    click.echo(f"导入完成: 新增 {result['inserted']}, 跳过 {result['skipped']}")
    if result["errors"]:
        click.echo(f"错误 {len(result['errors'])} 条:")
        for err in result["errors"][:10]:
            click.echo(f"  - {err}")

@cli.command()
@click.option("--export", is_flag=True, help="校验后自动导出三份清单")
@click.option("--output", default="result", help="导出文件前缀")
def validate(export, output):
    """校验待处理的补发申请，生成三份清单"""
    if not is_initialized():
        click.echo("❌ 系统未初始化，请先运行: gift_replacement init")
        sys.exit(1)
    
    pending = get_pending_requests()
    if not pending:
        click.echo("没有待处理的申请")
        return
    
    click.echo(f"待处理申请数: {len(pending)}")
    click.echo("正在校验...")
    
    results = process_pending_requests()
    
    click.echo("")
    click.echo("=" * 50)
    click.echo("校验结果汇总")
    click.echo("=" * 50)
    click.echo(f"批次号: {results['batch_id']}")
    click.echo(f"总计: {results['total']}")
    click.echo(f"✅ 可补发: {len(results['approve'])}")
    click.echo(f"❌ 不可补发: {len(results['reject'])}")
    click.echo(f"⚠️  待人工确认: {len(results['manual'])}")
    click.echo("")
    
    if results["approve"]:
        click.echo("【可补发清单】")
        _print_result_table(results["approve"][:10], ["request_id", "order_id", "customer_name", "gift_sku", "gift_quantity"])
        if len(results["approve"]) > 10:
            click.echo(f"... 还有 {len(results['approve']) - 10} 条")
        click.echo("")
    
    if results["reject"]:
        click.echo("【不可补发清单】")
        _print_result_table(results["reject"][:10], ["request_id", "order_id", "customer_name", "reason"])
        if len(results["reject"]) > 10:
            click.echo(f"... 还有 {len(results['reject']) - 10} 条")
        click.echo("")
    
    if results["manual"]:
        click.echo("【待人工确认清单】")
        _print_result_table(results["manual"][:10], ["request_id", "order_id", "customer_name", "gift_sku", "reason"])
        if len(results["manual"]) > 10:
            click.echo(f"... 还有 {len(results['manual']) - 10} 条")
        click.echo("")
    
    if export:
        files = export_process_results(results, output)
        click.echo("已导出:")
        for name, path in files.items():
            click.echo(f"  - {path}")
    
    click.echo(f"请确认后使用: gift_replacement confirm --batch {results['batch_id']}")

def _print_result_table(records, fields):
    if not records:
        return
    table_data = [[r.get(f, "") for f in fields] for r in records]
    click.echo(tabulate(table_data, headers=fields, tablefmt="simple"))

@cli.command()
@click.option("--batch", required=True, help="批次号（从 validate 命令获取）")
@click.option("--request-id", multiple=True, help="指定要确认的申请ID（可重复）")
@click.option("--all", "all_requests", is_flag=True, help="确认该批次所有申请（使用校验时的决策）")
@click.option("--approve-all", is_flag=True, help="强制批准该批次所有申请")
@click.option("--reject-all", is_flag=True, help="强制拒绝该批次所有申请")
@click.option("--manual-approve", multiple=True, help="指定待人工确认的申请ID，改为批准")
@click.option("--manual-reject", multiple=True, help="指定待人工确认的申请ID，改为拒绝")
@click.option("--reason", help="批量覆盖的原因")
@click.option("--export", is_flag=True, help="确认后导出处理结果")
@click.option("--output", default="confirmed", help="导出文件前缀")
def confirm(batch, request_id, all_requests, approve_all, reject_all, manual_approve, manual_reject, reason, export, output):
    """确认校验结果，正式锁定处理状态"""
    if not is_initialized():
        click.echo("❌ 系统未初始化，请先运行: gift_replacement init")
        sys.exit(1)
    
    if not (all_requests or approve_all or reject_all or request_id or manual_approve or manual_reject):
        click.echo("请指定操作方式，例如 --all, --approve-all, --reject-all, 或 --request-id")
        sys.exit(1)
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ph.request_id, ph.decision, ph.gift_sku, ph.gift_quantity, ph.reason,
                   rq.order_id, o.customer_name
            FROM process_history ph
            LEFT JOIN replacement_requests rq ON ph.request_id = rq.request_id
            LEFT JOIN orders o ON rq.order_id = o.order_id
            LEFT JOIN processed_requests pr ON ph.request_id = pr.request_id
            WHERE ph.batch_id = ? AND ph.action = 'VALIDATE'
              AND pr.request_id IS NULL
            ORDER BY ph.processed_at
        """, (batch,))
        batch_records = [dict(row) for row in cursor.fetchall()]
    
    if not batch_records:
        click.echo(f"批次 {batch} 无可确认的记录（可能已确认或不存在）")
        return
    
    all_ids = set(r["request_id"] for r in batch_records)
    to_process = []
    
    if all_requests:
        for r in batch_records:
            to_process.append({
                "request_id": r["request_id"],
                "decision": None
            })
    
    elif approve_all:
        for r in batch_records:
            to_process.append({
                "request_id": r["request_id"],
                "decision": DECISION_APPROVE
            })
    
    elif reject_all:
        for r in batch_records:
            to_process.append({
                "request_id": r["request_id"],
                "decision": DECISION_REJECT
            })
    
    else:
        for rid in request_id:
            if rid in all_ids:
                to_process.append({"request_id": rid, "decision": None})
            else:
                click.echo(f"警告: {rid} 不在批次 {batch} 中")
        
        for rid in manual_approve:
            if rid in all_ids:
                to_process.append({"request_id": rid, "decision": DECISION_APPROVE})
        
        for rid in manual_reject:
            if rid in all_ids:
                to_process.append({"request_id": rid, "decision": DECISION_REJECT})
    
    if not to_process:
        click.echo("没有要确认的记录")
        return
    
    seen = set()
    unique_to_process = []
    for item in to_process:
        if item["request_id"] not in seen:
            seen.add(item["request_id"])
            unique_to_process.append(item)
    
    click.echo(f"批次 {batch} 总记录: {len(batch_records)}")
    click.echo(f"将确认: {len(unique_to_process)} 条")
    
    totals = {"approve": 0, "reject": 0}
    exported = {"approve": [], "reject": [], "manual": []}
    
    for item in unique_to_process:
        rid = item["request_id"]
        decision = item["decision"]
        
        result = confirm_requests(batch, [rid], decision, reason)
        
        if result["confirmed"] == 1:
            record = next(r for r in batch_records if r["request_id"] == rid)
            final_decision = decision if decision else record["decision"]
            
            export_record = {
                "request_id": rid,
                "order_id": record["order_id"],
                "customer_name": record["customer_name"],
                "gift_sku": record["gift_sku"],
                "gift_quantity": record["gift_quantity"],
                "reason": reason if reason else record["reason"],
                "final_decision": final_decision
            }
            
            if final_decision == DECISION_APPROVE:
                totals["approve"] += 1
                exported["approve"].append(export_record)
            else:
                totals["reject"] += 1
                exported["reject"].append(export_record)
        else:
            click.echo(f"失败: {rid} - {result['failed']}")
    
    click.echo("")
    click.echo(f"确认完成: 批准 {totals['approve']}, 拒绝 {totals['reject']}")
    
    if export:
        files = export_process_results(exported, output)
        click.echo("已导出:")
        for name, path in files.items():
            click.echo(f"  - {path}")

@cli.group()
def history():
    """查询处理历史"""
    pass

@history.command("orders")
@click.argument("order_id")
@click.option("--limit", default=50, help="返回条数")
def history_order(order_id, limit):
    """查询指定订单的处理历史"""
    records = get_history(order_id=order_id, limit=limit)
    _print_history(records, f"订单 {order_id} 的处理历史")

@history.command("batches")
@click.argument("batch_id")
@click.option("--limit", default=100, help="返回条数")
def history_batch(batch_id, limit):
    """查询指定批次的处理历史"""
    records = get_history(batch_id=batch_id, limit=limit)
    _print_history(records, f"批次 {batch_id} 的处理历史")

@history.command("list")
@click.option("--limit", default=20, help="返回条数")
def history_list(limit):
    """列出所有处理批次"""
    batches = get_batches(limit=limit)
    if not batches:
        click.echo("暂无处理批次")
        return
    
    data = [[b["batch_id"], b["started_at"], b["ended_at"], b["total_records"]] for b in batches]
    click.echo(tabulate(data, headers=["批次号", "开始时间", "结束时间", "记录数"], tablefmt="simple"))

def _print_history(records, title):
    if not records:
        click.echo("暂无记录")
        return
    
    click.echo("=" * 50)
    click.echo(title)
    click.echo("=" * 50)
    
    data = [
        [r["processed_at"], r["action"], r["decision"], 
         r.get("final_decision", ""), r["gift_sku"] or "", 
         r.get("gift_quantity", 0) or 0, (r.get("reason") or "")[:30]]
        for r in records
    ]
    click.echo(tabulate(
        data, 
        headers=["时间", "动作", "决策", "最终", "赠品SKU", "数量", "原因"],
        tablefmt="simple"
    ))

@cli.group()
def export():
    """导出数据"""
    pass

@export.command("pending")
@click.option("--output", default="pending_requests", help="导出文件名前缀")
def export_pending(output):
    """导出待处理申请"""
    records = get_pending_requests()
    if not records:
        click.echo("暂无待处理申请")
        return
    
    fields = ["request_id", "order_id", "customer_name", "customer_phone", 
              "session_id", "total_amount", "refund_amount", "final_amount", "notes"]
    from core.exporter import export_to_csv
    path = f"{output}.csv"
    export_to_csv(records, path, fields)
    click.echo(f"已导出: {path}")

@export.command("processed")
@click.option("--output", default="processed_requests", help="导出文件名前缀")
@click.option("--limit", default=1000, help="导出条数")
def export_processed(output, limit):
    """导出已处理申请"""
    records = get_processed_requests(limit=limit)
    if not records:
        click.echo("暂无已处理申请")
        return
    
    fields = ["request_id", "order_id", "customer_name", "session_id", 
              "batch_id", "final_decision", "finalized_at"]
    from core.exporter import export_to_csv
    path = f"{output}.csv"
    export_to_csv(records, path, fields)
    click.echo(f"已导出: {path}")

@export.command("batches")
@click.option("--output", default="batches_summary", help="导出文件名前缀")
def export_batches(output):
    """导出批次汇总"""
    batches = get_batches_for_export()
    if not batches:
        click.echo("暂无批次")
        return
    
    fields = ["batch_id", "started_at", "ended_at", "approve_count", "reject_count", "manual_count", "total"]
    from core.exporter import export_to_csv
    path = f"{output}.csv"
    export_to_csv(batches, path, fields)
    click.echo(f"已导出: {path}")

@export.command("history")
@click.option("--order-id", help="指定订单号")
@click.option("--batch-id", help="指定批次号")
@click.option("--output", help="导出文件路径")
def export_history_cmd(order_id, batch_id, output):
    """导出历史记录"""
    if not (order_id or batch_id):
        click.echo("请指定 --order-id 或 --batch-id")
        return
    
    path = export_history(order_id=order_id, batch_id=batch_id, output_path=output)
    click.echo(f"已导出: {path}")

@cli.command()
@click.option("--type", "data_type", help="查看数据类型: sessions|products|rules|orders|inventory|requests")
@click.option("--limit", default=20, help="显示条数")
def status(data_type, limit):
    """查看系统状态和数据统计"""
    if not is_initialized():
        click.echo("❌ 系统未初始化")
        click.echo("请运行: gift_replacement init")
        return
    
    if data_type:
        _show_data_details(data_type, limit)
        return
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        stats = {}
        for table in ["live_sessions", "products", "gift_rules", "orders", "order_items", "inventory", "replacement_requests"]:
            cursor.execute(f"SELECT COUNT(*) as cnt FROM {table}")
            stats[table] = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(*) as cnt FROM replacement_requests rq WHERE rq.request_id NOT IN (SELECT request_id FROM processed_requests)")
        stats["pending_requests"] = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(*) as cnt FROM processed_requests")
        stats["processed_requests"] = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(DISTINCT batch_id) as cnt FROM process_history")
        stats["batches"] = cursor.fetchone()["cnt"]
    
    click.echo("=" * 40)
    click.echo("系统状态")
    click.echo("=" * 40)
    click.echo(f"数据库: {get_db_path()}")
    click.echo("")
    click.echo("数据统计:")
    click.echo(f"  直播场次: {stats['live_sessions']}")
    click.echo(f"  商品: {stats['products']}")
    click.echo(f"  赠品规则: {stats['gift_rules']}")
    click.echo(f"  订单: {stats['orders']}")
    click.echo(f"  订单明细: {stats['order_items']}")
    click.echo(f"  库存记录: {stats['inventory']}")
    click.echo("")
    click.echo("处理统计:")
    click.echo(f"  补发申请: {stats['replacement_requests']}")
    click.echo(f"    - 待处理: {stats['pending_requests']}")
    click.echo(f"    - 已处理: {stats['processed_requests']}")
    click.echo(f"  处理批次: {stats['batches']}")

def _show_data_details(data_type, limit):
    table_map = {
        "sessions": "live_sessions",
        "products": "products",
        "rules": "gift_rules",
        "orders": "orders",
        "inventory": "inventory",
        "requests": "replacement_requests"
    }
    
    if data_type not in table_map:
        click.echo(f"未知类型: {data_type}")
        return
    
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(f"SELECT * FROM {table_map[data_type]} LIMIT ?", (limit,))
        rows = cursor.fetchall()
        
        if not rows:
            click.echo("暂无数据")
            return
        
        keys = rows[0].keys()
        data = [[row[k] for k in keys] for row in rows]
        click.echo(tabulate(data, headers=keys, tablefmt="simple"))

if __name__ == "__main__":
    cli()
