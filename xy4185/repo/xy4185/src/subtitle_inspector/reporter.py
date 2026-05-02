import csv
import json
from dataclasses import asdict, is_dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import (
    Report, ScanResult, CheckResult, FixPlan,
    Issue, IssueCategory, IssueSeverity,
    SubtitleFile, ProgramList, FontInfo
)


def json_default(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, timedelta):
        return str(obj)
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, (IssueCategory, IssueSeverity)):
        return obj.value
    if is_dataclass(obj):
        return asdict(obj)
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    return str(obj)


class MarkdownReporter:
    def __init__(self, report: Report):
        self.report = report
    
    def generate(self) -> str:
        lines = []
        
        lines.append("# 演出字幕包巡检报告")
        lines.append("")
        lines.append(f"> 生成时间: {self.report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 📊 概览")
        lines.append("")
        lines.append(self._generate_summary_table())
        lines.append("")
        
        lines.append("## 🔍 问题详情")
        lines.append("")
        lines.append(self._generate_issues_detail())
        lines.append("")
        
        lines.append("## 📁 扫描结果")
        lines.append("")
        lines.append(self._generate_scan_detail())
        lines.append("")
        
        if self.report.fix_plan and self.report.fix_plan.suggestions:
            lines.append("## 🔧 修补建议")
            lines.append("")
            lines.append(self._generate_fix_detail())
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由「演出字幕包巡检员」自动生成*")
        
        return "\n".join(lines)
    
    def _generate_summary_table(self) -> str:
        check_result = self.report.check_result
        stats = check_result.stats
        
        lines = []
        lines.append("| 严重程度 | 数量 |")
        lines.append("|---------|------|")
        
        severity_order = [
            (IssueSeverity.CRITICAL, "🔴 严重"),
            (IssueSeverity.ERROR, "🟠 错误"),
            (IssueSeverity.WARNING, "🟡 警告"),
            (IssueSeverity.INFO, "🔵 信息"),
        ]
        
        for sev, label in severity_order:
            count = stats["by_severity"].get(sev.value, 0)
            lines.append(f"| {label} | {count} |")
        
        lines.append("")
        lines.append(f"**总计: {stats['total']} 个问题**")
        
        return "\n".join(lines)
    
    def _generate_issues_detail(self) -> str:
        lines = []
        issues = self.report.check_result.issues
        
        if not issues:
            return "✅ 未检测到任何问题！"
        
        by_severity: Dict[IssueSeverity, List[Issue]] = {}
        for issue in issues:
            if issue.severity not in by_severity:
                by_severity[issue.severity] = []
            by_severity[issue.severity].append(issue)
        
        severity_order = [
            (IssueSeverity.CRITICAL, "### 🔴 严重问题"),
            (IssueSeverity.ERROR, "### 🟠 错误问题"),
            (IssueSeverity.WARNING, "### 🟡 警告问题"),
            (IssueSeverity.INFO, "### 🔵 信息提示"),
        ]
        
        for sev, header in severity_order:
            sev_issues = by_severity.get(sev, [])
            if sev_issues:
                lines.append(header)
                lines.append("")
                
                for i, issue in enumerate(sev_issues, 1):
                    lines.append(f"**{i}. {issue.title}**")
                    lines.append(f"- 类别: {issue.category.value}")
                    lines.append(f"- 文件: `{issue.file}`" if issue.file else "")
                    if issue.position:
                        lines.append(f"- 时间位置: {issue.position}")
                    lines.append(f"- 描述: {issue.description}")
                    if issue.suggested_fix:
                        lines.append(f"- 💡 建议: {issue.suggested_fix}")
                    lines.append("")
        
        return "\n".join(lines)
    
    def _generate_scan_detail(self) -> str:
        lines = []
        scan = self.report.scan_result
        
        lines.append("#### 字幕文件")
        lines.append("")
        if scan.subtitle_files:
            for sf in scan.subtitle_files:
                lines.append(f"- **{sf.path.name}**")
                lines.append(f"  - 格式: {sf.format.upper()}")
                lines.append(f"  - 编码: {sf.encoding}")
                lines.append(f"  - 语言: {sf.language}")
                lines.append(f"  - 条数: {len(sf.entries)}")
                if sf.entries:
                    lines.append(f"  - 时间范围: {sf.entries[0].start_time} ~ {sf.entries[-1].end_time}")
                lines.append("")
        else:
            lines.append("- 未检测到字幕文件")
            lines.append("")
        
        lines.append("#### 节目单")
        lines.append("")
        if scan.program_list:
            lines.append(f"- 文件: `{scan.program_list.path.name}`")
            lines.append(f"- 幕次数量: {len(scan.program_list.items)}")
            if scan.program_list.items:
                lines.append(f"- 时间范围: {scan.program_list.items[0].start_timecode} ~ {scan.program_list.items[-1].end_timecode}")
                lines.append("")
                lines.append("| 幕次 | 名称 | 开始时间 | 结束时间 |")
                lines.append("|-----|------|---------|---------|")
                for item in scan.program_list.items[:10]:
                    lines.append(f"| {item.scene_number} | {item.scene_name} | {item.start_timecode} | {item.end_timecode} |")
                if len(scan.program_list.items) > 10:
                    lines.append(f"| ... | 共 {len(scan.program_list.items)} 个幕次 | ... | ... |")
            lines.append("")
        else:
            lines.append("- 未检测到节目单")
            lines.append("")
        
        lines.append("#### 字体文件")
        lines.append("")
        if scan.font_files:
            for font in scan.font_files:
                lines.append(f"- **{font.path.name}**")
                lines.append(f"  - 字族: {font.family}")
                lines.append(f"  - 样式: {font.style}")
                lines.append(f"  - 字重: {font.weight}")
                if font.missing_chars:
                    lines.append(f"  - ⚠️  缺字: {len(font.missing_chars)} 个")
                    if len(font.missing_chars) > 0:
                        sample = "".join(font.missing_chars[:10])
                        lines.append(f"    示例: {sample}...")
                lines.append("")
        else:
            lines.append("- 未检测到字体文件")
            lines.append("")
        
        return "\n".join(lines)
    
    def _generate_fix_detail(self) -> str:
        lines = []
        fix_plan = self.report.fix_plan
        
        if not fix_plan or not fix_plan.suggestions:
            return "无可用的修补建议"
        
        lines.append(f"共 {len(fix_plan.suggestions)} 条修补建议:")
        lines.append("")
        
        for i, suggestion in enumerate(fix_plan.suggestions, 1):
            lines.append(f"**{i}. {suggestion.description}**")
            if suggestion.file:
                lines.append(f"- 文件: `{suggestion.file}`")
            if "action" in suggestion.suggestion:
                action = suggestion.suggestion["action"]
                lines.append(f"- 操作: {action}")
            lines.append("")
        
        return "\n".join(lines)


class CSVReporter:
    def __init__(self, report: Report):
        self.report = report
    
    def generate(self, output_path: Path):
        check_result = self.report.check_result
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "序号", "严重程度", "类别", "标题", "描述",
                "文件", "时间位置", "建议修复"
            ])
            
            for i, issue in enumerate(check_result.issues, 1):
                writer.writerow([
                    i,
                    issue.severity.value,
                    issue.category.value,
                    issue.title,
                    issue.description,
                    str(issue.file) if issue.file else "",
                    str(issue.position) if issue.position else "",
                    issue.suggested_fix or ""
                ])


class JSONReporter:
    def __init__(self, report: Report):
        self.report = report
    
    def generate(self, output_path: Path):
        report_dict = self._to_dict(self.report)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_dict, f, ensure_ascii=False, indent=2, default=json_default)
    
    def _to_dict(self, report: Report) -> Dict[str, Any]:
        scan = report.scan_result
        check = report.check_result
        fix = report.fix_plan
        
        return {
            "generated_at": report.generated_at.isoformat(),
            "version": "1.0.0",
            "scan_result": {
                "subtitle_files": [
                    {
                        "path": str(sf.path),
                        "format": sf.format,
                        "encoding": sf.encoding,
                        "language": sf.language,
                        "entry_count": len(sf.entries),
                        "time_range": {
                            "start": str(sf.entries[0].start_time) if sf.entries else None,
                            "end": str(sf.entries[-1].end_time) if sf.entries else None
                        } if sf.entries else None
                    }
                    for sf in scan.subtitle_files
                ],
                "program_list": {
                    "path": str(scan.program_list.path) if scan.program_list else None,
                    "item_count": len(scan.program_list.items) if scan.program_list else 0,
                    "items": [
                        {
                            "scene_number": item.scene_number,
                            "scene_name": item.scene_name,
                            "start_timecode": str(item.start_timecode),
                            "end_timecode": str(item.end_timecode),
                            "speaker": item.speaker
                        }
                        for item in (scan.program_list.items if scan.program_list else [])
                    ]
                } if scan.program_list else None,
                "font_files": [
                    {
                        "path": str(font.path),
                        "family": font.family,
                        "style": font.style,
                        "weight": font.weight,
                        "missing_chars_count": len(font.missing_chars),
                        "missing_chars_sample": font.missing_chars[:20]
                    }
                    for font in scan.font_files
                ]
            },
            "check_result": {
                "stats": check.stats,
                "issues": [
                    {
                        "id": issue.id,
                        "severity": issue.severity.value,
                        "category": issue.category.value,
                        "title": issue.title,
                        "description": issue.description,
                        "file": str(issue.file) if issue.file else None,
                        "position": str(issue.position) if issue.position else None,
                        "context": issue.context,
                        "suggested_fix": issue.suggested_fix
                    }
                    for issue in check.issues
                ],
                "language_alignment": check.language_alignment
            },
            "fix_plan": {
                "summary": fix.summary if fix else None,
                "suggestions": [
                    {
                        "issue_id": s.issue_id,
                        "file": str(s.file) if s.file else None,
                        "description": s.description,
                        "suggestion": s.suggestion
                    }
                    for s in (fix.suggestions if fix else [])
                ]
            } if fix else None
        }


def generate_reports(
    report: Report,
    output_dir: Path,
    base_name: str = "subtitle_inspection"
) -> Dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    
    outputs: Dict[str, Path] = {}
    
    md_path = output_dir / f"{base_name}.md"
    md_reporter = MarkdownReporter(report)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_reporter.generate())
    outputs["markdown"] = md_path
    
    csv_path = output_dir / f"{base_name}_issues.csv"
    csv_reporter = CSVReporter(report)
    csv_reporter.generate(csv_path)
    outputs["csv"] = csv_path
    
    json_path = output_dir / f"{base_name}_audit.json"
    json_reporter = JSONReporter(report)
    json_reporter.generate(json_path)
    outputs["json"] = json_path
    
    return outputs
