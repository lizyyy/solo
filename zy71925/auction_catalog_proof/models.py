"""
数据模型定义
============

定义作品、展墙布置、校对记录等核心数据结构
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import json


def _generate_id() -> str:
    return uuid.uuid4().hex[:12]


@dataclass
class Artwork:
    lot_number: str
    title_cn: str
    title_en: Optional[str] = None
    artist: Optional[str] = None
    artist_en: Optional[str] = None
    year: Optional[str] = None
    medium: Optional[str] = None
    dimensions: Optional[str] = None
    estimate: Optional[str] = None
    provenance: Optional[str] = None
    literature: Optional[str] = None
    exhibition: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    source: str = "works_list"
    id: str = field(default_factory=_generate_id)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class WallLayout:
    wall_id: str
    wall_name: str
    lot_number: str
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    lighting_scheme: Optional[str] = None
    lighting_source: str = "wall_layout"
    display_sequence: Optional[int] = None
    notes: Optional[str] = None
    id: str = field(default_factory=_generate_id)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Difference:
    lot_number: str
    field_name: str
    field_label: str
    works_list_value: Optional[str] = None
    wall_layout_value: Optional[str] = None
    final_value: Optional[str] = None
    status: str = "pending"
    severity: str = "warning"
    message: str = ""
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    id: str = field(default_factory=_generate_id)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class LightingConflict:
    lot_number: str
    works_list_lighting: Optional[str] = None
    wall_layout_lighting: Optional[str] = None
    current_value: Optional[str] = None
    status: str = "pending"
    message: str = ""
    resolution: Optional[str] = None
    next_contact: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    id: str = field(default_factory=_generate_id)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ProofRecord:
    lot_number: str
    status: str = "confirmed"
    manual_edited: bool = False
    edit_notes: Optional[str] = None
    edited_fields: List[str] = field(default_factory=list)
    edited_by: Optional[str] = None
    edited_at: Optional[str] = None
    id: str = field(default_factory=_generate_id)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class HistoryEntry:
    lot_number: str
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    operator: Optional[str] = None
    notes: Optional[str] = None
    version: int = 1
    id: str = field(default_factory=_generate_id)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CatalogProofSession:
    session_name: str
    works_list_source: str
    wall_layout_source: str
    artworks: Dict[str, Artwork] = field(default_factory=dict)
    wall_layouts: Dict[str, WallLayout] = field(default_factory=dict)
    differences: Dict[str, Difference] = field(default_factory=dict)
    lighting_conflicts: Dict[str, LightingConflict] = field(default_factory=dict)
    proof_records: Dict[str, ProofRecord] = field(default_factory=dict)
    history: List[HistoryEntry] = field(default_factory=list)
    id: str = field(default_factory=_generate_id)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_name": self.session_name,
            "works_list_source": self.works_list_source,
            "wall_layout_source": self.wall_layout_source,
            "artworks": {k: v.to_dict() for k, v in self.artworks.items()},
            "wall_layouts": {k: v.to_dict() for k, v in self.wall_layouts.items()},
            "differences": {k: v.to_dict() for k, v in self.differences.items()},
            "lighting_conflicts": {k: v.to_dict() for k, v in self.lighting_conflicts.items()},
            "proof_records": {k: v.to_dict() for k, v in self.proof_records.items()},
            "history": [h.to_dict() for h in self.history],
            "id": self.id,
            "created_at": self.created_at,
        }

    def save(self, filepath: str) -> None:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, filepath: str) -> "CatalogProofSession":
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        session = cls(
            session_name=data["session_name"],
            works_list_source=data["works_list_source"],
            wall_layout_source=data["wall_layout_source"],
            id=data.get("id", _generate_id()),
            created_at=data.get("created_at", datetime.now().isoformat()),
        )

        for lot, aw_data in data.get("artworks", {}).items():
            aw_data.pop("id", None)
            aw_data.pop("created_at", None)
            session.artworks[lot] = Artwork(**aw_data)

        for key, wl_data in data.get("wall_layouts", {}).items():
            wl_data.pop("id", None)
            wl_data.pop("created_at", None)
            session.wall_layouts[key] = WallLayout(**wl_data)

        for key, diff_data in data.get("differences", {}).items():
            diff_data.pop("id", None)
            diff_data.pop("created_at", None)
            session.differences[key] = Difference(**diff_data)

        for key, lc_data in data.get("lighting_conflicts", {}).items():
            lc_data.pop("id", None)
            lc_data.pop("created_at", None)
            session.lighting_conflicts[key] = LightingConflict(**lc_data)

        for key, pr_data in data.get("proof_records", {}).items():
            pr_data.pop("id", None)
            pr_data.pop("created_at", None)
            session.proof_records[key] = ProofRecord(**pr_data)

        for h_data in data.get("history", []):
            h_data.pop("id", None)
            h_data.pop("timestamp", None)
            session.history.append(HistoryEntry(**h_data))

        return session
