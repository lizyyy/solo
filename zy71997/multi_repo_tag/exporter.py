from __future__ import annotations

import io
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import ChangeDiff, ChangeOrder, LedgerEntry, Repository, RepoStatus, TagAction, VersionTag
from .store import Store


class LedgerExporter:
    def __init__(self, store: Store):
        self.store = store

    def export_text(self, since: Optional[datetime] = None, until: Optional[datetime] = None) -> str:
        entries = self.store.query_ledger(since=since, until=until, limit=10000)
        if not entries:
            return "# 多仓库版本标记 - 运行账本 (无记录)\n"

        lines = []
        lines.append("=" * 72)
        lines.append("多仓库版本标记 - 运行账本")
        lines.append(f"导出时间: {datetime.now().isoformat()}")
        if since:
            lines.append(f"起始: {since.isoformat()}")
        if until:
            lines.append(f"截止: {until.isoformat()}")
        lines.append(f"共 {len(entries)} 条记录")
        lines.append("=" * 72)
        lines.append("")

        for e in entries:
            ts = e.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            action_label = _action_label(e.action)
            line = f"[{ts}] {action_label}"
            if e.operator:
                line += f" | 操作人: {e.operator}"
            lines.append(line)
            if e.detail:
                for dl in e.detail.split("\n"):
                    lines.append(f"  {dl}")
            lines.append("")

        return "\n".join(lines)

    def export_json(self, since: Optional[datetime] = None, until: Optional[datetime] = None) -> str:
        entries = self.store.query_ledger(since=since, until=until, limit=10000)
        data = []
        for e in entries:
            data.append({
                "timestamp": e.timestamp.isoformat(),
                "action": e.action.value,
                "operator": e.operator,
                "detail": e.detail,
                "repo_id": e.repo_id,
                "tag_id": e.tag_id,
                "change_order_id": e.change_order_id,
                "diff_id": e.diff_id,
            })
        return json.dumps(data, ensure_ascii=False, indent=2)

    def export_handoff_report(self) -> str:
        lines = []
        lines.append("=" * 72)
        lines.append("多仓库版本标记 - 交接报告")
        lines.append(f"生成时间: {datetime.now().isoformat()}")
        lines.append("=" * 72)
        lines.append("")

        lines.append("## 1. 仓库状态总览")
        lines.append("-" * 40)
        repos = self.store.list_repos()
        for r in repos:
            status_mark = _status_mark(r.status)
            lines.append(f"  {status_mark} {r.name} ({r.path})")
            lines.append(f"    状态: {r.status.value} | 当前标签: {r.current_tag or '无'} | 分支: {r.git_branch or '?'} | HEAD: {r.git_head_short or '?'}")
            if r.error_detail:
                lines.append(f"    异常: {r.error_detail}")
        lines.append("")

        lines.append("## 2. 未确认标签")
        lines.append("-" * 40)
        all_tags = self.store.get_all_tags(confirmed_only=False)
        unconfirmed = [t for t in all_tags if not t.confirmed]
        if unconfirmed:
            for t in unconfirmed:
                repo = self.store.get_repo(t.repo_id)
                repo_name = repo.name if repo else "?"
                lines.append(f"  ! {repo_name}: {t.tag_name} (待确认, 操作人: {t.operator or '未知'})")
        else:
            lines.append("  (无)")
        lines.append("")

        lines.append("## 3. 未确认的变更差异")
        lines.append("-" * 40)
        unack = self.store.get_unacknowledged_diffs()
        if unack:
            for d in unack:
                lines.append(f"  !! 变更单 {d.order_id}: v{d.old_version} -> v{d.new_version}")
                if d.added_entries:
                    for e in d.added_entries:
                        lines.append(f"     + 新增: {e.repo_path} = {e.tag_name}")
                if d.removed_entries:
                    for e in d.removed_entries:
                        lines.append(f"     - 移除: {e.repo_path} = {e.tag_name}")
                if d.modified_entries:
                    for old, new in d.modified_entries:
                        lines.append(f"     ~ 变更: {new.repo_path}: {old.tag_name} -> {new.tag_name}")
        else:
            lines.append("  (无)")
        lines.append("")

        lines.append("## 4. 最近操作记录 (最近50条)")
        lines.append("-" * 40)
        recent = self.store.query_ledger(limit=50)
        for e in recent:
            ts = e.timestamp.strftime("%m-%d %H:%M")
            lines.append(f"  [{ts}] {_action_label(e.action)} | {e.detail[:60]}")
        lines.append("")

        return "\n".join(lines)

    def write_to_file(self, content: str, path: str) -> str:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return str(p)


def _action_label(action: TagAction) -> str:
    labels = {
        TagAction.IMPORT_REPO: "导入仓库",
        TagAction.IMPORT_CHANGE_ORDER: "导入变更单",
        TagAction.APPLY_TAG: "打标签",
        TagAction.REVIEW_TAG: "复核标签",
        TagAction.CORRECT_TAG: "修正标签",
        TagAction.REUPLOAD_CHANGE_ORDER: "变更单补传",
        TagAction.EXPORT_LEDGER: "导出账本",
    }
    return labels.get(action, action.value)


def _status_mark(status: RepoStatus) -> str:
    marks = {
        RepoStatus.READY: "[OK]",
        RepoStatus.TAGGED: "[TAG]",
        RepoStatus.NEEDS_REVIEW: "[!!]",
        RepoStatus.PATH_MISSING: "[XX]",
        RepoStatus.NOT_GIT_REPO: "[??]",
        RepoStatus.TAG_CONFLICT: "[!!]",
        RepoStatus.UNKNOWN: "[??]",
    }
    return marks.get(status, "[??]")
