import click
import os
from tabulate import tabulate
from .models import EngineFactory
from .services import BillingService, DisputeService, AuditService
from .io import DataImporter, DataExporter

DB_PATH = os.environ.get("ENERGY_SHARE_DB", "energy_share.db")


def get_session():
    EngineFactory.init_db(DB_PATH)
    return EngineFactory.get_session(DB_PATH)


@click.group()
@click.option("--db", "db_path", default=DB_PATH, help="数据库路径")
def cli(db_path):
    """物业公区能耗分摊CLI工具"""
    global DB_PATH
    if db_path != DB_PATH:
        DB_PATH = db_path


@cli.group()
def import_cmd():
    """数据导入命令"""
    pass


@import_cmd.command("houses")
@click.argument("file_path", type=click.Path(exists=True))
def import_houses(file_path):
    """导入房屋信息"""
    session = get_session()
    importer = DataImporter(session)
    result = importer.import_houses(file_path)
    click.echo(f"成功导入 {result['success']} 条房屋记录")
    if result['errors']:
        click.echo(f"错误 {len(result['errors'])} 条:")
        for err in result['errors']:
            click.echo(f"  - {err}")


@import_cmd.command("occupancy")
@click.argument("file_path", type=click.Path(exists=True))
def import_occupancy(file_path):
    """导入入住/空置状态"""
    session = get_session()
    importer = DataImporter(session)
    result = importer.import_occupancy_status(file_path)
    click.echo(f"成功导入 {result['success']} 条状态记录")
    if result['errors']:
        click.echo(f"错误 {len(result['errors'])} 条:")
        for err in result['errors']:
            click.echo(f"  - {err}")


@import_cmd.command("bill")
@click.argument("file_path", type=click.Path(exists=True))
def import_bill(file_path):
    """导入公区电表账单"""
    session = get_session()
    importer = DataImporter(session)
    result = importer.import_meter_bill(file_path)
    click.echo(f"成功导入 {result['success']} 条账单记录")
    if result['errors']:
        click.echo(f"错误 {len(result['errors'])} 条:")
        for err in result['errors']:
            click.echo(f"  - {err}")


@import_cmd.command("reductions")
@click.argument("file_path", type=click.Path(exists=True))
def import_reductions(file_path):
    """导入特殊减免记录"""
    session = get_session()
    importer = DataImporter(session)
    result = importer.import_reductions(file_path)
    click.echo(f"成功导入 {result['success']} 条减免记录")
    if result['errors']:
        click.echo(f"错误 {len(result['errors'])} 条:")
        for err in result['errors']:
            click.echo(f"  - {err}")


@cli.command("trial")
@click.argument("billing_month")
def trial_calculate(billing_month):
    """试算分摊金额（不确认）"""
    session = get_session()
    service = BillingService(session)
    
    click.echo(f"正在试算 {billing_month} 账单...")
    try:
        result = service.trial_calculate(billing_month)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    click.echo("\n" + "=" * 80)
    click.echo(f"账单月份: {result['billing_month']}")
    click.echo(f"公区总费用: {result['total_bill_amount']:.2f} 元")
    click.echo(f"总有效面积: {result['total_effective_area']:.2f} ㎡")
    click.echo(f"房屋数量: {result['house_count']} 户")
    click.echo(f"分摊总额: {result['grand_total']:.2f} 元")
    
    if result['issues']:
        click.echo("\n⚠️  数据问题清单:")
        table = [[i['type'], i['entity'], i['key'], i['description']] for i in result['issues']]
        click.echo(tabulate(table, headers=['问题类型', '实体', '关联项', '描述'], tablefmt='grid'))
    
    click.echo("\n📋 分摊明细:")
    table = [[
        r['room_number'],
        r['owner_name'] or '',
        f"{r['area']:.2f}",
        f"{r['effective_area']:.2f}",
        f"{r['area_weight'] * 100:.4f}%",
        '是' if r['is_vacant'] else f"{r['vacant_days']}天",
        f"{r['original_share_amount']:.2f}",
        f"{r['reduction_amount']:.2f}",
        f"{r['final_amount']:.2f}"
    ] for r in result['results']]
    click.echo(tabulate(
        table,
        headers=['房号', '业主', '面积', '有效面积', '权重', '空置', '分摊', '减免', '实缴'],
        tablefmt='grid'
    ))


@cli.command("confirm")
@click.argument("billing_month")
@click.option("--operator", "-o", default="operator", help="操作人")
def confirm_bill(billing_month, operator):
    """确认账单"""
    session = get_session()
    service = BillingService(session)
    
    try:
        result = service.confirm_bill(billing_month, operator)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    click.echo(f"✅ 账单 {billing_month} 已确认")
    click.echo(f"   状态: {result['old_status']} → {result['new_status']}")


@cli.command("revise")
@click.argument("billing_month")
@click.option("--operator", "-o", default="operator", help="操作人")
@click.option("--reason", "-r", default="", help="修改原因")
def revise_bill(billing_month, operator, reason):
    """修订已确认的账单"""
    session = get_session()
    service = BillingService(session)
    
    try:
        result = service.revise_bill(billing_month, operator, reason)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    click.echo(f"✅ 账单 {billing_month} 已标记修订")
    click.echo(f"   状态: {result['old_status']} → {result['new_status']}")
    click.echo(f"   原因: {reason}")
    click.echo("请重新导入数据后运行 trial 重新计算")


@cli.command("cancel")
@click.argument("billing_month")
@click.option("--operator", "-o", default="operator", help="操作人")
@click.option("--reason", "-r", default="", help="撤销原因")
def cancel_bill(billing_month, operator, reason):
    """撤销账单"""
    session = get_session()
    service = BillingService(session)
    
    try:
        result = service.cancel_bill(billing_month, operator, reason)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    click.echo(f"✅ 账单 {billing_month} 已撤销")
    click.echo(f"   状态: {result['old_status']} → {result['new_status']}")


@cli.command("list")
@click.option("--status", "-s", help="按状态筛选 (draft/trial/confirmed/cancelled)")
def list_bills(status):
    """列出所有账单"""
    session = get_session()
    service = BillingService(session)
    
    bills = service.list_bills(status)
    if not bills:
        click.echo("没有找到账单")
        return
    
    table = [[
        b['billing_month'],
        f"{b['total_amount']:.2f}",
        b['electricity_kwh'],
        b['water_tons'],
        b['status'],
        b['created_at']
    ] for b in bills]
    
    click.echo(tabulate(
        table,
        headers=['月份', '总费用', '用电(度)', '用水(吨)', '状态', '创建时间'],
        tablefmt='grid'
    ))


@cli.command("regenerate")
@click.argument("billing_month")
def regenerate_bill(billing_month):
    """重新生成账单（修订后使用）"""
    session = get_session()
    service = BillingService(session)
    
    click.echo(f"正在重新计算 {billing_month} 账单...")
    try:
        result = service.trial_calculate(billing_month)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    click.echo(f"✅ 账单 {billing_month} 已重新生成")
    click.echo(f"   总费用: {result['total_bill_amount']:.2f} 元")
    click.echo(f"   运行 confirm 命令确认新账单")


@cli.group()
def dispute():
    """争议管理命令"""
    pass


@dispute.command("add")
@click.argument("billing_month")
@click.argument("room_number")
@click.argument("disputed_amount", type=float)
@click.argument("objection")
@click.option("--created-by", "-c", default="customer", help="记录人")
def add_dispute(billing_month, room_number, disputed_amount, objection, created_by):
    """记录客户争议"""
    session = get_session()
    service = DisputeService(session)
    
    try:
        result = service.record_dispute(
            billing_month, room_number, disputed_amount, objection, created_by
        )
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    click.echo(f"✅ 争议记录已创建 (ID: {result['dispute_id']})")
    click.echo(f"   月份: {billing_month}")
    click.echo(f"   房号: {room_number}")
    click.echo(f"   争议金额: {disputed_amount} 元")
    click.echo(f"   异议: {objection}")


@dispute.command("list")
@click.option("--status", "-s", help="按状态筛选 (pending/resolved)")
@click.option("--month", "-m", help="按月份筛选")
def list_disputes(status, month):
    """列出争议记录"""
    session = get_session()
    service = DisputeService(session)
    
    disputes = service.list_disputes(status, month)
    if not disputes:
        click.echo("没有争议记录")
        return
    
    table = [[
        d['id'],
        d['billing_month'],
        d['room_number'],
        f"{d['disputed_amount']:.2f}",
        d['objection'][:50] + '...' if d['objection'] and len(d['objection']) > 50 else d['objection'],
        d['status'],
        d['created_at']
    ] for d in disputes]
    
    click.echo(tabulate(
        table,
        headers=['ID', '月份', '房号', '金额', '异议', '状态', '创建时间'],
        tablefmt='grid'
    ))


@dispute.command("resolve")
@click.argument("dispute_id", type=int)
@click.argument("resolution")
@click.option("--resolved-by", "-r", default="operator", help="处理人")
def resolve_dispute(dispute_id, resolution, resolved_by):
    """解决争议"""
    session = get_session()
    service = DisputeService(session)
    
    try:
        result = service.resolve_dispute(dispute_id, resolution, resolved_by)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    click.echo(f"✅ 争议 {dispute_id} 已解决")
    click.echo(f"   处理结果: {resolution}")


@cli.group()
def export_cmd():
    """导出命令"""
    pass


@export_cmd.command("details")
@click.argument("billing_month")
@click.argument("output_path", type=click.Path())
def export_details(billing_month, output_path):
    """导出账单明细 CSV"""
    session = get_session()
    exporter = DataExporter(session)
    
    try:
        exporter.export_bill_details(billing_month, output_path)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    click.echo(f"✅ 账单明细已导出到: {output_path}")


@export_cmd.command("report")
@click.argument("billing_month")
@click.argument("output_path", type=click.Path())
def export_report(billing_month, output_path):
    """导出业主明细报告（给业主看的）"""
    session = get_session()
    exporter = DataExporter(session)
    
    try:
        exporter.export_owner_report(billing_month, output_path)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    click.echo(f"✅ 业主报告已导出到: {output_path}")


@cli.group()
def audit():
    """审计日志命令"""
    pass


@audit.command("history")
@click.argument("billing_month")
def audit_history(billing_month):
    """查看账单历史"""
    session = get_session()
    service = AuditService(session)
    
    try:
        logs = service.get_bill_history(billing_month)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    if not logs:
        click.echo("没有历史记录")
        return
    
    click.echo(f"\n账单 {billing_month} 历史记录:")
    click.echo("-" * 80)
    
    for log in logs:
        click.echo(f"\n📅 {log['operated_at']}")
        click.echo(f"   操作: {log['operation']}")
        click.echo(f"   状态: {log['old_status']} → {log['new_status']}")
        if log['operated_by']:
            click.echo(f"   操作人: {log['operated_by']}")
        if log['reason']:
            click.echo(f"   原因: {log['reason']}")
        if log['old_data']:
            click.echo(f"   旧数据: {log['old_data']}")


@audit.command("versions")
@click.argument("billing_month")
def audit_versions(billing_month):
    """查看版本差异"""
    session = get_session()
    service = AuditService(session)
    
    try:
        versions = service.compare_versions(billing_month)
    except ValueError as e:
        click.echo(f"错误: {e}")
        return
    
    if not versions:
        click.echo("没有版本差异记录")
        return
    
    click.echo(f"\n账单 {billing_month} 版本变更:")
    table = [[
        v['operated_at'],
        v['operated_by'],
        v['reason'],
        v['old_version'],
        f"{v['old_final']:.2f}" if v['old_final'] else '-',
        f"{v['old_reduction']:.2f}" if v['old_reduction'] else '-'
    ] for v in versions]
    
    click.echo(tabulate(
        table,
        headers=['时间', '操作人', '原因', '旧版本', '旧金额', '旧减免'],
        tablefmt='grid'
    ))


if __name__ == "__main__":
    cli()
