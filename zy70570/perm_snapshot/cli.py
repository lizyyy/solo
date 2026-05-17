#!/usr/bin/env python3
"""CLI命令行入口"""

import os
import sys
from datetime import datetime
import click

from .scanner import PermissionScanner
from .snapshot import SnapshotManager
from .diff import Differ
from .reporter import Reporter


@click.group()
@click.version_option(version="1.0.0")
def main():
    """Linux权限快照CLI工具 - 用于目录权限基线管理和差异对比"""
    pass


@main.command()
@click.argument("path")
@click.option("--name", "-n", help="快照名称", default=None)
@click.option("--no-recursive", is_flag=True, help="不递归扫描子目录")
@click.option("--snapshot-dir", default=".perm-snapshots", help="快照存储目录")
def scan(path, name, no_recursive, snapshot_dir):
    """扫描目录并创建权限快照
    
    PATH: 要扫描的目录或文件路径
    """
    if not os.path.exists(path):
        click.echo(f"错误: 路径不存在: {path}", err=True)
        sys.exit(1)
    
    if name is None:
        name = os.path.basename(os.path.abspath(path))
    
    click.echo(f"正在扫描: {path}")
    
    scanner = PermissionScanner(path, recursive=not no_recursive)
    entries, errors = scanner.scan()
    
    click.echo(f"扫描完成: {len(entries)} 个条目, {len(errors)} 个错误")
    
    manager = SnapshotManager(snapshot_dir)
    metadata = {
        "scan_path": path,
        "recursive": not no_recursive
    }
    snapshot_path = manager.save_snapshot(name, entries, errors, metadata)
    
    click.echo(f"快照已保存: {snapshot_path}")
    
    if errors:
        sys.exit(2)


@main.command("list")
@click.option("--snapshot-dir", default=".perm-snapshots", help="快照存储目录")
def list_snapshots(snapshot_dir):
    """列出所有已保存的快照"""
    manager = SnapshotManager(snapshot_dir)
    snapshots = manager.list_snapshots()
    
    if not snapshots:
        click.echo("没有找到快照")
        return
    
    click.echo("可用的快照:")
    for i, s in enumerate(snapshots, 1):
        click.echo(f"  {i}. {s}")


@main.command()
@click.argument("baseline")
@click.argument("current", required=False)
@click.option("--path", "-p", help="扫描指定路径作为当前快照")
@click.option("--snapshot-dir", default=".perm-snapshots", help="快照存储目录")
@click.option("--output-json", help="输出机器可读JSON到文件")
@click.option("--output-report", help="输出人类可读Markdown报告到文件")
@click.option("--no-recursive", is_flag=True, help="不递归扫描子目录")
def diff(baseline, current, path, snapshot_dir, output_json, output_report, no_recursive):
    """对比两个快照，或对比快照与当前目录状态
    
    BASELINE: 基线快照文件名或路径
    CURRENT: 当前快照文件名或路径（可选，如果不指定则需要--path）
    """
    manager = SnapshotManager(snapshot_dir)
    
    # 加载基线快照
    baseline_path = manager.get_snapshot_path(baseline)
    if not baseline_path or not os.path.exists(baseline_path):
        click.echo(f"错误: 基线快照不存在: {baseline}", err=True)
        sys.exit(1)
    
    baseline_data = manager.load_snapshot(baseline_path)
    
    # 获取当前数据
    if current:
        current_path = manager.get_snapshot_path(current)
        if not current_path or not os.path.exists(current_path):
            click.echo(f"错误: 当前快照不存在: {current}", err=True)
            sys.exit(1)
        
        current_data = manager.load_snapshot(current_path)
        current_errors = current_data.get("errors", [])
    elif path:
        scanner = PermissionScanner(path, recursive=not no_recursive)
        entries, current_errors = scanner.scan()
        current_data = {
            "name": f"current_scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "timestamp": datetime.now().isoformat(),
            "entries": [manager._entry_to_dict(e) for e in entries],
            "errors": current_errors
        }
    else:
        click.echo("错误: 必须指定当前快照文件名或使用--path指定扫描路径", err=True)
        sys.exit(1)
    
    # 执行对比
    differ = Differ()
    diffs, added, removed = differ.compare(baseline_data, current_data)
    
    # 生成报告
    reporter = Reporter()
    
    # 终端输出
    terminal_summary = reporter.generate_terminal_summary(diffs, added, removed, current_errors)
    click.echo(terminal_summary)
    
    # 输出JSON
    if output_json:
        json_content = reporter.generate_machine_readable(
            diffs, added, removed, current_errors,
            baseline_data.get("name", baseline),
            current_data.get("name", current or path)
        )
        with open(output_json, 'w', encoding='utf-8') as f:
            f.write(json_content)
        click.echo(f"机器可读结果已保存: {output_json}")
    
    # 输出人类可读报告
    if output_report:
        report_content = reporter.generate_human_report(
            diffs, added, removed, current_errors,
            baseline_data, current_data
        )
        with open(output_report, 'w', encoding='utf-8') as f:
            f.write(report_content)
        click.echo(f"人类可读报告已保存: {output_report}")
    
    # 设置退出码
    if current_errors:
        sys.exit(2)
    elif diffs or added or removed:
        sys.exit(3)
    else:
        sys.exit(0)


@main.command()
@click.argument("snapshot_file")
@click.option("--snapshot-dir", default=".perm-snapshots", help="快照存储目录")
def show(snapshot_file, snapshot_dir):
    """显示快照内容
    
    SNAPSHOT_FILE: 快照文件名或路径
    """
    manager = SnapshotManager(snapshot_dir)
    
    filepath = manager.get_snapshot_path(snapshot_file)
    if not filepath or not os.path.exists(filepath):
        click.echo(f"错误: 快照不存在: {snapshot_file}", err=True)
        sys.exit(1)
    
    data = manager.load_snapshot(filepath)
    
    click.echo(f"快照名称: {data.get('name', 'N/A')}")
    click.echo(f"创建时间: {data.get('timestamp', 'N/A')}")
    click.echo(f"条目数量: {len(data.get('entries', []))}")
    click.echo(f"错误数量: {len(data.get('errors', []))}")
    click.echo("")
    click.echo("条目列表:")
    for entry in data.get('entries', []):
        error_mark = " [ERROR]" if entry.get('error') else ""
        click.echo(f"  {entry['mode_octal']} {entry['owner']}:{entry['group']} {entry['path']}{error_mark}")
    
    if data.get('errors'):
        click.echo("")
        click.echo("错误记录:")
        for err in data['errors']:
            click.echo(f"  {err['path']}: {err.get('error_type', 'unknown')}: {err.get('error', 'unknown')}")


if __name__ == "__main__":
    main()
