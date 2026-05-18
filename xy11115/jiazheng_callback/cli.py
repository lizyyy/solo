import argparse
import os
import sys
import traceback

from .core import process_files, write_results
from .exceptions import JiazhengCallbackError
from .__init__ import __version__


def print_error(message: str) -> None:
    RED = "\033[91m"
    RESET = "\033[0m"
    print(f"{RED}错误: {message}{RESET}", file=sys.stderr)


def print_success(message: str) -> None:
    GREEN = "\033[92m"
    RESET = "\033[0m"
    print(f"{GREEN}成功: {message}{RESET}")


def print_warning(message: str) -> None:
    YELLOW = "\033[93m"
    RESET = "\033[0m"
    print(f"{YELLOW}警告: {message}{RESET}")


def print_info(message: str) -> None:
    CYAN = "\033[96m"
    RESET = "\033[0m"
    print(f"{CYAN}信息: {message}{RESET}")


def main():
    parser = argparse.ArgumentParser(
        description="家政派单点家政回访汇总 CLI 工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  jiazheng-callback -i 回访记录1.xlsx 回访记录2.xlsx -o ./输出目录
  jiazheng-callback --input-dir ./待处理文件 --output ./汇总结果
  jiazheng-callback --version
        """,
    )

    parser.add_argument(
        "-i",
        "--input",
        nargs="+",
        help="要处理的 Excel 文件路径列表（多个文件用空格分隔）",
    )

    parser.add_argument(
        "--input-dir",
        help="包含待处理 Excel 文件的目录路径（将处理目录下所有 .xlsx 文件）",
    )

    parser.add_argument(
        "-o",
        "--output",
        default="./家政回访汇总结果",
        help="输出目录路径（默认: ./家政回访汇总结果）",
    )

    parser.add_argument(
        "-v",
        "--version",
        action="version",
        version=f"jiazheng-callback v{__version__}",
    )

    args = parser.parse_args()

    if not args.input and not args.input_dir:
        print_error("请指定要处理的文件或目录")
        print_info("使用 -h 或 --help 查看帮助信息")
        sys.exit(1)

    file_paths = []

    if args.input:
        for path in args.input:
            if os.path.exists(path):
                file_paths.append(path)
            else:
                print_warning(f"跳过不存在的文件: {path}")

    if args.input_dir:
        if os.path.isdir(args.input_dir):
            for filename in os.listdir(args.input_dir):
                if filename.endswith(".xlsx") and not filename.startswith("~$"):
                    file_paths.append(os.path.join(args.input_dir, filename))
        else:
            print_error(f"输入目录不存在: {args.input_dir}")
            sys.exit(1)

    if not file_paths:
        print_error("没有找到可处理的 Excel 文件")
        sys.exit(1)

    print_info(f"找到 {len(file_paths)} 个文件待处理")

    try:
        results = process_files(file_paths)

        success_count = len(results["success"])
        failed_count = len(results["failed"])
        processed_files_count = len(file_paths) - failed_count

        if success_count > 0:
            total_rows = len(results["success"][0]) if results["success"] else 0
            dup_rows = len(results["duplicates"][0]) if results["duplicates"] else 0

            write_results(results, args.output)

            print_success(f"处理完成！")
            print_info(f"  - 成功处理: {processed_files_count} 个文件")
            print_info(f"  - 有效记录: {total_rows} 条")
            print_info(f"  - 重复客户: {dup_rows} 条")
            print_info(f"  - 输出目录: {os.path.abspath(args.output)}")

            if failed_count > 0:
                print_warning(f"  - 处理失败: {failed_count} 个文件")
                print_warning(f"    详情请查看: 处理失败文件.txt")

        else:
            print_error("所有文件处理失败，请检查错误信息")
            for item in results["failed"]:
                print_error(f"  - {item['file']}: {item['error']}")
            sys.exit(1)

    except JiazhengCallbackError as e:
        print_error(str(e))
        sys.exit(1)

    except Exception as e:
        print_error(f"程序运行时发生未知错误: {str(e)}")
        print_info("如需技术支持，请提供以下错误信息:")
        print("-" * 50)
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
