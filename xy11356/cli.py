import click
import json
from database import init_db
from importer import DataImporter
from verifier import GateVerifier
from exporter import DataExporter
from config import DATA_DIR


@click.group()
def cli():
    """园区安保访客管理系统"""
    pass


@cli.command()
def init():
    """初始化数据库"""
    init_db()
    click.echo('数据库初始化完成!')


@cli.group()
def import_cmd():
    """数据导入命令"""
    pass


@import_cmd.command()
@click.argument('file_path')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def visitors(file_path, operator, role):
    """从CSV导入访客数据"""
    importer = DataImporter(operator, role)
    result = importer.import_visitors_from_csv(file_path)
    click.echo(f'导入完成! 批次ID: {result["batch_id"]}')
    click.echo(f'总计: {result["total"]}, 成功: {result["success"]}, 失败: {result["failed"]}')
    if result['failed'] > 0:
        click.echo('失败记录已保存到 errors/ 目录')


@import_cmd.command()
@click.argument('file_path')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def plates(file_path, operator, role):
    """从JSON导入临时车牌数据"""
    importer = DataImporter(operator, role)
    result = importer.import_plates_from_json(file_path)
    click.echo(f'导入完成! 批次ID: {result["batch_id"]}')
    click.echo(f'总计: {result["total"]}, 成功: {result["success"]}, 失败: {result["failed"]}')
    if result['failed'] > 0:
        click.echo('失败记录已保存到 errors/ 目录')


@import_cmd.command()
@click.argument('source_db')
@click.argument('table_name')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
@click.option('--mapping', required=True, help='字段映射JSON, 如: {"type":"type_field",...}')
def blacklist(source_db, table_name, operator, role, mapping):
    """从其他数据库导入黑名单数据"""
    mapping_dict = json.loads(mapping)
    importer = DataImporter(operator, role)
    result = importer.import_blacklist_from_db(source_db, table_name, mapping_dict)
    click.echo(f'导入完成! 批次ID: {result["batch_id"]}')
    click.echo(f'总计: {result["total"]}, 成功: {result["success"]}, 失败: {result["failed"]}')


@import_cmd.command()
@click.argument('batch_id')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def retry(batch_id, operator, role):
    """重试失败的批量导入"""
    importer = DataImporter(operator, role)
    result = importer.retry_failed_batch(batch_id)
    click.echo(f'重试完成! 新批次ID: {result.get("batch_id", "N/A")}')
    click.echo(f'总计: {result.get("total", 0)}, 成功: {result.get("success", 0)}, 失败: {result.get("failed", 0)}')


@cli.group()
def verify():
    """门岗核验命令"""
    pass


@verify.command()
@click.argument('id_card')
@click.option('--visit-date', help='访问日期 YYYY-MM-DD, 默认今天')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def visitor(id_card, visit_date, operator, role):
    """核验访客身份"""
    verifier = GateVerifier(operator, role)
    result = verifier.verify_visitor(id_card, visit_date)
    if result['allowed']:
        click.echo(click.style(f'✓ {result["message"]}', fg='green'))
        click.echo(f'访客姓名: {result["visitor"]["name"]}')
        click.echo(f'被访人员: {result["visitor"]["visited_person"]}')
    else:
        click.echo(click.style(f'✗ 拒绝通行: {result["reason"]}', fg='red'))
        if 'action' in result:
            click.echo(f'建议: {result["action"]}')


@verify.command()
@click.argument('plate_number')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def vehicle(plate_number, operator, role):
    """核验车辆"""
    verifier = GateVerifier(operator, role)
    result = verifier.verify_vehicle(plate_number)
    if result['allowed']:
        click.echo(click.style(f'✓ {result["message"]}', fg='green'))
        click.echo(f'车主: {result["plate"]["owner_name"]}')
        click.echo(f'有效期至: {result["plate"]["valid_to"]}')
    else:
        click.echo(click.style(f'✗ 拒绝通行: {result["reason"]}', fg='red'))
        if 'action' in result:
            click.echo(f'建议: {result["action"]}')


@verify.command()
@click.option('--limit', default=50, help='显示条数')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def recent(limit, operator, role):
    """查看最近核验记录"""
    verifier = GateVerifier(operator, role)
    logs = verifier.get_recent_verifications(limit)
    for log in logs:
        status_color = 'green' if log['status'] == 'approved' else 'red'
        click.echo(f'{log["timestamp"]} | {log["entity_type"]} | {log["operator"]} | ', nl=False)
        click.echo(click.style(log['status'], fg=status_color))


@cli.group()
def export():
    """数据导出命令"""
    pass


@export.command()
@click.option('--start-date', help='开始日期 YYYY-MM-DD')
@click.option('--end-date', help='结束日期 YYYY-MM-DD')
@click.option('--status', help='状态: pending, checked_in')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def visitors(start_date, end_date, status, operator, role):
    """导出发客数据"""
    exporter = DataExporter(operator, role)
    result = exporter.export_visitors(start_date, end_date, status)
    click.echo(f'导出成功! 文件: {result["file"]}')
    click.echo(f'导出记录数: {result["count"]}')


@export.command()
@click.option('--status', help='状态: active, expired')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def plates(status, operator, role):
    """导出临时车牌数据"""
    exporter = DataExporter(operator, role)
    result = exporter.export_plates(status)
    click.echo(f'导出成功! 文件: {result["file"]}')
    click.echo(f'导出记录数: {result["count"]}')


@export.command()
@click.option('--active-only/--all', default=True, help='仅导出有效黑名单')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def blacklist(active_only, operator, role):
    """导出黑名单"""
    exporter = DataExporter(operator, role)
    result = exporter.export_blacklist(active_only)
    click.echo(f'导出成功! 文件: {result["file"]}')
    click.echo(f'导出记录数: {result["count"]}')


@export.command()
@click.option('--days', default=30, help='最近天数')
@click.option('--action', help='操作类型: create, verify')
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def audit_logs(days, action, operator, role):
    """导出审计日志"""
    exporter = DataExporter(operator, role)
    result = exporter.export_audit_logs(days, action)
    click.echo(f'导出成功! 文件: {result["file"]}')
    click.echo(f'导出记录数: {result["count"]}')


@export.command()
@click.argument('year', type=int)
@click.argument('month', type=int)
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def monthly_summary(year, month, operator, role):
    """导出月度汇总报表"""
    exporter = DataExporter(operator, role)
    result = exporter.export_monthly_summary(year, month)
    click.echo(f'导出成功! 文件: {result["file"]}')
    click.echo(json.dumps(result['summary'], ensure_ascii=False, indent=2))


@export.command()
@click.option('--operator', required=True, help='操作人')
@click.option('--role', required=True, help='角色: security_supervisor, gate_guard, auditor')
def batch_operations(operator, role):
    """导出批量操作记录"""
    exporter = DataExporter(operator, role)
    result = exporter.export_batch_operations()
    click.echo(f'导出成功! 文件: {result["file"]}')
    click.echo(f'导出记录数: {result["count"]}')


if __name__ == '__main__':
    cli()
