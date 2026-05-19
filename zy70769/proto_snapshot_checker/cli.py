import click
import os
from pathlib import Path

from .parser import ProtoParser
from .snapshot import SnapshotManager
from .rules import CompatibilityChecker
from .reporter import Reporter


@click.group()
def cli():
    """Proto 字段编号兼容历史快照排查工具"""
    pass


@cli.command()
@click.argument("proto_path", type=click.Path(exists=True))
@click.option("--name", "-n", help="快照名称（可选）")
@click.option("--snapshot-dir", help="快照存储目录")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def snapshot(proto_path, name, snapshot_dir, verbose):
    """生成 proto 文件的快照"""
    parser = ProtoParser()
    snapshot_mgr = SnapshotManager(snapshot_dir)

    path = Path(proto_path)
    if path.is_file():
        proto_files = [parser.parse_file(str(path))]
    else:
        proto_files = parser.parse_directory(str(path))

    if verbose:
        click.echo(f"解析了 {len(proto_files)} 个 proto 文件:")
        for pf in proto_files:
            click.echo(f"  - {pf.file_path}")
            for msg_name, msg in pf.messages.items():
                click.echo(f"    消息: {msg_name} ({len(msg.fields)} 个字段)")

    snapshot = snapshot_mgr.generate_snapshot(proto_files)
    saved_path = snapshot_mgr.save_snapshot(snapshot, name)

    click.echo(f"\n快照已保存: {click.style(saved_path, fg='green')}")
    click.echo(f"快照哈希: {snapshot.calculate_hash()}")


@cli.command("list")
@click.option("--snapshot-dir", help="快照存储目录")
def list_snapshots(snapshot_dir):
    """列出所有快照"""
    snapshot_mgr = SnapshotManager(snapshot_dir)
    snapshots = snapshot_mgr.list_snapshots()

    if not snapshots:
        click.echo("没有找到快照")
        return

    click.echo(f"找到 {len(snapshots)} 个快照:")
    for i, name in enumerate(snapshots, 1):
        try:
            snapshot = snapshot_mgr.load_snapshot(name)
            file_count = len(snapshot.proto_files)
            click.echo(f"  {i}. {name} ({file_count} 个文件, {snapshot.created_at})")
        except Exception as e:
            click.echo(f"  {i}. {name} (无法加载: {e})")


@cli.command()
@click.argument("old_snapshot")
@click.argument("new_snapshot", required=False)
@click.option("--proto-path", type=click.Path(exists=True), help="当前 proto 文件路径（用于生成新快照）")
@click.option("--snapshot-dir", help="快照存储目录")
@click.option("--output", "-o", help="JSON 报告输出路径")
@click.option("--json", is_flag=True, help="只输出 JSON 格式")
def check(old_snapshot, new_snapshot, proto_path, snapshot_dir, output, json):
    """检查两个快照之间的兼容性"""
    snapshot_mgr = SnapshotManager(snapshot_dir)
    checker = CompatibilityChecker()
    reporter = Reporter()

    try:
        old = snapshot_mgr.load_snapshot(old_snapshot)
    except FileNotFoundError:
        click.echo(click.style(f"错误: 找不到旧快照 '{old_snapshot}'", fg="red"), err=True)
        return

    if new_snapshot:
        try:
            new = snapshot_mgr.load_snapshot(new_snapshot)
        except FileNotFoundError:
            click.echo(click.style(f"错误: 找不到新快照 '{new_snapshot}'", fg="red"), err=True)
            return
        new_name = new_snapshot
    elif proto_path:
        parser = ProtoParser()
        path = Path(proto_path)
        if path.is_file():
            proto_files = [parser.parse_file(str(path))]
        else:
            proto_files = parser.parse_directory(str(path))
        new = snapshot_mgr.generate_snapshot(proto_files)
        new_name = "current"
    else:
        new = snapshot_mgr.get_latest_snapshot()
        if new is None:
            click.echo(click.style("错误: 没有找到最新快照", fg="red"), err=True)
            return
        new_name = snapshot_mgr.list_snapshots()[-1]

    result = checker.check(old, new)

    if json:
        report = reporter.export_json_string(result, old_snapshot, new_name)
        click.echo(report)
    else:
        reporter.print_console_report(result, old_snapshot, new_name)

    if output:
        reporter.export_json_report(result, output, old_snapshot, new_name)

    if result.has_errors():
        raise click.ClickException("检测到破坏性变更")


@cli.command()
@click.argument("snapshot_name")
@click.option("--snapshot-dir", help="快照存储目录")
def show(snapshot_name, snapshot_dir):
    """显示快照详情"""
    snapshot_mgr = SnapshotManager(snapshot_dir)

    try:
        snapshot = snapshot_mgr.load_snapshot(snapshot_name)
    except FileNotFoundError:
        click.echo(click.style(f"错误: 找不到快照 '{snapshot_name}'", fg="red"), err=True)
        return

    click.echo(f"\n快照: {snapshot_name}")
    click.echo(f"创建时间: {snapshot.created_at}")
    click.echo(f"文件数量: {len(snapshot.proto_files)}")
    click.echo(f"哈希: {snapshot.calculate_hash()}")

    click.echo("\n消息列表:")
    for file_path, proto_file_data in snapshot.proto_files.items():
        from .parser import ProtoFile
        proto_file = ProtoFile.from_dict(proto_file_data)
        click.echo(f"\n  文件: {file_path}")
        for msg_name, msg in sorted(proto_file.messages.items()):
            click.echo(f"    消息: {msg.full_name}")
            for field_num, field in sorted(msg.fields.items()):
                label = f"{field.label} " if field.label else ""
                click.echo(f"      {field_num}: {label}{field.type} {field.name}")


@cli.command()
@click.argument("snapshot_name")
@click.option("--snapshot-dir", help="快照存储目录")
@click.option("--force", "-f", is_flag=True, help="不提示确认")
def delete(snapshot_name, snapshot_dir, force):
    """删除快照"""
    snapshot_mgr = SnapshotManager(snapshot_dir)

    if not force:
        click.confirm(f"确定要删除快照 '{snapshot_name}' 吗？", abort=True)

    if snapshot_mgr.delete_snapshot(snapshot_name):
        click.echo(click.style(f"已删除快照: {snapshot_name}", fg="green"))
    else:
        click.echo(click.style(f"错误: 找不到快照 '{snapshot_name}'", fg="red"), err=True)


def main():
    try:
        cli()
    except KeyboardInterrupt:
        click.echo("\n已取消")
    except click.ClickException:
        raise
    except Exception as e:
        click.echo(click.style(f"错误: {e}", fg="red"), err=True)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
