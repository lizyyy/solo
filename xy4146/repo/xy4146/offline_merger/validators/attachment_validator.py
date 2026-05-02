import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class MissingAttachment:
    point_id: str
    attachment_reference: str
    source_package: str
    search_paths: List[str]
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "point_id": self.point_id,
            "attachment_reference": self.attachment_reference,
            "source_package": self.source_package,
            "search_paths": self.search_paths,
            "message": self.message,
        }


@dataclass
class AttachmentValidationResult:
    missing_attachments: List[MissingAttachment] = field(default_factory=list)
    valid_attachments: int = 0
    total_references: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "missing_attachments": [m.to_dict() for m in self.missing_attachments],
            "valid_attachments": self.valid_attachments,
            "total_references": self.total_references,
        }


class AttachmentValidator:
    def __init__(self, search_paths: Optional[List[str]] = None):
        self._search_paths: List[str] = search_paths or []
        self._available_files: Dict[str, str] = {}
        self._references: List[Dict[str, Any]] = []

    def add_search_path(self, path: str) -> None:
        self._search_paths.append(path)
        self._index_files(path)

    def _index_files(self, base_path: str) -> None:
        base = Path(base_path)
        if not base.exists():
            return

        for root, _, files in os.walk(base):
            for file_name in files:
                full_path = os.path.join(root, file_name)
                self._available_files[file_name] = full_path

                rel_path = os.path.relpath(full_path, base_path)
                self._available_files[rel_path] = full_path

                norm_path = rel_path.replace("\\", "/")
                self._available_files[norm_path] = full_path

    def add_attachment_reference(
        self,
        reference: str,
        point_id: str,
        source_package: str,
        base_path: Optional[str] = None,
    ) -> None:
        self._references.append({
            "reference": reference,
            "point_id": point_id,
            "source_package": source_package,
            "base_path": base_path,
        })

    def validate(self) -> AttachmentValidationResult:
        result = AttachmentValidationResult()
        result.total_references = len(self._references)

        for ref in self._references:
            reference = ref["reference"]
            point_id = ref["point_id"]
            source_package = ref["source_package"]
            base_path = ref["base_path"]

            search_paths = []
            found = False

            if reference in self._available_files:
                result.valid_attachments += 1
                found = True
                continue

            if base_path:
                abs_path = os.path.join(base_path, reference)
                search_paths.append(abs_path)
                if os.path.exists(abs_path):
                    result.valid_attachments += 1
                    found = True
                    continue

            for search_path in self._search_paths:
                abs_path = os.path.join(search_path, reference)
                search_paths.append(abs_path)
                if os.path.exists(abs_path):
                    result.valid_attachments += 1
                    found = True
                    break

            if not found:
                missing = MissingAttachment(
                    point_id=point_id,
                    attachment_reference=reference,
                    source_package=source_package,
                    search_paths=search_paths,
                    message=f"点位 '{point_id}' 引用的附件 '{reference}' 在来源 '{source_package}' 中未找到",
                )
                result.missing_attachments.append(missing)

        return result

    def get_available_files(self) -> Dict[str, str]:
        return self._available_files.copy()

    def clear(self) -> None:
        self._search_paths.clear()
        self._available_files.clear()
        self._references.clear()
