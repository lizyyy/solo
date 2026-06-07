import click
import json
import csv
from tabulate import tabulate
from db import init_db, DB_PATH
from core import (
    import_complaints, lao_ma_review_photo, inspector_resolve_alias,
    generate_daily_summary, get_single_source, get_audit_log,
    add_community_alias, get_alias_list, rollback_record_field, ALIAS_RULES
)


@click.group()
def cli():
    """医院急诊入口疏导 - 居民投诉处理系统"""
    init_db()


@cli.command()
@click.option("--csv", "csv_file", type=click.Path(exists=True), help="投诉数据CSV路径")
@click.option("--batch", "batch_id", help="批次号，不指定则自动生成")
@click.option("--operator", default="system", help="操作人")
def import_data(csv_file, batch_id, operator):
    """第一步：导入居民投诉编号"""
    records = []
    with open(csv_file, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            records.append({
                "line_no": idx,
                "complaint_no": row.get("投诉编号", row.get("complaint_no", "")),
                "community_name": row.get("小区名称", row.get("community_name", "")),
                "address": row.get("地址", row.get("address", "")),
                "complaint_content": row.get("投诉内容", row.get("complaint_content", "")),
            })
    batch = import_complaints(records, operator, batch_id)
    click.echo("✅ 导入完成，批次号: {}".format(batch))
    click.echo("📋 导入记录数: {}".format(len(records)))


@cli.command()
@click.argument("complaint_no")
@click.argument("batch_id")
@click.argument("photo_remark")
@click.option("--operator", default="traffic_laoma", help="操作人")
def lao_ma_review(complaint_no, batch_id, photo_remark, operator):
    """第二步：交通协管老马补看路口照片"""
    ok = lao_ma_review_photo(complaint_no, batch_id, photo_remark, operator)
    if ok:
        click.echo("✅ 老马已完成照片审核，备注已保存")
    else:
        click.echo("❌ 未找到该投诉记录")


@cli.command()
@click.argument("complaint_no")
@click.argument("batch_id")
@click.option("--use-new-name/--use-old-name", default=True, help="采用新名还是旧名")
@click.option("--operator", default="muni_inspector", help="操作人")
def inspector_review(complaint_no, batch_id, use_new_name, operator):
    """市政巡检员复核小区新旧名冲突"""
    ok = inspector_resolve_alias(complaint_no, batch_id, use_new_name, operator)
    if ok:
        click.echo("✅ 巡检员已复核，冲突已解决，采用{}".format("新名" if use_new_name else "旧名"))
    else:
        click.echo("❌ 未找到记录或该记录无冲突")


@cli.command()
@click.option("--operator", default="summary_bot", help="操作人")
def summary(operator):
    """第三步：生成给街道会看的摘要"""
    result = generate_daily_summary(operator)
    click.echo("📊 今日摘要：")
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))


@cli.command(name="list")
@click.option("--batch", "batch_id", help="按批次筛选")
@click.option("--format", "output_format", type=click.Choice(["table", "json", "csv"]), default="table")
def list_records(batch_id, output_format):
    """查看记录（单一数据源，导出/页面/接口都读这个）"""
    records = get_single_source(batch_id)
    if output_format == "json":
        click.echo(json.dumps(records, ensure_ascii=False, indent=2))
    elif output_format == "csv":
        if records:
            keys = records[0].keys()
            click.echo(",".join(keys))
            for r in records:
                click.echo(",".join('"{}"'.format(str(r[k]).replace('"', '""')) for k in keys))
    else:
        display = []
        for r in records:
            display.append({
                "行号": r["original_line_no"],
                "投诉编号": r["complaint_no"],
                "小区": r["community_name"],
                "状态": r["status"],
                "新旧名冲突": "是" if r["has_alias_conflict"] else "否",
                "照片备注": r["photo_remark"] or "",
                "批次": r["import_batch_id"][-8:],
            })
        click.echo(tabulate(display, headers="keys", tablefmt="simple"))


@cli.command()
@click.argument("record_id", type=int)
def audit(record_id):
    """查看单条记录的审计日志（可回溯证据）"""
    logs = get_audit_log(record_id)
    if not logs:
        click.echo("无审计记录")
        return
    display = []
    for l in logs:
        display.append({
            "时间": l["changed_at"],
            "操作人": l["changed_by"],
            "字段": l["field_name"],
            "旧值": l["old_value"] or "",
            "新值": l["new_value"] or "",
            "原因": l["change_reason"] or "",
        })
    click.echo(tabulate(display, headers="keys", tablefmt="simple"))


@cli.command()
@click.argument("old_name")
@click.argument("new_name")
@click.option("--operator", default="admin", help="操作人")
def add_alias(old_name, new_name, operator):
    """添加小区新旧名映射"""
    aid = add_community_alias(old_name, new_name, operator)
    if aid > 0:
        click.echo("✅ 已添加映射 #{}: {} -> {}".format(aid, old_name, new_name))
    else:
        click.echo("❌ 添加失败")


@cli.command(name="list-aliases")
def list_aliases_cmd():
    """列出所有小区新旧名映射"""
    aliases = get_alias_list()
    display = []
    for a in aliases:
        display.append({
            "ID": a["id"],
            "旧名": a["old_name"],
            "新名": a["new_name"],
            "启用": "是" if a["is_active"] else "否",
            "创建时间": a["created_at"],
        })
    click.echo(tabulate(display, headers="keys", tablefmt="simple"))


@cli.command()
@click.argument("record_id", type=int)
@click.argument("field_name")
@click.option("--operator", default="admin", help="操作人")
def rollback(record_id, field_name, operator):
    """回滚某记录的某个字段到上一个值"""
    ok = rollback_record_field(record_id, field_name, operator)
    if ok:
        click.echo("✅ 已回滚记录{}的{}字段".format(record_id, field_name))
    else:
        click.echo("❌ 回滚失败，无历史记录")


@cli.command(name="rules")
def show_rules():
    """显示边界规则"""
    click.echo(ALIAS_RULES)


@cli.command()
def info():
    """显示系统信息"""
    click.echo("数据库路径: {}".format(DB_PATH))
    click.echo("核心原则: 单一数据源 + 全链路审计 + 可重放命令")


if __name__ == "__main__":
    cli()
