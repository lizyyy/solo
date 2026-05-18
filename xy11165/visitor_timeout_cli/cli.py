import sys
from datetime import datetime
from pathlib import Path

import click

from .__init__ import __version__
from .processor import VisitorProcessor


@click.group()
@click.version_option(version=__version__, prog_name="visitor-timeout-cli")
def main():
    """共享工位前台访客超时统计 CLI"""
    pass


@main.command()
@click.argument("input_dir", type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path))
@click.option("-o", "--output", type=click.Path(path_type=Path), default=None, help="输出文件路径")
@click.option("-t", "--timeout-hours", type=float, default=8.0, help="超时阈值（小时），默认8小时")
@click.option("--end-time", type=str, default=None, help="统计截止时间，格式: YYYY-MM-DD HH:MM:SS")
def stat(input_dir: Path, output: Path, timeout_hours: float, end_time: str):
    """统计共享工位访客超时情况

    INPUT_DIR: 包含访客CSV文件的目录
    """
    click.echo(f"共享工位前台访客超时统计 CLI v{__version__}")
    click.echo(f"输入目录: {input_dir}")
    click.echo(f"超时阈值: {timeout_hours}小时")

    try:
        end_dt = None
        if end_time:
            from .processor import parse_datetime
            end_dt = parse_datetime(end_time)
            click.echo(f"统计截止时间: {end_dt}")
    except Exception as e:
        click.echo(f"错误: 截止时间格式无效 - {e}", err=True)
        sys.exit(1)

    processor = VisitorProcessor(timeout_hours=timeout_hours)

    try:
        results = processor.process_directory(input_dir, end_dt)
    except Exception as e:
        click.echo(f"错误: 处理失败 - {e}", err=True)
        sys.exit(1)

    if not output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = Path.cwd() / f"visitor_timeout_result_{timestamp}.csv"

    try:
        processor.write_results(results, output)
    except Exception as e:
        click.echo(f"错误: 写入结果失败 - {e}", err=True)
        sys.exit(1)

    if processor.errors:
        click.echo(f"\n警告: 发现 {len(processor.errors)} 条数据问题:")
        for err in processor.errors[:5]:
            click.echo(f"  - {err}")
        if len(processor.errors) > 5:
            click.echo(f"  ... 还有 {len(processor.errors) - 5} 条错误")

    click.echo(f"\n统计完成! 共发现 {len(results)} 条超时/特殊记录")
    click.echo(f"结果文件: {output}")


@main.command()
@click.argument("file1", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.argument("file2", type=click.Path(exists=True, dir_okay=False, path_type=Path))
def diff(file1: Path, file2: Path):
    """比较两次统计结果的差异

    FILE1: 第一个结果文件
    FILE2: 第二个结果文件
    """
    import csv

    def read_result(path: Path):
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            keyed = {}
            for row in rows:
                key = (row["visitor_id"], row["checkin_time"])
                keyed[key] = row
            return keyed, rows

    data1, rows1 = read_result(file1)
    data2, rows2 = read_result(file2)

    keys1 = set(data1.keys())
    keys2 = set(data2.keys())

    added = keys2 - keys1
    removed = keys1 - keys2
    common = keys1 & keys2

    modified = []
    for key in common:
        r1 = data1[key]
        r2 = data2[key]
        diff_fields = []
        for k in r1.keys():
            if r1[k] != r2[k]:
                diff_fields.append(k)
        if diff_fields:
            modified.append((key, diff_fields))

    click.echo(f"比较结果: {file1.name} vs {file2.name}")
    click.echo(f"  新增记录: {len(added)}")
    click.echo(f"  删除记录: {len(removed)}")
    click.echo(f"  修改记录: {len(modified)}")
    click.echo(f"  未变化记录: {len(common) - len(modified)}")

    if added:
        click.echo("\n新增记录:")
        for key in sorted(added):
            click.echo(f"  - {key[0]} @ {key[1]}")

    if removed:
        click.echo("\n删除记录:")
        for key in sorted(removed):
            click.echo(f"  - {key[0]} @ {key[1]}")

    if modified:
        click.echo("\n修改记录:")
        for key, fields in modified:
            click.echo(f"  - {key[0]} @ {key[1]}: {', '.join(fields)}")


if __name__ == "__main__":
    main()
