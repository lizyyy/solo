from dataclasses import dataclass, field
from datetime import timedelta
from enum import Enum, auto
from typing import List, Dict, Optional, Any
from pathlib import Path


class IssueType(Enum):
    OVERLAPPING_TIMELINE = auto()
    BROKEN_SEQUENCE = auto()
    LINE_TOO_LONG = auto()
    READING_SPEED_TOO_FAST = auto()
    SPEAKER_INCONSISTENT = auto()
    TERM_INCONSISTENT = auto()
    FORBIDDEN_WORD = auto()
    TIMECODE_ERROR = auto()
    EMPTY_SUBTITLE = auto()


class IssueSeverity(Enum):
    CRITICAL = auto()
    ERROR = auto()
    WARNING = auto()
    INFO = auto()


@dataclass
class SubtitleItem:
    index: int
    start_time: timedelta
    end_time: timedelta
    text: str
    original_index: int = 0
    
    @property
    def duration(self) -> timedelta:
        return self.end_time - self.start_time
    
    @property
    def duration_seconds(self) -> float:
        return self.duration.total_seconds()
    
    @property
    def text_length(self) -> int:
        return len(self.text.strip())
    
    @property
    def reading_speed(self) -> float:
        if self.duration_seconds <= 0:
            return float('inf')
        return self.text_length / self.duration_seconds * 60
    
    def overlaps_with(self, other: 'SubtitleItem') -> bool:
        return self.start_time < other.end_time and other.start_time < self.end_time


@dataclass
class Issue:
    type: IssueType
    severity: IssueSeverity
    message: str
    file_path: Optional[Path] = None
    subtitle_index: Optional[int] = None
    original_text: Optional[str] = None
    suggestion: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': self.type.name,
            'severity': self.severity.name,
            'message': self.message,
            'file_path': str(self.file_path) if self.file_path else None,
            'subtitle_index': self.subtitle_index,
            'original_text': self.original_text,
            'suggestion': self.suggestion,
            'context': self.context
        }


@dataclass
class SubtitleFile:
    path: Path
    format: str
    items: List[SubtitleItem] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    encoding: str = 'utf-8'
    
    @property
    def item_count(self) -> int:
        return len(self.items)
    
    @property
    def issue_count(self) -> int:
        return len(self.issues)
    
    @property
    def issue_by_type(self) -> Dict[IssueType, List[Issue]]:
        result: Dict[IssueType, List[Issue]] = {}
        for issue in self.issues:
            if issue.type not in result:
                result[issue.type] = []
            result[issue.type].append(issue)
        return result


@dataclass
class Speaker:
    name: str
    aliases: List[str] = field(default_factory=list)
    is_primary: bool = True
    
    def matches(self, text: str) -> bool:
        name_lower = self.name.lower()
        if name_lower in text.lower():
            return True
        for alias in self.aliases:
            if alias.lower() in text.lower():
                return True
        return False


@dataclass
class Term:
    correct: str
    alternatives: List[str] = field(default_factory=list)
    category: str = 'general'
    
    def matches(self, text: str) -> bool:
        correct_lower = self.correct.lower()
        if correct_lower in text.lower():
            return True
        for alt in self.alternatives:
            if alt.lower() in text.lower():
                return True
        return False


@dataclass
class ForbiddenWord:
    word: str
    category: str = 'general'
    suggestion: Optional[str] = None


@dataclass
class ProjectConfig:
    name: str
    speakers: List[Speaker] = field(default_factory=list)
    terms: List[Term] = field(default_factory=list)
    forbidden_words: List[ForbiddenWord] = field(default_factory=list)
    
    max_line_length: int = 40
    max_reading_speed: int = 180
    min_gap_between_subtitles: float = 0.05
    
    subtitle_dirs: List[Path] = field(default_factory=list)
    output_dir: Path = field(default_factory=lambda: Path('./output'))
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'speakers': [
                {
                    'name': s.name,
                    'aliases': s.aliases,
                    'is_primary': s.is_primary
                }
                for s in self.speakers
            ],
            'terms': [
                {
                    'correct': t.correct,
                    'alternatives': t.alternatives,
                    'category': t.category
                }
                for t in self.terms
            ],
            'forbidden_words': [
                {
                    'word': fw.word,
                    'category': fw.category,
                    'suggestion': fw.suggestion
                }
                for fw in self.forbidden_words
            ],
            'max_line_length': self.max_line_length,
            'max_reading_speed': self.max_reading_speed,
            'min_gap_between_subtitles': self.min_gap_between_subtitles,
            'subtitle_dirs': [str(p) for p in self.subtitle_dirs],
            'output_dir': str(self.output_dir)
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProjectConfig':
        config = cls(name=data.get('name', 'Untitled Project'))
        
        for speaker_data in data.get('speakers', []):
            config.speakers.append(Speaker(
                name=speaker_data['name'],
                aliases=speaker_data.get('aliases', []),
                is_primary=speaker_data.get('is_primary', True)
            ))
        
        for term_data in data.get('terms', []):
            config.terms.append(Term(
                correct=term_data['correct'],
                alternatives=term_data.get('alternatives', []),
                category=term_data.get('category', 'general')
            ))
        
        for fw_data in data.get('forbidden_words', []):
            config.forbidden_words.append(ForbiddenWord(
                word=fw_data['word'],
                category=fw_data.get('category', 'general'),
                suggestion=fw_data.get('suggestion')
            ))
        
        config.max_line_length = data.get('max_line_length', 40)
        config.max_reading_speed = data.get('max_reading_speed', 180)
        config.min_gap_between_subtitles = data.get('min_gap_between_subtitles', 0.05)
        config.subtitle_dirs = [Path(p) for p in data.get('subtitle_dirs', [])]
        config.output_dir = Path(data.get('output_dir', './output'))
        
        return config


@dataclass
class CheckResult:
    files: List[SubtitleFile] = field(default_factory=list)
    config_hash: str = ''
    checked_at: str = ''
    
    @property
    def total_files(self) -> int:
        return len(self.files)
    
    @property
    def total_issues(self) -> int:
        return sum(f.issue_count for f in self.files)
    
    @property
    def issues_by_type(self) -> Dict[IssueType, int]:
        result: Dict[IssueType, int] = {}
        for file in self.files:
            for issue in file.issues:
                if issue.type not in result:
                    result[issue.type] = 0
                result[issue.type] += 1
        return result
    
    @property
    def issues_by_severity(self) -> Dict[IssueSeverity, int]:
        result: Dict[IssueSeverity, int] = {}
        for file in self.files:
            for issue in file.issues:
                if issue.severity not in result:
                    result[issue.severity] = 0
                result[issue.severity] += 1
        return result
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'total_files': self.total_files,
            'total_issues': self.total_issues,
            'config_hash': self.config_hash,
            'checked_at': self.checked_at,
            'files': [
                {
                    'path': str(f.path),
                    'format': f.format,
                    'item_count': f.item_count,
                    'issue_count': f.issue_count,
                    'issues': [issue.to_dict() for issue in f.issues]
                }
                for f in self.files
            ],
            'issues_by_type': {k.name: v for k, v in self.issues_by_type.items()},
            'issues_by_severity': {k.name: v for k, v in self.issues_by_severity.items()}
        }
