#!/usr/bin/env python3
"""报告生成模块 - 负责生成终端摘要、机器可读结果和人类可读报告"""

from datetime import datetime
from typing import List, Dict, Any
from dataclasses import asdict
import json

from .diff import DiffResult


class Reporter:
    """报告生成器"""

    def __init__(self):
        pass

    def generate_terminal_summary(self, diffs: List[DiffResult], 
                                   added: List[Dict], 
                                   removed: List[Dict], 
                                   errors: List[Dict]) -> str:
        """生成终端摘要
        
        Args:
            diffs: 修改的条目列表
            added: 新增的条目列表
            removed: 删除的条目列表
            errors: 扫描错误列表
            
        Returns:
            终端摘要字符串
        """
        lines = []
        lines.append("=" * 70)
        lines.append("                    LINUX权限快照差异报告")
        lines.append("=" * 70)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append(f"修改的条目: {len(diffs)}")
        lines.append(f"新增的条目: {len(added)}")
        lines.append(f"删除的条目: {len(removed)}")
        lines.append(f"扫描错误: {len(errors)}")
        lines.append("")
        
        if diffs:
            lines.append("-" * 70)
            lines.append("修改详情:")
            lines.append("-" * 70)
            for d in diffs[:30]:  # 最多显示30条
                lines.append(f"  路径: {d.path}")
                lines.append(f"    {d.field}: {d.old_value} -> {d.new_value}")
            if len(diffs) > 30:
                lines.append(f"  ... 还有 {len(diffs) - 30} 项修改未显示")
            lines.append("")
        
        if added:
            lines.append("-" * 70)
            lines.append("新增条目:")
            lines.append("-" * 70)
            for a in added[:15]:  # 最多显示15条
                lines.append(f"  + {a['path']} ({a.get('file_type', 'unknown')})")
            if len(added) > 15:
                lines.append(f"  ... 还有 {len(added) - 15} 项新增未显示")
            lines.append("")
        
        if removed:
            lines.append("-" * 70)
            lines.append("删除条目:")
            lines.append("-" * 70)
            for r in removed[:15]:  # 最多显示15条
                lines.append(f"  - {r['path']}")
            if len(removed) > 15:
                lines.append(f"  ... 还有 {len(removed) - 15} 项删除未显示")
            lines.append("")
        
        if errors:
            lines.append("-" * 70)
            lines.append("扫描错误 (保留原始位置供排查):")
            lines.append("-" * 70)
            for err in errors:
                lines.append(f"  路径: {err.get('path', 'unknown')}")
                lines.append(f"  类型: {err.get('error_type', 'unknown')}")
                lines.append(f"  原因: {err.get('error', 'unknown')}")
                lines.append("")
        
        lines.append("=" * 70)
        return "\n".join(lines)

    def generate_machine_readable(self, diffs: List[DiffResult], 
                                   added: List[Dict], 
                                   removed: List[Dict], 
                                   errors: List[Dict], 
                                   baseline_name: str, 
                                   current_name: str) -> str:
        """生成机器可读的JSON结果
        
        Args:
            diffs: 修改的条目列表
            added: 新增的条目列表
            removed: 删除的条目列表
            errors: 扫描错误列表
            baseline_name: 基线快照名称
            current_name: 当前快照名称
            
        Returns:
            JSON格式的字符串
        """
        result = {
            "report_time": datetime.now().isoformat(),
            "baseline": baseline_name,
            "current": current_name,
            "summary": {
                "modified_count": len(diffs),
                "added_count": len(added),
                "removed_count": len(removed),
                "error_count": len(errors)
            },
            "modified": [asdict(d) for d in diffs],
            "added": added,
            "removed": removed,
            "errors": errors
        }
        return json.dumps(result, indent=2, ensure_ascii=False)

    def generate_human_report(self, diffs: List[DiffResult], 
                              added: List[Dict], 
                              removed: List[Dict], 
                              errors: List[Dict], 
                              baseline_info: Dict, 
                              current_info: Dict) -> str:
        """生成适合发给同事的人类可读报告（Markdown格式）
        
        Args:
            diffs: 修改的条目列表
            added: 新增的条目列表
            removed: 删除的条目列表
            errors: 扫描错误列表
            baseline_info: 基线快照信息
            current_info: 当前快照信息
            
        Returns:
            Markdown格式的报告字符串
        """
        lines = []
        lines.append("# Linux目录权限审计报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("## 报告概述")
        lines.append("")
        lines.append(f"- **基线快照**: `{baseline_info.get('name', 'N/A')}`")
        lines.append(f"- **基线时间**: {baseline_info.get('timestamp', 'N/A')}")
        lines.append(f"- **当前快照**: `{current_info.get('name', 'N/A')}`")
        lines.append(f"- **当前时间**: {current_info.get('timestamp', 'N/A')}")
        lines.append("")
        lines.append("## 统计摘要")
        lines.append("")
        lines.append("| 类别 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 修改的条目 | {len(diffs)} |")
        lines.append(f"| 新增的条目 | {len(added)} |")
        lines.append(f"| 删除的条目 | {len(removed)} |")
        lines.append(f"| 扫描错误 | {len(errors)} |")
        lines.append("")
        
        if diffs:
            lines.append("## 详细修改记录")
            lines.append("")
            current_path = None
            for d in sorted(diffs, key=lambda x: x.path):
                if d.path != current_path:
                    if current_path is not None:
                        lines.append("")
                    current_path = d.path
                    lines.append(f"### `{d.path}`")
                    lines.append("")
                    lines.append("| 字段 | 原值 | 新值 |")
                    lines.append("|------|------|------|")
                old = str(d.old_value) if d.old_value is not None else "(空)"
                new = str(d.new_value) if d.new_value is not None else "(空)"
                lines.append(f"| {d.field} | {old} | {new} |")
            lines.append("")
        
        if added:
            lines.append("## 新增条目")
            lines.append("")
            for a in sorted(added, key=lambda x: x["path"]):
                lines.append(f"- `{a['path']}` ({a.get('file_type', 'unknown')})")
            lines.append("")
        
        if removed:
            lines.append("## 删除条目")
            lines.append("")
            for r in sorted(removed, key=lambda x: x["path"]):
                lines.append(f"- `{r['path']}`")
            lines.append("")
        
        if errors:
            lines.append("## 扫描异常记录")
            lines.append("")
            lines.append("以下条目在扫描时遇到问题，已保留原始位置供排查：")
            lines.append("")
            for err in errors:
                lines.append(f"### 路径: `{err.get('path', 'unknown')}`")
                lines.append("")
                lines.append(f"- **错误类型**: {err.get('error_type', 'unknown')}")
                lines.append(f"- **错误详情**: {err.get('error', 'unknown')}")
                lines.append("")
        
        lines.append("---")
        lines.append("*本报告由 perm-snapshot 工具自动生成*")
        
        return "\n".join(lines)

    def save_report(self, content: str, filepath: str) -> None:
        """保存报告到文件
        
        Args:
            content: 报告内容
            filepath: 保存路径
        """
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
