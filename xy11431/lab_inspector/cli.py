import click
import json
from .database import init_database, DB_PATH
from .importer import import_file, SOURCE_TYPES
from .checker import check_summary, run_data_checks
from .fixer import fix_record, resolve_failed_record, invalidate_record, get_failed_records
from .reporter import generate_summary_report, get_record_detail
from .history import list_import_batches, get_batch_detail, list_audit_logs, list_correction_logs, get_stats
from .exporter import export_records, export_failed_records, export_full_report


@click.group()
def cli():
    """学校实验室耗材多源导入巡检CLI工具"""
    pass


@cli.command()
def init():
    """初始化数据库"""
    init_database()
    click.echo(f"数据库已初始化: {DB_PATH}")


@cli.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--type", "source_type", type=click.Choice(SOURCE_TYPES), required=True, help="数据源类型")
@click.option("--by", "imported_by", default="system", help="导入人")
@click.option("--notes", help="备注")
def import_cmd(file_path, source_type, imported_by, notes):
    """导入数据文件"""
    try:
        result = import_file(file_path, source_type, imported_by, notes)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        click.echo(f"导入失败: {e}", err=True)


@cli.command()
@click.option("--record-id", type=int, help="指定记录ID检查")
@click.option("--detail", is_flag=True, help="显示详细问题列表")
def check(record_id, detail):
    """检查数据质量"""
    if record_id:
        issues = run_data_checks(record_id)
    else:
        summary = check_summary()
        issues = summary["issues"]
        click.echo(f"总记录数: {summary['total_records']}")
        click.echo(f"问题总数: {summary['total_issues']}")
        click.echo(f"  错误: {summary['by_severity']['error']}")
        click.echo(f"  警告: {summary['by_severity']['warning']}")
        click.echo(f"  提示: {summary['by_severity']['info']}")
        click.echo("")

    if detail or record_id:
        for issue in issues:
            click.echo(f"[{issue['severity'].upper()}] 记录#{issue['record_id']} (行{issue['original_row']}, {issue['source_type']})")
            click.echo(f"  字段: {issue['field']}")
            click.echo(f"  问题: {issue['issue']}")
            click.echo("")


@cli.command()
@click.argument("record_id", type=int)
@click.argument("field_name")
@click.argument("new_value")
@click.option("--reason", help="修改原因")
@click.option("--by", "operator", default="manual", help="操作人")
def fix(record_id, field_name, new_value, reason, operator):
    """修改记录字段值"""
    try:
        result = fix_record(record_id, field_name, new_value, reason, operator)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        click.echo(f"修改失败: {e}", err=True)


@cli.command()
@click.argument("failed_id", type=int)
@click.option("--material-name", help="耗材名称")
@click.option("--quantity", type=float, help="数量")
@click.option("--by", "operator", default="manual", help="操作人")
def resolve(failed_id, material_name, quantity, operator):
    """解决失败记录并重新导入"""
    corrections = {}
    if material_name:
        corrections["material_name"] = material_name
    if quantity is not None:
        corrections["quantity"] = quantity

    if not corrections:
        click.echo("请至少提供一个修正字段", err=True)
        return

    try:
        result = resolve_failed_record(failed_id, corrections, operator)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        click.echo(f"解决失败: {e}", err=True)


@cli.command()
@click.argument("record_id", type=int)
@click.option("--reason", help="作废原因")
@click.option("--by", "operator", default="manual", help="操作人")
def invalidate(record_id, reason, operator):
    """作废一条记录"""
    try:
        result = invalidate_record(record_id, reason, operator)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        click.echo(f"作废失败: {e}", err=True)


@cli.command()
@click.option("--batch-id", type=int, help="指定批次ID")
@click.option("--all", "show_all", is_flag=True, help="显示已解决的失败记录")
def failed(batch_id, show_all):
    """查看失败记录"""
    records = get_failed_records(batch_id, unresolved_only=not show_all)
    if not records:
        click.echo("没有失败记录")
        return

    for r in records:
        status = "已解决" if r["is_resolved"] else "未解决"
        click.echo(f"#{r['id']} [{status}] 批次{r['batch_id']} {r['source_type']} 行{r['original_row']}")
        click.echo(f"  错误: {r['error_message']}")
        if r["is_resolved"]:
            click.echo(f"  解决后记录ID: {r['resolved_record_id']}")
        click.echo("")


@cli.command()
@click.option("--start-date", help="开始日期 (YYYY-MM-DD)")
@click.option("--end-date", help="结束日期 (YYYY-MM-DD)")
@click.option("--department", help="按部门过滤")
@click.option("--detail", is_flag=True, help="显示明细记录")
def report(start_date, end_date, department, detail):
    """生成汇总报表"""
    result = generate_summary_report(start_date, end_date, department)

    click.echo(f"报表生成时间: {result['generated_at']}")
    click.echo("")
    click.echo("=== 汇总 ===")
    click.echo(f"记录总数: {result['summary']['total_records']}")
    click.echo(f"总数量: {result['summary']['total_quantity']}")
    click.echo(f"总金额: {result['summary']['total_amount']:.2f}")
    click.echo("")

    click.echo("=== 按来源 ===")
    for source, data in result["by_source"].items():
        click.echo(f"  {source}: {data['count']}条, {data['quantity']}件, {data['amount']:.2f}元")
    click.echo("")

    if result["by_department"]:
        click.echo("=== 按部门 ===")
        for dept, data in result["by_department"].items():
            click.echo(f"  {dept or '未填写'}: {data['count']}条, {data['amount']:.2f}元")
        click.echo("")

    if result["by_research_group"]:
        click.echo("=== 按课题组 ===")
        for group, data in result["by_research_group"].items():
            click.echo(f"  {group or '未填写'}: {data['count']}条, {data['amount']:.2f}元")
        click.echo("")

    click.echo("=== Top 10 耗材 (按金额) ===")
    for i, item in enumerate(result["top_materials"], 1):
        click.echo(f"  {i}. {item['name']}: {item['quantity']}件, {item['amount']:.2f}元")
    click.echo("")

    if detail:
        click.echo("=== 明细记录 ===")
        for r in result["records"]:
            click.echo(f"  #{r['id']} {r['material_name']} x {r['quantity']} {r['unit'] or ''} - {r['department'] or '未分配'}")


@cli.command()
@click.argument("record_id", type=int)
def detail(record_id):
    """查看记录详情"""
    record = get_record_detail(record_id)
    if not record:
        click.echo(f"记录不存在: {record_id}", err=True)
        return

    click.echo(json.dumps(record, ensure_ascii=False, indent=2))


@cli.command("history")
@click.option("--limit", type=int, default=50, help="显示数量")
def history_cmd(limit):
    """查看导入批次历史"""
    batches = list_import_batches(limit)
    for b in batches:
        click.echo(f"#{b['id']} {b['source_type']} - {b['file_name']}")
        click.echo(f"  时间: {b['import_time']}  成功: {b['success_count']}  失败: {b['failed_count']}")
        click.echo("")


@cli.command()
@click.argument("batch_id", type=int)
def batch(batch_id):
    """查看批次详情"""
    detail = get_batch_detail(batch_id)
    if not detail:
        click.echo(f"批次不存在: {batch_id}", err=True)
        return

    click.echo(json.dumps(detail, ensure_ascii=False, indent=2))


@cli.command()
@click.option("--record-id", type=int, help="指定记录ID")
@click.option("--limit", type=int, default=100, help="显示数量")
def audit(record_id, limit):
    """查看审计日志"""
    logs = list_audit_logs(record_id, limit)
    for log in logs:
        click.echo(f"[{log['operated_at']}] {log['action']} by {log['operator']}")
        click.echo(f"  记录#{log['record_id']}: {log['field_name'] or '-'}")
        if log["old_value"]:
            click.echo(f"  {log['old_value']} -> {log['new_value']}")
        if log["note"]:
            click.echo(f"  备注: {log['note']}")
        click.echo("")


@cli.command()
@click.option("--record-id", type=int, help="指定记录ID")
@click.option("--limit", type=int, default=100, help="显示数量")
def corrections(record_id, limit):
    """查看修正记录"""
    logs = list_correction_logs(record_id, limit)
    for log in logs:
        click.echo(f"[{log['corrected_at']}] by {log['corrected_by']}")
        click.echo(f"  记录#{log['record_id']}: {log['field_name']}")
        click.echo(f"  {log['old_value']} -> {log['new_value']}")
        if log["reason"]:
            click.echo(f"  原因: {log['reason']}")
        click.echo("")


@cli.command()
@click.argument("output_path")
@click.option("--format", "fmt", type=click.Choice(["xlsx", "csv", "json"]), default="xlsx", help="导出格式")
@click.option("--start-date", help="开始日期 (YYYY-MM-DD)")
@click.option("--end-date", help="结束日期 (YYYY-MM-DD)")
@click.option("--department", help="按部门过滤")
@click.option("--failed", is_flag=True, help="导出失败记录")
@click.option("--full", is_flag=True, help="导出完整报告（多sheet）")
def export(output_path, fmt, start_date, end_date, department, failed, full):
    """导出数据"""
    try:
        if full:
            result = export_full_report(output_path)
        elif failed:
            result = export_failed_records(output_path, format=fmt)
        else:
            result = export_records(output_path, fmt, start_date, end_date, department)
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        click.echo(f"导出失败: {e}", err=True)


@cli.command()
def stats():
    """查看系统统计"""
    result = get_stats()
    click.echo(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    cli()
