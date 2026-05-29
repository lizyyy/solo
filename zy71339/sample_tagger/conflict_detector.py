from __future__ import annotations

import hashlib
import logging
from datetime import datetime

from .models import (
    ConflictRecord,
    ConflictType,
    ProcessingStatus,
    SampleFile,
    Tag,
    TagCategory,
    TagSource,
)

logger = logging.getLogger(__name__)


class ConflictDetector:
    def __init__(self, multi_tag_threshold: float = 0.3, low_confidence_threshold: float = 0.5):
        self.multi_tag_threshold = multi_tag_threshold
        self.low_confidence_threshold = low_confidence_threshold

    def detect_conflicts(self, samples: list[SampleFile]) -> tuple[list[SampleFile], list[ConflictRecord]]:
        conflicts = []
        processed_samples = []
        for sample in samples:
            sample_conflicts = self._check_sample(sample)
            if sample_conflicts:
                conflicts.extend(sample_conflicts)
                sample.status = ProcessingStatus.CONFLICT
            processed_samples.append(sample)
        return processed_samples, conflicts

    def _check_sample(self, sample: SampleFile) -> list[ConflictRecord]:
        conflicts = []
        if sample.manual_tags and sample.tags:
            auto_vs_manual = self._check_auto_manual_mismatch(sample)
            if auto_vs_manual:
                conflicts.append(auto_vs_manual)
        multi_tag = self._check_multi_tag(sample)
        if multi_tag:
            conflicts.append(multi_tag)
        low_conf = self._check_low_confidence(sample)
        if low_conf:
            conflicts.append(low_conf)
        return conflicts

    def _check_auto_manual_mismatch(self, sample: SampleFile) -> ConflictRecord | None:
        auto_primary = sample.tags[0] if sample.tags else None
        manual_primary = sample.manual_tags[0] if sample.manual_tags else None
        if auto_primary and manual_primary:
            if auto_primary.category != manual_primary.category:
                conflict_id = self._generate_conflict_id(sample.sample_id, "auto_manual")
                return ConflictRecord(
                    conflict_id=conflict_id,
                    sample_id=sample.sample_id,
                    conflict_type=ConflictType.AUTO_MANUAL_MISMATCH,
                    tags=[auto_primary, manual_primary],
                    description=f"Auto tag '{auto_primary.category.value}' conflicts with manual tag '{manual_primary.category.value}'",
                )
        return None

    def _check_multi_tag(self, sample: SampleFile) -> ConflictRecord | None:
        all_tags = sample.get_effective_tags()
        if len(all_tags) < 2:
            return None
        tag_categories = {}
        for tag in all_tags:
            if tag.category not in tag_categories:
                tag_categories[tag.category] = tag
        if len(tag_categories) < 2:
            return None
        sorted_tags = sorted(tag_categories.values(), key=lambda t: t.confidence, reverse=True)
        if len(sorted_tags) >= 2:
            conf_diff = sorted_tags[0].confidence - sorted_tags[1].confidence
            if conf_diff < self.multi_tag_threshold:
                conflict_id = self._generate_conflict_id(sample.sample_id, "multi_tag")
                return ConflictRecord(
                    conflict_id=conflict_id,
                    sample_id=sample.sample_id,
                    conflict_type=ConflictType.MULTI_TAG,
                    tags=sorted_tags[:3],
                    description=f"Multiple plausible tags: {', '.join(t.category.value for t in sorted_tags[:3])} (confidence diff: {conf_diff:.3f})",
                )
        return None

    def _check_low_confidence(self, sample: SampleFile) -> ConflictRecord | None:
        primary_tag = sample.get_primary_tag()
        if primary_tag and primary_tag.confidence < self.low_confidence_threshold:
            conflict_id = self._generate_conflict_id(sample.sample_id, "low_conf")
            return ConflictRecord(
                conflict_id=conflict_id,
                sample_id=sample.sample_id,
                conflict_type=ConflictType.LOW_CONFIDENCE,
                tags=[primary_tag],
                description=f"Low confidence tag: {primary_tag.category.value} ({primary_tag.confidence:.3f} < {self.low_confidence_threshold})",
            )
        return None

    @staticmethod
    def _generate_conflict_id(sample_id: str, conflict_type: str) -> str:
        hash_input = f"{sample_id}_{conflict_type}_{datetime.now().isoformat()}"
        return hashlib.md5(hash_input.encode()).hexdigest()[:12]

    def resolve_conflict(
        self,
        conflict: ConflictRecord,
        resolution_tag: Tag | None,
        resolved_by: str = "system",
    ) -> ConflictRecord:
        if resolution_tag is None:
            primary_tag = max(conflict.tags, key=lambda t: t.confidence)
            resolution_tag = Tag(
                category=primary_tag.category,
                confidence=primary_tag.confidence,
                source=TagSource.CONFLICT_RESOLVED,
                evidence=primary_tag.evidence,
                reviewer=resolved_by,
            )
        conflict.resolved = True
        conflict.resolution = resolution_tag
        conflict.resolved_by = resolved_by
        conflict.resolved_at = datetime.now()
        return conflict
