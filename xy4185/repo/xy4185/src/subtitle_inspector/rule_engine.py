import csv
import re
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set, Callable

from .models import (
    Issue, IssueCategory, IssueSeverity, 
    SubtitleFile, SubtitleEntry, ProgramList, 
    ProgramItem, FontInfo, CheckResult
)
from .subtitle_parser import detect_encoding


BANNED_WORDS_ZH = [
    "违规词1", "违规词2", "敏感词",
]

BANNED_WORDS_EN = [
    "banned", "offensive",
]


class BaseRule:
    def __init__(self, name: str, category: IssueCategory, severity: IssueSeverity):
        self.name = name
        self.category = category
        self.severity = severity
    
    def check(self, *args, **kwargs) -> List[Issue]:
        raise NotImplementedError


class EncodingRule(BaseRule):
    def __init__(self):
        super().__init__("encoding_validation", IssueCategory.ENCODING, IssueSeverity.ERROR)
    
    def check(self, subtitle_file: SubtitleFile) -> List[Issue]:
        issues: List[Issue] = []
        
        valid_encodings = ["utf-8", "utf-8-sig", "gbk", "gb2312", "big5"]
        encoding_lower = subtitle_file.encoding.lower()
        
        if encoding_lower not in valid_encodings:
            issues.append(Issue(
                id=str(uuid.uuid4()),
                category=self.category,
                severity=IssueSeverity.WARNING,
                title="不推荐的文件编码",
                description=f"文件编码为 '{subtitle_file.encoding}'，推荐使用 UTF-8 编码",
                file=subtitle_file.path,
                suggested_fix="使用文本编辑器将文件另存为 UTF-8 编码"
            ))
        
        try:
            with open(subtitle_file.path, "rb") as f:
                raw = f.read()
            
            decoded = raw.decode(subtitle_file.encoding)
            if "�" in decoded:
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.ERROR,
                    title="编码解码错误",
                    description="文件中存在无法正确解码的字符，可能是编码检测错误",
                    file=subtitle_file.path,
                    suggested_fix="检查文件实际编码，可能需要手动指定"
                ))
        except Exception as e:
            issues.append(Issue(
                id=str(uuid.uuid4()),
                category=self.category,
                severity=IssueSeverity.ERROR,
                title="编码读取失败",
                description=f"使用检测到的编码 '{subtitle_file.encoding}' 读取文件失败: {e}",
                file=subtitle_file.path,
                suggested_fix="手动检查并转换文件编码"
            ))
        
        return issues


class TimelineOverlapRule(BaseRule):
    def __init__(self):
        super().__init__("timeline_overlap", IssueCategory.TIMELINE, IssueSeverity.ERROR)
    
    def check(self, subtitle_file: SubtitleFile) -> List[Issue]:
        issues: List[Issue] = []
        entries = subtitle_file.entries
        
        if len(entries) < 2:
            return issues
        
        for i in range(len(entries) - 1):
            current = entries[i]
            next_entry = entries[i + 1]
            
            if current.end_time > next_entry.start_time:
                overlap_duration = current.end_time - next_entry.start_time
                
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.ERROR,
                    title="时间轴重叠",
                    description=f"第 {current.index} 条字幕与第 {next_entry.index} 条字幕时间轴重叠，重叠时长: {overlap_duration}",
                    file=subtitle_file.path,
                    position=current.start_time,
                    context={
                        "entry1_index": current.index,
                        "entry1_start": str(current.start_time),
                        "entry1_end": str(current.end_time),
                        "entry2_index": next_entry.index,
                        "entry2_start": str(next_entry.start_time),
                        "overlap": str(overlap_duration)
                    },
                    suggested_fix=f"将第 {current.index} 条字幕的结束时间调整到 {next_entry.start_time} 之前"
                ))
        
        return issues


class TimelineGapRule(BaseRule):
    def __init__(self, min_gap_ms: int = 0, max_gap_ms: int = 5000):
        super().__init__("timeline_gap", IssueCategory.TIMELINE, IssueSeverity.WARNING)
        self.min_gap = timedelta(milliseconds=min_gap_ms)
        self.max_gap = timedelta(milliseconds=max_gap_ms)
    
    def check(self, subtitle_file: SubtitleFile) -> List[Issue]:
        issues: List[Issue] = []
        entries = subtitle_file.entries
        
        if len(entries) < 2:
            return issues
        
        for i in range(len(entries) - 1):
            current = entries[i]
            next_entry = entries[i + 1]
            
            gap = next_entry.start_time - current.end_time
            
            if gap > self.max_gap:
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.WARNING,
                    title="时间轴空洞过大",
                    description=f"第 {current.index} 条字幕与第 {next_entry.index} 条字幕之间存在 {gap} 的空隙，可能存在缺字幕",
                    file=subtitle_file.path,
                    position=current.end_time,
                    context={
                        "gap": str(gap),
                        "entry1_index": current.index,
                        "entry2_index": next_entry.index
                    },
                    suggested_fix="检查该时间段是否遗漏了字幕内容"
                ))
            
            if gap < self.min_gap and gap > timedelta(0):
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.INFO,
                    title="时间轴空隙过小",
                    description=f"第 {current.index} 条字幕与第 {next_entry.index} 条字幕之间仅间隔 {gap}，可能需要合并",
                    file=subtitle_file.path,
                    position=current.end_time,
                    context={"gap": str(gap)},
                    suggested_fix="考虑合并两条字幕或适当拉开间隔"
                ))
        
        return issues


class TimecodeBoundsRule(BaseRule):
    def __init__(self, max_time: timedelta = timedelta(hours=3)):
        super().__init__("timecode_bounds", IssueCategory.TIMELINE, IssueSeverity.CRITICAL)
        self.max_time = max_time
    
    def check(self, subtitle_file: SubtitleFile, program_list: Optional[ProgramList] = None) -> List[Issue]:
        issues: List[Issue] = []
        entries = subtitle_file.entries
        
        if not entries:
            return issues
        
        program_start = timedelta(0)
        program_end = self.max_time
        
        if program_list and program_list.items:
            program_start = program_list.items[0].start_timecode
            program_end = program_list.items[-1].end_timecode
        
        first_entry = entries[0]
        last_entry = entries[-1]
        
        if first_entry.start_time < program_start - timedelta(seconds=10):
            issues.append(Issue(
                id=str(uuid.uuid4()),
                category=self.category,
                severity=IssueSeverity.WARNING,
                title="字幕开始时间过早",
                description=f"第一条字幕开始于 {first_entry.start_time}，早于节目开始时间 {program_start}",
                file=subtitle_file.path,
                position=first_entry.start_time,
                suggested_fix="检查字幕时间轴是否需要偏移调整"
            ))
        
        if last_entry.end_time > program_end + timedelta(seconds=10):
            issues.append(Issue(
                id=str(uuid.uuid4()),
                category=self.category,
                severity=IssueSeverity.ERROR,
                title="字幕结束时间越界",
                description=f"最后一条字幕结束于 {last_entry.end_time}，晚于节目结束时间 {program_end}",
                file=subtitle_file.path,
                position=last_entry.end_time,
                suggested_fix="检查字幕时间轴或节目单是否正确"
            ))
        
        if last_entry.end_time > self.max_time:
            issues.append(Issue(
                id=str(uuid.uuid4()),
                category=self.category,
                severity=IssueSeverity.CRITICAL,
                title="时间码超出放映机范围",
                description=f"字幕时间码 {last_entry.end_time} 超出常规放映机范围 {self.max_time}",
                file=subtitle_file.path,
                position=last_entry.end_time,
                suggested_fix="检查字幕是否应用了错误的时间偏移"
            ))
        
        for entry in entries:
            if entry.start_time > entry.end_time:
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.ERROR,
                    title="时间码方向错误",
                    description=f"第 {entry.index} 条字幕: 开始时间 {entry.start_time} 晚于结束时间 {entry.end_time}",
                    file=subtitle_file.path,
                    position=entry.start_time,
                    suggested_fix="交换开始和结束时间"
                ))
            
            if entry.duration < timedelta(milliseconds=200):
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.WARNING,
                    title="字幕时长过短",
                    description=f"第 {entry.index} 条字幕时长仅 {entry.duration}，可能无法看清",
                    file=subtitle_file.path,
                    position=entry.start_time,
                    context={"duration": str(entry.duration)},
                    suggested_fix="考虑延长显示时间或合并相邻字幕"
                ))
        
        return issues


class ProgramConsistencyRule(BaseRule):
    def __init__(self):
        super().__init__("program_consistency", IssueCategory.CONSISTENCY, IssueSeverity.ERROR)
    
    def check(self, subtitle_file: SubtitleFile, program_list: Optional[ProgramList]) -> List[Issue]:
        issues: List[Issue] = []
        
        if not program_list or not program_list.items:
            issues.append(Issue(
                id=str(uuid.uuid4()),
                category=self.category,
                severity=IssueSeverity.WARNING,
                title="未找到节目单",
                description="未检测到有效的节目单 CSV 文件，无法进行幕次一致性检查",
                suggested_fix="确保字幕包中包含 program.csv 或类似的节目单文件"
            ))
            return issues
        
        entries = subtitle_file.entries
        if not entries:
            return issues
        
        for program_item in program_list.items:
            entries_in_scene = [
                e for e in entries
                if program_item.start_timecode <= e.start_time < program_item.end_timecode
            ]
            
            if not entries_in_scene:
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.ERROR,
                    title=f"幕次 '{program_item.scene_name}' 缺少字幕",
                    description=f"节目单中定义的幕次 '{program_item.scene_name}' ({program_item.start_timecode} - {program_item.end_timecode}) 没有找到对应的字幕",
                    file=subtitle_file.path,
                    position=program_item.start_timecode,
                    context={
                        "scene_number": program_item.scene_number,
                        "scene_name": program_item.scene_name,
                        "start_time": str(program_item.start_timecode),
                        "end_time": str(program_item.end_timecode)
                    },
                    suggested_fix="检查该幕次是否遗漏字幕，或时间轴是否需要调整"
                ))
        
        return issues


class FontMissingCharsRule(BaseRule):
    def __init__(self):
        super().__init__("font_missing_chars", IssueCategory.FONT, IssueSeverity.ERROR)
    
    def check(
        self, 
        subtitle_file: SubtitleFile, 
        font_files: List[FontInfo]
    ) -> List[Issue]:
        issues: List[Issue] = []
        
        if not font_files:
            issues.append(Issue(
                id=str(uuid.uuid4()),
                category=self.category,
                severity=IssueSeverity.WARNING,
                title="未找到字体文件",
                description="未检测到字体文件，无法进行缺字检测",
                file=subtitle_file.path,
                suggested_fix="将字体文件放入 fonts/ 目录"
            ))
            return issues
        
        all_text = "".join(e.text for e in subtitle_file.entries)
        
        for font in font_files:
            if font.missing_chars:
                missing_sample = font.missing_chars[:10]
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.ERROR,
                    title=f"字体 '{font.family}' 存在缺字",
                    description=f"字体 '{font.family}' 缺少 {len(font.missing_chars)} 个字符: {''.join(missing_sample)}...",
                    file=font.path,
                    context={
                        "font_family": font.family,
                        "font_style": font.style,
                        "missing_count": len(font.missing_chars),
                        "missing_chars": font.missing_chars[:20]
                    },
                    suggested_fix="使用支持这些字符的中文字体（如思源黑体、微软雅黑等）"
                ))
        
        return issues


class BannedWordsRule(BaseRule):
    def __init__(self, custom_banned: Optional[List[str]] = None):
        super().__init__("banned_words", IssueCategory.CONTENT, IssueSeverity.WARNING)
        self.banned_words = (BANNED_WORDS_ZH + BANNED_WORDS_EN)
        if custom_banned:
            self.banned_words.extend(custom_banned)
    
    def check(self, subtitle_file: SubtitleFile) -> List[Issue]:
        issues: List[Issue] = []
        
        for entry in subtitle_file.entries:
            text_lower = entry.text.lower()
            
            for word in self.banned_words:
                if word.lower() in text_lower:
                    issues.append(Issue(
                        id=str(uuid.uuid4()),
                        category=self.category,
                        severity=IssueSeverity.WARNING,
                        title="检测到禁用词",
                        description=f"第 {entry.index} 条字幕中包含禁用词: '{word}'",
                        file=subtitle_file.path,
                        position=entry.start_time,
                        context={
                            "entry_index": entry.index,
                            "banned_word": word,
                            "text": entry.text
                        },
                        suggested_fix=f"考虑替换 '{word}' 为合适的表达"
                    ))
        
        return issues


class BilingualAlignmentRule(BaseRule):
    def __init__(self, tolerance_ms: int = 500):
        super().__init__("bilingual_alignment", IssueCategory.SYNC, IssueSeverity.ERROR)
        self.tolerance = timedelta(milliseconds=tolerance_ms)
    
    def check(
        self, 
        subtitle_files: List[SubtitleFile]
    ) -> List[Issue]:
        issues: List[Issue] = []
        
        if len(subtitle_files) < 2:
            return issues
        
        by_language: Dict[str, SubtitleFile] = {}
        for sf in subtitle_files:
            if sf.language not in by_language:
                by_language[sf.language] = sf
        
        if len(by_language) < 2:
            return issues
        
        zh_file = by_language.get("zh-CN")
        en_file = by_language.get("en-US")
        
        if not zh_file or not en_file:
            return issues
        
        zh_entries = zh_file.entries
        en_entries = en_file.entries
        
        if len(zh_entries) != len(en_entries):
            issues.append(Issue(
                id=str(uuid.uuid4()),
                category=self.category,
                severity=IssueSeverity.ERROR,
                title="双语字幕数量不一致",
                description=f"中文字幕有 {len(zh_entries)} 条，英文字幕有 {len(en_entries)} 条",
                context={
                    "zh_count": len(zh_entries),
                    "en_count": len(en_entries)
                },
                suggested_fix="检查两种语言的字幕条数是否匹配"
            ))
        
        min_count = min(len(zh_entries), len(en_entries))
        for i in range(min_count):
            zh = zh_entries[i]
            en = en_entries[i]
            
            start_diff = abs(zh.start_time - en.start_time)
            end_diff = abs(zh.end_time - en.end_time)
            
            if start_diff > self.tolerance:
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.ERROR,
                    title=f"第 {i+1} 条字幕开始时间不同步",
                    description=f"中文开始于 {zh.start_time}，英文开始于 {en.start_time}，差异 {start_diff}",
                    position=zh.start_time,
                    context={
                        "index": i + 1,
                        "zh_start": str(zh.start_time),
                        "en_start": str(en.start_time),
                        "diff": str(start_diff)
                    },
                    suggested_fix="统一两条字幕的开始时间"
                ))
            
            if end_diff > self.tolerance:
                issues.append(Issue(
                    id=str(uuid.uuid4()),
                    category=self.category,
                    severity=IssueSeverity.WARNING,
                    title=f"第 {i+1} 条字幕结束时间不同步",
                    description=f"中文结束于 {zh.end_time}，英文结束于 {en.end_time}，差异 {end_diff}",
                    position=zh.end_time,
                    context={
                        "index": i + 1,
                        "zh_end": str(zh.end_time),
                        "en_end": str(en.end_time),
                        "diff": str(end_diff)
                    },
                    suggested_fix="检查是否需要统一结束时间"
                ))
        
        return issues


class RuleEngine:
    def __init__(self):
        self.rules: List[Tuple[BaseRule, Dict]] = []
    
    def register_rule(self, rule: BaseRule, **kwargs):
        self.rules.append((rule, kwargs))
    
    def run_checks(
        self,
        subtitle_files: List[SubtitleFile],
        program_list: Optional[ProgramList] = None,
        font_files: Optional[List[FontInfo]] = None,
        config: Optional[Dict] = None
    ) -> CheckResult:
        all_issues: List[Issue] = []
        config = config or {}
        
        for subtitle_file in subtitle_files:
            encoding_rule = EncodingRule()
            all_issues.extend(encoding_rule.check(subtitle_file))
            
            overlap_rule = TimelineOverlapRule()
            all_issues.extend(overlap_rule.check(subtitle_file))
            
            gap_config = config.get("timeline_gap", {})
            gap_rule = TimelineGapRule(
                min_gap_ms=gap_config.get("min_gap_ms", 0),
                max_gap_ms=gap_config.get("max_gap_ms", 5000)
            )
            all_issues.extend(gap_rule.check(subtitle_file))
            
            bounds_config = config.get("timecode_bounds", {})
            max_hours = bounds_config.get("max_hours", 3)
            bounds_rule = TimecodeBoundsRule(max_time=timedelta(hours=max_hours))
            all_issues.extend(bounds_rule.check(subtitle_file, program_list))
            
            if program_list:
                consistency_rule = ProgramConsistencyRule()
                all_issues.extend(consistency_rule.check(subtitle_file, program_list))
            
            if font_files:
                font_rule = FontMissingCharsRule()
                all_issues.extend(font_rule.check(subtitle_file, font_files))
            
            banned_config = config.get("banned_words", {})
            custom_banned = banned_config.get("custom", [])
            banned_rule = BannedWordsRule(custom_banned=custom_banned)
            all_issues.extend(banned_rule.check(subtitle_file))
        
        if len(subtitle_files) >= 2:
            alignment_config = config.get("bilingual_alignment", {})
            tolerance_ms = alignment_config.get("tolerance_ms", 500)
            alignment_rule = BilingualAlignmentRule(tolerance_ms=tolerance_ms)
            all_issues.extend(alignment_rule.check(subtitle_files))
        
        stats = self._calculate_stats(all_issues)
        
        return CheckResult(
            issues=all_issues,
            stats=stats,
            language_alignment=self._calculate_alignment_stats(subtitle_files)
        )
    
    def _calculate_stats(self, issues: List[Issue]) -> Dict[str, Any]:
        stats = {
            "total": len(issues),
            "by_severity": {},
            "by_category": {},
        }
        
        for sev in IssueSeverity:
            stats["by_severity"][sev.value] = sum(1 for i in issues if i.severity == sev)
        
        for cat in IssueCategory:
            stats["by_category"][cat.value] = sum(1 for i in issues if i.category == cat)
        
        return stats
    
    def _calculate_alignment_stats(self, subtitle_files: List[SubtitleFile]) -> Dict[str, Dict]:
        alignment: Dict[str, Dict] = {}
        
        for sf in subtitle_files:
            alignment[sf.language] = {
                "count": len(sf.entries),
                "file": str(sf.path),
                "format": sf.format
            }
        
        return alignment


def parse_program_csv(file_path: Path) -> Optional[ProgramList]:
    if not file_path.exists():
        return None
    
    encoding = detect_encoding(file_path)
    
    items: List[ProgramItem] = []
    
    try:
        with open(file_path, "r", encoding=encoding) as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                scene_num = row.get("scene", row.get("幕次", row.get("Scene", ""))).strip()
                scene_name = row.get("name", row.get("名称", row.get("Name", ""))).strip()
                
                start_str = row.get("start", row.get("开始时间", row.get("StartTime", ""))).strip()
                end_str = row.get("end", row.get("结束时间", row.get("EndTime", ""))).strip()
                
                try:
                    start_time = _parse_timecode(start_str)
                    end_time = _parse_timecode(end_str)
                except ValueError:
                    continue
                
                speaker = row.get("speaker", row.get("角色", row.get("Speaker", ""))).strip()
                notes = row.get("notes", row.get("备注", row.get("Notes", ""))).strip()
                
                items.append(ProgramItem(
                    scene_number=scene_num,
                    scene_name=scene_name,
                    start_timecode=start_time,
                    end_timecode=end_time,
                    speaker=speaker or None,
                    notes=notes or None
                ))
    except Exception as e:
        return None
    
    if not items:
        return None
    
    return ProgramList(
        path=file_path,
        items=items
    )


def _parse_timecode(time_str: str) -> timedelta:
    time_str = time_str.strip()
    
    time_str = time_str.replace(",", ".")
    
    if ";" in time_str:
        time_str = time_str.replace(";", ":")
    
    parts = time_str.split(":")
    
    if len(parts) == 3:
        h = int(parts[0])
        m = int(parts[1])
        s_parts = parts[2].split(".")
        s = int(s_parts[0])
        if len(s_parts) > 1:
            frac = s_parts[1].ljust(6, "0")[:6]
            ms = int(frac) / 1000
        else:
            ms = 0
        return timedelta(hours=h, minutes=m, seconds=s, milliseconds=ms)
    elif len(parts) == 2:
        m = int(parts[0])
        s_parts = parts[1].split(".")
        s = int(s_parts[0])
        if len(s_parts) > 1:
            frac = s_parts[1].ljust(6, "0")[:6]
            ms = int(frac) / 1000
        else:
            ms = 0
        return timedelta(minutes=m, seconds=s, milliseconds=ms)
    else:
        raise ValueError(f"Invalid timecode format: {time_str}")
