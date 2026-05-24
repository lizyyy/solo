import os
from pathlib import Path
from typing import List, Set, Dict
import pathspec

from .constants import DEFAULT_EXCLUDE_PATTERNS


class FileScanner:
    def __init__(
        self,
        repo_root: str = ".",
        exclude_patterns: List[str] = None,
        include_empty_dirs: bool = False,
        follow_symlinks: bool = False,
    ):
        self.repo_root = Path(repo_root).resolve()
        self.exclude_patterns = exclude_patterns or DEFAULT_EXCLUDE_PATTERNS.copy()
        self.include_empty_dirs = include_empty_dirs
        self.follow_symlinks = follow_symlinks
        self._exclude_spec = None
        self._build_exclude_spec()

    def _build_exclude_spec(self):
        if self.exclude_patterns:
            self._exclude_spec = pathspec.PathSpec.from_lines(
                "gitwildmatch", self.exclude_patterns
            )

    def add_exclude_patterns(self, patterns: List[str]):
        self.exclude_patterns.extend(patterns)
        self._build_exclude_spec()

    def _is_excluded(self, rel_path: str) -> bool:
        if self._exclude_spec:
            return self._exclude_spec.match_file(rel_path)
        return False

    def scan_files(self) -> List[str]:
        files = []
        for root, dirs, filenames in os.walk(
            self.repo_root, followlinks=self.follow_symlinks
        ):
            rel_root = Path(root).relative_to(self.repo_root)
            rel_root_str = str(rel_root).replace(os.sep, "/") if str(rel_root) != "." else ""

            dirs_to_remove = []
            for d in dirs:
                rel_dir = f"{rel_root_str}/{d}" if rel_root_str else d
                if self._is_excluded(rel_dir):
                    dirs_to_remove.append(d)
            for d in dirs_to_remove:
                dirs.remove(d)

            for filename in filenames:
                rel_path = f"{rel_root_str}/{filename}" if rel_root_str else filename
                if not self._is_excluded(rel_path):
                    files.append(rel_path)

        return sorted(files)

    def scan_empty_dirs(self) -> List[str]:
        empty_dirs = []
        for root, dirs, filenames in os.walk(
            self.repo_root, followlinks=self.follow_symlinks
        ):
            rel_root = Path(root).relative_to(self.repo_root)
            rel_root_str = str(rel_root).replace(os.sep, "/") if str(rel_root) != "." else ""

            self._filter_dirs_for_empty(root, dirs)

            if not filenames and not dirs:
                if rel_root_str and not self._is_excluded(rel_root_str):
                    empty_dirs.append(rel_root_str + "/")

        return sorted(empty_dirs)

    def _filter_dirs_for_empty(self, root: str, dirs: List[str]):
        dirs_to_remove = []
        rel_root = Path(root).relative_to(self.repo_root)
        rel_root_str = str(rel_root).replace(os.sep, "/") if str(rel_root) != "." else ""

        for d in dirs:
            rel_dir = f"{rel_root_str}/{d}" if rel_root_str else d
            if self._is_excluded(rel_dir):
                dirs_to_remove.append(d)

        for d in dirs_to_remove:
            dirs.remove(d)

    def scan(self) -> Dict[str, List[str]]:
        result = {
            "files": self.scan_files(),
            "empty_dirs": self.scan_empty_dirs() if self.include_empty_dirs else [],
        }
        return result

    def get_file_counts_by_extension(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for file_path in self.scan_files():
            ext = Path(file_path).suffix.lower() or "(no extension)"
            counts[ext] = counts.get(ext, 0) + 1
        return dict(sorted(counts.items(), key=lambda x: -x[1]))
