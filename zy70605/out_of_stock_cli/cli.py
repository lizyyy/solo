#!/usr/bin/env python3
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click

from .models import CompensationType
from .parsers import (
    BatchParser,
    OrderParser,
    OutOfStockParser,
    CompensationParser,
    ConfirmationParser,
)
from .engines import (
    AllocationEngine,
    CompensationStateMachine,
    IdempotencyEngine,
)
from .tracker import InventoryTracker, SourceTracker
from .reports import SettlementReport, ConsistencyChecker
from .utils import DataValidator


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """缺货补偿库存回写结算一致性排查CLI"""
    pass


@cli.command()
@click.option("--batch-file", "-b", required=True, type=click.Path(exists=True), help="批次数据文件 (Excel/CSV)")
@click.option("--order-file", "-o", required=True, type=click.Path(exists=True), help="订单数据文件 (Excel/CSV)")
@click.option("--oos-file", "-s", required=True, type=click.Path(exists=True), help="缺货数据文件 (Excel/CSV)")
@click.option("--conf-file", "-c", type=click.Path(exists=True), help="用户确认文件 (Excel/CSV)")
@click.option("--plan-file", "-p", type=click.Path(exists=True), help="已有补偿方案文件 (Excel/CSV)")
@click.option("--default-type", "-t", type=click.Choice(["refund", "points", "exchange"]), default="refund", help="默认补偿类型")
@click.option("--output-dir", "-d", type=click.Path(), default="./output", help="输出目录")
@click.option("--output-name", "-n", type=str, default=None, help="输出文件名 (不含扩展名)")
def run(
    batch_file: str,
    order_file: str,
    oos_file: str,
    conf_file: Optional[str],
    plan_file: Optional[str],
    default_type: str,
    output_dir: str,
    output_name: Optional[str],
):
    """运行完整的缺货补偿结算流程"""
    click.echo(click.style("=" * 60, fg="blue"))
    click.echo(click.style("缺货补偿库存回写结算一致性排查", fg="blue", bold=True))
    click.echo(click.style("=" * 60, fg="blue"))
    click.echo()

    os.makedirs(output_dir, exist_ok=True)

    bad_rows = []

    try:
        click.echo(click.style("[1/7] 解析输入文件...", fg="cyan"))
        batches, batch_bad = BatchParser(batch_file).parse()
        bad_rows.extend(batch_bad)
        click.echo(f"  批次: {len(batches)} 条, 错误: {len(batch_bad)} 行")

        orders, order_bad = OrderParser(order_file).parse()
        bad_rows.extend(order_bad)
        click.echo(f"  订单: {len(orders)} 条, 错误: {len(order_bad)} 行")

        out_of_stocks, oos_bad = OutOfStockParser(oos_file).parse()
        bad_rows.extend(oos_bad)
        click.echo(f"  缺货: {len(out_of_stocks)} 条, 错误: {len(oos_bad)} 行")

        confirmations = []
        if conf_file:
            confirmations, conf_bad = ConfirmationParser(conf_file).parse()
            bad_rows.extend(conf_bad)
            click.echo(f"  用户确认: {len(confirmations)} 条, 错误: {len(conf_bad)} 行")

        plans = []
        if plan_file:
            plans, plan_bad = CompensationParser(plan_file).parse()
            bad_rows.extend(plan_bad)
            click.echo(f"  补偿方案: {len(plans)} 条, 错误: {len(plan_bad)} 行")

        click.echo()

        click.echo(click.style("[2/7] 幂等性检查...", fg="cyan"))
        idempotency = IdempotencyEngine()
        if plans:
            plans, plan_duplicates = idempotency.check_plan_idempotency(plans)
            if plan_duplicates:
                click.echo(click.style(f"  发现重复方案: {len(plan_duplicates)} 条", fg="yellow"))

        if confirmations:
            confirmations, conf_duplicates = idempotency.check_confirmation_idempotency(confirmations)
            if conf_duplicates:
                click.echo(click.style(f"  发现重复确认: {len(conf_duplicates)} 条", fg="yellow"))
        click.echo("  幂等性检查完成")
        click.echo()

        click.echo(click.style("[3/7] 缺货分摊...", fg="cyan"))
        comp_type = CompensationType(default_type)
        allocation = AllocationEngine(orders, out_of_stocks)
        if not plans:
            result = allocation.allocate(default_compensation_type=comp_type)
            plans = result.plans
            click.echo(f"  生成补偿方案: {result.summary['total_plans']} 条")
            click.echo(f"    退款: {result.summary['refund_count']} 条")
            click.echo(f"    换货: {result.summary['exchange_count']} 条")
            click.echo(f"    积分: {result.summary['points_count']} 条")
        else:
            click.echo(f"  使用已有补偿方案: {len(plans)} 条")
        click.echo()

        click.echo(click.style("[4/7] 状态机处理...", fg="cyan"))
        state_machine = CompensationStateMachine(plans)
        if confirmations:
            errors = state_machine.apply_confirmations(confirmations)
            if errors:
                for err in errors[:5]:
                    click.echo(click.style(f"  {err}", fg="yellow"))
                if len(errors) > 5:
                    click.echo(click.style(f"  ... 共 {len(errors)} 条状态转换错误", fg="yellow"))

        processed_count, process_errors = state_machine.process_all_confirmed()
        click.echo(f"  已处理方案: {processed_count} 条")
        click.echo()

        click.echo(click.style("[5/7] 库存回写...", fg="cyan"))
        inventory_tracker = InventoryTracker(orders)
        write_backs = inventory_tracker.calculate_write_backs(plans)
        inv_summary = inventory_tracker.get_inventory_summary()
        click.echo(f"  回写总数量: {inv_summary['total_write_back']} 件")
        click.echo(f"  涉及SKU: {inv_summary['affected_skus']} 个")
        click.echo()

        click.echo(click.style("[6/7] 来源追踪...", fg="cyan"))
        source_tracker = SourceTracker(batches, orders, out_of_stocks)
        for plan in plans:
            confirmation = None
            for conf in confirmations:
                if (
                    conf.order_id == plan.order_id
                    and conf.sku_id == plan.sku_id
                    and conf.user_id == plan.user_id
                ):
                    confirmation = conf
                    break
            source_tracker.create_trail(plan, confirmation)
        click.echo(f"  生成追踪记录: {len(source_tracker.trails)} 条")
        click.echo()

        click.echo(click.style("[7/7] 生成报告...", fg="cyan"))
        report = SettlementReport(plans, source_tracker)
        settlements = report.generate_records()
        summary = report.get_summary()

        checker = ConsistencyChecker(
            batches, orders, out_of_stocks, plans, confirmations, settlements
        )
        is_consistent, issues = checker.check_all()

        if output_name:
            output_file = os.path.join(output_dir, f"{output_name}.xlsx")
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = os.path.join(output_dir, f"settlement_report_{timestamp}.xlsx")

        report.export_to_excel(output_file, bad_rows)
        click.echo(f"  报告已保存到: {output_file}")
        click.echo()

        click.echo(click.style("=" * 60, fg="green"))
        click.echo(click.style("处理完成!", fg="green", bold=True))
        click.echo(click.style("=" * 60, fg="green"))
        click.echo()
        click.echo(click.style("结算摘要:", fg="green", bold=True))
        click.echo(f"  结算记录: {summary['total_records']} 条")
        click.echo(f"  总数量: {summary['total_quantity']} 件")
        click.echo(f"  总金额: ¥{summary['total_amount']:.2f}")
        click.echo()
        click.echo(click.style("一致性检查:", fg="green", bold=True))
        if is_consistent:
            click.echo(click.style("  全部通过 ✓", fg="green"))
        else:
            click.echo(click.style(f"  发现问题: {len(issues)} 个", fg="red"))
            for issue in issues:
                level = click.style(issue["level"], fg="red" if issue["level"] == "ERROR" else "yellow")
                click.echo(f"  [{level}] {issue['type']}: {issue['message']}")
        click.echo()
        if bad_rows:
            click.echo(click.style(f"错误记录: {len(bad_rows)} 行 (已保存到报告中)", fg="yellow"))

    except Exception as e:
        click.echo(click.style(f"错误: {str(e)}", fg="red", bold=True))
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option("--batch-file", "-b", required=True, type=click.Path(exists=True), help="批次数据文件")
@click.option("--order-file", "-o", required=True, type=click.Path(exists=True), help="订单数据文件")
@click.option("--oos-file", "-s", required=True, type=click.Path(exists=True), help="缺货数据文件")
@click.option("--plan-file", "-p", type=click.Path(exists=True), help="补偿方案文件")
@click.option("--conf-file", "-c", type=click.Path(exists=True), help="用户确认文件")
def validate(
    batch_file: str,
    order_file: str,
    oos_file: str,
    plan_file: Optional[str],
    conf_file: Optional[str],
):
    """验证数据文件的一致性"""
    click.echo("正在验证数据文件...")

    batches, _ = BatchParser(batch_file).parse()
    orders, _ = OrderParser(order_file).parse()
    out_of_stocks, _ = OutOfStockParser(oos_file).parse()

    plans = []
    confirmations = []
    if plan_file:
        plans, _ = CompensationParser(plan_file).parse()
    if conf_file:
        confirmations, _ = ConfirmationParser(conf_file).parse()

    validator = DataValidator()
    is_valid, errors = validator.validate_all(batches, orders, out_of_stocks, plans, confirmations)

    if is_valid:
        click.echo(click.style("验证通过 ✓", fg="green"))
    else:
        click.echo(click.style(f"发现 {len(errors)} 个问题:", fg="red"))
        for err in errors:
            click.echo(f"  - {err}")
        sys.exit(1)


def main():
    cli()


if __name__ == "__main__":
    main()
