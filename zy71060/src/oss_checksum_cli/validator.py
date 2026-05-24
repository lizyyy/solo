import os
import hashlib
import base64
import zlib
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime

from .models import (
    Manifest, BackupFile, Chunk, Checksum, ValidationIssue, ValidationReport,
    ChecksumAlgorithm, ChecksumFormat, ChunkStatus, FileStatus
)


class ChecksumValidator:
    def __init__(self):
        self.hash_functions = {
            ChecksumAlgorithm.MD5: hashlib.md5,
            ChecksumAlgorithm.SHA1: hashlib.sha1,
            ChecksumAlgorithm.SHA256: hashlib.sha256,
            ChecksumAlgorithm.SHA512: hashlib.sha512,
        }

    def calculate_checksum(
        self,
        data: bytes,
        algorithm: ChecksumAlgorithm,
        output_format: ChecksumFormat = ChecksumFormat.HEX
    ) -> str:
        if algorithm in [ChecksumAlgorithm.CRC32, ChecksumAlgorithm.CRC64]:
            return self._calculate_crc(data, algorithm, output_format)

        hash_func = self.hash_functions.get(algorithm)
        if not hash_func:
            raise ValueError(f"Unsupported checksum algorithm: {algorithm}")

        digest = hash_func(data).digest()
        return self._format_digest(digest, output_format)

    def _calculate_crc(
        self,
        data: bytes,
        algorithm: ChecksumAlgorithm,
        output_format: ChecksumFormat
    ) -> str:
        if algorithm == ChecksumAlgorithm.CRC32:
            crc_value = zlib.crc32(data) & 0xffffffff
            digest = crc_value.to_bytes(4, byteorder='big')
        else:
            raise ValueError(f"CRC64 not implemented yet")

        return self._format_digest(digest, output_format)

    def _format_digest(self, digest: bytes, output_format: ChecksumFormat) -> str:
        if output_format == ChecksumFormat.HEX:
            return digest.hex()
        elif output_format == ChecksumFormat.BASE64:
            return base64.b64encode(digest).decode('ascii')
        elif output_format == ChecksumFormat.RAW:
            return digest.hex()
        else:
            return digest.hex()

    def convert_checksum(
        self,
        value: str,
        from_format: ChecksumFormat,
        to_format: ChecksumFormat
    ) -> str:
        if from_format == to_format:
            return value

        if from_format == ChecksumFormat.HEX:
            digest = bytes.fromhex(value)
        elif from_format == ChecksumFormat.BASE64:
            digest = base64.b64decode(value)
        else:
            digest = value.encode('latin1')

        return self._format_digest(digest, to_format)

    def verify_checksum(
        self,
        data: bytes,
        expected: str,
        algorithm: ChecksumAlgorithm,
        expected_format: ChecksumFormat
    ) -> Tuple[bool, str]:
        actual = self.calculate_checksum(data, algorithm, expected_format)
        normalized_expected = expected.lower().strip() if expected_format == ChecksumFormat.HEX else expected.strip()
        normalized_actual = actual.lower().strip() if expected_format == ChecksumFormat.HEX else actual.strip()
        return normalized_actual == normalized_expected, actual


class ChunkValidator:
    def __init__(self, chunks_dir: Optional[str] = None):
        self.chunks_dir = Path(chunks_dir) if chunks_dir else None
        self.checksum_validator = ChecksumValidator()

    def validate_chunk(
        self,
        chunk: Chunk,
        chunk_data: Optional[bytes] = None,
        chunk_path: Optional[str] = None
    ) -> Tuple[ChunkStatus, Optional[str], List[Checksum]]:
        actual_checksums: List[Checksum] = []
        error_msg = None

        if chunk_data is None and chunk_path:
            try:
                with open(chunk_path, 'rb') as f:
                    chunk_data = f.read()
            except FileNotFoundError:
                return ChunkStatus.MISSING, "Chunk file not found", []
            except Exception as e:
                return ChunkStatus.CORRUPTED, f"Failed to read chunk: {e}", []

        if chunk_data is None and self.chunks_dir:
            possible_paths = [
                self.chunks_dir / chunk.chunk_id,
                self.chunks_dir / f"{chunk.chunk_id}.part",
                self.chunks_dir / f"part_{chunk.part_number}",
            ]
            for path in possible_paths:
                if path.exists():
                    try:
                        with open(path, 'rb') as f:
                            chunk_data = f.read()
                        break
                    except Exception:
                        continue

        if chunk_data is None:
            return ChunkStatus.MISSING, "Chunk data not available", []

        actual_size = len(chunk_data)
        if chunk.size > 0 and actual_size != chunk.size:
            error_msg = f"Size mismatch: expected {chunk.size}, got {actual_size}"
            return ChunkStatus.SIZE_MISMATCH, error_msg, actual_checksums

        for expected_cs in chunk.checksums:
            try:
                is_valid, actual_value = self.checksum_validator.verify_checksum(
                    chunk_data,
                    expected_cs.value,
                    expected_cs.algorithm,
                    expected_cs.format
                )
                actual_checksums.append(Checksum(
                    algorithm=expected_cs.algorithm,
                    format=expected_cs.format,
                    value=actual_value,
                    verified=is_valid
                ))
                if not is_valid:
                    error_msg = (
                        f"Checksum mismatch ({expected_cs.algorithm}): "
                        f"expected {expected_cs.value}, got {actual_value}"
                    )
                    return ChunkStatus.CHECKSUM_MISMATCH, error_msg, actual_checksums
            except Exception as e:
                error_msg = f"Checksum verification failed: {e}"
                return ChunkStatus.CORRUPTED, error_msg, actual_checksums

        return ChunkStatus.OK, None, actual_checksums


class FileValidator:
    def __init__(self, chunks_dir: Optional[str] = None):
        self.chunk_validator = ChunkValidator(chunks_dir)

    def validate_file(self, file: BackupFile, chunks_dir: Optional[str] = None) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        chunks_ok = 0

        for chunk in file.chunks:
            chunk_path = None
            if chunks_dir:
                chunk_path = str(Path(chunks_dir) / chunk.chunk_id)

            status, error_msg, actual_checksums = self.chunk_validator.validate_chunk(
                chunk, chunk_path=chunk_path
            )
            chunk.status = status
            chunk.actual_checksums = actual_checksums
            chunk.error_message = error_msg

            if status == ChunkStatus.OK:
                chunks_ok += 1
            else:
                severity = "error" if status != ChunkStatus.OK else "warning"
                issues.append(ValidationIssue(
                    severity=severity,
                    code=f"chunk_{status.value}",
                    message=error_msg or f"Chunk {chunk.part_number} validation failed",
                    file_id=file.file_id,
                    chunk_id=chunk.chunk_id,
                    details={
                        "part_number": chunk.part_number,
                        "expected_size": chunk.size,
                        "actual_size": chunk.actual_size,
                        "expected_checksums": [cs.model_dump() for cs in chunk.checksums],
                        "actual_checksums": [cs.model_dump() for cs in actual_checksums],
                    }
                ))

        if chunks_ok != file.expected_chunks:
            file.status = FileStatus.INCOMPLETE
            issues.append(ValidationIssue(
                severity="error",
                code="file_incomplete",
                message=f"File incomplete: {chunks_ok}/{file.expected_chunks} chunks valid",
                file_id=file.file_id,
                details={
                    "expected_chunks": file.expected_chunks,
                    "valid_chunks": chunks_ok,
                    "missing_chunks": file.expected_chunks - chunks_ok
                }
            ))
        elif len(file.corrupted_chunks) > 0:
            file.status = FileStatus.CORRUPTED
        else:
            file.status = FileStatus.OK

        return issues
