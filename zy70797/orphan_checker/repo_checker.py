import os
import re
from datetime import datetime, timedelta
from typing import Optional
from git import Repo, InvalidGitRepositoryError, NoSuchPathError
from urllib.parse import urlparse
from .models import EvidenceResult, EvidenceStatus, SourceType, ServiceEntry


class RepositoryChecker:
    def __init__(self, base_path: str = "", max_age_days: int = 365):
        self.base_path = os.path.abspath(base_path) if base_path else ""
        self.max_age_days = max_age_days

    def check_repository(self, service_entry: ServiceEntry) -> EvidenceResult:
        repo_url = service_entry.repository

        if not repo_url:
            return EvidenceResult(
                source_type=SourceType.REPOSITORY,
                status=EvidenceStatus.UNKNOWN,
                message="No repository URL configured",
                details={"service_name": service_entry.service_name},
            )

        try:
            if self._is_local_path(repo_url):
                return self._check_local_repository(repo_url, service_entry)
            else:
                return self._check_remote_repository(repo_url, service_entry)
        except Exception as e:
            return EvidenceResult(
                source_type=SourceType.REPOSITORY,
                status=EvidenceStatus.ERROR,
                message=f"Repository check failed: {str(e)}",
                details={
                    "service_name": service_entry.service_name,
                    "repository": repo_url,
                },
                error=e,
            )

    def _is_local_path(self, path_or_url: str) -> bool:
        if re.match(r"^[\w.-]+@[\w.-]+:.+", path_or_url):
            return False
        if os.path.exists(path_or_url):
            return True
        if self.base_path and os.path.exists(os.path.join(self.base_path, path_or_url)):
            return True
        parsed = urlparse(path_or_url)
        return not parsed.scheme or parsed.scheme in ["file"]

    def _check_local_repository(self, repo_path: str, service_entry: ServiceEntry) -> EvidenceResult:
        full_path = repo_path
        if not os.path.exists(full_path) and self.base_path:
            full_path = os.path.join(self.base_path, repo_path)

        if not os.path.exists(full_path):
            return EvidenceResult(
                source_type=SourceType.REPOSITORY,
                status=EvidenceStatus.DEAD,
                message="Local repository path does not exist",
                details={
                    "service_name": service_entry.service_name,
                    "repository": repo_path,
                    "checked_path": full_path,
                },
            )

        try:
            repo = Repo(full_path)
            if repo.bare:
                return EvidenceResult(
                    source_type=SourceType.REPOSITORY,
                    status=EvidenceStatus.DEAD,
                    message="Repository is bare (no working tree)",
                    details={
                        "service_name": service_entry.service_name,
                        "repository": full_path,
                    },
                )

            try:
                last_commit = repo.head.commit
                commit_date = datetime.fromtimestamp(last_commit.committed_date)
                age_days = (datetime.now() - commit_date).days

                is_active = age_days <= self.max_age_days

                return EvidenceResult(
                    source_type=SourceType.REPOSITORY,
                    status=EvidenceStatus.ALIVE if is_active else EvidenceStatus.DEAD,
                    message=f"Last commit was {age_days} days ago" if not is_active else "Repository is active",
                    details={
                        "service_name": service_entry.service_name,
                        "repository": full_path,
                        "last_commit_date": commit_date.isoformat(),
                        "last_commit_author": last_commit.author.name,
                        "last_commit_hash": last_commit.hexsha,
                        "age_days": age_days,
                        "branch_count": len(repo.heads),
                    },
                )
            except ValueError:
                return EvidenceResult(
                    source_type=SourceType.REPOSITORY,
                    status=EvidenceStatus.UNKNOWN,
                    message="Repository has no commits",
                    details={
                        "service_name": service_entry.service_name,
                        "repository": full_path,
                    },
                )

        except InvalidGitRepositoryError:
            return EvidenceResult(
                source_type=SourceType.REPOSITORY,
                status=EvidenceStatus.DEAD,
                message="Path exists but is not a valid Git repository",
                details={
                    "service_name": service_entry.service_name,
                    "repository": full_path,
                },
            )
        except NoSuchPathError:
            return EvidenceResult(
                source_type=SourceType.REPOSITORY,
                status=EvidenceStatus.DEAD,
                message="Repository path does not exist",
                details={
                    "service_name": service_entry.service_name,
                    "repository": full_path,
                },
            )

    def _check_remote_repository(self, repo_url: str, service_entry: ServiceEntry) -> EvidenceResult:
        parsed = urlparse(repo_url)
        is_ssh_format = re.match(r"^[\w.-]+@[\w.-]+:.+", repo_url) is not None

        if not parsed.scheme and not is_ssh_format:
            return EvidenceResult(
                source_type=SourceType.REPOSITORY,
                status=EvidenceStatus.UNKNOWN,
                message="Cannot verify remote repository without network access",
                details={
                    "service_name": service_entry.service_name,
                    "repository": repo_url,
                    "host": parsed.netloc,
                    "path": parsed.path,
                },
            )

        github_match = re.match(r"(?:https?://|git@)github\.com[:/]([^/]+)/([^/.]+)(?:\.git)?$", repo_url)
        if github_match:
            owner, repo_name = github_match.groups()
            return EvidenceResult(
                source_type=SourceType.REPOSITORY,
                status=EvidenceStatus.UNKNOWN,
                message="Remote GitHub repository detected (network check disabled)",
                details={
                    "service_name": service_entry.service_name,
                    "repository": repo_url,
                    "github_owner": owner,
                    "github_repo": repo_name,
                },
            )

        return EvidenceResult(
            source_type=SourceType.REPOSITORY,
            status=EvidenceStatus.UNKNOWN,
            message="Remote repository URL format recognized but verification requires network access",
            details={
                "service_name": service_entry.service_name,
                "repository": repo_url,
                "scheme": parsed.scheme,
                "host": parsed.netloc,
            },
        )
