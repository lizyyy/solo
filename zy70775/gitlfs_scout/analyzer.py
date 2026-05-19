from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set

from .git_scanner import LFSFile, ScanResult


@dataclass
class PathStats:
    path: str
    total_size: int = 0
    file_count: int = 0
    unique_oids: Set[str] = field(default_factory=set)
    files: List[LFSFile] = field(default_factory=list)


@dataclass
class AuthorStats:
    author: str
    total_size: int = 0
    file_count: int = 0
    paths: Set[str] = field(default_factory=set)


@dataclass
class AnalysisResult:
    total_size: int = 0
    unique_size: int = 0
    total_files: int = 0
    unique_files: int = 0
    by_path: Dict[str, PathStats] = field(default_factory=dict)
    by_author: Dict[str, AuthorStats] = field(default_factory=dict)
    by_oid: Dict[str, List[LFSFile]] = field(default_factory=dict)
    top_files: List[LFSFile] = field(default_factory=list)
    duplicate_oids: Dict[str, int] = field(default_factory=dict)


class LFSAnalyzer:
    @staticmethod
    def format_size(size_bytes: int) -> str:
        units = ["B", "KB", "MB", "GB", "TB"]
        size = float(size_bytes)
        unit_index = 0
        while size >= 1024 and unit_index < len(units) - 1:
            size /= 1024
            unit_index += 1
        return f"{size:.2f} {units[unit_index]}"

    @staticmethod
    def get_path_level(path: str, level: int) -> str:
        parts = Path(path).parts
        if len(parts) <= level:
            return path
        return str(Path(*parts[:level]))

    def analyze(self, scan_result: ScanResult, path_level: Optional[int] = None,
                min_size: Optional[int] = None) -> AnalysisResult:
        analysis = AnalysisResult()
        
        filtered_files = scan_result.lfs_files
        if min_size:
            filtered_files = [f for f in filtered_files if f.size >= min_size]

        analysis.total_files = len(filtered_files)
        analysis.total_size = sum(f.size for f in filtered_files)

        oid_sizes: Dict[str, int] = {}
        for lfs_file in filtered_files:
            analysis.by_oid.setdefault(lfs_file.oid, []).append(lfs_file)
            oid_sizes[lfs_file.oid] = lfs_file.size

        analysis.unique_files = len(analysis.by_oid)
        analysis.unique_size = sum(oid_sizes.values())

        for oid, files in analysis.by_oid.items():
            if len(files) > 1:
                analysis.duplicate_oids[oid] = len(files)

        for lfs_file in filtered_files:
            path_key = self.get_path_level(lfs_file.path, path_level) if path_level else lfs_file.path
            if path_key not in analysis.by_path:
                analysis.by_path[path_key] = PathStats(path=path_key)
            
            path_stats = analysis.by_path[path_key]
            path_stats.total_size += lfs_file.size
            path_stats.file_count += 1
            path_stats.unique_oids.add(lfs_file.oid)
            path_stats.files.append(lfs_file)

            if lfs_file.commit_author:
                author_key = lfs_file.commit_author
                if author_key not in analysis.by_author:
                    analysis.by_author[author_key] = AuthorStats(author=author_key)
                
                author_stats = analysis.by_author[author_key]
                author_stats.total_size += lfs_file.size
                author_stats.file_count += 1
                author_stats.paths.add(lfs_file.path)

        sorted_files = sorted(filtered_files, key=lambda f: f.size, reverse=True)
        analysis.top_files = sorted_files[:100]

        return analysis

    def get_paths_sorted_by_size(self, analysis: AnalysisResult, limit: int = 20) -> List[PathStats]:
        return sorted(analysis.by_path.values(), key=lambda p: p.total_size, reverse=True)[:limit]

    def get_paths_sorted_by_count(self, analysis: AnalysisResult, limit: int = 20) -> List[PathStats]:
        return sorted(analysis.by_path.values(), key=lambda p: p.file_count, reverse=True)[:limit]

    def get_authors_sorted_by_size(self, analysis: AnalysisResult, limit: int = 20) -> List[AuthorStats]:
        return sorted(analysis.by_author.values(), key=lambda a: a.total_size, reverse=True)[:limit]

    def get_duplicate_summary(self, analysis: AnalysisResult) -> Dict:
        if not analysis.duplicate_oids:
            return {"count": 0, "total_duplicate_size": 0, "details": []}

        total_duplicate_size = 0
        details = []
        for oid, count in analysis.duplicate_oids.items():
            files = analysis.by_oid[oid]
            size = files[0].size if files else 0
            duplicate_size = size * (count - 1)
            total_duplicate_size += duplicate_size
            paths = [f.path for f in files]
            details.append({
                "oid": oid,
                "size": size,
                "count": count,
                "duplicate_size": duplicate_size,
                "paths": paths
            })

        return {
            "count": len(analysis.duplicate_oids),
            "total_duplicate_size": total_duplicate_size,
            "details": sorted(details, key=lambda d: d["duplicate_size"], reverse=True)
        }
