from enum import Enum
from typing import List, Dict, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class ChecksumAlgorithm(str, Enum):
    MD5 = "md5"
    SHA1 = "sha1"
    SHA256 = "sha256"
    SHA512 = "sha512"
    CRC32 = "crc32"
    CRC64 = "crc64"


class ChecksumFormat(str, Enum):
    HEX = "hex"
    BASE64 = "base64"
    RAW = "raw"


class ChunkStatus(str, Enum):
    OK = "ok"
    MISSING = "missing"
    CHECKSUM_MISMATCH = "checksum_mismatch"
    SIZE_MISMATCH = "size_mismatch"
    CORRUPTED = "corrupted"


class FileStatus(str, Enum):
    OK = "ok"
    INCOMPLETE = "incomplete"
    CORRUPTED = "corrupted"
    MISSING = "missing"


class Checksum(BaseModel):
    algorithm: ChecksumAlgorithm
    format: ChecksumFormat
    value: str
    verified: bool = False

    @field_validator("value")
    def validate_checksum_value(cls, v, values):
        if not v:
            raise ValueError("Checksum value cannot be empty")
        return v


class Chunk(BaseModel):
    chunk_id: str
    part_number: int
    size: int
    checksums: List[Checksum]
    status: ChunkStatus = ChunkStatus.OK
    actual_size: Optional[int] = None
    actual_checksums: List[Checksum] = []
    error_message: Optional[str] = None
    etag: Optional[str] = None

    def get_checksum(self, algorithm: ChecksumAlgorithm) -> Optional[Checksum]:
        for cs in self.checksums:
            if cs.algorithm == algorithm:
                return cs
        return None


class BackupFile(BaseModel):
    file_id: str
    file_name: str
    total_size: int
    chunks: List[Chunk]
    expected_chunks: int
    checksums: List[Checksum]
    status: FileStatus = FileStatus.OK
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @property
    def present_chunks(self) -> int:
        return sum(1 for c in self.chunks if c.status == ChunkStatus.OK)

    @property
    def missing_chunks(self) -> List[Chunk]:
        return [c for c in self.chunks if c.status == ChunkStatus.MISSING]

    @property
    def corrupted_chunks(self) -> List[Chunk]:
        return [c for c in self.chunks if c.status in [ChunkStatus.CHECKSUM_MISMATCH, ChunkStatus.SIZE_MISMATCH, ChunkStatus.CORRUPTED]]


class RegionCopy(BaseModel):
    region: str
    bucket: str
    files: Dict[str, BackupFile] = Field(default_factory=dict)
    last_sync: Optional[datetime] = None

    def get_all_chunks(self) -> List[Chunk]:
        all_chunks = []
        for file in self.files.values():
            all_chunks.extend(file.chunks)
        return all_chunks


class Manifest(BaseModel):
    manifest_id: str
    version: str
    created_at: datetime
    source: str
    total_files: int = 0
    total_chunks: int = 0
    total_size: int = 0
    regions: Dict[str, RegionCopy] = Field(default_factory=dict)
    checksum_algorithms: List[ChecksumAlgorithm] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    def get_all_files(self) -> List[BackupFile]:
        all_files = []
        for region in self.regions.values():
            all_files.extend(region.files.values())
        return all_files

    def get_regions(self) -> List[str]:
        return list(self.regions.keys())


class ValidationIssue(BaseModel):
    severity: str
    code: str
    message: str
    file_id: Optional[str] = None
    chunk_id: Optional[str] = None
    region: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class ValidationReport(BaseModel):
    report_id: str
    generated_at: datetime
    manifest_id: str
    summary: Dict[str, Any] = Field(default_factory=dict)
    files_checked: int = 0
    chunks_checked: int = 0
    issues: List[ValidationIssue] = Field(default_factory=list)
    region_comparison: Dict[str, Any] = Field(default_factory=dict)
    duration_seconds: float = 0.0

    @property
    def has_errors(self) -> bool:
        return any(i.severity == "error" for i in self.issues)

    @property
    def has_warnings(self) -> bool:
        return any(i.severity == "warning" for i in self.issues)

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "error")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "warning")


class ExitCode(int, Enum):
    SUCCESS = 0
    VALIDATION_ERROR = 1
    INPUT_ERROR = 2
    IO_ERROR = 3
    CONFIG_ERROR = 4
    UNKNOWN_ERROR = 10
