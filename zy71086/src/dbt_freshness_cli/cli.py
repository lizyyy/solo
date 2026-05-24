import sys
from pathlib import Path
from typing import Dict, Optional, List, Tuple

import click
from rich.console import Console

from . import __version__
from .parser import DBTArtifactsParser
from .dependency_graph import DependencyGraph
from .analyzer import FreshnessAnalyzer
from .reporter import ReportReporter
from .models import ExitCode, Severity


console = Console()


def validate_input_paths(
    manifest: Optional[str],
    run_results: Optional[str],
    source_freshness: Optional[str],
    report_tables: Optional[str],
) -> Tuple[bool, List[str]]:
    errors: List[str] = []

    if not manifest:
        errors.append("manifest.json 路径是必需的")
    else:
        manifest_path = Path(manifest)
        if not manifest_path.exists():
            errors.append(f"manifest 文件不存在: {manifest_path}")
        elif not manifest_path.is_file():
            errors.append(f"manifest 路径不是文件: {manifest_path}")

    if run_results:
        run_results_path = Path(run_results)
        if not run_results_path.exists():
            errors.append(f"run_results 文件不存在: {run_results_path}")
        elif not run_results_path.is_file():
            errors.append(f"run_results 路径不是文件: {run_results_path}")

    if source_freshness:
        freshness_path = Path(source_freshness)
        if not freshness_path.exists():
            errors.append(f"source_freshness 文件不存在: {freshness_path}")
        elif not freshness_path.is_file():
            errors.append(f"source_freshness 路径不是文件: {freshness_path}")

    if report_tables:
        tables_path = Path(report_tables)
        if not tables_path.exists():
            errors.append(f"report_tables 文件不存在: {tables_path}")
        elif not tables_path.is_file():
            errors.append(f"report_tables 路径不是文件: {tables_path}")

    return len(errors) == 0, errors


def parse_report_tables(report_tables_path: Optional[str]) -> Dict[str, str]:
    if not report_tables_path:
        return {}

    import json

    path = Path(report_tables_path)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict):
        return data
    elif isinstance(data, list):
        result = {}
        for item in data:
            if isinstance(item, dict) and "name" in item and "unique_id" in item:
                result[item["name"]] = item["unique_id"]
            elif isinstance(item, str):
                result[item] = item
        return result
    return {}


@click.command()
@click.option(
    "--manifest",
    "-m",
    type=click.Path(exists=False, dir_okay=False, path_type=Path),
    required=True,
    help="DBT manifest.json 文件路径",
)
@click.option(
    "--run-results",
    "-r",
    type=click.Path(exists=False, dir_okay=False, path_type=Path),
    help="DBT run_results.json 文件路径",
)
@click.option(
    "--source-freshness",
    "-s",
    type=click.Path(exists=False, dir_okay=False, path_type=Path),
    help="DBT sources.json (source freshness) 文件路径",
)
@click.option(
    "--report-tables",
    "-t",
    type=click.Path(exists=False, dir_okay=False, path_type=Path),
    help="报表表配置 JSON 文件路径 (格式: {\"报表名称\": \"model.unique_id\"})",
)
@click.option(
    "--output-dir",
    "-o",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path("./freshness_report"),
    help="报告输出目录 (默认: ./freshness_report)",
)
@click.option(
    "--warn-threshold",
    "-w",
    type=int,
    default=60,
    help="警告阈值 (分钟, 默认: 60)",
)
@click.option(
    "--critical-threshold",
    "-c",
    type=int,
    default=180,
    help="严重阈值 (分钟, 默认: 180)",
)
@click.option(
    "--expected-frequency",
    "-f",
    type=int,
    default=60,
    help="预期更新频率 (分钟, 默认: 60)",
)
@click.option(
    "--quiet",
    "-q",
    is_flag=True,
    help="静默模式, 不输出终端摘要",
)
@click.option(
    "--json-only",
    is_flag=True,
    help="只输出 JSON 报告, 不生成 Markdown",
)
@click.version_option(version=__version__, prog_name="dbt-freshness")
def main(
    manifest: Path,
    run_results: Optional[Path],
    source_freshness: Optional[Path],
    report_tables: Optional[Path],
    output_dir: Path,
    warn_threshold: int,
    critical_threshold: int,
    expected_frequency: int,
    quiet: bool,
    json_only: bool,
) -> None:
    """DBT 模型新鲜度诊断工具

    分析 DBT 模型的新鲜度、依赖关系和下游影响。
    """

    valid, errors = validate_input_paths(
        str(manifest) if manifest else None,
        str(run_results) if run_results else None,
        str(source_freshness) if source_freshness else None,
        str(report_tables) if report_tables else None,
    )

    if not valid:
        console.print("[bold red]输入校验失败:[/bold red]")
        for error in errors:
            console.print(f"  • {error}")
        sys.exit(ExitCode.INPUT_ERROR)

    if warn_threshold >= critical_threshold:
        console.print(
            f"[bold red]警告阈值 ({warn_threshold}) 必须小于严重阈值 ({critical_threshold})[/bold red]"
        )
        sys.exit(ExitCode.INPUT_ERROR)

    parser = DBTArtifactsParser()

    with console.status("[bold green]解析 manifest...[/bold green]"):
        success, parse_errors = parser.parse_manifest(manifest)
        if not success:
            console.print("[bold yellow]manifest 解析警告:[/bold yellow]")
            for error in parse_errors[:5]:
                console.print(f"  • {error}")

    if run_results:
        with console.status("[bold green]解析 run_results...[/bold green]"):
            success, parse_errors = parser.parse_run_results(run_results)
            if not success:
                console.print("[bold yellow]run_results 解析警告:[/bold yellow]")
                for error in parse_errors[:5]:
                    console.print(f"  • {error}")

    if source_freshness:
        with console.status("[bold green]解析 source_freshness...[/bold green]"):
            success, parse_errors = parser.parse_source_freshness(source_freshness)
            if not success:
                console.print("[bold yellow]source_freshness 解析警告:[/bold yellow]")
                for error in parse_errors[:5]:
                    console.print(f"  • {error}")

    tables_config = parse_report_tables(str(report_tables) if report_tables else None)

    with console.status("[bold green]构建依赖图...[/bold green]"):
        graph = DependencyGraph(parser)

    with console.status("[bold green]分析新鲜度...[/bold green]"):
        analyzer = FreshnessAnalyzer(
            parser=parser,
            graph=graph,
            warn_threshold_minutes=warn_threshold,
            critical_threshold_minutes=critical_threshold,
            expected_frequency_minutes=expected_frequency,
            report_tables=tables_config,
        )
        report = analyzer.analyze()

    with console.status("[bold green]生成报告...[/bold green]"):
        output_dir.mkdir(parents=True, exist_ok=True)
        reporter = ReportReporter(report, output_dir)

        reporter.generate_json()
        if not json_only:
            reporter.generate_markdown()

    if not quiet:
        reporter.print_console_summary()

    exit_code = analyzer.get_exit_code(report.severity)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
