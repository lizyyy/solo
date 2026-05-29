from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from .models import (
    ProcessingStatus,
    SampleFile,
    SpectrumFeatures,
    Tag,
    TagCategory,
    TagSource,
)

logger = logging.getLogger(__name__)


@dataclass
class TagRule:
    category: TagCategory
    confidence: float
    description: str


class RuleBasedTagger:
    def __init__(self, low_confidence_threshold: float = 0.5):
        self.low_confidence_threshold = low_confidence_threshold
        self._init_thresholds()

    def _init_thresholds(self):
        self.drum_peak_envelope_min = 0.5
        self.drum_duration_max = 2.0
        self.drum_centroid_min = 500
        self.drum_rms_min = 0.01
        self.drum_rolloff_max = 8000
        self.drum_contrast_min = 15
        self.bass_centroid_max = 300
        self.bass_rolloff_max = 1000
        self.bass_duration_min = 0.3
        self.bass_chroma_energy = 0.3
        self.bass_rms_min = 0.02
        self.ambient_duration_min = 1.0
        self.ambient_flatness_min = 0.2
        self.ambient_flatness_max = 0.5
        self.ambient_centroid_min = 300
        self.ambient_centroid_max = 4000
        self.ambient_contrast_max = 20
        self.suspicious_zcr_min = 0.4
        self.suspicious_flatness_min = 0.55

    def tag_sample(self, sample: SampleFile) -> SampleFile:
        if sample.is_silent:
            silence_tag = Tag(
                category=TagCategory.SILENCE,
                confidence=1.0,
                source=TagSource.AUTO,
                evidence={"reason": "detected_silence", "rms": sample.features.rms if sample.features else 0},
            )
            sample.tags.append(silence_tag)
            sample.status = ProcessingStatus.TAGGED
            return sample
        if sample.is_suspicious:
            suspicious_tag = Tag(
                category=TagCategory.SUSPICIOUS_NOISE,
                confidence=0.85,
                source=TagSource.AUTO,
                evidence={"reason": "detected_suspicious_noise"},
            )
            sample.tags.append(suspicious_tag)
        if sample.features is None:
            unknown_tag = Tag(
                category=TagCategory.UNKNOWN,
                confidence=0.1,
                source=TagSource.AUTO,
                evidence={"reason": "no_features_extracted"},
            )
            sample.tags.append(unknown_tag)
            sample.status = ProcessingStatus.TAGGED
            return sample
        drum_rule = self._check_drum(sample.features, sample.file_name.lower())
        bass_rule = self._check_bass(sample.features, sample.file_name.lower())
        ambient_rule = self._check_ambient(sample.features, sample.file_name.lower())
        all_rules = [r for r in [drum_rule, bass_rule, ambient_rule] if r is not None]
        if not all_rules:
            unknown_tag = Tag(
                category=TagCategory.UNKNOWN,
                confidence=0.3,
                source=TagSource.AUTO,
                evidence={"reason": "no_matching_rules"},
            )
            sample.tags.append(unknown_tag)
        else:
            all_rules.sort(key=lambda r: r.confidence, reverse=True)
            for rule in all_rules:
                tag = Tag(
                    category=rule.category,
                    confidence=rule.confidence,
                    source=TagSource.AUTO,
                    evidence={"rule_description": rule.description},
                )
                sample.tags.append(tag)
        sample.status = ProcessingStatus.TAGGED
        return sample

    def _check_drum(self, features: SpectrumFeatures, filename: str) -> Optional[TagRule]:
        score = 0.0
        reasons = []
        drum_keywords = ["kick", "snare", "hat", "hihat", "cymbal", "tom", "perc", "drum", "clap", "rim"]
        if any(k in filename for k in drum_keywords):
            score += 0.3
            reasons.append("filename_keyword")
        if features.peak_envelope >= self.drum_peak_envelope_min:
            score += 0.15
            reasons.append("high_peak_envelope")
        if features.duration <= self.drum_duration_max:
            score += 0.15
            reasons.append("short_duration")
        if features.spectral_centroid >= self.drum_centroid_min:
            score += 0.1
            reasons.append("high_centroid")
        if features.rms >= self.drum_rms_min:
            score += 0.1
            reasons.append("good_rms")
        if len(features.spectral_contrast) >= 4 and features.spectral_contrast[3] >= self.drum_contrast_min:
            score += 0.1
            reasons.append("low_band_contrast")
        confidence = min(score, 0.95)
        if confidence >= 0.35:
            return TagRule(TagCategory.DRUM, confidence, f"Drum detected: {', '.join(reasons)}")
        return None

    def _check_bass(self, features: SpectrumFeatures, filename: str) -> Optional[TagRule]:
        score = 0.0
        reasons = []
        bass_keywords = ["bass", "sub", "808", "low"]
        if any(k in filename for k in bass_keywords):
            score += 0.3
            reasons.append("filename_keyword")
        if features.spectral_centroid <= self.bass_centroid_max:
            score += 0.2
            reasons.append("low_centroid")
        if features.spectral_rolloff <= self.bass_rolloff_max:
            score += 0.15
            reasons.append("low_rolloff")
        if features.duration >= self.bass_duration_min:
            score += 0.1
            reasons.append("sustained_duration")
        if features.rms >= self.bass_rms_min:
            score += 0.1
            reasons.append("good_rms")
        confidence = min(score, 0.95)
        if confidence >= 0.35:
            return TagRule(TagCategory.BASS, confidence, f"Bass detected: {', '.join(reasons)}")
        return None

    def _check_ambient(self, features: SpectrumFeatures, filename: str) -> Optional[TagRule]:
        score = 0.0
        reasons = []
        ambient_keywords = ["ambient", "pad", "atmosphere", "reverb", "room", "space", "fx", "effect"]
        if any(k in filename for k in ambient_keywords):
            score += 0.25
            reasons.append("filename_keyword")
        if features.duration >= self.ambient_duration_min:
            score += 0.15
            reasons.append("long_duration")
        if self.ambient_flatness_min <= features.spectral_flatness <= self.ambient_flatness_max:
            score += 0.15
            reasons.append("moderate_flatness")
        if self.ambient_centroid_min <= features.spectral_centroid <= self.ambient_centroid_max:
            score += 0.1
            reasons.append("midrange_centroid")
        if len(features.spectral_contrast) >= 1 and features.spectral_contrast[0] <= self.ambient_contrast_max:
            score += 0.1
            reasons.append("low_contrast")
        confidence = min(score, 0.95)
        if confidence >= 0.35:
            return TagRule(TagCategory.AMBIENT, confidence, f"Ambient detected: {', '.join(reasons)}")
        return None

    def batch_tag(self, samples: list[SampleFile]) -> list[SampleFile]:
        tagged_samples = []
        for sample in samples:
            if sample.status == ProcessingStatus.FEATURES_EXTRACTED:
                tagged = self.tag_sample(sample)
                tagged_samples.append(tagged)
            else:
                tagged_samples.append(sample)
        return tagged_samples
