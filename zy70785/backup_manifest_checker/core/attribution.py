import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

from .parser import ChunkInfo, ParseError
from .checksum import ChecksumResult, CheckStatus


class MissingCause(Enum):
    UNKNOWN = "unknown"
    FILE_NOT_FOUND = "file_not_found"
    PERMISSION_DENIED = "permission_denied"
    CORRUPTED_FILE = "corrupted_file"
    CHECKSUM_MISMATCH = "checksum_mismatch"
    PARTIAL_UPLOAD = "partial_upload"
    NETWORK_ERROR = "network_error"
    DISK_ERROR = "disk_error"
    INVALID_MANIFEST = "invalid_manifest"
    NAME_MISMATCH = "name_mismatch"


@dataclass
class Attribution:
    chunk_id: str
    cause: MissingCause
    confidence: float
    evidence: List[str] = field(default_factory=list)
    suggested_action: str = ""
    line_number: Optional[int] = None
    raw_line: Optional[str] = None


@dataclass
class AttributionReport:
    attributions: List[Attribution] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    patterns: List[str] = field(default_factory=list)


class MissingAttributor:
    def __init__(self, backup_dir: str):
        self.backup_dir = Path(backup_dir)

    def analyze_result(self, result: ChecksumResult) -> Attribution:
        chunk = result.chunk
        evidence: List[str] = []
        cause = MissingCause.UNKNOWN
        confidence = 0.0

        if result.status == CheckStatus.MISSING:
            cause, confidence, evidence = self._analyze_missing(chunk)
        elif result.status == CheckStatus.FAIL:
            cause, confidence, evidence = self._analyze_failure(chunk, result)
        elif result.status == CheckStatus.UNKNOWN:
            cause = MissingCause.INVALID_MANIFEST
            confidence = 0.8
            evidence.append(f"Unknown checksum algorithm: {chunk.checksum_algorithm}")

        attribution = Attribution(
            chunk_id=chunk.chunk_id,
            cause=cause,
            confidence=confidence,
            evidence=evidence,
            suggested_action=self._get_suggested_action(cause),
            line_number=chunk.line_number,
            raw_line=chunk.raw_line
        )

        return attribution

    def _analyze_missing(self, chunk: ChunkInfo) -> tuple:
        evidence: List[str] = []
        cause = MissingCause.FILE_NOT_FOUND
        confidence = 0.7

        expected_path = self.backup_dir / chunk.file_path
        expected_name = Path(chunk.file_path).name

        parent_dir = expected_path.parent
        if parent_dir.exists():
            similar_files = list(parent_dir.glob(f"*{expected_name[:10]}*"))
            if similar_files:
                evidence.append(f"Similar files found in directory: {[f.name for f in similar_files[:3]]}")
                cause = MissingCause.NAME_MISMATCH
                confidence = 0.85

        if not parent_dir.exists():
            evidence.append(f"Parent directory does not exist: {parent_dir}")
            confidence = 0.9

        evidence.append(f"Expected path: {expected_path}")
        evidence.append(f"Chunk ID in manifest: {chunk.chunk_id}")

        return cause, confidence, evidence

    def _analyze_failure(self, chunk: ChunkInfo, result: ChecksumResult) -> tuple:
        evidence: List[str] = []
        cause = MissingCause.CHECKSUM_MISMATCH
        confidence = 0.9

        if result.error_message and "checksum" in result.error_message.lower():
            evidence.append(f"Manifest checksum: {result.expected_checksum}")
            evidence.append(f"Actual file checksum: {result.actual_checksum}")

            if result.file_size is not None and chunk.size is not None:
                if result.file_size != chunk.size:
                    cause = MissingCause.PARTIAL_UPLOAD
                    confidence = 0.85
                    evidence.append(f"Size mismatch: expected {chunk.size}, got {result.file_size}")

            if result.actual_checksum and len(result.actual_checksum) > 0:
                if all(c == "0" for c in result.actual_checksum):
                    cause = MissingCause.CORRUPTED_FILE
                    confidence = 0.95
                    evidence.append("File appears to be zeroed or corrupted")

        return cause, confidence, evidence

    def _get_suggested_action(self, cause: MissingCause) -> str:
        suggestions = {
            MissingCause.FILE_NOT_FOUND: "检查备份目录结构，确认文件是否完整上传",
            MissingCause.PERMISSION_DENIED: "检查文件权限，确保可读",
            MissingCause.CORRUPTED_FILE: "文件已损坏，建议重新备份",
            MissingCause.CHECKSUM_MISMATCH: "校验和不匹配，可能是传输错误或文件损坏",
            MissingCause.PARTIAL_UPLOAD: "文件不完整，检查上传过程",
            MissingCause.NETWORK_ERROR: "检查网络连接，重新传输",
            MissingCause.DISK_ERROR: "检查磁盘健康状态，可能存在坏道",
            MissingCause.INVALID_MANIFEST: "检查manifest文件格式是否正确",
            MissingCause.NAME_MISMATCH: "检查文件名，可能存在命名不一致",
            MissingCause.UNKNOWN: "进一步检查文件系统和网络状态",
        }
        return suggestions.get(cause, "无建议")

    def analyze_all(self, results: List[ChecksumResult]) -> AttributionReport:
        report = AttributionReport()

        for result in sorted(results, key=lambda r: r.chunk.chunk_id):
            if result.status in (CheckStatus.MISSING, CheckStatus.FAIL, CheckStatus.UNKNOWN):
                attribution = self.analyze_result(result)
                report.attributions.append(attribution)
                report.summary[attribution.cause.value] += 1

        self._analyze_patterns(report)
        report.attributions.sort(key=lambda a: a.chunk_id)
        return report

    def _analyze_patterns(self, report: AttributionReport) -> None:
        report.patterns.clear()

        if not report.attributions:
            return

        line_numbers = [a.line_number for a in report.attributions if a.line_number is not None]
        if len(line_numbers) >= 3:
            consecutive = self._find_consecutive_lines(line_numbers)
            if consecutive:
                report.patterns.append(f"发现连续缺失的块: 行号 {consecutive}")

        chunk_ids = [a.chunk_id for a in report.attributions]
        prefix_pattern = self._find_prefix_pattern(chunk_ids)
        if prefix_pattern:
            report.patterns.append(f"发现相同前缀的缺失块: {prefix_pattern}")

        causes = list(report.summary.items())
        causes.sort(key=lambda x: x[1], reverse=True)
        if causes and causes[0][1] >= len(report.attributions) * 0.5:
            report.patterns.append(f"主要故障类型: {causes[0][0]} (占比 {causes[0][1]}/{len(report.attributions)})")

    def _find_consecutive_lines(self, lines: List[int]) -> str:
        lines.sort()
        ranges = []
        start = lines[0]
        prev = lines[0]

        for line in lines[1:]:
            if line == prev + 1:
                prev = line
            else:
                if start == prev:
                    ranges.append(str(start))
                else:
                    ranges.append(f"{start}-{prev}")
                start = line
                prev = line

        if start == prev:
            ranges.append(str(start))
        else:
            ranges.append(f"{start}-{prev}")

        return ", ".join(ranges) if len(ranges) < len(lines) else ""

    def _find_prefix_pattern(self, chunk_ids: List[str]) -> Optional[str]:
        if len(chunk_ids) < 3:
            return None

        prefixes = defaultdict(int)
        for chunk_id in chunk_ids:
            prefix = chunk_id[:8] if len(chunk_id) >= 8 else chunk_id
            prefixes[prefix] += 1

        for prefix, count in sorted(prefixes.items(), key=lambda x: x[1], reverse=True):
            if count >= 3 and count >= len(chunk_ids) * 0.3:
                return f"{prefix}* (共 {count} 个)"

        return None

    def analyze_parse_errors(self, parse_errors: List[ParseError]) -> List[Attribution]:
        attributions = []
        for error in sorted(parse_errors, key=lambda e: e.line_number):
            attribution = Attribution(
                chunk_id=f"line_{error.line_number}",
                cause=MissingCause.INVALID_MANIFEST,
                confidence=0.95,
                evidence=[f"Parse error: {error.error_message}"],
                suggested_action="修复manifest文件中的格式错误",
                line_number=error.line_number,
                raw_line=error.raw_line
            )
            attributions.append(attribution)
        return attributions
