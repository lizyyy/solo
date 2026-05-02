"""历史查询模块 - 按剧集、语言和问题类型查询历史检查结果"""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    HistoryRecord,
    IssueType,
    Language,
    Quarantine,
)


class HistoryManager:
    HISTORY_FILE_PATTERN = r"check_(\d{8}_\d{6})\.json"

    def __init__(self, history_dir: Path):
        self.history_dir = history_dir
        self.history_dir.mkdir(parents=True, exist_ok=True)

    def save_check_result(
        self,
        quarantine: Quarantine,
        subtitle_files: list = None,
        config: dict = None,
    ) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"check_{timestamp}.json"
        filepath = self.history_dir / filename

        history_data = {
            "timestamp": timestamp,
            "generated_at": datetime.now().isoformat(),
            "quarantine": {
                "generated_at": quarantine.generated_at.isoformat() if quarantine.generated_at else None,
                "issue_count": len(quarantine.issues),
                "issues": [
                    {
                        "id": i.id,
                        "issue_type": i.issue_type.value,
                        "severity": i.severity.value,
                        "message": i.message,
                        "language": i.language.value if i.language else None,
                        "episode": i.episode,
                        "subtitle_index": i.subtitle_index,
                        "filename": i.filename,
                        "details": i.details,
                        "review_action": i.review_action.value,
                        "created_at": i.created_at.isoformat() if i.created_at else None,
                    }
                    for i in quarantine.issues
                ],
            },
        }

        if subtitle_files:
            history_data["subtitle_files"] = [
                {
                    "filename": sf.filename,
                    "language": sf.language.value,
                    "format": sf.format.value,
                    "episode": sf.episode,
                    "entry_count": len(sf.entries),
                    "sha256": sf.sha256,
                }
                for sf in subtitle_files
            ]

        if config:
            history_data["config"] = config

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(history_data, f, ensure_ascii=False, indent=2)

        return filepath

    def query_history(
        self,
        episode: Optional[int] = None,
        language: Optional[Language] = None,
        issue_type: Optional[IssueType] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
    ) -> list[HistoryRecord]:
        records = []

        history_files = sorted(
            self.history_dir.glob("check_*.json"),
            key=lambda p: p.name,
            reverse=True,
        )

        for filepath in history_files[:limit]:
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)

                check_timestamp = self._parse_timestamp_from_filename(filepath.name)
                if not check_timestamp:
                    continue

                if start_date and check_timestamp < start_date:
                    continue
                if end_date and check_timestamp > end_date:
                    continue

                quarantine = data.get("quarantine", {})
                issues = quarantine.get("issues", [])

                for issue_data in issues:
                    issue_episode = issue_data.get("episode")
                    issue_lang = issue_data.get("language")
                    issue_type_str = issue_data.get("issue_type")

                    if episode is not None and issue_episode != episode:
                        continue
                    if language is not None and issue_lang != language.value:
                        continue
                    if issue_type is not None and issue_type_str != issue_type.value:
                        continue

                    records.append(
                        HistoryRecord(
                            id=issue_data.get("id", ""),
                            episode=issue_episode,
                            language=Language(issue_lang) if issue_lang else None,
                            issue_type=IssueType(issue_type_str) if issue_type_str else None,
                            issue_count=1,
                            check_timestamp=check_timestamp,
                            summary=issue_data.get("message", ""),
                        )
                    )

            except (json.JSONDecodeError, IOError, ValueError):
                continue

        return records

    def get_history_summary(
        self,
        episode: Optional[int] = None,
        language: Optional[Language] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        records = self.query_history(
            episode=episode,
            language=language,
            start_date=start_date,
            end_date=end_date,
            limit=1000,
        )

        summary = {
            "total_records": len(records),
            "by_episode": {},
            "by_language": {},
            "by_issue_type": {},
            "check_dates": set(),
        }

        for record in records:
            if record.episode:
                ep_key = f"ep_{record.episode}"
                if ep_key not in summary["by_episode"]:
                    summary["by_episode"][ep_key] = 0
                summary["by_episode"][ep_key] += 1

            if record.language:
                lang_key = record.language.value
                if lang_key not in summary["by_language"]:
                    summary["by_language"][lang_key] = 0
                summary["by_language"][lang_key] += 1

            if record.issue_type:
                type_key = record.issue_type.value
                if type_key not in summary["by_issue_type"]:
                    summary["by_issue_type"][type_key] = 0
                summary["by_issue_type"][type_key] += 1

            if record.check_timestamp:
                summary["check_dates"].add(record.check_timestamp.strftime("%Y-%m-%d"))

        summary["unique_dates"] = len(summary["check_dates"])
        summary["check_dates"] = sorted(list(summary["check_dates"]))

        return summary

    def list_check_sessions(self, limit: int = 20) -> list[dict]:
        sessions = []

        history_files = sorted(
            self.history_dir.glob("check_*.json"),
            key=lambda p: p.name,
            reverse=True,
        )

        for filepath in history_files[:limit]:
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)

                timestamp = self._parse_timestamp_from_filename(filepath.name)
                quarantine = data.get("quarantine", {})
                issues = quarantine.get("issues", [])

                critical_count = sum(1 for i in issues if i.get("severity") == "critical")
                warning_count = sum(1 for i in issues if i.get("severity") == "warning")
                info_count = sum(1 for i in issues if i.get("severity") == "info")

                sessions.append({
                    "filename": filepath.name,
                    "timestamp": timestamp.isoformat() if timestamp else None,
                    "total_issues": len(issues),
                    "critical": critical_count,
                    "warning": warning_count,
                    "info": info_count,
                })

            except (json.JSONDecodeError, IOError):
                continue

        return sessions

    def _parse_timestamp_from_filename(self, filename: str) -> Optional[datetime]:
        match = re.match(self.HISTORY_FILE_PATTERN, filename)
        if match:
            timestamp_str = match.group(1)
            try:
                return datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
            except ValueError:
                pass
        return None

    def get_latest_check(self) -> Optional[dict]:
        sessions = self.list_check_sessions(limit=1)
        if sessions:
            latest_filename = sessions[0]["filename"]
            latest_path = self.history_dir / latest_filename
            try:
                with open(latest_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return None
