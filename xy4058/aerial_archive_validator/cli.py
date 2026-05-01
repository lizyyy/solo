from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import json
import os
import shutil
import uuid

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from .config import (
    ProjectConfig,
    MaterialType,
    MaterialMetadata,
    CheckReport,
    ValidationResult,
    ValidationRule,
)
from .metadata import MaterialScanner
from .log_alignment import (
    LogAligner,
    FlightLogParser,
    WaypointPlanParser,
    DeliveryListParser,
)
from .rules import ValidationEngine, QuarantineManager
from .packer import MaterialPacker, ManifestGenerator, PackResult
from .reporter import ReportExporter
from .sample_data import SampleProjectCreator
from .exceptions import (
    AerialValidatorError,
    ConfigurationError,
    InvalidProjectError,
)


console = Console()


def get_project_path(ctx: click.Context) -> Path:
    project_dir = ctx.obj.get("project_dir", Path.cwd())
    return Path(project_dir)


def find_project_config(project_path: Path) -> Optional[Path]:
    config_names = ["project_config.json", "aerial_config.json", "config.json"]
    for name in config_names:
        config_path = project_path / name
        if config_path.exists():
            return config_path

    for root, dirs, files in os.walk(project_path):
        for name in config_names:
            if name in files:
                return Path(root) / name

    return None


def load_project_config(project_path: Path) -> Tuple[ProjectConfig, Path]:
    config_path = find_project_config(project_path)
    if not config_path:
        raise InvalidProjectError(
            f"未在 {project_path} 中找到项目配置文件",
            str(project_path),
        )

    config = ProjectConfig.load_from_file(config_path)
    return config, config_path


def save_metadata_cache(
    materials: List[MaterialMetadata],
    output_path: Path,
) -> None:
    data = {
        "generated_at": datetime.now().isoformat(),
        "materials": [],
    }

    for mat in materials:
        mat_dict = mat.model_dump()
        if mat.capture_time:
            mat_dict["capture_time"] = mat.capture_time.isoformat()
        data["materials"].append(mat_dict)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def load_metadata_cache(cache_path: Path) -> List[MaterialMetadata]:
    with open(cache_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    materials: List[MaterialMetadata] = []
    for mat_dict in data.get("materials", []):
        if mat_dict.get("capture_time"):
            mat_dict["capture_time"] = datetime.fromisoformat(mat_dict["capture_time"])
        materials.append(MaterialMetadata.model_validate(mat_dict))

    return materials


@click.group()
@click.option(
    "--project", "-p",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    default=None,
    help="指定项目目录路径（默认为当前目录）",
)
@click.pass_context
def main(ctx: click.Context, project: Optional[Path]) -> None:
    """航拍素材归档校验员 - 无人机航拍素材自动化校验工具"""
    ctx.ensure_object(dict)
    if project:
        ctx.obj["project_dir"] = project
    else:
        ctx.obj["project_dir"] = Path.cwd()


@main.command()
@click.option(
    "--name", "-n",
    required=True,
    help="项目名称",
)
@click.option(
    "--project-id", "-i",
    default=None,
    help="项目ID（自动生成UUID如未指定）",
)
@click.option(
    "--output", "-o",
    type=click.Path(path_type=Path),
    default=None,
    help="输出目录路径（默认为当前目录）",
)
@click.option(
    "--with-sample",
    is_flag=True,
    default=False,
    help="同时创建示例数据",
)
@click.pass_context
def init(
    ctx: click.Context,
    name: str,
    project_id: Optional[str],
    output: Optional[Path],
    with_sample: bool,
) -> None:
    """初始化新的航拍素材项目

    创建标准化项目目录结构和可配置的项目参数文件。
    """
    if output is None:
        output = Path.cwd() / name.replace(" ", "_")

    output.mkdir(parents=True, exist_ok=True)

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("正在创建项目...", total=4)

            if with_sample:
                creator = SampleProjectCreator()
                paths = creator.create_sample_project(output, name)
                progress.update(task, advance=4)
            else:
                project_id = project_id or str(uuid.uuid4())
                config = ProjectConfig(
                    project_name=name,
                    project_id=project_id,
                )

                for dir_name in config.directories.values():
                    dir_path = output / dir_name
                    dir_path.mkdir(parents=True, exist_ok=True)
                progress.update(task, advance=1)

                config_path = output / "project_config.json"
                config.save_to_file(config_path)
                progress.update(task, advance=2)
                progress.update(task, advance=3)
                progress.update(task, advance=4)

        console.print(Panel.fit(
            f"[bold green]✓ 项目创建成功[/bold green]\n\n"
            f"项目名称: {name}\n"
            f"项目ID: {project_id or '已生成'}\n"
            f"项目路径: {output}\n"
            + (f"\n[yellow]已包含示例数据[/yellow]" if with_sample else ""),
            title="项目初始化完成",
            border_style="green",
        ))

        console.print("\n[dim]下一步操作:[/dim]")
        console.print(f"  1. 将素材放入 {output / 'photos'} 或 {output / 'videos'} 目录")
        console.print(f"  2. 将飞行日志放入 {output / 'logs'} 目录")
        console.print(f"  3. 运行 'aerial-validator scan' 扫描素材")

    except AerialValidatorError as e:
        console.print(f"[bold red]错误:[/bold red] {e.message}")
        raise click.Abort()
    except Exception as e:
        console.print(f"[bold red]意外错误:[/bold red] {e}")
        raise click.Abort()


@main.command()
@click.option(
    "--directory", "-d",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    default=None,
    help="要扫描的目录（默认为项目的photos和videos目录）",
)
@click.option(
    "--recursive/--no-recursive",
    is_flag=True,
    default=True,
    help="是否递归扫描子目录（默认为递归）",
)
@click.option(
    "--cache", "-c",
    is_flag=True,
    default=True,
    help="是否缓存元数据结果",
)
@click.pass_context
def scan(
    ctx: click.Context,
    directory: Optional[Path],
    recursive: bool,
    cache: bool,
) -> None:
    """扫描素材文件并提取元数据

    遍历指定目录下的所有素材文件，提取照片EXIF元数据和视频文件元数据。
    """
    project_path = get_project_path(ctx)

    try:
        config, config_path = load_project_config(project_path)
        scanner = MaterialScanner(config)

        scan_paths: List[Path] = []

        if directory:
            scan_paths.append(directory)
        else:
            photos_dir = project_path / config.get_directory("photos")
            videos_dir = project_path / config.get_directory("videos")

            if photos_dir.exists():
                scan_paths.append(photos_dir)
            if videos_dir.exists():
                scan_paths.append(videos_dir)

        if not scan_paths:
            console.print("[bold yellow]警告:[/bold yellow] 未找到要扫描的目录")
            return

        all_materials: List[MaterialMetadata] = []

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            scan_task = progress.add_task("正在扫描素材...", total=None)

            for scan_path in scan_paths:
                progress.update(scan_task, description=f"正在扫描 {scan_path}...")
                materials = scanner.scan_directory(scan_path, recursive)
                all_materials.extend(materials)

            progress.update(scan_task, description="扫描完成")

        stats: Dict[MaterialType, int] = {}
        for mat in all_materials:
            stats[mat.material_type] = stats.get(mat.material_type, 0) + 1

        table = Table(title="扫描结果统计")
        table.add_column("素材类型", style="cyan")
        table.add_column("数量", style="magenta", justify="right")

        type_names = {
            MaterialType.PHOTO: "照片",
            MaterialType.VIDEO: "视频",
            MaterialType.LOG_CSV: "日志CSV",
            MaterialType.PLAN_JSON: "计划JSON",
            MaterialType.DELIVERY_LIST: "交付清单",
        }

        for mat_type, count in stats.items():
            table.add_row(
                type_names.get(mat_type, str(mat_type)),
                str(count),
            )

        table.add_row("合计", str(len(all_materials)), style="bold")
        console.print(table)

        if cache and all_materials:
            metadata_dir = project_path / config.get_directory("metadata")
            metadata_dir.mkdir(parents=True, exist_ok=True)

            cache_path = metadata_dir / f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            save_metadata_cache(all_materials, cache_path)

            latest_path = metadata_dir / "scan_latest.json"
            if latest_path.exists():
                latest_path.unlink()
            latest_path.symlink_to(cache_path.name) if hasattr(os, "symlink") else shutil.copy2(cache_path, latest_path)

            console.print(f"\n[dim]元数据已缓存至: {cache_path}[/dim]")

        if not all_materials:
            console.print("[bold yellow]提示:[/bold yellow] 未找到任何素材文件")

    except InvalidProjectError as e:
        console.print(f"[bold red]项目错误:[/bold red] {e.message}")
        console.print("\n[dim]请确保在项目目录中运行此命令，或使用 --project 指定项目路径[/dim]")
        raise click.Abort()
    except AerialValidatorError as e:
        console.print(f"[bold red]错误:[/bold red] {e.message}")
        raise click.Abort()


@main.command("import-log")
@click.argument(
    "log_file",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
)
@click.option(
    "--type", "-t",
    type=click.Choice(["flight", "plan", "delivery", "auto"]),
    default="auto",
    help="日志类型（auto为自动检测）",
)
@click.pass_context
def import_log(
    ctx: click.Context,
    log_file: Path,
    type: str,
) -> None:
    """导入飞行日志、航点计划或交付清单

    LOG_FILE: 要导入的日志文件路径

    支持的文件类型：
    - flight: 飞行日志CSV文件
    - plan: 航点计划JSON文件
    - delivery: 交付清单CSV/TXT文件
    """
    project_path = get_project_path(ctx)

    try:
        config, _ = load_project_config(project_path)

        log_aligner = LogAligner(config)

        file_ext = log_file.suffix.lower()

        if type == "auto":
            if file_ext == ".csv":
                if "log" in log_file.stem.lower() or "flight" in log_file.stem.lower():
                    type = "flight"
                elif "delivery" in log_file.stem.lower() or "list" in log_file.stem.lower():
                    type = "delivery"
                else:
                    type = "flight"
            elif file_ext == ".json":
                type = "plan"
            elif file_ext == ".txt":
                type = "delivery"

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("正在导入...", total=1)

            if type == "flight":
                entries = FlightLogParser.parse_csv(log_file)
                log_aligner.add_flight_logs(entries)
                progress.update(task, advance=1)
                console.print(Panel.fit(
                    f"[bold green]✓ 飞行日志导入成功[/bold green]\n"
                    f"记录数量: {len(entries)}\n"
                    f"文件: {log_file}",
                    title="飞行日志导入",
                    border_style="green",
                ))

            elif type == "plan":
                entries = WaypointPlanParser.parse_json(log_file)
                log_aligner.add_waypoint_plans(entries)
                progress.update(task, advance=1)
                console.print(Panel.fit(
                    f"[bold green]✓ 航点计划导入成功[/bold green]\n"
                    f"航点数量: {len(entries)}\n"
                    f"文件: {log_file}",
                    title="航点计划导入",
                    border_style="green",
                ))

            elif type == "delivery":
                if file_ext == ".csv":
                    items = DeliveryListParser.parse_csv(log_file)
                else:
                    items = DeliveryListParser.parse_txt(log_file)
                log_aligner.add_delivery_list(items)
                progress.update(task, advance=1)
                console.print(Panel.fit(
                    f"[bold green]✓ 交付清单导入成功[/bold green]\n"
                    f"条目数量: {len(items)}\n"
                    f"文件: {log_file}",
                    title="交付清单导入",
                    border_style="green",
                ))

    except InvalidProjectError as e:
        console.print(f"[bold red]项目错误:[/bold red] {e.message}")
        raise click.Abort()
    except AerialValidatorError as e:
        console.print(f"[bold red]错误:[/bold red] {e.message}")
        raise click.Abort()


@main.command()
@click.option(
    "--cache", "-c",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    default=None,
    help="使用指定的元数据缓存文件",
)
@click.option(
    "--quarantine/--no-quarantine",
    is_flag=True,
    default=True,
    help="是否将异常素材移至隔离区",
)
@click.option(
    "--rules", "-r",
    type=str,
    default=None,
    help="指定要运行的规则（逗号分隔，如：time_misalignment,duplicate_archive）",
)
@click.pass_context
def check(
    ctx: click.Context,
    cache: Optional[Path],
    quarantine: bool,
    rules: Optional[str],
) -> None:
    """执行多维度校验检查

    执行所有启用的校验规则，识别异常素材并生成校验报告。
    """
    project_path = get_project_path(ctx)

    try:
        config, _ = load_project_config(project_path)

        if rules:
            rule_names = [r.strip() for r in rules.split(",")]
            enabled_rules = []
            for r in rule_names:
                try:
                    enabled_rules.append(ValidationRule(r))
                except ValueError:
                    console.print(f"[bold yellow]警告:[/bold yellow] 未知的规则 '{r}'，已跳过")
            config.enabled_rules = enabled_rules

        metadata_dir = project_path / config.get_directory("metadata")
        materials: List[MaterialMetadata] = []

        if cache:
            materials = load_metadata_cache(cache)
        elif metadata_dir.exists():
            latest_cache = metadata_dir / "scan_latest.json"
            if latest_cache.exists():
                materials = load_metadata_cache(latest_cache)

        if not materials:
            console.print("[bold yellow]警告:[/bold yellow] 未找到元数据缓存")
            console.print("[dim]请先运行 'aerial-validator scan' 扫描素材[/dim]")
            return

        log_aligner = LogAligner(config)
        logs_dir = project_path / config.get_directory("logs")
        plans_dir = project_path / config.get_directory("plans")
        delivery_dir = project_path / config.get_directory("delivery_lists")

        if logs_dir.exists():
            for log_file in logs_dir.glob("*.csv"):
                try:
                    entries = FlightLogParser.parse_csv(log_file)
                    log_aligner.add_flight_logs(entries)
                except Exception:
                    pass

        if plans_dir.exists():
            for plan_file in plans_dir.glob("*.json"):
                try:
                    entries = WaypointPlanParser.parse_json(plan_file)
                    log_aligner.add_waypoint_plans(entries)
                except Exception:
                    pass

        if delivery_dir.exists():
            for delivery_file in delivery_dir.glob("*.csv"):
                try:
                    items = DeliveryListParser.parse_csv(delivery_file)
                    log_aligner.add_delivery_list(items)
                except Exception:
                    pass
            for delivery_file in delivery_dir.glob("*.txt"):
                try:
                    items = DeliveryListParser.parse_txt(delivery_file)
                    log_aligner.add_delivery_list(items)
                except Exception:
                    pass

        engine = ValidationEngine(config, log_aligner)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("正在执行校验...", total=len(materials))

            check_report = engine.validate_all(
                materials,
                project_id=config.project_id,
            )

            for _ in materials:
                progress.update(task, advance=1)

        if quarantine:
            quarantine_dir = project_path / config.get_directory("quarantine")
            qm = QuarantineManager(quarantine_dir)

            invalid_results: Dict[str, List[ValidationResult]] = {}
            for result in check_report.validation_results:
                if not result.is_valid and result.severity == "error":
                    file_path = result.material_metadata.file_path
                    if file_path not in invalid_results:
                        invalid_results[file_path] = []
                    invalid_results[file_path].append(result)

            quarantined_count = 0
            for file_path_str, results in invalid_results.items():
                file_path = Path(file_path_str)
                if file_path.exists():
                    try:
                        qm.move_to_quarantine(
                            file_path,
                            "校验失败",
                            results,
                        )
                        quarantined_count += 1
                    except Exception:
                        pass

            check_report.quarantined_materials = quarantined_count

        table = Table(title="校验结果统计")
        table.add_column("规则名称", style="cyan")
        table.add_column("通过", style="green", justify="right")
        table.add_column("失败", style="red", justify="right")
        table.add_column("总计", style="magenta", justify="right")

        rule_names = {
            ValidationRule.DELIVERY_MISSING: "交付清单缺失",
            ValidationRule.TIME_MISALIGNMENT: "时间同步",
            ValidationRule.COORDINATE_DEVIATION: "坐标偏离",
            ValidationRule.DUPLICATE_ARCHIVE: "重复归档",
            ValidationRule.MISSING_METADATA: "元数据缺失",
            ValidationRule.NO_FLY_ZONE: "禁飞区检查",
        }

        for rule, stats in check_report.stats_by_rule.items():
            valid = stats.get("valid", 0)
            invalid = stats.get("invalid", 0)
            total = valid + invalid

            if total > 0:
                table.add_row(
                    rule_names.get(rule, str(rule)),
                    str(valid),
                    str(invalid),
                    str(total),
                )

        console.print(table)

        summary_msg = (
            f"总素材: {check_report.total_materials} | "
            f"[green]通过: {check_report.valid_materials}[/green] | "
            f"[red]失败: {check_report.invalid_materials}[/red]"
        )
        if check_report.quarantined_materials > 0:
            summary_msg += f" | [yellow]已隔离: {check_report.quarantined_materials}[/yellow]"

        console.print(Panel.fit(summary_msg, title="校验完成", border_style="blue"))

        reports_dir = project_path / config.get_directory("reports")
        reports_dir.mkdir(parents=True, exist_ok=True)

        report_id = check_report.report_id[:8]
        report_base = f"check_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{report_id}"

        exporter = ReportExporter(check_report, config)
        report_paths = exporter.export_all(reports_dir, report_base)

        console.print(f"\n[dim]报告已导出至: {reports_dir}[/dim]")
        for fmt, path in report_paths.items():
            console.print(f"  - {fmt}: {path.name}")

    except InvalidProjectError as e:
        console.print(f"[bold red]项目错误:[/bold red] {e.message}")
        raise click.Abort()
    except AerialValidatorError as e:
        console.print(f"[bold red]错误:[/bold red] {e.message}")
        raise click.Abort()


@main.command()
@click.option(
    "--output", "-o",
    type=click.Path(path_type=Path),
    default=None,
    help="输出目录（默认为项目的output目录）",
)
@click.option(
    "--overwrite", "-f",
    is_flag=True,
    default=False,
    help="是否覆盖已存在的文件",
)
@click.option(
    "--check-report", "-r",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    default=None,
    help="使用指定的校验报告JSON文件",
)
@click.pass_context
def pack(
    ctx: click.Context,
    output: Optional[Path],
    overwrite: bool,
    check_report: Optional[Path],
) -> None:
    """打包通过校验的素材

    仅复制通过所有校验的素材至指定交付目录，并生成manifest文件。
    """
    project_path = get_project_path(ctx)

    try:
        config, _ = load_project_config(project_path)

        if output is None:
            output = project_path / config.get_directory("output")

        metadata_dir = project_path / config.get_directory("metadata")
        materials: List[MaterialMetadata] = []

        if metadata_dir.exists():
            latest_cache = metadata_dir / "scan_latest.json"
            if latest_cache.exists():
                materials = load_metadata_cache(latest_cache)

        if not materials:
            console.print("[bold yellow]警告:[/bold yellow] 未找到元数据缓存")
            console.print("[dim]请先运行 'aerial-validator scan' 扫描素材[/dim]")
            return

        reports_dir = project_path / config.get_directory("reports")
        report_data: Optional[Dict[str, Any]] = None

        if check_report:
            with open(check_report, "r", encoding="utf-8") as f:
                report_data = json.load(f)
        elif reports_dir.exists():
            report_files = sorted(reports_dir.glob("check_report_*.json"), reverse=True)
            if report_files:
                with open(report_files[0], "r", encoding="utf-8") as f:
                    report_data = json.load(f)

        if not report_data:
            console.print("[bold red]错误:[/bold red] 未找到校验报告")
            console.print("[dim]请先运行 'aerial-validator check' 执行校验[/dim]")
            return

        from .reporter import JSONReporter
        check_report_obj = CheckReport(
            project_id=report_data.get("project_id", config.project_id),
            report_id=report_data.get("report_id", str(uuid.uuid4())),
        )

        summary = report_data.get("summary", {})
        check_report_obj.total_materials = summary.get("total_materials", 0)
        check_report_obj.valid_materials = summary.get("valid_materials", 0)
        check_report_obj.invalid_materials = summary.get("invalid_materials", 0)

        packer = MaterialPacker(config, check_report_obj, output)

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("正在打包素材...", total=len(materials))

            pack_result = packer.pack_all(materials, overwrite)

            for _ in materials:
                progress.update(task, advance=1)

        console.print(Panel.fit(
            f"[bold green]✓ 打包完成[/bold green]\n"
            f"总文件: {pack_result.total_files}\n"
            f"已复制: [green]{pack_result.copied_files}[/green]\n"
            f"已跳过: [yellow]{pack_result.skipped_files}[/yellow]\n"
            f"失败: [red]{pack_result.failed_files}[/red]\n"
            f"输出目录: {output}",
            title="素材打包",
            border_style="green",
        ))

        manifest = ManifestGenerator.generate(pack_result, check_report_obj, config)
        manifest_path = output / "manifest.json"
        ManifestGenerator.save(manifest, manifest_path)

        console.print(f"\n[dim]Manifest已生成: {manifest_path}[/dim]")

    except InvalidProjectError as e:
        console.print(f"[bold red]项目错误:[/bold red] {e.message}")
        raise click.Abort()
    except AerialValidatorError as e:
        console.print(f"[bold red]错误:[/bold red] {e.message}")
        raise click.Abort()


@main.command()
@click.option(
    "--format", "-f",
    type=click.Choice(["md", "markdown", "csv", "json", "all"]),
    default="all",
    help="导出格式（all为导出所有格式）",
)
@click.option(
    "--output", "-o",
    type=click.Path(path_type=Path),
    default=None,
    help="输出目录或文件路径",
)
@click.option(
    "--check-report", "-r",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    default=None,
    help="使用指定的校验报告JSON文件",
)
@click.option(
    "--title", "-t",
    default=None,
    help="报告标题",
)
@click.pass_context
def report(
    ctx: click.Context,
    format: str,
    output: Optional[Path],
    check_report: Optional[Path],
    title: Optional[str],
) -> None:
    """导出校验报告

    支持Markdown、CSV和JSON格式的报告导出。
    """
    project_path = get_project_path(ctx)

    try:
        config, _ = load_project_config(project_path)

        reports_dir = project_path / config.get_directory("reports")
        report_data: Optional[Dict[str, Any]] = None

        if check_report:
            with open(check_report, "r", encoding="utf-8") as f:
                report_data = json.load(f)
        elif reports_dir.exists():
            report_files = sorted(reports_dir.glob("check_report_*.json"), reverse=True)
            if report_files:
                with open(report_files[0], "r", encoding="utf-8") as f:
                    report_data = json.load(f)

        if not report_data:
            console.print("[bold red]错误:[/bold red] 未找到校验报告")
            console.print("[dim]请先运行 'aerial-validator check' 执行校验[/dim]")
            return

        from .reporter import MarkdownReporter, CSVReporter, JSONReporter
        from .config import CheckReport, ValidationResult, MaterialMetadata, ValidationRule

        check_report_obj = CheckReport(
            project_id=report_data.get("project_id", config.project_id),
            report_id=report_data.get("report_id", str(uuid.uuid4())),
        )

        summary = report_data.get("summary", {})
        check_report_obj.total_materials = summary.get("total_materials", 0)
        check_report_obj.valid_materials = summary.get("valid_materials", 0)
        check_report_obj.invalid_materials = summary.get("invalid_materials", 0)
        check_report_obj.quarantined_materials = summary.get("quarantined_materials", 0)

        if output is None:
            output = reports_dir

        output_path = output
        if output.is_dir():
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            base_name = f"report_{timestamp}"
            output_path = output / base_name

        exported: List[str] = []

        if format in ["md", "markdown", "all"]:
            md_content = MarkdownReporter.generate(
                check_report_obj,
                config,
                title or "航拍素材归档校验报告",
            )
            md_path = output_path.with_suffix(".md") if output_path.suffix else output_path / "report.md"
            md_path.parent.mkdir(parents=True, exist_ok=True)
            MarkdownReporter.save(md_content, md_path)
            exported.append(f"Markdown: {md_path}")

        if format in ["csv", "all"]:
            csv_path = output_path.with_suffix(".csv") if output_path.suffix else output_path / "report.csv"
            csv_path.parent.mkdir(parents=True, exist_ok=True)
            CSVReporter.generate(check_report_obj, csv_path)
            exported.append(f"CSV: {csv_path}")

        if format in ["json", "all"]:
            json_data = JSONReporter.generate(check_report_obj, config)
            json_path = output_path.with_suffix(".json") if output_path.suffix else output_path / "report.json"
            json_path.parent.mkdir(parents=True, exist_ok=True)
            JSONReporter.save(json_data, json_path)
            exported.append(f"JSON: {json_path}")

        console.print(Panel.fit(
            "[bold green]✓ 报告导出成功[/bold green]\n\n" + "\n".join(exported),
            title="报告导出",
            border_style="green",
        ))

    except InvalidProjectError as e:
        console.print(f"[bold red]项目错误:[/bold red] {e.message}")
        raise click.Abort()
    except AerialValidatorError as e:
        console.print(f"[bold red]错误:[/bold red] {e.message}")
        raise click.Abort()


@main.command("sample-project")
@click.option(
    "--name", "-n",
    default="示例航拍项目",
    help="项目名称",
)
@click.option(
    "--output", "-o",
    type=click.Path(path_type=Path),
    default=None,
    help="输出目录",
)
@click.option(
    "--temp", "-t",
    is_flag=True,
    default=False,
    help="创建到临时目录",
)
@click.pass_context
def sample_project(
    ctx: click.Context,
    name: str,
    output: Optional[Path],
    temp: bool,
) -> None:
    """创建示例项目用于测试

    生成包含测试素材、飞行日志、航点计划和交付清单的完整示例项目。
    """
    try:
        if temp:
            from .sample_data import create_temp_sample_project
            temp_dir = create_temp_sample_project(name)
            console.print(Panel.fit(
                f"[bold green]✓ 临时示例项目创建成功[/bold green]\n\n"
                f"项目路径: {temp_dir}\n\n"
                f"[yellow]注意: 此为临时目录，系统重启后可能被清除[/yellow]",
                title="临时示例项目",
                border_style="green",
            ))
            return

        if output is None:
            output = Path.cwd() / name.replace(" ", "_")

        creator = SampleProjectCreator()
        paths = creator.create_sample_project(output, name)

        console.print(Panel.fit(
            f"[bold green]✓ 示例项目创建成功[/bold green]\n\n"
            f"项目名称: {name}\n"
            f"项目路径: {output}\n\n"
            f"创建的文件:\n"
            f"  - 配置: {paths.get('config', 'N/A').name if paths.get('config') else 'N/A'}\n"
            f"  - 飞行日志: {paths.get('flight_log', 'N/A').name if paths.get('flight_log') else 'N/A'}\n"
            f"  - 航点计划: {paths.get('waypoint_plan', 'N/A').name if paths.get('waypoint_plan') else 'N/A'}\n"
            f"  - 交付清单: {paths.get('delivery_list', 'N/A').name if paths.get('delivery_list') else 'N/A'}",
            title="示例项目",
            border_style="green",
        ))

        console.print("\n[dim]测试全流程命令:[/dim]")
        console.print(f"  cd {output}")
        console.print(f"  aerial-validator scan")
        console.print(f"  aerial-validator check")
        console.print(f"  aerial-validator pack")
        console.print(f"  aerial-validator report")

    except AerialValidatorError as e:
        console.print(f"[bold red]错误:[/bold red] {e.message}")
        raise click.Abort()
