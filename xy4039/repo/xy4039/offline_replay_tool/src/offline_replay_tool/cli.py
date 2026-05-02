import json
import shutil
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click
import uvicorn
from rich.console import Console
from rich.table import Table

from .config import AppConfig, CabinetConfig, ChannelConfig, SKUConfig
from .ledger import Ledger
from .models import BatchInfo, Event
from .parser import EventParser
from .quarantine import QuarantineStore
from .replay import OrderReplayEngine
from .reports import ReportExporter
from .validator import EventValidator

console = Console()


def load_config(config_path: Path) -> AppConfig:
    if not config_path.exists():
        console.print(f"[red]错误: 配置文件不存在: {config_path}[/red]")
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    cabinets = []
    for cab in data.get("cabinets", []):
        cabinets.append(CabinetConfig(**cab))

    skus = []
    for s in data.get("skus", []):
        skus.append(SKUConfig(**s))

    channels = []
    for ch in data.get("channels", []):
        channels.append(ChannelConfig(**ch))

    return AppConfig(
        cabinets=cabinets,
        skus=skus,
        channels=channels,
        deduplication_window_seconds=data.get("deduplication_window_seconds", 3600),
        max_clock_drift_seconds=data.get("max_clock_drift_seconds", 300),
        abnormal_weight_threshold_percent=data.get("abnormal_weight_threshold_percent", 20.0),
        data_dir=Path(data.get("data_dir", "./data")),
        output_dir=Path(data.get("output_dir", "./output")),
    )


def get_config_path(ctx: click.Context) -> Path:
    config_env = ctx.params.get("config")
    if config_env:
        return Path(config_env)
    return Path("replay-tool-config.json")


@click.group()
@click.option("--config", "-c", type=str, help="配置文件路径")
@click.pass_context
def main(ctx: click.Context, config: Optional[str]):
    """离线补账包回放器 - 智能售货柜运维工具"""
    ctx.ensure_object(dict)
    if config:
        ctx.obj["config_path"] = Path(config)
    else:
        ctx.obj["config_path"] = Path("replay-tool-config.json")


@main.command()
@click.option("--data-dir", "-d", type=str, default="./data", help="数据目录")
@click.option("--output-dir", "-o", type=str, default="./output", help="输出目录")
@click.pass_context
def init(ctx: click.Context, data_dir: str, output_dir: str):
    """初始化配置文件和目录结构"""
    config_path = ctx.obj["config_path"]

    if config_path.exists():
        console.print(f"[yellow]警告: 配置文件已存在: {config_path}[/yellow]")
        if not click.confirm("是否覆盖?", default=False):
            console.print("操作已取消")
            return

    default_config = {
        "cabinets": [
            {
                "cabinet_id": "CAB001",
                "name": "一号柜",
                "location": "A栋一楼大厅",
            },
            {
                "cabinet_id": "CAB002",
                "name": "二号柜",
                "location": "B栋二楼茶水间",
            },
        ],
        "skus": [
            {
                "sku_id": "SKU001",
                "name": "农夫山泉500ml",
                "price": 2.0,
                "weight_per_unit": 520.0,
            },
            {
                "sku_id": "SKU002",
                "name": "可口可乐330ml",
                "price": 3.5,
                "weight_per_unit": 355.0,
            },
            {
                "sku_id": "SKU003",
                "name": "乐事薯片",
                "price": 5.0,
                "weight_per_unit": 75.0,
            },
        ],
        "channels": [
            {
                "channel_id": "CAB001_CH01",
                "sku_id": "SKU001",
                "capacity": 20,
                "initial_quantity": 15,
            },
            {
                "channel_id": "CAB001_CH02",
                "sku_id": "SKU002",
                "capacity": 15,
                "initial_quantity": 10,
            },
            {
                "channel_id": "CAB002_CH01",
                "sku_id": "SKU001",
                "capacity": 20,
                "initial_quantity": 18,
            },
            {
                "channel_id": "CAB002_CH02",
                "sku_id": "SKU003",
                "capacity": 10,
                "initial_quantity": 8,
            },
        ],
        "deduplication_window_seconds": 3600,
        "max_clock_drift_seconds": 300,
        "abnormal_weight_threshold_percent": 20.0,
        "data_dir": data_dir,
        "output_dir": output_dir,
    }

    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(default_config, f, ensure_ascii=False, indent=2)

    data_path = Path(data_dir)
    output_path = Path(output_dir)
    data_path.mkdir(parents=True, exist_ok=True)
    output_path.mkdir(parents=True, exist_ok=True)

    console.print(f"[green]✓ 配置文件已创建: {config_path}[/green]")
    console.print(f"[green]✓ 数据目录已创建: {data_path.absolute()}[/green]")
    console.print(f"[green]✓ 输出目录已创建: {output_path.absolute()}[/green]")
    console.print()
    console.print("已创建默认配置，包含:")
    console.print("  - 2 台柜机 (CAB001, CAB002)")
    console.print("  - 3 个 SKU")
    console.print("  - 4 个货道")
    console.print()
    console.print("请编辑配置文件以匹配实际环境。")


@main.command("import-bundle")
@click.argument("files", nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.pass_context
def import_bundle(ctx: click.Context, files: List[Path]):
    """导入一个或多个离线补账包 JSONL 文件"""
    if not files:
        console.print("[red]错误: 请指定至少一个文件[/red]")
        sys.exit(1)

    config = load_config(ctx.obj["config_path"])
    ledger = Ledger(config.data_dir, config)
    quarantine = QuarantineStore(config.data_dir)
    parser = EventParser(config)
    validator = EventValidator(config)

    batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

    total_events = 0
    valid_events = 0
    quarantined_events = 0
    errors: List[str] = []
    all_valid_events: List[Event] = []

    bundles_dir = config.data_dir / "bundles"
    bundles_dir.mkdir(parents=True, exist_ok=True)

    source_files = []
    for file_path in files:
        dest_path = bundles_dir / f"{batch_id}_{file_path.name}"
        shutil.copy2(file_path, dest_path)
        source_files.append(str(dest_path.name))

        console.print(f"[cyan]处理文件: {file_path.name}[/cyan]")

        try:
            for raw_data in parser.parse_jsonl_file(file_path):
                total_events += 1
                try:
                    event = parser.parse_event(raw_data)
                    event.batch_id = batch_id

                    validation = validator.validate_single_event(event)
                    event.validation_errors = validation.errors

                    if validation.is_valid:
                        event.validated = True
                        valid_events += 1
                        all_valid_events.append(event)
                    else:
                        quarantined_events += 1
                        reason = "; ".join(validation.errors)
                        quarantine.add_event(event, reason, batch_id)

                except Exception as e:
                    quarantined_events += 1
                    errors.append(f"{file_path.name}: {e}")

        except Exception as e:
            console.print(f"[red]处理文件时出错: {e}[/red]")
            sys.exit(1)

    if errors:
        console.print(f"[yellow]部分事件解析失败，已记录错误[/yellow]")
        for err in errors[:10]:
            console.print(f"  - {err}")

    batch_info = BatchInfo(
        batch_id=batch_id,
        import_time=datetime.now(),
        source_files=source_files,
        event_count=total_events,
        valid_event_count=valid_events,
        quarantined_count=quarantined_events,
    )

    ledger.register_batch(batch_info)

    table = Table(title="导入结果")
    table.add_column("项目", style="cyan")
    table.add_column("数值", style="green")
    table.add_row("批次号", batch_id)
    table.add_row("源文件数", str(len(files)))
    table.add_row("总事件数", str(total_events))
    table.add_row("有效事件数", str(valid_events))
    table.add_row("隔离事件数", str(quarantined_events))
    console.print(table)


@main.command()
@click.option("--batch-id", "-b", type=str, help="指定批次ID校验（不指定则校验所有未应用批次）")
@click.pass_context
def check(ctx: click.Context, batch_id: Optional[str]):
    """校验事件数据"""
    config = load_config(ctx.obj["config_path"])
    ledger = Ledger(config.data_dir, config)
    quarantine = QuarantineStore(config.data_dir)
    validator = EventValidator(config)

    batches = ledger.get_all_batches()
    if batch_id:
        batches = [b for b in batches if b.batch_id == batch_id]

    if not batches:
        console.print("[yellow]没有找到要校验的批次[/yellow]")
        return

    for batch in batches:
        console.print(f"[cyan]校验批次: {batch.batch_id}[/cyan]")

        bundles_dir = config.data_dir / "bundles"
        batch_files = [
            bundles_dir / f
            for f in batch.source_files
            if (bundles_dir / f).exists()
        ]

        if not batch_files:
            console.print(f"[yellow]批次 {batch.batch_id} 没有找到源文件[/yellow]")
            continue

        all_events = []
        parser = EventParser(config)

        for file_path in batch_files:
            for raw_data in parser.parse_jsonl_file(file_path):
                try:
                    event = parser.parse_event(raw_data)
                    event.batch_id = batch.batch_id
                    all_events.append(event)
                except Exception as e:
                    console.print(f"[yellow]跳过解析失败的事件: {e}[/yellow]")

        rel_errors = validator.validate_event_relationships(all_events, batch.batch_id)

        if rel_errors:
            console.print(f"[red]发现 {len(rel_errors)} 个关联错误[/red]")
            for event_id, errors in rel_errors.items():
                for err in errors:
                    console.print(f"  - [{event_id}] {err}")

        quarantined = quarantine.get_events_by_batch(batch.batch_id)
        if quarantined:
            console.print(f"[yellow]批次 {batch.batch_id} 有 {len(quarantined)} 个隔离事件[/yellow]")
            table = Table(title="隔离事件")
            table.add_column("事件ID", style="cyan")
            table.add_column("类型", style="green")
            table.add_column("原因", style="yellow")
            for qe in quarantined:
                table.add_row(qe.event.event_id, qe.event.event_type.value, qe.reason)
            console.print(table)
        else:
            console.print(f"[green]批次 {batch.batch_id} 校验通过，无隔离事件[/green]")


@main.command()
@click.argument("batch_id", type=str)
@click.option("--dry-run", "-n", is_flag=True, help="试运行模式，不实际修改数据")
@click.pass_context
def replay(ctx: click.Context, batch_id: str, dry_run: bool):
    """回放批次事件"""
    config = load_config(ctx.obj["config_path"])
    ledger = Ledger(config.data_dir, config)
    quarantine = QuarantineStore(config.data_dir)
    validator = EventValidator(config)
    parser = EventParser(config)
    replay_engine = OrderReplayEngine(config, validator)

    batch = ledger.get_batch(batch_id)
    if not batch:
        console.print(f"[red]批次不存在: {batch_id}[/red]")
        sys.exit(1)

    if batch.applied and not dry_run:
        console.print(f"[yellow]批次 {batch_id} 已应用，跳过重复应用[/yellow]")
        return

    bundles_dir = config.data_dir / "bundles"
    batch_files = [
        bundles_dir / f
        for f in batch.source_files
        if (bundles_dir / f).exists()
    ]

    if not batch_files:
        console.print(f"[red]批次 {batch_id} 没有找到源文件[/red]")
        sys.exit(1)

    all_events = []
    for file_path in batch_files:
        for raw_data in parser.parse_jsonl_file(file_path):
            try:
                event = parser.parse_event(raw_data)
                event.batch_id = batch.batch_id

                validation = validator.validate_single_event(event)
                if validation.is_valid:
                    event.validated = True
                    all_events.append(event)
                else:
                    pass

            except Exception as e:
                console.print(f"[yellow]跳过解析失败的事件: {e}[/yellow]")

    if not all_events:
        console.print("[yellow]没有可回放的有效事件[/yellow]")
        return

    console.print(f"[cyan]开始回放批次: {batch_id}[/cyan]")
    if dry_run:
        console.print("[yellow]试运行模式，不会实际应用更改[/yellow]")

    results = replay_engine.build_replay_results(all_events, dry_run=dry_run)

    stats = results["statistics"]
    issues = results["issues"]
    orders = results["orders"]

    table = Table(title="回放统计")
    table.add_column("指标", style="cyan")
    table.add_column("数值", style="green")
    table.add_row("总事件数", str(stats["total_events"]))
    table.add_row("唯一订单数", str(stats["unique_orders"]))
    table.add_row("已支付订单", str(stats["paid_orders"]))
    table.add_row("进行中订单", str(stats["open_orders"]))
    table.add_row("预期总金额", f"¥{stats['total_expected_amount']:.2f}")
    table.add_row("实际支付金额", f"¥{stats['total_paid_amount']:.2f}")
    console.print(table)

    if issues:
        console.print(f"[yellow]发现 {len(issues)} 个问题[/yellow]")
        for issue in issues:
            console.print(f"  - [{issue['order_id']}] {issue['issue']}: {issue['details']}")

    if orders:
        table = Table(title="订单明细")
        table.add_column("订单ID", style="cyan")
        table.add_column("柜机", style="green")
        table.add_column("状态", style="yellow")
        table.add_column("预期金额", style="magenta")
        table.add_column("实际支付", style="magenta")
        table.add_column("人工补录", style="red")
        for order in orders[:10]:
            has_manual = "是" if order["has_manual_override"] else "否"
            table.add_row(
                order["order_id"],
                order["cabinet_id"],
                order["status"],
                f"¥{order['total_amount']:.2f}",
                f"¥{order['paid_amount']:.2f}",
                has_manual,
            )
        if len(orders) > 10:
            table.add_row("...", "...", "...", "...", "...", "...")
        console.print(table)

    if dry_run:
        console.print()
        console.print("[green]试运行完成，请检查上述结果[/green]")
        console.print(f"执行 [bold]replay-tool apply {batch_id}[/bold] 确认应用")
    else:
        all_order_states = replay_engine.get_all_orders()
        result = ledger.apply_batch(batch_id, all_order_states, dry_run=False)
        console.print()
        console.print(f"[green]{result['message']}[/green]")


@main.command()
@click.argument("batch_id", type=str)
@click.pass_context
def apply(ctx: click.Context, batch_id: str):
    """确认应用批次"""
    config = load_config(ctx.obj["config_path"])
    ledger = Ledger(config.data_dir, config)
    quarantine = QuarantineStore(config.data_dir)
    validator = EventValidator(config)
    parser = EventParser(config)
    replay_engine = OrderReplayEngine(config, validator)

    batch = ledger.get_batch(batch_id)
    if not batch:
        console.print(f"[red]批次不存在: {batch_id}[/red]")
        sys.exit(1)

    if batch.applied:
        console.print(f"[green]批次 {batch_id} 已应用，跳过重复应用（幂等）[/green]")
        return

    bundles_dir = config.data_dir / "bundles"
    batch_files = [
        bundles_dir / f
        for f in batch.source_files
        if (bundles_dir / f).exists()
    ]

    if not batch_files:
        console.print(f"[red]批次 {batch_id} 没有找到源文件[/red]")
        sys.exit(1)

    all_events = []
    for file_path in batch_files:
        for raw_data in parser.parse_jsonl_file(file_path):
            try:
                event = parser.parse_event(raw_data)
                event.batch_id = batch.batch_id
                validation = validator.validate_single_event(event)
                if validation.is_valid:
                    event.validated = True
                    all_events.append(event)
            except Exception as e:
                pass

    replay_engine.build_replay_results(all_events, dry_run=False)
    all_order_states = replay_engine.get_all_orders()

    result = ledger.apply_batch(batch_id, all_order_states, dry_run=False)

    if result.get("already_applied"):
        console.print(f"[green]{result['message']}[/green]")
    else:
        console.print(f"[green]{result['message']}[/green]")
        console.print(f"[cyan]处理订单数: {result['orders_processed']}[/cyan]")

        changes = result.get("inventory_changes", {})
        if changes:
            console.print("[cyan]库存变更:[/cyan]")
            for cab, ch_changes in changes.items():
                for ch, delta in ch_changes.items():
                    sign = "+" if delta > 0 else ""
                    console.print(f"  - {cab}/{ch}: {sign}{delta}")


@main.command()
@click.pass_context
def undo(ctx: click.Context):
    """撤销最近一次已应用的批次"""
    config = load_config(ctx.obj["config_path"])
    ledger = Ledger(config.data_dir, config)

    applied = ledger.get_applied_batches()
    if not applied:
        console.print("[yellow]没有已应用的批次可撤销[/yellow]")
        return

    last_batch = applied[-1]
    console.print(f"[cyan]将撤销批次: {last_batch}[/cyan]")
    if not click.confirm("确认撤销?", default=False):
        console.print("操作已取消")
        return

    result = ledger.undo_last_batch()
    if result["success"]:
        console.print(f"[green]{result['message']}[/green]")
    else:
        console.print(f"[red]撤销失败: {result['message']}[/red]")
        sys.exit(1)


@main.command("serve")
@click.option("--host", "-H", type=str, default="127.0.0.1", help="监听地址")
@click.option("--port", "-p", type=int, default=8000, help="监听端口")
@click.option("--reload", "-r", is_flag=True, help="自动重载")
@click.pass_context
def serve(ctx: click.Context, host: str, port: int, reload: bool):
    """启动 REST API 服务"""
    config = load_config(ctx.obj["config_path"])
    ledger = Ledger(config.data_dir, config)
    quarantine = QuarantineStore(config.data_dir)
    exporter = ReportExporter(config.output_dir, config)

    from .api import create_api_app

    app = create_api_app(config, ledger, quarantine, exporter)

    console.print(f"[green]启动 REST API 服务...[/green]")
    console.print(f"[cyan]监听地址: http://{host}:{port}[/cyan]")
    console.print(f"[cyan]API 文档: http://{host}:{port}/docs[/cyan]")

    uvicorn.run(app, host=host, port=port, reload=reload)


@main.command("export")
@click.option("--type", "-t", type=click.Choice(["markdown", "csv", "json"]), default="markdown", help="导出格式")
@click.pass_context
def export_cmd(ctx: click.Context, type: str):
    """导出对账报告"""
    config = load_config(ctx.obj["config_path"])
    ledger = Ledger(config.data_dir, config)
    quarantine = QuarantineStore(config.data_dir)
    exporter = ReportExporter(config.output_dir, config)

    batches = ledger.get_all_batches()
    inventories = ledger.get_all_inventories()
    quarantine_events = quarantine.get_all_events()
    audit_log = ledger.get_audit_log()

    if type == "markdown":
        filepath = exporter.export_markdown_reconciliation(
            batches=batches,
            inventories=inventories,
            orders=[],
            quarantined_events=quarantine_events,
            audit_log=audit_log,
        )
        console.print(f"[green]Markdown 对账报告已导出: {filepath}[/green]")
    elif type == "csv":
        filepath = exporter.export_csv_inventory_diff(inventories=inventories)
        console.print(f"[green]CSV 库存差异表已导出: {filepath}[/green]")
    elif type == "json":
        filepath = exporter.export_json_audit_evidence(
            batches=batches,
            orders=[],
            inventories=inventories,
            audit_log=audit_log,
        )
        console.print(f"[green]JSON 审计证据已导出: {filepath}[/green]")


@main.command("status")
@click.pass_context
def status(ctx: click.Context):
    """显示当前状态"""
    config = load_config(ctx.obj["config_path"])
    ledger = Ledger(config.data_dir, config)
    quarantine = QuarantineStore(config.data_dir)

    batches = ledger.get_all_batches()
    applied_batches = ledger.get_applied_batches()
    inventories = ledger.get_all_inventories()
    quarantine_stats = quarantine.get_stats()

    table = Table(title="系统状态")
    table.add_column("项目", style="cyan")
    table.add_column("数值", style="green")
    table.add_row("批次总数", str(len(batches)))
    table.add_row("已应用批次", str(len(applied_batches)))
    table.add_row("已初始化柜机数", str(len(inventories)))
    table.add_row("隔离事件总数", str(quarantine_stats["total"]))
    console.print(table)

    if batches:
        table = Table(title="批次列表")
        table.add_column("批次ID", style="cyan")
        table.add_column("导入时间", style="green")
        table.add_column("事件数", style="yellow")
        table.add_column("状态", style="magenta")
        for batch in batches[-5:]:
            status = "已应用" if batch.applied else "待应用"
            table.add_row(
                batch.batch_id,
                batch.import_time.strftime("%Y-%m-%d %H:%M"),
                str(batch.event_count),
                status,
            )
        console.print(table)


if __name__ == "__main__":
    main()
