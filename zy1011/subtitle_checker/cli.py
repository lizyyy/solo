import os
import sys
from pathlib import Path
from typing import List

import click

from subtitle_checker.models import ScanResult, Severity, IssueType
from subtitle_checker.parser import SubtitleParser
from subtitle_checker.checker import RuleChecker, CheckerConfig, load_chapters
from subtitle_checker.fixer import SubtitleFixer, FixerConfig
from subtitle_checker.reporter import ReportGenerator


@click.group()
def main():
    """字幕时间轴检查和整理工具
    
    用于检查和整理 SRT/VTT 字幕文件的命令行工具。
    """
    pass


@main.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--chapters', '-c', type=click.Path(exists=True, dir_okay=False),
              help='章节配置文件 (chapters.json)')
@click.option('--long-gap', type=int, default=5000,
              help='长间隔阈值 (毫秒), 默认 5000ms')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def scan(directory, chapters, long_gap, verbose):
    """扫描字幕目录并打印检查摘要
    
    DIRECTORY: 包含字幕文件的目录路径
    """
    parser = SubtitleParser()
    checker_config = CheckerConfig()
    checker_config.long_gap_threshold_ms = long_gap
    checker = RuleChecker(checker_config)
    
    scan_result = ScanResult()
    
    subtitle_files = []
    dir_path = Path(directory)
    
    extensions = ['**/*.srt', '**/*.vtt']
    for ext in extensions:
        for file_path in dir_path.glob(ext):
            if parser.can_parse(str(file_path)):
                subtitle_files.append(str(file_path))
    
    if not subtitle_files:
        click.echo(f"在目录 {directory} 中未找到字幕文件 (.srt 或 .vtt)")
        return
    
    click.echo(f"找到 {len(subtitle_files)} 个字幕文件:")
    for f in subtitle_files:
        click.echo(f"  - {f}")
    click.echo()
    
    for file_path in subtitle_files:
        try:
            subtitle_file = parser.parse_file(file_path)
            scan_result.files.append(subtitle_file)
        except Exception as e:
            click.echo(f"警告: 无法解析文件 {file_path}: {e}")
    
    chapters_list = []
    if chapters:
        chapters_list = load_chapters(chapters)
        scan_result.chapters = chapters_list
        click.echo(f"加载了 {len(chapters_list)} 个章节配置")
    click.echo()
    
    scan_result.issues = checker.check_all(scan_result.files, chapters_list)
    
    _print_scan_summary(scan_result, verbose)


@main.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--output', '-o', type=click.Path(file_okay=False, dir_okay=True),
              required=True, help='输出目录路径')
@click.option('--chapters', '-c', type=click.Path(exists=True, dir_okay=False),
              help='章节配置文件 (chapters.json)')
@click.option('--long-gap', type=int, default=5000,
              help='长间隔阈值 (毫秒), 默认 5000ms')
@click.option('--fix-empty', is_flag=True, help='自动删除空字幕')
@click.option('--fix-duplicate', is_flag=True, help='自动删除重复字幕')
@click.option('--overwrite', is_flag=True, help='覆盖已存在的文件')
def fix(directory, output, chapters, long_gap, fix_empty, fix_duplicate, overwrite):
    """生成修正后的字幕副本
    
    DIRECTORY: 包含字幕文件的目录路径
    """
    parser = SubtitleParser()
    checker_config = CheckerConfig()
    checker_config.long_gap_threshold_ms = long_gap
    checker = RuleChecker(checker_config)
    
    fixer_config = FixerConfig()
    fixer_config.auto_fix_empty = fix_empty
    fixer_config.auto_fix_duplicate = fix_duplicate
    fixer = SubtitleFixer(fixer_config)
    
    scan_result = ScanResult()
    
    subtitle_files = []
    dir_path = Path(directory)
    
    extensions = ['**/*.srt', '**/*.vtt']
    for ext in extensions:
        for file_path in dir_path.glob(ext):
            if parser.can_parse(str(file_path)):
                subtitle_files.append(str(file_path))
    
    if not subtitle_files:
        click.echo(f"在目录 {directory} 中未找到字幕文件 (.srt 或 .vtt)")
        return
    
    click.echo(f"找到 {len(subtitle_files)} 个字幕文件")
    
    for file_path in subtitle_files:
        try:
            subtitle_file = parser.parse_file(file_path)
            scan_result.files.append(subtitle_file)
        except Exception as e:
            click.echo(f"警告: 无法解析文件 {file_path}: {e}")
    
    chapters_list = []
    if chapters:
        chapters_list = load_chapters(chapters)
        scan_result.chapters = chapters_list
    
    scan_result.issues = checker.check_all(scan_result.files, chapters_list)
    
    _print_scan_summary(scan_result, verbose=False)
    
    output_path = Path(output)
    
    if output_path.exists() and any(output_path.iterdir()):
        if not overwrite:
            click.confirm(
                f"输出目录 {output} 已存在且非空。是否继续？",
                abort=True
            )
    
    output_path.mkdir(parents=True, exist_ok=True)
    
    click.echo()
    click.echo("开始修复...")
    
    fixed_files = fixer.fix_all(scan_result, output)
    
    click.echo()
    click.echo(f"修复完成!")
    click.echo(f"输出目录: {output}")
    click.echo()
    click.echo("修复的文件:")
    for original, fixed in fixed_files.items():
        click.echo(f"  {original} -> {fixed}")


@main.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--output', '-o', type=click.Path(dir_okay=False),
              required=True, help='输出报告文件路径')
@click.option('--chapters', '-c', type=click.Path(exists=True, dir_okay=False),
              help='章节配置文件 (chapters.json)')
@click.option('--long-gap', type=int, default=5000,
              help='长间隔阈值 (毫秒), 默认 5000ms')
@click.option('--format', '-f', 'fmt',
              type=click.Choice(['markdown', 'html']),
              default='html', help='报告格式')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def report(directory, output, chapters, long_gap, fmt, verbose):
    """导出检查报告
    
    DIRECTORY: 包含字幕文件的目录路径
    """
    parser = SubtitleParser()
    checker_config = CheckerConfig()
    checker_config.long_gap_threshold_ms = long_gap
    checker = RuleChecker(checker_config)
    reporter = ReportGenerator()
    
    scan_result = ScanResult()
    
    subtitle_files = []
    dir_path = Path(directory)
    
    extensions = ['**/*.srt', '**/*.vtt']
    for ext in extensions:
        for file_path in dir_path.glob(ext):
            if parser.can_parse(str(file_path)):
                subtitle_files.append(str(file_path))
    
    if not subtitle_files:
        click.echo(f"在目录 {directory} 中未找到字幕文件 (.srt 或 .vtt)")
        return
    
    click.echo(f"找到 {len(subtitle_files)} 个字幕文件")
    
    for file_path in subtitle_files:
        try:
            subtitle_file = parser.parse_file(file_path)
            scan_result.files.append(subtitle_file)
        except Exception as e:
            click.echo(f"警告: 无法解析文件 {file_path}: {e}")
    
    chapters_list = []
    if chapters:
        chapters_list = load_chapters(chapters)
        scan_result.chapters = chapters_list
    
    scan_result.issues = checker.check_all(scan_result.files, chapters_list)
    
    _print_scan_summary(scan_result, verbose=verbose)
    
    click.echo()
    click.echo(f"生成 {fmt.upper()} 报告...")
    
    output_path = Path(output)
    
    if fmt == 'markdown':
        if not output_path.suffix:
            output_path = output_path.with_suffix('.md')
        reporter.generate_markdown(scan_result, str(output_path))
    else:
        if not output_path.suffix:
            output_path = output_path.with_suffix('.html')
        reporter.generate_html(scan_result, str(output_path))
    
    click.echo(f"报告已生成: {output_path}")


def _print_scan_summary(scan_result: ScanResult, verbose: bool):
    """打印扫描摘要"""
    click.echo("=" * 60)
    click.echo("扫描摘要")
    click.echo("=" * 60)
    click.echo()
    
    click.echo(f"文件数: {scan_result.total_files()}")
    click.echo(f"字幕条目总数: {scan_result.total_entries()}")
    click.echo()
    
    severity_counts = scan_result.count_issues_by_severity()
    click.echo(f"发现问题总数: {len(scan_result.issues)}")
    click.echo(f"  - 错误 (ERROR): {severity_counts[Severity.ERROR]}")
    click.echo(f"  - 警告 (WARNING): {severity_counts[Severity.WARNING]}")
    click.echo(f"  - 信息 (INFO): {severity_counts[Severity.INFO]}")
    click.echo()
    
    if scan_result.issues:
        type_counts = scan_result.get_issues_by_type()
        click.echo("问题类型分布:")
        for issue_type, issues in type_counts.items():
            type_name = _get_issue_type_name(issue_type)
            click.echo(f"  - {type_name}: {len(issues)}")
        click.echo()
    
    if verbose and scan_result.issues:
        click.echo("详细问题列表:")
        click.echo("-" * 60)
        
        issues_by_file = scan_result.get_issues_by_file()
        for file_path, issues in issues_by_file.items():
            click.echo()
            click.echo(f"\n文件: {file_path}")
            for issue in issues:
                severity = issue.severity.value.upper()
                type_name = _get_issue_type_name(issue.issue_type)
                click.echo(f"  [{severity}] {type_name}: {issue.message}")
                if issue.suggestion:
                    click.echo(f"      建议: {issue.suggestion}")


def _get_issue_type_name(issue_type: IssueType) -> str:
    names = {
        IssueType.OVERLAP: "时间重叠",
        IssueType.INVALID_TIME: "非法时间",
        IssueType.LONG_GAP: "间隔过长",
        IssueType.DUPLICATE: "重复字幕",
        IssueType.EMPTY_TEXT: "空文本",
        IssueType.CROSS_CHAPTER: "跨章节",
        IssueType.PARSE_ERROR: "解析错误",
    }
    return names.get(issue_type, issue_type.value)


if __name__ == '__main__':
    main()
