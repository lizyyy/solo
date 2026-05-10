import click
from rich.console import Console
from rich.table import Table
from pathlib import Path
import json

from .config import Config
from .database import Database
from .data_access import DataAccess
from .scanner import DirectoryScanner
from .checker import VolumeChecker
from .reporter import Reporter


console = Console()
config = Config()


def get_services(db_path: str = None):
    db_path = db_path or config.get_db_path()
    db = Database(db_path)
    data_access = DataAccess(db)
    scanner = DirectoryScanner(config, data_access)
    checker = VolumeChecker(data_access)
    reporter = Reporter(data_access)
    return data_access, scanner, checker, reporter


@click.group()
@click.version_option()
def main():
    """古籍数字化页码校对 CLI 工具"""
    pass


@main.command()
@click.argument('scan_dir', type=click.Path(exists=True, file_okay=False))
@click.option('--recursive/--no-recursive', default=True, help='是否递归扫描子目录')
@click.option('--db', 'db_path', help='数据库文件路径')
def import_dir(scan_dir, recursive, db_path):
    """导入扫描目录，解析文件名中的卷次和页码"""
    data_access, scanner, _, _ = get_services(db_path)
    
    console.print(f"[bold blue]开始扫描目录:[/bold blue] {scan_dir}")
    console.print(f"[bold]递归扫描:[/bold] {recursive}")
    
    result = scanner.scan_directory(scan_dir, recursive)
    
    if not result['success']:
        console.print(f"[bold red]扫描失败:[/bold red] {result['error']}")
        return
    
    console.print("")
    console.print(f"[bold green]扫描完成[/bold green]")
    console.print(f"  会话ID: {result['session_id']}")
    console.print(f"  扫描目录: {result['scan_dir']}")
    console.print(f"  总文件数: {result['total_files']}")
    console.print(f"  成功解析: {result['parsed_files']}")
    console.print(f"  解析失败: {result['failed_files']}")


@main.command()
@click.option('--session-id', type=int, help='指定扫描会话ID，默认使用所有已导入的文件')
@click.option('--description', help='检查描述')
@click.option('--db', 'db_path', help='数据库文件路径')
def check(session_id, description, db_path):
    """执行卷次校验和缺页检测"""
    data_access, _, checker, _ = get_services(db_path)
    
    if session_id:
        console.print(f"[bold blue]使用会话ID:[/bold blue] {session_id}")
    else:
        console.print("[bold blue]检查所有已导入的文件[/bold blue]")
    
    result = checker.run_check(session_id=session_id, description=description)
    
    if not result['success']:
        console.print(f"[bold red]检查失败:[/bold red] {result['error']}")
        return
    
    console.print("")
    console.print(f"[bold green]检查完成[/bold green]")
    console.print(f"  检查运行ID: {result['check_run_id']}")
    console.print(f"  卷次总数: {result['total_volumes']}")
    console.print(f"  页面总数: {result['total_pages']}")
    console.print(f"  严重/错误: {result['error_count']}")
    console.print(f"  警告: {result['warning_count']}")
    
    if result['volume_numbers']:
        console.print(f"  卷次列表: {', '.join(map(str, result['volume_numbers']))}")


@main.group()
def query():
    """查询各类数据"""
    pass


@query.command(name='sessions')
@click.option('--db', 'db_path', help='数据库文件路径')
def query_sessions(db_path):
    """查询扫描会话历史"""
    data_access, _, _, _ = get_services(db_path)
    sessions = data_access.get_scan_sessions()
    
    if not sessions:
        console.print("[yellow]没有找到扫描会话[/yellow]")
        return
    
    table = Table(title="扫描会话历史")
    table.add_column("ID", style="cyan")
    table.add_column("扫描目录", style="green")
    table.add_column("时间", style="yellow")
    table.add_column("总文件", style="blue")
    table.add_column("成功", style="green")
    table.add_column("失败", style="red")
    
    for session in sessions:
        table.add_row(
            str(session['id']),
            session['scan_dir'],
            session['scan_time'],
            str(session['total_files']),
            str(session['parsed_files']),
            str(session['failed_files'])
        )
    
    console.print(table)


@query.command(name='files')
@click.option('--session-id', type=int, help='指定扫描会话ID')
@click.option('--status', type=click.Choice(['all', 'success', 'failed', 'pending']), default='all',
              help='按解析状态筛选')
@click.option('--db', 'db_path', help='数据库文件路径')
def query_files(session_id, status, db_path):
    """查询扫描文件详情"""
    data_access, _, _, _ = get_services(db_path)
    
    parse_status = None if status == 'all' else status
    files = data_access.get_scanned_files(session_id=session_id, parse_status=parse_status)
    
    if not files:
        console.print("[yellow]没有找到文件[/yellow]")
        return
    
    table = Table(title=f"扫描文件 ({len(files)} 个)")
    table.add_column("卷次", style="cyan")
    table.add_column("页码", style="cyan")
    table.add_column("文件名", style="green")
    table.add_column("状态", style="yellow")
    table.add_column("错误", style="red", overflow="fold")
    
    for f in files:
        status_style = "green" if f['parse_status'] == 'success' else "red"
        table.add_row(
            str(f['volume_number']) if f['volume_number'] is not None else "-",
            str(f['page_number']) if f['page_number'] is not None else "-",
            f['file_name'],
            f"[{status_style}]{f['parse_status']}[/{status_style}]",
            f['parse_error'] or "-"
        )
    
    console.print(table)


@query.command(name='checks')
@click.option('--db', 'db_path', help='数据库文件路径')
def query_checks(db_path):
    """查询检查运行历史"""
    data_access, _, _, _ = get_services(db_path)
    check_runs = data_access.get_check_runs()
    
    if not check_runs:
        console.print("[yellow]没有找到检查记录[/yellow]")
        return
    
    table = Table(title="检查运行历史")
    table.add_column("ID", style="cyan")
    table.add_column("时间", style="yellow")
    table.add_column("描述", style="green")
    
    for run in check_runs:
        table.add_row(
            str(run['id']),
            run['run_time'],
            run['description'] or "-"
        )
    
    console.print(table)


@query.command(name='volumes')
@click.argument('check_run_id', type=int)
@click.option('--db', 'db_path', help='数据库文件路径')
def query_volumes(check_run_id, db_path):
    """查询指定检查运行的卷次详情"""
    data_access, _, _, _ = get_services(db_path)
    volumes = data_access.get_volumes(check_run_id)
    
    if not volumes:
        console.print("[yellow]没有找到卷次记录[/yellow]")
        return
    
    table = Table(title=f"卷次详情 (检查运行 {check_run_id})")
    table.add_column("卷次", style="cyan")
    table.add_column("起始页", style="blue")
    table.add_column("结束页", style="blue")
    table.add_column("页数", style="green")
    table.add_column("状态", style="yellow")
    
    status_map = {
        'ok': ('正常', 'green'),
        'has_missing': ('有缺页', 'red'),
        'has_issues': ('有问题', 'yellow'),
        'pending': ('待检查', 'white')
    }
    
    for vol in volumes:
        status_text, status_color = status_map.get(vol['status'], (vol['status'], 'white'))
        table.add_row(
            str(vol['volume_number']),
            str(vol['actual_start_page']) or "-",
            str(vol['actual_end_page']) or "-",
            str(vol['actual_page_count']) or "-",
            f"[{status_color}]{status_text}[/{status_color}]"
        )
    
    console.print(table)


@query.command(name='pages')
@click.argument('check_run_id', type=int)
@click.option('--volume', type=int, help='指定卷次')
@click.option('--status', type=click.Choice(['all', 'ok', 'missing', 'duplicate']), default='all',
              help='按状态筛选')
@click.option('--db', 'db_path', help='数据库文件路径')
def query_pages(check_run_id, volume, status, db_path):
    """查询指定检查运行的页面详情"""
    data_access, _, _, _ = get_services(db_path)
    
    filter_status = None if status == 'all' else status
    pages = data_access.get_page_checks(check_run_id=check_run_id, 
                                        volume_number=volume, 
                                        status=filter_status)
    
    if not pages:
        console.print("[yellow]没有找到页面记录[/yellow]")
        return
    
    table = Table(title=f"页面详情 (检查运行 {check_run_id})")
    table.add_column("卷次", style="cyan")
    table.add_column("页码", style="cyan")
    table.add_column("状态", style="yellow")
    table.add_column("文件路径", style="green", overflow="fold")
    table.add_column("问题", style="red", overflow="fold")
    
    status_map = {
        'ok': ('正常', 'green'),
        'missing': ('缺失', 'red'),
        'duplicate': ('重复', 'yellow')
    }
    
    for page in pages:
        status_text, status_color = status_map.get(page['status'], (page['status'], 'white'))
        table.add_row(
            str(page['volume_number']),
            str(page['page_number']),
            f"[{status_color}]{status_text}[/{status_color}]",
            page['file_path'] or "-",
            page['issues'] or "-"
        )
    
    console.print(table)


@query.command(name='exceptions')
@click.option('--resolved', 'show_resolved', is_flag=True, help='显示已解决的异常')
@click.option('--type', 'exception_type', help='按异常类型筛选')
@click.option('--check-run', type=int, help='指定检查运行ID')
@click.option('--json', 'output_json', is_flag=True, help='以JSON格式输出')
@click.option('--db', 'db_path', help='数据库文件路径')
def query_exceptions(show_resolved, exception_type, check_run, output_json, db_path):
    """查询异常列表"""
    data_access, _, _, _ = get_services(db_path)
    
    resolved = None
    if show_resolved:
        resolved = True
    else:
        resolved = False
    
    exceptions = data_access.get_exceptions(
        resolved=resolved,
        exception_type=exception_type,
        check_run_id=check_run
    )
    
    if not exceptions:
        console.print("[yellow]没有找到异常记录[/yellow]")
        return
    
    if output_json:
        console.print(json.dumps(exceptions, ensure_ascii=False, indent=2, default=str))
        return
    
    table = Table(title=f"异常列表 ({len(exceptions)} 个)")
    table.add_column("ID", style="cyan")
    table.add_column("类型", style="blue")
    table.add_column("严重程度", style="yellow")
    table.add_column("标题", style="green", overflow="fold")
    table.add_column("来源", style="white", overflow="fold")
    table.add_column("创建时间", style="magenta")
    
    severity_colors = {
        'critical': 'red',
        'error': 'red',
        'warning': 'yellow',
        'info': 'blue'
    }
    
    for e in exceptions:
        severity = e['severity']
        color = severity_colors.get(severity, 'white')
        table.add_row(
            str(e['id']),
            e['exception_type'],
            f"[{color}]{severity}[/{color}]",
            e['title'],
            e['source_reference'] or "-",
            e['created_at']
        )
    
    console.print(table)


@query.command(name='exception-detail')
@click.argument('exception_id', type=int)
@click.option('--db', 'db_path', help='数据库文件路径')
def query_exception_detail(exception_id, db_path):
    """查询单个异常的详细信息"""
    data_access, _, _, _ = get_services(db_path)
    
    exceptions = data_access.get_exceptions()
    target = None
    for e in exceptions:
        if e['id'] == exception_id:
            target = e
            break
    
    if not target:
        console.print(f"[red]未找到异常 ID {exception_id}[/red]")
        return
    
    console.print(f"[bold]异常 ID:[/bold] {target['id']}")
    console.print(f"[bold]类型:[/bold] {target['exception_type']}")
    console.print(f"[bold]严重程度:[/bold] {target['severity']}")
    console.print(f"[bold]标题:[/bold] {target['title']}")
    console.print(f"[bold]描述:[/bold] {target['description'] or '-'}")
    console.print(f"[bold]来源类型:[/bold] {target['source_type'] or '-'}")
    console.print(f"[bold]来源引用:[/bold] {target['source_reference'] or '-'}")
    
    if target['source_data']:
        console.print(f"[bold]来源数据:[/bold]")
        console.print(json.dumps(target['source_data'], ensure_ascii=False, indent=2))
    
    console.print(f"[bold]创建时间:[/bold] {target['created_at']}")
    console.print(f"[bold]是否已解决:[/bold] {'是' if target['resolved'] else '否'}")
    if target['resolved']:
        console.print(f"[bold]解决时间:[/bold] {target['resolved_at']}")
        console.print(f"[bold]解决人:[/bold] {target['resolved_by']}")


@query.command(name='revisions')
@click.option('--entity-type', help='按实体类型筛选')
@click.option('--entity-id', type=int, help='按实体ID筛选')
@click.option('--limit', type=int, default=50, help='返回记录数限制')
@click.option('--db', 'db_path', help='数据库文件路径')
def query_revisions(entity_type, entity_id, limit, db_path):
    """查询修订历史"""
    data_access, _, _, _ = get_services(db_path)
    
    revisions = data_access.get_revisions(
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit
    )
    
    if not revisions:
        console.print("[yellow]没有找到修订记录[/yellow]")
        return
    
    table = Table(title=f"修订历史 ({len(revisions)} 条)")
    table.add_column("时间", style="yellow")
    table.add_column("实体", style="cyan")
    table.add_column("操作", style="blue")
    table.add_column("旧值", style="red", overflow="fold")
    table.add_column("新值", style="green", overflow="fold")
    table.add_column("原因", style="white", overflow="fold")
    
    for rev in revisions:
        table.add_row(
            rev['changed_at'],
            f"{rev['entity_type']}#{rev['entity_id']}",
            rev['action'],
            rev['old_value'] or "-",
            rev['new_value'] or "-",
            rev['change_reason'] or "-"
        )
    
    console.print(table)


@main.command()
@click.option('--check-run', type=int, help='指定检查运行ID，默认使用最新的')
@click.option('--output', 'output_path', default='page_check_report.md', help='输出文件路径')
@click.option('--db', 'db_path', help='数据库文件路径')
def report(check_run, output_path, db_path):
    """生成校对报告"""
    data_access, _, _, reporter = get_services(db_path)
    
    if not check_run:
        latest = data_access.get_latest_check_run()
        if not latest:
            console.print("[red]没有找到检查记录，请先运行 check 命令[/red]")
            return
        check_run = latest['id']
        console.print(f"[yellow]使用最新的检查运行: ID {check_run}[/yellow]")
    
    try:
        result = reporter.generate_markdown_report(check_run, output_path)
        console.print(f"[bold green]报告已生成:[/bold green] {result}")
    except Exception as e:
        console.print(f"[bold red]生成报告失败:[/bold red] {str(e)}")


@main.command()
@click.argument('exception_id', type=int)
@click.option('--resolved-by', default='manual', help='解决人标识')
@click.option('--db', 'db_path', help='数据库文件路径')
def resolve(exception_id, resolved_by, db_path):
    """标记异常为已解决"""
    data_access, _, _, _ = get_services(db_path)
    
    exceptions = data_access.get_exceptions()
    target = None
    for e in exceptions:
        if e['id'] == exception_id:
            target = e
            break
    
    if not target:
        console.print(f"[red]未找到异常 ID {exception_id}[/red]")
        return
    
    data_access.resolve_exception(exception_id, resolved_by)
    console.print(f"[bold green]已将异常 {exception_id} 标记为已解决[/bold green]")


@main.command()
@click.argument('file_path', type=click.Path())
@click.option('--volume', 'new_volume', type=int, required=True, help='修正后的卷次')
@click.option('--page', 'new_page', type=int, required=True, help='修正后的页码')
@click.option('--reason', help='修复原因')
@click.option('--db', 'db_path', help='数据库文件路径')
def fix(file_path, new_volume, new_page, reason, db_path):
    """记录手动修复（重命名文件后需重新导入）"""
    data_access, _, _, _ = get_services(db_path)
    
    files = data_access.get_scanned_files()
    original = None
    for f in files:
        if f['file_path'] == file_path or f['file_name'] == Path(file_path).name:
            original = f
            break
    
    original_volume = original['volume_number'] if original else None
    original_page = original['page_number'] if original else None
    
    data_access.insert_manual_fix(
        file_path=file_path,
        original_volume=original_volume,
        original_page=original_page,
        corrected_volume=new_volume,
        corrected_page=new_page,
        fix_reason=reason
    )
    
    console.print(f"[bold green]已记录手动修复[/bold green]")
    console.print(f"  文件: {file_path}")
    console.print(f"  原卷次/页码: {original_volume or '-'}/{original_page or '-'}")
    console.print(f"  新卷次/页码: {new_volume}/{new_page}")
    if reason:
        console.print(f"  原因: {reason}")
    console.print(f"[yellow]提示: 请手动重命名文件后重新运行 import 和 check 命令[/yellow]")


if __name__ == '__main__':
    main()
