import json
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class ManifestFormat(Enum):
    UNKNOWN = "unknown"
    JSON = "json"
    YAML = "yaml"
    SIMPLE_TEXT = "simple_text"


@dataclass
class ChunkInfo:
    chunk_id: str
    file_path: str
    checksum: str
    checksum_algorithm: str = "sha256"
    size: Optional[int] = None
    raw_line: Optional[str] = None
    line_number: Optional[int] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParseError:
    line_number: int
    raw_line: str
    error_message: str
    error_type: str = "parse_error"


@dataclass
class ParseResult:
    format: ManifestFormat
    chunks: List[ChunkInfo] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    raw_content: str = ""


class ManifestParser:
    def __init__(self, manifest_path: str, backup_dir: Optional[str] = None):
        self.manifest_path = Path(manifest_path)
        self.backup_dir = Path(backup_dir) if backup_dir else None
        self._raw_lines: List[str] = []

    def detect_format(self) -> ManifestFormat:
        suffix = self.manifest_path.suffix.lower()
        if suffix in (".json"):
            return ManifestFormat.JSON
        elif suffix in (".yaml", ".yml"):
            return ManifestFormat.YAML
        return ManifestFormat.SIMPLE_TEXT

    def parse(self) -> ParseResult:
        raw_content = self.manifest_path.read_text(encoding="utf-8", errors="replace")
        self._raw_lines = raw_content.splitlines()

        fmt = self.detect_format()
        result = ParseResult(format=fmt, raw_content=raw_content)

        if fmt == ManifestFormat.JSON:
            self._parse_json(result)
        elif fmt == ManifestFormat.YAML:
            self._parse_yaml(result)
        else:
            self._parse_simple_text(result)

        result.chunks.sort(key=lambda c: c.chunk_id)
        result.errors.sort(key=lambda e: e.line_number)

        return result

    def _parse_json(self, result: ParseResult) -> None:
        try:
            data = json.loads(result.raw_content)
            chunks = data.get("chunks", []) if isinstance(data, dict) else data

            for idx, chunk in enumerate(chunks):
                if not isinstance(chunk, dict):
                    result.errors.append(ParseError(
                        line_number=idx + 1,
                        raw_line=json.dumps(chunk),
                        error_message=f"Invalid chunk format at index {idx}",
                        error_type="invalid_chunk"
                    ))
                    continue

                chunk_info = self._extract_chunk_from_dict(chunk, idx + 1)
                if chunk_info:
                    result.chunks.append(chunk_info)

            if isinstance(data, dict):
                result.metadata = {k: v for k, v in data.items() if k != "chunks"}

        except json.JSONDecodeError as e:
            result.errors.append(ParseError(
                line_number=e.lineno,
                raw_line=self._raw_lines[e.lineno - 1] if e.lineno <= len(self._raw_lines) else "",
                error_message=f"JSON parse error: {e.msg}",
                error_type="json_decode_error"
            ))

    def _parse_yaml(self, result: ParseResult) -> None:
        try:
            import yaml
            data = yaml.safe_load(result.raw_content)
            chunks = data.get("chunks", []) if isinstance(data, dict) else data

            for idx, chunk in enumerate(chunks):
                if not isinstance(chunk, dict):
                    result.errors.append(ParseError(
                        line_number=idx + 1,
                        raw_line=str(chunk),
                        error_message=f"Invalid chunk format at index {idx}",
                        error_type="invalid_chunk"
                    ))
                    continue

                chunk_info = self._extract_chunk_from_dict(chunk, idx + 1)
                if chunk_info:
                    result.chunks.append(chunk_info)

            if isinstance(data, dict):
                result.metadata = {k: v for k, v in data.items() if k != "chunks"}

        except Exception as e:
            result.errors.append(ParseError(
                line_number=1,
                raw_line=self._raw_lines[0] if self._raw_lines else "",
                error_message=f"YAML parse error: {str(e)}",
                error_type="yaml_decode_error"
            ))

    def _parse_simple_text(self, result: ParseResult) -> None:
        for line_num, line in enumerate(self._raw_lines, start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            chunk_info = self._parse_text_line(stripped, line_num, line)
            if chunk_info:
                result.chunks.append(chunk_info)
            elif not stripped.startswith("//") and not stripped.startswith("--"):
                result.errors.append(ParseError(
                    line_number=line_num,
                    raw_line=line,
                    error_message="Unrecognized line format",
                    error_type="format_error"
                ))

    def _parse_text_line(self, stripped: str, line_num: int, raw_line: str) -> Optional[ChunkInfo]:
        parts = stripped.split()
        if len(parts) >= 2:
            if len(parts[0]) in (32, 40, 64, 128):
                checksum = parts[0]
                file_path = " ".join(parts[1:])
                chunk_id = Path(file_path).name
                return ChunkInfo(
                    chunk_id=chunk_id,
                    file_path=file_path,
                    checksum=checksum,
                    checksum_algorithm=self._detect_checksum_algorithm(checksum),
                    raw_line=raw_line,
                    line_number=line_num
                )

        if "|" in stripped:
            parts = [p.strip() for p in stripped.split("|")]
            if len(parts) >= 2:
                chunk_id = parts[0]
                file_path = parts[1] if len(parts) > 1 else chunk_id
                checksum = parts[2] if len(parts) > 2 else ""
                return ChunkInfo(
                    chunk_id=chunk_id,
                    file_path=file_path,
                    checksum=checksum,
                    checksum_algorithm=self._detect_checksum_algorithm(checksum),
                    raw_line=raw_line,
                    line_number=line_num
                )

        if "," in stripped and not stripped.startswith("{"):
            parts = [p.strip() for p in stripped.split(",")]
            if len(parts) >= 2:
                chunk_id = parts[0]
                file_path = parts[1] if len(parts) > 1 else chunk_id
                checksum = parts[2] if len(parts) > 2 else ""
                return ChunkInfo(
                    chunk_id=chunk_id,
                    file_path=file_path,
                    checksum=checksum,
                    checksum_algorithm=self._detect_checksum_algorithm(checksum),
                    raw_line=raw_line,
                    line_number=line_num
                )

        return None

    def _extract_chunk_from_dict(self, chunk: Dict[str, Any], line_num: int) -> Optional[ChunkInfo]:
        chunk_id = (
            chunk.get("chunk_id") or
            chunk.get("id") or
            chunk.get("name") or
            chunk.get("filename") or
            ""
        )
        file_path = (
            chunk.get("file_path") or
            chunk.get("path") or
            chunk.get("filename") or
            chunk_id
        )
        checksum = (
            chunk.get("checksum") or
            chunk.get("hash") or
            chunk.get("sha256") or
            chunk.get("md5") or
            ""
        )
        algorithm = (
            chunk.get("algorithm") or
            chunk.get("hash_algorithm") or
            self._detect_checksum_algorithm(checksum)
        )
        size = chunk.get("size")

        if not chunk_id or not file_path:
            return None

        return ChunkInfo(
            chunk_id=chunk_id,
            file_path=file_path,
            checksum=checksum,
            checksum_algorithm=algorithm,
            size=size,
            line_number=line_num,
            extra={k: v for k, v in chunk.items() if k not in {"chunk_id", "id", "file_path", "path", "checksum", "hash", "algorithm", "size"}}
        )

    def _detect_checksum_algorithm(self, checksum: str) -> str:
        length = len(checksum)
        if length == 32:
            return "md5"
        elif length == 40:
            return "sha1"
        elif length == 64:
            return "sha256"
        elif length == 128:
            return "sha512"
        return "unknown"
