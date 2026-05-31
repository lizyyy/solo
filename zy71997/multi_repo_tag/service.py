from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Optional

from .models import (
    ChangeDiff,
    ChangeOrder,
    ChangeOrderEntry,
    ChangeOrderUploadResult,
    LedgerEntry,
    Repository,
    RepoStatus,
    ServiceError,
    TagAction,
    VersionTag,
)
from .store import Store


def _content_hash(entries: list[ChangeOrderEntry]) -> str:
    payload = json.dumps([e.model_dump() for e in entries], sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _safe_resolve_path(raw: str) -> Path:
    p = Path(raw).expanduser().resolve()
    return p


def _run_git(repo_path: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(repo_path)] + list(args),
        capture_output=True,
        text=True,
        timeout=30,
    )


def _validate_git_repo(path: Path) -> tuple[RepoStatus, Optional[str], Optional[str], Optional[str]]:
    if not path.exists():
        return RepoStatus.PATH_MISSING, None, None, f"路径不存在: {path}"
    if not (path / ".git").exists():
        return RepoStatus.NOT_GIT_REPO, None, None, f"不是 git 仓库: {path}"
    branch_result = _run_git(path, "rev-parse", "--abbrev-ref", "HEAD")
    head_result = _run_git(path, "rev-parse", "--short", "HEAD")
    branch = branch_result.stdout.strip() if branch_result.returncode == 0 else None
    head = head_result.stdout.strip() if head_result.returncode == 0 else None
    if branch is None:
        return RepoStatus.NOT_GIT_REPO, None, None, f"git 命令失败: {branch_result.stderr.strip()}"
    return RepoStatus.READY, branch, head, None


def _check_tag_exists(repo_path: Path, tag_name: str) -> bool:
    result = _run_git(repo_path, "tag", "-l", tag_name)
    return result.stdout.strip() == tag_name


class MultiRepoTagService:
    def __init__(self, db_path: str = "multi_repo_tag.db", operator: str = ""):
        self.store = Store(db_path)
        self.operator = operator

    def _log(self, action: TagAction, detail: str, **kwargs):
        entry = LedgerEntry(
            action=action,
            operator=self.operator,
            detail=detail,
            **kwargs,
        )
        self.store.insert_ledger(entry)

    def import_repo(self, raw_path: str, name: Optional[str] = None) -> Repository:
        path = _safe_resolve_path(raw_path)
        path_str = str(path)
        existing = self.store.get_repo_by_path(path_str)
        if existing:
            status, branch, head, err = _validate_git_repo(path)
            existing.status = status
            existing.git_branch = branch
            existing.git_head_short = head
            existing.error_detail = err
            self.store.upsert_repo(existing)
            self._log(TagAction.IMPORT_REPO, f"重新导入仓库: {path_str}", repo_id=existing.id)
            return existing

        repo_name = name or path.name
        status, branch, head, err = _validate_git_repo(path)
        repo = Repository(
            path=path_str,
            name=repo_name,
            status=status,
            git_branch=branch,
            git_head_short=head,
            error_detail=err,
        )
        repo = self.store.upsert_repo(repo)
        self._log(TagAction.IMPORT_REPO, f"导入仓库: {path_str} -> {status.value}", repo_id=repo.id)
        return repo

    def import_repos_batch(self, paths: list[str]) -> list[Repository]:
        results = []
        for p in paths:
            try:
                results.append(self.import_repo(p))
            except Exception as e:
                results.append(Repository(
                    path=p,
                    name=Path(p).name,
                    status=RepoStatus.UNKNOWN,
                    error_detail=f"导入失败: {e}",
                ))
        return results

    def refresh_repo(self, repo_id: str) -> Repository:
        repo = self.store.get_repo(repo_id)
        if repo is None:
            raise ServiceError("REPO_NOT_FOUND", f"仓库不存在: {repo_id}")
        path = Path(repo.path)
        status, branch, head, err = _validate_git_repo(path)
        repo.status = status
        repo.git_branch = branch
        repo.git_head_short = head
        repo.error_detail = err
        self.store.upsert_repo(repo)
        return repo

    def import_change_order(
        self,
        order_id: str,
        entries: list[dict],
        operator: Optional[str] = None,
    ) -> ChangeOrderUploadResult:
        parsed_entries = [ChangeOrderEntry(**e) for e in entries]
        new_hash = _content_hash(parsed_entries)
        op = operator or self.operator
        existing = self.store.get_latest_change_order(order_id)

        if existing is None:
            co = ChangeOrder(
                order_id=order_id,
                entries=parsed_entries,
                content_hash=new_hash,
                version=1,
                operator=op,
            )
            co = self.store.insert_change_order(co)
            self._log(TagAction.IMPORT_CHANGE_ORDER, f"新变更单 {order_id} v1", change_order_id=co.id)
            return ChangeOrderUploadResult(change_order=co, is_reupload=False)

        if existing.content_hash == new_hash:
            return ChangeOrderUploadResult(
                change_order=existing,
                is_reupload=True,
                warning=f"变更单 {order_id} 内容与 v{existing.version} 完全一致，未产生变更",
            )

        diff = self._compute_diff(existing, parsed_entries)
        new_version = existing.version + 1
        self.store.mark_order_superseded(order_id, new_version)

        co = ChangeOrder(
            order_id=order_id,
            entries=parsed_entries,
            content_hash=new_hash,
            version=new_version,
            operator=op,
        )
        co = self.store.insert_change_order(co)
        diff.new_version = new_version
        diff = self.store.insert_diff(diff)

        diff_desc = self._describe_diff(diff)
        self._log(
            TagAction.REUPLOAD_CHANGE_ORDER,
            f"变更单 {order_id} v{existing.version} -> v{new_version}: {diff_desc}",
            change_order_id=co.id,
            diff_id=diff.id,
        )

        warning = (
            f"变更单 {order_id} 已有 v{existing.version}，新上传内容为 v{new_version}。\n"
            f"变更差异:\n{diff_desc}\n"
            f"请确认后继续。相关仓库状态已标记为 needs_review。"
        )

        self._mark_affected_repos_needs_review(parsed_entries)

        return ChangeOrderUploadResult(
            change_order=co,
            is_reupload=True,
            diff=diff,
            warning=warning,
        )

    def _compute_diff(self, old_co: ChangeOrder, new_entries: list[ChangeOrderEntry]) -> ChangeDiff:
        old_by_path = {e.repo_path: e for e in old_co.entries}
        new_by_path = {e.repo_path: e for e in new_entries}

        added = []
        removed = []
        modified = []

        for path, entry in new_by_path.items():
            if path not in old_by_path:
                added.append(entry)
            elif (entry.tag_name != old_by_path[path].tag_name or entry.description != old_by_path[path].description):
                modified.append((old_by_path[path], entry))

        for path, entry in old_by_path.items():
            if path not in new_by_path:
                removed.append(entry)

        return ChangeDiff(
            order_id=old_co.order_id,
            old_version=old_co.version,
            new_version=0,
            old_hash=old_co.content_hash,
            new_hash=_content_hash(new_entries),
            added_entries=added,
            removed_entries=removed,
            modified_entries=modified,
        )

    def _describe_diff(self, diff: ChangeDiff) -> str:
        parts = []
        if diff.added_entries:
            parts.append(f"+新增 {len(diff.added_entries)} 条: " + ", ".join(f"{e.repo_path}={e.tag_name}" for e in diff.added_entries))
        if diff.removed_entries:
            parts.append(f"-移除 {len(diff.removed_entries)} 条: " + ", ".join(f"{e.repo_path}={e.tag_name}" for e in diff.removed_entries))
        if diff.modified_entries:
            for old, new in diff.modified_entries:
                parts.append(f"~变更 {new.repo_path}: {old.tag_name} -> {new.tag_name}")
        if not parts:
            parts.append("内容无实质差异(仅格式变化)")
        return "\n".join(parts)

    def _mark_affected_repos_needs_review(self, entries: list[ChangeOrderEntry]):
        for entry in entries:
            path = _safe_resolve_path(entry.repo_path)
            repo = self.store.get_repo_by_path(str(path))
            if repo:
                repo.status = RepoStatus.NEEDS_REVIEW
                repo.error_detail = f"变更单补传，仓库需要复核"
                self.store.upsert_repo(repo)

    def apply_tag(self, repo_id: str, tag_name: str, tag_message: str = "", change_order_id: Optional[str] = None) -> VersionTag:
        repo = self.store.get_repo(repo_id)
        if repo is None:
            raise ServiceError("REPO_NOT_FOUND", f"仓库不存在: {repo_id}")
        path = Path(repo.path)
        if not path.exists():
            raise ServiceError("PATH_MISSING", f"仓库路径不存在: {path}", detail={"path": str(path)})
        if not (path / ".git").exists():
            raise ServiceError("NOT_GIT_REPO", f"不是 git 仓库: {path}", detail={"path": str(path)})

        if _check_tag_exists(path, tag_name):
            raise ServiceError("TAG_EXISTS", f"标签 {tag_name} 已存在于仓库 {repo.name}", detail={"repo": repo.name, "tag": tag_name})

        result = _run_git(path, "tag", "-a", tag_name, "-m", tag_message)
        if result.returncode != 0:
            raise ServiceError("GIT_TAG_FAILED", f"git tag 失败: {result.stderr.strip()}", detail={"stderr": result.stderr.strip(), "path": str(path)})

        tag = VersionTag(
            repo_id=repo_id,
            tag_name=tag_name,
            tag_message=tag_message,
            change_order_id=change_order_id,
            operator=self.operator,
            confirmed=False,
        )
        tag = self.store.insert_tag(tag)
        self.store.update_repo_tag(repo_id, tag_name, RepoStatus.TAGGED)
        self._log(TagAction.APPLY_TAG, f"仓库 {repo.name} 打标签 {tag_name}", repo_id=repo_id, tag_id=tag.id, change_order_id=change_order_id)
        return tag

    def apply_tags_from_order(self, order_id: str, operator: Optional[str] = None) -> list[VersionTag]:
        if operator:
            self.operator = operator
        co = self.store.get_latest_change_order(order_id)
        if co is None:
            raise ServiceError("ORDER_NOT_FOUND", f"变更单不存在: {order_id}")

        unack_diffs = self.store.get_unacknowledged_diffs()
        order_diffs = [d for d in unack_diffs if d.order_id == order_id]
        if order_diffs:
            diff_desc = self._describe_diff(order_diffs[0])
            raise ServiceError(
                "UNACKNOWLEDGED_DIFF",
                f"变更单 {order_id} 存在未确认的变更差异，请先确认后再打标签。\n差异:\n{diff_desc}",
                detail={"diff_id": order_diffs[0].id},
            )

        results = []
        errors = []
        for entry in co.entries:
            path = _safe_resolve_path(entry.repo_path)
            repo = self.store.get_repo_by_path(str(path))
            if repo is None:
                repo = self.import_repo(str(path))

            if repo.status in (RepoStatus.PATH_MISSING, RepoStatus.NOT_GIT_REPO):
                errors.append(f"{entry.repo_path}: 仓库状态异常({repo.status.value}) - {repo.error_detail}")
                continue

            try:
                tag = self.apply_tag(repo.id, entry.tag_name, entry.description, co.id)
                results.append(tag)
            except ServiceError as e:
                errors.append(f"{entry.repo_path}: {e.message}")

        if errors:
            self._log(TagAction.APPLY_TAG, f"变更单 {order_id} 批量打标签完成，{len(errors)} 个失败: {'; '.join(errors)}", change_order_id=co.id)

        return results

    def review_tags(self, repo_id: Optional[str] = None) -> list[dict]:
        if repo_id:
            repos = [self.store.get_repo(repo_id)]
            repos = [r for r in repos if r is not None]
        else:
            repos = self.store.list_repos()

        review_data = []
        for repo in repos:
            tags = self.store.get_tags_for_repo(repo.id)
            review_data.append({
                "repo_id": repo.id,
                "repo_name": repo.name,
                "repo_path": repo.path,
                "status": repo.status.value,
                "current_tag": repo.current_tag,
                "git_branch": repo.git_branch,
                "git_head_short": repo.git_head_short,
                "error_detail": repo.error_detail,
                "tags": [
                    {
                        "tag_id": t.id,
                        "tag_name": t.tag_name,
                        "tag_message": t.tag_message,
                        "confirmed": t.confirmed,
                        "operator": t.operator,
                        "change_order_id": t.change_order_id,
                        "created_at": t.created_at.isoformat(),
                        "superseded_by": t.superseded_by,
                    }
                    for t in tags
                ],
            })
        return review_data

    def confirm_tag(self, tag_id: str) -> VersionTag:
        tag = self.store.get_tag(tag_id)
        if tag is None:
            raise ServiceError("TAG_NOT_FOUND", f"标签不存在: {tag_id}")
        if tag.confirmed:
            return tag
        tag = self.store.confirm_tag(tag_id)
        repo = self.store.get_repo(tag.repo_id)
        self._log(TagAction.REVIEW_TAG, f"确认仓库 {repo.name if repo else '?'} 的标签 {tag.tag_name}", repo_id=tag.repo_id, tag_id=tag_id)
        return tag

    def confirm_all_tags(self, repo_id: str) -> list[VersionTag]:
        tags = self.store.get_tags_for_repo(repo_id)
        confirmed = []
        for t in tags:
            if not t.confirmed:
                confirmed.append(self.confirm_tag(t.id))
        return confirmed

    def correct_tag(self, repo_id: str, old_tag_name: str, new_tag_name: str, reason: str = "") -> VersionTag:
        repo = self.store.get_repo(repo_id)
        if repo is None:
            raise ServiceError("REPO_NOT_FOUND", f"仓库不存在: {repo_id}")
        path = Path(repo.path)

        existing_tags = self.store.get_tags_for_repo(repo_id)
        old_tag = None
        for t in existing_tags:
            if t.tag_name == old_tag_name:
                old_tag = t
                break
        if old_tag is None:
            raise ServiceError("TAG_NOT_FOUND", f"仓库 {repo.name} 不存在标签 {old_tag_name}")

        if _check_tag_exists(path, new_tag_name):
            raise ServiceError("TAG_EXISTS", f"标签 {new_tag_name} 已存在")

        result = _run_git(path, "tag", "-a", new_tag_name, "-m", f"修正自 {old_tag_name}: {reason}")
        if result.returncode != 0:
            raise ServiceError("GIT_TAG_FAILED", f"创建新标签失败: {result.stderr.strip()}")

        delete_result = _run_git(path, "tag", "-d", old_tag_name)
        if delete_result.returncode != 0:
            pass

        new_tag = VersionTag(
            repo_id=repo_id,
            tag_name=new_tag_name,
            tag_message=f"修正自 {old_tag_name}: {reason}",
            operator=self.operator,
            confirmed=False,
            change_order_id=old_tag.change_order_id,
        )
        new_tag = self.store.insert_tag(new_tag)
        self.store.supersede_tag(old_tag.id, new_tag.id)
        self.store.update_repo_tag(repo_id, new_tag_name, RepoStatus.TAGGED)

        self._log(
            TagAction.CORRECT_TAG,
            f"仓库 {repo.name} 修正标签: {old_tag_name} -> {new_tag_name}, 原因: {reason}",
            repo_id=repo_id,
            tag_id=new_tag.id,
        )
        return new_tag

    def acknowledge_diff(self, diff_id: str, operator: Optional[str] = None) -> ChangeDiff:
        diff = self.store.get_diff(diff_id)
        if diff is None:
            raise ServiceError("DIFF_NOT_FOUND", f"差异记录不存在: {diff_id}")
        if diff.acknowledged:
            return diff
        op = operator or self.operator
        self.store.acknowledge_diff(diff_id, op)
        diff.acknowledged = True
        diff.acknowledged_by = op
        self._log(TagAction.REUPLOAD_CHANGE_ORDER, f"确认变更单 {diff.order_id} v{diff.old_version}->v{diff.new_version} 的差异", diff_id=diff_id)
        return diff

    def get_unacknowledged_diffs(self) -> list[ChangeDiff]:
        return self.store.get_unacknowledged_diffs()

    def get_order_history(self, order_id: str) -> list[ChangeOrder]:
        return self.store.get_all_versions_of_order(order_id)

    def get_ledger(
        self,
        action: Optional[TagAction] = None,
        repo_id: Optional[str] = None,
        operator: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: int = 200,
    ) -> list[LedgerEntry]:
        from datetime import datetime as dt
        since_dt = dt.fromisoformat(since) if since else None
        until_dt = dt.fromisoformat(until) if until else None
        return self.store.query_ledger(action=action, repo_id=repo_id, operator=operator, since=since_dt, until=until_dt, limit=limit)

    def get_repo_detail(self, repo_id: str) -> Optional[dict]:
        repo = self.store.get_repo(repo_id)
        if repo is None:
            return None
        tags = self.store.get_tags_for_repo(repo.id, include_superseded=True)
        return {
            "repo": repo,
            "tags": tags,
        }

    def close(self):
        self.store.close()
