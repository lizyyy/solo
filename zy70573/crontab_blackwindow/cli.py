#!/usr/bin/env python3
import argparse
import re
import sys
from typing import List

from .core import (
    BlackWindow,
    check_conflicts,
    parse_crontab_file,
    generate_terminal_summary,
    generate_json_report,
    generate_markdown_report,
    create_sample_crontab,
    run_self_test,
)


def parse_black_window(spec: str) -> BlackWindow:
    match = re.match(r'^(\d+):(\d+)-(\d+):(\d+)$', spec)
    if match:
        sh, sm, eh, em = map(int, match.groups())
        return BlackWindow(sh, eh, sm, em)
    
    match = re.match(r'^(\d+)-(\d+)$', spec)
    if match:
        sh, eh = map(int, match.groups())
        return BlackWindow(sh, eh)
    
    raise ValueError(f"无效的黑窗格式: {spec}, 请使用 HH:MM-HH:MM 或 HH-HH 格式")


def main():
    parser = argparse.ArgumentParser(
        description="Crontab 黑窗时间检查 CLI - 检测定时任务是否在维护窗口内执行"
    )

    parser.add_argument(
        '-f', '--file',
        action='append',
        default=[],
        help='要检查的 crontab 文件路径 (可多次指定)'
    )

    parser.add_argument(
        '-b', '--black-window',
        action='append',
        default=[],
        help='黑窗时间配置，格式: HH:MM-HH:MM 或 HH-HH (可多次指定)'
    )

    parser.add_argument(
        '-o', '--output',
        choices=['terminal', 'json', 'markdown', 'all'],
        default='terminal',
        help='输出格式'
    )

    parser.add_argument(
        '-O', '--output-file',
        help='输出文件前缀 (不含扩展名)'
    )

    parser.add_argument(
        '--hours',
        type=int,
        default=24,
        help='检查未来多少小时 (默认: 24)'
    )

    parser.add_argument(
        '--create-sample',
        help='创建示例 crontab 文件'
    )

    parser.add_argument(
        '--self-test',
        action='store_true',
        help='运行自检程序'
    )

    args = parser.parse_args()

    if args.self_test:
        sys.exit(run_self_test())

    if args.create_sample:
        create_sample_crontab(args.create_sample)
        sys.exit(0)

    if not args.file:
        print("错误: 请至少指定一个 crontab 文件 (-f/--file)")
        parser.print_help()
        sys.exit(1)

    if not args.black_window:
        print("错误: 请至少指定一个黑窗时间 (-b/--black-window)")
        parser.print_help()
        sys.exit(1)

    cron_lines = []
    for file_path in args.file:
        lines, _ = parse_crontab_file(file_path)
        cron_lines.extend(lines)

    black_windows: List[BlackWindow] = []
    for bw_spec in args.black_window:
        try:
            black_windows.append(parse_black_window(bw_spec))
        except ValueError as e:
            print(f"错误: {e}")
            sys.exit(1)

    conflicts, invalid_lines = check_conflicts(
        cron_lines,
        black_windows,
        hours_to_check=args.hours
    )

    terminal_report = generate_terminal_summary(
        cron_lines, conflicts, invalid_lines,
        black_windows,
        hours_to_check=args.hours
    )

    json_report = generate_json_report(
        cron_lines, conflicts, invalid_lines,
        black_windows,
        hours_to_check=args.hours
    )

    markdown_report = generate_markdown_report(
        cron_lines, conflicts, invalid_lines,
        black_windows,
        hours_to_check=args.hours
    )

    if args.output_file:
        if args.output in ['terminal', 'all']:
            with open(f"{args.output_file}.txt", 'w', encoding='utf-8') as f:
                f.write(terminal_report)
            print(f"终端报告已保存: {args.output_file}.txt")

        if args.output in ['json', 'all']:
            with open(f"{args.output_file}.json", 'w', encoding='utf-8') as f:
                f.write(json_report)
            print(f"JSON报告已保存: {args.output_file}.json")

        if args.output in ['markdown', 'all']:
            with open(f"{args.output_file}.md", 'w', encoding='utf-8') as f:
                f.write(markdown_report)
            print(f"Markdown报告已保存: {args.output_file}.md")

    else:
        if args.output == 'terminal':
            print(terminal_report)
        elif args.output == 'json':
            print(json_report)
        elif args.output == 'markdown':
            print(markdown_report)
        elif args.output == 'all':
            print(terminal_report)
            print("\n\n")

    sys.exit(0)


if __name__ == '__main__':
    main()
