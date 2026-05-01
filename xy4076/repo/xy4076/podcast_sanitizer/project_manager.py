import json
import pickle
from datetime import timedelta
from pathlib import Path
from typing import Optional

from .models import (
    ProjectState, Subtitle, Chapter, SensitiveRule,
    ScanIssue, SanitizedSubtitle, MaskMapping, ClipSegment
)


class ProjectManager:
    def __init__(self, work_dir: str = "."):
        self.work_dir = Path(work_dir)
        self.state = ProjectState()

    def load_state(self, state_file: Optional[str] = None) -> bool:
        if state_file:
            state_path = Path(state_file)
        else:
            state_path = self.work_dir / ".sanitizer_state.json"

        if not state_path.exists():
            return False

        try:
            data = json.loads(state_path.read_text(encoding="utf-8"))
            self._deserialize_state(data)
            return True
        except Exception:
            return False

    def save_state(self, state_file: Optional[str] = None) -> bool:
        if state_file:
            state_path = Path(state_file)
        else:
            state_path = self.work_dir / ".sanitizer_state.json"

        try:
            data = self._serialize_state()
            state_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            return True
        except Exception:
            return False

    def _serialize_state(self) -> dict:
        return {
            "subtitles": [
                {
                    "id": s.id,
                    "start_seconds": s.start_time.total_seconds(),
                    "end_seconds": s.end_time.total_seconds(),
                    "text": s.text,
                    "original_id": s.original_id
                }
                for s in self.state.subtitles
            ],
            "chapters": [
                {
                    "id": c.id,
                    "title": c.title,
                    "start_seconds": c.start_time.total_seconds(),
                    "end_seconds": c.end_time.total_seconds() if c.end_time else None
                }
                for c in self.state.chapters
            ],
            "rules": [
                {
                    "id": r.id,
                    "pattern": r.pattern,
                    "category": r.category,
                    "description": r.description,
                    "mask_template": r.mask_template
                }
                for r in self.state.rules
            ],
            "issues": [
                {
                    "id": i.id,
                    "issue_type": i.issue_type.value,
                    "subtitle_id": i.subtitle_id,
                    "start_seconds": i.start_time.total_seconds(),
                    "end_seconds": i.end_time.total_seconds(),
                    "description": i.description,
                    "severity": i.severity,
                    "related_subtitle_ids": i.related_subtitle_ids,
                    "sensitive_match": i.sensitive_match,
                    "mask_value": i.mask_value
                }
                for i in self.state.issues
            ],
            "sanitized_subtitles": [
                {
                    "id": s.id,
                    "start_seconds": s.start_time.total_seconds(),
                    "end_seconds": s.end_time.total_seconds(),
                    "original_text": s.original_text,
                    "masked_text": s.masked_text,
                    "has_sensitive": s.has_sensitive,
                    "mask_mappings": [
                        {
                            "original_text": m.original_text,
                            "masked_text": m.masked_text,
                            "category": m.category,
                            "subtitle_id": m.subtitle_id,
                            "start_seconds": m.start_time.total_seconds(),
                            "end_seconds": m.end_time.total_seconds()
                        }
                        for m in s.mask_mappings
                    ]
                }
                for s in self.state.sanitized_subtitles
            ],
            "mask_mappings": [
                {
                    "original_text": m.original_text,
                    "masked_text": m.masked_text,
                    "category": m.category,
                    "subtitle_id": m.subtitle_id,
                    "start_seconds": m.start_time.total_seconds(),
                    "end_seconds": m.end_time.total_seconds()
                }
                for m in self.state.mask_mappings
            ],
            "clip_segments": [
                {
                    "id": c.id,
                    "start_seconds": c.start_time.total_seconds(),
                    "end_seconds": c.end_time.total_seconds(),
                    "title": c.title,
                    "subtitle_ids": c.subtitle_ids,
                    "has_sensitive": c.has_sensitive,
                    "chapter_id": c.chapter_id,
                    "chapter_title": c.chapter_title
                }
                for c in self.state.clip_segments
            ]
        }

    def _deserialize_state(self, data: dict):
        self.state = ProjectState()

        for s_data in data.get("subtitles", []):
            self.state.subtitles.append(Subtitle(
                id=s_data["id"],
                start_time=timedelta(seconds=s_data["start_seconds"]),
                end_time=timedelta(seconds=s_data["end_seconds"]),
                text=s_data["text"],
                original_id=s_data.get("original_id")
            ))

        for c_data in data.get("chapters", []):
            self.state.chapters.append(Chapter(
                id=c_data["id"],
                title=c_data["title"],
                start_time=timedelta(seconds=c_data["start_seconds"]),
                end_time=timedelta(seconds=c_data["end_seconds"]) if c_data.get("end_seconds") else None
            ))

        for r_data in data.get("rules", []):
            self.state.rules.append(SensitiveRule(
                id=r_data["id"],
                pattern=r_data["pattern"],
                category=r_data["category"],
                description=r_data["description"],
                mask_template=r_data.get("mask_template", "[{category}_{index}]")
            ))

        from .models import IssueType
        for i_data in data.get("issues", []):
            issue_type = None
            for it in IssueType:
                if it.value == i_data["issue_type"]:
                    issue_type = it
                    break

            if issue_type:
                self.state.issues.append(ScanIssue(
                    id=i_data["id"],
                    issue_type=issue_type,
                    subtitle_id=i_data["subtitle_id"],
                    start_time=timedelta(seconds=i_data["start_seconds"]),
                    end_time=timedelta(seconds=i_data["end_seconds"]),
                    description=i_data["description"],
                    severity=i_data["severity"],
                    related_subtitle_ids=i_data.get("related_subtitle_ids", []),
                    sensitive_match=i_data.get("sensitive_match"),
                    mask_value=i_data.get("mask_value")
                ))

        for s_data in data.get("sanitized_subtitles", []):
            mappings = []
            for m_data in s_data.get("mask_mappings", []):
                mappings.append(MaskMapping(
                    original_text=m_data["original_text"],
                    masked_text=m_data["masked_text"],
                    category=m_data["category"],
                    subtitle_id=m_data["subtitle_id"],
                    start_time=timedelta(seconds=m_data["start_seconds"]),
                    end_time=timedelta(seconds=m_data["end_seconds"])
                ))

            self.state.sanitized_subtitles.append(SanitizedSubtitle(
                id=s_data["id"],
                start_time=timedelta(seconds=s_data["start_seconds"]),
                end_time=timedelta(seconds=s_data["end_seconds"]),
                original_text=s_data["original_text"],
                masked_text=s_data["masked_text"],
                has_sensitive=s_data["has_sensitive"],
                mask_mappings=mappings
            ))

        for m_data in data.get("mask_mappings", []):
            self.state.mask_mappings.append(MaskMapping(
                original_text=m_data["original_text"],
                masked_text=m_data["masked_text"],
                category=m_data["category"],
                subtitle_id=m_data["subtitle_id"],
                start_time=timedelta(seconds=m_data["start_seconds"]),
                end_time=timedelta(seconds=m_data["end_seconds"])
            ))

        for c_data in data.get("clip_segments", []):
            self.state.clip_segments.append(ClipSegment(
                id=c_data["id"],
                start_time=timedelta(seconds=c_data["start_seconds"]),
                end_time=timedelta(seconds=c_data["end_seconds"]),
                title=c_data["title"],
                subtitle_ids=c_data.get("subtitle_ids", []),
                has_sensitive=c_data.get("has_sensitive", False),
                chapter_id=c_data.get("chapter_id"),
                chapter_title=c_data.get("chapter_title")
            ))
