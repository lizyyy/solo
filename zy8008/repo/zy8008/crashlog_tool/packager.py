"""
打包导出模块

负责生成所有输出文件：
- 脱敏后的日志
- 崩溃时间线
- 可疑堆栈摘要
- report.md
- package.zip
"""

import os
import shutil
import zipfile
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from .log_parser import LogEntry, LogParser
from .stack_merger import CrashGroup, SuspiciousStack, StackMerger
from .sanitizer import LogSanitizer, create_default_sanitizer
from .validator import ValidationResult


@dataclass
class ExportResult:
    """导出结果"""
    output_dir: str
    sanitized_logs_path: str = ""
    timeline_path: str = ""
    suspicious_stacks_path: str = ""
    report_path: str = ""
    package_zip_path: str = ""
    files_generated: List[str] = field(default_factory=list)


class ReportGenerator:
    """报告生成器"""

    def __init__(
        self,
        build_meta: Dict[str, Any] = None,
        sanitizer: Optional[LogSanitizer] = None
    ):
        self.build_meta = build_meta or {}
        self.sanitizer = sanitizer or create_default_sanitizer()

    def generate_report(
        self,
        log_entries: List[LogEntry],
        crash_groups: List[CrashGroup],
        suspicious_stacks: List[SuspiciousStack],
        timeline: List[Dict],
        output_path: str
    ) -> str:
        """生成 Markdown 报告"""
        lines = []

        lines.append("# 崩溃日志分析报告")
        lines.append("")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 构建信息")
        lines.append("")
        if self.build_meta:
            for key, value in self.build_meta.items():
                lines.append(f"- **{key}**: {value}")
        else:
            lines.append("*未提供构建元信息*")
        lines.append("")

        lines.append("## 概览")
        lines.append("")
        lines.append(f"- 总日志条目数: {len(log_entries)}")
        lines.append(f"- 崩溃分组数: {len(crash_groups)}")
        lines.append(f"- 可疑堆栈数: {len(suspicious_stacks)}")
        lines.append(f"- 时间线事件数: {len(timeline)}")
        lines.append("")

        if crash_groups:
            lines.append("## 崩溃分组概览")
            lines.append("")
            lines.append("| 分组ID | 异常类型 | 出现次数 | 首次出现 | 最后出现 |")
            lines.append("|--------|----------|----------|----------|----------|")

            for group in crash_groups[:20]:
                first_seen = group.first_seen.strftime('%m-%d %H:%M') if group.first_seen else "-"
                last_seen = group.last_seen.strftime('%m-%d %H:%M') if group.last_seen else "-"
                lines.append(f"| {group.group_id} | {group.exception_type[:30]} | {group.count} | {first_seen} | {last_seen} |")

            if len(crash_groups) > 20:
                lines.append(f"")
                lines.append(f"*还有 {len(crash_groups) - 20} 个分组未显示*")
            lines.append("")

        if suspicious_stacks:
            lines.append("## 可疑堆栈摘要")
            lines.append("")
            lines.append("| 排名 | 置信度 | 异常类型 | 出现次数 | 签名 |")
            lines.append("|------|--------|----------|----------|------|")

            for stack in suspicious_stacks:
                confidence_pct = f"{stack.confidence * 100:.0f}%"
                sig_short = stack.signature[:50] + "..." if len(stack.signature) > 50 else stack.signature
                lines.append(f"| {stack.rank} | {confidence_pct} | {stack.exception_type[:20]} | {stack.occurrence_count} | {sig_short} |")
            lines.append("")

            for stack in suspicious_stacks[:5]:
                lines.append(f"### 可疑堆栈 #{stack.rank}")
                lines.append("")
                lines.append(f"- **置信度**: {stack.confidence * 100:.0f}%")
                lines.append(f"- **异常类型**: {stack.exception_type}")
                lines.append(f"- **出现次数**: {stack.occurrence_count}")
                lines.append("")
                lines.append("**关键帧**:")
                lines.append("")
                for frame in stack.key_frames:
                    lines.append(f"  {frame['index'] + 1}. {frame['frame']}")
                lines.append("")
                lines.append("**示例堆栈**:")
                lines.append("")
                lines.append("```")
                lines.append(stack.sample_stack)
                lines.append("```")
                lines.append("")

        if timeline:
            lines.append("## 崩溃时间线")
            lines.append("")
            lines.append("| 时间 | 异常类型 | 消息 | 来源 |")
            lines.append("|------|----------|------|------|")

            for event in timeline[:50]:
                ts = event["timestamp"].strftime('%Y-%m-%d %H:%M:%S') if event["timestamp"] else "-"
                msg_short = event["message"][:50] + "..." if len(event["message"]) > 50 else event["message"]
                lines.append(f"| {ts} | {event['exception_type'][:20]} | {msg_short} | {event['source'][:20]} |")

            if len(timeline) > 50:
                lines.append("")
                lines.append(f"*还有 {len(timeline) - 50} 个事件未显示*")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*此报告由 crashlog-tool 自动生成*")

        content = '\n'.join(lines)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return output_path


class Packager:
    """打包器"""

    def __init__(
        self,
        output_dir: str,
        sanitizer: Optional[LogSanitizer] = None,
        build_meta: Dict[str, Any] = None
    ):
        self.output_dir = output_dir
        self.sanitizer = sanitizer or create_default_sanitizer()
        self.build_meta = build_meta or {}
        self.report_generator = ReportGenerator(build_meta, self.sanitizer)

    def export_all(
        self,
        log_entries: List[LogEntry],
        crash_groups: List[CrashGroup],
        suspicious_stacks: List[SuspiciousStack],
        timeline: List[Dict],
        validation_result: Optional[ValidationResult] = None
    ) -> ExportResult:
        """
        导出所有内容

        生成：
        - 脱敏后的日志文件
        - 崩溃时间线 JSON
        - 可疑堆栈摘要 JSON
        - report.md
        - package.zip
        """
        os.makedirs(self.output_dir, exist_ok=True)

        result = ExportResult(output_dir=self.output_dir)

        result.sanitized_logs_path = self._export_sanitized_logs(log_entries)
        result.files_generated.append(result.sanitized_logs_path)

        result.timeline_path = self._export_timeline(timeline)
        result.files_generated.append(result.timeline_path)

        result.suspicious_stacks_path = self._export_suspicious_stacks(suspicious_stacks)
        result.files_generated.append(result.suspicious_stacks_path)

        report_path = os.path.join(self.output_dir, "report.md")
        result.report_path = self.report_generator.generate_report(
            log_entries, crash_groups, suspicious_stacks, timeline, report_path
        )
        result.files_generated.append(result.report_path)

        if self.build_meta:
            build_meta_path = os.path.join(self.output_dir, "build_meta.json")
            with open(build_meta_path, 'w', encoding='utf-8') as f:
                json.dump(self.build_meta, f, ensure_ascii=False, indent=2)
            result.files_generated.append(build_meta_path)

        result.package_zip_path = self._create_package_zip(result.files_generated)
        result.files_generated.append(result.package_zip_path)

        return result

    def _export_sanitized_logs(self, log_entries: List[LogEntry]) -> str:
        """导出脱敏后的日志"""
        output_path = os.path.join(self.output_dir, "sanitized_logs.txt")

        lines = []
        for entry in log_entries:
            sanitized_text, _ = self.sanitizer.sanitize_log_content(entry.raw_text)
            lines.append(sanitized_text)

        content = '\n'.join(lines)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return output_path

    def _export_timeline(self, timeline: List[Dict]) -> str:
        """导出崩溃时间线"""
        output_path = os.path.join(self.output_dir, "crash_timeline.json")

        serializable = []
        for event in timeline:
            item = event.copy()
            if item.get("timestamp"):
                item["timestamp"] = item["timestamp"].isoformat() if hasattr(item["timestamp"], 'isoformat') else str(item["timestamp"])
            serializable.append(item)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(serializable, f, ensure_ascii=False, indent=2)

        return output_path

    def _export_suspicious_stacks(self, suspicious_stacks: List[SuspiciousStack]) -> str:
        """导出可疑堆栈摘要"""
        output_path = os.path.join(self.output_dir, "suspicious_stacks.json")

        serializable = []
        for stack in suspicious_stacks:
            item = {
                "rank": stack.rank,
                "confidence": stack.confidence,
                "signature": stack.signature,
                "exception_type": stack.exception_type,
                "key_frames": stack.key_frames,
                "occurrence_count": stack.occurrence_count,
                "sample_stack": stack.sample_stack
            }
            serializable.append(item)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(serializable, f, ensure_ascii=False, indent=2)

        return output_path

    def _create_package_zip(self, files_to_include: List[str]) -> str:
        """创建打包 ZIP"""
        zip_path = os.path.join(self.output_dir, "package.zip")

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for file_path in files_to_include:
                if os.path.exists(file_path) and not file_path.endswith('.zip'):
                    arc_name = os.path.basename(file_path)
                    zf.write(file_path, arc_name)

        return zip_path


def export_results(
    output_dir: str,
    log_entries: List[LogEntry],
    crash_groups: List[CrashGroup],
    suspicious_stacks: List[SuspiciousStack],
    timeline: List[Dict],
    sanitizer: Optional[LogSanitizer] = None,
    build_meta: Dict[str, Any] = None
) -> ExportResult:
    """
    便捷函数：导出所有结果
    """
    packager = Packager(output_dir, sanitizer, build_meta)
    return packager.export_all(
        log_entries, crash_groups, suspicious_stacks, timeline
    )
