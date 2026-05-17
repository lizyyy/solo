from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

import git

from .git_metadata import SubmoduleInfo


@dataclass
class DriftResult:
    submodule: SubmoduleInfo
    has_drift: bool
    is_missing: bool
    commits_ahead: int
    commits_behind: int
    drift_type: Optional[str] = None
    last_updated: Optional[datetime] = None
    remote_status: Optional[str] = None
    errors: List[Dict[str, Any]] = field(default_factory=list)
    raw_context: Dict[str, Any] = field(default_factory=dict)


class DriftDetector:
    def __init__(self, repo_path: Optional[str] = None):
        self.repo_path = Path(repo_path) if repo_path else Path.cwd()

    def detect_drift(self, submodules: List[SubmoduleInfo]) -> List[DriftResult]:
        results: List[DriftResult] = []
        
        for submodule in submodules:
            result = self._detect_single_drift(submodule)
            results.append(result)
        
        return results

    def _detect_single_drift(self, submodule: SubmoduleInfo) -> DriftResult:
        is_missing = self._is_submodule_missing(submodule)
        has_drift = False
        commits_ahead = 0
        commits_behind = 0
        drift_type = None
        errors: List[Dict[str, Any]] = []
        raw_context: Dict[str, Any] = {}

        raw_context["raw_lines"] = submodule.raw_lines
        raw_context["parse_errors"] = submodule.errors

        if submodule.errors:
            errors.extend([{
                "type": e.get("type", "unknown"),
                "message": e.get("message", ""),
                "line_number": e.get("line_number"),
                "line_content": e.get("line_content"),
                "source": "parse"
            } for e in submodule.errors])

        if not is_missing:
            try:
                has_drift, commits_ahead, commits_behind, drift_type, drift_errors = self._analyze_commit_drift(submodule)
                errors.extend([{**e, "source": "drift_detection"} for e in drift_errors])
            except Exception as e:
                errors.append({
                    "type": "analysis_failed",
                    "message": f"Commit drift analysis failed: {str(e)}",
                    "source": "drift_detection"
                })
                has_drift = True
                drift_type = "error"
        else:
            errors.append({
                "type": "submodule_missing",
                "message": f"Submodule directory not found or invalid: {submodule.path}",
                "source": "existence_check"
            })

        return DriftResult(
            submodule=submodule,
            has_drift=has_drift,
            is_missing=is_missing,
            commits_ahead=commits_ahead,
            commits_behind=commits_behind,
            drift_type=drift_type,
            last_updated=datetime.now(),
            errors=errors,
            raw_context=raw_context
        )

    def _is_submodule_missing(self, submodule: SubmoduleInfo) -> bool:
        if not submodule.path:
            return True
            
        submodule_path = self.repo_path / submodule.path
        if not submodule_path.exists():
            return True
        try:
            git.Repo(submodule_path)
            return False
        except Exception:
            return True

    def _analyze_commit_drift(self, submodule: SubmoduleInfo) -> tuple:
        errors: List[Dict[str, Any]] = []

        if not submodule.expected_commit:
            errors.append({
                "type": "missing_expected_commit",
                "message": "Expected commit could not be determined from git index",
                "submodule_name": submodule.name
            })
            return True, 0, 0, "unknown", errors

        if not submodule.actual_commit:
            errors.append({
                "type": "missing_actual_commit",
                "message": "Actual commit could not be determined from submodule",
                "submodule_name": submodule.name
            })
            return True, 0, 0, "unknown", errors

        if submodule.expected_commit == submodule.actual_commit:
            return False, 0, 0, None, errors

        commits_ahead, commits_behind, count_errors = self._count_commit_difference(submodule)
        errors.extend(count_errors)

        if commits_ahead > 0 and commits_behind > 0:
            drift_type = "diverged"
        elif commits_ahead > 0:
            drift_type = "ahead"
        elif commits_behind > 0:
            drift_type = "behind"
        else:
            drift_type = "modified"

        return True, commits_ahead, commits_behind, drift_type, errors

    def _count_commit_difference(self, submodule: SubmoduleInfo) -> tuple:
        errors: List[Dict[str, Any]] = []
        submodule_path = self.repo_path / submodule.path
        
        try:
            repo = git.Repo(submodule_path)
            
            commits_ahead = 0
            try:
                for commit in repo.iter_commits(f"{submodule.expected_commit}..{submodule.actual_commit}"):
                    commits_ahead += 1
            except Exception as e:
                errors.append({
                    "type": "count_ahead_failed",
                    "message": f"Failed to count commits ahead: {str(e)}",
                    "expected_commit": submodule.expected_commit,
                    "actual_commit": submodule.actual_commit
                })

            commits_behind = 0
            try:
                for commit in repo.iter_commits(f"{submodule.actual_commit}..{submodule.expected_commit}"):
                    commits_behind += 1
            except Exception as e:
                errors.append({
                    "type": "count_behind_failed",
                    "message": f"Failed to count commits behind: {str(e)}",
                    "expected_commit": submodule.expected_commit,
                    "actual_commit": submodule.actual_commit
                })

            return commits_ahead, commits_behind, errors
        except Exception as e:
            errors.append({
                "type": "repo_access_failed",
                "message": f"Failed to access submodule repository: {str(e)}",
                "path": str(submodule_path)
            })
            return 0, 0, errors

    def analyze_remote_status(self, submodules: List[SubmoduleInfo]) -> Dict[str, Dict[str, Any]]:
        remote_status: Dict[str, Dict[str, Any]] = {}
        
        for submodule in submodules:
            result: Dict[str, Any] = {
                "status": "unknown",
                "local_commit": None,
                "remote_commit": None,
                "error": None
            }
            
            submodule_path = self.repo_path / submodule.path
            if not submodule_path.exists():
                result["status"] = "missing"
                remote_status[submodule.name] = result
                continue

            try:
                repo = git.Repo(submodule_path)
                if not repo.remotes:
                    result["status"] = "no_remote"
                    remote_status[submodule.name] = result
                    continue

                remote = repo.remote()
                try:
                    remote.fetch()
                    result["local_commit"] = repo.head.commit.hexsha
                    
                    try:
                        remote_commit = repo.rev_parse(f"{remote.name}/{repo.active_branch.name}")
                        result["remote_commit"] = remote_commit.hexsha
                        
                        if result["local_commit"] == result["remote_commit"]:
                            result["status"] = "in_sync"
                        else:
                            result["status"] = "out_of_sync"
                    except Exception as e:
                        result["status"] = "branch_error"
                        result["error"] = f"Failed to get remote branch: {str(e)}"
                except Exception as e:
                    result["status"] = "remote_error"
                    result["error"] = f"Failed to fetch remote: {str(e)}"
            except Exception as e:
                result["status"] = "error"
                result["error"] = f"Failed to access repo: {str(e)}"

            remote_status[submodule.name] = result

        return remote_status

    def detect_with_remote(self, submodules: List[SubmoduleInfo]) -> List[DriftResult]:
        results = self.detect_drift(submodules)
        remote_statuses = self.analyze_remote_status(submodules)
        
        for result in results:
            if result.submodule.name in remote_statuses:
                result.remote_status = remote_statuses[result.submodule.name]["status"]
        
        return results
