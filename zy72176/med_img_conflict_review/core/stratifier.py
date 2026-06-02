from __future__ import annotations

from collections import defaultdict
from typing import Optional

from .models import ConflictRecord, ConflictType, Sample, Severity


class Stratifier:
    def __init__(
        self,
        conflicts: list[ConflictRecord],
        samples: dict[str, Sample],
    ):
        self.conflicts = conflicts
        self.samples = samples

    def by_severity(self) -> dict[Severity, list[ConflictRecord]]:
        result: dict[Severity, list[ConflictRecord]] = defaultdict(list)
        for c in self.conflicts:
            result[c.severity].append(c)
        return dict(result)

    def by_conflict_type(self) -> dict[ConflictType, list[ConflictRecord]]:
        result: dict[ConflictType, list[ConflictRecord]] = defaultdict(list)
        for c in self.conflicts:
            result[c.conflict_type].append(c)
        return dict(result)

    def by_modality(self) -> dict[str, list[ConflictRecord]]:
        result: dict[str, list[ConflictRecord]] = defaultdict(list)
        for c in self.conflicts:
            sample = self.samples.get(c.sample_id)
            if sample:
                result[sample.modality].append(c)
        return dict(result)

    def by_body_part(self) -> dict[str, list[ConflictRecord]]:
        result: dict[str, list[ConflictRecord]] = defaultdict(list)
        for c in self.conflicts:
            sample = self.samples.get(c.sample_id)
            if sample:
                result[sample.body_part].append(c)
        return dict(result)

    def by_model_version(self) -> dict[str, list[ConflictRecord]]:
        result: dict[str, list[ConflictRecord]] = defaultdict(list)
        for c in self.conflicts:
            if c.model_version:
                result[c.model_version].append(c)
            else:
                result["N/A"].append(c)
        return dict(result)

    def filter(
        self,
        severity: Optional[Severity] = None,
        conflict_type: Optional[ConflictType] = None,
        modality: Optional[str] = None,
        model_version: Optional[str] = None,
    ) -> list[ConflictRecord]:
        result = self.conflicts
        if severity:
            result = [c for c in result if c.severity == severity]
        if conflict_type:
            result = [c for c in result if c.conflict_type == conflict_type]
        if modality:
            sids = {s.sample_id for s in self.samples.values() if s.modality == modality}
            result = [c for c in result if c.sample_id in sids]
        if model_version:
            result = [c for c in result if c.model_version == model_version]
        return result

    def summary(self) -> dict:
        by_sev = {s.value: len(v) for s, v in self.by_severity().items()}
        by_type = {t.value: len(v) for t, v in self.by_conflict_type().items()}
        by_mod = {k: len(v) for k, v in self.by_modality().items()}
        by_ver = {k: len(v) for k, v in self.by_model_version().items()}
        return {
            "total_conflicts": len(self.conflicts),
            "by_severity": by_sev,
            "by_conflict_type": by_type,
            "by_modality": by_mod,
            "by_model_version": by_ver,
        }
