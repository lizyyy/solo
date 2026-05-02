import json
import shutil
import tempfile
from dataclasses import asdict
from datetime import timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from .models import (
    Issue, IssueCategory, IssueSeverity,
    SubtitleFile, SubtitleEntry, FixPlan, FixSuggestion,
    CheckResult, ScanResult
)


def format_timedelta_srt(td: timedelta) -> str:
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    milliseconds = td.microseconds // 1000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


def format_timedelta_ass(td: timedelta) -> str:
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    centiseconds = td.microseconds // 10000
    return f"{hours}:{minutes:02d}:{seconds:02d}.{centiseconds:02d}"


class FixPlanner:
    def __init__(self, scan_result: ScanResult, check_result: CheckResult):
        self.scan_result = scan_result
        self.check_result = check_result
        self.temp_dir: Optional[Path] = None
    
    def create_fix_plan(self) -> FixPlan:
        suggestions: List[FixSuggestion] = []
        
        for issue in self.check_result.issues:
            suggestion = self._generate_suggestion(issue)
            if suggestion:
                suggestions.append(suggestion)
        
        summary = {
            "total_issues": len(self.check_result.issues),
            "fixable_issues": len(suggestions),
            "by_category": self._group_by_category(suggestions),
            "by_severity": self._group_by_severity(suggestions)
        }
        
        return FixPlan(
            suggestions=suggestions,
            temp_dir=self.temp_dir,
            summary=summary
        )
    
    def _generate_suggestion(self, issue: Issue) -> Optional[FixSuggestion]:
        if issue.category == IssueCategory.TIMELINE:
            return self._suggest_timeline_fix(issue)
        elif issue.category == IssueCategory.SYNC:
            return self._suggest_sync_fix(issue)
        elif issue.category == IssueCategory.ENCODING:
            return self._suggest_encoding_fix(issue)
        elif issue.category == IssueCategory.CONTENT:
            return self._suggest_content_fix(issue)
        
        return FixSuggestion(
            issue_id=issue.id,
            original={
                "title": issue.title,
                "description": issue.description
            },
            suggestion={
                "action": "review_manually",
                "reason": "此问题需要人工审核",
                "recommendation": issue.suggested_fix
            },
            file=issue.file,
            description=issue.suggested_fix or "需要人工审核"
        )
    
    def _suggest_timeline_fix(self, issue: Issue) -> Optional[FixSuggestion]:
        context = issue.context
        
        if "重叠" in issue.title:
            entry1_idx = context.get("entry1_index")
            entry2_idx = context.get("entry2_index")
            entry1_end = context.get("entry1_end")
            entry2_start = context.get("entry2_start")
            
            return FixSuggestion(
                issue_id=issue.id,
                original={
                    "entry": entry1_idx,
                    "end_time": entry1_end,
                    "conflict": f"与第 {entry2_idx} 条重叠"
                },
                suggestion={
                    "action": "adjust_end_time",
                    "current_end": entry1_end,
                    "suggested_end": entry2_start,
                    "note": f"将第 {entry1_idx} 条结束时间调整到第 {entry2_idx} 条开始之前"
                },
                file=issue.file,
                description=f"调整时间轴重叠: 第 {entry1_idx} 条结束时间改为 {entry2_start}"
            )
        
        if "空洞" in issue.title:
            entry1_idx = context.get("entry1_index")
            entry2_idx = context.get("entry2_index")
            gap = context.get("gap")
            
            return FixSuggestion(
                issue_id=issue.id,
                original={
                    "between_entries": (entry1_idx, entry2_idx),
                    "gap_duration": gap
                },
                suggestion={
                    "action": "review_gap",
                    "options": [
                        "1. 检查是否遗漏字幕",
                        "2. 延长前一条字幕",
                        "3. 提前后一条字幕"
                    ]
                },
                file=issue.file,
                description=f"时间轴空洞 {gap} 需要检查是否缺字幕"
            )
        
        if "越界" in issue.title or "超出" in issue.title:
            return FixSuggestion(
                issue_id=issue.id,
                original={"issue": issue.description},
                suggestion={
                    "action": "check_timecode_offset",
                    "recommendation": "检查字幕是否应用了错误的时间偏移"
                },
                file=issue.file,
                description=issue.suggested_fix or "检查时间码设置"
            )
        
        return None
    
    def _suggest_sync_fix(self, issue: Issue) -> Optional[FixSuggestion]:
        context = issue.context
        idx = context.get("index")
        diff = context.get("diff")
        
        if "开始时间" in issue.title:
            zh_start = context.get("zh_start")
            en_start = context.get("en_start")
            
            return FixSuggestion(
                issue_id=issue.id,
                original={
                    "entry": idx,
                    "zh_start": zh_start,
                    "en_start": en_start,
                    "difference": diff
                },
                suggestion={
                    "action": "align_start_time",
                    "recommendation": f"统一使用 {zh_start} 或 {en_start}",
                    "preferred": "建议以中文时间为准"
                },
                file=issue.file,
                description=f"第 {idx} 条字幕: 统一开始时间 (差异 {diff})"
            )
        
        if "结束时间" in issue.title:
            zh_end = context.get("zh_end")
            en_end = context.get("en_end")
            
            return FixSuggestion(
                issue_id=issue.id,
                original={
                    "entry": idx,
                    "zh_end": zh_end,
                    "en_end": en_end,
                    "difference": diff
                },
                suggestion={
                    "action": "align_end_time",
                    "recommendation": "建议以较长的时长为准"
                },
                file=issue.file,
                description=f"第 {idx} 条字幕: 统一结束时间 (差异 {diff})"
            )
        
        if "数量不一致" in issue.title:
            zh_count = context.get("zh_count")
            en_count = context.get("en_count")
            
            return FixSuggestion(
                issue_id=issue.id,
                original={
                    "chinese_count": zh_count,
                    "english_count": en_count
                },
                suggestion={
                    "action": "review_alignment",
                    "options": [
                        "1. 检查是否有遗漏的翻译",
                        "2. 检查是否有合并/拆分的字幕",
                        "3. 确认时间轴对应关系"
                    ]
                },
                file=issue.file,
                description=f"字幕数量不匹配: 中文 {zh_count} 条 vs 英文 {en_count} 条"
            )
        
        return None
    
    def _suggest_encoding_fix(self, issue: Issue) -> Optional[FixSuggestion]:
        return FixSuggestion(
            issue_id=issue.id,
            original={"description": issue.description},
            suggestion={
                "action": "convert_encoding",
                "target_encoding": "UTF-8",
                "how_to": "使用文本编辑器(如VS Code、Notepad++)另存为UTF-8编码"
            },
            file=issue.file,
            description=issue.suggested_fix or "转换为 UTF-8 编码"
        )
    
    def _suggest_content_fix(self, issue: Issue) -> Optional[FixSuggestion]:
        context = issue.context
        banned_word = context.get("banned_word")
        text = context.get("text")
        
        return FixSuggestion(
            issue_id=issue.id,
            original={
                "entry": context.get("entry_index"),
                "banned_word": banned_word,
                "full_text": text
            },
            suggestion={
                "action": "replace_word",
                "original": banned_word,
                "alternatives": ["[建议替换词]", "[需审核确认]"]
            },
            file=issue.file,
            description=f"替换禁用词 '{banned_word}'"
        )
    
    def _group_by_category(self, suggestions: List[FixSuggestion]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for issue in self.check_result.issues:
            cat = issue.category.value
            counts[cat] = counts.get(cat, 0) + 1
        return counts
    
    def _group_by_severity(self, suggestions: List[FixSuggestion]) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for issue in self.check_result.issues:
            sev = issue.severity.value
            counts[sev] = counts.get(sev, 0) + 1
        return counts


class FixGenerator:
    def __init__(self, source_dir: Path):
        self.source_dir = source_dir
        self.temp_base = Path(tempfile.mkdtemp(prefix="subtitle_fix_"))
    
    def generate_fixed_files(self, fix_plan: FixPlan) -> Path:
        work_dir = self.temp_base / "fixed_subtitles"
        work_dir.mkdir(parents=True, exist_ok=True)
        
        for item in self.source_dir.rglob("*"):
            if item.is_file():
                rel_path = item.relative_to(self.source_dir)
                dest = work_dir / rel_path
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, dest)
        
        self._apply_fixes(work_dir, fix_plan)
        
        self._create_manifest(work_dir, fix_plan)
        
        return work_dir
    
    def _apply_fixes(self, work_dir: Path, fix_plan: FixPlan):
        pass
    
    def _create_manifest(self, work_dir: Path, fix_plan: FixPlan):
        manifest = {
            "generated_at": str(fix_plan.summary),
            "fixes_applied": len(fix_plan.suggestions),
            "suggestions": [
                {
                    "issue_id": s.issue_id,
                    "file": str(s.file) if s.file else None,
                    "description": s.description,
                    "suggestion": s.suggestion
                }
                for s in fix_plan.suggestions
            ]
        }
        
        manifest_path = work_dir / "FIX_MANIFEST.json"
        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)


def create_fix_plan(
    scan_result: ScanResult,
    check_result: CheckResult
) -> FixPlan:
    planner = FixPlanner(scan_result, check_result)
    return planner.create_fix_plan()
