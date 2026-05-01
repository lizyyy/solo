import csv
import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from .manifest import Manifest, CopyProgress
from .scanner import FileInfo, ScanResult
from .validator import CopyPlan, Severity, ValidationIssue


def format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 ** 2:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 ** 3:
        return f"{size_bytes / (1024 ** 2):.2f} MB"
    elif size_bytes < 1024 ** 4:
        return f"{size_bytes / (1024 ** 3):.2f} GB"
    else:
        return f"{size_bytes / (1024 ** 4):.2f} TB"


def format_datetime(dt: datetime | None) -> str:
    if dt is None:
        return "N/A"
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def format_duration(seconds: float | None) -> str:
    if seconds is None:
        return "N/A"
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    frac = int((seconds - int(seconds)) * 100)
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}.{frac:02d}"
    return f"{minutes}:{secs:02d}.{frac:02d}"


@dataclass
class ReportData:
    project_name: str
    report_time: datetime = field(default_factory=datetime.now)

    scan_result: ScanResult | None = None
    manifest: Manifest | None = None
    copy_plan: CopyPlan | None = None

    verification_issues: list[ValidationIssue] = field(default_factory=list)
    copy_results: dict[str, Any] = field(default_factory=dict)

    notes: str = ""


class MarkdownReporter:
    def __init__(self, report_data: ReportData) -> None:
        self.data = report_data

    def _generate_header(self) -> str:
        lines = []
        lines.append(f"# 素材回卡交接报告\n")
        lines.append(f"**项目名称**: {self.data.project_name}  \n")
        lines.append(f"**报告时间**: {format_datetime(self.data.report_time)}  \n")
        lines.append(f"**报告类型**: 完整交接报告  \n")
        lines.append("\n---\n")
        return "\n".join(lines)

    def _generate_summary(self) -> str:
        lines = []
        lines.append("## 📊 总览\n")

        if self.data.scan_result:
            sr = self.data.scan_result
            lines.append(f"**扫描时间**: {format_datetime(sr.scan_time)}  \n")
            lines.append(f"**存储卡数量**: {len(sr.cards)} 张  \n")
            lines.append(f"**总文件数**: {sr.total_files} 个  \n")
            lines.append(f"**总数据量**: {format_size(sr.total_size)}  \n")

            video_count = len([f for f in sr.all_files if f.file_category == "video"])
            audio_count = len([f for f in sr.all_files if f.file_category == "audio"])
            proxy_count = len([f for f in sr.all_files if f.file_category == "proxy"])
            sidecar_count = len([f for f in sr.all_files if f.file_category == "sidecar"])

            lines.append(f"\n**文件分类统计**:\n")
            lines.append(f"- 🎬 视频文件: {video_count} 个")
            lines.append(f"- 🎤 音频文件: {audio_count} 个")
            lines.append(f"- 📹 代理文件: {proxy_count} 个")
            lines.append(f"- 📝 边车文件: {sidecar_count} 个\n")

        if self.data.copy_results:
            lines.append("\n**拷贝状态**:\n")
            copied = self.data.copy_results.get("copied_files", 0)
            skipped = self.data.copy_results.get("skipped_files", 0)
            failed = self.data.copy_results.get("failed_files", 0)
            total = self.data.copy_results.get("total_files", 0)

            lines.append(f"- ✅ 已拷贝: {copied} 个")
            lines.append(f"- ⏭️ 已跳过: {skipped} 个")
            lines.append(f"- ❌ 失败: {failed} 个")
            lines.append(f"- 📊 总计: {total} 个\n")

        if self.data.manifest and self.data.manifest.copy_complete:
            lines.append("\n✅ **拷贝已完成，所有文件已验证通过**\n")

        lines.append("\n---\n")
        return "\n".join(lines)

    def _generate_card_details(self) -> str:
        if not self.data.scan_result:
            return ""

        lines = []
        lines.append("## 💾 存储卡详情\n")

        for idx, card in enumerate(self.data.scan_result.cards, 1):
            lines.append(f"### 卡 {idx}: {card.card_id}\n")
            lines.append(f"- **源目录**: `{card.source_directory}`")
            lines.append(f"- **扫描时间**: {format_datetime(card.scan_time)}")
            lines.append(f"- **文件数量**: {card.total_files} 个")
            lines.append(f"- **数据量**: {format_size(card.total_size)}\n")

            video_files = card.video_files
            if video_files:
                lines.append("**视频文件列表**:\n")
                lines.append("| 文件名 | 大小 | 修改时间 | 时长 | 时间码 |\n")
                lines.append("|--------|------|----------|------|--------|\n")

                for f in sorted(video_files, key=lambda x: x.file_name):
                    duration = format_duration(f.duration_seconds) if f.metadata else "N/A"
                    tc = f.start_timecode or "N/A"
                    if f.metadata:
                        tc = f.metadata.start_timecode or tc
                    lines.append(
                        f"| {f.file_name} | {format_size(f.file_size)} | "
                        f"{format_datetime(f.modification_time)} | {duration} | {tc} |"
                    )
                lines.append("\n")

            audio_files = card.audio_files
            if audio_files:
                lines.append("**音频文件列表**:\n")
                lines.append("| 文件名 | 大小 | 修改时间 |\n")
                lines.append("|--------|------|----------|\n")
                for f in sorted(audio_files, key=lambda x: x.file_name):
                    lines.append(
                        f"| {f.file_name} | {format_size(f.file_size)} | "
                        f"{format_datetime(f.modification_time)} |"
                    )
                lines.append("\n")

            sidecar_files = card.sidecar_files
            if sidecar_files:
                lines.append("**边车文件列表**:\n")
                lines.append("| 文件名 | 大小 |\n")
                lines.append("|--------|------|\n")
                for f in sorted(sidecar_files, key=lambda x: x.file_name):
                    lines.append(f"| {f.file_name} | {format_size(f.file_size)} |")
                lines.append("\n")

        lines.append("---\n")
        return "\n".join(lines)

    def _generate_issues(self) -> str:
        all_issues: list[ValidationIssue] = []

        if self.data.copy_plan:
            all_issues.extend(self.data.copy_plan.issues)

        if self.data.verification_issues:
            all_issues.extend(self.data.verification_issues)

        if not all_issues:
            return "## ✅ 校验结果\n\n无问题发现，所有校验通过。\n\n---\n"

        lines = []
        lines.append("## ⚠️ 问题清单\n")

        errors = [i for i in all_issues if i.severity == Severity.ERROR]
        warnings = [i for i in all_issues if i.severity == Severity.WARNING]
        infos = [i for i in all_issues if i.severity == Severity.INFO]

        if errors:
            lines.append(f"### ❌ 严重问题 ({len(errors)} 个)\n")
            for issue in errors:
                lines.append(f"**{issue.issue_id}**\n")
                lines.append(f"- 类别: {issue.category}")
                lines.append(f"- 描述: {issue.message}")
                if issue.file_name:
                    lines.append(f"- 相关文件: {issue.file_name}")
                if issue.card_id:
                    lines.append(f"- 相关卡: {issue.card_id}")
                lines.append("")

        if warnings:
            lines.append(f"### ⚠️ 警告 ({len(warnings)} 个)\n")
            for issue in warnings:
                lines.append(f"**{issue.issue_id}**\n")
                lines.append(f"- 类别: {issue.category}")
                lines.append(f"- 描述: {issue.message}")
                if issue.file_name:
                    lines.append(f"- 相关文件: {issue.file_name}")
                if issue.card_id:
                    lines.append(f"- 相关卡: {issue.card_id}")
                lines.append("")

        if infos:
            lines.append(f"### ℹ️ 提示信息 ({len(infos)} 个)\n")
            for issue in infos:
                lines.append(f"- {issue.message}")
            lines.append("")

        lines.append("---\n")
        return "\n".join(lines)

    def _generate_copy_progress(self) -> str:
        if not self.data.manifest:
            return ""

        manifest = self.data.manifest
        if not manifest.copy_progress:
            return ""

        lines = []
        lines.append("## 📋 拷贝进度详情\n")

        total = len(manifest.copy_progress)
        completed = sum(1 for p in manifest.copy_progress.values() if p.completed)
        verified = sum(1 for p in manifest.copy_progress.values() if p.verified and p.hash_matched)
        errors = [p for p in manifest.copy_progress.values() if p.error_message]

        lines.append(f"- 总文件数: {total}")
        lines.append(f"- 已完成: {completed}")
        lines.append(f"- 已验证: {verified}")
        lines.append(f"- 有错误: {len(errors)}\n")

        if errors:
            lines.append("### 错误文件\n")
            for p in errors:
                lines.append(f"- **{p.file_name}**: {p.error_message}")
            lines.append("")

        lines.append("---\n")
        return "\n".join(lines)

    def _generate_notes(self) -> str:
        lines = []
        lines.append("## 📝 备注\n")

        if self.data.notes:
            lines.append(self.data.notes)
        else:
            lines.append("*(无备注信息)*")

        lines.append("\n\n---\n")
        lines.append("\n**本报告由 Media Guardian 自动生成**\n")
        lines.append(f"生成时间: {format_datetime(self.data.report_time)}\n")

        return "\n".join(lines)

    def generate(self) -> str:
        parts = []
        parts.append(self._generate_header())
        parts.append(self._generate_summary())
        parts.append(self._generate_card_details())
        parts.append(self._generate_issues())
        parts.append(self._generate_copy_progress())
        parts.append(self._generate_notes())
        return "\n".join(parts)


class CsvExporter:
    def __init__(self, report_data: ReportData) -> None:
        self.data = report_data

    def export_issues(self, path: Path) -> None:
        all_issues: list[ValidationIssue] = []

        if self.data.copy_plan:
            all_issues.extend(self.data.copy_plan.issues)

        if self.data.verification_issues:
            all_issues.extend(self.data.verification_issues)

        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow([
                "序号", "问题ID", "严重程度", "类别", "消息",
                "相关文件", "相关卡", "详情"
            ])

            for idx, issue in enumerate(all_issues, 1):
                writer.writerow([
                    idx,
                    issue.issue_id,
                    issue.severity.value,
                    issue.category,
                    issue.message,
                    issue.file_name or "",
                    issue.card_id or "",
                    json.dumps(issue.details, ensure_ascii=False) if issue.details else "",
                ])

    def export_file_list(self, path: Path) -> None:
        if not self.data.scan_result:
            return

        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow([
                "卡号", "文件ID", "文件名", "分类", "大小",
                "修改时间", "哈希值", "时长", "起始时间码",
                "拍摄日期", "已拷贝", "已验证"
            ])

            for file_info in self.data.scan_result.all_files:
                copied = False
                verified = False

                if self.data.manifest and file_info.file_id in self.data.manifest.copy_progress:
                    progress = self.data.manifest.copy_progress[file_info.file_id]
                    copied = progress.completed
                    verified = progress.verified and (progress.hash_matched or False)

                duration = ""
                if file_info.metadata and file_info.metadata.duration_seconds:
                    duration = format_duration(file_info.metadata.duration_seconds)

                timecode = ""
                if file_info.metadata:
                    timecode = file_info.metadata.start_timecode or ""

                shoot_date = file_info.shoot_date or ""

                writer.writerow([
                    file_info.card_id or "",
                    file_info.file_id,
                    file_info.file_name,
                    file_info.file_category,
                    file_info.file_size,
                    format_datetime(file_info.modification_time),
                    file_info.hash_value or "",
                    duration,
                    timecode,
                    shoot_date,
                    "是" if copied else "否",
                    "是" if verified else "否",
                ])

    def export_copy_progress(self, path: Path) -> None:
        if not self.data.manifest:
            return

        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow([
                "文件ID", "文件名", "源路径", "目标路径",
                "总大小", "已拷贝", "状态", "已验证", "哈希匹配",
                "开始时间", "完成时间", "错误信息"
            ])

            for file_id, progress in self.data.manifest.copy_progress.items():
                status = "已完成" if progress.completed else "进行中"
                if progress.error_message:
                    status = "失败"

                writer.writerow([
                    progress.file_id,
                    progress.file_name,
                    progress.source_path,
                    progress.target_path,
                    progress.file_size,
                    progress.bytes_copied,
                    status,
                    "是" if progress.verified else "否",
                    "是" if progress.hash_matched else ("否" if progress.hash_matched is not None else "N/A"),
                    format_datetime(progress.started_at),
                    format_datetime(progress.completed_at),
                    progress.error_message or "",
                ])


def generate_report(
    manifest: Manifest,
    copy_plan: CopyPlan | None = None,
    verification_issues: list[ValidationIssue] | None = None,
    copy_results: dict[str, Any] | None = None,
    notes: str = "",
) -> ReportData:
    scan_result = manifest.scan_result

    return ReportData(
        project_name=manifest.project_name,
        scan_result=scan_result,
        manifest=manifest,
        copy_plan=copy_plan,
        verification_issues=verification_issues or [],
        copy_results=copy_results or {},
        notes=notes,
    )


def export_markdown(report_data: ReportData, output_path: Path) -> None:
    reporter = MarkdownReporter(report_data)
    content = reporter.generate()
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)


def export_csv_files(report_data: ReportData, output_dir: Path, prefix: str = "") -> list[Path]:
    exporter = CsvExporter(report_data)
    exported: list[Path] = []

    prefix = prefix or report_data.project_name
    safe_prefix = "".join(c if c.isalnum() or c in "_-" else "_" for c in prefix)

    issues_path = output_dir / f"{safe_prefix}_issues.csv"
    exporter.export_issues(issues_path)
    exported.append(issues_path)

    files_path = output_dir / f"{safe_prefix}_file_list.csv"
    exporter.export_file_list(files_path)
    exported.append(files_path)

    if report_data.manifest and report_data.manifest.copy_progress:
        progress_path = output_dir / f"{safe_prefix}_copy_progress.csv"
        exporter.export_copy_progress(progress_path)
        exported.append(progress_path)

    return exported
