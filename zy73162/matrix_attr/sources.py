from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .models import (
    AttributionRecord,
    Influence,
    Note,
    ParamVersion,
    SourceType,
)


@dataclass
class FusionContext:
    param_versions: Dict[str, ParamVersion] = field(default_factory=dict)
    notes: Dict[str, Note] = field(default_factory=dict)
    apply_order: List[Tuple[SourceType, str]] = field(default_factory=list)

    def add_param(self, version: ParamVersion) -> None:
        self.param_versions[version.version] = version
        stype = SourceType.PARAM_CURRENT if "current" in version.version.lower() else SourceType.PARAM_OLD
        self.apply_order.append((stype, version.version))

    def add_note(self, note: Note) -> None:
        self.notes[note.note_id] = note
        self.apply_order.append((note.source_type, note.note_id))


def _parse_note_override(content: str) -> Dict[str, float]:
    result: Dict[str, float] = {}
    for line in content.splitlines():
        line = line.strip()
        if not line or "=" not in line:
            continue
        k, v = line.split("=", 1)
        try:
            result[k.strip()] = float(v.strip())
        except ValueError:
            continue
    return result


class SourceFusion:
    def __init__(self) -> None:
        self.applied: List[Tuple[SourceType, str]] = []

    def apply(
        self,
        record: AttributionRecord,
        ctx: FusionContext,
        decomposer,
    ) -> AttributionRecord:
        self.applied = []

        for src_type, src_id in ctx.apply_order:
            if src_type in (SourceType.PARAM_OLD, SourceType.PARAM_CURRENT):
                param = ctx.param_versions.get(src_id)
                if param is None:
                    continue
                record = decomposer.apply_to_record(
                    record, param, src_type, src_id
                )
                self.applied.append((src_type, src_id))
            else:
                note = ctx.notes.get(src_id)
                if note is None:
                    continue
                record = self._apply_note(record, note)
                self.applied.append((src_type, src_id))

        return record

    def _apply_note(self, record: AttributionRecord, note: Note) -> AttributionRecord:
        overrides = _parse_note_override(note.content)
        if not overrides:
            record.influences.append(
                Influence(
                    source_type=note.source_type,
                    source_id=note.note_id,
                    delta=0.0,
                    detail=f"备注无可解析的知识点覆盖（原文: {note.content[:40]}）",
                )
            )
            record.touch()
            return record

        old_weights = dict(record.knowledge_weights)
        old_cause = record.primary_cause

        merged = dict(old_weights)
        for k, v in overrides.items():
            if k not in note.affects and note.affects:
                continue
            merged[k] = v * note.weight + merged.get(k, 0.0) * (1 - note.weight)

        total = sum(merged.values())
        if total <= 0:
            record.influences.append(
                Influence(
                    source_type=note.source_type,
                    source_id=note.note_id,
                    delta=0.0,
                    detail=f"备注覆盖后总和<=0，未生效",
                )
            )
            return record

        merged = {k: v / total for k, v in merged.items() if v > 1e-6}
        if not merged:
            return record

        delta = 0.0
        for k, v in merged.items():
            delta += abs(v - old_weights.get(k, 0.0))
        for k, v in old_weights.items():
            if k not in merged:
                delta += v

        new_cause = max(merged.items(), key=lambda x: x[1])[0]
        new_conf = merged[new_cause]

        record.knowledge_weights = merged
        record.primary_cause = new_cause
        record.confidence = new_conf
        record.revision_count += 1
        record.touch()

        record.influences.append(
            Influence(
                source_type=note.source_type,
                source_id=note.note_id,
                delta=delta,
                detail=(
                    f"备注覆盖主因 {old_cause!r} → {new_cause!r}，"
                    f"影响知识点: {sorted(overrides.keys())}"
                ),
            )
        )
        return record

    def list_influences(self, record: AttributionRecord) -> Dict[str, List[Influence]]:
        grouped: Dict[str, List[Influence]] = {}
        for inf in record.influences:
            grouped.setdefault(inf.source_type.value, []).append(inf)
        return grouped
