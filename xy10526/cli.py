#!/usr/bin/env python3
import os
import sys
import json
import click
from tabulate import tabulate
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from cloudbill.storage import Storage
from cloudbill.engine import RuleEngine
from cloudbill.importer import Importer
from cloudbill.report import ReportGenerator
from cloudbill.samples import export_sample_files
from cloudbill import __version__


DEFAULT_DATA_DIR = os.path.join(os.getcwd(), ".cloudbill_data")


def get_storage(data_dir: str) -> Storage:
    return Storage(data_dir)


def get_engine(data_dir: str) -> RuleEngine:
    return RuleEngine(get_storage(data_dir))


def get_importer(data_dir: str) -> Importer:
    return Importer(get_storage(data_dir))


def get_reporter(data_dir: str) -> ReportGenerator:
    storage = get_storage(data_dir)
    return ReportGenerator(storage, RuleEngine(storage))


@click.group()
@click.version_option(__version__)
@click.option('--data-dir', default=DEFAULT_DATA_DIR,
              help='数据存储目录，默认为当前目录下的 .cloudbill_data')
@click.pass_context
def cli(ctx, data_dir):
    ctx.ensure_object(dict)
    ctx.obj['data_dir'] = data_dir


@cli.command()
@click.option('--samples/--no-samples', default=True, help='是否初始化样例数据')
@click.option('--force/--no-force', default=False, help='强制重建目录（会清空数据）')
@click.pass_context
def init(ctx, samples, force):
    data_dir = ctx.obj['data_dir']

    if os.path.exists(data_dir) and not force:
        click.echo(f"✗ 数据目录已存在: {data_dir}")
        click.echo("  使用 --force 强制重建（将清空所有数据）")
        ctx.exit(1)

    if force and os.path.exists(data_dir):
        import shutil
        shutil.rmtree(data_dir)
        click.echo(f"已清理旧数据目录")

    os.makedirs(data_dir, exist_ok=True)

    click.echo(f"✓ 数据目录初始化: {data_dir}")

    if samples:
        sample_dir = os.path.join(data_dir, "samples")
        files = export_sample_files(sample_dir)
        click.echo(f"✓ 样例数据已导出到: {sample_dir}")
        for f in files:
            click.echo(f"  - {f}")

    click.echo("")
    click.echo("下一步操作建议：")
    click.echo("  1. 导入基础数据: python cli.py import-all")
    click.echo("  2. 检查账单状态: python cli.py check")
    click.echo("  3. 查看账单详情: python cli.py detail <bill_id>")
    click.echo("  4. 生成修复报告: python cli.py report")


@cli.group()
def import_cmd():
    """导入各种类型的数据"""
    pass


@import_cmd.command('bills')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='cli_user', help='操作者名称')
@click.pass_context
def import_bills(ctx, file_path, operator):
    result = get_importer(ctx.obj['data_dir']).import_bills(file_path, operator)
    _print_import_result("账单", result)


@import_cmd.command('resources')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='cli_user', help='操作者名称')
@click.pass_context
def import_resources(ctx, file_path, operator):
    result = get_importer(ctx.obj['data_dir']).import_resources(file_path, operator)
    _print_import_result("资源清单", result)


@import_cmd.command('strategies')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='cli_user', help='操作者名称')
@click.pass_context
def import_strategies(ctx, file_path, operator):
    result = get_importer(ctx.obj['data_dir']).import_strategies(file_path, operator)
    _print_import_result("标签策略", result)


@import_cmd.command('owners')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='cli_user', help='操作者名称')
@click.pass_context
def import_owners(ctx, file_path, operator):
    result = get_importer(ctx.obj['data_dir']).import_owners(file_path, operator)
    _print_import_result("负责人映射", result)


@import_cmd.command('projects')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--operator', default='cli_user', help='操作者名称')
@click.pass_context
def import_projects(ctx, file_path, operator):
    result = get_importer(ctx.obj['data_dir']).import_projects(file_path, operator)
    _print_import_result("项目定义", result)


@import_cmd.command('all')
@click.option('--sample-dir', default=None, help='样例数据目录，默认使用 data_dir/samples')
@click.option('--operator', default='cli_user', help='操作者名称')
@click.pass_context
def import_all(ctx, sample_dir, operator):
    data_dir = ctx.obj['data_dir']
    if sample_dir is None:
        sample_dir = os.path.join(data_dir, "samples")

    if not os.path.exists(sample_dir):
        click.echo(f"✗ 样例目录不存在: {sample_dir}")
        ctx.exit(1)

    importer = get_importer(data_dir)

    click.echo("=" * 50)
    click.echo("开始导入所有样例数据")
    click.echo("=" * 50)

    order = [
        ("projects", "项目定义"),
        ("owners", "负责人映射"),
        ("strategies", "标签策略"),
        ("resources", "资源清单"),
        ("bills", "云账单")
    ]

    all_success = True
    for key, name in order:
        filepath = os.path.join(sample_dir, f"{key}_sample.json")
        if os.path.exists(filepath):
            click.echo(f"\n导入 {name}...")
            if key == "projects":
                result = importer.import_projects(filepath, operator)
            elif key == "owners":
                result = importer.import_owners(filepath, operator)
            elif key == "strategies":
                result = importer.import_strategies(filepath, operator)
            elif key == "resources":
                result = importer.import_resources(filepath, operator)
            else:
                result = importer.import_bills(filepath, operator)

            _print_import_result(name, result)
            if not result.get("success"):
                all_success = False
        else:
            click.echo(f"  跳过 {name}: 文件不存在")

    click.echo("\n" + "=" * 50)
    if all_success:
        click.echo("✓ 全部导入完成")
    else:
        click.echo("! 部分导入失败")


def _print_import_result(name, result):
    if result.get("success"):
        click.echo(f"✓ {name}导入成功")
        if "total" in result:
            click.echo(f"  总计: {result.get('total')} 条")
            click.echo(f"  成功: {result.get('success_count', 0)} 条")
            click.echo(f"  失败: {result.get('failed', 0)} 条")
        if result.get("batch_id"):
            click.echo(f"  批次ID: {result['batch_id']}")
        if result.get("errors"):
            for err in result["errors"][:5]:
                click.echo(f"  警告: {err}")
            if len(result.get("errors", [])) > 5:
                click.echo(f"  ... 还有 {len(result['errors']) - 5} 条警告")
    else:
        click.echo(f"✗ {name}导入失败")
        click.echo(f"  错误: {result.get('error', '未知错误')}")


@cli.command()
@click.option('--auto-fix/--no-auto-fix', default=False, help='自动执行规则引擎修复')
@click.option('--operator', default='cli_user', help='操作者名称（用于自动修复记录）')
@click.pass_context
def check(ctx, auto_fix, operator):
    storage = get_storage(ctx.obj['data_dir'])
    engine = get_engine(ctx.obj['data_dir'])

    if auto_fix:
        click.echo("执行自动修复...")
        all_bills = storage.bills.all()
        fixed_count = 0
        for bill in all_bills:
            result = engine.auto_fix_bill(bill, operator)
            if result.get("changed"):
                fixed_count += 1
        click.echo(f"✓ 自动修复完成，变更 {fixed_count} 条记录")

    result = engine.check_all()
    stats = result["stats"]

    click.echo("\n" + "=" * 50)
    click.echo("账单状态统计")
    click.echo("=" * 50)

    table = [
        ["状态", "账单数", "占比"],
        ["总计", stats["total"], "100%"],
        ["已修复(fixed)", stats.get("fixed", 0),
         f"{(stats.get('fixed', 0) / stats['total'] * 100 if stats['total'] else 0):.1f}%"],
        ["未归属(unassigned)", stats.get("unassigned", 0),
         f"{(stats.get('unassigned', 0) / stats['total'] * 100 if stats['total'] else 0):.1f}%"],
        ["停用项目计费", stats.get("inactive_project", 0),
         f"{(stats.get('inactive_project', 0) / stats['total'] * 100 if stats['total'] else 0):.1f}%"],
        ["原始(raw)", stats.get("raw", 0),
         f"{(stats.get('raw', 0) / stats['total'] * 100 if stats['total'] else 0):.1f}%"],
    ]
    click.echo(tabulate(table, headers="firstrow", tablefmt="simple"))

    click.echo(f"\n检测到 {stats['issues_count']} 个标签问题")

    if stats.get("unassigned", 0) > 0 or stats.get("inactive_project", 0) > 0:
        click.echo("\n建议执行以下操作：")
        if not auto_fix:
            click.echo("  - 运行 `check --auto-fix` 自动修复")
        click.echo("  - 运行 `detail <bill_id>` 查看具体账单详情")
        click.echo("  - 运行 `manual-fix` 人工修正问题账单")


@cli.command()
@click.argument('bill_id')
@click.pass_context
def detail(ctx, bill_id):
    storage = get_storage(ctx.obj['data_dir'])
    engine = get_engine(ctx.obj['data_dir'])

    bill = storage.bills.get(bill_id)
    if not bill:
        click.echo(f"✗ 账单不存在: {bill_id}")
        ctx.exit(1)

    check_result = engine.check_bill(bill)
    history = storage.get_history_for_bill(bill_id)

    click.echo("=" * 60)
    click.echo(f"账单详情: {bill_id}")
    click.echo("=" * 60)

    info_table = [
        ["字段", "值"],
        ["账单ID", bill.bill_id],
        ["资源ID", bill.resource_id],
        ["资源类型", bill.resource_type],
        ["云厂商", bill.provider],
        ["账期", bill.billing_period],
        ["金额", f"{bill.cost:.2f} {bill.currency}"],
        ["当前状态", bill.status.value],
        ["是否人工修正", "是" if bill.is_manual_fix else "否"],
        ["导入批次", bill.import_batch_id or "-"],
        ["最后操作者", bill.last_operator or "-"],
        ["最后更新", bill.updated_at.strftime("%Y-%m-%d %H:%M:%S")],
    ]
    click.echo(tabulate(info_table, headers="firstrow", tablefmt="simple"))

    click.echo("\n--- 原始标签 ---")
    raw = bill.raw_tags.to_dict()
    click.echo(f"  项目: {raw.get('project') or '-'}")
    click.echo(f"  环境: {raw.get('env') or '-'}")
    click.echo(f"  负责人: {raw.get('owner') or '-'}")

    if bill.fixed_tags:
        click.echo("\n--- 修复后标签 ---")
        fixed = bill.fixed_tags.to_dict()
        click.echo(f"  项目: {fixed.get('project') or '-'}")
        click.echo(f"  环境: {fixed.get('env') or '-'}")
        click.echo(f"  负责人: {fixed.get('owner') or '-'}")

    click.echo("\n--- 检查结果 ---")
    if check_result["issues"]:
        for issue in check_result["issues"]:
            click.echo(f"  ✗ {issue}")
    else:
        click.echo("  ✓ 标签完整")

    if history:
        click.echo("\n--- 历史记录 ---")
        hist_table = [["时间", "动作", "操作者", "变更原因", "变更字段"]]
        for h in history:
            changes = ", ".join(h.changes.keys()) if h.changes else "-"
            hist_table.append([
                h.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                h.action,
                h.operator or "-",
                h.reason or "-",
                changes
            ])
        click.echo(tabulate(hist_table, headers="firstrow", tablefmt="simple"))
    else:
        click.echo("\n--- 历史记录: 无 ---")


@cli.command()
@click.argument('bill_id')
@click.option('--project', default=None, help='新项目代码')
@click.option('--env', default=None, help='新环境')
@click.option('--owner', default=None, help='新负责人')
@click.option('--reason', default='人工修正', help='修正原因')
@click.option('--operator', default='cli_user', help='操作者名称')
@click.pass_context
def manual_fix(ctx, bill_id, project, env, owner, reason, operator):
    engine = get_engine(ctx.obj['data_dir'])

    if not any([project, env, owner]):
        click.echo("✗ 请至少指定一个要修改的字段（--project / --env / --owner）")
        ctx.exit(1)

    result = engine.manual_fix_bill(
        bill_id=bill_id,
        new_project=project,
        new_env=env,
        new_owner=owner,
        reason=reason,
        operator=operator
    )

    if result.get("success"):
        if result.get("changed"):
            click.echo("✓ 人工修正成功")
            click.echo(f"  操作人: {operator}")
            click.echo(f"  原因: {reason}")
            click.echo(f"  变更:")
            for field, change in result.get("changes", {}).items():
                click.echo(f"    {field}: {change.get('before')} -> {change.get('after')}")
        else:
            click.echo("✓ 无变更（标签已与目标值一致）")
    else:
        click.echo(f"✗ 修正失败: {result.get('error')}")


@cli.command()
@click.option('--output', '-o', default=None, type=click.Path(),
              help='导出JSON报告的文件路径')
@click.pass_context
def report(ctx, output):
    reporter = get_reporter(ctx.obj['data_dir'])
    report_data = reporter.generate_detailed_report(output_file=output)
    summary = report_data["summary"]

    click.echo("\n" + "=" * 70)
    click.echo("云账单标签修复报告")
    click.echo(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    click.echo("=" * 70)

    click.echo("\n【1. 总体概况】")
    total = summary["total"]
    click.echo(f"  账单总数: {total['bill_count']} 条")
    click.echo(f"  总成本: {total['total_cost']:.2f} {total['currency']}")

    by_status = summary.get("by_status", {})
    status_rows = [["状态", "条数", "金额"]]
    for s in ["fixed", "unassigned", "inactive_project", "imported", "raw"]:
        d = by_status.get(s, {"count": 0, "cost": 0})
        status_rows.append([s, d["count"], f"{d['cost']:.2f}"])
    click.echo("\n按状态分布:")
    click.echo(tabulate(status_rows, headers="firstrow", tablefmt="simple"))

    click.echo("\n【2. 修复前后项目成本差异】")
    diff = summary.get("before_after_diff", [])
    if diff:
        diff_rows = [
            ["项目", "原始条数", "原始金额", "修复后条数", "修复后金额", "金额变化"]
        ]
        for item in diff:
            sign = "+" if item["diff_cost"] > 0 else ""
            diff_rows.append([
                item["project"],
                item["raw"]["count"],
                f"{item['raw']['cost']:.2f}",
                item["fixed"]["count"],
                f"{item['fixed']['cost']:.2f}",
                f"{sign}{item['diff_cost']:.2f}"
            ])
        click.echo(tabulate(diff_rows, headers="firstrow", tablefmt="simple"))
    else:
        click.echo("  无成本归属变化")

    click.echo("\n【3. 未归属资源】")
    unassigned = summary["unassigned"]
    if unassigned["count"] > 0:
        click.echo(f"  未归属账单: {unassigned['count']} 条")
        click.echo(f"  未归属金额: {unassigned['cost']:.2f} {total['currency']}")
        if unassigned["owners_involved"]:
            click.echo(f"  涉及负责人: {', '.join(unassigned['owners_involved'])}")
        click.echo("\n  明细（前10条）:")
        detail_rows = [["账单ID", "资源", "金额", "问题"]]
        for b in unassigned["bills"][:10]:
            issues = "; ".join(b["issues"]) if b["issues"] else "-"
            detail_rows.append([
                b["bill_id"],
                b["resource_type"],
                f"{b['cost']:.2f}",
                issues
            ])
        click.echo(tabulate(detail_rows, headers="firstrow", tablefmt="simple"))
    else:
        click.echo("  ✓ 无未归属资源")

    inactive = summary["inactive_project"]
    if inactive["count"] > 0:
        click.echo("\n【4. 停用项目仍计费】")
        click.echo(f"  停用项目账单: {inactive['count']} 条")
        click.echo(f"  涉及金额: {inactive['cost']:.2f} {total['currency']}")
        for b in inactive["bills"]:
            click.echo(f"    {b['bill_id']}: 项目={b['project']}, {b['resource_type']}, {b['cost']:.2f}")

    click.echo("\n【5. 处理建议】")
    for idx, rec in enumerate(report_data["recommendations"], 1):
        priority_marker = {"high": "🔴", "medium": "🟡", "info": "🔵"}.get(rec["priority"], "⚪")
        click.echo(f"  {priority_marker} [{idx}] {rec['message']}")

    if output:
        click.echo(f"\n✓ 详细报告已导出: {output}")


@cli.command('list')
@click.option('--status', default=None,
              type=click.Choice(['raw', 'imported', 'fixed', 'unassigned', 'inactive_project']),
              help='按状态筛选')
@click.option('--project', default=None, help='按项目筛选')
@click.option('--limit', default=20, help='显示数量限制')
@click.pass_context
def list_cmd(ctx, status, project, limit):
    storage = get_storage(ctx.obj['data_dir'])
    bills = storage.bills.all()

    if status:
        from cloudbill.models import BillStatus
        target_status = BillStatus(status)
        bills = [b for b in bills if b.status == target_status]

    if project:
        bills = [b for b in bills if b.effective_tags().project == project]

    bills = bills[:limit]

    if not bills:
        click.echo("无匹配账单")
        return

    rows = [
        ["账单ID", "资源类型", "金额", "项目", "环境", "负责人", "状态", "人工"]
    ]
    for b in bills:
        tags = b.effective_tags()
        rows.append([
            b.bill_id,
            b.resource_type,
            f"{b.cost:.2f}",
            tags.project or "-",
            tags.env or "-",
            tags.owner or "-",
            b.status.value,
            "✓" if b.is_manual_fix else ""
        ])
    click.echo(tabulate(rows, headers="firstrow", tablefmt="simple"))
    click.echo(f"\n共显示 {len(bills)} 条记录")


@cli.command('history')
@click.argument('bill_id')
@click.pass_context
def history_cmd(ctx, bill_id):
    storage = get_storage(ctx.obj['data_dir'])
    records = storage.get_history_for_bill(bill_id)

    if not records:
        click.echo(f"账单 {bill_id} 无历史记录")
        return

    click.echo(f"\n账单 {bill_id} 历史记录（共 {len(records)} 条）:")
    for i, h in enumerate(records, 1):
        click.echo(f"\n--- 记录 {i}: {h.action} ---")
        click.echo(f"  时间: {h.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"  操作者: {h.operator or '-'}")
        click.echo(f"  原因: {h.reason or '-'}")
        if h.changes:
            click.echo("  变更:")
            for field, diff in h.changes.items():
                click.echo(f"    {field}: {diff.get('before')} -> {diff.get('after')}")


if __name__ == '__main__':
    cli(obj={})
