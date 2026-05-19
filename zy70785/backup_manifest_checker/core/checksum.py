import hashlib
import os
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass, field
from enum import Enum
from .parser import ChunkInfo


class CheckStatus(Enum):
    PASS = "pass"
    FAIL = "fail"
    MISSING = "missing"
    SKIPPED = "skipped"
    UNKNOWN = "unknown"


@dataclass
class ChecksumResult:
    chunk: ChunkInfo
    status: CheckStatus
    actual_checksum: Optional[str] = None
    expected_checksum: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    error_message: Optional[str] = None
    check_duration: Optional[float] = None


@dataclass
class ChecksumReport:
    total_chunks: int = 0
    passed: int = 0
    failed: int = 0
    missing: int = 0
    skipped: int = 0
    results: List[ChecksumResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class ChecksumVerifier:
    def __init__(self, backup_dir: str, algorithm: Optional[str] = None):
        self.backup_dir = Path(backup_dir)
        self.force_algorithm = algorithm
        self._hash_cache: Dict[str, str] = {}

    def calculate_checksum(self, file_path: Path, algorithm: str) -> Optional[str]:
        cache_key = f"{file_path}:{algorithm}:{file_path.stat().st_mtime}"
        if cache_key in self._hash_cache:
            return self._hash_cache[cache_key]

        try:
            if not file_path.exists():
                return None

            hash_func = hashlib.new(algorithm)
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    hash_func.update(chunk)

            checksum = hash_func.hexdigest()
            self._hash_cache[cache_key] = checksum
            return checksum

        except (ValueError, IOError, OSError):
            return None

    def resolve_file_path(self, chunk: ChunkInfo) -> Optional[Path]:
        possible_paths = [
            self.backup_dir / chunk.file_path,
            self.backup_dir / Path(chunk.file_path).name,
            self.backup_dir / chunk.chunk_id,
            self.backup_dir / "chunks" / chunk.chunk_id,
            self.backup_dir / "parts" / chunk.chunk_id,
        ]

        for path in possible_paths:
            if path.exists() and path.is_file():
                return path

        relative_path = Path(chunk.file_path)
        if relative_path.is_absolute():
            if relative_path.exists() and relative_path.is_file():
                return relative_path

        return None

    def verify_chunk(self, chunk: ChunkInfo, skip_checksum: bool = False) -> ChecksumResult:
        file_path = self.resolve_file_path(chunk)

        if not file_path:
            return ChecksumResult(
                chunk=chunk,
                status=CheckStatus.MISSING,
                file_path=str(self.backup_dir / chunk.file_path),
                error_message="File not found in backup directory"
            )

        file_size = file_path.stat().st_size

        if skip_checksum:
            return ChecksumResult(
                chunk=chunk,
                status=CheckStatus.SKIPPED,
                file_path=str(file_path),
                file_size=file_size,
                error_message="Checksum verification skipped"
            )

        algorithm = self.force_algorithm or chunk.checksum_algorithm

        if algorithm == "unknown":
            return ChecksumResult(
                chunk=chunk,
                status=CheckStatus.UNKNOWN,
                file_path=str(file_path),
                file_size=file_size,
                error_message="Unknown checksum algorithm"
            )

        actual_checksum = self.calculate_checksum(file_path, algorithm)

        if actual_checksum is None:
            return ChecksumResult(
                chunk=chunk,
                status=CheckStatus.FAIL,
                file_path=str(file_path),
                file_size=file_size,
                error_message="Failed to calculate checksum"
            )

        expected_checksum = chunk.checksum.lower()
        actual_checksum = actual_checksum.lower()

        if actual_checksum == expected_checksum:
            return ChecksumResult(
                chunk=chunk,
                status=CheckStatus.PASS,
                actual_checksum=actual_checksum,
                expected_checksum=expected_checksum,
                file_path=str(file_path),
                file_size=file_size
            )
        else:
            return ChecksumResult(
                chunk=chunk,
                status=CheckStatus.FAIL,
                actual_checksum=actual_checksum,
                expected_checksum=expected_checksum,
                file_path=str(file_path),
                file_size=file_size,
                error_message="Checksum mismatch"
            )

    def verify_all(self, chunks: List[ChunkInfo], skip_checksum: bool = False) -> ChecksumReport:
        report = ChecksumReport(total_chunks=len(chunks))

        for chunk in sorted(chunks, key=lambda c: c.chunk_id):
            result = self.verify_chunk(chunk, skip_checksum)
            report.results.append(result)

            if result.status == CheckStatus.PASS:
                report.passed += 1
            elif result.status == CheckStatus.FAIL:
                report.failed += 1
            elif result.status == CheckStatus.MISSING:
                report.missing += 1
            elif result.status == CheckStatus.SKIPPED:
                report.skipped += 1

        report.results.sort(key=lambda r: r.chunk.chunk_id)
        return report

    def list_all_files(self) -> List[Path]:
        all_files = []
        for root, dirs, files in os.walk(self.backup_dir):
            dirs.sort()
            for filename in sorted(files):
                file_path = Path(root) / filename
                all_files.append(file_path)
        return all_files

    def find_extra_files(self, chunks: List[ChunkInfo]) -> List[Path]:
        manifest_files = set()
        for chunk in chunks:
            file_path = self.resolve_file_path(chunk)
            if file_path:
                manifest_files.add(file_path.resolve())

        all_files = set(p.resolve() for p in self.list_all_files())
        extra_files = sorted(all_files - manifest_files)
        return extra_files
