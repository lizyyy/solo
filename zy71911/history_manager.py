import os
import json
from typing import List, Optional, Dict, Tuple
from datetime import datetime
from models import CheckResult, Issue, HistoryRecord, IssueStatus
from utils import Config, save_json, load_json, format_time


class HistoryManager:
    def __init__(self):
        Config.ensure_dirs()
        self.history_dir = Config.HISTORY_DIR

    def _get_episode_history_path(self, episode_id: str) -> str:
        return os.path.join(self.history_dir, f"{episode_id}_history.json")

    def _get_check_result_path(self, episode_id: str, version: int) -> str:
        return os.path.join(self.history_dir, f"{episode_id}_v{version:03d}.json")

    def get_next_version(self, episode_id: str) -> int:
        history_path = self._get_episode_history_path(episode_id)
        history = load_json(history_path)
        if not history or "records" not in history:
            return 1
        return len(history["records"]) + 1

    def _issue_to_dict(self, issue: Issue) -> dict:
        return {
            "issue_id": issue.issue_id,
            "issue_type": issue.issue_type.value,
            "start_time": issue.time_segment.start_time,
            "end_time": issue.time_segment.end_time,
            "description": issue.description,
            "reason": issue.reason,
            "next_action": issue.next_action.value,
            "status": issue.status.value,
            "confidence": issue.confidence,
            "notes": issue.notes,
            "subtitle_text": issue.subtitle_line.text if issue.subtitle_line else None,
            "created_at": issue.created_at.isoformat() if issue.created_at else None,
        }

    def _dict_to_issue(self, data: dict) -> Issue:
        from models import TimeSegment, IssueType, NextAction, IssueStatus

        return Issue(
            issue_id=data["issue_id"],
            issue_type=IssueType(data["issue_type"]),
            time_segment=TimeSegment(data["start_time"], data["end_time"]),
            description=data["description"],
            reason=data["reason"],
            next_action=NextAction(data["next_action"]),
            status=IssueStatus(data.get("status", "待处理")),
            confidence=data.get("confidence", 1.0),
            notes=data.get("notes"),
            created_at=(
                datetime.fromisoformat(data["created_at"])
                if data.get("created_at")
                else datetime.now()
            ),
        )

    def save_check_result(self, result: CheckResult) -> str:
        version = result.check_version
        result_path = self._get_check_result_path(result.episode_id, version)

        result_data = {
            "episode_id": result.episode_id,
            "check_version": version,
            "checked_at": result.checked_at.isoformat(),
            "issues": [self._issue_to_dict(issue) for issue in result.issues],
            "total_issues": result.total_issues,
            "notes": result.notes,
        }
        save_json(result_data, result_path)

        self._update_history_index(result)

        return result_path

    def _update_history_index(self, result: CheckResult):
        history_path = self._get_episode_history_path(result.episode_id)
        history = load_json(history_path) or {"episode_id": result.episode_id, "records": []}

        resolved_count = sum(
            1 for issue in result.issues if issue.status == IssueStatus.RESOLVED
        )

        record = {
            "check_version": result.check_version,
            "check_time": result.checked_at.isoformat(),
            "issue_count": result.total_issues,
            "resolved_count": resolved_count,
            "result_path": self._get_check_result_path(
                result.episode_id, result.check_version
            ),
        }

        history["records"].append(record)
        save_json(history, history_path)

    def load_check_result(self, episode_id: str, version: int) -> Optional[CheckResult]:
        result_path = self._get_check_result_path(episode_id, version)
        data = load_json(result_path)
        if not data:
            return None

        from models import CheckResult

        issues = [self._dict_to_issue(issue_data) for issue_data in data["issues"]]

        return CheckResult(
            episode_id=data["episode_id"],
            check_version=data["check_version"],
            issues=issues,
            checked_at=datetime.fromisoformat(data["checked_at"]),
            notes=data.get("notes"),
        )

    def get_latest_version(self, episode_id: str) -> Optional[int]:
        history_path = self._get_episode_history_path(episode_id)
        history = load_json(history_path)
        if not history or not history.get("records"):
            return None
        return history["records"][-1]["check_version"]

    def get_episode_history(self, episode_id: str) -> List[HistoryRecord]:
        history_path = self._get_episode_history_path(episode_id)
        history = load_json(history_path)
        if not history or not history.get("records"):
            return []

        records = []
        for record_data in history["records"]:
            records.append(
                HistoryRecord(
                    episode_id=episode_id,
                    check_version=record_data["check_version"],
                    check_time=datetime.fromisoformat(record_data["check_time"]),
                    issue_count=record_data["issue_count"],
                    resolved_count=record_data["resolved_count"],
                    diff_summary=record_data.get("diff_summary"),
                )
            )
        return records

    def compare_versions(
        self, episode_id: str, old_version: int, new_version: int
    ) -> Dict[str, List[Issue]]:
        old_result = self.load_check_result(episode_id, old_version)
        new_result = self.load_check_result(episode_id, new_version)

        if not old_result or not new_result:
            return {}

        old_ids = {issue.issue_id: issue for issue in old_result.issues}
        new_ids = {issue.issue_id: issue for issue in new_result.issues}

        added = [issue for issue_id, issue in new_ids.items() if issue_id not in old_ids]
        removed = [issue for issue_id, issue in old_ids.items() if issue_id not in new_ids]
        changed = []

        for issue_id, old_issue in old_ids.items():
            if issue_id in new_ids:
                new_issue = new_ids[issue_id]
                if old_issue.status != new_issue.status:
                    changed.append((old_issue, new_issue))

        return {"added": added, "removed": removed, "changed": changed}

    def merge_with_previous_status(
        self, new_issues: List[Issue], episode_id: str, previous_version: int
    ) -> List[Issue]:
        previous_result = self.load_check_result(episode_id, previous_version)
        if not previous_result:
            return new_issues

        prev_issues = {
            (
                issue.time_segment.start_time,
                issue.issue_type.value,
                issue.description[:30],
            ): issue
            for issue in previous_result.issues
        }

        merged_issues = []
        for new_issue in new_issues:
            key = (
                new_issue.time_segment.start_time,
                new_issue.issue_type.value,
                new_issue.description[:30],
            )
            if key in prev_issues:
                prev_issue = prev_issues[key]
                new_issue.status = prev_issue.status
                new_issue.notes = prev_issue.notes
                new_issue.issue_id = prev_issue.issue_id
            merged_issues.append(new_issue)

        return merged_issues
