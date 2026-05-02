from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

from offline_merger.parsers.base_parser import ParseResult


class ConflictType(Enum):
    NAME_ONLY = "name_only"
    HASH_MISMATCH = "hash_mismatch"
    IDENTICAL = "identical"


@dataclass
class HashConflict:
    file_name: str
    conflict_type: ConflictType
    files: List[Dict[str, Any]]
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_name": self.file_name,
            "conflict_type": self.conflict_type.value,
            "files": self.files,
            "message": self.message,
        }


@dataclass
class HashValidationResult:
    conflicts: List[HashConflict] = field(default_factory=list)
    identical_files: List[List[str]] = field(default_factory=list)
    unique_files: int = 0
    total_files: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conflicts": [c.to_dict() for c in self.conflicts],
            "identical_files": self.identical_files,
            "unique_files": self.unique_files,
            "total_files": self.total_files,
        }


class HashValidator:
    def __init__(self):
        self._files_by_name: Dict[str, List[Dict[str, Any]]] = {}
        self._files_by_hash: Dict[str, List[Dict[str, Any]]] = {}

    def add_file(self, parse_result: ParseResult) -> None:
        metadata = parse_result.metadata
        file_info = {
            "file_name": metadata.file_name,
            "file_path": metadata.file_path,
            "source_package": metadata.source_package,
            "hash_sha256": metadata.hash_sha256,
            "hash_md5": metadata.hash_md5,
            "file_size": metadata.file_size,
            "last_modified": metadata.last_modified.isoformat(),
            "file_type": metadata.file_type.value,
        }

        if metadata.file_name not in self._files_by_name:
            self._files_by_name[metadata.file_name] = []
        self._files_by_name[metadata.file_name].append(file_info)

        if metadata.hash_sha256 not in self._files_by_hash:
            self._files_by_hash[metadata.hash_sha256] = []
        self._files_by_hash[metadata.hash_sha256].append(file_info)

    def validate(self) -> HashValidationResult:
        result = HashValidationResult()
        result.total_files = sum(len(files) for files in self._files_by_name.values())

        for file_name, files in self._files_by_name.items():
            if len(files) > 1:
                hashes = {f["hash_sha256"] for f in files}

                if len(hashes) == 1:
                    conflict = HashConflict(
                        file_name=file_name,
                        conflict_type=ConflictType.IDENTICAL,
                        files=files,
                        message=f"文件 '{file_name}' 在多个来源中存在，内容完全相同",
                    )
                    result.conflicts.append(conflict)

                    file_paths = [f["file_path"] for f in files]
                    if file_paths not in result.identical_files:
                        result.identical_files.append(file_paths)
                else:
                    conflict = HashConflict(
                        file_name=file_name,
                        conflict_type=ConflictType.HASH_MISMATCH,
                        files=files,
                        message=f"文件 '{file_name}' 名称相同但内容不同 (哈希冲突)",
                    )
                    result.conflicts.append(conflict)

        unique_names = set()
        for files in self._files_by_name.values():
            unique_hashes = {f["hash_sha256"] for f in files}
            unique_names.add(files[0]["file_name"])
            result.unique_files += len(unique_hashes)

        return result

    def get_duplicates_by_name(self, file_name: str) -> Optional[List[Dict[str, Any]]]:
        return self._files_by_name.get(file_name)

    def get_duplicates_by_hash(self, sha256_hash: str) -> Optional[List[Dict[str, Any]]]:
        return self._files_by_hash.get(sha256_hash)

    def clear(self) -> None:
        self._files_by_name.clear()
        self._files_by_hash.clear()
