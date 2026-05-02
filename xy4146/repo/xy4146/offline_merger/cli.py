import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click

from offline_merger import __version__
from offline_merger.archiver.audit_log import AuditLog, load_audit_log, save_audit_log
from offline_merger.archiver.file_archiver import FileArchiver
from offline_merger.archiver.manifest import create_manifest, load_manifest, save_manifest
from offline_merger.config.task_config import (
    SourcePackage,
    create_default_task_config,
    load_task_config,
    save_task_config,
)
from offline_merger.conflict.conflict_manager import (
    ConflictManager,
    MergePlan,
    ResolutionAction,
    ResolutionStatus,
)
from offline_merger.exporters.csv_exporter import CSVExporter
from offline_merger.exporters.json_exporter import JsonExporter
from offline_merger.exporters.markdown_exporter import MarkdownExporter
from offline_merger.parsers.base_parser import FileType
from offline_merger.parsers.csv_parser import CSVParser
from offline_merger.parsers.gpx_parser import GPXParser
from offline_merger.parsers.json_parser import JsonParser
from offline_merger.parsers.photo_parser import PhotoParser
from offline_merger.validators.attachment_validator import AttachmentValidator
from offline_merger.validators.coordinate_validator import CoordinateBoundary, CoordinateValidator
from offline_merger.validators.duplicate_validator import DuplicateValidator
from offline_merger.validators.hash_validator import HashValidator
from offline_merger.validators.time_validator import TimeValidator


CONFIG_FILE = "merger_config.json"
STATE_DIR = ".merger_state"
MERGE_PLAN_FILE = "merge_plan.json"


def get_state_dir() -> Path:
    return Path.cwd() / STATE_DIR


def ensure_state_dir() -> Path:
    state_dir = get_state_dir()
    state_dir.mkdir(exist_ok=True)
    return state_dir


def load_config() -> Optional[dict]:
    config_path = Path.cwd() / CONFIG_FILE
    if config_path.exists():
        return load_task_config(str(config_path))
    return None


def save_config(config) -> None:
    config_path = Path.cwd() / CONFIG_FILE
    save_task_config(config, str(config_path))


@click.group()
@click.version_option(version=__version__, prog_name="offline-merger")
def cli():
    """离线采集包合并器 - 专为外勤测绘小组设计的多来源数据合并工具"""
    pass


@cli.command()
@click.argument("task_name")
@click.option("--output", "-o", default="./merged_output", help="输出目录")
@click.option("--quarantine", "-q", default="./quarantine", help="隔离区目录")
@click.option("--coord-system", "-c", default="WGS84", help="目标坐标系 (WGS84/GCJ02/BD09/CGCS2000)")
@click.option("--duplicate-threshold", "-d", default=1.0, type=float, help="重复点位距离阈值 (米)")
@click.option("--boundary", "-b", nargs=4, type=float, help="坐标边界: min_lat max_lat min_lon max_lon")
def init(task_name, output, quarantine, coord_system, duplicate_threshold, boundary):
    """初始化新的合并任务

    TASK_NAME: 任务名称
    """
    state_dir = ensure_state_dir()

    config = create_default_task_config(task_name)
    config.output_directory = output
    config.quarantine_directory = quarantine
    config.target_coordinate_system = coord_system
    config.duplicate_distance_threshold_meters = duplicate_threshold

    if boundary:
        config.coordinate_boundary = {
            "min_lat": boundary[0],
            "max_lat": boundary[1],
            "min_lon": boundary[2],
            "max_lon": boundary[3],
        }

    save_config(config)

    manifest = create_manifest(config.task_id, config.task_name)
    manifest_path = state_dir / "manifest.json"
    save_manifest(manifest, str(manifest_path))

    audit_log = AuditLog(task_id=config.task_id)
    audit_log.log_init(task_name, config.task_id)
    audit_log_path = state_dir / "audit.log"
    save_audit_log(audit_log, str(audit_log_path))

    click.echo(f"✅ 任务 '{task_name}' 已初始化")
    click.echo(f"   任务ID: {config.task_id}")
    click.echo(f"   配置文件: {CONFIG_FILE}")
    click.echo(f"   输出目录: {output}")
    click.echo(f"   隔离区: {quarantine}")
    click.echo(f"\n提示: 使用 'scan' 命令扫描采集包目录")


@cli.command()
@click.argument("source_directories", nargs=-1, required=True)
@click.option("--recursive", "-r", is_flag=True, help="递归扫描子目录")
@click.option("--exclude", "-e", multiple=True, help="排除的文件模式")
def scan(source_directories, recursive, exclude):
    """扫描采集包目录

    SOURCE_DIRECTORIES: 一个或多个采集包目录路径
    """
    config = load_config()
    if not config:
        click.echo("❌ 未找到配置文件，请先运行 'init' 命令")
        sys.exit(1)

    state_dir = ensure_state_dir()
    audit_log = load_audit_log(str(state_dir / "audit.log"), config.task_id)

    parsers = {
        FileType.PHOTO: PhotoParser(),
        FileType.GPX: GPXParser(),
        FileType.CSV: CSVParser(),
        FileType.JSON: JsonParser(),
    }

    scan_results = {"packages": {}, "summary": {"total_files": 0, "errors": 0, "warnings": 0}}

    for src_dir in source_directories:
        src_path = Path(src_dir)
        if not src_path.exists():
            click.echo(f"⚠️  目录不存在: {src_dir}")
            continue

        package_name = src_path.name
        click.echo(f"\n📁 扫描: {package_name} ({src_dir})")

        package_files = []
        hash_validator = HashValidator()

        if recursive:
            files = list(src_path.rglob("*"))
        else:
            files = list(src_path.glob("*"))

        for file_path in files:
            if file_path.is_dir():
                continue

            ext = file_path.suffix.lower().lstrip(".")
            file_type = None
            parser = None

            if ext in ["jpg", "jpeg", "png", "heic"]:
                file_type = FileType.PHOTO
                parser = parsers[FileType.PHOTO]
            elif ext == "gpx":
                file_type = FileType.GPX
                parser = parsers[FileType.GPX]
            elif ext == "csv":
                file_type = FileType.CSV
                parser = parsers[FileType.CSV]
            elif ext == "json":
                file_type = FileType.JSON
                parser = parsers[FileType.JSON]
            else:
                continue

            click.echo(f"   解析: {file_path.name}")

            try:
                parse_result = parser.parse(str(file_path), package_name)
                hash_validator.add_file(parse_result)

                file_info = {
                    "file_name": file_path.name,
                    "file_path": str(file_path),
                    "file_type": file_type.value,
                    "file_size": file_path.stat().st_size,
                    "hash_sha256": parse_result.metadata.hash_sha256,
                    "hash_md5": parse_result.metadata.hash_md5,
                    "last_modified": parse_result.metadata.last_modified.isoformat(),
                    "errors": parse_result.metadata.errors.copy(),
                    "warnings": parse_result.metadata.warnings.copy(),
                    "points_count": len(parse_result.points),
                    "waypoints_count": len(parse_result.waypoints),
                    "tracks_count": len(parse_result.tracks),
                }

                package_files.append(file_info)

                scan_results["summary"]["errors"] += len(parse_result.metadata.errors)
                scan_results["summary"]["warnings"] += len(parse_result.metadata.warnings)

            except Exception as e:
                click.echo(f"   ❌ 解析失败: {e}")
                scan_results["summary"]["errors"] += 1

        if package_files:
            scan_results["packages"][package_name] = {
                "path": str(src_path),
                "files": package_files,
                "file_count": len(package_files),
            }
            scan_results["summary"]["total_files"] += len(package_files)

            if package_name not in [s.name for s in config.sources]:
                config.sources.append(SourcePackage(
                    name=package_name,
                    path=str(src_path),
                    included=True,
                ))

            audit_log.log_scan(package_name, len(package_files))

    save_config(config)
    save_audit_log(audit_log, str(state_dir / "audit.log"))

    json_exporter = JsonExporter()
    scan_results_path = state_dir / "scan_results.json"
    json_exporter.to_file(scan_results, str(scan_results_path))

    csv_exporter = CSVExporter()
    scan_csv_path = state_dir / "scan_results.csv"
    csv_exporter.export_scan_results(scan_results, str(scan_csv_path))

    click.echo(f"\n{'='*60}")
    click.echo("📊 扫描报告")
    click.echo(f"{'='*60}")
    click.echo(f"   总扫描文件: {scan_results['summary']['total_files']}")
    click.echo(f"   错误: {scan_results['summary']['errors']}")
    click.echo(f"   警告: {scan_results['summary']['warnings']}")
    click.echo(f"   扫描结果已保存至: {scan_results_path}")
    click.echo(f"   CSV 报告: {scan_csv_path}")

    if config.sources:
        click.echo(f"\n📦 已添加的采集包:")
        for src in config.sources:
            click.echo(f"   - {src.name}: {src.path}")


@cli.command()
@click.option("--dry-run/--no-dry-run", default=True, help="仅生成计划不执行 (默认: True)")
@click.option("--auto-resolve", "-a", is_flag=True, help="自动解决相同文件冲突")
@click.option("--strict", "-s", is_flag=True, help="严格模式，遇到冲突立即停止")
def merge(dry_run, auto_resolve, strict):
    """执行合并计划 (dry-run 模式)"""
    config = load_config()
    if not config:
        click.echo("❌ 未找到配置文件，请先运行 'init' 命令")
        sys.exit(1)

    state_dir = ensure_state_dir()
    audit_log = load_audit_log(str(state_dir / "audit.log"), config.task_id)

    scan_results_path = state_dir / "scan_results.json"
    if not scan_results_path.exists():
        click.echo("❌ 未找到扫描结果，请先运行 'scan' 命令")
        sys.exit(1)

    import json
    with open(scan_results_path, "r", encoding="utf-8") as f:
        scan_results = json.load(f)

    click.echo("🔍 执行合并分析...")

    hash_validator = HashValidator()
    attachment_validator = AttachmentValidator()
    time_validator = TimeValidator()
    coord_validator = CoordinateValidator()
    duplicate_validator = DuplicateValidator(
        distance_threshold_meters=config.duplicate_distance_threshold_meters,
    )
    conflict_manager = ConflictManager()

    if config.enable_coordinate_boundary_check and config.coordinate_boundary:
        coord_validator.set_boundary(
            min_lat=config.coordinate_boundary.get("min_lat"),
            max_lat=config.coordinate_boundary.get("max_lat"),
            min_lon=config.coordinate_boundary.get("min_lon"),
            max_lon=config.coordinate_boundary.get("max_lon"),
        )

    for package_name, package_data in scan_results.get("packages", {}).items():
        click.echo(f"   分析: {package_name}")
        package_path = package_data.get("path", "")

        if package_path:
            attachment_validator.add_search_path(package_path)

        for file_info in package_data.get("files", []):
            fake_parse_result = type(
                "FakeParseResult",
                (),
                {
                    "metadata": type(
                        "FakeMetadata",
                        (),
                        {
                            "file_name": file_info["file_name"],
                            "file_path": file_info["file_path"],
                            "source_package": package_name,
                            "hash_sha256": file_info["hash_sha256"],
                            "hash_md5": file_info["hash_md5"],
                            "file_size": file_info["file_size"],
                            "last_modified": datetime.fromisoformat(file_info["last_modified"]) if file_info.get("last_modified") else datetime.now(),
                            "errors": file_info.get("errors", []),
                            "warnings": file_info.get("warnings", []),
                        },
                    )(),
                    "tracks": [],
                    "waypoints": [],
                    "points": [],
                },
            )()

            hash_validator.add_file(fake_parse_result)

    hash_result = hash_validator.validate()
    for conflict in hash_result.conflicts:
        conflict_manager.add_hash_conflict(
            file_name=conflict.file_name,
            files=conflict.files,
            conflict_type=conflict.conflict_type.value,
            message=conflict.message,
        )

    click.echo("\n📋 生成合并计划...")

    plan_id = f"plan_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    source_packages = list(scan_results.get("packages", {}).keys())

    merge_plan = MergePlan(
        plan_id=plan_id,
        created_at=datetime.now(),
        source_packages=source_packages,
        total_files=hash_result.total_files,
        unique_files=hash_result.unique_files,
        dry_run=dry_run,
    )

    processed_hashes = set()

    for package_name, package_data in scan_results.get("packages", {}).items():
        for file_info in package_data.get("files", []):
            file_hash = file_info["hash_sha256"]
            file_name = file_info["file_name"]

            if file_hash in processed_hashes and auto_resolve:
                continue

            has_conflict = False
            conflict_id = None
            for conflict in conflict_manager.get_all_conflicts():
                if any(f.get("hash_sha256") == file_hash for f in conflict.affected_items):
                    has_conflict = True
                    conflict_id = conflict.conflict_id

                    if conflict.conflict_type.value == "identical" and auto_resolve:
                        conflict_manager.resolve(
                            conflict_id,
                            ResolutionAction.KEEP,
                            notes="自动保留，所有副本内容相同",
                        )
                        merge_plan.files_to_copy.append({
                            "source_path": file_info["file_path"],
                            "source_package": package_name,
                            "file_type": file_info["file_type"],
                            "hash_sha256": file_hash,
                            "hash_md5": file_info["hash_md5"],
                            "conflict_id": conflict_id,
                        })
                        processed_hashes.add(file_hash)
                    elif conflict.conflict_type.value == "hash_mismatch":
                        if strict:
                            click.echo(f"❌ 发现冲突: {file_name} (哈希不一致)")
                            click.echo("   使用 --strict 模式，停止执行")
                            sys.exit(1)
                        merge_plan.files_to_isolate.append({
                            "source_path": file_info["file_path"],
                            "source_package": package_name,
                            "file_type": file_info["file_type"],
                            "hash_sha256": file_hash,
                            "hash_md5": file_info["hash_md5"],
                            "conflict_id": conflict_id,
                            "reason": "哈希冲突，内容不同",
                        })
                    break

            if not has_conflict or (has_conflict and conflict.status.value == "auto_resolved"):
                if file_hash not in processed_hashes:
                    merge_plan.files_to_copy.append({
                        "source_path": file_info["file_path"],
                        "source_package": package_name,
                        "file_type": file_info["file_type"],
                        "hash_sha256": file_hash,
                        "hash_md5": file_info["hash_md5"],
                        "conflict_id": conflict_id,
                    })
                    processed_hashes.add(file_hash)

    merge_plan.conflicts = conflict_manager.get_all_conflicts()
    merge_plan.summary = {
        "files_to_copy": len(merge_plan.files_to_copy),
        "files_to_isolate": len(merge_plan.files_to_isolate),
        "files_to_rename": len(merge_plan.files_to_rename),
        "total_conflicts": len(merge_plan.conflicts),
        "unresolved_conflicts": len(conflict_manager.get_unresolved_conflicts()),
    }

    plan_path = state_dir / MERGE_PLAN_FILE
    json_exporter = JsonExporter()
    json_exporter.to_file(merge_plan.to_dict(), str(plan_path))

    audit_log.log_merge_plan(
        total_files=merge_plan.total_files,
        conflicts=len(merge_plan.conflicts),
        dry_run=dry_run,
    )
    save_audit_log(audit_log, str(state_dir / "audit.log"))

    click.echo(f"\n{'='*60}")
    click.echo("📊 合并计划")
    click.echo(f"{'='*60}")
    click.echo(f"   计划ID: {plan_id}")
    click.echo(f"   模式: {'Dry-Run (模拟)' if dry_run else '实际执行'}")
    click.echo(f"\n   文件统计:")
    click.echo(f"      待复制: {len(merge_plan.files_to_copy)}")
    click.echo(f"      待隔离: {len(merge_plan.files_to_isolate)}")
    click.echo(f"      待重命名: {len(merge_plan.files_to_rename)}")
    click.echo(f"\n   冲突统计:")
    click.echo(f"      总冲突: {len(merge_plan.conflicts)}")
    click.echo(f"      未解决: {len(conflict_manager.get_unresolved_conflicts())}")

    if merge_plan.conflicts:
        click.echo(f"\n   冲突详情:")
        for conflict in merge_plan.conflicts:
            status_icon = "✅" if conflict.status.value != "unresolved" else "⚠️ "
            click.echo(f"      {status_icon} {conflict.conflict_id}: {conflict.message}")
            click.echo(f"         状态: {conflict.status.value}")

    click.echo(f"\n   计划文件已保存至: {plan_path}")

    if not dry_run:
        click.echo("\n⚠️  警告: 此为实际执行模式，将修改文件系统")
        click.echo("   请先使用 --dry-run 模式验证计划")
    else:
        click.echo("\n💡 提示:")
        click.echo("   1. 审查合并计划文件")
        click.echo("   2. 如需修改冲突解决方式，编辑计划文件")
        click.echo("   3. 确认无误后运行 'commit' 命令执行合并")


@cli.command()
@click.option("--force", "-f", is_flag=True, help="强制执行，即使有未解决的冲突")
@click.option("--backup", "-b", is_flag=True, help="执行前创建备份")
def commit(force, backup):
    """提交合并计划，执行实际的文件操作"""
    config = load_config()
    if not config:
        click.echo("❌ 未找到配置文件，请先运行 'init' 命令")
        sys.exit(1)

    state_dir = ensure_state_dir()
    plan_path = state_dir / MERGE_PLAN_FILE

    if not plan_path.exists():
        click.echo("❌ 未找到合并计划，请先运行 'merge' 命令")
        sys.exit(1)

    import json
    with open(plan_path, "r", encoding="utf-8") as f:
        plan_data = json.load(f)

    merge_plan = MergePlan.from_dict(plan_data)

    if not force and merge_plan.summary.get("unresolved_conflicts", 0) > 0:
        click.echo("❌ 存在未解决的冲突")
        click.echo("   使用 --force 选项强制执行，或先解决冲突")
        sys.exit(1)

    audit_log = load_audit_log(str(state_dir / "audit.log"), config.task_id)

    manifest_path = state_dir / "manifest.json"
    if manifest_path.exists():
        manifest = load_manifest(str(manifest_path))
    else:
        manifest = create_manifest(config.task_id, config.task_name)

    click.echo("🚀 执行合并...")

    if backup:
        import shutil
        backup_dir = Path.cwd() / f"backup_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        if Path(config.output_directory).exists():
            shutil.copytree(config.output_directory, backup_dir)
            click.echo(f"   已创建备份: {backup_dir}")

    archiver = FileArchiver(
        output_directory=config.output_directory,
        quarantine_directory=config.quarantine_directory,
        manifest=manifest,
        audit_log=audit_log,
    )

    result = archiver.execute_merge_plan(merge_plan, dry_run=False)

    manifest.source_packages = merge_plan.source_packages
    save_manifest(manifest, str(manifest_path))
    save_audit_log(audit_log, str(state_dir / "audit.log"))

    audit_log.log_commit(
        files_processed=result.files_copied + result.files_isolated,
        errors=len(result.errors),
    )

    click.echo(f"\n{'='*60}")
    click.echo("✅ 合并完成")
    click.echo(f"{'='*60}")
    click.echo(f"\n   执行结果:")
    click.echo(f"      成功: {'是' if result.success else '否'}")
    click.echo(f"      已复制: {result.files_copied}")
    click.echo(f"      已隔离: {result.files_isolated}")
    click.echo(f"      错误: {len(result.errors)}")

    if result.errors:
        click.echo(f"\n   错误详情:")
        for error in result.errors:
            click.echo(f"      - {error['action']}: {error['file']} - {error['reason']}")

    click.echo(f"\n   输出目录: {config.output_directory}")
    click.echo(f"   隔离区: {config.quarantine_directory}")
    click.echo(f"   清单文件: {manifest_path}")

    click.echo(f"\n💡 提示:")
    click.echo("   使用 'export' 命令导出交接报告")


@cli.command()
@click.argument("format", type=click.Choice(["markdown", "md", "csv", "json", "all"]))
@click.option("--output", "-o", default="./reports", help="输出目录")
@click.option("--include-conflicts/--no-conflicts", default=True, help="包含冲突详情")
@click.option("--include-audit/--no-audit", default=True, help="包含审计日志")
def export(format, output, include_conflicts, include_audit):
    """导出报告

    FORMAT: 导出格式 (markdown/md, csv, json, all)
    """
    config = load_config()
    if not config:
        click.echo("❌ 未找到配置文件，请先运行 'init' 命令")
        sys.exit(1)

    state_dir = get_state_dir()
    output_dir = Path(output)
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = None
    manifest_path = state_dir / "manifest.json"
    if manifest_path.exists():
        manifest = load_manifest(str(manifest_path))

    audit_log = None
    audit_log_path = state_dir / "audit.log"
    if audit_log_path.exists():
        audit_log = load_audit_log(str(audit_log_path), config.task_id)

    conflict_manager = None
    plan_path = state_dir / MERGE_PLAN_FILE
    merge_plan = None
    if plan_path.exists():
        import json
        with open(plan_path, "r", encoding="utf-8") as f:
            plan_data = json.load(f)
        merge_plan = MergePlan.from_dict(plan_data)

    formats = []
    if format == "all":
        formats = ["markdown", "csv", "json"]
    else:
        formats = [format]

    click.echo(f"📄 导出报告至: {output_dir}")

    for fmt in formats:
        if fmt in ["markdown", "md"]:
            md_exporter = MarkdownExporter(
                task_name=config.task_name,
                task_id=config.task_id,
            )
            md_path = output_dir / "handover_report.md"
            md_exporter.export(
                output_path=str(md_path),
                manifest=manifest,
                merge_plan=merge_plan,
                audit_log=audit_log,
            )
            click.echo(f"   ✅ Markdown 报告: {md_path}")

        elif fmt == "csv":
            csv_exporter = CSVExporter()

            if manifest:
                csv_path = output_dir / "manifest.csv"
                import csv
                with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
                    if manifest.entries:
                        fieldnames = list(manifest.entries[0].to_dict().keys())
                        writer = csv.DictWriter(f, fieldnames=fieldnames)
                        writer.writeheader()
                        for entry in manifest.entries:
                            writer.writerow(entry.to_dict())
                click.echo(f"   ✅ 清单 CSV: {csv_path}")

            if audit_log and audit_log.entries:
                csv_path = output_dir / "audit_log.csv"
                with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
                    fieldnames = list(audit_log.entries[0].to_dict().keys())
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    for entry in audit_log.entries:
                        writer.writerow(entry.to_dict())
                click.echo(f"   ✅ 审计日志 CSV: {csv_path}")

        elif fmt == "json":
            json_exporter = JsonExporter()

            if manifest:
                json_path = output_dir / "merge_result.json"
                json_exporter.export_merge_result(
                    manifest=manifest,
                    merge_plan=merge_plan,
                    output_path=str(json_path),
                )
                click.echo(f"   ✅ 合并结果 JSON: {json_path}")

    click.echo(f"\n✅ 导出完成")
    click.echo(f"\n📊 报告摘要:")
    if manifest:
        click.echo(f"   总文件数: {manifest.summary.get('total_files', 0)}")
    click.echo(f"   输出目录: {output_dir}")


@cli.command()
def status():
    """显示当前任务状态"""
    config = load_config()
    state_dir = get_state_dir()

    if not config and not state_dir.exists():
        click.echo("❌ 未找到活跃任务")
        click.echo("\n💡 提示:")
        click.echo("   使用 'init' 命令初始化新任务")
        click.echo("   或在包含配置文件的目录中运行命令")
        return

    click.echo(f"{'='*60}")
    click.echo("📋 任务状态")
    click.echo(f"{'='*60}")

    if config:
        click.echo(f"\n   任务名称: {config.task_name}")
        click.echo(f"   任务ID: {config.task_id}")
        click.echo(f"   创建时间: {config.created_at}")
        click.echo(f"\n   配置:")
        click.echo(f"      目标坐标系: {config.target_coordinate_system}")
        click.echo(f"      重复点位阈值: {config.duplicate_distance_threshold_meters} 米")
        click.echo(f"      输出目录: {config.output_directory}")
        click.echo(f"      隔离区: {config.quarantine_directory}")

        if config.sources:
            click.echo(f"\n   采集包 ({len(config.sources)}):")
            for src in config.sources:
                status_icon = "✅" if src.included else "❌"
                click.echo(f"      {status_icon} {src.name}: {src.path}")

    if state_dir.exists():
        click.echo(f"\n   状态文件:")
        for file in state_dir.iterdir():
            if file.is_file():
                size = file.stat().st_size
                click.echo(f"      - {file.name} ({size} bytes)")

    click.echo(f"\n{'='*60}")


if __name__ == "__main__":
    cli()
