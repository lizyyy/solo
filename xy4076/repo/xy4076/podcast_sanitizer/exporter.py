import csv
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
from pathlib import Path

from .models import (
    Subtitle, Chapter, SensitiveRule, ScanIssue, IssueType,
    SanitizedSubtitle, MaskMapping, ClipSegment, ProjectState
)
from .subtitle_parser import format_srt_time, format_vtt_time


def format_timedelta(td: timedelta) -> str:
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    milliseconds = int(td.microseconds / 1000)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"
    return f"{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


def generate_markdown_report(state: ProjectState, title: str = "播客字幕审核报告") -> str:
    lines = []

    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    lines.append("---")
    lines.append("")

    lines.append("## 一、项目概览")
    lines.append("")
    lines.append(f"- 字幕总数: {len(state.subtitles)} 条")
    lines.append(f"- 章节总数: {len(state.chapters)} 个")
    lines.append(f"- 敏感规则: {len(state.rules)} 条")
    lines.append(f"- 检测到问题: {len(state.issues)} 个")
    lines.append(f"- 脱敏字幕: {len([s for s in state.sanitized_subtitles if s.has_sensitive])} 条")
    lines.append("")

    lines.append("## 二、问题统计")
    lines.append("")

    issue_counts = {
        "重叠字幕": 0,
        "断句过长": 0,
        "敏感词命中": 0,
        "章节外片段": 0
    }

    for issue in state.issues:
        if issue.issue_type == IssueType.OVERLAP:
            issue_counts["重叠字幕"] += 1
        elif issue.issue_type == IssueType.LONG_SENTENCE:
            issue_counts["断句过长"] += 1
        elif issue.issue_type == IssueType.SENSITIVE_WORD:
            issue_counts["敏感词命中"] += 1
        elif issue.issue_type == IssueType.OUT_OF_CHAPTER:
            issue_counts["章节外片段"] += 1

    lines.append("| 问题类型 | 数量 |")
    lines.append("|---------|------|")
    for issue_type, count in issue_counts.items():
        lines.append(f"| {issue_type} | {count} |")
    lines.append("")

    lines.append("## 三、问题详情")
    lines.append("")

    if state.issues:
        for issue in state.issues:
            issue_type_name = {
                IssueType.OVERLAP: "重叠字幕",
                IssueType.LONG_SENTENCE: "断句过长",
                IssueType.SENSITIVE_WORD: "敏感词命中",
                IssueType.OUT_OF_CHAPTER: "章节外片段"
            }.get(issue.issue_type, "未知")

            severity_icon = {
                "high": "🔴",
                "medium": "🟡",
                "low": "🟢"
            }.get(issue.severity, "⚪")

            lines.append(f"### {severity_icon} 问题 #{issue.id} - {issue_type_name}")
            lines.append("")
            lines.append(f"- **严重程度**: {issue.severity}")
            lines.append(f"- **相关字幕**: #{issue.subtitle_id}")
            lines.append(f"- **时间范围**: {format_timedelta(issue.start_time)} - {format_timedelta(issue.end_time)}")
            lines.append(f"- **描述**: {issue.description}")

            if issue.related_subtitle_ids:
                lines.append(f"- **关联字幕**: {', '.join([f'#{id}' for id in issue.related_subtitle_ids])}")

            if issue.sensitive_match:
                lines.append(f"- **敏感内容**: `{issue.sensitive_match}`")

            lines.append("")
    else:
        lines.append("*未检测到任何问题*")
        lines.append("")

    if state.mask_mappings:
        lines.append("## 四、脱敏映射")
        lines.append("")
        lines.append("| 原始文本 | 掩码值 | 类别 | 字幕ID |")
        lines.append("|---------|-------|------|-------|")
        for mapping in state.mask_mappings:
            lines.append(f"| `{mapping.original_text}` | `{mapping.masked_text}` | {mapping.category} | #{mapping.subtitle_id} |")
        lines.append("")

    if state.clip_segments:
        lines.append("## 五、切片清单")
        lines.append("")
        lines.append("| 切片ID | 标题 | 时间范围 | 包含字幕 | 含敏感内容 |")
        lines.append("|-------|------|---------|---------|-----------|")
        for segment in state.clip_segments:
            sensitive_flag = "是" if segment.has_sensitive else "否"
            subtitle_ids = ", ".join([f'#{id}' for id in segment.subtitle_ids])
            lines.append(f"| {segment.id} | {segment.title} | {format_timedelta(segment.start_time)} - {format_timedelta(segment.end_time)} | {subtitle_ids} | {sensitive_flag} |")
        lines.append("")

    lines.append("## 六、附录")
    lines.append("")

    lines.append("### 敏感规则配置")
    lines.append("")
    lines.append("| 规则ID | 模式 | 类别 | 描述 |")
    lines.append("|-------|------|------|------|")
    for rule in state.rules:
        lines.append(f"| {rule.id} | `{rule.pattern}` | {rule.category} | {rule.description} |")
    lines.append("")

    lines.append("### 章节列表")
    lines.append("")
    lines.append("| 章节ID | 标题 | 开始时间 | 结束时间 |")
    lines.append("|-------|------|---------|---------|")
    for chapter in state.chapters:
        end_time = format_timedelta(chapter.end_time) if chapter.end_time else "未指定"
        lines.append(f"| {chapter.id} | {chapter.title} | {format_timedelta(chapter.start_time)} | {end_time} |")
    lines.append("")

    return "\n".join(lines)


def generate_clip_csv(segments: List[ClipSegment]) -> str:
    import io
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "切片ID", "标题", "开始时间", "结束时间", "持续时间(秒)",
        "包含字幕ID", "含敏感内容", "章节ID", "章节标题"
    ])

    for segment in segments:
        duration = (segment.end_time - segment.start_time).total_seconds()
        subtitle_ids = ";".join([str(id) for id in segment.subtitle_ids])
        has_sensitive = "是" if segment.has_sensitive else "否"

        writer.writerow([
            segment.id,
            segment.title,
            format_timedelta(segment.start_time),
            format_timedelta(segment.end_time),
            f"{duration:.2f}",
            subtitle_ids,
            has_sensitive,
            segment.chapter_id or "",
            segment.chapter_title or ""
        ])

    return output.getvalue()


def generate_timeline_json(state: ProjectState) -> str:
    timeline_data = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "subtitle_count": len(state.subtitles),
            "chapter_count": len(state.chapters),
            "issue_count": len(state.issues),
            "sanitized_count": len([s for s in state.sanitized_subtitles if s.has_sensitive])
        },
        "chapters": [],
        "subtitles": [],
        "issues": [],
        "sanitized_subtitles": [],
        "clip_segments": []
    }

    for chapter in state.chapters:
        timeline_data["chapters"].append({
            "id": chapter.id,
            "title": chapter.title,
            "start_seconds": chapter.start_time.total_seconds(),
            "end_seconds": chapter.end_time.total_seconds() if chapter.end_time else None,
            "start_time": format_timedelta(chapter.start_time),
            "end_time": format_timedelta(chapter.end_time) if chapter.end_time else None
        })

    for subtitle in state.subtitles:
        timeline_data["subtitles"].append({
            "id": subtitle.id,
            "start_seconds": subtitle.start_time.total_seconds(),
            "end_seconds": subtitle.end_time.total_seconds(),
            "start_time": format_timedelta(subtitle.start_time),
            "end_time": format_timedelta(subtitle.end_time),
            "duration_seconds": subtitle.duration.total_seconds(),
            "text": subtitle.text
        })

    for issue in state.issues:
        timeline_data["issues"].append({
            "id": issue.id,
            "type": issue.issue_type.value,
            "subtitle_id": issue.subtitle_id,
            "start_seconds": issue.start_time.total_seconds(),
            "end_seconds": issue.end_time.total_seconds(),
            "severity": issue.severity,
            "description": issue.description,
            "sensitive_match": issue.sensitive_match
        })

    for sanitized in state.sanitized_subtitles:
        timeline_data["sanitized_subtitles"].append({
            "id": sanitized.id,
            "start_seconds": sanitized.start_time.total_seconds(),
            "end_seconds": sanitized.end_time.total_seconds(),
            "original_text": sanitized.original_text,
            "masked_text": sanitized.masked_text,
            "has_sensitive": sanitized.has_sensitive,
            "mask_mappings": [
                {
                    "original": m.original_text,
                    "masked": m.masked_text,
                    "category": m.category
                }
                for m in sanitized.mask_mappings
            ]
        })

    for segment in state.clip_segments:
        timeline_data["clip_segments"].append({
            "id": segment.id,
            "title": segment.title,
            "start_seconds": segment.start_time.total_seconds(),
            "end_seconds": segment.end_time.total_seconds(),
            "duration_seconds": (segment.end_time - segment.start_time).total_seconds(),
            "subtitle_ids": segment.subtitle_ids,
            "has_sensitive": segment.has_sensitive,
            "chapter_id": segment.chapter_id,
            "chapter_title": segment.chapter_title
        })

    return json.dumps(timeline_data, ensure_ascii=False, indent=2)


def generate_sanitized_srt(subtitles: List[SanitizedSubtitle]) -> str:
    lines = []
    for sub in subtitles:
        lines.append(str(sub.id))
        lines.append(f"{format_srt_time(sub.start_time)} --> {format_srt_time(sub.end_time)}")
        lines.append(sub.masked_text)
        lines.append("")
    return "\n".join(lines)


def generate_sanitized_vtt(subtitles: List[SanitizedSubtitle]) -> str:
    lines = ["WEBVTT", ""]
    for sub in subtitles:
        lines.append(f"{format_vtt_time(sub.start_time)} --> {format_vtt_time(sub.end_time)}")
        lines.append(sub.masked_text)
        lines.append("")
    return "\n".join(lines)


def export_report(state: ProjectState, output_path: str, title: str = "播客字幕审核报告"):
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = generate_markdown_report(state, title)
    path.write_text(content, encoding="utf-8")


def export_clip_csv(segments: List[ClipSegment], output_path: str):
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = generate_clip_csv(segments)
    path.write_text(content, encoding="utf-8")


def export_timeline_json(state: ProjectState, output_path: str):
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    content = generate_timeline_json(state)
    path.write_text(content, encoding="utf-8")


def export_sanitized_subtitles(subtitles: List[SanitizedSubtitle], output_path: str, format: str = "srt"):
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if format.lower() == "srt":
        content = generate_sanitized_srt(subtitles)
    elif format.lower() == "vtt":
        content = generate_sanitized_vtt(subtitles)
    else:
        raise ValueError(f"Unsupported format: {format}")

    path.write_text(content, encoding="utf-8")
