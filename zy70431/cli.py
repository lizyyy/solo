#!/usr/bin/env python3
import click
import json
from pathlib import Path
from migration_cli.service import (
    get_all_records,
    get_record_by_id,
    add_manual_correction,
    add_material_summary,
    add_contract_supplement,
    get_change_history_by_scope
)
from migration_cli.models import Status
from migration_cli.exporter import export_to_file, record_to_json, record_to_markdown
from migration_cli.test_data import init_test_data
from migration_cli.storage import DATA_DIR

@click.group()
def cli():
    """数据库迁移清单命令行工具"""
    pass

@cli.command()
@click.option('--force', is_flag=True, help='强制重新初始化测试数据')
def init(force):
    """初始化测试数据（正常材料 + 附件过期材料）"""
    if force:
        records_file = DATA_DIR / "migration_records.json"
        if records_file.exists():
            records_file.unlink()
            click.echo("已清除原有数据")
    
    records = init_test_data()
    click.echo(f"✅ 成功初始化 {len(records)} 条记录:")
    for r in records:
        status_icon = "✅" if r.system_judgment.status == Status.NORMAL else "⚠️"
        click.echo(f"  {status_icon} {r.receipt.device_name} ({r.receipt.receipt_id})")

@cli.command(name="list")
@click.option('--format', type=click.Choice(['json', 'markdown', 'md']), default='json', help='输出格式')
@click.option('--output', '-o', help='输出文件路径')
def list_records(format, output):
    """列出所有迁移记录"""
    records = get_all_records()
    if not records:
        click.echo("暂无记录，请先运行 init 命令初始化测试数据")
        return

    if output:
        export_to_file(records, output, format)
        click.echo(f"✅ 已导出到文件: {output}")
    else:
        if format == 'json':
            for record in records:
                click.echo(record_to_json(record))
                click.echo("---")
        else:
            for record in records:
                click.echo(record_to_markdown(record))
                click.echo("---")

@cli.command()
@click.argument('receipt_id')
@click.option('--format', type=click.Choice(['json', 'markdown', 'md']), default='json', help='输出格式')
@click.option('--output', '-o', help='输出文件路径')
def show(receipt_id, format, output):
    """显示单条记录详情"""
    record = get_record_by_id(receipt_id)
    if record is None:
        click.echo(f"❌ 未找到记录: {receipt_id}")
        return

    if format == 'json':
        content = record_to_json(record)
    else:
        content = record_to_markdown(record)

    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(content)
        click.echo(f"✅ 已导出到文件: {output}")
    else:
        click.echo(content)

@cli.command(name="correct")
@click.argument('receipt_id')
@click.argument('operator')
@click.argument('note')
@click.option('--status', type=click.Choice(['normal', 'abnormal', 'pending']), help='修正状态')
def correct(receipt_id, operator, note, status):
    """添加人工修正备注"""
    corrected_status = Status(status) if status else None
    record = add_manual_correction(receipt_id, operator, note, corrected_status)
    if record:
        click.echo(f"✅ 成功添加人工修正备注")
        click.echo(f"   操作人员: {operator}")
        click.echo(f"   修正备注: {note}")
        if corrected_status:
            click.echo(f"   修正状态: {corrected_status.value}")
    else:
        click.echo(f"❌ 未找到记录: {receipt_id}")

@cli.command(name="summary")
@click.argument('receipt_id')
@click.argument('summary_text')
def add_summary(receipt_id, summary_text):
    """添加材料摘要"""
    record = add_material_summary(receipt_id, summary_text)
    if record:
        click.echo(f"✅ 成功添加材料摘要")
    else:
        click.echo(f"❌ 未找到记录: {receipt_id}")

@cli.command(name="supplement")
@click.argument('receipt_id')
@click.argument('operator')
@click.argument('change_reason')
@click.argument('resource_scope')
@click.option('--previous', help='变更前的值')
@click.option('--new', 'new_value', help='变更后的值')
def supplement(receipt_id, operator, change_reason, resource_scope, previous, new_value):
    """添加合同补充变更记录"""
    record = add_contract_supplement(receipt_id, operator, change_reason, resource_scope, previous, new_value)
    if record:
        click.echo(f"✅ 成功添加合同补充变更记录")
        click.echo(f"   资源范围: {resource_scope}")
        click.echo(f"   变更原因: {change_reason}")
    else:
        click.echo(f"❌ 未找到记录: {receipt_id}")

@cli.command(name="history")
@click.argument('receipt_id')
@click.option('--scope', help='按资源范围筛选')
def history(receipt_id, scope):
    """查看变更历史"""
    changes = get_change_history_by_scope(receipt_id, scope)
    if not changes:
        click.echo("暂无变更记录")
        return

    click.echo(f"📋 变更历史（共 {len(changes)} 条）:")
    for ch in changes:
        click.echo(f"\n  [{ch.resource_scope}] {ch.change_type}")
        click.echo(f"    原因: {ch.change_reason}")
        click.echo(f"    操作人: {ch.operator}")
        click.echo(f"    时间: {ch.change_time.strftime('%Y-%m-%d %H:%M:%S')}")
        if ch.previous_value:
            click.echo(f"    原值: {ch.previous_value}")
        if ch.new_value:
            click.echo(f"    新值: {ch.new_value}")

@cli.command()
def export():
    """导出报告（JSON和Markdown格式）"""
    records = get_all_records()
    if not records:
        click.echo("暂无记录，请先运行 init 命令")
        return

    output_dir = Path("exported_reports")
    output_dir.mkdir(exist_ok=True)

    json_path = output_dir / "migration_records.json"
    md_path = output_dir / "migration_records.md"

    export_to_file(records, str(json_path), "json")
    export_to_file(records, str(md_path), "markdown")

    click.echo(f"✅ 报告已导出到 {output_dir}/ 目录:")
    click.echo(f"   - {json_path}")
    click.echo(f"   - {md_path}")

@cli.command()
def stats():
    """显示统计信息"""
    records = get_all_records()
    if not records:
        click.echo("暂无记录")
        return

    from migration_cli.service import get_effective_status

    normal = sum(1 for r in records if get_effective_status(r) == Status.NORMAL)
    abnormal = sum(1 for r in records if get_effective_status(r) == Status.ABNORMAL)
    pending = sum(1 for r in records if get_effective_status(r) == Status.PENDING)
    has_correction = sum(1 for r in records if r.manual_correction is not None)
    has_expired = sum(1 for r in records if any(a.is_expired for a in r.receipt.attachments))

    click.echo("📊 统计信息:")
    click.echo(f"   总记录数: {len(records)}")
    click.echo(f"   正常状态: {normal}")
    click.echo(f"   异常状态: {abnormal}")
    click.echo(f"   待处理: {pending}")
    click.echo(f"   有人工修正: {has_correction}")
    click.echo(f"   有附件过期: {has_expired}")

if __name__ == "__main__":
    cli()
