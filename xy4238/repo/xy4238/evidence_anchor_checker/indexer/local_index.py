"""
本地索引管理
管理解析后的数据的本地索引，便于快速检索和核对
"""

import json
import pickle
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Set

from ..rules.validation_rules import (
    EvidenceAnchor,
    EvidenceCatalogEntry,
    TranscriptSegment,
    TimestampEntry,
    ValidationRules
)


@dataclass
class IndexMetadata:
    created_at: str
    updated_at: str
    timestamp_csv_path: str
    transcript_md_path: str
    evidence_json_path: str
    version: str = "1.0.0"


@dataclass
class CheckResult:
    total_errors: int
    total_warnings: int
    error_summary: Dict[str, int]
    check_time: str


class LocalIndex:
    INDEX_DIR = ".evidence_index"
    METADATA_FILE = "metadata.json"
    EVIDENCE_INDEX_FILE = "evidence_index.pkl"
    TRANSCRIPT_INDEX_FILE = "transcript_index.pkl"
    TIMESTAMP_INDEX_FILE = "timestamp_index.pkl"
    ANCHOR_INDEX_FILE = "anchor_index.pkl"
    CHECK_RESULT_FILE = "check_result.json"

    def __init__(self, base_dir: str = None):
        if base_dir is None:
            base_dir = Path.cwd()
        self.base_path = Path(base_dir)
        self.index_path = self.base_path / self.INDEX_DIR

        self.evidence_catalog: List[EvidenceCatalogEntry] = []
        self.transcript_segments: List[TranscriptSegment] = []
        self.timestamp_entries: List[TimestampEntry] = []
        self.all_anchors: List[EvidenceAnchor] = []
        self.metadata: Optional[IndexMetadata] = None
        self.last_check_result: Optional[CheckResult] = None

        self._evidence_by_number: Dict[str, EvidenceCatalogEntry] = {}
        self._timestamps_by_time: Dict[str, TimestampEntry] = {}
        self._segments_by_line: Dict[int, TranscriptSegment] = {}

    def initialize(self,
                   timestamp_csv_path: str = "",
                   transcript_md_path: str = "",
                   evidence_json_path: str = "") -> None:
        now = datetime.now().isoformat()
        self.metadata = IndexMetadata(
            created_at=now,
            updated_at=now,
            timestamp_csv_path=timestamp_csv_path,
            transcript_md_path=transcript_md_path,
            evidence_json_path=evidence_json_path
        )

    def exists(self) -> bool:
        return self.index_path.exists() and (self.index_path / self.METADATA_FILE).exists()

    def save(self) -> None:
        self.index_path.mkdir(parents=True, exist_ok=True)

        if self.metadata:
            self.metadata.updated_at = datetime.now().isoformat()
            with open(self.index_path / self.METADATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(asdict(self.metadata), f, ensure_ascii=False, indent=2)

        self._build_lookups()

        with open(self.index_path / self.EVIDENCE_INDEX_FILE, 'wb') as f:
            pickle.dump(self.evidence_catalog, f)

        with open(self.index_path / self.TRANSCRIPT_INDEX_FILE, 'wb') as f:
            pickle.dump(self.transcript_segments, f)

        with open(self.index_path / self.TIMESTAMP_INDEX_FILE, 'wb') as f:
            pickle.dump(self.timestamp_entries, f)

        with open(self.index_path / self.ANCHOR_INDEX_FILE, 'wb') as f:
            pickle.dump(self.all_anchors, f)

        if self.last_check_result:
            with open(self.index_path / self.CHECK_RESULT_FILE, 'w', encoding='utf-8') as f:
                json.dump({
                    "total_errors": self.last_check_result.total_errors,
                    "total_warnings": self.last_check_result.total_warnings,
                    "error_summary": self.last_check_result.error_summary,
                    "check_time": self.last_check_result.check_time
                }, f, ensure_ascii=False, indent=2)

    def load(self) -> bool:
        if not self.exists():
            return False

        metadata_path = self.index_path / self.METADATA_FILE
        if metadata_path.exists():
            with open(metadata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.metadata = IndexMetadata(**data)

        evidence_path = self.index_path / self.EVIDENCE_INDEX_FILE
        if evidence_path.exists():
            with open(evidence_path, 'rb') as f:
                self.evidence_catalog = pickle.load(f)

        transcript_path = self.index_path / self.TRANSCRIPT_INDEX_FILE
        if transcript_path.exists():
            with open(transcript_path, 'rb') as f:
                self.transcript_segments = pickle.load(f)

        timestamp_path = self.index_path / self.TIMESTAMP_INDEX_FILE
        if timestamp_path.exists():
            with open(timestamp_path, 'rb') as f:
                self.timestamp_entries = pickle.load(f)

        anchor_path = self.index_path / self.ANCHOR_INDEX_FILE
        if anchor_path.exists():
            with open(anchor_path, 'rb') as f:
                self.all_anchors = pickle.load(f)

        check_result_path = self.index_path / self.CHECK_RESULT_FILE
        if check_result_path.exists():
            with open(check_result_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.last_check_result = CheckResult(
                    total_errors=data.get("total_errors", 0),
                    total_warnings=data.get("total_warnings", 0),
                    error_summary=data.get("error_summary", {}),
                    check_time=data.get("check_time", "")
                )

        self._build_lookups()
        return True

    def _build_lookups(self) -> None:
        self._evidence_by_number = {
            entry.evidence_number: entry
            for entry in self.evidence_catalog
        }

        self._timestamps_by_time = {
            entry.timestamp: entry
            for entry in self.timestamp_entries
        }

        self._segments_by_line = {
            segment.line_number: segment
            for segment in self.transcript_segments
        }

    def get_all_evidence_numbers(self) -> Set[str]:
        return {entry.evidence_number for entry in self.evidence_catalog}

    def get_evidence_by_number(self, evidence_number: str) -> Optional[EvidenceCatalogEntry]:
        for num, entry in self._evidence_by_number.items():
            if ValidationRules.evidence_numbers_match(num, evidence_number):
                return entry
        return None

    def get_timestamp_entry(self, timestamp: str) -> Optional[TimestampEntry]:
        return self._timestamps_by_time.get(timestamp)

    def get_segment_by_line(self, line_number: int) -> Optional[TranscriptSegment]:
        return self._segments_by_line.get(line_number)

    def get_all_anchors(self) -> List[EvidenceAnchor]:
        anchors = []
        for segment in self.transcript_segments:
            anchors.extend(segment.anchors)
        return anchors

    def clear(self) -> None:
        if self.index_path.exists():
            import shutil
            shutil.rmtree(self.index_path)

        self.evidence_catalog = []
        self.transcript_segments = []
        self.timestamp_entries = []
        self.all_anchors = []
        self.metadata = None
        self.last_check_result = None
        self._evidence_by_number.clear()
        self._timestamps_by_time.clear()
        self._segments_by_line.clear()

    def get_index_info(self) -> Dict[str, Any]:
        return {
            "exists": self.exists(),
            "created_at": self.metadata.created_at if self.metadata else None,
            "updated_at": self.metadata.updated_at if self.metadata else None,
            "evidence_count": len(self.evidence_catalog),
            "transcript_segments": len(self.transcript_segments),
            "timestamp_entries": len(self.timestamp_entries),
            "anchor_count": len(self.get_all_anchors()),
            "last_check": {
                "errors": self.last_check_result.total_errors if self.last_check_result else 0,
                "warnings": self.last_check_result.total_warnings if self.last_check_result else 0,
                "time": self.last_check_result.check_time if self.last_check_result else None
            }
        }
