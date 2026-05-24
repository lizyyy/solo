from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
import hashlib
import json
from pathlib import Path

from .models import PDFMetadata, Annotation, Attachment
from .constants import ExitCode


@dataclass
class SanitizationResult:
    input_file: str
    output_file: str
    original_metadata: Optional[PDFMetadata] = None
    final_metadata: Optional[PDFMetadata] = None
    original_annotations: List[Annotation] = field(default_factory=list)
    final_annotations: List[Annotation] = field(default_factory=list)
    original_attachments: List[Attachment] = field(default_factory=list)
    final_attachments: List[Attachment] = field(default_factory=list)
    removed_annotations_count: int = 0
    removed_attachments_count: int = 0
    has_incremental_updates: bool = False
    success: bool = False
    error_message: Optional[str] = None
    exit_code: ExitCode = ExitCode.UNKNOWN_ERROR
    processing_time: float = 0.0
    file_hash: Optional[str] = None
    output_hash: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "input_file": self.input_file,
            "output_file": self.output_file,
            "success": self.success,
            "exit_code": self.exit_code.value,
            "exit_code_description": ExitCode(self.exit_code).name,
            "error_message": self.error_message,
            "processing_time_seconds": round(self.processing_time, 3),
            "has_incremental_updates": self.has_incremental_updates,
            "file_hash": self.file_hash,
            "output_hash": self.output_hash,
            "original": {
                "metadata": self.original_metadata.to_dict() if self.original_metadata else None,
                "annotations_count": len(self.original_annotations),
                "annotations": [a.to_dict() for a in self.original_annotations],
                "attachments_count": len(self.original_attachments),
                "attachments": [a.to_dict() for a in self.original_attachments]
            },
            "final": {
                "metadata": self.final_metadata.to_dict() if self.final_metadata else None,
                "annotations_count": len(self.final_annotations),
                "annotations": [a.to_dict() for a in self.final_annotations],
                "attachments_count": len(self.final_attachments),
                "attachments": [a.to_dict() for a in self.final_attachments]
            },
            "removed": {
                "annotations_count": self.removed_annotations_count,
                "attachments_count": self.removed_attachments_count,
                "metadata_cleaned": (
                    self.original_metadata is not None and 
                    not self.original_metadata.is_empty() and
                    self.final_metadata is not None and 
                    self.final_metadata.is_empty()
                )
            }
        }


@dataclass
class BatchResult:
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    results: List[SanitizationResult] = field(default_factory=list)
    total_files: int = 0
    success_count: int = 0
    failed_count: int = 0
    output_directory: str = ""
    rule_config: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "summary": {
                "total_files": self.total_files,
                "success_count": self.success_count,
                "failed_count": self.failed_count,
                "output_directory": self.output_directory,
                "success_rate": round(self.success_count / self.total_files * 100, 1) if self.total_files > 0 else 0
            },
            "rule_config": self.rule_config,
            "files": [r.to_dict() for r in self.results]
        }


def calculate_file_hash(file_path: str, algorithm: str = 'sha256') -> str:
    hash_obj = hashlib.new(algorithm)
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            hash_obj.update(chunk)
    return hash_obj.hexdigest()
