from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from .base import BaseModel, Correction, Attachment
from .author import AuthorShare


@dataclass
class TrackSplit:
    track_name: str
    duration_seconds: int
    ratio: float = 0.0
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_name": self.track_name,
            "duration_seconds": self.duration_seconds,
            "ratio": self.ratio,
            "notes": self.notes,
        }


@dataclass
class Track(BaseModel):
    name: str = ""
    isrc: str = ""
    duration_seconds: int = 0
    is_medley: bool = False
    medley_tracks: List[TrackSplit] = field(default_factory=list)
    authors: List[AuthorShare] = field(default_factory=list)
    corrections: List[Correction] = field(default_factory=list)
    attachments: List[Attachment] = field(default_factory=list)
    notes: str = ""

    def total_duration(self) -> int:
        if self.is_medley and self.medley_tracks:
            return sum(t.duration_seconds for t in self.medley_tracks)
        return self.duration_seconds

    def validate(self) -> List[str]:
        errors = []
        if not self.name:
            errors.append("曲目名称不能为空")
        if self.duration_seconds <= 0 and not self.is_medley:
            errors.append(f"曲目[{self.name}]演出时长必须大于0")
        if self.is_medley and not self.medley_tracks:
            errors.append(f"串烧曲目[{self.name}]必须包含子曲目列表")
        if self.is_medley and self.medley_tracks:
            total_sub = sum(t.duration_seconds for t in self.medley_tracks)
            if abs(total_sub - self.duration_seconds) > 5 and self.duration_seconds > 0:
                errors.append(f"串烧曲目[{self.name}]子曲目总时长({total_sub}s)与标注时长({self.duration_seconds}s)差异超过5秒")
        for author in self.authors:
            errors.extend(author.validate())
        return errors

    def get_author_ratios(self) -> List[AuthorShare]:
        return self.authors

    def to_dict(self):
        data = super().to_dict()
        data["medley_tracks"] = [t.to_dict() for t in self.medley_tracks]
        data["authors"] = [a.to_dict() for a in self.authors]
        data["corrections"] = [c.to_dict() for c in self.corrections]
        data["attachments"] = [a.to_dict() for a in self.attachments]
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "Track":
        return cls(
            id=data.get("id", cls.id.default_factory()),
            name=data.get("name", ""),
            isrc=data.get("isrc", ""),
            duration_seconds=int(data.get("duration_seconds", 0)),
            is_medley=bool(data.get("is_medley", False)),
            medley_tracks=[TrackSplit(**t) for t in data.get("medley_tracks", [])],
            authors=[AuthorShare.from_dict(a) for a in data.get("authors", [])],
            corrections=[Correction(**c) for c in data.get("corrections", [])],
            attachments=[Attachment(**a) for a in data.get("attachments", [])],
            notes=data.get("notes", ""),
        )
