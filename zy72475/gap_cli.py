#!/usr/bin/env python3
import click
import json
import os
import pandas as pd
from gap_tracker import GapTracker


def get_tracker():
    return GapTracker("config.yaml")


@click.group()
def cli():
    """地下通道导视缺口 - 可复盘的居民投诉追踪系统"""
    pass


@cli.command(name="import")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--by", default="admin", help="导入人")
def import_cmd(file_path, by):
    """从Excel/CSV导入居民投诉编号

    FILE_PATH: 导入文件路径 (.xlsx 或 .csv)

    必填列: complaint_id, community_name
    可选列: original_line_number, gap_count, remark
    """
    tracker = get_tracker()
    if file_path.endswith(".xlsx"):
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)

    if "original_line_number" not in df.columns:
        df["original_line_number"] = df.index + 2

    records = df.to_dict("records")
    result = tracker.import_complaints(records, imported_by=by)

    click.echo("=== 导入结果 ===")
    click.echo(f"成功导入: {result['imported']} 条")
    click.echo(f"跳过重复: {result['skipped_duplicate']} 条")
    click.echo(f"现存总数: {result['total_after_import']} 条")

    if result["flagged_same_community"]:
        click.echo("")
        click.echo("⚠️  以下记录疑似同小区新旧名称，已标记待市政巡检员复核:")
        for flag in result["flagged_same_community"]:
            click.echo(f"  - {flag['complaint_id']} ({flag['community_name']}) ↔ "
                       f"{flag['matched_id']} ({flag['matched_name']}) — {flag['match_reason']}")


@cli.command()
@click.argument("complaint_id")
@click.argument("field_name")
@click.argument("new_value")
@click.option("--by", default="anning", help="操作人")
@click.option("--reason", default="", help="变更原因")
def update(complaint_id, field_name, new_value, by, reason):
    """更新单条记录的字段值"""
    tracker = get_tracker()
    ok, msg = tracker.update_field(complaint_id, field_name, new_value, by, reason)
    if ok:
        click.echo(f"✅ {msg}")
    else:
        click.echo(f"❌ {msg}")


@cli.command()
@click.argument("complaint_id")
@click.option("--gap-count", type=int, default=None, help="复核后的缺口数")
@click.option("--remark", default="", help="补充备注")
@click.option("--by", default="anning", help="操作人(城更项目经理)")
def step2(complaint_id, gap_count, remark, by):
    """第二步: 城更项目经理阿宁补看路口照片"""
    tracker = get_tracker()
    ok, msg = tracker.step_photo_reviewed(complaint_id, by, gap_count, remark)
    if ok:
        click.echo(f"✅ {msg}")
    else:
        click.echo(f"❌ {msg}")


@cli.command()
@click.argument("complaint_id")
@click.option("--reason", default="小区名称疑似重复，待巡检员复核", help="标记原因")
@click.option("--by", default="anning", help="操作人")
def mark_review(complaint_id, reason, by):
    """标记为待市政巡检员复核（同小区新旧名称等情况）"""
    tracker = get_tracker()
    ok, msg = tracker.step_mark_for_review(complaint_id, by, reason)
    if ok:
        click.echo(f"✅ {msg}")
    else:
        click.echo(f"❌ {msg}")


@cli.command()
@click.argument("complaint_id")
@click.option("--summary-remark", default="", help="街道会看摘要备注")
@click.option("--by", default="anning", help="操作人")
def step3(complaint_id, summary_remark, by):
    """第三步: 给街道会看的摘要更新"""
    tracker = get_tracker()
    ok, msg = tracker.step_summary_updated(complaint_id, by, summary_remark)
    if ok:
        click.echo(f"✅ {msg}")
    else:
        click.echo(f"❌ {msg}")


@cli.command()
@click.argument("complaint_id", required=False)
def history(complaint_id):
    """查看变更历史（可指定投诉编号，或看全部）"""
    tracker = get_tracker()
    entries = tracker.get_history(complaint_id)

    if not entries:
        click.echo("暂无变更历史")
        return

    click.echo(f"=== 变更历史 (共 {len(entries)} 条) ===")
    for entry in entries:
        click.echo(f"\n[{entry.history_id}]")
        click.echo(f"  投诉编号: {entry.complaint_id}")
        click.echo(f"  变更时间: {entry.changed_at}")
        click.echo(f"  操作人:   {entry.changed_by}")
        click.echo(f"  字段:     {entry.field_name}")
        click.echo(f"  变更前:   {entry.old_value}")
        click.echo(f"  变更后:   {entry.new_value}")
        if entry.change_reason:
            click.echo(f"  原因:     {entry.change_reason}")


@cli.command()
@click.argument("complaint_id")
def show(complaint_id):
    """查看单条记录详情"""
    tracker = get_tracker()
    record = tracker.get_record(complaint_id)
    if not record:
        click.echo(f"❌ 投诉编号 {complaint_id} 不存在")
        return

    click.echo(f"=== 投诉记录 {complaint_id} ===")
    click.echo(f"  小区名称:     {record.community_name}")
    click.echo(f"  原始行号:     {record.original_line_number}")
    click.echo(f"  导入时间:     {record.import_timestamp}")
    click.echo(f"  缺口数量:     {record.gap_count}")
    click.echo(f"  当前状态:     {record.status}")
    click.echo(f"  备注:         {record.remark}")
    click.echo(f"  创建人:       {record.created_by}")
    click.echo(f"  最后更新人:   {record.updated_by}")
    click.echo(f"  最后更新时间: {record.updated_at}")
    if record.flags:
        click.echo(f"  标记:")
        for k, v in record.flags.items():
            click.echo(f"    {k}: {v}")


@cli.command()
@click.option("--status", default=None, help="按状态筛选")
def list(status):
    """列出所有记录"""
    tracker = get_tracker()
    records = tracker.get_all_records(status_filter=status)

    if not records:
        click.echo("暂无记录")
        return

    click.echo(f"{'投诉编号':<15} {'小区名称':<20} {'缺口数':<8} {'状态':<18} {'最后更新人':<12}")
    click.echo("-" * 80)
    for r in records:
        click.echo(f"{r.complaint_id:<15} {r.community_name:<20} {r.gap_count:<8} {r.status:<18} {r.updated_by:<12}")


@cli.command()
def summary():
    """查看缺口汇总统计"""
    tracker = get_tracker()
    s = tracker.get_gap_summary()
    click.echo("=== 地下通道导视缺口 汇总 ===")
    click.echo(f"  投诉记录总数: {s['total_complaints']}")
    click.echo(f"  缺口总数:     {s['total_gap_count']}")
    click.echo(f"  待复核标记:   {s['flagged_for_review']}")
    click.echo(f"  按状态分布:")
    for status, count in s["by_status"].items():
        click.echo(f"    {status}: {count}")


@cli.command()
@click.argument("history_id")
@click.option("--by", default="admin", help="操作人")
def rollback(history_id, by):
    """回滚到某个历史版本"""
    tracker = get_tracker()
    ok, msg = tracker.rollback(history_id, by)
    if ok:
        click.echo(f"✅ {msg}")
    else:
        click.echo(f"❌ {msg}")


@cli.command()
@click.argument("complaint_id", required=False)
@click.option("--output", "-o", default=None, help="输出文件路径 (JSON)")
def audit(complaint_id, output):
    """导出审计报告"""
    tracker = get_tracker()
    report = tracker.export_audit_report(complaint_id)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        click.echo(f"✅ 审计报告已导出到 {output}")
    else:
        click.echo(json.dumps(report, ensure_ascii=False, indent=2))


@cli.command()
def rules():
    """显示边界规则和工作流说明"""
    tracker = get_tracker()
    click.echo(tracker.rules.get_workflow_summary())
    click.echo(tracker.rules.get_rollback_guide())


@cli.command()
def demo():
    """运行完整演示流程"""
    tracker = get_tracker()

    demo_records = [
        {"complaint_id": "TS20260001", "community_name": "阳光花园", "gap_count": 2, "original_line_number": 2},
        {"complaint_id": "TS20260002", "community_name": "翠苑小区", "gap_count": 3, "original_line_number": 3},
        {"complaint_id": "TS20260003", "community_name": "阳光花园一期", "gap_count": 1, "original_line_number": 4},
    ]

    click.echo("=== 演示: 第一步 导入居民投诉 ===")
    result = tracker.import_complaints(demo_records, imported_by="demo_admin")
    click.echo(f"导入: {result['imported']} 条, 跳过重复: {result['skipped_duplicate']} 条")
    if result["flagged_same_community"]:
        click.echo("⚠️  标记待复核:")
        for f in result["flagged_same_community"]:
            click.echo(f"  {f['complaint_id']} ↔ {f['matched_id']}: {f['match_reason']}")

    click.echo("\n=== 演示: 第二步 城更项目经理阿宁补看路口照片 ===")
    tracker.step_photo_reviewed("TS20260001", "anning", gap_count=2, remark="照片确认2个缺口")
    click.echo("TS20260001: 照片已复核")

    tracker.step_photo_reviewed("TS20260002", "anning", gap_count=3, remark="照片确认3个缺口")
    click.echo("TS20260002: 照片已复核")

    click.echo("\n=== 演示: TS20260003 因为新旧名称问题留待巡检员复核 ===")

    click.echo("\n=== 演示: 第二步 阿宁改一条备注 ===")
    tracker.update_field("TS20260001", "remark", "照片确认2个缺口，靠近北门", "anning", "补充位置说明")
    click.echo("TS20260001 备注已更新")

    click.echo("\n=== 演示: 第三步 街道会看摘要更新 ===")
    tracker.step_summary_updated("TS20260001", "anning", "已纳入本季度整改计划")
    click.echo("TS20260001: 摘要已更新")

    tracker.step_summary_updated("TS20260002", "anning", "已纳入本季度整改计划")
    click.echo("TS20260002: 摘要已更新")

    click.echo("\n=== 演示: 重复导入同一批(去重验证) ===")
    result2 = tracker.import_complaints(demo_records, imported_by="demo_admin")
    click.echo(f"再次导入结果: 新增 {result2['imported']} 条, 跳过重复 {result2['skipped_duplicate']} 条")

    click.echo("\n=== 演示: 查看 TS20260001 变更历史 ===")
    for entry in tracker.get_history("TS20260001"):
        click.echo(f"  {entry.format_diff()} | {entry.change_reason}")

    click.echo("\n=== 演示: 汇总统计 ===")
    s = tracker.get_gap_summary()
    click.echo(f"  总投诉: {s['total_complaints']}, 总缺口: {s['total_gap_count']}, 待复核: {s['flagged_for_review']}")

    click.echo("\n✅ 演示完成！运行 'gap list' 查看所有记录")
    click.echo("   运行 'gap history TS20260001' 查看单条历史")
    click.echo("   运行 'gap show TS20260003' 查看待复核记录")


if __name__ == "__main__":
    cli()
