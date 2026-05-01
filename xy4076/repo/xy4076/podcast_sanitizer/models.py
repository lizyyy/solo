from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import timedelta
from enum import Enum


class IssueType(Enum):
    OVERLAP = "overlap"
    LONG_SENTENCE = "long_sentence"
    SENSITIVE_WORD = "sensitive_word"
    OUT_OF_CHAPTER = "out_of_chapter"


@dataclass
class Subtitle:
    id: int
    start_time: timedelta
    end_time: timedelta
    text: str
    original_id: Optional[int] = None

    @property
    def duration(self) -> timedelta:
        return self.end_time - self.start_time

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "start_time": str(self.start_time),
            "end_time": str(self.end_time),
            "text": self.text,
            "duration_seconds": self.duration.total_seconds(),
        }


@dataclass
class Chapter:
    id: int
    title: str
    start_time: timedelta
    end_time: Optional[timedelta] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "start_time": str(self.start_time),
            "end_time": str(self.end_time) if self.end_time else None,
        }


@dataclass
class SensitiveRule:
    id: int
    pattern: str
    category: str
    description: str
    mask_template: str = "[{category}_{{index}}]"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "pattern": self.pattern,
            "category": self.category,
            "description": self.description,
            "mask_template": self.mask_template,
        }


@dataclass
class ScanIssue:
    id: int
    issue_type: IssueType
    subtitle_id: int
    start_time: timedelta
    end_time: timedelta
    description: str
    severity: str = "medium"
    related_subtitle_ids: List[int] = field(default_factory=list)
    sensitive_match: Optional[str] = None
    mask_value: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "issue_type": self.issue_type.value,
            "subtitle_id": self.subtitle_id,
            "start_time": str(self.start_time),
            "end_time": str(self.end_time),
            "description": self.description,
            "severity": self.severity,
            "related_subtitle_ids": self.related_subtitle_ids,
            "sensitive_match": self.sensitive_match,
            "mask_value": self.mask_value,
        }


@dataclass
class MaskMapping:
    original_text: str
    masked_text: str
    category: str
    subtitle_id: int
    start_time: timedelta
    end_time: timedelta

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_text": self.original_text,
            "masked_text": self.masked_text,
            "category": self.category,
            "subtitle_id": self.subtitle_id,
            "start_time": str(self.start_time),
            "end_time": str(self.end_time),
        }


@dataclass
class SanitizedSubtitle:
    id: int
    start_time: timedelta
    end_time: timedelta
    original_text: str
    masked_text: str
    has_sensitive: bool = False
    mask_mappings: List[MaskMapping] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "start_time": str(self.start_time),
            "end_time": str(self.end_time),
            "original_text": self.original_text,
            "masked_text": self.masked_text,
            "has_sensitive": self.has_sensitive,
            "mask_mappings": [m.to_dict() for m in self.mask_mappings],
        }


@dataclass
class ClipSegment:
    id: int
    start_time: timedelta
    end_time: timedelta
    title: str
    subtitle_ids: List[int] = field(default_factory=list)
    has_sensitive: bool = False
    chapter_id: Optional[int] = None
    chapter_title: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "start_time": str(self.start_time),
            "end_time": str(self.end_time),
            "title": self.title,
            "subtitle_ids": self.subtitle_ids,
            "has_sensitive": self.has_sensitive,
            "chapter_id": self.chapter_id,
            "chapter_title": self.chapter_title,
        }


@dataclass
class ProjectState:
    subtitles: List[Subtitle] = field(default_factory=list)
    chapters: List[Chapter] = field(default_factory=list)
    rules: List[SensitiveRule] = field(default_factory=list)
    issues: List[ScanIssue] = field(default_factory=list)
    sanitized_subtitles: List[SanitizedSubtitle] = field(default_factory=list)
    mask_mappings: List[MaskMapping] = field(default_factory=list)
    clip_segments: List[ClipSegment] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "subtitles": [s.to_dict() for s in self.subtitles],
            "chapters": [c.to_dict() for c in self.chapters],
            "rules": [r.to_dict() for r in self.rules],
            "issues": [i.to_dict() for i in self.issues],
            "sanitized_subtitles": [s.to_dict() for s in self.sanitized_subtitles],
            "mask_mappings": [m.to_dict() for m in self.mask_mappings],
            "clip_segments": [c.to_dict() for c in self.clip_segments],
        }
