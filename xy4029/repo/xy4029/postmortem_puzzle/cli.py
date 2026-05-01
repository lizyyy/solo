"""CLI入口模块 - 提供命令行界面"""

import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import click

from .config import Event, EventSource, EventType, ProjectConfig, Timeline
from .parsers import AlertsParser, ChatParser, LogsParser
from .reconciler import Reconciler
from .sanitizer import Sanitizer
from .storage import Storage
from .reporter import Reporter


def get_project_dir(ctx: click.Context) -> Path:
    """获取项目目录"""
    project_dir = ctx.obj.get('project_dir') if ctx.obj else None
    if not project_dir:
        project_dir = Path.cwd()
    return Path(project_dir)


def get_config(project_dir: Path) -> ProjectConfig:
    """加载项目配置"""
    config_path = project_dir / '.postmortem' / 'config.json'
    if not config_path.exists():
        raise click.ClickException(
            f"未找到项目配置文件。请在 {project_dir} 目录下运行 'postmortem init' 初始化项目。"
        )
    return ProjectConfig.load(config_path)


def get_storage(project_dir: Path) -> Storage:
    """获取存储实例"""
    data_dir = project_dir / '.postmortem' / 'data'
    return Storage(data_dir)


@click.group()
@click.option('--project-dir', '-p', type=click.Path(exists=False, file_okay=False), 
              help='项目目录路径，默认为当前目录')
@click.version_option(version='0.1.0', prog_name='postmortem-puzzle')
@click.pass_context
def cli(ctx: click.Context, project_dir: Optional[str]):
    """故障复盘拼图器 - 统一时间线的故障分析工具
    
    用于将散落在监控告警、值班群消息、服务日志中的故障信息
    统一整理成一条可信的事件时间线。
    """
    ctx.ensure_object(dict)
    if project_dir:
        ctx.obj['project_dir'] = Path(project_dir)
    else:
        ctx.obj['project_dir'] = Path.cwd()


@cli.command()
@click.option('--name', '-n', required=True, help='项目名称')
@click.option('--service', '-s', multiple=True, help='服务名称（可多次指定）')
@click.option('--timezone', '-t', default='Asia/Shanghai', help='默认时区，默认Asia/Shanghai')
@click.option('--force', '-f', is_flag=True, help='强制覆盖现有配置')
@click.pass_context
def init(ctx: click.Context, name: str, service: tuple, timezone: str, force: bool):
    """初始化项目配置
    
    创建项目配置文件和目录结构。
    
    示例:
      postmortem init --name "生产环境故障复盘" --service api-gateway --service order-service
    """
    project_dir = get_project_dir(ctx)
    postmortem_dir = project_dir / '.postmortem'
    config_path = postmortem_dir / 'config.json'
    
    if postmortem_dir.exists() and not force:
        raise click.ClickException(
            f"项目已在 {postmortem_dir} 初始化。使用 --force 选项覆盖。"
        )
    
    postmortem_dir.mkdir(parents=True, exist_ok=True)
    (postmortem_dir / 'imports').mkdir(exist_ok=True)
    (postmortem_dir / 'imports' / 'alerts').mkdir(exist_ok=True)
    (postmortem_dir / 'imports' / 'chat').mkdir(exist_ok=True)
    (postmortem_dir / 'imports' / 'logs').mkdir(exist_ok=True)
    (postmortem_dir / 'data').mkdir(exist_ok=True)
    (postmortem_dir / 'reports').mkdir(exist_ok=True)
    
    config = ProjectConfig(
        project_name=name,
        default_timezone=timezone,
        services=list(service),
    )
    config.save(config_path)
    
    click.echo(f"✅ 项目 '{name}' 已初始化")
    click.echo(f"📁 配置目录: {postmortem_dir}")
    click.echo(f"⏰ 默认时区: {timezone}")
    if service:
        click.echo(f"🔧 服务: {', '.join(service)}")


@cli.command('import-alerts')
@click.argument('csv_file', type=click.Path(exists=True, dir_okay=False))
@click.option('--service', '-s', help='关联的服务名称')
@click.option('--timezone', '-t', help='CSV文件的时区，覆盖默认配置')
@click.pass_context
def import_alerts(ctx: click.Context, csv_file: str, service: Optional[str], timezone: Optional[str]):
    """导入监控告警CSV文件
    
    将监控告警CSV导入到项目中。原始文件不会被修改，
    会复制到项目的imports目录下。
    
    示例:
      postmortem import-alerts alerts_20240101.csv
      postmortem import-alerts alerts_20240101.csv --service api-gateway
    """
    project_dir = get_project_dir(ctx)
    config = get_config(project_dir)
    
    source_path = Path(csv_file)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    dest_filename = f"{source_path.stem}_{timestamp}{source_path.suffix}"
    dest_path = project_dir / '.postmortem' / 'imports' / 'alerts' / dest_filename
    
    shutil.copy2(source_path, dest_path)
    
    tz = timezone or config.default_timezone
    parser = AlertsParser(config=config)
    
    try:
        events = parser.parse(dest_path, timezone=tz)
    except Exception as e:
        raise click.ClickException(f"解析CSV文件失败: {e}")
    
    for event in events:
        if service:
            event.service = service
        event.source_file = dest_filename
    
    storage = get_storage(project_dir)
    for event in events:
        storage.save_event(event)
    
    click.echo(f"✅ 已导入告警CSV: {source_path.name}")
    click.echo(f"📄 复制到: {dest_path}")
    click.echo(f"📊 解析出 {len(events)} 条告警事件")


@cli.command('import-chat')
@click.argument('chat_file', type=click.Path(exists=True, dir_okay=False))
@click.option('--format', '-f', type=click.Choice(['markdown', 'json', 'auto']), 
              default='auto', help='文件格式，默认自动检测')
@click.option('--service', '-s', help='关联的服务名称')
@click.option('--timezone', '-t', help='消息的时区，覆盖默认配置')
@click.pass_context
def import_chat(ctx: click.Context, chat_file: str, format: str, service: Optional[str], 
                timezone: Optional[str]):
    """导入值班群消息
    
    支持Markdown和JSON格式的聊天记录导出。
    
    示例:
      postmortem import-chat wechat_export.md
      postmortem import-chat slack_export.json --format json
    """
    project_dir = get_project_dir(ctx)
    config = get_config(project_dir)
    
    source_path = Path(chat_file)
    
    if format == 'auto':
        if source_path.suffix.lower() == '.json':
            format = 'json'
        else:
            format = 'markdown'
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    dest_filename = f"{source_path.stem}_{timestamp}{source_path.suffix}"
    dest_path = project_dir / '.postmortem' / 'imports' / 'chat' / dest_filename
    
    shutil.copy2(source_path, dest_path)
    
    tz = timezone or config.default_timezone
    parser = ChatParser(config=config)
    
    try:
        if format == 'json':
            events = parser.parse_json(dest_path, timezone=tz)
        else:
            events = parser.parse_markdown(dest_path, timezone=tz)
    except Exception as e:
        raise click.ClickException(f"解析聊天文件失败: {e}")
    
    for event in events:
        if service:
            event.service = service
        event.source_file = dest_filename
    
    storage = get_storage(project_dir)
    for event in events:
        storage.save_event(event)
    
    click.echo(f"✅ 已导入聊天记录: {source_path.name}")
    click.echo(f"📄 格式: {format}")
    click.echo(f"📊 解析出 {len(events)} 条消息事件")


@cli.command('import-logs')
@click.argument('log_files', nargs=-1, type=click.Path(exists=True, dir_okay=False))
@click.option('--service', '-s', help='关联的服务名称')
@click.option('--timezone', '-t', help='日志的时区，覆盖默认配置')
@click.option('--log-format', '-l', help='日志时间格式名称，参考配置中的log_time_formats')
@click.pass_context
def import_logs(ctx: click.Context, log_files: tuple, service: Optional[str], 
                timezone: Optional[str], log_format: Optional[str]):
    """导入服务日志片段
    
    可同时导入多个日志文件。支持多种日志时间格式。
    
    示例:
      postmortem import-logs app.log error.log
      postmortem import-logs nginx.log --service api-gateway
    """
    project_dir = get_project_dir(ctx)
    config = get_config(project_dir)
    
    if not log_files:
        raise click.ClickException("请指定至少一个日志文件")
    
    total_events = 0
    storage = get_storage(project_dir)
    
    for log_file in log_files:
        source_path = Path(log_file)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        dest_filename = f"{source_path.stem}_{timestamp}{source_path.suffix}"
        dest_path = project_dir / '.postmortem' / 'imports' / 'logs' / dest_filename
        
        shutil.copy2(source_path, dest_path)
        
        tz = timezone or config.default_timezone
        parser = LogsParser(config=config)
        
        try:
            events = parser.parse(dest_path, timezone=tz, format_name=log_format)
        except Exception as e:
            click.echo(f"⚠️  解析日志文件 {source_path.name} 失败: {e}")
            continue
        
        for event in events:
            if service:
                event.service = service
            event.source_file = dest_filename
        
        for event in events:
            storage.save_event(event)
        
        total_events += len(events)
        click.echo(f"📄 {source_path.name}: 解析出 {len(events)} 条日志事件")
    
    click.echo(f"✅ 共导入 {len(log_files)} 个日志文件，{total_events} 条事件")


@cli.command()
@click.option('--output', '-o', help='输出时间线文件路径')
@click.option('--dry-run', '-n', is_flag=True, help='仅预览，不保存结果')
@click.pass_context
def reconcile(ctx: click.Context, output: Optional[str], dry_run: bool):
    """归并时间线
    
    将所有导入的事件统一归并成一条可信的时间线：
    - 修正时区和时钟偏移
    - 合并重复告警
    - 识别事件类型
    - 处理冲突和异常事件到隔离区
    
    示例:
      postmortem reconcile
      postmortem reconcile --dry-run
    """
    project_dir = get_project_dir(ctx)
    config = get_config(project_dir)
    
    storage = get_storage(project_dir)
    events = storage.get_all_events()
    
    if not events:
        click.echo("⚠️  没有找到任何事件，请先导入数据")
        return
    
    click.echo(f"📊 开始归并 {len(events)} 条事件...")
    
    sanitizer = Sanitizer(config=config)
    reconciler = Reconciler(config=config)
    
    sanitized_events = []
    quarantine_reasons = []
    
    for event in events:
        result = sanitizer.sanitize(event)
        if result.is_quarantined:
            quarantine_reasons.append(f"事件 {event.id}: {result.quarantine_reason}")
        else:
            sanitized_events.append(result)
    
    timeline = reconciler.reconcile(sanitized_events)
    timeline.sort_events()
    
    if quarantine_reasons:
        quarantine_path = project_dir / '.postmortem' / 'data' / 'quarantine.json'
        quarantine_data = {
            'timestamp': datetime.now().isoformat(),
            'reasons': quarantine_reasons,
            'events': [e.to_dict() for e in timeline.quarantined_events]
        }
        import json
        with open(quarantine_path, 'w', encoding='utf-8') as f:
            json.dump(quarantine_data, f, indent=2, ensure_ascii=False)
        click.echo(f"⚠️  {len(quarantine_reasons)} 条事件被隔离，详情见: {quarantine_path}")
    
    click.echo(f"\n📈 归并结果:")
    click.echo(f"   总事件数: {len(timeline.events)}")
    click.echo(f"   重复事件: {sum(1 for e in timeline.events if e.is_duplicate)}")
    click.echo(f"   隔离事件: {len(timeline.quarantined_events)}")
    click.echo(f"   时间范围: {timeline.start_time} ~ {timeline.end_time}")
    
    if not dry_run:
        timeline_id = str(uuid.uuid4())[:8]
        timeline.id = timeline_id
        timeline.title = f"故障复盘时间线 - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        storage.save_timeline(timeline)
        click.echo(f"\n💾 时间线已保存，ID: {timeline_id}")
        
        if output:
            import json
            with open(output, 'w', encoding='utf-8') as f:
                json.dump(timeline.to_dict(), f, indent=2, ensure_ascii=False, default=str)
            click.echo(f"📄 已导出到: {output}")


@cli.command()
@click.option('--timeline-id', '-t', help='时间线ID，不指定则使用最新的时间线')
@click.option('--output-dir', '-o', default='.', help='输出目录，默认为当前目录')
@click.option('--name', '-n', help='报告文件名前缀')
@click.pass_context
def report(ctx: click.Context, timeline_id: Optional[str], output_dir: str, name: Optional[str]):
    """导出复盘报告
    
    生成Markdown格式的复盘报告和CSV格式的事件清单。
    
    报告包含:
    - 故障基本信息和时间线概览
    - 影响时长、检测耗时、恢复耗时分析
    - 关键事件和证据片段
    - 待办事项列表
    
    示例:
      postmortem report
      postmortem report --timeline-id abc12345 --output-dir ./reports
    """
    project_dir = get_project_dir(ctx)
    config = get_config(project_dir)
    
    storage = get_storage(project_dir)
    
    if timeline_id:
        timeline = storage.get_timeline(timeline_id)
        if not timeline:
            raise click.ClickException(f"未找到时间线: {timeline_id}")
    else:
        timelines = storage.list_timelines(limit=1)
        if not timelines:
            raise click.ClickException("没有找到任何时间线，请先运行 reconcile 命令")
        timeline = timelines[0]
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    base_name = name or f"postmortem_{timeline.id}"
    
    reporter = Reporter(config=config)
    
    markdown_path = output_path / f"{base_name}.md"
    reporter.export_markdown(timeline, markdown_path)
    
    csv_path = output_path / f"{base_name}_events.csv"
    reporter.export_csv(timeline, csv_path)
    
    click.echo(f"✅ 报告已生成:")
    click.echo(f"   📄 Markdown报告: {markdown_path}")
    click.echo(f"   📊 CSV事件清单: {csv_path}")
    
    click.echo(f"\n📈 报告概览:")
    click.echo(f"   时间线ID: {timeline.id}")
    click.echo(f"   事件数: {len(timeline.events)}")
    if timeline.start_time and timeline.end_time:
        duration = timeline.end_time - timeline.start_time
        click.echo(f"   持续时间: {duration}")


@cli.command()
@click.option('--service', '-s', help='按服务筛选')
@click.option('--start-date', '-d', type=click.DateTime(formats=['%Y-%m-%d', '%Y-%m-%d %H:%M:%S']),
              help='开始日期 (格式: YYYY-MM-DD)')
@click.option('--end-date', '-e', type=click.DateTime(formats=['%Y-%m-%d', '%Y-%m-%d %H:%M:%S']),
              help='结束日期 (格式: YYYY-MM-DD)')
@click.option('--severity', '-l', help='按严重级别筛选')
@click.option('--limit', '-n', type=int, default=10, help='显示数量限制，默认10')
@click.option('--full', '-f', is_flag=True, help='显示完整详情')
@click.pass_context
def history(ctx: click.Context, service: Optional[str], start_date: Optional[datetime], 
            end_date: Optional[datetime], severity: Optional[str], limit: int, full: bool):
    """查询历史复盘记录
    
    从本地存储查询过去的故障复盘时间线。
    
    示例:
      postmortem history
      postmortem history --service api-gateway --limit 20
      postmortem history --start-date 2024-01-01 --end-date 2024-01-31
    """
    project_dir = get_project_dir(ctx)
    storage = get_storage(project_dir)
    
    timelines = storage.list_timelines(limit=limit)
    
    if not timelines:
        click.echo("📭 没有找到历史记录")
        return
    
    filtered = timelines
    
    if service:
        filtered = [t for t in filtered if t.service == service]
    
    if severity:
        filtered = [t for t in filtered if any(e.severity == severity for e in t.events)]
    
    if start_date:
        filtered = [t for t in filtered if t.start_time and t.start_time >= start_date]
    
    if end_date:
        filtered = [t for t in filtered if t.end_time and t.end_time <= end_date]
    
    click.echo(f"📋 找到 {len(filtered)} 条历史记录:\n")
    
    for i, timeline in enumerate(filtered, 1):
        click.echo(f"{'='*60}")
        click.echo(f"[{i}] ID: {timeline.id}")
        click.echo(f"    标题: {timeline.title}")
        
        if timeline.start_time and timeline.end_time:
            duration = timeline.end_time - timeline.start_time
            click.echo(f"    时间: {timeline.start_time.strftime('%Y-%m-%d %H:%M:%S')} ~ {timeline.end_time.strftime('%Y-%m-%d %H:%M:%S')}")
            click.echo(f"    持续: {duration}")
        
        click.echo(f"    事件数: {len(timeline.events)}")
        
        if full:
            click.echo(f"\n    事件列表:")
            for j, event in enumerate(timeline.events[:20], 1):
                severity_tag = f"[{event.severity}]" if event.severity else ""
                click.echo(f"      {j}. {event.timestamp.strftime('%H:%M:%S')} {severity_tag} {event.event_type}: {event.title}")
            if len(timeline.events) > 20:
                click.echo(f"      ... 还有 {len(timeline.events) - 20} 条事件")
        
        click.echo()


if __name__ == '__main__':
    cli()
