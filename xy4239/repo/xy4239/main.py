#!/usr/bin/env python3
"""
离线样本包合并器 - 主程序入口
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from offline_sample_merger.scanner import PackageScanner
from offline_sample_merger.validator import SampleValidator
from offline_sample_merger.merger import ConflictDetector, SampleMerger
from offline_sample_merger.reviewer import ConflictReviewer, SampleStorage
from offline_sample_merger.exporter import ReportExporter
from offline_sample_merger.models import (
    PackageInfo,
    GeoSample,
    ConflictRecord,
    MergeResult,
    ReviewDecision,
)


def print_header():
    print("=" * 60)
    print("           离线样本包合并器 v1.0.0")
    print("      为外业地质队设计的本地数据合并工具")
    print("=" * 60)
    print()


def print_progress(message: str):
    print(f"[*] {message}")


def print_success(message: str):
    print(f"[+] {message}")


def print_warning(message: str):
    print(f"[!] {message}")


def print_error(message: str):
    print(f"[-] {message}")


def interactive_review(
    conflicts: List[ConflictRecord],
    reviewer: ConflictReviewer,
    merger: SampleMerger,
) -> List[ConflictRecord]:
    pending_conflicts = reviewer.get_pending_conflicts(conflicts)
    
    if not pending_conflicts:
        return conflicts

    print()
    print("=" * 60)
    print(f"发现 {len(pending_conflicts)} 个待复核的冲突")
    print("=" * 60)
    print()

    for i, conflict in enumerate(pending_conflicts, 1):
        print(f"\n--- 冲突 {i}/{len(pending_conflicts)} ---")
        print(f"冲突ID: {conflict.conflict_id}")
        print(f"类型: {conflict.conflict_type.value}")
        print(f"描述: {conflict.description}")
        print(f"涉及样本数: {len(conflict.samples)}")
        print()

        print("样本详情:")
        for j, sample in enumerate(conflict.samples, 1):
            print(f"  [{j}] 样本ID: {sample.sample_id}")
            print(f"      坐标: ({sample.latitude}, {sample.longitude})")
            print(f"      采集者: {sample.collector}")
            print(f"      采样时间: {sample.sample_time}")
            print(f"      来源包: {sample.package_name}")
            print(f"      修改时间: {sample.modify_time}")
            if j < len(conflict.samples):
                print()

        print()
        print("请选择决策:")
        print("  [1] 保留先到记录 (KEEP_FIRST)")
        print("  [2] 保留后改记录 (KEEP_LAST)")
        print("  [3] 保留指定记录 (KEEP_SPECIFIC)")
        print("  [4] 合并创建新记录 (CREATE_NEW)")
        print("  [5] 标记为重复 (MARK_DUPLICATE)")
        print("  [s] 跳过此冲突")
        print("  [q] 退出复核模式")

        choice = input("\n请输入选择: ").strip().lower()

        if choice == "q":
            print_warning("退出复核模式，剩余冲突将保留待处理状态")
            break

        if choice == "s":
            print_progress("跳过此冲突")
            continue

        decision_map = {
            "1": ReviewDecision.KEEP_FIRST,
            "2": ReviewDecision.KEEP_LAST,
            "3": ReviewDecision.KEEP_SPECIFIC,
            "4": ReviewDecision.CREATE_NEW,
            "5": ReviewDecision.MARK_DUPLICATE,
        }

        if choice not in decision_map:
            print_warning(f"无效选择: {choice}，跳过此冲突")
            continue

        decision = decision_map[choice]
        selected_index = None

        if decision == ReviewDecision.KEEP_SPECIFIC:
            try:
                selected = int(input(f"请选择要保留的样本编号 (1-{len(conflict.samples)}): "))
                if 1 <= selected <= len(conflict.samples):
                    selected_index = selected - 1
                else:
                    print_warning("无效的样本编号，跳过此冲突")
                    continue
            except ValueError:
                print_warning("输入无效，跳过此冲突")
                continue

        notes = input("请输入备注 (可选，直接回车跳过): ").strip()

        result = reviewer.review_conflict(
            conflict=conflict,
            decision=decision,
            notes=notes,
            selected_sample_index=selected_index,
        )

        merger.resolve_conflict(
            conflict=conflict,
            decision=decision,
            selected_sample_index=selected_index,
            notes=notes,
            resolved_by=reviewer.user,
        )

        print_success(f"已处理冲突: {decision.value}")

    return conflicts


def run_merge(args):
    print_header()

    scan_dir = Path(args.scan_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    db_path = output_dir / "sample_database.db"

    print_progress(f"扫描目录: {scan_dir}")
    print_progress(f"输出目录: {output_dir}")
    print_progress(f"数据库路径: {db_path}")
    print()

    print_progress("步骤 1: 扫描离线样本包...")
    scanner = PackageScanner(str(scan_dir), recursive=True)
    try:
        packages = scanner.scan()
    except Exception as e:
        print_error(f"扫描失败: {e}")
        return 1

    if not packages:
        print_warning("未发现任何样本包")
        return 0

    print_success(f"发现 {len(packages)} 个样本包:")
    for pkg in packages:
        print(f"    - {pkg.name} ({pkg.format}, {pkg.sample_count} 样本)")

    if scanner.get_errors():
        print_warning(f"扫描过程中有 {len(scanner.get_errors())} 个警告:")
        for err in scanner.get_errors():
            print(f"    - {err}")

    print()
    print_progress("步骤 2: 解析和校验样本数据...")
    validator = SampleValidator(strict_mode=args.strict)

    all_samples: List[GeoSample] = []
    for pkg in packages:
        print_progress(f"  解析包: {pkg.name}...")
        samples = validator.parse_package(pkg)
        all_samples.extend(samples)
        print_success(f"    解析到 {len(samples)} 个样本")

    if not all_samples:
        print_error("未解析到任何有效样本")
        return 1

    valid_samples, errors, warnings = validator.validate_all_samples(all_samples)

    print_success(f"总样本数: {len(all_samples)}")
    print_success(f"有效样本数: {len(valid_samples)}")

    if errors:
        print_error(f"发现 {len(errors)} 个错误:")
        for err in errors[:10]:
            print(f"    - {err}")
        if len(errors) > 10:
            print(f"    ... 还有 {len(errors) - 10} 个错误")

    if warnings:
        print_warning(f"发现 {len(warnings)} 个警告:")
        for warn in warnings[:10]:
            print(f"    - {warn}")
        if len(warnings) > 10:
            print(f"    ... 还有 {len(warnings) - 10} 个警告")

    print()
    print_progress("步骤 3: 检测冲突...")
    detector = ConflictDetector()
    merger = SampleMerger(conflict_detector=detector)

    merged_samples, conflicts = merger.merge(
        samples=valid_samples,
        auto_resolve=args.auto_resolve,
    )

    merge_result = merger.get_merge_result()
    merge_result.total_packages = len(packages)
    merge_result.warnings = len(warnings)
    merge_result.errors = len(errors)

    print_success(f"发现 {len(conflicts)} 个冲突:")
    conflict_stats = detector.get_conflict_stats()
    for conflict_type, count in conflict_stats.items():
        print(f"    - {conflict_type.value}: {count} 个")

    pending = len([c for c in conflicts if not c.is_resolved])
    resolved = len([c for c in conflicts if c.is_resolved])
    print_success(f"已自动解决: {resolved} 个")
    print_success(f"待人工复核: {pending} 个")

    if pending > 0 and args.interactive:
        reviewer = ConflictReviewer(str(output_dir), user=args.user)
        conflicts = interactive_review(conflicts, reviewer, merger)
        merged_samples = merger.get_merged_samples()
        merge_result = merger.get_merge_result()

    print()
    print_progress("步骤 4: 保存到本地数据库...")
    storage = SampleStorage(str(db_path))
    saved_count = storage.save_samples(merged_samples)
    storage.save_conflicts(conflicts)

    print_success(f"已保存 {saved_count} 个样本到数据库")

    print()
    print_progress("步骤 5: 导出报告...")
    exporter = ReportExporter(str(output_dir))
    export_results = exporter.export_all(
        packages=packages,
        merged_samples=merged_samples,
        conflicts=conflicts,
        merge_result=merge_result,
        prefix=datetime.now().strftime("%Y%m%d_%H%M%S"),
    )

    print_success("导出完成:")
    for name, path in export_results.items():
        print(f"    - {name}: {path}")

    print()
    print("=" * 60)
    print("合并完成!")
    print("=" * 60)
    print()
    print("统计摘要:")
    print(f"  扫描包数: {merge_result.total_packages}")
    print(f"  总样本数: {merge_result.total_samples}")
    print(f"  合并样本数: {merge_result.merged_samples}")
    print(f"  最终样本数: {merge_result.final_sample_count}")
    print(f"  发现冲突: {merge_result.conflicts_found}")
    print(f"  已解决冲突: {merge_result.conflicts_resolved}")
    print(f"  待复核冲突: {merge_result.conflicts_pending}")
    print()

    return 0


def list_samples(args):
    db_path = Path(args.db).resolve()
    
    if not db_path.exists():
        print_error(f"数据库不存在: {db_path}")
        return 1

    storage = SampleStorage(str(db_path))
    samples = storage.load_all_samples()

    print(f"数据库中共有 {len(samples)} 个样本:")
    print()

    for sample in samples:
        print(f"样本ID: {sample.sample_id}")
        print(f"  坐标: ({sample.latitude:.6f}, {sample.longitude:.6f})")
        print(f"  采集者: {sample.collector}")
        print(f"  岩性: {sample.rock_type or '未知'}")
        print(f"  来源包: {sample.package_name}")
        print()

    return 0


def list_conflicts(args):
    db_path = Path(args.db).resolve()
    
    if not db_path.exists():
        print_error(f"数据库不存在: {db_path}")
        return 1

    storage = SampleStorage(str(db_path))
    conflicts = storage.load_conflicts(only_pending=args.pending)

    if not conflicts:
        print("没有待复核的冲突" if args.pending else "数据库中没有冲突记录")
        return 0

    print(f"发现 {len(conflicts)} 个冲突记录:")
    print()

    for i, conflict in enumerate(conflicts, 1):
        status = "已解决" if conflict.is_resolved else "待复核"
        print(f"[{i}] 冲突ID: {conflict.conflict_id}")
        print(f"    类型: {conflict.conflict_type.value}")
        print(f"    状态: {status}")
        print(f"    描述: {conflict.description}")
        if conflict.is_resolved:
            print(f"    决策: {conflict.decision.value if conflict.decision else '未知'}")
            print(f"    解决人: {conflict.resolved_by}")
        print()

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="离线样本包合并器 - 为外业地质队设计的本地数据合并工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 基本合并
  python main.py merge --scan-dir ./sample_data --output-dir ./output

  # 自动解决冲突
  python main.py merge --scan-dir ./sample_data --output-dir ./output --auto-resolve

  # 交互模式人工复核
  python main.py merge --scan-dir ./sample_data --output-dir ./output --interactive

  # 列出已合并的样本
  python main.py list-samples --db ./output/sample_database.db

  # 列出待复核的冲突
  python main.py list-conflicts --db ./output/sample_database.db --pending
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    merge_parser = subparsers.add_parser("merge", help="合并离线样本包")
    merge_parser.add_argument("--scan-dir", required=True, help="包含离线样本包的目录")
    merge_parser.add_argument("--output-dir", required=True, help="输出目录")
    merge_parser.add_argument("--auto-resolve", action="store_true", help="自动解决冲突（保留最新修改记录）")
    merge_parser.add_argument("--interactive", action="store_true", help="交互模式，人工复核冲突")
    merge_parser.add_argument("--strict", action="store_true", help="严格模式校验字段")
    merge_parser.add_argument("--user", default="operator", help="操作人名称")

    list_samples_parser = subparsers.add_parser("list-samples", help="列出数据库中的样本")
    list_samples_parser.add_argument("--db", required=True, help="数据库路径")

    list_conflicts_parser = subparsers.add_parser("list-conflicts", help="列出数据库中的冲突")
    list_conflicts_parser.add_argument("--db", required=True, help="数据库路径")
    list_conflicts_parser.add_argument("--pending", action="store_true", help="只显示待复核的冲突")

    args = parser.parse_args()

    if args.command == "merge":
        sys.exit(run_merge(args))
    elif args.command == "list-samples":
        sys.exit(list_samples(args))
    elif args.command == "list-conflicts":
        sys.exit(list_conflicts(args))
    else:
        parser.print_help()
        sys.exit(0)


if __name__ == "__main__":
    main()
