import os
import sys

from .parser import MaterialPackageParser
from .detector import AbnormalityDetector, CrossRecordChecker
from .reporter import DeliveryReporter


def process_package(package_path: str, output_dir: str) -> None:
    print("=" * 60)
    print("印刷打样异常检测系统")
    print("=" * 60)
    print(f"\n处理素材包: {package_path}")

    parser = MaterialPackageParser(package_path)
    package = parser.parse()

    print(f"\n解析完成:")
    print(f"  - 扫描文件数: {len(package.raw_files)}")
    print(f"  - 授权文件数: {len(package.authorization_files)}")
    print(f"  - 打样记录数: {len(package.records)}")

    detector = AbnormalityDetector(package)
    detector.detect_all()

    cross_checker = CrossRecordChecker(package.records)
    cross_checker.check_color_consistency()

    print(f"\n异常检测完成")

    reporter = DeliveryReporter(package)
    summary = reporter.generate_summary()

    print(f"\n统计结果:")
    print(f"  - 正常记录: {summary.normal_count}")
    print(f"  - 待确认记录: {summary.pending_count}")
    print(f"  - 异常记录: {summary.abnormal_count}")

    reporter.export_delivery_note(output_dir)

    print("\n" + "=" * 60)
    print("处理完成！")
    print("=" * 60)


def main():
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  python -m src.main <素材包路径> [输出目录]")
        print("\n示例:")
        print("  python -m src.main ./test_data/sample_package ./output")
        return

    package_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./output"

    if not os.path.exists(package_path):
        print(f"错误: 素材包路径不存在: {package_path}")
        return

    process_package(package_path, output_dir)


if __name__ == "__main__":
    main()
