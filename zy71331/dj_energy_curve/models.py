from __future__ import annotations

import copy
import json
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any


class FlagStatus(str, Enum):
    OK = "ok"
    REVIEW = "review"
    SKIPPED = "skipped"


class BpmAdjustment(str, Enum):
    NONE = "none"
    HALVED = "halved"
    DOUBLED = "doubled"


class KeyRelation(str, Enum):
    SAME = "same"
    ADJACENT = "adjacent"
    RELATIVE = "relative"
    DIAG = "diagonal"
    INCOMPATIBLE = "incompatible"


class SectionType(str, Enum):
    WARMUP = "warmup"
    BUILD = "build"
    PEAK = "peak"
    COOLDOWN = "cooldown"
    TRANSITION = "transition"
    UNKNOWN = "unknown"


@dataclass
class Track:
    track_id: str
    title: str = ""
    artist: str = ""
    bpm_raw: float | None = None
    bpm_normalized: float | None = None
    bpm_adjustment: BpmAdjustment = BpmAdjustment.NONE
    key_raw: str = ""
    key_normalized: str = ""
    energy: float | None = None
    time_slot: str = ""
    position: int = 0
    flags: list[str] = field(default_factory=list)
    status: FlagStatus = FlagStatus.OK
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["bpm_adjustment"] = self.bpm_adjustment.value
        d["status"] = self.status.value
        return d

    @classmethod
    def from_dict(cls, d: dict) -> Track:
        d = dict(d)
        if "bpm_adjustment" in d and isinstance(d["bpm_adjustment"], str):
            d["bpm_adjustment"] = BpmAdjustment(d["bpm_adjustment"])
        if "status" in d and isinstance(d["status"], str):
            d["status"] = FlagStatus(d["status"])
        known = {f.name for f in cls.__dataclass_fields__.values()}
        extra = {k: v for k, v in d.items() if k not in known}
        d["meta"] = d.get("meta", {})
        d["meta"].update(extra)
        for k in extra:
            del d[k]
        return cls(**{k: v for k, v in d.items() if k in known})


@dataclass
class Transition:
    from_position: int
    to_position: int
    bpm_delta: float = 0.0
    key_relation: KeyRelation = KeyRelation.INCOMPATIBLE
    energy_delta: float = 0.0
    is_smooth: bool = True
    issues: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["key_relation"] = self.key_relation.value
        return d


@dataclass
class Section:
    name: str
    section_type: SectionType
    start_position: int
    end_position: int
    avg_energy: float = 0.0
    avg_bpm: float = 0.0
    dominant_key: str = ""
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["section_type"] = self.section_type.value
        return d


@dataclass
class StepResult:
    step_name: str
    input_snapshot: str = ""
    output_snapshot: str = ""
    tracks_modified: int = 0
    issues: list[str] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PipelineResult:
    tracks: list[Track] = field(default_factory=list)
    transitions: list[Transition] = field(default_factory=list)
    sections: list[Section] = field(default_factory=list)
    step_results: list[StepResult] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "tracks": [t.to_dict() for t in self.tracks],
            "transitions": [t.to_dict() for t in self.transitions],
            "sections": [s.to_dict() for s in self.sections],
            "step_results": [sr.to_dict() for sr in self.step_results],
            "warnings": self.warnings,
            "meta": self.meta,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)

    def review_tracks(self) -> list[Track]:
        return [t for t in self.tracks if t.status == FlagStatus.REVIEW]
