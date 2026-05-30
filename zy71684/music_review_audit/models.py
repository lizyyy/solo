from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class AuditStatus(Enum):
    PROCESSED = "已处理"
    PENDING = "待确认"
    RETURNED = "退回补材料"


class RiskType(Enum):
    SARCASM_MISJUDGE = "讽刺误判"
    SPAM_DUPLICATE = "刷屏重复"
    DELISTED_SONG = "下架歌曲仍推荐"


class SongStatus(Enum):
    ACTIVE = "上架"
    DELISTED = "下架"


@dataclass
class SourceTrace:
    file_path: str = ""
    row_number: int = 0
    raw_line: str = ""

    def to_dict(self):
        return {
            "file_path": self.file_path,
            "row_number": self.row_number,
            "raw_line": self.raw_line[:200],
        }

    def __str__(self):
        return f"{self.file_path}#L{self.row_number}"


@dataclass
class ReviewRecord:
    review_id: str = ""
    text: str = ""
    user_id: str = ""
    song_id: str = ""
    created_at: str = ""
    source: Optional[SourceTrace] = None

    def to_dict(self):
        d = {
            "review_id": self.review_id,
            "text": self.text,
            "user_id": self.user_id,
            "song_id": self.song_id,
            "created_at": self.created_at,
        }
        if self.source:
            d["source"] = str(self.source)
        return d


@dataclass
class AlgorithmTag:
    review_id: str = ""
    tag: str = ""
    confidence: float = 0.0
    algorithm_version: str = ""
    tagged_at: str = ""
    source: Optional[SourceTrace] = None

    def to_dict(self):
        d = {
            "review_id": self.review_id,
            "tag": self.tag,
            "confidence": self.confidence,
            "algorithm_version": self.algorithm_version,
            "tagged_at": self.tagged_at,
        }
        if self.source:
            d["source"] = str(self.source)
        return d


@dataclass
class ManualCorrection:
    review_id: str = ""
    original_tag: str = ""
    corrected_tag: str = ""
    reviewer_id: str = ""
    corrected_at: str = ""
    note: str = ""
    source: Optional[SourceTrace] = None

    def to_dict(self):
        d = {
            "review_id": self.review_id,
            "original_tag": self.original_tag,
            "corrected_tag": self.corrected_tag,
            "reviewer_id": self.reviewer_id,
            "corrected_at": self.corrected_at,
            "note": self.note,
        }
        if self.source:
            d["source"] = str(self.source)
        return d


@dataclass
class SongInfo:
    song_id: str = ""
    title: str = ""
    artist: str = ""
    status: str = SongStatus.ACTIVE.value
    source: Optional[SourceTrace] = None

    def to_dict(self):
        d = {
            "song_id": self.song_id,
            "title": self.title,
            "artist": self.artist,
            "status": self.status,
        }
        if self.source:
            d["source"] = str(self.source)
        return d


@dataclass
class ReportRecord:
    report_id: str = ""
    review_id: str = ""
    reason: str = ""
    status: str = ""
    reported_at: str = ""
    source: Optional[SourceTrace] = None

    def to_dict(self):
        d = {
            "report_id": self.report_id,
            "review_id": self.review_id,
            "reason": self.reason,
            "status": self.status,
            "reported_at": self.reported_at,
        }
        if self.source:
            d["source"] = str(self.source)
        return d


@dataclass
class RiskItem:
    risk_type: RiskType = RiskType.SARCASM_MISJUDGE
    severity: str = "中"
    description: str = ""
    evidence: str = ""
    source: Optional[SourceTrace] = None

    def to_dict(self):
        d = {
            "risk_type": self.risk_type.value,
            "severity": self.severity,
            "description": self.description,
            "evidence": self.evidence,
        }
        if self.source:
            d["source"] = str(self.source)
        return d


@dataclass
class TagVersionEntry:
    tag: str = ""
    source_type: str = ""
    version: str = ""
    timestamp: str = ""
    operator: str = ""

    def to_dict(self):
        return {
            "tag": self.tag,
            "source_type": self.source_type,
            "version": self.version,
            "timestamp": self.timestamp,
            "operator": self.operator,
        }


@dataclass
class AuditEntry:
    review_id: str = ""
    review_text: str = ""
    user_id: str = ""
    song_id: str = ""
    song_title: str = ""
    song_status: str = SongStatus.ACTIVE.value
    algorithm_tags: list = field(default_factory=list)
    manual_correction: Optional[ManualCorrection] = None
    current_tag: str = ""
    tag_version_chain: list = field(default_factory=list)
    report_records: list = field(default_factory=list)
    risks: list = field(default_factory=list)
    audit_status: str = AuditStatus.PENDING.value
    audit_note: str = ""
    source_traces: list = field(default_factory=list)

    def to_dict(self):
        return {
            "review_id": self.review_id,
            "review_text": self.review_text[:100],
            "user_id": self.user_id,
            "song_id": self.song_id,
            "song_title": self.song_title,
            "song_status": self.song_status,
            "algorithm_tags": [t.to_dict() if hasattr(t, "to_dict") else t for t in self.algorithm_tags],
            "manual_correction": self.manual_correction.to_dict() if self.manual_correction else None,
            "current_tag": self.current_tag,
            "tag_version_chain": [v.to_dict() if hasattr(v, "to_dict") else v for v in self.tag_version_chain],
            "report_records": [r.to_dict() if hasattr(r, "to_dict") else r for r in self.report_records],
            "risks": [r.to_dict() if hasattr(r, "to_dict") else r for r in self.risks],
            "audit_status": self.audit_status,
            "audit_note": self.audit_note,
            "source_traces": [str(s) for s in self.source_traces],
        }


@dataclass
class ImportResult:
    data_type: str = ""
    total_rows: int = 0
    success_rows: int = 0
    skipped_rows: int = 0
    errors: list = field(default_factory=list)
    records: list = field(default_factory=list)

    def to_dict(self):
        return {
            "data_type": self.data_type,
            "total_rows": self.total_rows,
            "success_rows": self.success_rows,
            "skipped_rows": self.skipped_rows,
            "errors": self.errors,
        }
