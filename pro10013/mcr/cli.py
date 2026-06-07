import click
from tabulate import tabulate
from typing import Optional

from .database import Database
from .importer import DataImporter
from .services import ReviewService
from .models import RecordStatus, SkipReason, ReviewResult


DB_PATH = "mcr.db"


def get_db():
    return Database(DB_PATH)


def get_importer():
    return DataImporter(get_db())


def get_service():
    return ReviewService(get_db())


SKIP_REASON_NAMES = {
    "missing_field": "缺项",
    "duplicate": "重复记录",
    "caliber_mismatch": "口径不一致",
    "multi_account": "同一客户多账号",
    "cross_settlement_refund": "退款跨清算日",
    "other": "其他",
}

STATUS_NAMES = {
    "pending": "待处理",
    "normal": "正常",
    "skipped": "已跳过",
    "need_review": "待复核",
    "manual_fixed": "人工修正",
}


@click.group()
@click.version_option(version="0.1.0", prog_name="mcr")
def cli():
    """券商两融担保品复核工具"""
    pass


@cli.command(name="import")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--user", "-u", help="导入人")
def import_cmd(file_path, user):
    """导入数据文件（CSV/JSON）"""
    importer = get_importer()
    try:
        batch, warnings = importer.import_file(file_path, user)
        click.echo(click.style(f"✓ 导入成功", fg="green", bold=True))
        click.echo(f"批次号: {batch.batch_id}")
        click.echo(f"文件名: {batch.file_name}")
        click.echo()

        stats = [
            ["总记录数", batch.total_count],
            ["正常记录", click.style(str(batch.normal_count), fg="green")],
            ["跳过记录", click.style(str(batch.skipped_count), fg="yellow")],
            ["需复核记录", click.style(str(batch.need_review_count), fg="red")],
        ]
        click.echo(tabulate(stats, tablefmt="simple"))
        click.echo()

        if batch.skip_reason_summary:
            click.echo(click.style("跳过原因统计:", bold=True))
            reason_stats = []
            for reason, count in batch.skip_reason_summary.items():
                reason_stats.append([SKIP_REASON_NAMES.get(reason, reason), count])
            click.echo(tabulate(reason_stats, tablefmt="simple"))
            click.echo()

        if warnings:
            click.echo(click.style("警告:", fg="yellow"))
            for w in warnings:
                click.echo(f"  - {w}")

        click.echo(f"\n使用 'mcr list {batch.batch_id}' 查看该批次记录")
    except Exception as e:
        click.echo(click.style(f"✗ 导入失败: {e}", fg="red", bold=True), err=True)
        raise click.Abort()


@cli.command(name="batches")
def list_batches():
    """列出所有导入批次"""
    service = get_service()
    batches = service.get_all_batches()
    if not batches:
        click.echo("暂无导入批次")
        return

    rows = []
    for b in batches:
        rows.append([
            b.batch_id,
            b.file_name,
            b.total_count,
            b.normal_count,
            click.style(str(b.skipped_count), fg="yellow"),
            click.style(str(b.need_review_count), fg="red"),
            b.created_at[:19] if b.created_at else "",
        ])

    headers = ["批次号", "文件名", "总数", "正常", "跳过", "需复核", "导入时间"]
    click.echo(tabulate(rows, headers=headers, tablefmt="simple"))


@cli.command()
@click.argument("batch_id", required=False)
@click.option("--status", "-s", type=click.Choice(["normal", "skipped", "pending", "need_review", "manual_fixed"]),
              help="按状态筛选")
@click.option("--skip-reason", "-r",
              type=click.Choice(list(SKIP_REASON_NAMES.keys())),
              help="按跳过原因筛选")
@click.option("--limit", "-n", type=int, default=20, help="显示数量，默认20")
def list(batch_id, status, skip_reason, limit):
    """列出记录，可按批次、状态、跳过原因筛选"""
    service = get_service()
    db = get_db()

    if batch_id and not status and not skip_reason:
        records = db.get_records_by_batch(batch_id)
    elif status:
        records = db.get_records_by_status(status, batch_id)
    elif skip_reason:
        records = db.get_records_by_skip_reason(skip_reason, batch_id)
    else:
        batches = service.get_all_batches()
        if batches:
            records = db.get_records_by_batch(batches[0].batch_id)
        else:
            records = []

    if not records:
        click.echo("暂无记录")
        return

    records = records[:limit]

    rows = []
    for r in records:
        status_display = STATUS_NAMES.get(r.status, r.status)
        if r.status == "skipped":
            status_display = click.style(status_display, fg="yellow")
        elif r.status == "normal":
            status_display = click.style(status_display, fg="green")
        elif r.status == "manual_fixed":
            status_display = click.style(status_display, fg="cyan")

        skip_reason_display = ""
        if r.skip_reason:
            reasons = [SKIP_REASON_NAMES.get(x, x) for x in r.skip_reason.split(",")]
            skip_reason_display = ", ".join(reasons)

        rows.append([
            r.id,
            r.client_id,
            r.client_name[:8] if len(r.client_name) > 8 else r.client_name,
            r.collateral_code,
            r.collateral_name[:8] if len(r.collateral_name) > 8 else r.collateral_name,
            f"{r.market_value:,.0f}",
            status_display,
            skip_reason_display[:15],
        ])

    headers = ["ID", "客户ID", "客户名称", "证券代码", "证券名称", "市值", "状态", "跳过原因"]
    click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
    click.echo(f"\n共 {len(records)} 条记录（最多显示 {limit} 条）")


@cli.command()
@click.argument("record_id", type=int)
def show(record_id):
    """查看单条记录详情及历史"""
    service = get_service()
    detail = service.get_record_detail(record_id)
    if not detail:
        click.echo(click.style(f"记录 {record_id} 不存在", fg="red"), err=True)
        raise click.Abort()

    r = detail["record"]
    click.echo(click.style(f"=== 记录 #{r.id} ===", bold=True))

    info_rows = [
        ["批次号", r.batch_id],
        ["客户ID", r.client_id],
        ["客户名称", r.client_name],
        ["账号", r.account_id],
        ["证券代码", r.collateral_code],
        ["证券名称", r.collateral_name],
        ["证券类型", r.collateral_type],
        ["数量", f"{r.quantity:,.0f}"],
        ["市值", f"{r.market_value:,.2f}"],
        ["折算率", f"{r.collateral_ratio:.4f}" if r.collateral_ratio else ""],
        ["可用担保品", f"{r.available_collateral:,.2f}"],
        ["交易日", r.trade_date],
        ["清算日", r.settlement_date],
        ["是否退款", "是" if r.is_refund else "否"],
        ["来源系统", r.source_system],
        ["状态", STATUS_NAMES.get(r.status, r.status)],
    ]
    click.echo(tabulate(info_rows, tablefmt="simple"))
    click.echo()

    if r.skip_reason:
        reasons = [SKIP_REASON_NAMES.get(x, x) for x in r.skip_reason.split(",")]
        click.echo(click.style("跳过原因: ", fg="yellow", bold=True) + ", ".join(reasons))
    if r.skip_detail:
        click.echo(click.style("跳过详情: ", fg="yellow", bold=True) + r.skip_detail)
    click.echo()

    if r.review_result:
        click.echo(click.style("复核结果: ", bold=True) + r.review_result)
        if r.review_comment:
            click.echo(click.style("复核意见: ", bold=True) + r.review_comment)
        if r.reviewer:
            click.echo(click.style("复核人: ", bold=True) + r.reviewer)
        if r.review_time:
            click.echo(click.style("复核时间: ", bold=True) + r.review_time)
    if r.is_manual_overridden:
        click.echo(click.style("⚠ 此记录已人工改判", fg="red", bold=True))
        if r.previous_review_comment:
            click.echo(click.style("原理由: ", fg="yellow") + r.previous_review_comment)
    click.echo()

    if detail["history"]:
        click.echo(click.style("=== 变更历史 ===", bold=True))
        hist_rows = []
        for h in detail["history"]:
            hist_rows.append([
                h.operation_time[:19] if h.operation_time else "",
                h.operation_type,
                h.operator or "",
                h.new_status or "",
                h.new_review_result or "",
                h.new_review_comment or "",
                h.remark or "",
            ])
        headers = ["时间", "操作类型", "操作人", "新状态", "新结果", "新意见", "备注"]
        click.echo(tabulate(hist_rows, headers=headers, tablefmt="simple"))


@cli.command()
@click.argument("record_id", type=int)
@click.option("--result", "-r", required=True,
              type=click.Choice(["pass", "reject", "need_further_check"]),
              help="复核结果")
@click.option("--comment", "-c", help="复核意见")
@click.option("--user", "-u", help="复核人")
@click.option("--override/--no-override", default=False,
              help="是否人工改判（覆盖跳过状态）")
def review(record_id, result, comment, user, override):
    """复核记录"""
    service = get_service()
    success = service.review_record(record_id, result, comment, user, override)
    if success:
        click.echo(click.style(f"✓ 记录 {record_id} 复核成功", fg="green", bold=True))
        if override:
            click.echo(click.style("  已人工改判，原跳过理由已保存", fg="cyan"))
    else:
        click.echo(click.style(f"✗ 复核失败，记录不存在", fg="red", bold=True), err=True)
        raise click.Abort()


@cli.command()
@click.argument("record_id", type=int)
@click.option("--field", "-f", multiple=True, help="字段名=值，可多次指定，如 -f quantity=1000")
@click.option("--user", "-u", help="操作人")
def fix(record_id, field, user):
    """修正跳过记录的字段值"""
    if not field:
        click.echo(click.style("请指定要修正的字段，使用 -f 字段名=值", fg="red"), err=True)
        raise click.Abort()

    field_updates = {}
    for f in field:
        if "=" not in f:
            click.echo(click.style(f"字段格式错误: {f}，应为 字段名=值", fg="red"), err=True)
            raise click.Abort()
        key, value = f.split("=", 1)
        key = key.strip()
        value = value.strip()
        try:
            if key in ["quantity", "market_value", "collateral_ratio", "available_collateral"]:
                value = float(value)
            elif key == "is_refund":
                value = value.lower() in ["true", "1", "是", "yes"]
        except ValueError:
            pass
        field_updates[key] = value

    service = get_service()
    success = service.fix_skipped_record(record_id, field_updates, user)
    if success:
        click.echo(click.style(f"✓ 记录 {record_id} 修正成功", fg="green", bold=True))
        click.echo(f"  修正字段: {', '.join(field_updates.keys())}")
    else:
        click.echo(click.style(f"✗ 修正失败，记录不存在", fg="red", bold=True), err=True)
        raise click.Abort()


@cli.command(name="special")
@click.argument("type", type=click.Choice(["multi-account", "cross-refund", "manual-override"]))
@click.option("--batch-id", "-b", help="批次号")
def list_special(type, batch_id):
    """列出特殊场景记录：多账号、跨清算日退款、人工改判"""
    service = get_service()

    if type == "multi-account":
        groups = service.get_multi_account_groups(batch_id)
        if not groups:
            click.echo("暂无多账号记录")
            return
        click.echo(click.style("=== 同一客户多账号记录 ===", bold=True))
        for client_id, records in groups.items():
            click.echo(f"\n客户 {client_id} ({records[0].client_name}) 共 {len(records)} 个账号:")
            rows = []
            for r in records:
                rows.append([r.id, r.account_id, r.collateral_code, f"{r.market_value:,.0f}"])
            click.echo(tabulate(rows, headers=["ID", "账号", "证券代码", "市值"], tablefmt="simple"))

    elif type == "cross-refund":
        records = service.get_cross_settlement_refunds(batch_id)
        if not records:
            click.echo("暂无跨清算日退款记录")
            return
        click.echo(click.style("=== 退款跨清算日记录 ===", bold=True))
        rows = []
        for r in records:
            rows.append([
                r.id, r.client_id, r.client_name,
                r.collateral_code, f"{r.market_value:,.0f}",
                r.trade_date, r.settlement_date
            ])
        headers = ["ID", "客户ID", "客户名称", "证券代码", "市值", "交易日", "清算日"]
        click.echo(tabulate(rows, headers=headers, tablefmt="simple"))

    elif type == "manual-override":
        records = service.get_manual_overridden_records(batch_id)
        if not records:
            click.echo("暂无人工改判记录")
            return
        click.echo(click.style("=== 人工改判记录 ===", bold=True))
        rows = []
        for r in records:
            rows.append([
                r.id, r.client_id, r.client_name,
                r.collateral_code, f"{r.market_value:,.0f}",
                r.review_result or "",
                r.reviewer or "",
            ])
        headers = ["ID", "客户ID", "客户名称", "证券代码", "市值", "复核结果", "复核人"]
        click.echo(tabulate(rows, headers=headers, tablefmt="simple"))


@cli.command()
@click.argument("batch_id")
def stats(batch_id):
    """查看批次统计信息"""
    service = get_service()
    stats = service.get_batch_statistics(batch_id)
    if not stats:
        click.echo(click.style(f"批次 {batch_id} 不存在", fg="red"), err=True)
        raise click.Abort()

    click.echo(click.style(f"=== 批次统计 {stats['batch_id']} ===", bold=True))
    click.echo(f"文件名: {stats['file_name']}")
    click.echo(f"导入时间: {stats['created_at'][:19]}")
    if stats.get("import_user"):
        click.echo(f"导入人: {stats['import_user']}")
    click.echo()

    main_stats = [
        ["总记录数", stats["total_count"]],
        ["正常记录", click.style(str(stats["normal_count"]), fg="green")],
        ["跳过记录", click.style(str(stats["skipped_count"]), fg="yellow")],
        ["需复核记录", click.style(str(stats["need_review_count"]), fg="red")],
        ["人工修正", click.style(str(stats["manual_fixed_count"]), fg="cyan")],
    ]
    click.echo(tabulate(main_stats, tablefmt="simple"))
    click.echo()

    if stats["skip_reason_breakdown"]:
        click.echo(click.style("跳过原因明细:", bold=True))
        reason_rows = []
        for reason, count in stats["skip_reason_breakdown"].items():
            reason_rows.append([SKIP_REASON_NAMES.get(reason, reason), count])
        click.echo(tabulate(reason_rows, tablefmt="simple"))
        click.echo()

    if stats["review_result_breakdown"]:
        click.echo(click.style("复核结果明细:", bold=True))
        result_rows = []
        for result, count in stats["review_result_breakdown"].items():
            result_rows.append([result, count])
        click.echo(tabulate(result_rows, tablefmt="simple"))


@cli.command()
@click.argument("output_path")
@click.option("--batch-id", "-b", help="导出指定批次")
@click.option("--status", "-s", help="按状态导出")
@click.option("--skip-reason", "-r", help="按跳过原因导出")
@click.option("--format", "-f", type=click.Choice(["csv", "json"]), default="csv",
              help="导出格式，默认csv")
@click.option("--need-review", is_flag=True, help="仅导出需复核的记录")
def export(output_path, batch_id, status, skip_reason, format, need_review):
    """导出记录"""
    service = get_service()

    if need_review and batch_id:
        count = service.export_need_review(batch_id, output_path, format)
    else:
        count = service.export_records(output_path, batch_id, status, skip_reason, format)

    if count > 0:
        click.echo(click.style(f"✓ 已导出 {count} 条记录到 {output_path}", fg="green", bold=True))
    else:
        click.echo("没有符合条件的记录可导出")


@cli.command()
@click.option("--output", "-o", default="sample_data.csv", help="输出文件名")
@click.option("--format", "-f", type=click.Choice(["csv", "json"]), default="csv",
              help="样例数据格式")
def sample(output, format):
    """生成包含各种问题的样例数据"""
    import os
    import json as json_lib
    import csv as csv_lib

    sample_records = [
        {
            "客户编号": "C001", "客户名称": "张三", "账号": "A001001",
            "证券代码": "600000", "证券名称": "浦发银行", "证券类型": "股票",
            "数量": "10000", "市值": "85000", "折算率": "0.7",
            "可用担保品": "59500", "交易日": "2024-01-15", "清算日": "2024-01-16",
            "是否退款": "否", "来源系统": "柜台系统"
        },
        {
            "客户编号": "C002", "客户名称": "李四", "账号": "A002001",
            "证券代码": "000001", "证券名称": "平安银行", "证券类型": "股票",
            "数量": "5000", "市值": "55000", "折算率": "0.65",
            "可用担保品": "35750", "交易日": "2024-01-15", "清算日": "2024-01-16",
            "是否退款": "否", "来源系统": "柜台系统"
        },
        {
            "客户编号": "C001", "客户名称": "张三", "账号": "A001002",
            "证券代码": "601318", "证券名称": "中国平安", "证券类型": "股票",
            "数量": "2000", "市值": "96000", "折算率": "0.7",
            "可用担保品": "67200", "交易日": "2024-01-15", "清算日": "2024-01-16",
            "是否退款": "否", "来源系统": "两融系统"
        },
        {
            "客户编号": "C003", "客户名称": "王五", "账号": "A003001",
            "证券代码": "", "证券名称": "贵州茅台", "证券类型": "股票",
            "数量": "100", "市值": "180000", "折算率": "0.6",
            "可用担保品": "108000", "交易日": "2024-01-15", "清算日": "2024-01-16",
            "是否退款": "否", "来源系统": "柜台系统"
        },
        {
            "客户编号": "C004", "客户名称": "赵六", "账号": "A004001",
            "证券代码": "600519", "证券名称": "贵州茅台", "证券类型": "股票",
            "数量": "500", "市值": "900000", "折算率": "0.6",
            "可用担保品": "500000", "交易日": "2024-01-15", "清算日": "2024-01-16",
            "是否退款": "否", "来源系统": "柜台系统"
        },
        {
            "客户编号": "C002", "客户名称": "李四", "账号": "A002001",
            "证券代码": "000001", "证券名称": "平安银行", "证券类型": "股票",
            "数量": "5000", "市值": "55000", "折算率": "0.65",
            "可用担保品": "35750", "交易日": "2024-01-15", "清算日": "2024-01-16",
            "是否退款": "否", "来源系统": "两融系统"
        },
        {
            "客户编号": "C005", "客户名称": "孙七", "账号": "A005001",
            "证券代码": "601398", "证券名称": "工商银行", "证券类型": "股票",
            "数量": "20000", "市值": "90000", "折算率": "0.75",
            "可用担保品": "67500", "交易日": "2024-01-13", "清算日": "2024-01-15",
            "是否退款": "是", "来源系统": "柜台系统"
        },
        {
            "客户编号": "C006", "客户名称": "周八", "账号": "A006001",
            "证券代码": "000858", "证券名称": "五粮液", "证券类型": "股票",
            "数量": "1000", "市值": "150000", "折算率": "0.65",
            "可用担保品": "97500", "交易日": "2024-01-15", "清算日": "2024-01-16",
            "是否退款": "否", "来源系统": "柜台系统"
        },
        {
            "客户编号": "C007", "客户名称": "吴九", "账号": "A007001",
            "证券代码": "600036", "证券名称": "招商银行", "证券类型": "股票",
            "数量": "", "市值": "200000", "折算率": "0.7",
            "可用担保品": "140000", "交易日": "2024-01-15", "清算日": "2024-01-16",
            "是否退款": "否", "来源系统": "柜台系统"
        },
        {
            "客户编号": "C008", "客户名称": "郑十", "账号": "A008001",
            "证券代码": "601166", "证券名称": "兴业银行", "证券类型": "股票",
            "数量": "8000", "市值": "144000", "折算率": "0.7",
            "可用担保品": "100000", "交易日": "2024-01-15", "清算日": "2024-01-16",
            "是否退款": "否", "来源系统": "柜台系统"
        },
    ]

    if format == "csv":
        with open(output, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv_lib.DictWriter(f, fieldnames=sample_records[0].keys())
            writer.writeheader()
            writer.writerows(sample_records)
    else:
        with open(output, "w", encoding="utf-8") as f:
            json_lib.dump(sample_records, f, ensure_ascii=False, indent=2)

    click.echo(click.style(f"✓ 样例数据已生成: {output}", fg="green", bold=True))
    click.echo()
    click.echo("包含以下问题场景:")
    click.echo("  1. 客户 C001 (张三) 有两个账号 A001001, A001002 → 同一客户多账号")
    click.echo("  2. 客户 C003 (王五) 证券代码为空 → 缺项")
    click.echo("  3. 客户 C004 (赵六) 可用担保品计算不一致 → 口径不一致")
    click.echo("  4. 客户 C002 (李四) 出现两次 → 重复记录")
    click.echo("  5. 客户 C005 (孙七) 退款交易日与清算日差2天 → 退款跨清算日")
    click.echo("  6. 客户 C007 (吴九) 数量为空 → 缺项")
    click.echo("  7. 客户 C008 (郑十) 可用担保品计算不一致 → 口径不一致")


if __name__ == "__main__":
    cli()
