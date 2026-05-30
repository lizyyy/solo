import csv
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click

from .models import BillStatus
from .storage import Storage
from .calculator import CoInsuranceCalculator
from .processor import BillProcessor
from .sample_data import load_sample_data


def get_storage(data_dir: str = "./data") -> Storage:
    return Storage(data_dir=data_dir)


def get_processor(storage: Storage) -> BillProcessor:
    calculator = CoInsuranceCalculator()
    return BillProcessor(storage=storage, calculator=calculator)


def print_bill_summary(bill, verbose: bool = False) -> None:
    status_colors = {
        "normal": "green",
        "pending": "yellow",
        "exception": "red",
        "supplemented": "cyan",
        "withdrawn": "magenta",
        "resubmitted": "blue",
        "draft": "white",
    }
    color = status_colors.get(bill.status.value, "white")
    click.secho(
        f"  {bill.bill_no:20s} | {bill.claim_no:10s} | {bill.policy_no:10s} | "
        f"{bill.claim_amount:12,.2f} | {bill.deductible_amount:12,.2f} | "
        f"{bill.net_claim_amount:12,.2f} | ",
        nl=False,
    )
    click.secho(f"{bill.status.value:12s}", fg=color)

    if verbose:
        click.echo("    分摊明细:")
        for item in bill.items:
            role = "主承保" if item.is_leader else "从承保"
            confirmed = "✓" if item.confirmed else "✗"
            click.echo(
                f"      {item.insurer_name:10s} ({role}) {confirmed} | "
                f"{item.share_ratio:6.1%} | {item.payable_amount:12,.2f}"
            )
        if bill.validation_results:
            click.echo("    验证结果:")
            for v in bill.validation_results:
                severity_color = {
                    "info": "cyan",
                    "warning": "yellow",
                    "error": "red",
                }.get(v.severity.value, "white")
                click.secho(
                    f"      [{v.severity.value}] {v.code}: {v.message}",
                    fg=severity_color,
                )
        if bill.remarks:
            click.echo(f"    备注: {bill.remarks}")


@click.group()
@click.option("--data-dir", default="./data", help="数据目录路径")
@click.pass_context
def cli(ctx, data_dir: str):
    """保险共保分摊账单系统"""
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir
    ctx.obj["storage"] = get_storage(data_dir)
    ctx.obj["processor"] = get_processor(ctx.obj["storage"])


@cli.command("load-samples")
@click.pass_context
def load_samples(ctx):
    """加载样例数据"""
    storage = ctx.obj["storage"]
    load_sample_data(storage)
    click.echo("✅ 样例数据已加载")
    click.echo(f"  保单: {storage.policies.count()} 条")
    click.echo(f"  赔案: {storage.claims.count()} 条")


@cli.command("process")
@click.option("--claim-no", help="处理指定赔案号")
@click.pass_context
def process(ctx, claim_no: Optional[str]):
    """处理赔案，生成分摊账单"""
    storage = ctx.obj["storage"]
    processor = ctx.obj["processor"]

    if claim_no:
        claim = storage.claims.get(claim_no)
        if not claim:
            click.secho(f"❌ 找不到赔案号: {claim_no}", fg="red")
            sys.exit(1)
        bill = processor.process_claim(claim)
        click.echo(f"\n处理赔案: {claim_no}")
        print_bill_summary(bill, verbose=True)
    else:
        normal, pending, exception = processor.process_all_claims()
        click.echo(f"\n📊 批量处理完成")
        click.echo(f"  正常账单: {len(normal)} 条")
        click.echo(f"  待确认账单: {len(pending)} 条")
        click.echo(f"  异常账单: {len(exception)} 条")

        if normal:
            click.secho(f"\n✅ 正常明细 ({len(normal)} 条):", fg="green")
            click.echo(f"  {'账单号':20s} | {'赔案号':10s} | {'保单号':10s} | "
                       f"{'赔案金额':>12s} | {'免赔额':>12s} | {'净赔付':>12s} | 状态")
            click.echo("-" * 100)
            for bill in normal:
                print_bill_summary(bill)

        if pending:
            click.secho(f"\n⚠️  待确认清单 ({len(pending)} 条):", fg="yellow")
            click.echo(f"  {'账单号':20s} | {'赔案号':10s} | {'保单号':10s} | "
                       f"{'赔案金额':>12s} | {'免赔额':>12s} | {'净赔付':>12s} | 状态")
            click.echo("-" * 100)
            for bill in pending:
                print_bill_summary(bill, verbose=True)

        if exception:
            click.secho(f"\n❌ 异常清单 ({len(exception)} 条):", fg="red")
            click.echo(f"  {'账单号':20s} | {'赔案号':10s} | {'保单号':10s} | "
                       f"{'赔案金额':>12s} | {'免赔额':>12s} | {'净赔付':>12s} | 状态")
            click.echo("-" * 100)
            for bill in exception:
                print_bill_summary(bill, verbose=True)


@cli.command("list")
@click.option(
    "--status",
    type=click.Choice([s.value for s in BillStatus] + ["all"]),
    default="all",
    help="按状态筛选",
)
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
@click.pass_context
def list_bills(ctx, status: str, verbose: bool):
    """列出账单"""
    storage = ctx.obj["storage"]

    if status == "all":
        bills = storage.bills.get_all()
    else:
        bills = storage.bills.filter(lambda b: b.status.value == status)

    bills.sort(key=lambda b: b.bill_no)

    click.echo(f"共 {len(bills)} 条账单\n")
    click.echo(f"  {'账单号':20s} | {'赔案号':10s} | {'保单号':10s} | "
               f"{'赔案金额':>12s} | {'免赔额':>12s} | {'净赔付':>12s} | 状态")
    click.echo("-" * 100)
    for bill in bills:
        print_bill_summary(bill, verbose=verbose)


@cli.command("show")
@click.argument("bill_no")
@click.pass_context
def show_bill(ctx, bill_no: str):
    """显示账单详情"""
    storage = ctx.obj["storage"]
    bill = storage.bills.get(bill_no)
    if not bill:
        click.secho(f"❌ 找不到账单号: {bill_no}", fg="red")
        sys.exit(1)

    click.echo(f"\n📋 账单详情: {bill.bill_no}")
    click.echo("=" * 60)
    click.echo(f"  赔案号: {bill.claim_no}")
    click.echo(f"  保单号: {bill.policy_no}")
    click.echo(f"  状态: {bill.status.value}")
    click.echo(f"  版本: {bill.version}")
    if bill.previous_version_bill_no:
        click.echo(f"  上一版本: {bill.previous_version_bill_no}")
    click.echo(f"  创建时间: {bill.created_at}")
    if bill.processed_at:
        click.echo(f"  处理时间: {bill.processed_at}")
    click.echo(f"  更新时间: {bill.updated_at}")
    click.echo("")
    click.echo(f"  赔案金额: {bill.claim_amount:,.2f}")
    click.echo(f"  免赔额: {bill.deductible_amount:,.2f}")
    click.echo(f"  净赔付金额: {bill.net_claim_amount:,.2f}")
    click.echo("")
    click.echo("  分摊明细:")
    click.echo(f"    {'承保人':12s} {'角色':6s} {'确认':4s} {'比例':8s} {'应付金额':>12s}")
    click.echo("    " + "-" * 50)
    for item in bill.items:
        role = "主承保" if item.is_leader else "从承保"
        confirmed = "✓" if item.confirmed else "✗"
        click.echo(
            f"    {item.insurer_name:12s} {role:6s} {confirmed:^4s} "
            f"{item.share_ratio:7.1%} {item.payable_amount:>12,.2f}"
        )
    total = sum(i.payable_amount for i in bill.items)
    click.echo(f"    {'合计':12s} {'':6s} {'':4s} {'100%':>7s} {total:>12,.2f}")

    if bill.validation_results:
        click.echo(f"\n  验证结果 ({len(bill.validation_results)} 条):")
        for v in bill.validation_results:
            severity_color = {
                "info": "cyan",
                "warning": "yellow",
                "error": "red",
            }.get(v.severity.value, "white")
            click.secho(
                f"    [{v.severity.value:>7s}] {v.code:20s} - {v.message}",
                fg=severity_color,
            )

    if bill.remarks:
        click.echo(f"\n  备注: {bill.remarks}")


@cli.command("confirm")
@click.argument("bill_no")
@click.option("--insurer-id", help="指定承保人ID确认")
@click.pass_context
def confirm(ctx, bill_no: str, insurer_id: Optional[str]):
    """确认账单或承保人"""
    processor = ctx.obj["processor"]

    if insurer_id:
        bill = processor.confirm_insurer(bill_no, insurer_id)
        if bill:
            click.echo(f"✅ 承保人 {insurer_id} 已确认账单 {bill_no}")
            if bill.status == BillStatus.NORMAL:
                click.secho("  所有承保人已确认，账单状态更新为正常", fg="green")
        else:
            click.secho(f"❌ 找不到账单号: {bill_no}", fg="red")
            sys.exit(1)
    else:
        bill = processor.confirm_bill(bill_no)
        if bill:
            click.echo(f"✅ 账单 {bill_no} 已确认，当前状态: {bill.status.value}")
        else:
            click.secho(f"❌ 找不到账单号: {bill_no}", fg="red")
            sys.exit(1)


@cli.command("withdraw")
@click.argument("bill_no")
@click.option("--reason", default="", help="撤回原因")
@click.pass_context
def withdraw(ctx, bill_no: str, reason: str):
    """撤回账单"""
    processor = ctx.obj["processor"]
    bill = processor.withdraw_bill(bill_no, reason)
    if bill:
        click.echo(f"✅ 账单 {bill_no} 已撤回")
        if reason:
            click.echo(f"  原因: {reason}")
    else:
        click.secho(f"❌ 找不到账单号: {bill_no}", fg="red")
        sys.exit(1)


@cli.command("recalculate")
@click.argument("bill_no")
@click.pass_context
def recalculate(ctx, bill_no: str):
    """重新计算账单"""
    processor = ctx.obj["processor"]
    bill = processor.recalculate_bill(bill_no)
    if bill:
        click.echo(f"✅ 账单 {bill_no} 已重新计算")
        click.echo(f"  新版本: {bill.version}")
        click.echo(f"  新状态: {bill.status.value}")
    else:
        click.secho(f"❌ 找不到账单号: {bill_no}", fg="red")
        sys.exit(1)


@cli.command("export")
@click.option("--output-dir", default="./exports", help="导出目录")
@click.option(
    "--format",
    "export_format",
    type=click.Choice(["csv", "json"]),
    default="csv",
    help="导出格式",
)
@click.option(
    "--status",
    type=click.Choice([s.value for s in BillStatus] + ["all"]),
    default="all",
    help="按状态筛选导出",
)
@click.pass_context
def export(ctx, output_dir: str, export_format: str, status: str):
    """导出门店账单"""
    storage = ctx.obj["storage"]
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    if status == "all":
        bills = storage.bills.get_all()
    else:
        bills = storage.bills.filter(lambda b: b.status.value == status)

    bills.sort(key=lambda b: b.bill_no)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    normal_bills = [b for b in bills if b.status in [BillStatus.NORMAL, BillStatus.SUPPLEMENTED, BillStatus.RESUBMITTED]]
    pending_bills = [b for b in bills if b.status == BillStatus.PENDING]
    exception_bills = [b for b in bills if b.status in [BillStatus.EXCEPTION, BillStatus.WITHDRAWN, BillStatus.DRAFT]]

    if export_format == "csv":
        def export_to_csv(bills_list, filename):
            if not bills_list:
                return
            filepath = output_path / filename
            with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "账单号", "赔案号", "保单号", "状态", "版本",
                    "赔案金额", "免赔额", "净赔付金额",
                    "承保人ID", "承保人名称", "角色", "比例", "应付金额", "是否确认",
                    "创建时间", "处理时间", "备注"
                ])
                for bill in bills_list:
                    for item in bill.items:
                        writer.writerow([
                            bill.bill_no,
                            bill.claim_no,
                            bill.policy_no,
                            bill.status.value,
                            bill.version,
                            bill.claim_amount,
                            bill.deductible_amount,
                            bill.net_claim_amount,
                            item.insurer_id,
                            item.insurer_name,
                            "主承保" if item.is_leader else "从承保",
                            f"{item.share_ratio:.4%}",
                            item.payable_amount,
                            "是" if item.confirmed else "否",
                            bill.created_at.isoformat(),
                            bill.processed_at.isoformat() if bill.processed_at else "",
                            bill.remarks or "",
                        ])
            click.echo(f"  ✅ 导出 {filename}: {len(bills_list)} 条")

        export_to_csv(normal_bills, f"normal_bills_{status}_{timestamp}.csv")
        export_to_csv(pending_bills, f"pending_bills_{status}_{timestamp}.csv")
        export_to_csv(exception_bills, f"exception_bills_{status}_{timestamp}.csv")

        total_amount = sum(b.net_claim_amount for b in bills)
        summary_file = output_path / f"summary_{status}_{timestamp}.csv"
        with open(summary_file, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["分类", "账单数", "净赔付合计"])
            writer.writerow(["正常", len(normal_bills), sum(b.net_claim_amount for b in normal_bills)])
            writer.writerow(["待确认", len(pending_bills), sum(b.net_claim_amount for b in pending_bills)])
            writer.writerow(["异常", len(exception_bills), sum(b.net_claim_amount for b in exception_bills)])
            writer.writerow(["合计", len(bills), total_amount])
        click.echo(f"  ✅ 导出汇总表: summary_{status}_{timestamp}.csv")

    else:
        def export_to_json(bills_list, filename):
            if not bills_list:
                return
            filepath = output_path / filename
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(
                    [b.model_dump(mode="json") for b in bills_list],
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            click.echo(f"  ✅ 导出 {filename}: {len(bills_list)} 条")

        export_to_json(normal_bills, f"normal_bills_{status}_{timestamp}.json")
        export_to_json(pending_bills, f"pending_bills_{status}_{timestamp}.json")
        export_to_json(exception_bills, f"exception_bills_{status}_{timestamp}.json")

        total_amount = sum(b.net_claim_amount for b in bills)
        summary = {
            "export_time": datetime.now().isoformat(),
            "status_filter": status,
            "counts": {
                "normal": len(normal_bills),
                "pending": len(pending_bills),
                "exception": len(exception_bills),
                "total": len(bills),
            },
            "amounts": {
                "normal": sum(b.net_claim_amount for b in normal_bills),
                "pending": sum(b.net_claim_amount for b in pending_bills),
                "exception": sum(b.net_claim_amount for b in exception_bills),
                "total": total_amount,
            },
        }
        summary_file = output_path / f"summary_{status}_{timestamp}.json"
        with open(summary_file, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        click.echo(f"  ✅ 导出汇总表: summary_{status}_{timestamp}.json")

    click.echo(f"\n📁 导出完成，共 {len(bills)} 条账单")
    click.echo(f"  导出目录: {output_path.resolve()}")


@cli.command("stats")
@click.pass_context
def stats(ctx):
    """查看统计信息"""
    storage = ctx.obj["storage"]
    stats_data = storage.get_stats()

    click.echo("\n📊 系统统计")
    click.echo("=" * 40)
    click.echo(f"  保单总数: {stats_data['policies']}")
    click.echo(f"  赔案总数: {stats_data['claims']}")
    click.echo(f"  账单总数: {stats_data['bills']}")
    click.echo("")
    click.echo("  账单状态分布:")
    for status, count in stats_data["bills_by_status"].items():
        click.echo(f"    {status:15s}: {count}")
    click.echo("")
    click.echo("  金额统计:")
    amounts = stats_data["amounts"]
    click.echo(f"    正常账单: {amounts['normal']:,.2f}")
    click.echo(f"    待确认账单: {amounts['pending']:,.2f}")
    click.echo(f"    异常账单: {amounts['exception']:,.2f}")
    click.echo(f"    {'合计':>10s}: {amounts['all']:,.2f}")


@cli.command("clear")
@click.option("--yes", is_flag=True, help="确认清除")
@click.pass_context
def clear_data(ctx, yes: bool):
    """清除所有数据"""
    if not yes:
        click.confirm("⚠️  确定要清除所有数据吗？此操作不可恢复！", abort=True)

    storage = ctx.obj["storage"]
    bill_count = storage.bills.count()
    claim_count = storage.claims.count()
    policy_count = storage.policies.count()

    storage.bills.clear()
    storage.claims.clear()
    storage.policies.clear()
    storage.audit_log.clear()

    storage.log_action(
        action="DATA_CLEARED",
        details={
            "bills_cleared": bill_count,
            "claims_cleared": claim_count,
            "policies_cleared": policy_count,
        },
    )

    click.echo("✅ 数据已清除")
    click.echo(f"  清除保单: {policy_count} 条")
    click.echo(f"  清除赔案: {claim_count} 条")
    click.echo(f"  清除账单: {bill_count} 条")


@cli.command("reload")
@click.pass_context
def reload_data(ctx):
    """从磁盘重新加载数据（模拟重启）"""
    storage = ctx.obj["storage"]
    storage.reload()
    click.echo("✅ 数据已从磁盘重新加载")
    stats_data = storage.get_stats()
    click.echo(f"  保单: {stats_data['policies']} 条")
    click.echo(f"  赔案: {stats_data['claims']} 条")
    click.echo(f"  账单: {stats_data['bills']} 条")
    click.echo(f"  总金额: {stats_data['amounts']['all']:,.2f}")


def main():
    cli(obj={})


if __name__ == "__main__":
    main()
