# -*- coding: utf-8 -*-
"""GNSS 静态观测成果复核工具 - 主入口

命令行工具，用于在提交 GNSS 静态观测成果前进行离线复核。
"""

import argparse
import glob
import os
import sys
from datetime import datetime
from typing import List, Optional

from .validator import DataValidator
from .reporter import ReportGenerator
from . import __version__


def find_rinex_files(paths: List[str]) -> List[str]:
    """查找 RINEX 文件，支持通配符和目录"""
    rinex_files = []

    for path in paths:
        if os.path.isdir(path):
            for ext in ["**/*.??O", "**/*.??o", "**/*.obs", "**/*.OBS", "**/*.*O"]:
                rinex_files.extend(glob.glob(os.path.join(path, ext), recursive=True))
        elif os.path.isfile(path):
            rinex_files.append(path)
        else:
            rinex_files.extend(glob.glob(path))

    rinex_files = [os.path.abspath(f) for f in rinex_files if os.path.isfile(f)]
    return list(set(rinex_files))


def format_duration(seconds: float) -> str:
    """格式化时长显示"""
    hours = seconds / 3600
    if hours >= 1:
        return f"{hours:.2f} 小时"
    minutes = seconds / 60
    return f"{minutes:.1f} 分钟"


def run_check(
    rinex_paths: List[str],
    station_csv: Optional[str] = None,
    session_yaml: Optional[str] = None,
    output_dir: str = ".",
    verbose: bool = False
) -> int:
    """执行复核检查"""
    print("=" * 60)
    print(f"  GNSS 静态观测成果复核工具 v{__version__}")
    print("=" * 60)
    print()

    validator = DataValidator()

    if station_csv:
        print(f"[1/5] 加载基站台账: {station_csv}")
        if not validator.load_station_csv(station_csv):
            print(f"      警告: 无法加载基站台账文件")
        else:
            print(f"      成功加载 {len(validator.stations)} 个基站信息")
    else:
        print("[1/5] 跳过基站台账加载（未提供）")

    if session_yaml:
        print(f"[2/5] 加载测段计划: {session_yaml}")
        if not validator.load_session_yaml(session_yaml):
            print(f"      警告: 无法加载测段计划文件")
        else:
            print(f"      成功加载 {len(validator.sessions)} 个测段计划")
    else:
        print("[2/5] 跳过测段计划加载（未提供）")

    print(f"[3/5] 查找并解析 RINEX 文件...")
    rinex_files = find_rinex_files(rinex_paths)

    if not rinex_files:
        print("      错误: 未找到任何 RINEX 观测文件")
        return 1

    print(f"      找到 {len(rinex_files)} 个 RINEX 文件")

    results = validator.load_rinex_files(rinex_files)
    success_count = sum(1 for v in results.values() if v)
    fail_count = len(results) - success_count

    if fail_count > 0:
        print(f"      成功解析 {success_count} 个，失败 {fail_count} 个")
    else:
        print(f"      全部 {success_count} 个文件解析成功")

    for station_name, parser in validator.rinex_parsers.items():
        stats = parser.statistics
        if stats:
            if verbose:
                print()
                print(f"      --- {station_name} ---")
                if stats.first_epoch:
                    print(f"      首个历元: {stats.first_epoch}")
                if stats.last_epoch:
                    print(f"      末个历元: {stats.last_epoch}")
                print(f"      观测时长: {format_duration(stats.observation_duration_seconds)}")
                print(f"      历元数: {stats.valid_epochs} (有效) / {stats.total_epochs} (总)")
                if stats.nominal_interval:
                    print(f"      采样间隔: {stats.nominal_interval:.1f}s")
                if stats.missing_epochs > 0:
                    print(f"      缺历元: {stats.missing_epochs}")
                if stats.cycle_slips:
                    print(f"      周跳疑点: {len(stats.cycle_slips)}")

    print()
    print("[4/5] 执行数据验证...")
    issues = validator.validate_all()

    summary = validator.get_validation_summary()

    error_count = summary["issues_by_severity"].get("error", 0)
    warning_count = summary["issues_by_severity"].get("warning", 0)

    print(f"      发现 {len(issues)} 个问题")
    if error_count > 0:
        print(f"        - 错误 (ERROR): {error_count} 个")
    if warning_count > 0:
        print(f"        - 警告 (WARNING): {warning_count} 个")

    print()
    print(f"[5/5] 生成报告...")

    reporter = ReportGenerator(validator)
    reporter.set_output_dir(output_dir)

    outputs = reporter.generate_all()

    print(f"      已生成:")
    for name, path in outputs.items():
        print(f"        - {os.path.basename(path)}")

    print()
    print("=" * 60)
    print("  复核完成")
    print("=" * 60)
    print()

    if error_count > 0:
        print(f"⚠️  检测到 {error_count} 个严重错误，建议修复后再提交")
        sys.exit(1)
    elif warning_count > 0:
        print(f"⚠️  检测到 {warning_count} 个警告，建议检查确认")
    else:
        print("✓  所有检查项通过")

    print()
    return 0


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="GNSS 静态观测成果离线复核工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本使用 - 检查单个 RINEX 文件
  gnss-checker --rinex data/ALIC00AUS_R_20240010000_01D_30S_MO.obs

  # 检查目录下所有 RINEX 文件，包含台账和计划
  gnss-checker \\
    --rinex ./obs_data/ \\
    --stations stations.csv \\
    --sessions sessions.yaml \\
    --output ./reports/

  # 使用通配符
  gnss-checker --rinex ./data/*.??O --verbose
        """
    )

    parser.add_argument(
        "--rinex", "-r",
        nargs="+",
        required=True,
        help="RINEX 观测文件路径（支持目录、通配符）"
    )

    parser.add_argument(
        "--stations", "-s",
        help="基站台账 CSV 文件路径"
    )

    parser.add_argument(
        "--sessions", "-p",
        help="测段计划 YAML 文件路径"
    )

    parser.add_argument(
        "--output", "-o",
        default=".",
        help="输出目录（默认: 当前目录）"
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细信息"
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}"
    )

    args = parser.parse_args()

    try:
        return run_check(
            rinex_paths=args.rinex,
            station_csv=args.stations,
            session_yaml=args.sessions,
            output_dir=args.output,
            verbose=args.verbose
        )
    except KeyboardInterrupt:
        print("\n\n用户中断操作")
        return 1
    except Exception as e:
        print(f"\n\n错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
