import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple
from .models import (
    SubmoduleInfo,
    SubmoduleStatus,
    LockFile,
    DriftReport,
    RiskLevel,
)
from .git_reader import GitReader
from .lock_parser import LockParser


class DriftDetector:
    def __init__(self, repo_root: Path, lock_file: Optional[Path] = None):
        self.repo_root = repo_root.resolve()
        self.lock_file_path = lock_file
        self.git_reader = GitReader(self.repo_root)

    def detect(
        self,
        recursive: bool = True,
        check_ancestry: bool = True,
    ) -> DriftReport:
        report = DriftReport(
            repo_root=self.repo_root,
            scan_time=datetime.now().isoformat(),
        )

        if not self.git_reader.is_git_repo():
            report.errors.append(f"Not a git repository: {self.repo_root}")
            return report

        lock_file = self._parse_lock_file()
        submodules = self.git_reader.read_submodules(recursive=recursive)

        report.submodules = submodules
        report.total_submodules = len(submodules)

        lock_paths = set(lock_file.entries.keys()) if lock_file else set()
        repo_paths = {s.path for s in submodules}

        report.missing_in_lock = list(repo_paths - lock_paths)
        report.not_in_repo = list(lock_paths - repo_paths)

        for submodule in submodules:
            self._evaluate_submodule(submodule, lock_file, check_ancestry)

            if submodule.status == SubmoduleStatus.DRIFTED:
                report.drifted_count += 1
            if submodule.is_detached:
                report.detached_count += 1
            if submodule.has_local_changes:
                report.dirty_count += 1

        report.submodules = self._sort_by_risk(report.submodules)
        return report

    def _parse_lock_file(self) -> Optional[LockFile]:
        if not self.lock_file_path:
            candidates = [
                self.repo_root / "submodules.lock.json",
                self.repo_root / "submodules.lock.yaml",
                self.repo_root / "submodules.lock.yml",
                self.repo_root / "submodules.lock",
                self.repo_root / ".gitmodules.lock",
                self.repo_root / "versions.lock",
            ]
            for candidate in candidates:
                if candidate.exists():
                    self.lock_file_path = candidate
                    break

        if self.lock_file_path and self.lock_file_path.exists():
            try:
                return LockParser.parse(self.lock_file_path)
            except Exception:
                return None
        return None

    def _evaluate_submodule(
        self,
        submodule: SubmoduleInfo,
        lock_file: Optional[LockFile],
        check_ancestry: bool,
    ) -> None:
        locked_commit = None
        if lock_file:
            for path_key, commit in lock_file.entries.items():
                if self._paths_match(submodule.path, path_key):
                    locked_commit = commit
                    break

        if locked_commit:
            submodule.locked_commit = locked_commit
            submodule_path = self.repo_root / submodule.path
            if submodule_path.exists():
                submodule.locked_commit_info = self.git_reader.get_commit_info(
                    locked_commit, cwd=submodule_path
                )

        if submodule.status in (SubmoduleStatus.UNINITIALIZED, SubmoduleStatus.MISSING):
            submodule.risk_level = RiskLevel.HIGH
            submodule.drift_reason = (
                "子模块未初始化"
                if submodule.status == SubmoduleStatus.UNINITIALIZED
                else "子模块目录缺失"
            )
            return

        is_drifted, reason = self._check_drift(submodule, locked_commit, check_ancestry)

        if is_drifted:
            submodule.status = SubmoduleStatus.DRIFTED
            submodule.drift_reason = reason
            submodule.risk_level = self._calculate_risk(submodule)
        elif submodule.has_local_changes:
            submodule.risk_level = RiskLevel.MEDIUM
            submodule.drift_reason = "子模块包含未提交的本地修改"
        elif submodule.is_detached:
            submodule.risk_level = RiskLevel.LOW
            submodule.drift_reason = "子模块处于游离头状态"
        else:
            submodule.risk_level = RiskLevel.NONE

    def _check_drift(
        self,
        submodule: SubmoduleInfo,
        locked_commit: Optional[str],
        check_ancestry: bool,
    ) -> Tuple[bool, str]:
        if not locked_commit:
            return False, ""

        current = submodule.current_commit
        if not current:
            return True, "无法获取当前子模块的提交记录"

        if self._commits_match(current, locked_commit):
            return False, ""

        if check_ancestry and submodule.path:
            submodule_path = self.repo_root / submodule.path
            if submodule_path.exists():
                try:
                    is_ancestor = self._is_ancestor(
                        locked_commit, current, submodule_path
                    )
                    is_descendant = self._is_ancestor(
                        current, locked_commit, submodule_path
                    )

                    if is_ancestor:
                        submodule.commits_ahead = self.git_reader.count_commits_between(
                            locked_commit, current, cwd=submodule_path
                        )
                        return True, f"子模块超前锁定版本 {submodule.commits_ahead} 个提交"
                    elif is_descendant:
                        submodule.commits_behind = self.git_reader.count_commits_between(
                            current, locked_commit, cwd=submodule_path
                        )
                        return True, f"子模块落后锁定版本 {submodule.commits_behind} 个提交"
                except Exception:
                    pass

        return True, "子模块当前提交与锁定版本无直接关联"

    def _is_ancestor(self, ancestor: str, descendant: str, cwd: Path) -> bool:
        try:
            result = self.git_reader._run_git(
                ["merge-base", "--is-ancestor", ancestor, descendant],
                cwd=cwd,
            )
            return True
        except Exception:
            return False

    def _commits_match(self, commit1: str, commit2: str) -> bool:
        if not commit1 or not commit2:
            return False
        c1, c2 = commit1.lower(), commit2.lower()
        return c1.startswith(c2) or c2.startswith(c1)

    def _paths_match(self, path1: str, path2: str) -> bool:
        p1 = path1.strip().rstrip("/").lower()
        p2 = path2.strip().rstrip("/").lower()
        return p1 == p2 or p1.endswith("/" + p2) or p2.endswith("/" + p1)

    def _calculate_risk(self, submodule: SubmoduleInfo) -> RiskLevel:
        if submodule.has_local_changes:
            return RiskLevel.CRITICAL

        commit_count = max(submodule.commits_ahead, submodule.commits_behind)

        if commit_count > 50:
            return RiskLevel.CRITICAL
        elif commit_count > 20:
            return RiskLevel.HIGH
        elif commit_count > 5:
            return RiskLevel.MEDIUM
        elif commit_count > 0:
            return RiskLevel.LOW

        return RiskLevel.HIGH

    def _sort_by_risk(self, submodules: List[SubmoduleInfo]) -> List[SubmoduleInfo]:
        risk_order = {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3,
            RiskLevel.NONE: 4,
        }
        return sorted(
            submodules,
            key=lambda s: (
                risk_order.get(s.risk_level, 99),
                -max(s.commits_ahead, s.commits_behind),
                s.path,
            ),
        )

    def parse_build_log(self, log_content: str) -> List[str]:
        patterns = [
            r'[Ff]atal.*?submodule.*?([\w/-]+)',
            r'[Ss]ubmodule.*?([\w/-]+).*?not found',
            r'[Cc]ommit.*?([0-9a-fA-F]{7,40}).*?not exist',
            r'[Nn]o such file or directory.*?submodule.*?([\w/-]+)',
            r'([\w/-]+).*?is not a valid repository',
        ]

        issues = []
        for pattern in patterns:
            matches = re.findall(pattern, log_content)
            issues.extend(matches)

        return list(set(issues))
