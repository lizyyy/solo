import os
import sys
import json
import click
from datetime import datetime, timedelta
from tabulate import tabulate

from alert_reducer.config import ConfigManager
from alert_reducer.models import init_db, get_session, Alert, ProcessBatch, FailureLog
from alert_reducer.importer import AlertImporter
from alert_reducer.processor import AlertProcessor
from alert_reducer.reporter import AlertReporter
from alert_reducer.duty_manager import DutyManager


def _parse_datetime(dt_str: str) -> datetime:
    """解析时间字符串"""
    if not dt_str:
        return None
    
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    
    # 最后尝试dateutil
    try:
        from dateutil import parser
        return parser.parse(dt_str)
    except:
        raise click.BadParameter(f"无法解析时间: {dt_str}")


@click.group()
@click.version_option(version='1.0.0', prog_name='alert-reducer')
@click.option('--config', '-c', help='配置文件路径')
@click.pass_context
def cli(ctx, config):
    """值班告警降噪 CLI - 解决半夜告警太多、真正需要叫醒人的故障反而被淹没的问题"""
    ctx.ensure_object(dict)
    
    # 初始化配置
    config_manager = ConfigManager(config)
    ctx.obj['config'] = config_manager
    
    # 初始化数据库
    engine = init_db(config_manager.database_path)
    session = get_session(engine)
    ctx.obj['session'] = session


@cli.command()
@click.pass_context
def init(ctx):
    """初始化数据库"""
    click.echo("✅ 数据库初始化完成")
    click.echo(f"📁 数据库路径: {ctx.obj['config'].database_path}")


@cli.command('import')
@click.option('--file', '-f', 'file_path', type=click.Path(exists=True), help='告警文件路径')
@click.option('--dir', '-d', 'dir_path', type=click.Path(exists=True, file_okay=False), help='告警目录路径')
@click.pass_context
def import_command(ctx, file_path, dir_path):
    """导入告警数据"""
    session = ctx.obj['session']
    importer = AlertImporter(session)
    
    if not file_path and not dir_path:
        click.echo("❌ 请指定 --file 或 --dir 参数")
        sys.exit(1)
    
    try:
        if file_path:
            result = importer.import_from_file(file_path)
        else:
            result = importer.import_from_directory(dir_path)
        
        click.echo(f"\n📊 导入结果:")
        click.echo(f"  ✅ 成功: {result.get('success', 0)}")
        click.echo(f"  🔄 更新: {result.get('updated', 0)}")
        click.echo(f"  ❌ 失败: {result.get('failed', 0)}")
        
        if result.get('failed_items'):
            click.echo(f"\n⚠️  失败详情:")
            for item in result['failed_items']:
                click.echo(f"  - 索引 {item['index']}: {item['error']}")
        
        session.commit()
        
    except Exception as e:
        click.echo(f"❌ 导入失败: {e}")
        session.rollback()
        sys.exit(1)


@cli.command()
@click.option('--window', '-w', type=int, help='处理时间窗口（分钟）')
@click.option('--start', '-s', help='开始时间 (格式: YYYY-MM-DD HH:MM:SS)')
@click.option('--end', '-e', help='结束时间 (格式: YYYY-MM-DD HH:MM:SS)')
@click.pass_context
def process(ctx, window, start, end):
    """处理告警（抑制、合并、升级）"""
    session = ctx.obj['session']
    config = ctx.obj['config']
    processor = AlertProcessor(session, config)
    
    # 解析时间
    start_time = _parse_datetime(start) if start else None
    end_time = _parse_datetime(end) if end else None
    
    click.echo("🔄 开始处理告警...")
    
    result = processor.process(
        start_time=start_time,
        end_time=end_time,
        window_minutes=window
    )
    
    if result['success']:
        stats = result['stats']
        click.echo(f"\n✅ 处理完成 (批次ID: {result['batch_id']})")
        click.echo(f"📊 统计:")
        click.echo(f"  总告警数: {stats['total']}")
        click.echo(f"  已抑制: {stats['suppressed']}")
        click.echo(f"  已合并: {stats['merged']}")
        click.echo(f"  已升级: {stats['escalated']}")
        
        if stats['escalated'] > 0:
            click.echo(f"\n🚨 需要关注的升级告警: {stats['escalated']} 个")
    else:
        click.echo(f"❌ 处理失败: {result.get('error', '未知错误')}")
        sys.exit(1)


@cli.command()
@click.option('--all', '-a', is_flag=True, help='查询所有告警')
@click.option('--status', '-s', help='按状态筛选 (pending, merged, suppressed, escalated, resolved)')
@click.option('--priority', '-p', help='按优先级筛选 (P1, P2, P3, P4, P5)')
@click.option('--start', help='开始时间')
@click.option('--end', help='结束时间')
@click.option('--limit', '-l', type=int, default=50, help='限制返回数量')
@click.option('--json', 'output_json', is_flag=True, help='输出JSON格式')
@click.pass_context
def query(ctx, all, status, priority, start, end, limit, output_json):
    """查询历史告警"""
    session = ctx.obj['session']
    
    query = session.query(Alert)
    
    if status:
        query = query.filter(Alert.status == status)
    
    if priority:
        query = query.filter(Alert.severity == priority)
    
    if start:
        start_time = _parse_datetime(start)
        query = query.filter(Alert.starts_at >= start_time)
    
    if end:
        end_time = _parse_datetime(end)
        query = query.filter(Alert.starts_at <= end_time)
    
    alerts = query.order_by(Alert.starts_at.desc()).limit(limit).all()
    
    if output_json:
        result = []
        for alert in alerts:
            result.append({
                'id': alert.id,
                'alert_id': alert.alert_id,
                'alertname': alert.alertname,
                'severity': alert.severity,
                'job': alert.job,
                'instance': alert.instance,
                'status': alert.status,
                'starts_at': alert.starts_at.isoformat() if alert.starts_at else None,
                'ends_at': alert.ends_at.isoformat() if alert.ends_at else None
            })
        click.echo(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        if not alerts:
            click.echo("📭 没有找到匹配的告警")
            return
        
        table_data = []
        for alert in alerts:
            table_data.append([
                alert.id,
                alert.alertname,
                alert.severity,
                alert.status,
                alert.starts_at.strftime('%Y-%m-%d %H:%M:%S') if alert.starts_at else '-',
                alert.job or '-',
                alert.instance or '-'
            ])
        
        headers = ['ID', '告警名称', '优先级', '状态', '开始时间', 'Job', 'Instance']
        click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
        click.echo(f"\n📊 共 {len(alerts)} 条告警")


@cli.command()
@click.option('--batch-id', '-b', type=int, help='重跑指定批次')
@click.option('--start', '-s', help='开始时间')
@click.option('--end', '-e', help='结束时间')
@click.pass_context
def rerun(ctx, batch_id, start, end):
    """重跑校验（重新处理告警）"""
    session = ctx.obj['session']
    config = ctx.obj['config']
    processor = AlertProcessor(session, config)
    
    click.echo("🔄 开始重跑...")
    
    if batch_id:
        result = processor.rerun(batch_id=batch_id)
    elif start and end:
        start_time = _parse_datetime(start)
        end_time = _parse_datetime(end)
        result = processor.rerun(start_time=start_time, end_time=end_time)
    else:
        click.echo("❌ 请指定 --batch-id 或 --start/--end 参数")
        sys.exit(1)
    
    if result['success']:
        click.echo(f"✅ 重跑完成 (新批次ID: {result['batch_id']})")
        stats = result['stats']
        click.echo(f"📊 统计: 总计 {stats['total']}, 抑制 {stats['suppressed']}, 合并 {stats['merged']}, 升级 {stats['escalated']}")
    else:
        click.echo(f"❌ 重跑失败: {result.get('error', '未知错误')}")
        sys.exit(1)


@cli.command()
@click.option('--window', '-w', type=int, help='时间窗口（分钟）')
@click.option('--start', '-s', help='开始时间')
@click.option('--end', '-e', help='结束时间')
@click.option('--format', '-f', 'fmt', type=click.Choice(['html', 'json']), default='html', help='输出格式')
@click.option('--output', '-o', help='输出文件路径')
@click.pass_context
def report(ctx, window, start, end, fmt, output):
    """生成复盘报告"""
    session = ctx.obj['session']
    
    # 解析时间
    if window:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(minutes=window)
    else:
        start_time = _parse_datetime(start) if start else None
        end_time = _parse_datetime(end) if end else None
    
    click.echo("📊 生成报告中...")
    
    reporter = AlertReporter(session)
    report_data = reporter.generate_report(
        start_time=start_time,
        end_time=end_time,
        format=fmt
    )
    
    # 输出
    if fmt == 'html':
        content = report_data.get('html', '')
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(content)
            click.echo(f"✅ HTML报告已保存到: {output}")
        else:
            # 生成默认文件名
            default_name = f"alert_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
            with open(default_name, 'w', encoding='utf-8') as f:
                f.write(content)
            click.echo(f"✅ HTML报告已保存到: {default_name}")
    else:
        # JSON格式
        json_content = {
            'report_date': report_data['report_date'],
            'time_range': report_data['time_range'],
            'stats': report_data['stats'],
            'summary': report_data['summary'],
            'escalated_alerts': report_data['escalated_alerts'],
            'suppressed_alerts': report_data['suppressed_alerts'],
            'merged_alerts': report_data['merged_alerts'],
            'failures': report_data['failures'],
            'suggestions': report_data['suggestions']
        }
        
        content = json.dumps(json_content, indent=2, ensure_ascii=False)
        
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(content)
            click.echo(f"✅ JSON报告已保存到: {output}")
        else:
            click.echo(content)


@cli.command()
@click.option('--window', '-w', type=int, help='时间窗口（分钟）')
@click.option('--operation', '-o', help='按操作类型筛选')
@click.option('--limit', '-l', type=int, default=50, help='限制返回数量')
@click.pass_context
def failures(ctx, window, operation, limit):
    """查看失败日志"""
    session = ctx.obj['session']
    
    query = session.query(FailureLog)
    
    if window:
        start_time = datetime.utcnow() - timedelta(minutes=window)
        query = query.filter(FailureLog.created_at >= start_time)
    
    if operation:
        query = query.filter(FailureLog.operation == operation)
    
    failures = query.order_by(FailureLog.created_at.desc()).limit(limit).all()
    
    if not failures:
        click.echo("✅ 没有失败记录")
        return
    
    table_data = []
    for f in failures:
        table_data.append([
            f.id,
            f.operation,
            f.error_type or '-',
            f.error_message[:50] + ('...' if len(f.error_message) > 50 else ''),
            f.created_at.strftime('%Y-%m-%d %H:%M:%S')
        ])
    
    headers = ['ID', '操作', '错误类型', '错误信息', '时间']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
    click.echo(f"\n📊 共 {len(failures)} 条失败记录")


@cli.command()
@click.option('--status', '-s', help='按状态筛选')
@click.option('--limit', '-l', type=int, default=20, help='限制返回数量')
@click.pass_context
def batches(ctx, status, limit):
    """查看处理批次"""
    session = ctx.obj['session']
    
    query = session.query(ProcessBatch)
    
    if status:
        query = query.filter(ProcessBatch.status == status)
    
    batches = query.order_by(ProcessBatch.created_at.desc()).limit(limit).all()
    
    if not batches:
        click.echo("📭 没有处理批次记录")
        return
    
    table_data = []
    for b in batches:
        table_data.append([
            b.id,
            b.status,
            b.total_alerts,
            b.merged_alerts,
            b.suppressed_alerts,
            b.escalated_alerts,
            b.start_time.strftime('%Y-%m-%d %H:%M:%S') if b.start_time else '-',
            b.error_message[:30] if b.error_message else '-'
        ])
    
    headers = ['ID', '状态', '总数', '合并', '抑制', '升级', '开始时间', '错误']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))


@cli.command('duty-start')
@click.option('--name', '-n', required=True, help='值班人员姓名')
@click.option('--shift', '-s', type=click.Choice(['day', 'night']), default='day', help='班次 (day/night)')
@click.option('--date', '-d', help='值班日期 (格式: YYYY-MM-DD)')
@click.pass_context
def duty_start(ctx, name, shift, date):
    """开始值班（创建值班记录）"""
    session = ctx.obj['session']
    duty_manager = DutyManager(session)
    
    # 解析日期
    duty_date = _parse_datetime(date) if date else datetime.utcnow()
    
    click.echo(f"📋 创建值班记录...")
    click.echo(f"  值班人员: {name}")
    click.echo(f"  班次: {shift}")
    click.echo(f"  日期: {duty_date.strftime('%Y-%m-%d')}")
    
    try:
        duty = duty_manager.create_duty_record(
            oncall_name=name,
            shift=shift,
            duty_date=duty_date
        )
        
        click.echo(f"\n✅ 值班记录已创建 (ID: {duty.id})")
        click.echo(f"  预计统计: 总告警 {duty.total_alerts}, 升级告警 {duty.escalated_alerts}")
        
    except Exception as e:
        click.echo(f"❌ 创建值班记录失败: {e}")
        sys.exit(1)


@cli.command('duty-end')
@click.option('--id', 'duty_id', type=int, help='值班记录ID')
@click.option('--notes', '-n', help='值班备注')
@click.pass_context
def duty_end(ctx, duty_id, notes):
    """结束值班（更新值班记录）"""
    session = ctx.obj['session']
    duty_manager = DutyManager(session)
    
    # 如果没有指定ID，获取当前值班
    if not duty_id:
        current_duty = duty_manager.get_current_duty()
        if current_duty:
            duty_id = current_duty.id
            click.echo(f"📋 使用当前值班记录 (ID: {duty_id})")
        else:
            click.echo("❌ 未找到当前值班记录，请使用 --id 指定")
            sys.exit(1)
    
    click.echo(f"📋 更新值班记录...")
    
    try:
        # 先获取值班记录
        from alert_reducer.models import DutyHistory
        duty = session.query(DutyHistory).filter(DutyHistory.id == duty_id).first()
        
        if duty:
            # 重新计算统计信息
            stats = duty_manager._calculate_duty_stats(duty.duty_date, duty.shift)
            duty.total_alerts = stats['total_alerts']
            duty.escalated_alerts = stats['escalated_alerts']
            session.commit()
        
        # 更新备注
        updated = duty_manager.update_duty_record(
            duty_id=duty_id,
            notes=notes
        )
        
        if updated:
            click.echo(f"✅ 值班记录已更新 (ID: {updated.id})")
            click.echo(f"  最终统计: 总告警 {updated.total_alerts}, 升级告警 {updated.escalated_alerts}")
            if updated.notes:
                click.echo(f"  备注: {updated.notes}")
        else:
            click.echo(f"❌ 未找到值班记录 (ID: {duty_id})")
            sys.exit(1)
            
    except Exception as e:
        click.echo(f"❌ 更新值班记录失败: {e}")
        sys.exit(1)


@cli.command('duty-history')
@click.option('--name', '-n', help='按值班人员筛选')
@click.option('--start', '-s', help='开始日期')
@click.option('--end', '-e', help='结束日期')
@click.option('--limit', '-l', type=int, default=50, help='限制返回数量')
@click.pass_context
def duty_history(ctx, name, start, end, limit):
    """查看值班历史"""
    session = ctx.obj['session']
    duty_manager = DutyManager(session)
    
    # 解析时间
    start_date = _parse_datetime(start) if start else None
    end_date = _parse_datetime(end) if end else None
    
    duties = duty_manager.get_duty_history(
        start_date=start_date,
        end_date=end_date,
        oncall_name=name,
        limit=limit
    )
    
    if not duties:
        click.echo("📭 没有值班历史记录")
        return
    
    table_data = []
    for duty in duties:
        table_data.append([
            duty.id,
            duty.oncall_name,
            duty.shift,
            duty.total_alerts,
            duty.escalated_alerts,
            duty.duty_date.strftime('%Y-%m-%d'),
            duty.notes[:30] if duty.notes else '-'
        ])
    
    headers = ['ID', '值班人员', '班次', '总告警', '升级告警', '日期', '备注']
    click.echo(tabulate(table_data, headers=headers, tablefmt='grid'))
    click.echo(f"\n📊 共 {len(duties)} 条值班记录")


@cli.command('duty-current')
@click.pass_context
def duty_current(ctx):
    """查看当前值班信息"""
    session = ctx.obj['session']
    duty_manager = DutyManager(session)
    
    current_duty = duty_manager.get_current_duty()
    
    if current_duty:
        click.echo("📋 当前值班信息:")
        click.echo(f"  ID: {current_duty.id}")
        click.echo(f"  值班人员: {current_duty.oncall_name}")
        click.echo(f"  班次: {current_duty.shift}")
        click.echo(f"  日期: {current_duty.duty_date.strftime('%Y-%m-%d')}")
        click.echo(f"  总告警: {current_duty.total_alerts}")
        click.echo(f"  升级告警: {current_duty.escalated_alerts}")
        if current_duty.notes:
            click.echo(f"  备注: {current_duty.notes}")
    else:
        click.echo("⚠️  当前没有活动的值班记录")
        click.echo("💡 使用 `alert-reducer duty-start --name <姓名>` 开始值班")


def main():
    cli(obj={})


if __name__ == '__main__':
    main()
