from __future__ import annotations

import sys
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console

from .comparator import SchemaComparator
from .models import CompatibilityLevel
from .partition_sampler import PartitionSampler
from .reporter import ReportGenerator
from .schema_reader import SchemaReader


EXIT_SUCCESS = 0
EXIT_INPUT_ERROR = 1
EXIT_INCOMPATIBLE = 2
EXIT_WARNING = 3
EXIT_ERROR = 4


console = Console()


class PathPath(click.Path):
    def convert(self, value, param, ctx):
        return Path(super().convert(value, param, ctx))


@click.group()
@click.version_option(version="0.1.0", prog_name="parquet-schema")
def cli():
    """Parquet Schema 演进检测工具

    用于检测和分析 Parquet 文件的 schema 变更，确保数据兼容性。
    """
    pass


@cli.command()
@click.argument("source", type=PathPath(exists=True, dir_okay=True, file_okay=True))
@click.option(
    "--output", "-o",
    type=PathPath(dir_okay=True, file_okay=False),
    default="./snapshots",
    help="快照输出目录 (默认: ./snapshots)",
)
@click.option(
    "--name", "-n",
    type=str,
    default=None,
    help="快照名称 (默认: 基于源路径自动生成)",
)
@click.option(
    "--sample-size",
    type=int,
    default=10,
    help="目录采样的文件数量 (默认: 10)",
)
@click.option(
    "--partition", "-p",
    multiple=True,
    help="指定分区进行采样 (可多次指定)",
)
@click.option(
    "--overwrite",
    is_flag=True,
    default=False,
    help="覆盖已存在的快照文件",
)
def snapshot(
    source: Path,
    output: Path,
    name: Optional[str],
    sample_size: int,
    partition: List[str],
    overwrite: bool,
):
    """创建 Parquet 数据的 schema 快照

    SOURCE: Parquet 文件路径或目录路径
    """
    try:
        if not name:
            name = source.stem if source.is_file() else source.name

        reader = SchemaReader()

        partitions = list(partition) if partition else None

        with console.status(f"[bold green]正在读取 {source}..."):
            schema_snapshot = reader.read_from_parquet(
                str(source),
                sample_partitions=partitions,
                sample_size=sample_size,
            )

        output.mkdir(parents=True, exist_ok=True)
        output_file = output / f"{name}_schema.json"

        if output_file.exists() and not overwrite:
            console.print(f"[yellow]⚠️  文件已存在: {output_file}[/yellow]")
            console.print("   使用 --overwrite 选项覆盖")
            sys.exit(EXIT_INPUT_ERROR)

        reader.save_snapshot(schema_snapshot, str(output_file))

        console.print(f"[green]✅ 快照已保存: {output_file}[/green]")
        console.print(f"   字段数: {len(schema_snapshot.fields)}")
        if schema_snapshot.file_count:
            console.print(f"   文件数: {schema_snapshot.file_count}")
        if schema_snapshot.row_count:
            console.print(f"   行数: {schema_snapshot.row_count:,}")

        sys.exit(EXIT_SUCCESS)

    except Exception as e:
        console.print(f"[red]❌ 错误: {str(e)}[/red]")
        sys.exit(EXIT_ERROR)


@cli.command()
@click.option(
    "--old", "-O",
    type=PathPath(exists=True, dir_okay=True, file_okay=True),
    required=True,
    help="旧 schema 源 (文件、目录或快照文件)",
)
@click.option(
    "--new", "-N",
    type=PathPath(exists=True, dir_okay=True, file_okay=True),
    required=True,
    help="新 schema 源 (文件、目录或快照文件)",
)
@click.option(
    "--task-name", "-t",
    type=str,
    default="schema_comparison",
    help="任务名称 (默认: schema_comparison)",
)
@click.option(
    "--output-dir", "-o",
    type=PathPath(dir_okay=True, file_okay=False),
    default="./reports",
    help="报告输出目录 (默认: ./reports)",
)
@click.option(
    "--allow-removal",
    is_flag=True,
    default=False,
    help="允许字段删除 (不视为破坏性变更)",
)
@click.option(
    "--allow-narrowing",
    is_flag=True,
    default=False,
    help="允许类型收窄 (不视为破坏性变更)",
)
@click.option(
    "--loose-nullable",
    is_flag=True,
    default=False,
    help="宽松 nullable 检查 (不视为破坏性变更)",
)
@click.option(
    "--old-partition",
    multiple=True,
    help="旧数据的分区过滤",
)
@click.option(
    "--new-partition",
    multiple=True,
    help="新数据的分区过滤",
)
@click.option(
    "--overwrite",
    is_flag=True,
    default=False,
    help="覆盖已存在的报告文件",
)
@click.option(
    "--fail-on-incompatible",
    is_flag=True,
    default=True,
    help="不兼容时以错误码退出 (默认: 启用)",
)
@click.option(
    "--sample-size",
    type=int,
    default=10,
    help="目录采样的文件数量 (默认: 10)",
)
def compare(
    old: Path,
    new: Path,
    task_name: str,
    output_dir: Path,
    allow_removal: bool,
    allow_narrowing: bool,
    loose_nullable: bool,
    old_partition: List[str],
    new_partition: List[str],
    overwrite: bool,
    fail_on_incompatible: bool,
    sample_size: int,
):
    """对比两个 Parquet schema 并生成演进报告"""
    try:
        reader = SchemaReader()

        with console.status("[bold green]正在读取旧 schema..."):
            if _is_snapshot_file(old):
                old_schema = reader.read_from_snapshot(str(old))
            else:
                old_schema = reader.read_from_parquet(
                    str(old),
                    sample_partitions=list(old_partition) if old_partition else None,
                    sample_size=sample_size,
                )

        with console.status("[bold green]正在读取新 schema..."):
            if _is_snapshot_file(new):
                new_schema = reader.read_from_snapshot(str(new))
            else:
                new_schema = reader.read_from_parquet(
                    str(new),
                    sample_partitions=list(new_partition) if new_partition else None,
                    sample_size=sample_size,
                )

        comparator = SchemaComparator(
            allow_field_removal=allow_removal,
            allow_type_narrowing=allow_narrowing,
            strict_nullable=not loose_nullable,
        )

        with console.status("[bold green]正在对比 schema..."):
            report = comparator.compare(
                old_schema,
                new_schema,
                task_name=task_name,
            )

        reporter = ReportGenerator(
            output_dir=str(output_dir),
            overwrite=overwrite,
        )

        with console.status("[bold green]正在生成报告..."):
            result = reporter.generate_all(report, task_name)

        console.print()
        reporter.generate_terminal_summary(report)

        console.print(f"[dim]报告文件已生成:[/dim]")
        console.print(f"  [blue]JSON:[/blue] {result['json_path']}")
        console.print(f"  [blue]Markdown:[/blue] {result['markdown_path']}")
        console.print()

        if report.compatibility_level == CompatibilityLevel.INCOMPATIBLE:
            if fail_on_incompatible:
                sys.exit(EXIT_INCOMPATIBLE)
            else:
                sys.exit(EXIT_WARNING)
        elif report.summary.get("breaking_changes", 0) > 0:
            sys.exit(EXIT_WARNING)
        else:
            sys.exit(EXIT_SUCCESS)

    except Exception as e:
        console.print(f"[red]❌ 错误: {str(e)}[/red]")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
        sys.exit(EXIT_ERROR)


@cli.command()
@click.argument("source", type=PathPath(exists=True, dir_okay=True, file_okay=True))
@click.option(
    "--field", "-f",
    multiple=True,
    help="检查特定字段路径 (可多次指定)",
)
@click.option(
    "--partition", "-p",
    multiple=True,
    help="指定分区进行检查 (可多次指定)",
)
@click.option(
    "--sample-size",
    type=int,
    default=20,
    help="采样文件数量 (默认: 20)",
)
@click.option(
    "--detail", "-d",
    is_flag=True,
    default=False,
    help="显示详细信息",
)
def check(
    source: Path,
    field: List[str],
    partition: List[str],
    sample_size: int,
    detail: bool,
):
    """检查 Parquet 数据中的 schema 一致性

    SOURCE: 要检查的 Parquet 文件目录
    """
    try:
        from collections import defaultdict

        reader = SchemaReader()
        sampler = PartitionSampler()

        if source.is_file():
            console.print("[yellow]⚠️  单个文件无需一致性检查[/yellow]")
            sys.exit(EXIT_SUCCESS)

        with console.status("[bold green]正在发现分区..."):
            partitions = sampler.discover_partitions(
                str(source),
                include_partitions=list(partition) if partition else None,
                max_partitions=50,
            )

        if not partitions:
            console.print("[yellow]未发现分区，将直接扫描文件[/yellow]")

        with console.status("[bold green]正在读取 schema 并检查一致性..."):
            schema_hashes: dict = defaultdict(list)
            all_schemas = []

            if partitions:
                samples = sampler.sample_partitions(
                    str(source),
                    sample_count=min(10, len(partitions)),
                    sample_per_partition=min(3, sample_size // 10 + 1),
                    include_partitions=list(partition) if partition else None,
                )

                for part_values, files in samples:
                    for f in files:
                        try:
                            snapshot = reader.read_from_parquet(f)
                            schema_str = str(snapshot.to_dict()["fields"])
                            import hashlib
                            h = hashlib.md5(schema_str.encode()).hexdigest()
                            schema_hashes[h].append((part_values, f))
                            all_schemas.append((part_values, snapshot))
                        except Exception:
                            pass
            else:
                import pyarrow.parquet as pq
                files = list(source.rglob("*.parquet"))[:sample_size]

                for f in files:
                    try:
                        snapshot = reader.read_from_parquet(str(f))
                        schema_str = str(snapshot.to_dict()["fields"])
                        import hashlib
                        h = hashlib.md5(schema_str.encode()).hexdigest()
                        schema_hashes[h].append(({}, str(f)))
                        all_schemas.append(({}, snapshot))
                    except Exception:
                        pass

        console.print()
        console.print(f"[bold]Schema 一致性检查结果:[/bold]")
        console.print(f"  发现的 schema 版本数: [bold]{len(schema_hashes)}[/bold]")
        console.print(f"  采样文件数: [bold]{len(all_schemas)}[/bold]")
        console.print()

        if len(schema_hashes) == 1:
            console.print("[green]✅ 所有采样文件的 schema 一致[/green]")
            if detail and all_schemas:
                _, snap = all_schemas[0]
                console.print(f"  字段数: {len(snap.fields)}")
        else:
            console.print("[yellow]⚠️  检测到多个 schema 版本[/yellow]")
            console.print()

            for i, (h, files_list) in enumerate(schema_hashes.items(), 1):
                console.print(f"  [bold]版本 {i}:[/bold]")
                console.print(f"    出现次数: {len(files_list)}")
                if files_list:
                    part, f = files_list[0]
                    if part:
                        console.print(f"    示例分区: {part}")
                    console.print(f"    示例文件: .../{Path(f).name}")
                console.print()

            console.print("[yellow]提示: 使用 'compare' 命令对比不同版本的 schema[/yellow]")
            sys.exit(EXIT_WARNING)

        sys.exit(EXIT_SUCCESS)

    except Exception as e:
        console.print(f"[red]❌ 错误: {str(e)}[/red]")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
        sys.exit(EXIT_ERROR)


@cli.command()
@click.argument("source", type=PathPath(exists=True, dir_okay=True, file_okay=True))
@click.option(
    "--max-depth",
    type=int,
    default=3,
    help="嵌套结构显示深度 (默认: 3)",
)
@click.option(
    "--field-filter",
    type=str,
    default=None,
    help="字段路径过滤 (支持通配符)",
)
def inspect(
    source: Path,
    max_depth: int,
    field_filter: Optional[str],
):
    """查看 Parquet 文件的 schema 详情

    SOURCE: Parquet 文件路径或快照文件
    """
    try:
        reader = SchemaReader()

        with console.status("[bold green]正在读取 schema..."):
            if _is_snapshot_file(source):
                snapshot = reader.read_from_snapshot(str(source))
            else:
                snapshot = reader.read_from_parquet(str(source))

        console.print()
        console.print(f"[bold]Schema 详情 - {snapshot.source}[/bold]")
        console.print(f"  生成时间: {snapshot.created_at}")
        if snapshot.row_count:
            console.print(f"  行数: {snapshot.row_count:,}")
        if snapshot.file_count:
            console.print(f"  文件数: {snapshot.file_count}")
        if snapshot.partition_info and snapshot.partition_info.get("columns"):
            console.print(f"  分区列: {', '.join(snapshot.partition_info['columns'])}")
        console.print()

        console.print(f"[bold]字段列表 ({len(snapshot.fields)}):[/bold]")
        console.print()

        def print_field(field, indent=0):
            prefix = "  " * indent
            nullable_str = "[dim]?[/dim]" if field.nullable else ""

            type_color = "white"
            if field.is_struct:
                type_color = "cyan"
            elif field.is_list:
                type_color = "blue"
            elif field.decimal_info:
                type_color = "magenta"

            console.print(
                f"{prefix}[bold]{field.name}[/bold]{nullable_str}: "
                f"[{type_color}]{field.data_type}[/{type_color}]"
            )

            if detail := _get_field_detail(field):
                console.print(f"{prefix}  [dim]{detail}[/dim]")

            if field.children and indent + 1 < max_depth:
                for child in field.children:
                    print_field(child, indent + 1)
            elif field.children:
                console.print(f"{prefix}  [dim]... ({len(field.children)} 个子字段)[/dim]")

        import fnmatch

        def matches_filter(field_path: str) -> bool:
            if not field_filter:
                return True
            return fnmatch.fnmatch(field_path.lower(), field_filter.lower())

        for field in snapshot.fields:
            if matches_filter(field.path):
                print_field(field)
                console.print()

        sys.exit(EXIT_SUCCESS)

    except Exception as e:
        console.print(f"[red]❌ 错误: {str(e)}[/red]")
        import traceback
        console.print(f"[dim]{traceback.format_exc()}[/dim]")
        sys.exit(EXIT_ERROR)


def _is_snapshot_file(path: Path) -> bool:
    if path.is_file() and path.suffix == ".json":
        try:
            import json
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return "fields" in data and "source" in data
        except Exception:
            pass
    return False


def _get_field_detail(field) -> str:
    details = []
    if field.decimal_info:
        details.append(
            f"precision={field.decimal_info.precision}, "
            f"scale={field.decimal_info.scale}"
        )
    if field.metadata:
        details.append(f"metadata_keys={list(field.metadata.keys())}")
    return ", ".join(details)


if __name__ == "__main__":
    cli()
