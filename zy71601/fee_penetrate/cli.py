#!/usr/bin/env python3
import sys
import os
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .config import Config
from .database import Database
from .importer import DataImporter
from .calculator import FeeCalculator
from .anomaly_detector import AnomalyDetector, AnomalySeverity
from .exporter import MonthlyReportExporter
from .models import FeeType, ShareCaliber, AccrualMethod

console = Console()


def parse_date(date_str: str) -> date:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        try:
            return datetime.strptime(date_str, "%Y%m%d").date()
        except ValueError:
            raise click.BadParameter(f"日期格式错误: {date_str}，请使用 YYYY-MM-DD 或 YYYYMMDD")


def parse_decimal(value_str: str) -> Decimal:
    try:
        return Decimal(value_str)
    except (InvalidOperation, ValueError):
        raise click.BadParameter(f"数值格式错误: {value_str}")


def print_import_result(result):
    summary = result.summary()
    console.print(Panel(
        f"[bold]导入批次:[/bold] {result.batch_no}\n"
        f"[bold]总计记录:[/bold] {summary['total']}\n"
        f"[green]新增:[/green] {summary['new']} | "
        f"[yellow]跳过:[/yellow] {summary['skip']} | "
        f"[blue]更新:[/blue] {summary['update']} | "
        f"[red]冲突:[/red] {summary['conflict']}",
        title="导入结果汇总",
        expand=False
    ))

    if result.new_items:
        table = Table(title="新增记录", show_header=True)
        table.add_column("类型")
        table.add_column("ID")
        table.add_column("标识")
        for item in result.new_items[:20]:
            table.add_row(
                item["entity_type"],
                str(item["entity_id"]),
                item["identifier"]
            )
        if len(result.new_items) > 20:
            table.add_row("...", "...", f"共 {len(result.new_items)} 条")
        console.print(table)

    if result.updates:
        table = Table(title="更新记录", show_header=True)
        table.add_column("类型")
        table.add_column("ID")
        table.add_column("标识")
        table.add_column("变更字段")
        for item in result.updates[:20]:
            changes = ", ".join([f"{c[0]}: {c[1]}→{c[2]}" for c in item["changes"]])
            table.add_row(
                item["entity_type"],
                str(item["entity_id"]),
                item["identifier"],
                changes[:50] + "..." if len(changes) > 50 else changes
            )
        if len(result.updates) > 20:
            table.add_row("...", "...", "...", f"共 {len(result.updates)} 条")
        console.print(table)

    if result.conflicts:
        table = Table(title="[red]冲突记录[/red]", show_header=True)
        table.add_column("类型")
        table.add_column("ID")
        table.add_column("标识")
        table.add_column("冲突字段")
        for item in result.conflicts:
            changes = ", ".join([f"{c[0]}: {c[1]}≠{c[2]}" for c in item["changes"]])
            table.add_row(
                item["entity_type"],
                str(item["entity_id"]),
                item["identifier"],
                changes[:80] + "..." if len(changes) > 80 else changes
            )
        console.print(table)
        console.print(
            "[yellow]提示:[/yellow] 使用 --update-mode=force 可强制更新，"
            "使用 --update-mode=skip 可跳过冲突记录"
        )


@click.group()
@click.option("--db-path", help="数据库文件路径，默认 ~/.fee_penetrate/fee_penetrate.db")
@click.option("--operator", "-o", default=os.environ.get("USER", "unknown"),
              help="操作员姓名，默认为当前系统用户")
@click.pass_context
def cli(ctx, db_path, operator):
    """理财产品费用穿透 CLI - 管理费、托管费、销售服务费核对工具"""
    if db_path:
        Config.set_db_path(db_path)
    ctx.ensure_object(dict)
    ctx.obj["operator"] = operator
    ctx.obj["db"] = Database()


@cli.group(name="import")
def import_cmd():
    """导入数据 - 支持产品、费用规则、净值、渠道、客户份额、渠道返费"""
    pass


@import_cmd.command("products")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--update-mode", "-m",
              type=click.Choice(["prompt", "skip", "force", "conflict"]),
              default="prompt",
              help="更新模式: prompt(提示)/skip(跳过)/force(强制更新)/conflict(只检测冲突)")
@click.option("--reason", "-r", help="导入原因/备注")
@click.pass_context
def import_products(ctx, file_path, update_mode, reason):
    """导入理财产品基础信息"""
    importer = DataImporter(operator=ctx.obj["operator"], db=ctx.obj["db"])
    result = importer.import_products(file_path, update_mode, reason)
    print_import_result(result)


@import_cmd.command("fee-rules")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--update-mode", "-m",
              type=click.Choice(["prompt", "skip", "force", "conflict"]),
              default="prompt",
              help="更新模式")
@click.option("--reason", "-r", help="导入原因/备注")
@click.pass_context
def import_fee_rules(ctx, file_path, update_mode, reason):
    """导入费用规则（管理费、托管费、销售服务费费率）"""
    importer = DataImporter(operator=ctx.obj["operator"], db=ctx.obj["db"])
    result = importer.import_fee_rules(file_path, update_mode, reason)
    print_import_result(result)


@import_cmd.command("nav")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--update-mode", "-m",
              type=click.Choice(["prompt", "skip", "force", "conflict"]),
              default="prompt",
              help="更新模式")
@click.option("--reason", "-r", help="导入原因/备注")
@click.pass_context
def import_nav(ctx, file_path, update_mode, reason):
    """导入净值流水数据"""
    importer = DataImporter(operator=ctx.obj["operator"], db=ctx.obj["db"])
    result = importer.import_nav_flows(file_path, update_mode, reason)
    print_import_result(result)


@import_cmd.command("channels")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--update-mode", "-m",
              type=click.Choice(["prompt", "skip", "force", "conflict"]),
              default="prompt",
              help="更新模式")
@click.option("--reason", "-r", help="导入原因/备注")
@click.pass_context
def import_channels(ctx, file_path, update_mode, reason):
    """导入销售渠道信息"""
    importer = DataImporter(operator=ctx.obj["operator"], db=ctx.obj["db"])
    result = importer.import_channels(file_path, update_mode, reason)
    print_import_result(result)


@import_cmd.command("shares")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--update-mode", "-m",
              type=click.Choice(["prompt", "skip", "force", "conflict"]),
              default="prompt",
              help="更新模式")
@click.option("--reason", "-r", help="导入原因/备注")
@click.pass_context
def import_shares(ctx, file_path, update_mode, reason):
    """导入客户份额明细"""
    importer = DataImporter(operator=ctx.obj["operator"], db=ctx.obj["db"])
    result = importer.import_customer_shares(file_path, update_mode, reason)
    print_import_result(result)


@import_cmd.command("rebates")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--update-mode", "-m",
              type=click.Choice(["prompt", "skip", "force", "conflict"]),
              default="prompt",
              help="更新模式")
@click.option("--reason", "-r", help="导入原因/备注")
@click.pass_context
def import_rebates(ctx, file_path, update_mode, reason):
    """导入渠道返费规则"""
    importer = DataImporter(operator=ctx.obj["operator"], db=ctx.obj["db"])
    result = importer.import_channel_rebates(file_path, update_mode, reason)
    print_import_result(result)


@import_cmd.command("note")
@click.option("--entity-type", required=True,
              type=click.Choice(["Product", "FeeRule", "NavFlow", "CustomerShare",
                                 "ChannelRebate", "FeeAccrual"]),
              help="关联实体类型")
@click.option("--entity-id", type=int, required=True, help="关联实体ID")
@click.option("--content", required=True, help="口头备注内容")
@click.option("--from", "note_from", required=True, help="备注来源（谁告知的）")
@click.option("--description", help="备注说明")
@click.option("--reason", "-r", help="备注原因")
@click.pass_context
def add_note(ctx, entity_type, entity_id, content, note_from, description, reason):
    """添加口头备注到指定实体"""
    importer = DataImporter(operator=ctx.obj["operator"], db=ctx.obj["db"])
    attachment = importer.add_verbal_note(
        entity_type=entity_type,
        entity_id=entity_id,
        content=content,
        note_from=note_from,
        description=description,
        reason=reason
    )
    console.print(Panel(
        f"[green]口头备注已添加[/green]\n"
        f"ID: {attachment.id}\n"
        f"关联: {entity_type}#{entity_id}\n"
        f"来源: {note_from}\n"
        f"内容: {content[:100]}...",
        title="添加成功",
        expand=False
    ))


@cli.command("check")
@click.option("--product", "product_code", help="指定产品代码")
@click.option("--channel", "channel_code", help="指定渠道代码")
@click.option("--start-date", help="开始日期 YYYY-MM-DD")
@click.option("--end-date", help="结束日期 YYYY-MM-DD")
@click.pass_context
def run_checks(ctx, product_code, channel_code, start_date, end_date):
    """运行异常检测 - 检查费用跨期、份额口径、渠道返费重复等问题"""
    detector = AnomalyDetector(db=ctx.obj["db"])

    period_start = parse_date(start_date) if start_date else None
    period_end = parse_date(end_date) if end_date else None

    with console.status("[bold green]正在运行异常检测..."):
        result = detector.run_all_checks(
            product_code=product_code,
            channel_code=channel_code,
            period_start=period_start,
            period_end=period_end,
            operator=ctx.obj["operator"]
        )

    console.print(Panel(
        f"[bold]检测完成[/bold]\n"
        f"[red]高危:[/red] {result['by_severity'].get('high', 0)} | "
        f"[yellow]中危:[/yellow] {result['by_severity'].get('medium', 0)} | "
        f"[blue]低危:[/blue] {result['by_severity'].get('low', 0)}\n"
        f"[bold]总计:[/bold] {result['total']} 个异常",
        title="异常检测结果",
        expand=False
    ))

    if result["anomalies"]:
        table = Table(title="异常详情", show_header=True)
        table.add_column("严重程度", justify="center")
        table.add_column("类型")
        table.add_column("关联实体")
        table.add_column("描述")
        table.add_column("期间")

        severity_style = {
            "high": "[red]高[/red]",
            "medium": "[yellow]中[/yellow]",
            "low": "[blue]低[/blue]",
        }

        for a in result["anomalies"][:30]:
            period = ""
            if a["period_start"] and a["period_end"]:
                period = f"{a['period_start']}~{a['period_end']}"
            elif a["period_start"]:
                period = str(a["period_start"])

            table.add_row(
                severity_style.get(a["severity"], a["severity"]),
                a["anomaly_type"],
                f"{a['entity_type']}#{a['entity_id']}",
                a["description"][:80] + "..." if len(a["description"]) > 80 else a["description"],
                period
            )

        if len(result["anomalies"]) > 30:
            table.add_row("...", "...", "...", f"还有 {len(result['anomalies'])-30} 条...", "...")

        console.print(table)
        console.print("\n[yellow]提示:[/yellow] 使用 'fee anomaly resolve <id>' 解决异常")


@cli.group()
def anomaly():
    """异常管理 - 查看、解决异常"""
    pass


@anomaly.command("list")
@click.option("--severity", type=click.Choice(["high", "medium", "low"]), help="按严重程度过滤")
@click.option("--type", "anomaly_type", help="按异常类型过滤")
@click.option("--entity-type", help="按实体类型过滤")
@click.pass_context
def list_anomalies(ctx, severity, anomaly_type, entity_type):
    """列出未解决的异常"""
    detector = AnomalyDetector(db=ctx.obj["db"])
    anomalies = detector.get_unresolved_anomalies(
        entity_type=entity_type,
        anomaly_type=anomaly_type,
        severity=severity
    )

    if not anomalies:
        console.print("[green]没有未解决的异常[/green]")
        return

    table = Table(title="未解决异常列表", show_header=True)
    table.add_column("ID")
    table.add_column("严重程度")
    table.add_column("类型")
    table.add_column("关联实体")
    table.add_column("描述")
    table.add_column("创建时间")

    severity_style = {
        "high": "[red]高[/red]",
        "medium": "[yellow]中[/yellow]",
        "low": "[blue]低[/blue]",
    }

    for a in anomalies:
        table.add_row(
            str(a["id"]),
            severity_style.get(a["severity"], a["severity"]),
            a["anomaly_type"],
            f"{a['entity_type']}#{a['entity_id']}",
            a["description"][:60] + "..." if len(a["description"]) > 60 else a["description"],
            a["created_at"].strftime("%Y-%m-%d %H:%M") if a["created_at"] else ""
        )

    console.print(table)


@anomaly.command("resolve")
@click.argument("anomaly_id", type=int)
@click.option("--note", required=True, help="解决说明")
@click.pass_context
def resolve_anomaly(ctx, anomaly_id, note):
    """标记异常为已解决"""
    detector = AnomalyDetector(db=ctx.obj["db"])
    result = detector.resolve_anomaly(
        anomaly_id=anomaly_id,
        operator=ctx.obj["operator"],
        resolution_note=note
    )

    if result:
        console.print(f"[green]异常 {anomaly_id} 已标记为已解决[/green]")
    else:
        console.print(f"[red]未找到异常 {anomaly_id}[/red]")


@cli.group()
def calculate():
    """费用计算 - 试算、份额穿透、渠道分摊、差异解释"""
    pass


@calculate.command("fee")
@click.option("--product", "product_code", required=True, help="产品代码")
@click.option("--fee-type", required=True,
              type=click.Choice(["management", "custodian", "sales_service", "管理费", "托管费", "销售服务费"]),
              help="费用类型")
@click.option("--start-date", required=True, help="开始日期 YYYY-MM-DD")
@click.option("--end-date", required=True, help="结束日期 YYYY-MM-DD")
@click.option("--adjust", type=float, help="人工调整金额（正数增加，负数减少）")
@click.option("--adjust-reason", help="人工调整原因")
@click.option("--no-save", is_flag=True, help="不保存计算结果")
@click.pass_context
def calc_fee(ctx, product_code, fee_type, start_date, end_date, adjust, adjust_reason, no_save):
    """计算单项费用"""
    fee_type_map = {
        "管理费": "management",
        "托管费": "custodian",
        "销售服务费": "sales_service",
    }
    fee_type = fee_type_map.get(fee_type, fee_type)

    calculator = FeeCalculator(db=ctx.obj["db"])
    period_start = parse_date(start_date)
    period_end = parse_date(end_date)

    manual_adjustment = Decimal(str(adjust)) if adjust is not None else None

    with console.status("[bold green]正在计算费用..."):
        result = calculator.calculate_fee(
            product_code=product_code,
            fee_type=fee_type,
            period_start=period_start,
            period_end=period_end,
            operator=ctx.obj["operator"],
            manual_adjustment=manual_adjustment,
            adjustment_reason=adjust_reason,
            save=not no_save
        )

    if not result.applied_rule:
        console.print(f"[red]错误: {result.calculation_log[0]}[/red]")
        return

    fee_name_map = {
        "management": "管理费",
        "custodian": "托管费",
        "sales_service": "销售服务费",
    }

    console.print(Panel(
        f"[bold]{fee_name_map.get(fee_type, fee_type)}计算结果[/bold]\n"
        f"产品: {product_code}\n"
        f"期间: {period_start} ~ {period_end}\n"
        f"费率规则ID: {result.applied_rule['rule_id']}, 费率: {result.applied_rate * 100:.6f}%\n"
        f"份额口径: {result.share_caliber}, 计提方式: {result.accrual_method}\n"
        f"计算基数: {result.calculation_basis:.4f} 份\n"
        f"[bold]含税金额:[/bold] {result.gross_amount:.2f} 元\n"
        f"[bold]增值税额:[/bold] {result.tax_amount:.2f} 元\n"
        f"[bold green]净额:[/bold green] {result.net_amount:.2f} 元"
        + (f"\n[yellow]已人工调整: {manual_adjustment:.2f} 元，原因: {adjust_reason}[/yellow]" if result.is_manual_adjusted else ""),
        title="费用计算结果",
        expand=False
    ))

    console.print("\n[bold]计算过程:[/bold]")
    for log in result.calculation_log:
        console.print(f"  → {log}")


@calculate.command("penetrate")
@click.option("--product", "product_code", required=True, help="产品代码")
@click.option("--date", "share_date", required=True, help="份额日期 YYYY-MM-DD")
@click.pass_context
def penetrate_shares(ctx, product_code, share_date):
    """份额穿透 - 按渠道和客户拆解份额"""
    calculator = FeeCalculator(db=ctx.obj["db"])
    s_date = parse_date(share_date)

    with console.status("[bold green]正在穿透份额..."):
        result = calculator.penetrate_shares(product_code, s_date)

    console.print(Panel(
        f"产品: {product_code}\n"
        f"日期: {s_date}\n"
        f"净值流水总份额: {result.total_nav_share or '无数据'} 份\n"
        f"客户明细总份额: {result.total_customer_share or '无数据'} 份"
        + (f"\n[yellow]差异: {result.diff_amount:.4f} 份 ({result.diff_ratio * 100:.4f}%)[/yellow]"
           if result.diff_amount and result.diff_amount != 0 else ""),
        title="份额穿透结果",
        expand=False
    ))

    if result.by_channel:
        table = Table(title="按渠道分布", show_header=True)
        table.add_column("渠道代码")
        table.add_column("渠道名称")
        table.add_column("客户数", justify="right")
        table.add_column("份额", justify="right")
        table.add_column("占比", justify="right")

        for code, data in sorted(
            result.by_channel.items(),
            key=lambda x: x[1]["total_share"],
            reverse=True
        ):
            table.add_row(
                code,
                data["channel_name"],
                str(data["customer_count"]),
                f"{data['total_share']:.4f}",
                f"{data['share_ratio'] * 100:.2f}%"
            )
        console.print(table)

    if result.by_customer:
        table = Table(title="前10大客户明细", show_header=True)
        table.add_column("客户ID")
        table.add_column("客户名称")
        table.add_column("渠道")
        table.add_column("份额", justify="right")
        table.add_column("成本", justify="right")
        table.add_column("收益", justify="right")

        for c in result.by_customer[:10]:
            table.add_row(
                c["customer_id"],
                c["customer_name"] or "-",
                c["channel_name"],
                f"{c['share_amount']:.4f}",
                f"{c['cost_value'] or 0:.2f}",
                f"{c['profit_amount'] or 0:.2f}"
            )
        console.print(table)


@calculate.command("allocate")
@click.option("--product", "product_code", required=True, help="产品代码")
@click.option("--fee-type", required=True,
              type=click.Choice(["sales_service", "销售服务费"]),
              default="sales_service",
              help="费用类型（仅支持销售服务费）")
@click.option("--start-date", required=True, help="开始日期 YYYY-MM-DD")
@click.option("--end-date", required=True, help="结束日期 YYYY-MM-DD")
@click.pass_context
def allocate_channels(ctx, product_code, fee_type, start_date, end_date):
    """渠道分摊 - 将销售服务费分摊到各个渠道"""
    calculator = FeeCalculator(db=ctx.obj["db"])
    period_start = parse_date(start_date)
    period_end = parse_date(end_date)

    with console.status("[bold green]正在进行渠道分摊..."):
        allocations = calculator.allocate_to_channels(
            product_code=product_code,
            fee_type="sales_service",
            period_start=period_start,
            period_end=period_end,
            operator=ctx.obj["operator"]
        )

    if not allocations:
        console.print("[yellow]未找到可分摊的数据，请先确认费用计算结果和客户份额数据[/yellow]")
        return

    total_amount = sum(a.allocation_amount for a in allocations)

    console.print(Panel(
        f"产品: {product_code}\n"
        f"期间: {period_start} ~ {period_end}\n"
        f"分摊总金额: {total_amount:.2f} 元\n"
        f"分摊到 {len(allocations)} 个渠道",
        title="渠道分摊结果",
        expand=False
    ))

    table = Table(title="分摊明细", show_header=True)
    table.add_column("渠道代码")
    table.add_column("渠道名称")
    table.add_column("分摊基数(份额)", justify="right")
    table.add_column("分摊比例", justify="right")
    table.add_column("分摊金额", justify="right")

    for alloc in sorted(allocations, key=lambda a: a.allocation_amount, reverse=True):
        with ctx.obj["db"].get_session() as session:
            from .models import SalesChannel
            channel = session.query(SalesChannel).filter(
                SalesChannel.id == alloc.channel_id
            ).first()

        table.add_row(
            channel.channel_code if channel else "unknown",
            channel.channel_name if channel else "未知",
            f"{alloc.allocation_basis or 0:.4f}",
            f"{alloc.allocation_ratio * 100:.2f}%",
            f"{alloc.allocation_amount:.2f}"
        )

    console.print(table)


@calculate.command("explain")
@click.option("--product", "product_code", required=True, help="产品代码")
@click.option("--fee-type", required=True,
              type=click.Choice(["management", "custodian", "sales_service", "管理费", "托管费", "销售服务费"]),
              help="费用类型")
@click.option("--start-date", required=True, help="开始日期 YYYY-MM-DD")
@click.option("--end-date", required=True, help="结束日期 YYYY-MM-DD")
@click.option("--expected", required=True, type=float, help="预期金额")
@click.pass_context
def explain_diff(ctx, product_code, fee_type, start_date, end_date, expected):
    """差异解释 - 对比预期与实际计算值，分析差异原因"""
    fee_type_map = {
        "管理费": "management",
        "托管费": "custodian",
        "销售服务费": "sales_service",
    }
    fee_type = fee_type_map.get(fee_type, fee_type)

    calculator = FeeCalculator(db=ctx.obj["db"])
    period_start = parse_date(start_date)
    period_end = parse_date(end_date)
    expected_amount = Decimal(str(expected))

    with console.status("[bold green]正在分析差异..."):
        explanation = calculator.explain_difference(
            product_code=product_code,
            fee_type=fee_type,
            period_start=period_start,
            period_end=period_end,
            expected_amount=expected_amount
        )

    console.print(Panel(
        f"产品: {product_code}\n"
        f"费用类型: {fee_type}\n"
        f"期间: {period_start} ~ {period_end}\n"
        f"预期金额: {expected_amount:.2f} 元\n"
        f"实际计算: {explanation.actual_amount:.2f} 元\n"
        f"[bold]差异金额: [/bold]"
        + (f"[green]{explanation.diff_amount:.2f}[/green]" if explanation.diff_amount >= 0
           else f"[red]{explanation.diff_amount:.2f}[/red]")
        + f" ({explanation.diff_ratio * 100:.4f}%)\n\n"
        f"[bold]结论:[/bold] {explanation.conclusion}",
        title="差异分析结果",
        expand=False
    ))

    if explanation.factors:
        table = Table(title="影响因素分析", show_header=True)
        table.add_column("因素")
        table.add_column("详情")
        table.add_column("影响")

        for factor in explanation.factors:
            table.add_row(
                factor["factor"],
                factor["value"],
                factor["impact"] or "-"
            )
        console.print(table)


@calculate.command("monthly")
@click.option("--year", type=int, required=True, help="年份")
@click.option("--month", type=int, required=True, help="月份")
@click.option("--product", "product_code", help="指定产品代码（可选）")
@click.pass_context
def calc_monthly(ctx, year, month, product_code):
    """批量计算某月所有产品的所有费用"""
    calculator = FeeCalculator(db=ctx.obj["db"])

    with console.status(f"[bold green]正在计算 {year}年{month}月 费用..."):
        results = calculator.calculate_monthly_fees(
            year=year,
            month=month,
            product_code=product_code,
            operator=ctx.obj["operator"]
        )

    if not results:
        console.print("[yellow]没有计算结果，请先导入产品和费用规则[/yellow]")
        return

    total_mgmt = sum(r.net_amount for r in results if r.fee_type == "management")
    total_cust = sum(r.net_amount for r in results if r.fee_type == "custodian")
    total_sales = sum(r.net_amount for r in results if r.fee_type == "sales_service")

    console.print(Panel(
        f"期间: {year}年{month}月\n"
        f"产品数: {len(set(r.product_code for r in results))}\n"
        f"计算记录数: {len(results)}\n"
        f"管理费合计: {total_mgmt:.2f} 元\n"
        f"托管费合计: {total_cust:.2f} 元\n"
        f"销售服务费合计: {total_sales:.2f} 元\n"
        f"[bold]总计:[/bold] {total_mgmt + total_cust + total_sales:.2f} 元",
        title="月度费用计算结果",
        expand=False
    ))

    table = Table(title="计算明细", show_header=True)
    table.add_column("产品代码")
    table.add_column("费用类型")
    table.add_column("基数(份额)", justify="right")
    table.add_column("费率", justify="right")
    table.add_column("净额", justify="right")
    table.add_column("人工调整")

    fee_name_map = {
        "management": "管理费",
        "custodian": "托管费",
        "sales_service": "销售服务费",
    }

    for r in results[:50]:
        table.add_row(
            r.product_code,
            fee_name_map.get(r.fee_type, r.fee_type),
            f"{r.calculation_basis:.4f}",
            f"{r.applied_rate * 100:.4f}%",
            f"{r.net_amount:.2f}",
            "[yellow]是[/yellow]" if r.is_manual_adjusted else "否"
        )

    if len(results) > 50:
        table.add_row("...", "...", "...", "...", "...", f"共 {len(results)} 条")

    console.print(table)


@cli.group()
def report():
    """月报管理 - 生成、导出、查看历史报告"""
    pass


@report.command("generate")
@click.option("--year", type=int, required=True, help="年份")
@click.option("--month", type=int, required=True, help="月份")
@click.option("--product", "product_code", help="指定产品代码（可选）")
@click.option("--reviewer", help="复核人")
@click.option("--no-recalc", is_flag=True, help="不重新计算，使用已有数据")
@click.pass_context
def generate_report(ctx, year, month, product_code, reviewer, no_recalc):
    """生成月度核对报告"""
    exporter = MonthlyReportExporter(db=ctx.obj["db"])

    with console.status(f"[bold green]正在生成 {year}年{month}月 报告..."):
        report_data = exporter.generate_monthly_report(
            year=year,
            month=month,
            operator=ctx.obj["operator"],
            reviewer=reviewer,
            recalculate=not no_recalc,
            product_code=product_code
        )

    s = report_data["summary"]
    console.print(Panel(
        f"报告编码: {report_data['report_code']}\n"
        f"报告ID: {report_data['report_id']}\n"
        f"期间: {report_data['period']}\n"
        f"产品数: {s['product_count']}\n"
        f"管理费: {s['total_management_fee']:.2f} 元\n"
        f"托管费: {s['total_custodian_fee']:.2f} 元\n"
        f"销售服务费: {s['total_sales_service_fee']:.2f} 元\n"
        f"费用总计: {s['grand_total']:.2f} 元\n"
        f"增值税: {s['total_tax']:.2f} 元\n"
        f"异常数: {s['anomalies']} (待处理: {s['unresolved_anomalies']})\n"
        f"人工调整: {s['manual_adjustments']} 次",
        title="报告生成成功",
        expand=False
    ))

    if s["unresolved_anomalies"] > 0:
        console.print(
            f"[yellow]警告: 存在 {s['unresolved_anomalies']} 个待处理异常，"
            "建议先解决异常后再导出报告[/yellow]"
        )


@report.command("export")
@click.option("--year", type=int, required=True, help="年份")
@click.option("--month", type=int, required=True, help="月份")
@click.option("--format", "export_format",
              type=click.Choice(["excel", "json", "both"]),
              default="excel",
              help="导出格式")
@click.option("--output", help="输出文件路径（可选）")
@click.pass_context
def export_report(ctx, year, month, export_format, output):
    """导出月度报告为 Excel 或 JSON"""
    exporter = MonthlyReportExporter(db=ctx.obj["db"])

    with console.status(f"[bold green]正在导出 {year}年{month}月 报告..."):
        report_data = exporter.generate_monthly_report(
            year=year,
            month=month,
            operator=ctx.obj["operator"],
            recalculate=False
        )

        if export_format in ["excel", "both"]:
            excel_path = exporter.export_to_excel(
                year=year,
                month=month,
                report_data=report_data,
                output_path=output if output and output.endswith(".xlsx") else None,
                operator=ctx.obj["operator"]
            )
            console.print(f"[green]Excel 报告已导出:[/green] {excel_path}")

        if export_format in ["json", "both"]:
            json_path = exporter.export_to_json(
                year=year,
                month=month,
                report_data=report_data,
                output_path=output if output and output.endswith(".json") else None,
                operator=ctx.obj["operator"]
            )
            console.print(f"[green]JSON 报告已导出:[/green] {json_path}")


@report.command("finalize")
@click.argument("report_id", type=int)
@click.option("--reviewer", required=True, help="复核人姓名")
@click.option("--signed-file", help="签字版报告文件路径")
@click.pass_context
def finalize_report(ctx, report_id, reviewer, signed_file):
    """将报告标记为定稿（不可再修改）"""
    exporter = MonthlyReportExporter(db=ctx.obj["db"])
    result = exporter.finalize_report(
        report_id=report_id,
        operator=ctx.obj["operator"],
        reviewer=reviewer,
        signed_file_path=signed_file
    )

    if result:
        console.print(
            f"[green]报告 {result['report_code']} 已定稿，状态: {result['report_status']}[/green]"
        )
    else:
        console.print(f"[red]未找到报告 ID={report_id}[/red]")


@report.command("history")
@click.option("--period", help="按期间过滤，格式 YYYY-MM")
@click.option("--limit", type=int, default=50, help="显示数量")
@click.pass_context
def report_history(ctx, period, limit):
    """查看历史报告列表"""
    exporter = MonthlyReportExporter(db=ctx.obj["db"])
    reports = exporter.get_report_history(period=period, limit=limit)

    if not reports:
        console.print("[yellow]没有历史报告[/yellow]")
        return

    table = Table(title="历史报告列表", show_header=True)
    table.add_column("ID")
    table.add_column("报告编码")
    table.add_column("期间")
    table.add_column("状态")
    table.add_column("总费用", justify="right")
    table.add_column("异常", justify="right")
    table.add_column("操作员")
    table.add_column("复核人")

    status_style = {
        "draft": "[yellow]草稿[/yellow]",
        "final": "[green]定稿[/green]",
    }

    for r in reports:
        table.add_row(
            str(r["id"]),
            r["report_code"],
            r["report_period"],
            status_style.get(r["status"], r["status"]),
            f"{r['total_fee']:.2f}",
            f"{r['unresolved_anomalies']}/{r['anomalies']}",
            r["operator"],
            r["reviewer"] or "-"
        )

    console.print(table)


@cli.group()
def history():
    """版本管理 - 查看导入批次、变更历史"""
    pass


@history.command("batches")
@click.option("--limit", type=int, default=20, help="显示数量")
@click.pass_context
def list_batches(ctx, limit):
    """查看导入批次历史"""
    db = ctx.obj["db"]
    batches = db.list_batches(limit=limit)

    if not batches:
        console.print("[yellow]没有导入批次[/yellow]")
        return

    table = Table(title="导入批次历史", show_header=True)
    table.add_column("ID")
    table.add_column("批次号")
    table.add_column("来源类型")
    table.add_column("源文件")
    table.add_column("总计", justify="right")
    table.add_column("新增", justify="right")
    table.add_column("跳过", justify="right")
    table.add_column("更新", justify="right")
    table.add_column("冲突", justify="right")
    table.add_column("操作员")
    table.add_column("导入时间")

    for b in batches:
        table.add_row(
            str(b["id"]),
            b["batch_no"],
            b["source_type"],
            b["source_file"] or "-",
            str(b["total_records"]),
            f"[green]{b['new_records']}[/green]",
            f"[yellow]{b['skip_records']}[/yellow]",
            f"[blue]{b['update_records']}[/blue]",
            f"[red]{b['conflict_records']}[/red]",
            b["operator"],
            b["import_time"].strftime("%Y-%m-%d %H:%M")
        )

    console.print(table)


@history.command("changes")
@click.option("--batch-id", type=int, help="按批次ID过滤")
@click.option("--entity-type", help="按实体类型过滤")
@click.option("--entity-id", type=int, help="按实体ID过滤")
@click.option("--limit", type=int, default=50, help="显示数量")
@click.pass_context
def list_changes(ctx, batch_id, entity_type, entity_id, limit):
    """查看变更历史"""
    db = ctx.obj["db"]
    changes = db.get_change_history(
        entity_type=entity_type,
        entity_id=entity_id,
        batch_id=batch_id,
        limit=limit
    )

    if not changes:
        console.print("[yellow]没有变更记录[/yellow]")
        return

    table = Table(title="变更历史", show_header=True)
    table.add_column("时间")
    table.add_column("类型")
    table.add_column("实体")
    table.add_column("字段")
    table.add_column("原值")
    table.add_column("新值")
    table.add_column("操作员")

    change_type_style = {
        "insert": "[green]新增[/green]",
        "update": "[blue]更新[/blue]",
        "delete": "[red]删除[/red]",
    }

    for c in changes:
        old_val = c["old_value"] or "-"
        new_val = c["new_value"] or "-"
        if len(old_val) > 30:
            old_val = old_val[:27] + "..."
        if len(new_val) > 30:
            new_val = new_val[:27] + "..."

        table.add_row(
            c["change_time"].strftime("%Y-%m-%d %H:%M"),
            change_type_style.get(c["change_type"], c["change_type"]),
            f"{c['entity_type']}#{c['entity_id']}",
            c["field_name"],
            old_val,
            new_val,
            c["operator"]
        )

    console.print(table)


@history.command("attachments")
@click.option("--entity-type", help="按实体类型过滤")
@click.option("--entity-id", type=int, help="按实体ID过滤")
@click.option("--type", "attachment_type", help="按附件类型过滤")
@click.pass_context
def list_attachments(ctx, entity_type, entity_id, attachment_type):
    """查看附件和口头备注"""
    db = ctx.obj["db"]
    attachments = db.get_attachments(
        entity_type=entity_type,
        entity_id=entity_id,
        attachment_type=attachment_type
    )

    if not attachments:
        console.print("[yellow]没有附件记录[/yellow]")
        return

    table = Table(title="附件列表", show_header=True)
    table.add_column("ID")
    table.add_column("类型")
    table.add_column("关联实体")
    table.add_column("文件名")
    table.add_column("大小")
    table.add_column("上传人")
    table.add_column("上传时间")

    for a in attachments:
        type_style = "[yellow]口头备注[/yellow]" if a["is_verbal_note"] else a["attachment_type"]
        size = f"{a['file_size']}B" if a["file_size"] else "-"
        table.add_row(
            str(a["id"]),
            type_style,
            f"{a['entity_type']}#{a['entity_id']}",
            a["file_name"],
            size,
            a["uploaded_by"],
            a["uploaded_at"].strftime("%Y-%m-%d %H:%M")
        )

    console.print(table)


@cli.command("info")
def show_info():
    """显示系统信息和数据库位置"""
    console.print(Panel(
        f"[bold]理财产品费用穿透 CLI[/bold] v1.0.0\n"
        f"数据库路径: {Config.DB_PATH}\n"
        f"导出目录: {Config.EXPORT_DIR}\n"
        f"附件目录: {Config.ATTACHMENT_DIR}\n\n"
        f"支持功能:\n"
        f"  • 数据导入（产品、费用规则、净值、渠道、份额、返费）\n"
        f"  • 增量导入检测（新增/跳过/更新/冲突）\n"
        f"  • 异常检测（费用跨期、份额口径、返费重复）\n"
        f"  • 费用试算、份额穿透、渠道分摊\n"
        f"  • 差异解释、月报导出、版本追踪",
        title="系统信息",
        expand=False
    ))


def main():
    try:
        cli(obj={})
    except Exception as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
