import click
from pathlib import Path
from .issue_manager import QualityChecker
from .config import get_report_dir, ensure_directories


@click.group()
@click.version_option()
def main():
    """课程视频字幕质检 CLI 工具"""
    ensure_directories()


@main.command()
@click.argument('path', type=click.Path(exists=True))
@click.option('--doc', 'doc_path', type=click.Path(exists=True), help='课程讲义文件路径')
@click.option('--glossary', 'glossary_path', type=click.Path(exists=True), help='术语表文件路径 (JSON格式)')
@click.option('--recursive', '-r', is_flag=True, help='递归扫描子目录')
def scan(path, doc_path, glossary_path, recursive):
    """扫描字幕文件或目录"""
    checker = QualityChecker()
    path_obj = Path(path)
    
    if path_obj.is_file():
        result = checker.scan_file(str(path_obj), doc_path, glossary_path)
        click.echo(f"扫描完成: {result['file_path']}")
        click.echo(f"字幕数量: {result['subtitle_count']}")
        click.echo(f"发现问题: {result['issues_found']} 个")
        for issue in result['issues']:
            click.echo(f"  - [{issue['issue_type']}] {issue['description']}")
    elif path_obj.is_dir():
        results = checker.scan_directory(str(path_obj), doc_path, glossary_path)
        total_files = 0
        total_issues = 0
        for result in results:
            if 'error' in result:
                click.echo(f"错误: {result['file_path']} - {result['error']}")
            else:
                total_files += 1
                total_issues += result['issues_found']
                click.echo(f"扫描: {result['file_path']}")
                click.echo(f"  字幕: {result['subtitle_count']}, 问题: {result['issues_found']}")
        click.echo(f"\n总计: 扫描了 {total_files} 个文件，发现 {total_issues} 个问题")
    else:
        click.echo(f"无效路径: {path}")


@main.command()
@click.option('--file', 'file_path', type=click.Path(), help='指定字幕文件路径')
@click.option('--status', '-s', type=click.Choice(['open', 'resolved', 'all']), default='open', help='问题状态')
@click.option('--format', '-f', 'output_format', type=click.Choice(['text', 'json']), default='text', help='输出格式')
def list(file_path, status, output_format):
    """查看问题列表"""
    checker = QualityChecker()
    if status == 'all':
        status = None
    
    issues = checker.list_issues(file_path=file_path, status=status)
    
    if output_format == 'json':
        import json
        click.echo(json.dumps(issues, ensure_ascii=False, indent=2))
    else:
        if not issues:
            click.echo("没有发现问题")
            return
        
        click.echo(f"共发现 {len(issues)} 个问题:\n")
        for issue in issues:
            click.echo(f"ID: {issue['id']}")
            click.echo(f"文件: {issue['file_path']}")
            click.echo(f"类型: {issue['issue_type']}")
            if issue['start_time'] and issue['end_time']:
                click.echo(f"时间: {issue['start_time']} - {issue['end_time']}")
            if issue['subtitle_index']:
                click.echo(f"索引: {issue['subtitle_index']}")
            click.echo(f"状态: {issue['status']}")
            click.echo(f"描述: {issue['description']}")
            click.echo(f"建议: {issue['suggestion']}")
            click.echo("-" * 50)


@main.command()
@click.argument('issue_id', type=int)
@click.option('--reopen', is_flag=True, help='重新打开问题')
@click.option('--user', '-u', default='user', help='处理人')
def resolve(issue_id, reopen, user):
    """标记问题已处理或重新打开"""
    checker = QualityChecker()
    
    if reopen:
        success = checker.reopen_issue(issue_id)
        if success:
            click.echo(f"问题 {issue_id} 已重新打开")
        else:
            click.echo(f"无法打开问题 {issue_id}")
    else:
        success = checker.resolve_issue(issue_id, user)
        if success:
            click.echo(f"问题 {issue_id} 已标记为已处理")
        else:
            click.echo(f"无法处理问题 {issue_id}")


@main.command()
@click.option('--output', '-o', 'output_path', type=click.Path(), help='报告输出路径')
@click.option('--file', 'file_path', type=click.Path(), help='指定字幕文件')
@click.option('--status', '-s', type=click.Choice(['open', 'resolved', 'all']), default='all', help='问题状态')
@click.option('--format', '-f', 'report_format', type=click.Choice(['md', 'html']), default='md', help='报告格式')
def report(output_path, file_path, status, report_format):
    """导出质检报告"""
    checker = QualityChecker()
    if status == 'all':
        status = None
    
    if not output_path:
        report_dir = get_report_dir()
        from datetime import datetime
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_path = str(report_dir / f"qc_report_{timestamp}.{report_format}")
    
    result = checker.export_report(output_path, file_path=file_path, status=status)
    
    if 'error' in result:
        click.echo(f"错误: {result['error']}")
    else:
        click.echo(f"报告已生成: {result['report_path']}")
        click.echo(f"包含 {result['total_issues']} 个问题，涉及 {result['files_scanned']} 个文件")


if __name__ == '__main__':
    main()
