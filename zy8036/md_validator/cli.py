import argparse
import os
import sys

from .executor import execute_with_temp_workspace
from .parser import parse_markdown_files
from .report import BlockResult, generate_markdown_report, generate_terminal_summary
from .snapshot import compare_snapshot, update_snapshot


def find_duplicate_blocks(blocks):
    id_counts = {}
    duplicates = []
    for block in blocks:
        id_counts[block.id] = id_counts.get(block.id, 0) + 1
        if id_counts[block.id] > 1:
            duplicates.append(block.id)
    return list(set(duplicates))


def main():
    parser = argparse.ArgumentParser(description="Markdown 示例验收器")
    parser.add_argument("docs_dir", help="包含 Markdown 文件的目录")
    parser.add_argument(
        "-t", "--timeout", type=int, default=30, help="执行超时时间(秒)"
    )
    parser.add_argument(
        "-u", "--update", action="store_true", help="更新快照而不是比较"
    )
    parser.add_argument(
        "-o", "--output", help="Markdown 报告输出路径"
    )
    args = parser.parse_args()

    if not os.path.isdir(args.docs_dir):
        print(f"错误: {args.docs_dir} 不是有效的目录")
        sys.exit(1)

    blocks = parse_markdown_files(args.docs_dir)
    
    if not blocks:
        print("没有找到任何代码块")
        sys.exit(0)

    duplicate_ids = find_duplicate_blocks(blocks)
    if duplicate_ids:
        print(f"错误: 发现重复的块 ID: {', '.join(duplicate_ids)}")
        sys.exit(1)

    results = []
    
    for block in blocks:
        exec_result = execute_with_temp_workspace(block, timeout=args.timeout)
        
        if args.update:
            update_snapshot(block.id, exec_result)
            snapshot_result = compare_snapshot(block.id, exec_result)
        else:
            snapshot_result = compare_snapshot(block.id, exec_result)
        
        results.append(BlockResult(block=block, exec_result=exec_result, snapshot_result=snapshot_result))

    terminal_summary = generate_terminal_summary(results)
    print(terminal_summary)

    if args.output:
        md_report = generate_markdown_report(results)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(md_report)
        print(f"\n报告已保存到: {args.output}")

    failed = sum(1 for r in results if not r.snapshot_result.passed)
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()