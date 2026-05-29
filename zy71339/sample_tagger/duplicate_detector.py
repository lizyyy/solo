from __future__ import annotations

import hashlib
import logging
import re
from collections import defaultdict
from pathlib import Path

import numpy as np

from .models import (
    DuplicateRecord,
    DuplicateType,
    ProcessingStatus,
    SampleFile,
    SpectrumFeatures,
)

logger = logging.getLogger(__name__)


class DuplicateDetector:
    def __init__(
        self,
        fingerprint_threshold: float = 0.97,
        name_pattern_threshold: float = 0.8,
    ):
        self.fingerprint_threshold = fingerprint_threshold
        self.name_pattern_threshold = name_pattern_threshold
        self._id_pattern = re.compile(r"(\d{3,})|(sample[_-]?\d+)", re.IGNORECASE)

    def detect_duplicates(self, samples: list[SampleFile]) -> tuple[list[SampleFile], list[DuplicateRecord]]:
        duplicates = []
        id_duplicates = self._detect_same_id(samples)
        duplicates.extend(id_duplicates)
        hash_duplicates = self._detect_exact_file(samples)
        duplicates.extend(hash_duplicates)
        fp_duplicates = self._detect_audio_fingerprint(samples)
        duplicates.extend(fp_duplicates)
        name_duplicates = self._detect_name_pattern(samples)
        duplicates.extend(name_duplicates)
        merged_duplicates = self._merge_duplicate_groups(duplicates, samples)
        processed_samples = self._mark_duplicate_samples(samples, merged_duplicates)
        return processed_samples, merged_duplicates

    def _detect_same_id(self, samples: list[SampleFile]) -> list[DuplicateRecord]:
        duplicates = []
        id_to_samples = defaultdict(list)
        for sample in samples:
            extracted_ids = self._extract_ids(sample.file_name)
            for extracted_id in extracted_ids:
                id_to_samples[extracted_id].append(sample)
        for extracted_id, sample_group in id_to_samples.items():
            if len(sample_group) > 1:
                duplicate = self._create_duplicate_record(
                    sample_group,
                    DuplicateType.SAME_ID,
                    1.0,
                    {"matched_id": extracted_id},
                )
                duplicates.append(duplicate)
        return duplicates

    def _extract_ids(self, filename: str) -> list[str]:
        matches = self._id_pattern.findall(filename)
        ids = []
        for match in matches:
            for group in match:
                if group:
                    ids.append(group.lower())
        return ids

    def _detect_exact_file(self, samples: list[SampleFile]) -> list[DuplicateRecord]:
        duplicates = []
        hash_to_samples = defaultdict(list)
        for sample in samples:
            hash_to_samples[sample.file_hash].append(sample)
        for file_hash, sample_group in hash_to_samples.items():
            if len(sample_group) > 1:
                duplicate = self._create_duplicate_record(
                    sample_group,
                    DuplicateType.EXACT_FILE,
                    1.0,
                    {"file_hash": file_hash},
                )
                duplicates.append(duplicate)
        return duplicates

    def _detect_audio_fingerprint(self, samples: list[SampleFile]) -> list[DuplicateRecord]:
        duplicates = []
        feature_groups = defaultdict(list)
        for sample in samples:
            if sample.features is not None:
                fingerprint = self._create_fingerprint(sample.features)
                feature_groups[fingerprint].append(sample)
        for fingerprint, sample_group in feature_groups.items():
            if len(sample_group) > 1:
                for i, s1 in enumerate(sample_group):
                    for s2 in sample_group[i + 1 :]:
                        similarity = self._calculate_feature_similarity(s1.features, s2.features)
                        if similarity >= self.fingerprint_threshold:
                            existing = self._find_existing_duplicate(duplicates, s1, s2)
                            if existing is None:
                                duplicate = self._create_duplicate_record(
                                    [s1, s2],
                                    DuplicateType.AUDIO_FINGERPRINT,
                                    similarity,
                                    {"fingerprint_match": fingerprint},
                                )
                                duplicates.append(duplicate)
        return duplicates

    def _create_fingerprint(self, features: SpectrumFeatures) -> str:
        mfcc_str = "_".join(f"{v:.2f}" for v in features.mfcc[:6])
        chroma_str = "_".join(f"{v:.2f}" for v in features.chroma_stft[:6])
        return f"{features.spectral_centroid:.0f}_{mfcc_str}_{chroma_str}"

    def _calculate_feature_similarity(self, f1: SpectrumFeatures, f2: SpectrumFeatures) -> float:
        v1 = np.array(f1.mfcc + f1.chroma_stft)
        v2 = np.array(f2.mfcc + f2.chroma_stft)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        cosine_sim = np.dot(v1, v2) / (norm1 * norm2)
        return float((cosine_sim + 1) / 2)

    def _detect_name_pattern(self, samples: list[SampleFile]) -> list[DuplicateRecord]:
        duplicates = []
        name_to_samples = defaultdict(list)
        for sample in samples:
            normalized_name = self._normalize_filename(sample.file_name)
            name_to_samples[normalized_name].append(sample)
        for normalized_name, sample_group in name_to_samples.items():
            if len(sample_group) > 1:
                duplicate = self._create_duplicate_record(
                    sample_group,
                    DuplicateType.NAME_PATTERN,
                    self.name_pattern_threshold,
                    {"normalized_name": normalized_name},
                )
                duplicates.append(duplicate)
        return duplicates

    def _normalize_filename(self, filename: str) -> str:
        name = Path(filename).stem.lower()
        name = re.sub(r"[_\-\s]+", "_", name)
        name = re.sub(r"\(\d+\)|\d+$", "", name)
        name = re.sub(r"_copy|_dup|_copy_\d+", "", name)
        return name.strip("_")

    def _create_duplicate_record(
        self,
        sample_group: list[SampleFile],
        dup_type: DuplicateType,
        similarity: float,
        evidence: dict,
    ) -> DuplicateRecord:
        group_id = self._generate_group_id([s.sample_id for s in sample_group], dup_type.value)
        primary = max(sample_group, key=lambda s: s.file_size)
        return DuplicateRecord(
            duplicate_group_id=group_id,
            duplicate_type=dup_type,
            sample_ids=[s.sample_id for s in sample_group],
            primary_sample_id=primary.sample_id,
            similarity_score=similarity,
            evidence=evidence,
        )

    def _find_existing_duplicate(
        self,
        duplicates: list[DuplicateRecord],
        s1: SampleFile,
        s2: SampleFile,
    ) -> DuplicateRecord | None:
        for dup in duplicates:
            if s1.sample_id in dup.sample_ids and s2.sample_id in dup.sample_ids:
                return dup
        return None

    def _merge_duplicate_groups(
        self,
        duplicates: list[DuplicateRecord],
        samples: list[SampleFile],
    ) -> list[DuplicateRecord]:
        if not duplicates:
            return duplicates
        sample_id_to_groups = defaultdict(set)
        for i, dup in enumerate(duplicates):
            for sid in dup.sample_ids:
                sample_id_to_groups[sid].add(i)
        parent = list(range(len(duplicates)))
        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        def union(x, y):
            parent[find(x)] = find(y)
        for group_indices in sample_id_to_groups.values():
            group_list = list(group_indices)
            for i in range(1, len(group_list)):
                union(group_list[0], group_list[i])
        merged_groups = defaultdict(list)
        for i, dup in enumerate(duplicates):
            merged_groups[find(i)].append(dup)
        result = []
        for group_list in merged_groups.values():
            if len(group_list) == 1:
                result.append(group_list[0])
            else:
                all_sample_ids = set()
                max_similarity = 0.0
                evidence = {}
                primary_id = None
                dup_type = None
                for dup in group_list:
                    all_sample_ids.update(dup.sample_ids)
                    if dup.similarity_score > max_similarity:
                        max_similarity = dup.similarity_score
                        primary_id = dup.primary_sample_id
                        dup_type = dup.duplicate_type
                    evidence[dup.duplicate_type.value] = dup.evidence
                merged = DuplicateRecord(
                    duplicate_group_id=self._generate_group_id(list(all_sample_ids), "merged"),
                    duplicate_type=dup_type or DuplicateType.AUDIO_FINGERPRINT,
                    sample_ids=sorted(all_sample_ids),
                    primary_sample_id=primary_id,
                    similarity_score=max_similarity,
                    evidence={"merged_types": evidence},
                )
                result.append(merged)
        return result

    def _mark_duplicate_samples(
        self,
        samples: list[SampleFile],
        duplicates: list[DuplicateRecord],
    ) -> list[SampleFile]:
        duplicate_sample_ids = set()
        for dup in duplicates:
            for sid in dup.sample_ids:
                duplicate_sample_ids.add(sid)
        for sample in samples:
            if sample.sample_id in duplicate_sample_ids and sample.status != ProcessingStatus.ERROR:
                sample.status = ProcessingStatus.DUPLICATE
        return samples

    @staticmethod
    def _generate_group_id(sample_ids: list[str], prefix: str) -> str:
        hash_input = f"{prefix}_{'_'.join(sorted(sample_ids))}"
        return hashlib.md5(hash_input.encode()).hexdigest()[:12]
