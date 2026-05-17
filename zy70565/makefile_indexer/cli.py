#!/usr/bin/env python3
import argparse
import json
import sys
import os
from datetime import datetime
from typing import TextIO
from .parser import MakefileParser
from .models import ParseResult, IndexReport, MakefileTarget


class ReportGenerator:
    def __init__(self, parse_result: ParseResult):
        self.parse_result = parse_result
        self.report = IndexReport(
            total_targets=len(parse_result.targets),
            bad_lines_count=len(parse_result.bad_lines),
            parse_result=parse_result
        )
        self._classify_targets()

    def _classify_targets(self):
        for name, target in self.parse_result.targets.items():
            if target.has_side_effect:
                self.report.risky_targets.append(name)
            else:
                self.report.safe_targets.append(name)

    def print_terminal_summary(self, output: TextIO = sys.stdout):
        print("=" * 60, file=output)
        print("        MAKEFILE 目标索引报告", file=output)
        print("=" * 60, file=output)
        print(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", file=output)
        print(f"总目标数: {self.report.total_targets}", file=output)
        print(f"安全目标数: {len(self.report.safe_targets)}", file=output)
        print(f"风险目标数: {len(self.report.risky_targets)}", file=output)
        print(f"异常行数: {self.report.bad_lines_count}", file=output)
        print("", file=output)

        print("--- 安全目标 (可执行) ---", file=output)
        for name in sorted(self.report.safe_targets):
            target = self.parse_result.targets[name]
            comment = " | ".join(target.comments) if target.comments else "无描述"
            print(f"  ✓ {name:<20} {comment}", file=output)
        print("", file=output)

        print("--- 风险目标 (有副作用，执行前请确认) ---", file=output)
        for name in sorted(self.report.risky_targets):
            target = self.parse_result.targets[name]
            comment = " | ".join(target.comments) if target.comments else "无描述"
            reason = target.side_effect_reason or "未知原因"
            print(f"  ⚠ {name:<20} [{reason}] {comment}", file=output)
        print("", file=output)

        if self.parse_result.bad_lines:
            print("--- 异常行 (保留原始位置) ---", file=output)
            for bad_line in self.parse_result.bad_lines:
                print(f"  行 {bad_line.line_number}: {bad_line.content}", file=output)
                print(f"      原因: {bad_line.reason} ({bad_line.error_type})", file=output)
            print("", file=output)

        print("=" * 60, file=output)

    def generate_machine_readable(self, filepath: str):
        data = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_targets": self.report.total_targets,
                "safe_targets_count": len(self.report.safe_targets),
                "risky_targets_count": len(self.report.risky_targets),
                "bad_lines_count": self.report.bad_lines_count
            },
            "targets": {},
            "bad_lines": []
        }

        for name, target in self.parse_result.targets.items():
            data["targets"][name] = {
                "name": target.name,
                "line_number": target.line_number,
                "dependencies": target.dependencies,
                "expanded_deps": target.expanded_deps,
                "comments": target.comments,
                "has_side_effect": target.has_side_effect,
                "side_effect_reason": target.side_effect_reason,
                "is_safe": not target.has_side_effect
            }

        for bad_line in self.parse_result.bad_lines:
            data["bad_lines"].append({
                "line_number": bad_line.line_number,
                "content": bad_line.content,
                "reason": bad_line.reason,
                "error_type": bad_line.error_type
            })

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def generate_human_report(self, filepath: str):
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("# Makefile 目标索引报告\n\n")
            f.write(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")

            f.write("## 概览\n\n")
            f.write(f"- 总目标数: **{self.report.total_targets}**\n")
            f.write(f"- 安全目标: **{len(self.report.safe_targets)}** 个\n")
            f.write(f"- 风险目标: **{len(self.report.risky_targets)}** 个\n")
            f.write(f"- 解析异常: **{self.report.bad_lines_count}** 行\n\n")

            f.write("## 安全目标 (可放心执行)\n\n")
            f.write("| 目标名 | 说明 | 依赖 |\n")
            f.write("|--------|------|------|\n")
            for name in sorted(self.report.safe_targets):
                target = self.parse_result.targets[name]
                comment = "<br>".join(target.comments) if target.comments else "-"
                deps = ", ".join(target.dependencies) if target.dependencies else "-"
                f.write(f"| {name} | {comment} | {deps} |\n")
            f.write("\n")

            f.write("## 风险目标 (有副作用！)\n\n")
            f.write("| 目标名 | 副作用说明 | 目标说明 |\n")
            f.write("|--------|------------|----------|\n")
            for name in sorted(self.report.risky_targets):
                target = self.parse_result.targets[name]
                comment = "<br>".join(target.comments) if target.comments else "-"
                reason = target.side_effect_reason or "未知"
                f.write(f"| {name} | {reason} | {comment} |\n")
            f.write("\n")

            if self.parse_result.bad_lines:
                f.write("## 解析异常记录\n\n")
                f.write("| 行号 | 原始内容 | 异常原因 |\n")
                f.write("|------|----------|----------|\n")
                for bad_line in self.parse_result.bad_lines:
                    f.write(f"| {bad_line.line_number} | `{bad_line.content}` | {bad_line.reason} |\n")
                f.write("\n")

            f.write("## 使用建议\n\n")
            f.write("1. 首次执行前，建议先查看此报告了解目标的作用\n")
            f.write("2. 对于标有「风险」的目标，执行前务必确认影响范围\n")
            f.write("3. 如果目标描述不清晰，建议补充 Makefile 注释\n")
            f.write("4. 新增目标时，记得添加注释说明用途\n")


def main():
    parser = argparse.ArgumentParser(
        description="Makefile 目标索引 CLI - 解析 Makefile 并识别安全/风险目标"
    )
    parser.add_argument(
        "makefile",
        nargs="?",
        default="Makefile",
        help="Makefile 文件路径 (默认: Makefile)"
    )
    parser.add_argument(
        "--json",
        metavar="FILE",
        help="输出机器可读 JSON 结果到指定文件"
    )
    parser.add_argument(
        "--report",
        metavar="FILE",
        help="输出人类可读 Markdown 报告到指定文件"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="不输出终端摘要"
    )

    args = parser.parse_args()

    makefile_parser = MakefileParser()
    result = makefile_parser.parse(args.makefile)

    if not result.targets and not result.bad_lines:
        if not args.quiet:
            print(f"警告: 未在 {args.makefile} 中找到任何目标", file=sys.stderr)
        sys.exit(1)

    generator = ReportGenerator(result)

    if not args.quiet:
        generator.print_terminal_summary()

    if args.json:
        generator.generate_machine_readable(args.json)
        if not args.quiet:
            print(f"机器可读结果已保存到: {args.json}")

    if args.report:
        generator.generate_human_report(args.report)
        if not args.quiet:
            print(f"人类可读报告已保存到: {args.report}")

    if result.bad_lines:
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
