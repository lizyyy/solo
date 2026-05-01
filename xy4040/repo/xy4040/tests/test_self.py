#!/usr/bin/env python3
"""
自检/测试脚本

用于测试 media-guardian 工具的完整流程：
1. 生成示例素材
2. 扫描卡目录
3. 生成拷贝计划
4. 执行拷贝
5. 验证目标目录
6. 生成报告

用法:
    python tests/test_self.py --temp-dir ./temp_test
"""

import argparse
import json
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional

try:
    import rich
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel

    console = Console()
    HAS_RICH = True
except ImportError:
    HAS_RICH = False
    console = None


def print_header(text: str) -> None:
    if HAS_RICH and console:
        console.print(Panel(f"[bold green]{text}[/]", expand=False))
    else:
        print(f"\n{'=' * 60}")
        print(f"  {text}")
        print(f"{'=' * 60}")


def print_success(text: str) -> None:
    if HAS_RICH and console:
        console.print(f"[green]✓ {text}[/]")
    else:
        print(f"  ✓ {text}")


def print_error(text: str) -> None:
    if HAS_RICH and console:
        console.print(f"[red]✗ {text}[/]")
    else:
        print(f"  ✗ {text}")


def print_info(text: str) -> None:
    if HAS_RICH and console:
        console.print(f"[cyan]  {text}[/]")
    else:
        print(f"  {text}")


def run_test(
    temp_dir: Path,
    num_cards: int = 2,
    num_clips: int = 3,
    verbose: bool = False,
) -> tuple[bool, dict]:
    """
    运行完整的自检测试流程

    Args:
        temp_dir: 临时目录路径
        num_cards: 模拟的存储卡数量
        num_clips: 每张卡的片段数量
        verbose: 详细输出

    Returns:
        (是否成功, 测试结果数据)
    """
    results = {
        "started_at": datetime.now().isoformat(),
        "steps": [],
        "success": True,
    }

    source_dir = temp_dir / "source"
    source_dir.mkdir()

    archive_dir = temp_dir / "archive"
    archive_dir.mkdir()

    output_dir = temp_dir / "output"
    output_dir.mkdir()

    manifest_path = output_dir / "manifest.json"

    try:
        print_header("步骤 1: 生成示例素材")

        from scripts.generate_sample_data import generate_sample_data

        card_dirs = generate_sample_data(
            output_dir=source_dir,
            num_cards=num_cards,
            num_clips=num_clips,
            verbose=verbose,
        )

        results["steps"].append({
            "step": "generate_samples",
            "success": True,
            "num_cards": len(card_dirs),
        })
        print_success(f"生成了 {len(card_dirs)} 张卡的示例素材")

    except Exception as e:
        results["steps"].append({
            "step": "generate_samples",
            "success": False,
            "error": str(e),
        })
        results["success"] = False
        print_error(f"生成示例素材失败: {e}")
        return False, results

    try:
        print_header("步骤 2: 扫描卡目录 (scan)")

        from src.media_guardian.config import ConfigManager
        from src.media_guardian.manifest import ManifestManager
        from src.media_guardian.scanner import scan_cards

        config = ConfigManager()
        config.config.project_name = "Self_Test_Project"

        def progress_callback(filename: str, current: int, total: int) -> None:
            if verbose:
                print_info(f"扫描: {filename} ({current}/{total})")

        scan_result = scan_cards(
            config=config,
            directories=card_dirs,
            extract_metadata=True,
            compute_hash=True,
            progress_callback=progress_callback if verbose else None,
            project_name="Self_Test_Project",
        )

        manifest_manager = ManifestManager(output_dir)
        manifest = manifest_manager.create_from_scan_result(scan_result)
        saved_path = manifest_manager.save(manifest, manifest_path.name)

        total_files = scan_result.total_files
        total_size = scan_result.total_size

        results["steps"].append({
            "step": "scan",
            "success": True,
            "total_files": total_files,
            "total_size": total_size,
            "manifest_path": str(saved_path),
        })
        print_success(f"扫描完成: {total_files} 个文件, {total_size} 字节")
        print_success(f"Manifest 已保存到: {saved_path}")

    except Exception as e:
        results["steps"].append({
            "step": "scan",
            "success": False,
            "error": str(e),
        })
        results["success"] = False
        print_error(f"扫描失败: {e}")
        return False, results

    try:
        print_header("步骤 3: 生成拷贝计划 (plan)")

        from src.media_guardian.manifest import load_manifest
        from src.media_guardian.validator import generate_copy_plan, Severity

        manifest = load_manifest(manifest_path)

        copy_plan = generate_copy_plan(
            manifest=manifest,
            config=config,
            target_directory=archive_dir,
        )

        manifest.copy_plan = copy_plan.to_dict()
        manifest.target_directory = str(archive_dir)

        manifest_manager.save(manifest, manifest_path.name)

        errors = [i for i in copy_plan.issues if i.severity == Severity.ERROR]
        warnings = [i for i in copy_plan.issues if i.severity == Severity.WARNING]

        results["steps"].append({
            "step": "plan",
            "success": copy_plan.can_proceed,
            "can_proceed": copy_plan.can_proceed,
            "total_files": copy_plan.total_files,
            "total_size": copy_plan.total_size,
            "errors": len(errors),
            "warnings": len(warnings),
        })

        if copy_plan.can_proceed:
            print_success(f"拷贝计划生成成功: {copy_plan.total_files} 个文件")
            if warnings:
                print_info(f"有 {len(warnings)} 个警告")
        else:
            print_error(f"拷贝计划生成失败，存在阻断性问题")
            for e in errors:
                print_error(f"  - {e.message}")
            results["success"] = False
            return False, results

    except Exception as e:
        results["steps"].append({
            "step": "plan",
            "success": False,
            "error": str(e),
        })
        results["success"] = False
        print_error(f"生成拷贝计划失败: {e}")
        return False, results

    try:
        print_header("步骤 4: 执行拷贝 (copy)")

        from src.media_guardian.copier import execute_copy, CopyResult
        from src.media_guardian.validator import FileMapping

        manifest = load_manifest(manifest_path)
        copy_plan_dict = manifest.copy_plan

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

        simple_plan = SimpleCopyPlan()

        def progress_callback(filename: str, current: int, total: int) -> None:
            if verbose:
                print_info(f"拷贝: {filename} ({current}/{total})")

        copy_result = execute_copy(
            config=config,
            manifest=manifest,
            copy_plan=simple_plan,
            manifest_manager=manifest_manager,
            dry_run=False,
            resume=False,
            verify=True,
            overwrite=False,
            progress_callback=progress_callback if verbose else None,
        )

        manifest_manager.save(manifest, manifest_path.name)

        results["steps"].append({
            "step": "copy",
            "success": copy_result.is_complete,
            "total_files": copy_result.total_files,
            "copied_files": copy_result.copied_files,
            "skipped_files": copy_result.skipped_files,
            "failed_files": copy_result.failed_files,
            "copied_bytes": copy_result.copied_bytes,
            "errors": copy_result.errors,
        })

        if copy_result.is_complete:
            print_success(f"拷贝完成: {copy_result.copied_files} 个文件已拷贝")
            if copy_result.skipped_files > 0:
                print_info(f"跳过了 {copy_result.skipped_files} 个文件")
        else:
            print_error(f"拷贝未完全完成")
            if copy_result.failed_files > 0:
                print_error(f"失败文件数: {copy_result.failed_files}")
            if copy_result.errors:
                for e in copy_result.errors:
                    print_error(f"  - {e}")
            results["success"] = False

    except Exception as e:
        results["steps"].append({
            "step": "copy",
            "success": False,
            "error": str(e),
        })
        results["success"] = False
        print_error(f"执行拷贝失败: {e}")
        return False, results

    try:
        print_header("步骤 5: 验证目标目录 (verify)")

        from src.media_guardian.scanner import FileScanner
        from src.media_guardian.validator import ValidationIssue, Severity

        manifest = load_manifest(manifest_path)

        scanner = FileScanner(
            config=config,
            extract_metadata=True,
            compute_hash=True,
        )

        target_scan = scanner.scan_directory(
            directory=archive_dir,
            card_id="TARGET_VERIFY",
        )

        source_files = manifest.files
        target_files = target_scan.files

        source_hashes = {f.hash_value: f for f in source_files if f.hash_value}
        target_hashes = {f.hash_value: f for f in target_files if f.hash_value}

        missing_hashes = set(source_hashes.keys()) - set(target_hashes.keys())
        extra_hashes = set(target_hashes.keys()) - set(source_hashes.keys())
        matched_hashes = set(source_hashes.keys()) & set(target_hashes.keys())

        verify_success = len(missing_hashes) == 0 and len(extra_hashes) == 0

        results["steps"].append({
            "step": "verify",
            "success": verify_success,
            "source_files": len(source_files),
            "target_files": len(target_files),
            "matched": len(matched_hashes),
            "missing": len(missing_hashes),
            "extra": len(extra_hashes),
        })

        if verify_success:
            print_success(f"验证通过: {len(matched_hashes)} 个文件匹配")
        else:
            print_error(f"验证发现问题")
            if missing_hashes:
                print_error(f"  缺失文件: {len(missing_hashes)}")
            if extra_hashes:
                print_error(f"  多余文件: {len(extra_hashes)}")
            results["success"] = False

    except Exception as e:
        results["steps"].append({
            "step": "verify",
            "success": False,
            "error": str(e),
        })
        results["success"] = False
        print_error(f"执行验证失败: {e}")

    try:
        print_header("步骤 6: 生成报告 (report)")

        from src.media_guardian.manifest import load_manifest
        from src.media_guardian.reporter import generate_report, export_markdown, export_csv_files

        manifest = load_manifest(manifest_path)

        report_data = generate_report(
            manifest=manifest,
            notes="这是自动生成的自检测试报告",
        )

        md_path = output_dir / "self_test_report.md"
        export_markdown(report_data, md_path)

        csv_files = export_csv_files(report_data, output_dir, "self_test")

        results["steps"].append({
            "step": "report",
            "success": True,
            "markdown_path": str(md_path),
            "csv_files": [str(f) for f in csv_files],
        })

        print_success(f"Markdown 报告: {md_path}")
        for f in csv_files:
            print_success(f"CSV 文件: {f}")

    except Exception as e:
        results["steps"].append({
            "step": "report",
            "success": False,
            "error": str(e),
        })
        print_error(f"生成报告失败: {e}")

    results["completed_at"] = datetime.now().isoformat()

    results_path = output_dir / "test_results.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False, default=str)

    print_success(f"测试结果已保存到: {results_path}")

    return results["success"], results


def main():
    parser = argparse.ArgumentParser(
        description="media-guardian 自检/测试脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python tests/test_self.py --temp-dir ./temp_test
  python tests/test_self.py --temp-dir ./temp_test --num-cards 3 --num-clips 5 --verbose
        """,
    )

    parser.add_argument(
        "--temp-dir", "-t",
        type=Path,
        help="临时目录路径（如不指定则使用系统临时目录）",
    )
    parser.add_argument(
        "--num-cards", "-c",
        type=int,
        default=2,
        help="模拟的存储卡数量 (默认: 2)",
    )
    parser.add_argument(
        "--num-clips", "-k",
        type=int,
        default=3,
        help="每张卡的片段数量 (默认: 3)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="详细输出",
    )
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="测试完成后保留临时目录",
    )

    args = parser.parse_args()

    temp_dir: Optional[Path] = None
    cleanup_dir: Optional[Path] = None

    try:
        if args.temp_dir:
            temp_dir = args.temp_dir
            temp_dir.mkdir(parents=True, exist_ok=True)
        else:
            temp_dir = Path(tempfile.mkdtemp(prefix="media_guardian_test_"))
            cleanup_dir = temp_dir

        print_header("media-guardian 自检测试")
        print_info(f"临时目录: {temp_dir}")
        print_info(f"存储卡数量: {args.num_cards}")
        print_info(f"每卡片段: {args.num_clips}")

        success, results = run_test(
            temp_dir=temp_dir,
            num_cards=args.num_cards,
            num_clips=args.num_clips,
            verbose=args.verbose,
        )

        print_header("测试汇总")

        if HAS_RICH and console:
            table = Table(title="测试步骤")
            table.add_column("步骤", style="cyan")
            table.add_column("状态", justify="center")
            table.add_column("详情")

            for step_result in results["steps"]:
                step = step_result["step"]
                ok = step_result["success"]
                status = "[green]✓ 通过[/]" if ok else "[red]✗ 失败[/]"
                detail = ""

                if step == "scan":
                    detail = f"{step_result.get('total_files', 0)} 个文件"
                elif step == "plan":
                    detail = f"错误: {step_result.get('errors', 0)}, 警告: {step_result.get('warnings', 0)}"
                elif step == "copy":
                    detail = f"已拷贝: {step_result.get('copied_files', 0)}, 失败: {step_result.get('failed_files', 0)}"
                elif step == "verify":
                    detail = f"匹配: {step_result.get('matched', 0)}, 缺失: {step_result.get('missing', 0)}"

                table.add_row(step, status, detail)

            console.print(table)

        if success:
            print_header("✅ 所有测试通过！")
            print_success(f"测试结果目录: {temp_dir}")
            return 0
        else:
            print_header("❌ 测试失败")
            print_error("请检查上面的错误信息")
            return 1

    except Exception as e:
        print_error(f"测试执行出错: {e}")
        import traceback
        traceback.print_exc()
        return 1

    finally:
        if cleanup_dir and not args.keep_temp:
            try:
                shutil.rmtree(cleanup_dir)
                print_info(f"已清理临时目录: {cleanup_dir}")
            except Exception:
                pass


if __name__ == "__main__":
    sys.exit(main())
