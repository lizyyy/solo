import argparse
import sys
import os
from pathlib import Path
from typing import List, Optional

from .validator import WheelValidator
from .report import ReportGenerator
from . import __version__


class CLIError(Exception):
    pass


def validate_input_paths(paths: List[str]) -> List[Path]:
    validated = []
    for path_str in paths:
        path = Path(path_str)
        if not path.exists():
            raise CLIError(f"文件不存在: {path_str}")
        if path.is_dir():
            wheel_files = list(path.glob("*.whl"))
            if not wheel_files:
                raise CLIError(f"目录中没有找到 .whl 文件: {path_str}")
            validated.extend(wheel_files)
        else:
            if path.suffix.lower() != ".whl":
                raise CLIError(f"不是 .whl 文件: {path_str}")
            validated.append(path)
    return validated


def validate_output_dir(output_dir: Optional[str]) -> Path:
    if output_dir is None:
        output_dir = Path.cwd() / "wheel_validation_reports"
    else:
        output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def parse_args(args: List[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Wheel 元数据验证工具 - 验证Python wheel包的元数据、入口点、平台标签和依赖范围",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  wheel-validator package.whl                          # 验证单个wheel文件
  wheel-validator dir/                                 # 验证目录中的所有wheel文件
  wheel-validator pkg1.whl pkg2.whl -o reports/       # 指定输出目录
  wheel-validator pkg.whl --strict                     # 启用严格模式
  wheel-validator pkg.whl --no-json --no-html          # 只生成终端摘要
        """
    )
    
    parser.add_argument(
        "wheels",
        nargs="+",
        help="要验证的wheel文件或包含wheel文件的目录路径"
    )
    
    parser.add_argument(
        "-o", "--output-dir",
        dest="output_dir",
        help="报告输出目录 (默认: ./wheel_validation_reports)"
    )
    
    parser.add_argument(
        "--strict",
        action="store_true",
        help="启用严格模式，警告视为错误"
    )
    
    parser.add_argument(
        "--no-json",
        action="store_true",
        help="不生成JSON格式的机器可读报告"
    )
    
    parser.add_argument(
        "--no-html",
        action="store_true",
        help="不生成HTML格式的友好报告"
    )
    
    parser.add_argument(
        "--no-summary",
        action="store_true",
        help="不显示终端摘要"
    )
    
    parser.add_argument(
        "-v", "--version",
        action="version",
        version=f"wheel-validator {__version__}"
    )
    
    parser.add_argument(
        "--expected-platform",
        dest="expected_platform",
        help="期望的平台标签 (如: manylinux2014_x86_64, win_amd64, any)"
    )
    
    parser.add_argument(
        "--expected-python-version",
        dest="expected_pyver",
        help="期望的Python版本范围 (如: >=3.7, ==3.9.*)"
    )
    
    return parser.parse_args(args)


def main(args: Optional[List[str]] = None) -> int:
    if args is None:
        args = sys.argv[1:]
    
    try:
        parsed_args = parse_args(args)
        
        wheel_paths = validate_input_paths(parsed_args.wheels)
        output_dir = validate_output_dir(parsed_args.output_dir)
        
        if not wheel_paths:
            raise CLIError("没有找到有效的wheel文件")
        
        validator = WheelValidator(strict=parsed_args.strict)
        report_gen = ReportGenerator(output_dir)
        
        all_results = []
        for wheel_path in wheel_paths:
            result = validator.validate(wheel_path)
            all_results.append(result)
        
        if not parsed_args.no_summary:
            report_gen.print_terminal_summary(all_results)
        
        if not parsed_args.no_json:
            report_gen.generate_json_report(all_results)
        
        if not parsed_args.no_html:
            report_gen.generate_html_report(all_results)
        
        has_errors = any(r.has_errors for r in all_results)
        has_warnings = any(r.has_warnings for r in all_results)
        
        if parsed_args.strict:
            return 1 if (has_errors or has_warnings) else 0
        else:
            return 1 if has_errors else 0
            
    except CLIError as e:
        print(f"错误: {e}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\n操作已取消", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"意外错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 3


if __name__ == "__main__":
    sys.exit(main())
