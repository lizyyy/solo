import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, MofNCompleteColumn
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .config import get_config_manager, ConfigManager
from .copier import execute_copy, CopyResult
from .manifest import Manifest, ManifestManager, load_manifest, save_manifest
from .reporter import generate_report, export_markdown, export_csv_files, format_size
from .scanner import scan_cards, ScanResult
from .validator import generate_copy_plan, CopyPlan, Severity, ValidationIssue


console = Console()


def create_progress() -> Progress:
    return Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        MofNCompleteColumn(),
        console=console,
    )


def format_issue(issue: ValidationIssue) -> str:
    severity_color = {
        Severity.ERROR: "[bold red]",
        Severity.WARNING: "[bold yellow]",
        Severity.INFO: "[bold blue]",
    }
    color = severity_color.get(issue.severity, "")
    return f"{color}{issue.severity.value.upper()}:[/] {issue.message}"


@click.group()
@click.option("--config", "-c", type=click.Path(path_type=Path), help="配置文件路径")
@click.option("--project", "-p", help="项目名称")
@click.option("--verbose", "-v", is_flag=True, help="详细输出")
@click.pass_context
def main(
    ctx: click.Context,
    config: Optional[Path] = None,
    project: Optional[str] = None,
    verbose: bool = False,
) -> None:
    """素材回卡守门员 - 纪录片外拍素材拷贝管理工具"""
    ctx.ensure_object(dict)

    config_manager = get_config_manager(config)

    if project:
        config_manager.config.project_name = project

    ctx.obj["config"] = config_manager
    ctx.obj["verbose"] = verbose

    if verbose:
        rprint(f"[dim]项目: {config_manager.config.project_name}[/]")


@main.command()
@click.argument("directories", nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.option("--card-ids", "-i", multiple=True, help="卡号列表（与目录数量对应）")
@click.option("--camera-ids", "-m", multiple=True, help="机位ID列表（与目录数量对应）")
@click.option("--no-metadata", is_flag=True, help="不提取元数据")
@click.option("--no-hash", is_flag=True, help="不计算哈希")
@click.option("--output", "-o", type=click.Path(path_type=Path), help="Manifest输出路径")
@click.pass_context
def scan(
    ctx: click.Context,
    directories: tuple[Path, ...],
    card_ids: tuple[str, ...],
    camera_ids: tuple[str, ...],
    no_metadata: bool,
    no_hash: bool,
    output: Optional[Path],
) -> None:
    """扫描一个或多个卡目录，生成 manifest.json

    DIRECTORIES: 一个或多个存储卡目录路径
    """
    if not directories:
        console.print("[red]错误: 请指定至少一个要扫描的目录[/]")
        sys.exit(1)

    config: ConfigManager = ctx.obj["config"]
    verbose: bool = ctx.obj["verbose"]

    card_ids_list = list(card_ids) if card_ids else None
    camera_ids_list = list(camera_ids) if camera_ids else None

    console.print(Panel(f"[bold green]扫描存储卡[/]\n目录数量: {len(directories)}", expand=False))

    with create_progress() as progress:
        task = progress.add_task("扫描中...", total=len(directories))

        def progress_callback(filename: str, current: int, total: int) -> None:
            if verbose:
                progress.update(task, description=f"处理: {filename[:30]}")

        scan_result = scan_cards(
            config=config,
            directories=list(directories),
            card_ids=card_ids_list,
            camera_ids=camera_ids_list,
            extract_metadata=not no_metadata,
            compute_hash=not no_hash,
            progress_callback=progress_callback if verbose else None,
            project_name=config.config.project_name,
        )

    manifest_manager = ManifestManager(output.parent if output else Path.cwd())
    manifest = manifest_manager.create_from_scan_result(scan_result)

    table = Table(title="扫描结果")
    table.add_column("卡号", style="cyan")
    table.add_column("目录", style="green")
    table.add_column("文件数", justify="right")
    table.add_column("大小", justify="right")

    for card in scan_result.cards:
        table.add_row(
            card.card_id,
            card.source_directory,
            str(card.total_files),
            format_size(card.total_size),
        )

    console.print(table)

    summary = Table(title="文件分类统计", show_header=True)
    summary.add_column("类型", style="cyan")
    summary.add_column("数量", justify="right")
    summary.add_column("大小", justify="right")

    categories = [
        ("视频", "video", "🎬"),
        ("音频", "audio", "🎤"),
        ("代理", "proxy", "📹"),
        ("边车", "sidecar", "📝"),
        ("其他", "other", "📁"),
    ]

    for name, cat, icon in categories:
        files = [f for f in scan_result.all_files if f.file_category == cat]
        if files:
            total_size = sum(f.file_size for f in files)
            summary.add_row(f"{icon} {name}", str(len(files)), format_size(total_size))

    console.print(summary)

    if output:
        output_path = manifest_manager.save(manifest, output.name)
    else:
        output_path = manifest_manager.save(manifest)

    console.print(f"\n[green]✓ Manifest 已保存到:[/] {output_path}")
    ctx.obj["last_manifest"] = output_path


@main.command()
@click.argument("manifest_path", type=click.Path(exists=True, path_type=Path))
@click.argument("target_directory", type=click.Path(path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path), help="更新后的manifest输出路径")
@click.option("--force", "-f", is_flag=True, help="即使有错误也继续")
@click.pass_context
def plan(
    ctx: click.Context,
    manifest_path: Path,
    target_directory: Path,
    output: Optional[Path],
    force: bool,
) -> None:
    """根据 manifest 生成拷贝计划

    MANIFEST_PATH: manifest.json 文件路径
    TARGET_DIRECTORY: 目标归档目录
    """
    config: ConfigManager = ctx.obj["config"]
    verbose: bool = ctx.obj["verbose"]

    console.print(Panel(f"[bold green]生成拷贝计划[/]\n目标: {target_directory}", expand=False))

    with console.status("加载 manifest..."):
        manifest = load_manifest(manifest_path)

    with console.status("生成拷贝计划..."):
        copy_plan = generate_copy_plan(
            manifest=manifest,
            config=config,
            target_directory=target_directory,
        )

    console.print(f"\n[bold]拷贝计划摘要[/]")
    summary = copy_plan.summary
    console.print(f"  总文件数: {summary.get('total_files', 0)}")
    console.print(f"  总数据量: {format_size(summary.get('total_size_bytes', 0))}")
    console.print(f"  视频文件: {summary.get('video_files', 0)}")
    console.print(f"  音频文件: {summary.get('audio_files', 0)}")
    console.print(f"  存储卡: {summary.get('cards_count', 0)} 张")

    errors = [i for i in copy_plan.issues if i.severity == Severity.ERROR]
    warnings = [i for i in copy_plan.issues if i.severity == Severity.WARNING]

    if errors or warnings:
        console.print(f"\n[bold red]发现问题:[/]")
        if errors:
            console.print(f"  [red]严重错误: {len(errors)} 个[/]")
        if warnings:
            console.print(f"  [yellow]警告: {len(warnings)} 个[/]")

        for issue in copy_plan.issues:
            console.print(f"  {format_issue(issue)}")

    if copy_plan.can_proceed:
        console.print("\n[green]✓ 拷贝计划生成完成，可以执行拷贝[/]")
    else:
        console.print("\n[red]✗ 存在阻断性问题，无法执行拷贝[/]")
        if not force:
            sys.exit(1)

    manifest.copy_plan = copy_plan.to_dict()
    manifest.target_directory = str(target_directory)
    manifest.validation_issues = [i.to_dict() for i in copy_plan.issues]
    manifest.validation_passed = copy_plan.can_proceed

    if output:
        save_manifest(manifest, output)
        console.print(f"[green]✓ 已更新 manifest:[/] {output}")
    else:
        save_manifest(manifest, manifest_path)
        console.print(f"[green]✓ 已更新 manifest:[/] {manifest_path}")


@main.command()
@click.argument("manifest_path", type=click.Path(exists=True, path_type=Path))
@click.option("--dry-run", "-n", is_flag=True, help="模拟执行，不实际拷贝")
@click.option("--resume", "-r", is_flag=True, help="从上次中断继续")
@click.option("--no-verify", is_flag=True, help="跳过哈希校验")
@click.option("--overwrite", "-w", is_flag=True, help="覆盖已存在的文件")
@click.option("--output", "-o", type=click.Path(path_type=Path), help="更新后的manifest输出路径")
@click.pass_context
def copy(
    ctx: click.Context,
    manifest_path: Path,
    dry_run: bool,
    resume: bool,
    no_verify: bool,
    overwrite: bool,
    output: Optional[Path],
) -> None:
    """按计划执行拷贝

    MANIFEST_PATH: manifest.json 文件路径
    """
    config: ConfigManager = ctx.obj["config"]
    verbose: bool = ctx.obj["verbose"]

    if dry_run:
        console.print(Panel("[bold yellow]模拟执行模式[/]\n不会实际拷贝文件", expand=False))
    else:
        console.print(Panel("[bold green]执行拷贝[/]", expand=False))

    with console.status("加载 manifest..."):
        manifest = load_manifest(manifest_path)

    if not manifest.copy_plan:
        console.print("[red]错误: manifest 中没有拷贝计划，请先运行 plan 命令[/]")
        sys.exit(1)

    copy_plan_dict = manifest.copy_plan
    target_dir = Path(manifest.target_directory) if manifest.target_directory else Path.cwd()

    from .validator import FileMapping
    from .scanner import FileInfo

    file_mappings: dict[str, FileMapping] = {}
    mappings_data = copy_plan_dict.get("file_mappings", {})

    for file_id, mapping_data in mappings_data.items():
        file_info = manifest.get_file_by_id(file_id)
        if file_info:
            file_mappings[file_id] = FileMapping(
                source_file=file_info,
                target_path=Path(mapping_data["target_path"]),
                relative_target_path=mapping_data["relative_target_path"],
                conflict=mapping_data.get("conflict"),
            )

    class SimpleCopyPlan:
        def __init__(self):
            self.plan_id = copy_plan_dict.get("plan_id", "")
            self.created_at = datetime.now()
            self.total_files = len(file_mappings)
            self.total_size = sum(m.source_file.file_size for m in file_mappings.values())
            self.file_mappings = file_mappings
            self.issues = []
            self.can_proceed = True
            self.summary = {}

    copy_plan = SimpleCopyPlan()

    manifest_manager = ManifestManager(manifest_path.parent)

    with create_progress() as progress:
        task = progress.add_task("拷贝中...", total=copy_plan.total_files)

        def progress_callback(filename: str, current: int, total: int) -> None:
            progress.update(task, description=f"拷贝: {filename[:40]}", completed=current)

        copy_result = execute_copy(
            config=config,
            manifest=manifest,
            copy_plan=copy_plan,
            manifest_manager=manifest_manager,
            dry_run=dry_run,
            resume=resume,
            verify=not no_verify,
            overwrite=overwrite,
            progress_callback=progress_callback,
        )

    console.print(f"\n[bold]拷贝结果[/]")
    console.print(f"  总文件数: {copy_result.total_files}")
    console.print(f"  [green]已拷贝: {copy_result.copied_files}[/]")
    console.print(f"  [yellow]已跳过: {copy_result.skipped_files}[/]")
    if copy_result.failed_files > 0:
        console.print(f"  [red]失败: {copy_result.failed_files}[/]")
    console.print(f"  已拷贝数据量: {format_size(copy_result.copied_bytes)}")

    if copy_result.errors:
        console.print(f"\n[red]错误详情:[/]")
        for error in copy_result.errors:
            console.print(f"  - {error}")

    if copy_result.is_complete:
        console.print("\n[green]✓ 拷贝完成！[/]")
    else:
        console.print("\n[yellow]⚠ 拷贝未完全完成[/]")

    save_path = output or manifest_path
    manifest_manager.save(manifest, save_path.name)
    console.print(f"[green]✓ 已更新 manifest:[/] {save_path}")


@main.command()
@click.argument("manifest_path", type=click.Path(exists=True, path_type=Path))
@click.argument("target_directory", type=click.Path(exists=True, path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path), help="更新后的manifest输出路径")
@click.pass_context
def verify(
    ctx: click.Context,
    manifest_path: Path,
    target_directory: Path,
    output: Optional[Path],
) -> None:
    """重新扫描目标目录并比对 manifest

    MANIFEST_PATH: manifest.json 文件路径
    TARGET_DIRECTORY: 目标归档目录
    """
    config: ConfigManager = ctx.obj["config"]
    verbose: bool = ctx.obj["verbose"]

    console.print(Panel("[bold green]执行校验[/]\n重新扫描并比对目标目录", expand=False))

    with console.status("加载 manifest..."):
        manifest = load_manifest(manifest_path)

    with console.status("重新扫描目标目录..."):
        from .scanner import FileScanner

        def progress_callback(filename: str, current: int, total: int) -> None:
            if verbose:
                console.print(f"[dim]扫描: {filename}[/]")

        scanner = FileScanner(
            config=config,
            extract_metadata=True,
            compute_hash=True,
            progress_callback=progress_callback,
        )

        target_scan = scanner.scan_directory(
            directory=target_directory,
            card_id="TARGET_VERIFY",
        )

    source_files = manifest.files
    target_files = target_scan.files

    source_hashes = {f.hash_value: f for f in source_files if f.hash_value}
    target_hashes = {f.hash_value: f for f in target_files if f.hash_value}

    source_paths = {f.file_name: f for f in source_files}
    target_paths = {f.file_name: f for f in target_files}

    missing_hashes = set(source_hashes.keys()) - set(target_hashes.keys())
    extra_hashes = set(target_hashes.keys()) - set(source_hashes.keys())
    matched_hashes = set(source_hashes.keys()) & set(target_hashes.keys())

    hash_mismatches = []
    for file_name, source_file in source_paths.items():
        if file_name in target_paths:
            target_file = target_paths[file_name]
            if source_file.hash_value and target_file.hash_value:
                if source_file.hash_value != target_file.hash_value:
                    hash_mismatches.append((source_file, target_file))

    console.print(f"\n[bold]校验结果[/]")
    console.print(f"  源文件数: {len(source_files)}")
    console.print(f"  目标文件数: {len(target_files)}")
    console.print(f"")
    console.print(f"  [green]✓ 匹配: {len(matched_hashes)} 个文件[/]")

    if missing_hashes:
        console.print(f"  [red]✗ 缺失: {len(missing_hashes)} 个文件[/]")
        if verbose:
            for h in missing_hashes:
                f = source_hashes[h]
                console.print(f"    - {f.file_name} ({f.card_id})")

    if extra_hashes:
        console.print(f"  [yellow]⚠ 多余: {len(extra_hashes)} 个文件[/]")
        if verbose:
            for h in extra_hashes:
                f = target_hashes[h]
                console.print(f"    - {f.file_name}")

    if hash_mismatches:
        console.print(f"  [red]✗ 哈希不匹配: {len(hash_mismatches)} 个文件[/]")
        if verbose:
            for source, target in hash_mismatches:
                console.print(f"    - {source.file_name}")
                console.print(f"      源: {source.hash_value[:16]}...")
                console.print(f"      目标: {target.hash_value[:16]}...")

    issues: list[ValidationIssue] = []

    for h in missing_hashes:
        f = source_hashes[h]
        issues.append(ValidationIssue(
            issue_id=f"missing_{f.file_id}",
            severity=Severity.ERROR,
            category="verify",
            message=f"文件缺失: {f.file_name}",
            file_id=f.file_id,
            file_name=f.file_name,
            card_id=f.card_id,
        ))

    for h in extra_hashes:
        f = target_hashes[h]
        issues.append(ValidationIssue(
            issue_id=f"extra_{f.file_id}",
            severity=Severity.WARNING,
            category="verify",
            message=f"目标有多余文件: {f.file_name}",
            file_name=f.file_name,
        ))

    for source, target in hash_mismatches:
        issues.append(ValidationIssue(
            issue_id=f"mismatch_{source.file_id}",
            severity=Severity.ERROR,
            category="verify",
            message=f"文件哈希不匹配: {source.file_name}",
            file_id=source.file_id,
            file_name=source.file_name,
            card_id=source.card_id,
            details={
                "source_hash": source.hash_value,
                "target_hash": target.hash_value,
            },
        ))

    all_ok = len(missing_hashes) == 0 and len(extra_hashes) == 0 and len(hash_mismatches) == 0

    if all_ok:
        console.print("\n[green]✓ 所有文件校验通过！[/]")
    else:
        console.print("\n[yellow]⚠ 校验发现问题[/]")

    manifest.validation_issues.extend([i.to_dict() for i in issues])

    save_path = output or manifest_path
    manifest_manager = ManifestManager(save_path.parent)
    manifest_manager.save(manifest, save_path.name)
    console.print(f"[green]✓ 已更新 manifest:[/] {save_path}")


@main.command()
@click.argument("manifest_path", type=click.Path(exists=True, path_type=Path))
@click.option("--output-dir", "-o", type=click.Path(path_type=Path), help="输出目录")
@click.option("--prefix", "-p", help="文件名前缀")
@click.option("--no-markdown", is_flag=True, help="不生成 Markdown 报告")
@click.option("--no-csv", is_flag=True, help="不生成 CSV 文件")
@click.option("--notes", "-n", help="备注信息")
@click.pass_context
def report(
    ctx: click.Context,
    manifest_path: Path,
    output_dir: Optional[Path],
    prefix: Optional[str],
    no_markdown: bool,
    no_csv: bool,
    notes: Optional[str],
) -> None:
    """生成交接报告

    MANIFEST_PATH: manifest.json 文件路径
    """
    config: ConfigManager = ctx.obj["config"]

    console.print(Panel("[bold green]生成交接报告[/]", expand=False))

    with console.status("加载 manifest..."):
        manifest = load_manifest(manifest_path)

    copy_results = {}
    if manifest.copy_progress:
        copy_results = {
            "copied_files": manifest.copied_files,
            "skipped_files": sum(
                1 for p in manifest.copy_progress.values()
                if p.completed and p.bytes_copied == 0
            ),
            "failed_files": len([p for p in manifest.copy_progress.values() if p.error_message]),
            "total_files": len(manifest.copy_progress),
        }

    report_data = generate_report(
        manifest=manifest,
        copy_plan=None,
        verification_issues=[],
        copy_results=copy_results,
        notes=notes or "",
    )

    output_path = output_dir or manifest_path.parent
    output_path.mkdir(parents=True, exist_ok=True)

    file_prefix = prefix or manifest.project_name

    exported_files = []

    if not no_markdown:
        md_path = output_path / f"{file_prefix}_report.md"
        export_markdown(report_data, md_path)
        exported_files.append(md_path)
        console.print(f"[green]✓ Markdown 报告:[/] {md_path}")

    if not no_csv:
        csv_files = export_csv_files(report_data, output_path, file_prefix)
        for f in csv_files:
            console.print(f"[green]✓ CSV 文件:[/] {f}")
            exported_files.append(f)

    console.print(f"\n[green]✓ 报告生成完成！[/] 共 {len(exported_files)} 个文件")


@main.command()
@click.option("--output-dir", "-o", type=click.Path(path_type=Path), required=True, help="示例数据输出目录")
@click.option("--num-cards", "-c", type=int, default=2, help="存储卡数量")
@click.option("--num-clips", "-k", type=int, default=5, help="每张卡的片段数量")
@click.pass_context
def generate_samples(
    ctx: click.Context,
    output_dir: Path,
    num_cards: int,
    num_clips: int,
) -> None:
    """生成示例素材目录（用于测试）

    创建模拟的 SD 卡目录结构，包含视频、音频和边车文件
    """
    import random
    import string

    console.print(Panel(f"[bold green]生成示例素材[/]\n输出目录: {output_dir}", expand=False))

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    cameras = ["A", "B", "C"]
    card_names = ["SD", "CFast", "XQD"]

    for card_idx in range(num_cards):
        camera = cameras[card_idx % len(cameras)]
        card_type = card_names[card_idx % len(card_names)]
        card_name = f"{camera}_{card_type}_{card_idx + 1:03d}"
        card_dir = output_dir / card_name

        dcim_dir = card_dir / "DCIM" / f"100CANON"
        audio_dir = card_dir / "AUDIO"
        private_dir = card_dir / "PRIVATE" / "M4ROOT" / "CLIP"

        dcim_dir.mkdir(parents=True, exist_ok=True)
        audio_dir.mkdir(parents=True, exist_ok=True)
        private_dir.mkdir(parents=True, exist_ok=True)

        shoot_date = datetime(2024, 5, 15 + card_idx)
        shoot_date_str = shoot_date.strftime("%Y%m%d")

        for clip_idx in range(num_clips):
            clip_num = clip_idx + 1
            duration = random.randint(30, 300)

            video_name = f"{camera}_{shoot_date_str}_C{clip_num:04d}.MP4"
            video_path = dcim_dir / video_name
            video_content = f"VIDEO:{video_name}:DURATION={duration}:FAKE"
            video_path.write_text(video_content, encoding="utf-8")

            proxy_name = f"{camera}_{shoot_date_str}_C{clip_num:04d}_proxy.mp4"
            proxy_path = dcim_dir / proxy_name
            proxy_content = f"PROXY:{proxy_name}:FAKE"
            proxy_path.write_text(proxy_content, encoding="utf-8")

            audio_name = f"A{camera}{clip_num:04d}.WAV"
            audio_path = audio_dir / audio_name
            audio_content = f"AUDIO:{audio_name}:DURATION={duration}:FAKE"
            audio_path.write_text(audio_content, encoding="utf-8")

            if clip_idx % 2 == 0:
                srt_name = f"{camera}_{shoot_date_str}_C{clip_num:04d}.srt"
                srt_path = dcim_dir / srt_name
                srt_content = f"""1
00:00:01,000 --> 00:00:05,000
示例字幕第一行

2
00:00:05,000 --> 00:00:10,000
示例字幕第二行
"""
                srt_path.write_text(srt_content, encoding="utf-8")

            if clip_idx % 3 == 0:
                json_name = f"{camera}_{shoot_date_str}_C{clip_num:04d}.json"
                json_path = dcim_dir / json_name
                import json
                json_data = {
                    "clip_name": video_name,
                    "duration": duration,
                    "camera": camera,
                    "shoot_date": shoot_date_str,
                    "metadata": {"fake": True},
                }
                json_path.write_text(json.dumps(json_data, indent=2), encoding="utf-8")

        console.print(f"  [green]✓[/] 创建卡目录: {card_name}")

    console.print(f"\n[green]✓ 示例数据生成完成！[/]")
    console.print(f"  输出目录: {output_dir}")
    console.print(f"  存储卡数: {num_cards}")
    console.print(f"  每卡片段: {num_clips}")
    console.print(f"\n[dim]提示: 使用以下命令扫描这些示例卡:[/]")
    console.print(f"  media-guardian scan {output_dir}/* -o manifest.json")


if __name__ == "__main__":
    main(obj={})
