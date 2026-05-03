"""FITS 成像质检台命令行接口。"""

import os
import json
from typing import Optional, List, Dict, Any
from pathlib import Path
from datetime import datetime

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from fits_quality_checker import __version__
from fits_quality_checker.models.models import (
    ObservationConfig,
    FITSMetadata,
    ImageQualityMetrics,
    QualityResult,
    AnalysisResult,
    FileStatus,
    FileType,
)
from fits_quality_checker.parsers.fits_parser import FITSParser
from fits_quality_checker.parsers.csv_parser import CSVParser
from fits_quality_checker.parsers.validator import MetadataValidator, ValidationSeverity
from fits_quality_checker.quality.metrics import QualityMetricsCalculator
from fits_quality_checker.quality.temperature import TemperatureMatcher
from fits_quality_checker.rules.engine import RulesEngine
from fits_quality_checker.storage.config import ConfigManager
from fits_quality_checker.storage.persistence import DataStore
from fits_quality_checker.reports.generator import ReportGenerator


console = Console()


def get_workspace() -> Path:
    """获取工作空间路径。

    Returns:
        工作空间路径
    """
    return Path.cwd()


def get_config_manager() -> ConfigManager:
    """获取配置管理器。

    Returns:
        ConfigManager实例
    """
    return ConfigManager(str(get_workspace()))


def get_data_store() -> DataStore:
    """获取数据存储。

    Returns:
        DataStore实例
    """
    return DataStore(str(get_workspace()))


def load_config(config_name: Optional[str]) -> Optional[ObservationConfig]:
    """加载配置。

    Args:
        config_name: 配置名称，如果为None则使用默认配置

    Returns:
        ObservationConfig实例或None
    """
    config_manager = get_config_manager()

    if config_name:
        try:
            return config_manager.load_config(config_name)
        except Exception as e:
            console.print(f"[yellow]警告: 无法加载配置 '{config_name}': {e}[/yellow]")
            return config_manager.get_default_config()
    else:
        return config_manager.get_default_config()


@click.group()
@click.version_option(version=__version__)
@click.option("--config", "-c", help="指定配置名称")
@click.pass_context
def cli(ctx, config):
    """FITS 成像质检台 - 业余天文台专用本地质量检查工具。

    \b
    功能：
    - init: 初始化工作空间和创建观测配置
    - import: 导入文件清单并校验头信息
    - analyze: 计算星点圆度、背景噪声、FWHM和温度匹配
    - grade: 给出保留/隔离/重拍建议
    - report: 导出Markdown、CSV和JSON审计包
    """
    ctx.ensure_object(dict)
    ctx.obj["config_name"] = config


@cli.command()
@click.argument("config_name")
@click.option("--observer", "-o", help="观测者姓名")
@click.option("--telescope", "-t", help="望远镜型号")
@click.option("--camera", "-cam", help="相机型号")
@click.option("--focal-length", "-fl", type=float, help="焦距(mm)")
@click.option("--aperture", "-ap", type=float, help="光圈(mm)")
@click.option("--pixel-size", "-ps", type=float, help="像素大小(um)")
@click.option("--target", "-tar", help="目标名称")
@click.option("--expected-temperature", "-et", type=float, help="期望温度(°C)")
@click.option("--temperature-tolerance", "-tt", type=float, default=0.5, help="温度容差(°C)")
@click.option("--fwhm-threshold", "-ft", type=float, default=3.0, help="FWHM阈值(像素)")
@click.option("--roundness-threshold", "-rt", type=float, default=0.8, help="圆度阈值(0-1)")
@click.option("--noise-threshold", "-nt", type=float, default=10.0, help="背景噪声阈值(ADU)")
@click.option("--overwrite", is_flag=True, help="覆盖已存在的配置")
def init(
    config_name,
    observer,
    telescope,
    camera,
    focal_length,
    aperture,
    pixel_size,
    target,
    expected_temperature,
    temperature_tolerance,
    fwhm_threshold,
    roundness_threshold,
    noise_threshold,
    overwrite,
):
    """初始化工作空间并创建观测配置。

    CONFIG_NAME: 配置名称
    """
    console.print(Panel.fit(
        "[bold blue]FITS 成像质检台 - 初始化配置[/bold blue]",
        border_style="blue"
    ))

    config_manager = get_config_manager()

    # 初始化工作空间
    config_manager.init_workspace()
    get_data_store().init_workspace()

    # 创建配置
    config = config_manager.create_config(
        config_name=config_name,
        observer=observer,
        telescope=telescope,
        camera=camera,
        focal_length=focal_length,
        aperture=aperture,
        pixel_size=pixel_size,
        target_name=target,
        expected_temperature=expected_temperature,
        temperature_tolerance=temperature_tolerance,
        fwhm_threshold=fwhm_threshold,
        roundness_threshold=roundness_threshold,
        noise_threshold=noise_threshold,
    )

    # 保存配置
    try:
        saved_path = config_manager.save_config(config, overwrite=overwrite)
        console.print(f"[green]✓ 配置已保存到: {saved_path}[/green]")
    except FileExistsError:
        console.print(f"[red]✗ 配置 '{config_name}' 已存在。使用 --overwrite 选项覆盖。[/red]")
        return

    # 显示配置信息
    console.print("")
    table = Table(title="配置信息")
    table.add_column("参数", style="cyan")
    table.add_column("值", style="magenta")

    table.add_row("配置名称", config.config_name)
    if config.observer:
        table.add_row("观测者", config.observer)
    if config.telescope:
        table.add_row("望远镜", config.telescope)
    if config.camera:
        table.add_row("相机", config.camera)
    if config.focal_length:
        table.add_row("焦距", f"{config.focal_length} mm")
    if config.aperture:
        table.add_row("光圈", f"{config.aperture} mm")
    if config.pixel_size:
        table.add_row("像素大小", f"{config.pixel_size} um")
    if config.target_name:
        table.add_row("目标", config.target_name)
    if config.expected_temperature is not None:
        table.add_row("期望温度", f"{config.expected_temperature}°C")
    table.add_row("温度容差", f"{config.temperature_tolerance}°C")
    table.add_row("FWHM阈值", f"{config.fwhm_threshold} 像素")
    table.add_row("圆度阈值", f"{config.roundness_threshold}")
    table.add_row("噪声阈值", f"{config.noise_threshold} ADU")

    console.print(table)


@cli.command("import")
@click.argument("paths", nargs=-1, type=click.Path(exists=True))
@click.option("--recursive/--no-recursive", default=True, help="递归搜索子目录")
@click.option("--save", "-s", is_flag=True, help="保存导入的元数据")
@click.option("--name", "-n", default="current", help="保存名称")
@click.pass_context
def import_files(ctx, paths, recursive, save, name):
    """导入FITS文件或CSV元数据文件清单并校验头信息。

    PATHS: 文件或目录路径（可多个）
    """
    console.print(Panel.fit(
        "[bold blue]FITS 成像质检台 - 导入文件[/bold blue]",
        border_style="blue"
    ))

    config_name = ctx.obj.get("config_name")
    config = load_config(config_name)

    fits_parser = FITSParser()
    csv_parser = CSVParser()
    validator = MetadataValidator(config)

    all_metadatas: List[FITSMetadata] = []

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        parse_task = progress.add_task("解析文件...", total=None)

        for path_str in paths:
            path = Path(path_str)

            if path.is_file():
                # 单个文件
                if fits_parser.is_fits_file(str(path)):
                    try:
                        metadata = fits_parser.parse_file(str(path))
                        all_metadatas.append(metadata)
                    except Exception as e:
                        console.print(f"[yellow]警告: 无法解析FITS文件 {path}: {e}[/yellow]")
                elif csv_parser.is_csv_file(str(path)):
                    try:
                        metadatas = csv_parser.parse_file(str(path))
                        all_metadatas.extend(metadatas)
                    except Exception as e:
                        console.print(f"[yellow]警告: 无法解析CSV文件 {path}: {e}[/yellow]")
            elif path.is_dir():
                # 目录
                try:
                    # 搜索FITS文件
                    fits_metadatas = fits_parser.parse_directory(str(path), recursive=recursive)
                    all_metadatas.extend(fits_metadatas)

                    # 搜索CSV文件
                    csv_metadatas = csv_parser.parse_directory(str(path), recursive=recursive)
                    all_metadatas.extend(csv_metadatas)
                except Exception as e:
                    console.print(f"[yellow]警告: 无法解析目录 {path}: {e}[/yellow]")

        progress.update(parse_task, completed=True)

    if not all_metadatas:
        console.print("[red]✗ 未找到任何可解析的文件[/red]")
        return

    # 去重（按文件路径）
    seen = set()
    unique_metadatas = []
    for m in all_metadatas:
        if m.file_path not in seen:
            seen.add(m.file_path)
            unique_metadatas.append(m)

    console.print(f"[green]✓ 共找到 {len(unique_metadatas)} 个文件[/green]")
    console.print("")

    # 校验
    console.print("[bold]执行校验...[/bold]")
    issues, stats = validator.validate_batch(unique_metadatas)

    # 显示统计
    table = Table(title="导入统计")
    table.add_column("类型", style="cyan")
    table.add_column("数量", style="magenta")

    for file_type, count in stats["by_type"].items():
        table.add_row(file_type.upper(), str(count))
    table.add_row("总计", str(stats["total"]))

    console.print(table)

    # 显示问题
    if issues:
        console.print("")
        console.print("[bold yellow]发现以下问题:[/bold yellow]")

        error_count = sum(1 for i in issues if i.severity == ValidationSeverity.ERROR)
        warning_count = sum(1 for i in issues if i.severity == ValidationSeverity.WARNING)
        info_count = sum(1 for i in issues if i.severity == ValidationSeverity.INFO)

        console.print(f"  错误: {error_count}, 警告: {warning_count}, 信息: {info_count}")
        console.print("")

        # 显示前10个错误
        error_issues = [i for i in issues if i.severity == ValidationSeverity.ERROR]
        if error_issues:
            console.print("[bold red]错误:[/bold red]")
            for issue in error_issues[:10]:
                console.print(f"  - [{issue.file_name}] {issue.message}")
            if len(error_issues) > 10:
                console.print(f"  ... 还有 {len(error_issues) - 10} 个错误")

    # 保存
    if save:
        data_store = get_data_store()
        saved_path = data_store.save_metadata(unique_metadatas, name=name)
        console.print("")
        console.print(f"[green]✓ 元数据已保存到: {saved_path}[/green]")

    # 显示文件列表（前10个）
    console.print("")
    console.print("[bold]文件列表:[/bold]")
    for m in unique_metadatas[:10]:
        type_icon = "📷" if m.file_type == FileType.LIGHT else "🌙" if m.file_type == FileType.DARK else "📏" if m.file_type == FileType.FLAT else "⚡"
        exp_str = f"{m.exposure_time}s" if m.exposure_time else "?"
        filter_str = f"[{m.filter_name}]" if m.filter_name else ""
        temp_str = f"{m.temperature}°C" if m.temperature is not None else "?"
        console.print(f"  {type_icon} {m.file_name} | {exp_str} {filter_str} | {temp_str}")

    if len(unique_metadatas) > 10:
        console.print(f"  ... 还有 {len(unique_metadatas) - 10} 个文件")


@cli.command()
@click.option("--name", "-n", default="current", help="元数据保存名称")
@click.option("--use-real-images/--no-real-images", default=True, help="是否使用真实图像分析")
@click.option("--save", "-s", is_flag=True, help="保存计算结果")
@click.pass_context
def analyze(ctx, name, use_real_images, save):
    """计算星点圆度、背景噪声、FWHM和温度匹配。"""
    console.print(Panel.fit(
        "[bold blue]FITS 成像质检台 - 质量分析[/bold blue]",
        border_style="blue"
    ))

    config_name = ctx.obj.get("config_name")
    config = load_config(config_name)
    data_store = get_data_store()

    # 加载元数据
    try:
        metadatas = data_store.load_metadata(name)
    except FileNotFoundError:
        console.print(f"[red]✗ 未找到元数据 '{name}'。请先运行 'import --save' 命令。[/red]")
        return

    console.print(f"[green]✓ 加载了 {len(metadatas)} 个文件的元数据[/green]")
    console.print("")

    # 计算质量指标
    console.print("[bold]计算质量指标...[/bold]")

    calculator = QualityMetricsCalculator(config)
    metrics_dict: Dict[str, ImageQualityMetrics] = {}

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("计算指标...", total=len(metadatas))

        for metadata in metadatas:
            try:
                if use_real_images and os.path.exists(metadata.file_path):
                    metrics = calculator.calculate_from_image(metadata.file_path, metadata)
                else:
                    metrics = calculator.calculate_from_metadata(metadata)
                metrics_dict[metadata.file_path] = metrics
            except Exception as e:
                console.print(f"[yellow]警告: 计算 {metadata.file_name} 时出错: {e}[/yellow]")
            progress.advance(task)

    # 温度匹配检查
    console.print("")
    console.print("[bold]温度匹配分析...[/bold]")

    temp_matcher = TemperatureMatcher(config)
    temp_issues = temp_matcher.flag_temperature_issues(metadatas)

    if temp_issues:
        console.print(f"[yellow]发现 {len(temp_issues)} 个温度相关问题:[/yellow]")
        for issue in temp_issues[:5]:
            console.print(f"  - [{issue['file']}] {issue['message']}")
        if len(temp_issues) > 5:
            console.print(f"  ... 还有 {len(temp_issues) - 5} 个问题")
    else:
        console.print("[green]✓ 温度匹配检查通过[/green]")

    # 显示统计
    console.print("")
    console.print("[bold]质量指标统计:[/bold]")

    # 按类型分组
    by_type: Dict[FileType, List[ImageQualityMetrics]] = {}
    for metadata in metadatas:
        mt = metrics_dict.get(metadata.file_path)
        if mt:
            if metadata.file_type not in by_type:
                by_type[metadata.file_type] = []
            by_type[metadata.file_type].append(mt)

    for file_type, metrics_list in by_type.items():
        console.print(f"")
        console.print(f"[bold cyan]{file_type.value.upper()}:[/bold cyan]")

        # FWHM
        fwhms = [m.fwhm for m in metrics_list if m.fwhm is not None]
        if fwhms:
            avg_fwhm = sum(fwhms) / len(fwhms)
            min_fwhm = min(fwhms)
            max_fwhm = max(fwhms)
            console.print(f"  FWHM: 平均 {avg_fwhm:.2f} 像素 (范围: {min_fwhm:.2f} - {max_fwhm:.2f})")

        # 圆度
        roundnesses = [m.roundness for m in metrics_list if m.roundness is not None]
        if roundnesses:
            avg_roundness = sum(roundnesses) / len(roundnesses)
            console.print(f"  圆度: 平均 {avg_roundness:.3f}")

        # 背景噪声
        noises = [m.background_noise for m in metrics_list if m.background_noise is not None]
        if noises:
            avg_noise = sum(noises) / len(noises)
            console.print(f"  背景噪声: 平均 {avg_noise:.2f} ADU")

    # 保存结果
    if save:
        # 这里我们只保存了metrics_dict，但还需要与元数据关联
        # 完整的保存会在grade命令中处理
        console.print("")
        console.print("[yellow]提示: 完整的结果将在 'grade' 命令后保存[/yellow]")

    # 保存metrics_dict用于后续步骤
    # 这里我们将metrics_dict转换为可保存的格式
    # 实际上，完整的流程应该是: import -> analyze -> grade -> report


@cli.command()
@click.option("--name", "-n", default="current", help="元数据保存名称")
@click.option("--save", "-s", is_flag=True, help="保存评估结果")
@click.pass_context
def grade(ctx, name, save):
    """给出保留/隔离/重拍建议。"""
    console.print(Panel.fit(
        "[bold blue]FITS 成像质检台 - 质量分级[/bold blue]",
        border_style="blue"
    ))

    config_name = ctx.obj.get("config_name")
    config = load_config(config_name)
    data_store = get_data_store()

    # 加载元数据
    try:
        metadatas = data_store.load_metadata(name)
    except FileNotFoundError:
        console.print(f"[red]✗ 未找到元数据 '{name}'。请先运行 'import --save' 命令。[/red]")
        return

    console.print(f"[green]✓ 加载了 {len(metadatas)} 个文件的元数据[/green]")
    console.print("")

    # 计算质量指标
    console.print("[bold]计算质量指标...[/bold]")
    calculator = QualityMetricsCalculator(config)

    metrics_dict: Dict[str, ImageQualityMetrics] = {}
    for metadata in metadatas:
        try:
            metrics = calculator.calculate_from_metadata(metadata)
            metrics_dict[metadata.file_path] = metrics
        except Exception as e:
            console.print(f"[yellow]警告: 计算 {metadata.file_name} 时出错: {e}[/yellow]")

    # 执行规则评估
    console.print("")
    console.print("[bold]执行质量评估...[/bold]")

    engine = RulesEngine(config)
    results = engine.batch_evaluate(metadatas, metrics_dict)

    # 生成分析结果
    stats = engine.get_statistics(results)

    # 统计
    total = len(results)
    keep_count = stats["by_status"].get("keep", 0)
    isolate_count = stats["by_status"].get("isolate", 0)
    retry_count = stats["by_status"].get("retry", 0)
    unknown_count = stats["by_status"].get("unknown", 0)

    # 构建AnalysisResult
    light_count = sum(1 for r in results if r.file_type == FileType.LIGHT)
    dark_count = sum(1 for r in results if r.file_type == FileType.DARK)
    flat_count = sum(1 for r in results if r.file_type == FileType.FLAT)

    analysis_result = AnalysisResult(
        config_name=config.config_name,
        total_files=total,
        light_files=light_count,
        dark_files=dark_count,
        flat_files=flat_count,
        keep_count=keep_count,
        isolate_count=isolate_count,
        retry_count=retry_count,
        unknown_count=unknown_count,
        results=results,
        summary={
            "avg_score": stats.get("avg_score", 0),
        },
    )

    # 显示结果
    console.print("")
    table = Table(title="质量分级结果")
    table.add_column("状态", style="cyan")
    table.add_column("数量", style="magenta")
    table.add_column("占比", style="green")

    if total > 0:
        table.add_row(
            "✓ 保留 (KEEP)",
            str(keep_count),
            f"{keep_count/total*100:.1f}%",
            style="green"
        )
        table.add_row(
            "⚠ 隔离 (ISOLATE)",
            str(isolate_count),
            f"{isolate_count/total*100:.1f}%",
            style="yellow"
        )
        table.add_row(
            "✗ 重拍 (RETRY)",
            str(retry_count),
            f"{retry_count/total*100:.1f}%",
            style="red"
        )
        table.add_row(
            "? 未知 (UNKNOWN)",
            str(unknown_count),
            f"{unknown_count/total*100:.1f}%",
            style="dim"
        )
    else:
        table.add_row("无数据", "0", "0%")

    console.print(table)

    # 显示平均分
    if stats.get("avg_score"):
        console.print("")
        console.print(f"[bold]平均评分: {stats['avg_score']:.1f}[/bold]")

    # 显示有问题的文件
    console.print("")
    if retry_count > 0:
        console.print("[bold red]建议重拍的文件:[/bold red]")
        retry_files = [r for r in results if r.status == FileStatus.RETRY]
        for r in retry_files[:5]:
            issues = "; ".join(r.issues) if r.issues else "质量问题"
            console.print(f"  - {r.file_name}: {issues[:50]}...")
        if len(retry_files) > 5:
            console.print(f"  ... 还有 {len(retry_files) - 5} 个文件")

    if isolate_count > 0:
        console.print("")
        console.print("[bold yellow]建议隔离的文件:[/bold yellow]")
        isolate_files = [r for r in results if r.status == FileStatus.ISOLATE]
        for r in isolate_files[:5]:
            issues = "; ".join(r.issues) if r.issues else "质量问题"
            console.print(f"  - {r.file_name}: {issues[:50]}...")
        if len(isolate_files) > 5:
            console.print(f"  ... 还有 {len(isolate_files) - 5} 个文件")

    # 保存结果
    if save:
        data_store.save_results(results, name)
        data_store.save_analysis(analysis_result, name)
        console.print("")
        console.print(f"[green]✓ 结果已保存[/green]")


@cli.command()
@click.option("--name", "-n", default="current", help="分析结果名称")
@click.option("--format", "-f", type=click.Choice(["markdown", "csv", "json", "all"]), default="all", help="输出格式")
@click.option("--output", "-o", help="输出目录")
@click.pass_context
def report(ctx, name, format, output):
    """导出Markdown、CSV和JSON审计包。"""
    console.print(Panel.fit(
        "[bold blue]FITS 成像质检台 - 生成报告[/bold blue]",
        border_style="blue"
    ))

    config_name = ctx.obj.get("config_name")
    config = load_config(config_name)
    data_store = get_data_store()

    # 加载分析结果
    try:
        analysis_result = data_store.load_analysis(name)
    except FileNotFoundError:
        console.print(f"[red]✗ 未找到分析结果 '{name}'。请先运行 'grade --save' 命令。[/red]")
        return

    console.print(f"[green]✓ 加载了分析结果[/green]")
    console.print("")

    # 显示摘要
    generator = ReportGenerator(output_dir=output)
    summary = generator.generate_summary_text(analysis_result)
    console.print(summary)

    # 生成报告
    console.print("")
    console.print("[bold]生成报告...[/bold]")

    if format == "all" or format == "markdown":
        md_path = generator.generate_markdown(analysis_result, config)
        console.print(f"[green]✓ Markdown报告: {md_path}[/green]")

    if format == "all" or format == "csv":
        csv_path = generator.generate_csv(analysis_result)
        console.print(f"[green]✓ CSV报告: {csv_path}[/green]")

    if format == "all" or format == "json":
        json_path = generator.generate_json(analysis_result, config)
        console.print(f"[green]✓ JSON报告: {json_path}[/green]")

    console.print("")
    console.print("[bold green]✓ 报告生成完成[/bold green]")


@cli.command()
@click.option("--config-name", "-c", default="demo_config", help="配置名称")
@click.option("--file-count", "-n", type=int, default=20, help="生成文件数量")
@click.option("--save", "-s", is_flag=True, help="保存示例数据")
@click.pass_context
def demo(ctx, config_name, file_count, save):
    """生成示例数据用于演示和测试。"""
    console.print(Panel.fit(
        "[bold blue]FITS 成像质检台 - 演示模式[/bold blue]",
        border_style="blue"
    ))

    config_manager = get_config_manager()
    data_store = get_data_store()

    # 初始化工作空间
    config_manager.init_workspace()
    data_store.init_workspace()

    # 创建示例配置
    config = config_manager.create_config(
        config_name=config_name,
        observer="Demo Observer",
        telescope="Celestron 8SE",
        camera="ZWO ASI2600MC-Pro",
        focal_length=2000.0,
        aperture=203.0,
        pixel_size=3.76,
        target_name="M42 猎户座大星云",
        expected_exposures={"L": 10, "R": 5, "G": 5, "B": 5},
        expected_temperature=-10.0,
        temperature_tolerance=0.5,
        fwhm_threshold=3.0,
        roundness_threshold=0.8,
        noise_threshold=10.0,
    )

    try:
        config_manager.save_config(config, overwrite=True)
        console.print(f"[green]✓ 示例配置已创建: {config_name}[/green]")
    except Exception as e:
        console.print(f"[yellow]警告: 无法保存配置: {e}[/yellow]")

    # 生成示例元数据
    console.print("")
    console.print(f"[bold]生成 {file_count} 个示例文件...[/bold]")

    # 延迟导入避免循环依赖
    from fits_quality_checker.sample_data.generator import SampleDataGenerator

    generator = SampleDataGenerator(config)
    metadatas = generator.generate_batch(file_count)

    console.print(f"[green]✓ 生成了 {len(metadatas)} 个示例文件[/green]")
    console.print("")

    # 按类型统计
    by_type: Dict[FileType, int] = {}
    for m in metadatas:
        by_type[m.file_type] = by_type.get(m.file_type, 0) + 1

    table = Table(title="示例文件统计")
    table.add_column("类型", style="cyan")
    table.add_column("数量", style="magenta")
    for file_type, count in by_type.items():
        table.add_row(file_type.value.upper(), str(count))
    console.print(table)

    # 执行完整流程
    console.print("")
    console.print("[bold]执行完整质量分析流程...[/bold]")

    # 计算质量指标
    calculator = QualityMetricsCalculator(config)
    metrics_dict: Dict[str, ImageQualityMetrics] = {}

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("计算质量指标...", total=len(metadatas))
        for metadata in metadatas:
            metrics = calculator.calculate_from_metadata(metadata)
            metrics_dict[metadata.file_path] = metrics
            progress.advance(task)

    # 规则评估
    engine = RulesEngine(config)
    results = engine.batch_evaluate(metadatas, metrics_dict)
    stats = engine.get_statistics(results)

    # 构建分析结果
    total = len(results)
    keep_count = stats["by_status"].get("keep", 0)
    isolate_count = stats["by_status"].get("isolate", 0)
    retry_count = stats["by_status"].get("retry", 0)
    light_count = sum(1 for r in results if r.file_type == FileType.LIGHT)
    dark_count = sum(1 for r in results if r.file_type == FileType.DARK)
    flat_count = sum(1 for r in results if r.file_type == FileType.FLAT)

    analysis_result = AnalysisResult(
        config_name=config.config_name,
        total_files=total,
        light_files=light_count,
        dark_files=dark_count,
        flat_files=flat_count,
        keep_count=keep_count,
        isolate_count=isolate_count,
        retry_count=retry_count,
        results=results,
        summary={"avg_score": stats.get("avg_score", 0)},
    )

    # 显示结果
    console.print("")
    table = Table(title="质量分级结果")
    table.add_column("状态", style="cyan")
    table.add_column("数量", style="magenta")
    table.add_column("占比", style="green")

    if total > 0:
        table.add_row("✓ 保留 (KEEP)", str(keep_count), f"{keep_count/total*100:.1f}%", style="green")
        table.add_row("⚠ 隔离 (ISOLATE)", str(isolate_count), f"{isolate_count/total*100:.1f}%", style="yellow")
        table.add_row("✗ 重拍 (RETRY)", str(retry_count), f"{retry_count/total*100:.1f}%", style="red")

    console.print(table)

    # 生成报告
    console.print("")
    console.print("[bold]生成报告...[/bold]")

    report_gen = ReportGenerator()
    paths = report_gen.generate_audit_package(analysis_result, config)

    console.print(f"[green]✓ Markdown: {paths['markdown']}[/green]")
    console.print(f"[green]✓ CSV: {paths['csv']}[/green]")
    console.print(f"[green]✓ JSON: {paths['json']}[/green]")

    # 保存
    if save:
        data_store.save_metadata(metadatas, "demo")
        data_store.save_results(results, "demo")
        data_store.save_analysis(analysis_result, "demo")
        console.print("")
        console.print(f"[green]✓ 数据已保存，可使用 --config {config_name} --name demo 进行后续操作[/green]")

    console.print("")
    console.print(Panel.fit(
        "[bold green]演示完成！[/bold green]\n\n"
        "尝试以下命令:\n"
        f"  fitsqc --config {config_name} import --save [路径]\n"
        f"  fitsqc --config {config_name} grade --save\n"
        f"  fitsqc --config {config_name} report",
        border_style="green"
    ))


if __name__ == "__main__":
    cli()
