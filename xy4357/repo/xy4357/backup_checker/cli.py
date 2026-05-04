import os
import sys
from datetime import datetime
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn

from backup_checker import __version__
from backup_checker.config import load_config, generate_sample_config, BackupTask, AppConfig
from backup_checker.database import DatabaseManager
from backup_checker.scanner import FileScanner, ParallelFileScanner
from backup_checker.comparator import BackupComparator, AnomalyType, format_file_size
from backup_checker.report import generate_markdown_report, generate_html_report


console = Console()


@click.group()
@click.version_option(__version__)
@click.option('--config', '-c', type=click.Path(exists=True), 
              default='config.yaml', help='配置文件路径')
@click.pass_context
def main(ctx, config):
    ctx.ensure_object(dict)
    ctx.obj['config_path'] = config
    if os.path.exists(config):
        ctx.obj['config'] = load_config(config)
    else:
        ctx.obj['config'] = None


@main.command()
@click.option('--output', '-o', type=click.Path(), default='config.yaml',
              help='输出配置文件路径')
def init(output):
    if os.path.exists(output):
        if not click.confirm(f'配置文件 {output} 已存在，是否覆盖？'):
            click.echo('操作已取消。')
            return
    
    sample_config = generate_sample_config()
    with open(output, 'w', encoding='utf-8') as f:
        f.write(sample_config)
    
    console.print(f'[green]✓[/green] 已创建示例配置文件: {output}')
    console.print('请编辑该文件，配置您的源目录和目标目录。')


@main.command()
@click.option('--task', '-t', help='指定任务名称（不指定则运行所有启用的任务）')
@click.option('--quick', '-q', is_flag=True, help='快速模式（仅比较文件名和大小，不计算哈希）')
@click.option('--parallel/--no-parallel', default=None, help='是否使用并行扫描')
@click.pass_context
def check(ctx, task, quick, parallel):
    config = ctx.obj.get('config')
    if not config:
        console.print('[red]错误:[/red] 未找到配置文件，请先运行 init 命令或指定 --config 参数')
        sys.exit(1)
    
    db = DatabaseManager(config.db_path)
    
    tasks_to_run = []
    if task:
        for t in config.tasks:
            if t.name == task:
                tasks_to_run.append(t)
                break
        if not tasks_to_run:
            console.print(f'[red]错误:[/red] 未找到任务 "{task}"')
            sys.exit(1)
    else:
        tasks_to_run = [t for t in config.tasks if t.enabled]
    
    if not tasks_to_run:
        console.print('[yellow]警告:[/yellow] 没有启用的任务可运行')
        return
    
    use_parallel = parallel if parallel is not None else config.parallel
    hash_type = 'md5' if not quick else None
    
    for backup_task in tasks_to_run:
        console.print(f'\n[bold blue]=== 执行任务: {backup_task.name} ===[/bold blue]')
        
        task_id = db.create_task(
            name=backup_task.name,
            source_dir=backup_task.source_dir,
            target_dir=backup_task.target_dir,
            retention_days=backup_task.retention_days,
        )
        
        scan_id = db.create_scan(task_id)
        
        scanner_class = ParallelFileScanner if use_parallel else FileScanner
        scanner_kwargs = {
            'extensions': backup_task.extensions,
            'compute_hash': not quick,
            'hash_type': config.hash_type,
        }
        if use_parallel:
            scanner_kwargs['max_workers'] = config.max_workers
        
        scanner = scanner_class(**scanner_kwargs)
        
        try:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TextColumn("{task.completed}/{task.total}"),
                console=console,
            ) as progress:
                
                scan_task = progress.add_task("扫描源目录...", total=None)
                source_files = scanner.scan_directory(backup_task.source_dir)
                progress.update(scan_task, completed=len(source_files), total=len(source_files))
                console.print(f'  源目录文件数: {len(source_files)}')
                
                scan_task = progress.add_task("扫描目标目录...", total=None)
                target_files = scanner.scan_directory(backup_task.target_dir)
                progress.update(scan_task, completed=len(target_files), total=len(target_files))
                console.print(f'  目标目录文件数: {len(target_files)}')
            
            for f in source_files:
                db.add_file_record(
                    scan_id=scan_id,
                    task_id=task_id,
                    path=f['path'],
                    is_source=True,
                    filename=f['filename'],
                    size=f['size'],
                    modified_at=f['modified_at'],
                    hash_md5=f.get('hash_md5'),
                    hash_sha256=f.get('hash_sha256'),
                )
            
            for f in target_files:
                db.add_file_record(
                    scan_id=scan_id,
                    task_id=task_id,
                    path=f['path'],
                    is_source=False,
                    filename=f['filename'],
                    size=f['size'],
                    modified_at=f['modified_at'],
                    hash_md5=f.get('hash_md5'),
                    hash_sha256=f.get('hash_sha256'),
                )
            
            db.update_scan(
                scan_id=scan_id,
                status='completed',
                completed_at=datetime.now().isoformat(),
                source_files_count=len(source_files),
                target_files_count=len(target_files),
            )
            
            console.print('[green]✓[/green] 扫描完成，开始比较...')
            
            comparator = BackupComparator(
                hash_type=config.hash_type,
                compare_hash=not quick,
            )
            
            comparison_id = db.create_comparison(scan_id)
            
            if quick:
                result = comparator.compare_with_size_fallback(source_files, target_files)
            else:
                result = comparator.compare(source_files, target_files)
            
            for f in result.missing_in_target:
                db.add_anomaly(
                    comparison_id=comparison_id,
                    anomaly_type=AnomalyType.MISSING_IN_TARGET.value,
                    source_path=f['path'],
                    details=f"文件名: {f['filename']}, 大小: {format_file_size(f['size'])}",
                )
            
            for f in result.extra_in_target:
                db.add_anomaly(
                    comparison_id=comparison_id,
                    anomaly_type=AnomalyType.EXTRA_IN_TARGET.value,
                    target_path=f['path'],
                    details=f"文件名: {f['filename']}, 大小: {format_file_size(f['size'])}",
                )
            
            for dup in result.possible_duplicates:
                file_paths = '\n'.join([f['path'] for f in dup['files']])
                db.add_anomaly(
                    comparison_id=comparison_id,
                    anomaly_type=AnomalyType.POSSIBLE_DUPLICATE.value,
                    details=f"哈希: {dup['hash']}, 位置: {dup['location']}\n文件列表:\n{file_paths}",
                )
            
            for mismatch in result.hash_mismatches:
                db.add_anomaly(
                    comparison_id=comparison_id,
                    anomaly_type=AnomalyType.HASH_MISMATCH.value,
                    source_path=mismatch['source']['path'],
                    target_path=mismatch['target']['path'],
                    details=f"源哈希: {mismatch['source_hash']}, 目标哈希: {mismatch['target_hash']}",
                )
            
            db.update_comparison(
                comparison_id=comparison_id,
                status='completed',
                completed_at=datetime.now().isoformat(),
                missing_in_target=len(result.missing_in_target),
                extra_in_target=len(result.extra_in_target),
                possible_duplicates=len(result.possible_duplicates),
                hash_mismatch=len(result.hash_mismatches),
            )
            
            total_anomalies = (
                len(result.missing_in_target) +
                len(result.extra_in_target) +
                len(result.possible_duplicates) +
                len(result.hash_mismatches)
            )
            
            if total_anomalies > 0:
                console.print(f'[yellow]⚠[/yellow] 发现 {total_anomalies} 个异常:')
                if result.missing_in_target:
                    console.print(f'  - 目标目录缺失: {len(result.missing_in_target)} 个文件')
                if result.extra_in_target:
                    console.print(f'  - 目标目录多余: {len(result.extra_in_target)} 个文件')
                if result.possible_duplicates:
                    console.print(f'  - 疑似重复: {len(result.possible_duplicates)} 组')
                if result.hash_mismatches:
                    console.print(f'  - 哈希不一致: {len(result.hash_mismatches)} 个文件')
            else:
                console.print('[green]✓[/green] 未发现异常，备份状态良好！')
            
            ctx.obj['last_comparison_id'] = comparison_id
            
        except Exception as e:
            db.update_scan(
                scan_id=scan_id,
                status='failed',
                error_message=str(e),
            )
            console.print(f'[red]✗[/red] 任务执行失败: {e}')
            import traceback
            traceback.print_exc()
    
    console.print(f'\n[bold]扫描记录 ID: {scan_id}[/bold]')
    console.print('使用 `backup-checker report` 命令生成详细报告')


@main.command()
@click.option('--comparison', '-c', 'comparison_id', type=int, help='指定比较记录 ID')
@click.option('--scan', '-s', 'scan_id', type=int, help='指定扫描记录 ID')
@click.option('--format', '-f', 'fmt', type=click.Choice(['markdown', 'html', 'both']), 
              default='both', help='报告格式')
@click.option('--output', '-o', type=click.Path(), help='输出目录（默认 reports/）')
@click.pass_context
def report(ctx, comparison_id, scan_id, fmt, output):
    config = ctx.obj.get('config')
    if not config:
        console.print('[red]错误:[/red] 未找到配置文件')
        sys.exit(1)
    
    db = DatabaseManager(config.db_path)
    
    if not comparison_id and not scan_id:
        comparison_id = ctx.obj.get('last_comparison_id')
        if not comparison_id:
            recent_scans = db.get_recent_scans(1)
            if recent_scans:
                scan_id = recent_scans[0]['id']
            else:
                console.print('[red]错误:[/red] 未找到扫描记录，请先运行 check 命令')
                sys.exit(1)
    
    if scan_id:
        scan = db.get_scan(scan_id)
        if not scan:
            console.print(f'[red]错误:[/red] 未找到扫描记录 ID: {scan_id}')
            sys.exit(1)
        comparison = db.get_latest_comparison_for_task(scan['task_id'])
        if comparison:
            comparison_id = comparison['id']
    
    if not comparison_id:
        console.print('[red]错误:[/red] 未找到比较记录')
        sys.exit(1)
    
    comparison_data = db.get_comparison(comparison_id)
    if not comparison_data:
        console.print(f'[red]错误:[/red] 未找到比较记录 ID: {comparison_id}')
        sys.exit(1)
    
    anomalies = db.get_anomalies(comparison_id=comparison_id)
    
    output_dir = output or config.reports_dir
    os.makedirs(output_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = f"backup_report_{comparison_data['task_name']}_{timestamp}"
    
    if fmt in ('markdown', 'both'):
        md_path = os.path.join(output_dir, f'{base_name}.md')
        markdown = generate_markdown_report(comparison_data, anomalies)
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(markdown)
        console.print(f'[green]✓[/green] Markdown 报告已生成: {md_path}')
    
    if fmt in ('html', 'both'):
        html_path = os.path.join(output_dir, f'{base_name}.html')
        html = generate_html_report(comparison_data, anomalies)
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)
        console.print(f'[green]✓[/green] HTML 报告已生成: {html_path}')


@main.command('list')
@click.option('--tasks', is_flag=True, help='列出所有任务')
@click.option('--scans', is_flag=True, help='列出最近的扫描记录')
@click.option('--limit', '-n', type=int, default=10, help='显示记录数量')
@click.pass_context
def list_cmd(ctx, tasks, scans, limit):
    config = ctx.obj.get('config')
    if not config:
        console.print('[red]错误:[/red] 未找到配置文件')
        sys.exit(1)
    
    db = DatabaseManager(config.db_path)
    
    if tasks:
        all_tasks = db.get_all_tasks()
        if not all_tasks:
            console.print('[yellow]没有任务记录[/yellow]')
            return
        
        table = Table(title="任务列表")
        table.add_column("ID", style="cyan")
        table.add_column("名称", style="bold")
        table.add_column("源目录", style="green")
        table.add_column("目标目录", style="blue")
        table.add_column("保留天数", style="magenta")
        table.add_column("更新时间", style="yellow")
        
        for t in all_tasks:
            table.add_row(
                str(t['id']),
                t['name'],
                t['source_dir'][:40] + '...' if len(t['source_dir']) > 40 else t['source_dir'],
                t['target_dir'][:40] + '...' if len(t['target_dir']) > 40 else t['target_dir'],
                str(t['retention_days']),
                t['updated_at'][:19] if t['updated_at'] else '-',
            )
        
        console.print(table)
    
    if scans or not tasks:
        recent_scans = db.get_recent_scans(limit)
        if not recent_scans:
            console.print('[yellow]没有扫描记录[/yellow]')
            return
        
        table = Table(title="最近扫描记录")
        table.add_column("ID", style="cyan")
        table.add_column("任务", style="bold")
        table.add_column("开始时间", style="green")
        table.add_column("状态", style="yellow")
        table.add_column("源文件数", style="blue")
        table.add_column("目标文件数", style="magenta")
        
        for s in recent_scans:
            status_style = "green" if s['status'] == 'completed' else "red" if s['status'] == 'failed' else "yellow"
            table.add_row(
                str(s['id']),
                s['task_name'],
                s['started_at'][:19] if s['started_at'] else '-',
                f"[{status_style}]{s['status']}[/{status_style}]",
                str(s['source_files_count']),
                str(s['target_files_count']),
            )
        
        console.print(table)


@main.command()
@click.argument('anomaly_id', type=int)
@click.pass_context
def confirm(ctx, anomaly_id):
    config = ctx.obj.get('config')
    if not config:
        console.print('[red]错误:[/red] 未找到配置文件')
        sys.exit(1)
    
    db = DatabaseManager(config.db_path)
    
    anomalies = db.get_anomalies()
    target_anomaly = None
    for a in anomalies:
        if a['id'] == anomaly_id:
            target_anomaly = a
            break
    
    if not target_anomaly:
        console.print(f'[red]错误:[/red] 未找到异常记录 ID: {anomaly_id}')
        sys.exit(1)
    
    if target_anomaly['manually_confirmed']:
        console.print(f'[yellow]该异常已被确认[/yellow]')
        return
    
    console.print(f'\n异常详情:')
    console.print(f'  类型: {target_anomaly["anomaly_type"]}')
    if target_anomaly['source_path']:
        console.print(f'  源路径: {target_anomaly["source_path"]}')
    if target_anomaly['target_path']:
        console.print(f'  目标路径: {target_anomaly["target_path"]}')
    console.print(f'  详情: {target_anomaly["details"]}')
    
    if click.confirm('\n是否标记为已人工确认？'):
        db.confirm_anomaly(anomaly_id)
        console.print(f'[green]✓[/green] 已标记异常 {anomaly_id} 为已确认')


@main.command()
@click.option('--host', '-h', default='127.0.0.1', help='绑定地址')
@click.option('--port', '-p', type=int, default=5000, help='绑定端口')
@click.option('--debug', '-d', is_flag=True, help='调试模式')
@click.pass_context
def serve(ctx, host, port, debug):
    config = ctx.obj.get('config')
    if not config:
        console.print('[red]错误:[/red] 未找到配置文件')
        sys.exit(1)
    
    from backup_checker.web_server import create_app
    
    app = create_app(config)
    console.print(f'\n[bold green]🚀 启动 Web 服务器[/bold green]')
    console.print(f'   地址: http://{host}:{port}')
    console.print(f'   按 Ctrl+C 停止\n')
    
    app.run(host=host, port=port, debug=debug, use_reloader=False)


if __name__ == '__main__':
    main()
