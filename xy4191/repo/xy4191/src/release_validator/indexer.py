import hashlib
import os
import re
from collections import Counter
from dataclasses import dataclass
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class FileEntry:
    path: str
    filename: str
    file_type: str
    size: int
    sha256: str
    version: Optional[str] = None
    scan_time: str = ""


ARTIFACT_TYPES = {
    "tar": (".tar", ".tar.gz", ".tgz", ".tar.bz2", ".tbz2"),
    "zip": (".zip",),
    "checksum": ("checksums.txt", "SHA256SUMS", "sha256sums.txt"),
    "sbom": ("sbom.json", "sbom.xml", "cyclonedx.json", "cyclonedx.xml", "spdx.json", "spdx.xml"),
    "license": ("license.txt", "licenses.txt", "LICENSE", "LICENSES"),
    "changelog": ("changelog", "CHANGELOG", "CHANGELOG.md", "changelog.md"),
    "ci_log": ("ci.log", "build.log", "pipeline.log"),
    "signature": (".sig", ".asc", ".sign"),
}


class FileIndexer:
    def __init__(self, base_path: Path):
        self.base_path = base_path.resolve()
        self.entries: Dict[str, FileEntry] = {}
        self._type_groups: Dict[str, List[FileEntry]] = {
            "tar": [], "zip": [], "checksum": [], "sbom": [], 
            "license": [], "changelog": [], "ci_log": [], "signature": [], "other": []
        }
    
    def scan(self, include_patterns: Optional[List[str]] = None) -> Dict[str, FileEntry]:
        from datetime import datetime
        
        scan_time = datetime.now().isoformat()
        
        for root, dirs, files in os.walk(self.base_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d != "__pycache__"]
            
            for filename in files:
                if filename.startswith('.'):
                    continue
                    
                file_path = Path(root) / filename
                rel_path = str(file_path.relative_to(self.base_path))
                
                if include_patterns:
                    matched = False
                    for pattern in include_patterns:
                        if fnmatchcase(filename, pattern) or fnmatchcase(rel_path, pattern):
                            matched = True
                            break
                    if not matched:
                        continue
                
                entry = self._create_entry(file_path, rel_path, filename, scan_time)
                self.entries[rel_path] = entry
                
                file_type = self._detect_file_type(filename)
                if file_type in self._type_groups:
                    self._type_groups[file_type].append(entry)
                else:
                    self._type_groups["other"].append(entry)
        
        return self.entries
    
    def _create_entry(self, file_path: Path, rel_path: str, filename: str, scan_time: str) -> FileEntry:
        sha256 = self._calculate_sha256(file_path)
        size = file_path.stat().st_size
        file_type = self._detect_file_type(filename)
        version = self._extract_version(filename)
        
        return FileEntry(
            path=rel_path,
            filename=filename,
            file_type=file_type,
            size=size,
            sha256=sha256,
            version=version,
            scan_time=scan_time
        )
    
    @staticmethod
    def _calculate_sha256(file_path: Path, chunk_size: int = 8192) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(chunk_size), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    @staticmethod
    def _detect_file_type(filename: str) -> str:
        lower_name = filename.lower()
        
        for file_type, patterns in ARTIFACT_TYPES.items():
            for pattern in patterns:
                if lower_name.endswith(pattern) or lower_name == pattern:
                    return file_type
        
        return "other"
    
    @staticmethod
    def _extract_version(filename: str) -> Optional[str]:
        patterns = [
            r'v?(\d+\.\d+\.\d+(?:-[\w\.]+)?)',
            r'version[\-_]?(\d+\.\d+\.\d+(?:-[\w\.]+)?)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, filename, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def get_by_type(self, file_type: str) -> List[FileEntry]:
        return self._type_groups.get(file_type, [])
    
    def get_all_artifacts(self) -> List[FileEntry]:
        artifacts = []
        for file_type in ["tar", "zip"]:
            artifacts.extend(self._type_groups.get(file_type, []))
        return artifacts
    
    def get_index_summary(self) -> dict:
        type_counts = Counter()
        for entry in self.entries.values():
            type_counts[entry.file_type] += 1
        
        versions_found = set()
        for entry in self.entries.values():
            if entry.version:
                versions_found.add(entry.version)
        
        return {
            "base_path": str(self.base_path),
            "total_files": len(self.entries),
            "files_by_type": dict(type_counts),
            "versions_detected": sorted(list(versions_found)),
            "scan_time": next(iter(self.entries.values())).scan_time if self.entries else None,
        }
