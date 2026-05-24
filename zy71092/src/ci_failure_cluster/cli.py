import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click
from tqdm import tqdm

from . import __version__
from .config import ClusterConfig
from .parser import LogParser
from .clusterer import FailureClusterer
from .reporter import ReportGenerator
from .types import FailureRecord, ClusterReport

EXIT_OK = 0
EXIT_NO_INPUT = 1
EXIT_PARSE_ERROR = 2
EXIT_NO_FAILURES = 3
EXIT_OUTPUT_ERROR = 4


@click.group()
@click.version_option(__version__, prog_name="ci-failure-cluster")
def main():
    """CI 失败签名聚类 CLI - 智能分析 CI 失败并按根因聚类"""
    pass


@main.command()
@click.argument("inputs", nargs=-1, type=click.Path(exists=False))
@click.option("--dir", "-d", "directory", type=click.Path(exists=True, file_okay=False, dir_okay=True),
              help="包含 CI 日志的目录（递归扫描）")
@click.option("--output", "-o", "output_dir", type=click.Path(), default="./ci-failure-reports",
              help="输出目录 (默认: ./ci-failure-reports)")
@click.option("--config", "-c", "config_file", type=click.Path(exists=True),
              help="配置文件路径 (YAML)")
@click.option("--similarity", "-s", type=click.FloatRange(0.0, 1.0), default=None,
              help="签名相似度阈值 (0.0-1.0，默认: 0.85)")
@click.option("--min-cluster", "-m", type=click.IntRange(1, 1000), default=None,
              help="最小聚类大小 (默认: 2)")
@click.option("--overwrite/--no-overwrite", default=False,
              help="覆盖已存在的输出文件")
@click.option("--recursive/--no-recursive", default=True,
              help="递归扫描目录 (默认: 开启)")
@click.option("--quiet", "-q", is_flag=True, help="静默模式，减少输出")
@click.option("--rerun-threshold", type=click.IntRange(0, 100), default=0,
              help="只分析重跑次数 >= 阈值的失败")
def analyze(
    inputs: tuple,
    directory: Optional[str],
    output_dir: str,
    config_file: Optional[str],
    similarity: Optional[float],
    min_cluster: Optional[int],
    overwrite: bool,
    recursive: bool,
    quiet: bool,
    rerun_threshold: int,
):
    """分析 CI 失败日志并生成聚类报告

    INPUTS: 一个或多个 CI 日志文件/目录路径
    """
    try:
        records = _collect_records(inputs, directory, recursive, quiet)

        if not records:
            if not quiet:
                click.echo(click.style("错误: 没有找到任何可分析的失败记录", fg="red"), err=True)
            sys.exit(EXIT_NO_FAILURES)

        if rerun_threshold > 0:
            original_count = len(records)
            records = [r for r in records if r.rerun_count >= rerun_threshold]
            if not quiet and len(records) < original_count:
                click.echo(f"  过滤重跑次数: 保留 {len(records)}/{original_count} 条记录")

        config = _load_config(config_file, similarity, min_cluster)

        if not quiet:
            click.echo(f"\n开始聚类分析，共 {len(records)} 条失败记录...")

        clusterer = FailureClusterer(config)
        clusters, unclustered = clusterer.cluster(records)

        if not quiet:
            click.echo(f"  聚类完成: {len(clusters)} 个聚类, {len(unclustered)} 条未聚类")

        report = ClusterReport(
            generated_at=datetime.now(),
            total_failures=len(records),
            total_clusters=len(clusters),
            clusters=clusters,
            unclustered=unclustered,
            analysis_params={
                "similarity_threshold": config.similarity_threshold,
                "min_cluster_size": config.min_cluster_size,
                "rerun_threshold": rerun_threshold,
                "normalize_paths": config.normalize_paths,
                "normalize_hex": config.normalize_hex,
                "normalize_numbers": config.normalize_numbers,
                "normalize_uuids": config.normalize_uuids,
                "normalize_timestamps": config.normalize_timestamps,
            },
        )

        reporter = ReportGenerator(output_dir, overwrite=overwrite)
        output_files = reporter.generate_all(report)

        if not quiet:
            click.echo(click.style(f"\n分析完成！输出文件:", fg="green"))
            click.echo(f"  JSON: {output_files['json_file']}")
            click.echo(f"  Markdown: {output_files['markdown_file']}")

        sys.exit(EXIT_OK)

    except FileNotFoundError as e:
        click.echo(click.style(f"错误: {e}", fg="red"), err=True)
        sys.exit(EXIT_NO_INPUT)
    except Exception as e:
        click.echo(click.style(f"错误: {e}", fg="red"), err=True)
        import traceback
        traceback.print_exc()
        sys.exit(EXIT_PARSE_ERROR)


@main.command()
@click.argument("input_path", type=click.Path(exists=True))
@click.option("--output", "-o", "output_dir", type=click.Path(), default="./ci-failure-reports",
              help="输出目录")
@click.option("--overwrite/--no-overwrite", default=False,
              help="覆盖已存在的输出文件")
def inspect(input_path: str, output_dir: str, overwrite: bool):
    """检查单个日志文件的解析结果"""
    click.echo(f"检查文件: {input_path}")

    parser = LogParser()
    records = parser.parse_file(input_path)

    click.echo(f"\n解析到 {len(records)} 条失败记录:\n")

    for i, record in enumerate(records, 1):
        click.echo(click.style(f"记录 {i}:", fg="cyan"))
        click.echo(f"  ID: {record.id}")
        click.echo(f"  提交: {record.commit_sha}")
        click.echo(f"  任务: {record.job_name}")
        click.echo(f"  矩阵: {record.matrix_params.to_dict()}")
        click.echo(f"  重跑次数: {record.rerun_count}")
        click.echo(f"  错误信息: {record.error_message[:100]}...")
        if record.stack_trace:
            click.echo(f"  堆栈跟踪: {record.stack_trace[:100]}...")
        click.echo()

    if records:
        config = ClusterConfig.default()
        clusterer = FailureClusterer(config)
        clusters, _ = clusterer.cluster(records)
        click.echo(f"聚类结果: {len(clusters)} 个聚类")


@main.command()
@click.option("--output", "-o", type=click.Path(), default="./.ci-failure-cluster.yaml",
              help="配置文件输出路径")
def init_config(output: str):
    """生成默认配置文件"""
    config = ClusterConfig.default()

    import yaml
    config_data = {
        "similarity_threshold": config.similarity_threshold,
        "min_cluster_size": config.min_cluster_size,
        "max_tokens_per_signature": config.max_tokens_per_signature,
        "normalize_paths": config.normalize_paths,
        "normalize_hex": config.normalize_hex,
        "normalize_numbers": config.normalize_numbers,
        "normalize_uuids": config.normalize_uuids,
        "normalize_timestamps": config.normalize_timestamps,
        "stop_words": config.stop_words,
        "error_patterns": config.error_patterns,
        "stack_frame_ignore": config.stack_frame_ignore,
        "jitter_window_size": config.jitter_window_size,
    }

    output_path = Path(output)
    if output_path.exists():
        click.confirm(f"文件 {output} 已存在，是否覆盖？", abort=True)

    with open(output_path, "w") as f:
        yaml.dump(config_data, f, default_flow_style=False, allow_unicode=True)

    click.echo(click.style(f"配置文件已生成: {output}", fg="green"))


def _collect_records(
    inputs: tuple, directory: Optional[str], recursive: bool, quiet: bool
) -> List[FailureRecord]:
    parser = LogParser()
    records: List[FailureRecord] = []

    all_paths = list(inputs)
    if directory:
        all_paths.append(directory)

    if not all_paths:
        click.echo(click.style("错误: 请指定输入文件或使用 --dir 指定目录", fg="red"), err=True)
        sys.exit(EXIT_NO_INPUT)

    if not quiet:
        click.echo("收集失败记录...")

    for input_path in tqdm(all_paths, disable=quiet, desc="扫描文件"):
        path = Path(input_path)
        if not path.exists():
            if not quiet:
                click.echo(click.style(f"  警告: 路径不存在 - {input_path}", fg="yellow"))
            continue

        if path.is_file():
            try:
                file_records = parser.parse_file(str(path))
                records.extend(file_records)
            except Exception as e:
                if not quiet:
                    click.echo(click.style(f"  警告: 无法解析 {input_path}: {e}", fg="yellow"))
        elif path.is_dir():
            try:
                dir_records = parser.parse_directory(str(path), recursive=recursive)
                records.extend(dir_records)
            except Exception as e:
                if not quiet:
                    click.echo(click.style(f"  警告: 无法扫描目录 {input_path}: {e}", fg="yellow"))

    seen_ids = set()
    unique_records = []
    for record in records:
        if record.id not in seen_ids:
            seen_ids.add(record.id)
            unique_records.append(record)

    return unique_records


def _load_config(
    config_file: Optional[str],
    similarity: Optional[float],
    min_cluster: Optional[int],
) -> ClusterConfig:
    if config_file:
        config = ClusterConfig.from_yaml(config_file)
    else:
        config = ClusterConfig.default()

    if similarity is not None:
        config.similarity_threshold = similarity

    if min_cluster is not None:
        config.min_cluster_size = min_cluster

    return config


if __name__ == "__main__":
    main()
