import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple

import click
from rich.console import Console

from .models.report import (
    Report,
    ReportMetadata,
    ReportStatistics,
    ExitCode,
    ExitCodeInfo,
)
from .models.conflict import ConflictSeverity, ConflictType
from .parsers.gradle_parser import GradleParser, GradleFile
from .parsers.version_catalog_parser import VersionCatalogParser
from .parsers.rules_parser import RulesParser
from .processor import DependencyProcessor
from .output.output_writer import OutputWriter, OutputFormat

console = Console()


def validate_input_paths(
    gradle_files: Tuple[str],
    catalog_files: Tuple[str],
    rules_files: Tuple[str],
) -> Tuple[List[Path], List[Path], List[Path], List[str]]:
    errors = []
    gradle_paths = []
    catalog_paths = []
    rules_paths = []

    for f in gradle_files:
        path = Path(f)
        if path.exists():
            gradle_paths.append(path)
        else:
            errors.append(f"Gradle 文件不存在: {f}")

    for f in catalog_files:
        path = Path(f)
        if path.exists():
            catalog_paths.append(path)
        else:
            errors.append(f"Version Catalog 文件不存在: {f}")

    for f in rules_files:
        path = Path(f)
        if path.exists():
            rules_paths.append(path)
        else:
            errors.append(f"规则文件不存在: {f}")

    return gradle_paths, catalog_paths, rules_paths, errors


def discover_gradle_files(project_dir: str) -> List[Path]:
    project_path = Path(project_dir)
    if not project_path.exists():
        return []

    gradle_files = []
    patterns = [
        "build.gradle",
        "build.gradle.kts",
        "settings.gradle",
        "settings.gradle.kts",
    ]

    for pattern in patterns:
        for path in project_path.rglob(pattern):
            if "build" not in path.parts:
                gradle_files.append(path)

    return gradle_files


def discover_catalog_files(project_dir: str) -> List[Path]:
    project_path = Path(project_dir)
    if not project_path.exists():
        return []

    catalog_files = []
    for path in project_path.rglob("libs.versions.toml"):
        if "build" not in path.parts:
            catalog_files.append(path)

    return catalog_files


@click.group()
@click.version_option(version="0.1.0", prog_name="gradle-dep-replace")
def cli():
    """Gradle 依赖替换 CLI 工具

    统一管理版本目录、build.gradle 和插件替换规则，解决依赖冲突问题。
    """
    pass


@cli.command()
@click.option(
    "--gradle-file", "-g",
    multiple=True,
    help="Gradle 构建文件路径 (build.gradle, settings.gradle 等)，可多次指定",
)
@click.option(
    "--catalog-file", "-c",
    multiple=True,
    help="Version Catalog 文件路径 (*.versions.toml)，可多次指定",
)
@click.option(
    "--rules-file", "-r",
    multiple=True,
    help="替换规则文件路径 (YAML/JSON)，可多次指定",
)
@click.option(
    "--project-dir", "-p",
    help="项目根目录，自动发现 Gradle 文件和 Version Catalog",
)
@click.option(
    "--output-dir", "-o",
    default="./gradle-dep-reports",
    help="输出目录 (默认: ./gradle-dep-reports)",
)
@click.option(
    "--output-format", "-f",
    type=click.Choice(["json", "markdown", "all"]),
    default="all",
    help="输出格式 (默认: all)",
)
@click.option(
    "--overwrite/--no-overwrite",
    default=True,
    help="是否覆盖已存在的输出文件 (默认: 覆盖)",
)
@click.option(
    "--strict",
    is_flag=True,
    help="严格模式，检测到冲突时返回非零退出码",
)
@click.option(
    "--verbose", "-v",
    is_flag=True,
    help="显示详细输出",
)
def analyze(
    gradle_file: Tuple[str],
    catalog_file: Tuple[str],
    rules_file: Tuple[str],
    project_dir: Optional[str],
    output_dir: str,
    output_format: str,
    overwrite: bool,
    strict: bool,
    verbose: bool,
):
    """分析 Gradle 依赖并生成报告"""
    start_time = time.time()

    metadata = ReportMetadata(
        command_line=" ".join(sys.argv),
        output_directory=str(Path(output_dir).absolute()),
    )

    all_gradle_paths: List[Path] = []
    all_catalog_paths: List[Path] = []
    all_rules_paths: List[Path] = []

    if project_dir:
        discovered_gradle = discover_gradle_files(project_dir)
        discovered_catalog = discover_catalog_files(project_dir)
        if verbose:
            console.print(f"🔍 在项目目录中发现 {len(discovered_gradle)} 个 Gradle 文件")
            console.print(f"🔍 在项目目录中发现 {len(discovered_catalog)} 个 Version Catalog 文件")
        all_gradle_paths.extend(discovered_gradle)
        all_catalog_paths.extend(discovered_catalog)

    gradle_paths, catalog_paths, rules_paths, errors = validate_input_paths(
        gradle_file, catalog_file, rules_file
    )

    all_gradle_paths.extend(gradle_paths)
    all_catalog_paths.extend(catalog_paths)
    all_rules_paths.extend(rules_paths)

    all_gradle_paths = list(set(all_gradle_paths))
    all_catalog_paths = list(set(all_catalog_paths))
    all_rules_paths = list(set(all_rules_paths))

    metadata.input_files = [str(p) for p in all_gradle_paths + all_catalog_paths + all_rules_paths]

    if errors:
        for error in errors:
            console.print(f"❌ [red]{error}[/red]")

        report = Report(
            metadata=metadata,
            exit_code_info=ExitCodeInfo.from_code(ExitCode.INPUT_VALIDATION_ERROR),
        )
        report.notes.extend(errors)
        _write_report(report, output_dir, output_format, overwrite)
        sys.exit(int(ExitCode.INPUT_VALIDATION_ERROR))

    if not all_gradle_paths and not all_catalog_paths:
        console.print("❌ [red]未找到任何输入文件，请指定 --gradle-file、--catalog-file 或 --project-dir[/red]")
        report = Report(
            metadata=metadata,
            exit_code_info=ExitCodeInfo.from_code(ExitCode.NO_INPUT_FILES),
        )
        _write_report(report, output_dir, output_format, overwrite)
        sys.exit(int(ExitCode.NO_INPUT_FILES))

    try:
        gradle_files = _parse_gradle_files(all_gradle_paths)
        version_catalogs = _parse_catalog_files(all_catalog_paths)
        rules = _parse_rules_files(all_rules_paths)

        if verbose:
            console.print(f"✅ 解析了 {len(gradle_files)} 个 Gradle 文件")
            console.print(f"✅ 解析了 {len(version_catalogs)} 个 Version Catalog")
            console.print(f"✅ 加载了 {len(rules)} 条替换规则")

        processor = DependencyProcessor(gradle_files, version_catalogs, rules)
        replacement_result, conflicts = processor.process()

        stats = _calculate_statistics(processor, replacement_result, conflicts)

        exit_code = _determine_exit_code(conflicts, strict)

        report = Report(
            metadata=metadata,
            statistics=stats,
            exit_code_info=ExitCodeInfo.from_code(exit_code),
            replacement_result=replacement_result,
            conflicts=conflicts,
            version_catalogs=version_catalogs,
        )

        metadata.duration_ms = int((time.time() - start_time) * 1000)

        if not overwrite:
            report.notes.append("已启用非覆盖模式，同名输出文件不会被覆盖")

        generated_files = _write_report(report, output_dir, output_format, overwrite)
        report.output_files = generated_files

        writer = OutputWriter(report, output_dir, OutputFormat(output_format), overwrite)
        writer.generated_files = generated_files
        writer.print_console_summary()

        sys.exit(int(exit_code))

    except Exception as e:
        console.print(f"❌ [red]处理失败: {e}[/red]")
        if verbose:
            import traceback
            traceback.print_exc()

        report = Report(
            metadata=metadata,
            exit_code_info=ExitCodeInfo.from_code(ExitCode.UNKNOWN_ERROR),
        )
        report.notes.append(f"错误: {str(e)}")
        _write_report(report, output_dir, output_format, overwrite)
        sys.exit(int(ExitCode.UNKNOWN_ERROR))


def _parse_gradle_files(paths: List[Path]) -> List[GradleFile]:
    gradle_files = []
    for path in paths:
        parser = GradleParser(str(path))
        gf = parser.parse()
        gradle_files.append(gf)
    return gradle_files


def _parse_catalog_files(paths: List[Path]):
    catalogs = []
    for path in paths:
        parser = VersionCatalogParser(str(path))
        vc = parser.parse()
        catalogs.append(vc)
    return catalogs


def _parse_rules_files(paths: List[Path]):
    rules = []
    for path in paths:
        parser = RulesParser(str(path))
        rules.extend(parser.parse())
    return rules


def _calculate_statistics(processor, replacement_result, conflicts) -> ReportStatistics:
    stats = ReportStatistics()
    stats.total_dependencies = len(processor.all_dependencies)
    stats.total_plugins = len(processor.all_plugins)
    stats.changed_dependencies = replacement_result.changed_dependencies
    stats.unchanged_dependencies = replacement_result.unchanged_dependencies

    dynamic_count = sum(1 for d in processor.all_dependencies if d.is_dynamic)
    dynamic_count += sum(1 for d in processor.all_plugins if d.is_dynamic)
    stats.dynamic_versions = dynamic_count

    stats.conflicts_found = len(conflicts)
    for conflict in conflicts:
        if conflict.severity == ConflictSeverity.CRITICAL:
            stats.critical_conflicts += 1
        elif conflict.severity == ConflictSeverity.ERROR:
            stats.error_conflicts += 1
        elif conflict.severity == ConflictSeverity.WARNING:
            stats.warning_conflicts += 1
        elif conflict.severity == ConflictSeverity.INFO:
            stats.info_conflicts += 1

    rules_applied = sum(c.change_count for c in replacement_result.chains)
    stats.rules_applied = rules_applied

    return stats


def _determine_exit_code(conflicts, strict: bool) -> ExitCode:
    if not conflicts:
        return ExitCode.SUCCESS

    if not strict:
        return ExitCode.SUCCESS

    has_version_conflict = any(
        c.type in (ConflictType.VERSION_CONFLICT, ConflictType.CROSS_SOURCE_CONFLICT)
        and c.severity in (ConflictSeverity.ERROR, ConflictSeverity.WARNING)
        for c in conflicts
    )

    has_plugin_conflict = any(
        c.type == ConflictType.PLUGIN_VERSION_CONFLICT
        and c.severity in (ConflictSeverity.ERROR, ConflictSeverity.WARNING)
        for c in conflicts
    )

    if has_plugin_conflict:
        return ExitCode.PLUGIN_CONFLICT
    if has_version_conflict:
        return ExitCode.VERSION_CONFLICT

    return ExitCode.SUCCESS


def _write_report(report, output_dir: str, output_format: str, overwrite: bool) -> List[str]:
    writer = OutputWriter(report, output_dir, OutputFormat(output_format), overwrite)
    return writer.write()


@cli.command()
@click.argument("coordinate")
@click.option(
    "--target-version", "-t",
    help="目标版本",
)
@click.option(
    "--output", "-o",
    help="输出规则文件路径",
)
def create_rule(coordinate: str, target_version: Optional[str], output: Optional[str]):
    """为指定依赖创建替换规则模板"""
    import yaml

    rule = {
        "rules": [
            {
                "id": f"replace-{coordinate.replace(':', '-')}",
                "name": f"替换 {coordinate}",
                "description": f"将 {coordinate} 替换到指定版本",
                "match_strategy": "exact",
                "match_pattern": coordinate,
                "target_version": target_version or "指定目标版本",
                "reason": "版本统一要求",
                "priority": 10,
                "is_active": True,
            }
        ]
    }

    content = yaml.dump(rule, allow_unicode=True, sort_keys=False)

    if output:
        Path(output).write_text(content, encoding="utf-8")
        console.print(f"✅ 规则模板已写入: {output}")
    else:
        console.print(content)


@cli.command()
def list_exit_codes():
    """列出所有退出码及其含义"""
    console.print("\n📋 退出码列表:\n")

    for code in ExitCode:
        info = ExitCodeInfo.from_code(code)
        console.print(f"  [bold]{int(code):2d}[/bold] - {info.name:30s} {info.description}")

    console.print()


def main():
    cli()


if __name__ == "__main__":
    main()
