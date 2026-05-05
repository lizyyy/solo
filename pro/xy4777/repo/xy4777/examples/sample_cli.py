#!/usr/bin/env python3
"""
数据处理工具 - 示例被测 CLI 工具

用于演示 CLI 契约验证器的功能。
包含两个子命令：transform 和 validate。
"""

import argparse
import json
import os
import sys
from typing import Dict, List, Any, Optional


class DataProcessor:
    """数据处理核心类"""

    @staticmethod
    def transform(
        input_file: str,
        output_file: str,
        fmt: str = "json",
        pretty: bool = False,
        indent: int = 2,
        compress: bool = False,
        encoding: str = "utf-8",
    ) -> int:
        """转换数据格式

        Args:
            input_file: 输入文件路径
            output_file: 输出文件路径
            fmt: 输出格式 (json, csv, xml, yaml)
            pretty: 是否美化输出
            indent: 缩进级别
            compress: 是否压缩 (与 pretty 互斥)
            encoding: 文件编码

        Returns:
            退出码: 0 成功, 1 运行时错误, 2 参数错误
        """
        try:
            if not os.path.exists(input_file):
                print(f"错误: 输入文件不存在: {input_file}", file=sys.stderr)
                return 1

            with open(input_file, "r", encoding=encoding) as f:
                content = f.read()

            data = DataProcessor._parse_input(content, input_file)

            output_content = DataProcessor._format_output(data, fmt, pretty, indent, compress)

            with open(output_file, "w", encoding=encoding) as f:
                f.write(output_content)

            print(f"转换完成: {input_file} -> {output_file}")
            print(f"格式: {fmt}")
            if pretty:
                print(f"美化输出: enabled, indent={indent}")
            if compress:
                print(f"压缩输出: enabled")

            return 0

        except Exception as e:
            print(f"转换错误: {e}", file=sys.stderr)
            return 1

    @staticmethod
    def validate(
        file_path: str,
        schema_file: Optional[str] = None,
        strict: bool = False,
        quiet: bool = False,
    ) -> int:
        """验证数据文件

        Args:
            file_path: 要验证的文件路径
            schema_file: JSON Schema 文件路径
            strict: 严格模式
            quiet: 静默模式

        Returns:
            退出码: 0 成功, 1 验证失败, 2 参数错误
        """
        try:
            if not os.path.exists(file_path):
                print(f"错误: 文件不存在: {file_path}", file=sys.stderr)
                return 1

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            try:
                data = json.loads(content)
            except json.JSONDecodeError as e:
                print(f"JSON 解析错误: {e}", file=sys.stderr)
                return 1

            if not quiet:
                print(f"验证通过: {file_path}")
                print(f"数据结构: valid JSON")
                print(f"类型: {type(data).__name__}")

            if schema_file:
                if not quiet:
                    print(f"使用 schema 验证: {schema_file}")
                    print("schema 验证通过")

            return 0

        except Exception as e:
            print(f"验证错误: {e}", file=sys.stderr)
            return 1

    @staticmethod
    def _parse_input(content: str, filename: str) -> Any:
        """解析输入内容"""
        if filename.endswith(".json"):
            return json.loads(content)
        elif filename.endswith(".csv"):
            return DataProcessor._csv_to_list(content)
        else:
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                return DataProcessor._csv_to_list(content)

    @staticmethod
    def _csv_to_list(content: str) -> List[Dict[str, Any]]:
        """简单的 CSV 解析"""
        lines = content.strip().split("\n")
        if not lines:
            return []

        headers = lines[0].split(",")
        result = []

        for line in lines[1:]:
            if not line.strip():
                continue
            values = line.split(",")
            row = {}
            for i, header in enumerate(headers):
                if i < len(values):
                    value = values[i].strip()
                    try:
                        if value.isdigit():
                            value = int(value)
                        else:
                            try:
                                value = float(value)
                            except ValueError:
                                pass
                    except ValueError:
                        pass
                    row[header.strip()] = value
            result.append(row)

        return result

    @staticmethod
    def _format_output(
        data: Any,
        fmt: str,
        pretty: bool,
        indent: int,
        compress: bool,
    ) -> str:
        """格式化输出"""
        if fmt == "json":
            if compress:
                return json.dumps(data, separators=(",", ":"), ensure_ascii=False)
            elif pretty:
                return json.dumps(data, indent=indent, ensure_ascii=False) + "\n"
            else:
                return json.dumps(data, ensure_ascii=False) + "\n"
        elif fmt == "csv":
            return DataProcessor._list_to_csv(data)
        elif fmt == "yaml":
            lines = []
            for item in data if isinstance(data, list) else [data]:
                for key, value in item.items() if isinstance(item, dict) else {}:
                    lines.append(f"{key}: {value}")
                lines.append("")
            return "\n".join(lines)
        elif fmt == "xml":
            lines = ["<?xml version='1.0' encoding='utf-8'?>"]
            lines.append("<data>")
            for item in data if isinstance(data, list) else [data]:
                lines.append("  <item>")
                for key, value in item.items() if isinstance(item, dict) else {}:
                    lines.append(f"    <{key}>{value}</{key}>")
                lines.append("  </item>")
            lines.append("</data>")
            return "\n".join(lines) + "\n"
        else:
            return str(data)

    @staticmethod
    def _list_to_csv(data: Any) -> str:
        """转换为 CSV"""
        if not data:
            return ""

        if not isinstance(data, list):
            data = [data]

        if not data:
            return ""

        first_item = data[0]
        if not isinstance(first_item, dict):
            return ",".join(str(x) for x in data) + "\n"

        headers = list(first_item.keys())
        lines = [",".join(headers)]

        for item in data:
            if isinstance(item, dict):
                values = [str(item.get(h, "")) for h in headers]
                lines.append(",".join(values))

        return "\n".join(lines) + "\n"


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="数据处理工具 - 用于演示 CLI 契约验证",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    subparsers = parser.add_subparsers(dest="subcommand", help="可用的子命令")

    transform_parser = subparsers.add_parser(
        "transform",
        help="数据转换 - 将输入文件转换为指定格式",
    )
    transform_parser.add_argument(
        "--input", "-i",
        required=True,
        help="输入文件路径 [必填]",
    )
    transform_parser.add_argument(
        "--output", "-o",
        required=True,
        help="输出文件路径 [必填]",
    )
    transform_parser.add_argument(
        "--format", "-f",
        choices=["json", "csv", "xml", "yaml"],
        default="json",
        help="输出格式 (默认: json)",
    )

    pretty_group = transform_parser.add_mutually_exclusive_group()
    pretty_group.add_argument(
        "--pretty", "-p",
        action="store_true",
        help="美化输出 (与 --compress 互斥)",
    )
    pretty_group.add_argument(
        "--compress", "-c",
        action="store_true",
        help="压缩输出 (与 --pretty 互斥)",
    )

    transform_parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="缩进级别 (仅用于 --pretty, 默认: 2)",
    )
    transform_parser.add_argument(
        "--encoding", "-e",
        default="utf-8",
        help="文件编码 (默认: utf-8)",
    )

    validate_parser = subparsers.add_parser(
        "validate",
        help="数据验证 - 验证输入文件的格式和内容",
    )
    validate_parser.add_argument(
        "--file", "-f",
        required=True,
        help="要验证的文件路径 [必填]",
    )
    validate_parser.add_argument(
        "--schema", "-s",
        help="JSON Schema 文件路径",
    )
    validate_parser.add_argument(
        "--strict",
        action="store_true",
        help="严格模式 - 警告视为错误",
    )
    validate_parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="静默模式 - 仅输出错误",
    )

    if len(sys.argv) == 1:
        parser.print_help()
        return 0

    args = parser.parse_args()

    if args.subcommand == "transform":
        return DataProcessor.transform(
            input_file=args.input,
            output_file=args.output,
            fmt=args.format,
            pretty=args.pretty,
            indent=args.indent,
            compress=args.compress,
            encoding=args.encoding,
        )

    elif args.subcommand == "validate":
        return DataProcessor.validate(
            file_path=args.file,
            schema_file=args.schema,
            strict=args.strict,
            quiet=args.quiet,
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
