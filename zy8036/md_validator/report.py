from dataclasses import dataclass
from typing import List

from .executor import ExecutionResult
from .parser import CodeBlock
from .snapshot import SnapshotResult


@dataclass
class BlockResult:
    block: CodeBlock
    exec_result: ExecutionResult
    snapshot_result: SnapshotResult


def generate_terminal_summary(results: List[BlockResult]) -> str:
    passed = sum(1 for r in results if r.snapshot_result.passed)
    failed = len(results) - passed
    new_snapshots = sum(1 for r in results if not r.snapshot_result.snapshot_matched and r.exec_result.success)

    lines = []
    lines.append("=" * 60)
    lines.append("Markdown 示例验收器 - 终端摘要")
    lines.append("=" * 60)
    lines.append(f"总计: {len(results)} | 通过: {passed} | 失败: {failed} | 新增快照: {new_snapshots}")
    lines.append("-" * 60)

    for result in results:
        status = "✓" if result.snapshot_result.passed else "✗"
        marker = "*" if not result.snapshot_result.snapshot_matched and result.exec_result.success else " "
        lines.append(f"{status}{marker} {result.block.id}")

        if not result.snapshot_result.passed:
            lines.append(f"    文件: {result.block.file_path}:{result.block.line_number}")
            if result.exec_result.missing_env:
                lines.append(f"    错误: 缺少环境变量 {result.exec_result.missing_env}")
            elif result.exec_result.timed_out:
                lines.append(f"    错误: 执行超时")
            elif result.exec_result.error:
                error_lines = result.exec_result.error.strip().split("\n")
                for line in error_lines[:3]:
                    lines.append(f"    错误: {line}")
            lines.append("")

    lines.append("=" * 60)
    return "\n".join(lines)


def generate_markdown_report(results: List[BlockResult]) -> str:
    lines = []
    lines.append("# Markdown 示例验收报告")
    lines.append("")
    lines.append("## 摘要")
    
    passed = sum(1 for r in results if r.snapshot_result.passed)
    failed = len(results) - passed
    new_snapshots = sum(1 for r in results if not r.snapshot_result.snapshot_matched and r.exec_result.success)
    
    lines.append(f"- 总计: {len(results)}")
    lines.append(f"- 通过: {passed}")
    lines.append(f"- 失败: {failed}")
    lines.append(f"- 新增快照: {new_snapshots}")
    lines.append("")
    lines.append("## 详细结果")
    lines.append("")

    for result in results:
        status = "通过" if result.snapshot_result.passed else "失败"
        status_badge = "✅" if result.snapshot_result.passed else "❌"
        
        lines.append(f"### {status_badge} {result.block.id}")
        lines.append("")
        lines.append(f"| 属性 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 状态 | {status} |")
        lines.append(f"| 语言 | {result.block.language} |")
        lines.append(f"| 文件 | `{result.block.file_path}:{result.block.line_number}` |")
        lines.append(f"| 耗时 | {result.exec_result.duration:.2f}s |")
        
        if result.snapshot_result.snapshot_matched:
            lines.append("| 快照 | 匹配 |")
        elif result.exec_result.success:
            lines.append("| 快照 | 新建 |")
        
        lines.append("")
        
        if result.exec_result.output:
            lines.append("#### 输出")
            lines.append(f"```\n{result.exec_result.output}\n```")
            lines.append("")
        
        if result.exec_result.error:
            lines.append("#### 错误")
            lines.append(f"```\n{result.exec_result.error}\n```")
            lines.append("")

    return "\n".join(lines)