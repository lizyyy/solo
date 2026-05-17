"""报告生成模块 - JSON和Markdown报告"""

import json
from pathlib import Path
from typing import List, Dict
from datetime import datetime
from .models import PurificationResult, FileEntry, PathIssueType, ExitCode


class ReportGenerator:
    """报告生成器"""
    
    ISSUE_LABELS = {
        PathIssueType.ABSOLUTE_PATH: "绝对路径",
        PathIssueType.CHINESE_SPACE: "中文空格",
        PathIssueType.NORMAL_SPACE: "普通空格",
        PathIssueType.SPECIAL_CHARACTER: "特殊字符",
        PathIssueType.DUPLICATE: "重复文件名",
        PathIssueType.ENCODING_ISSUE: "编码问题",
        PathIssueType.INVALID_PATH: "无效路径",
    }
    
    def __init__(self, result: PurificationResult):
        self.result = result
    
    def generate_json(self, output_path: Path, indent: int = 2) -> None:
        """生成机器可读的JSON报告"""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.result.model_dump(), f, ensure_ascii=False, indent=indent)
    
    def generate_markdown(self, output_path: Path) -> None:
        """生成适合分享的Markdown报告"""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        md = self._build_markdown()
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md)
    
    def _build_markdown(self) -> str:
        """构建Markdown内容"""
        lines = []
        lines.append("# 归档包路径净化报告")
        lines.append("")
        lines.append(f"**生成时间**: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        lines.append("")
        lines.append("## 1. 归档包信息")
        lines.append("")
        info = self.result.archive_info
        lines.append(f"| 项目 | 内容 |")
        lines.append(f"|------|------|")
        lines.append(f"| 文件路径 | `{info.path}` |")
        lines.append(f"| 文件大小 | {self._format_size(info.size_bytes)} |")
        lines.append(f"| 文件总数 | {info.file_count} |")
        lines.append(f"| 格式 | {info.format.upper()} |")
        lines.append("")
        lines.append("## 2. 净化结果摘要")
        lines.append("")
        lines.append(f"| 指标 | 数量 |")
        lines.append(f"|------|------|")
        lines.append(f"| 处理文件总数 | {self.result.total_files} |")
        lines.append(f"| 存在问题的文件 | {self.result.files_with_issues} |")
        lines.append(f"| 成功净化的文件 | {self.result.files_cleaned} |")
        lines.append(f"| 跳过的文件 | {self.result.files_skipped} |")
        lines.append(f"| 重复文件组数 | {self.result.duplicate_groups} |")
        lines.append("")
        lines.append("## 3. 问题类型统计")
        lines.append("")
        for issue_type, count in self.result.issues_count.items():
            if count > 0:
                label = self.ISSUE_LABELS.get(issue_type, issue_type)
                lines.append(f"- **{label}**: {count} 个")
        lines.append("")
        lines.append("## 4. 净化规则配置")
        lines.append("")
        rules = self.result.rules
        lines.append(f"- 移除绝对路径: {'是' if rules.remove_absolute else '否'}")
        lines.append(f"- 替换普通空格: {'是' if rules.replace_spaces else '否'}")
        lines.append(f"- 替换中文空格: {'是' if rules.replace_chinese_spaces else '否'}")
        lines.append(f"- 去重处理: {'是' if rules.deduplicate else '否'}")
        lines.append(f"- 路径分隔符标准化: {'是' if rules.normalize_separators else '否'}")
        lines.append("")
        lines.append("## 5. 详细问题文件清单")
        lines.append("")
        
        files_with_issues = [e for e in self.result.entries if e.issues or e.error_message]
        
        if files_with_issues:
            lines.append("| 序号 | 原始路径 | 净化后路径 | 问题类型 | 备注 |")
            lines.append("|------|----------|------------|----------|------|")
            for entry in files_with_issues[:50]:
                issue_labels = [self.ISSUE_LABELS.get(i, i) for i in entry.issues]
                issues_str = "、".join(issue_labels)
                remark = entry.error_message or ""
                lines.append(f"| {entry.index + 1} | `{entry.original_path}` | `{entry.normalized_path}` | {issues_str} | {remark} |")
            
            if len(files_with_issues) > 50:
                lines.append("")
                lines.append(f"> 注：仅显示前 50 条问题记录，共 {len(files_with_issues)} 条")
        else:
            lines.append("没有发现问题文件！")
        
        lines.append("")
        lines.append("## 6. 退出码说明")
        lines.append("")
        lines.append(f"- **退出码**: `{self.result.exit_code.value}`")
        if self.result.exit_code == ExitCode.SUCCESS:
            lines.append("- 状态: 成功，无警告无错误")
        elif self.result.exit_code == ExitCode.WARNINGS:
            lines.append("- 状态: 有警告但可继续处理")
        elif self.result.exit_code == ExitCode.ERRORS:
            lines.append("- 状态: 有错误，部分文件未能处理")
        
        lines.append("")
        lines.append("---")
        lines.append("*本报告由归档包路径净化CLI自动生成*")
        
        return "\n".join(lines)
    
    def _format_size(self, bytes_size: int) -> str:
        """格式化文件大小"""
        if bytes_size < 1024:
            return f"{bytes_size} B"
        elif bytes_size < 1024 * 1024:
            return f"{bytes_size / 1024:.1f} KB"
        elif bytes_size < 1024 * 1024 * 1024:
            return f"{bytes_size / (1024 * 1024):.1f} MB"
        else:
            return f"{bytes_size / (1024 * 1024 * 1024):.1f} GB"
