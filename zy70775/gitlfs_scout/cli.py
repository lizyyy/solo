import sys
import os
from pathlib import Path

import click

from .__init__ import __version__
from .git_scanner import GitScanner
from .analyzer import LFSAnalyzer
from .reporter import ReportGenerator


@click.group()
@click.version_option(__version__, prog_name="gitlfs-scout")
def main():
    """Git LFS 额度侦察排查工具 - 扫描Git历史中的LFS文件并分析额度使用情况"""
    pass


@main.command()
@click.argument("repo_path", type=click.Path(exists=True, file_okay=False), default=".")
@click.option("--since", "-s", help="扫描起始时间 (如: '2024-01-01' 或 '3 months ago')")
@click.option("--until", "-u", help="扫描结束时间")
@click.option("--path-filter", "-p", help="路径过滤关键词")
@click.option("--path-level", "-l", type=int, help="路径聚合层级")
@click.option("--min-size", "-m", help="最小文件大小过滤 (支持单位: 10MB, 500KB)")
@click.option("--output", "-o", help="输出文件前缀 (不指定则只打印报告)")
@click.option("--format", "-f", "output_format", type=click.Choice(["text", "json", "csv", "all"]), default="text", help="输出格式")
@click.option("--current-only", is_flag=True, help="仅扫描当前工作区，不扫描历史")
def scan(repo_path, since, until, path_filter, path_level, min_size, output, output_format, current_only):
    """扫描仓库中的LFS文件"""
    
    min_size_bytes = None
    if min_size:
        min_size_bytes = parse_size(min_size)
        if min_size_bytes is None:
            click.echo(f"错误: 无效的大小格式 '{min_size}'", err=True)
            sys.exit(1)

    try:
        scanner = GitScanner(repo_path)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)

    click.echo(f"开始扫描仓库: {repo_path}")
    if current_only:
        click.echo("模式: 仅扫描当前工作区")
        scan_result = scanner.scan_current(path_filter)
    else:
        click.echo("模式: 扫描完整历史")
        if since:
            click.echo(f"  起始时间: {since}")
        if until:
            click.echo(f"  结束时间: {until}")
        scan_result = scanner.scan_history(since, until, path_filter)

    click.echo(f"找到 {len(scan_result.lfs_files)} 个LFS文件引用")
    if scan_result.errors:
        click.echo(f"警告: 扫描过程中出现 {len(scan_result.errors)} 个错误")

    analyzer = LFSAnalyzer()
    analysis = analyzer.analyze(scan_result, path_level, min_size_bytes)

    reporter = ReportGenerator(scan_result, analysis)

    if output:
        if output_format in ["text", "all"]:
            reporter.save_human_report(f"{output}.txt")
            click.echo(f"文本报告已保存: {output}.txt")
        if output_format in ["json", "all"]:
            reporter.save_json_report(f"{output}.json")
            click.echo(f"JSON报告已保存: {output}.json")
        if output_format in ["csv", "all"]:
            reporter.save_csv_report(f"{output}.csv")
            click.echo(f"CSV报告已保存: {output}.csv")
    else:
        click.echo()
        click.echo(reporter.generate_human_report())


@main.command()
@click.argument("repo_path", type=click.Path(exists=True, file_okay=False), default=".")
@click.option("--json-output", help="JSON输出文件路径")
def check(repo_path, json_output):
    """检查仓库LFS使用概况"""
    try:
        scanner = GitScanner(repo_path)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)

    click.echo("正在扫描当前版本的LFS文件...")
    scan_result = scanner.scan_current()
    
    analyzer = LFSAnalyzer()
    analysis = analyzer.analyze(scan_result)

    reporter = ReportGenerator(scan_result, analysis)
    report = reporter.generate_machine_report()

    summary = report["summary"]
    click.echo("\n" + "=" * 60)
    click.echo("LFS 使用概况")
    click.echo("=" * 60)
    click.echo(f"  当前LFS文件数: {summary['total_files']}")
    click.echo(f"  唯一文件数: {summary['unique_files']}")
    click.echo(f"  总大小: {analyzer.format_size(summary['total_size_bytes'])}")
    click.echo(f"  重复占用: {analyzer.format_size(summary['duplicate_size_bytes'])}")
    click.echo("=" * 60)

    if summary["total_size_bytes"] > 100 * 1024 * 1024:
        click.echo("\n⚠️  警告: LFS文件总大小超过100MB，建议检查是否有大文件需要清理")
    
    if summary["duplicate_size_bytes"] > 10 * 1024 * 1024:
        click.echo("\n⚠️  警告: 存在大量重复文件，建议使用 '--check-duplicates' 查看详情")

    if json_output:
        reporter.save_json_report(json_output)
        click.echo(f"\n详细报告已保存: {json_output}")


@main.command()
@click.argument("repo_path", type=click.Path(exists=True, file_okay=False), default=".")
@click.option("--limit", "-n", type=int, default=10, help="显示数量")
def duplicates(repo_path, limit):
    """检查重复的LFS文件"""
    try:
        scanner = GitScanner(repo_path)
    except ValueError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)

    click.echo("正在扫描历史中的LFS文件...")
    scan_result = scanner.scan_history()
    
    analyzer = LFSAnalyzer()
    analysis = analyzer.analyze(scan_result)
    duplicate_summary = analyzer.get_duplicate_summary(analysis)

    if duplicate_summary["count"] == 0:
        click.echo("未发现重复的LFS文件")
        return

    click.echo(f"\n发现 {duplicate_summary['count']} 个重复的LFS文件")
    click.echo(f"总共浪费空间: {analyzer.format_size(duplicate_summary['total_duplicate_size'])}\n")

    click.echo("重复文件详情:")
    click.echo("-" * 80)
    for i, d in enumerate(duplicate_summary["details"][:limit], 1):
        click.echo(f"\n#{i} OID: {d['oid']}")
        click.echo(f"  大小: {analyzer.format_size(d['size'])}")
        click.echo(f"  出现次数: {d['count']}")
        click.echo(f"  浪费空间: {analyzer.format_size(d['duplicate_size'])}")
        click.echo(f"  路径:")
        for path in d["paths"][:5]:
            click.echo(f"    - {path}")
        if len(d["paths"]) > 5:
            click.echo(f"    ... 还有 {len(d['paths']) - 5} 个路径")


def parse_size(size_str: str) -> int:
    """解析大小字符串，如 '10MB', '500KB' 等"""
    size_str = size_str.strip().upper()
    units = {
        "B": 1,
        "KB": 1024,
        "MB": 1024 * 1024,
        "GB": 1024 * 1024 * 1024,
        "TB": 1024 * 1024 * 1024 * 1024,
    }
    
    for unit, multiplier in sorted(units.items(), key=lambda x: len(x[0]), reverse=True):
        if size_str.endswith(unit):
            try:
                value = float(size_str[:-len(unit)])
                return int(value * multiplier)
            except ValueError:
                pass
    
    try:
        return int(size_str)
    except ValueError:
        return None


if __name__ == "__main__":
    main()
