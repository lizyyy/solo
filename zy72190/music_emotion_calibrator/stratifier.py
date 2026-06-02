from __future__ import annotations

from collections import defaultdict
from typing import Optional

from .models import (
    CalibrationRecord,
    Confidence,
    JudgmentSource,
    StratificationLayer,
)


class Stratifier:
    def __init__(self, records: list[CalibrationRecord]):
        self._records = records

    def stratify(
        self, layer: StratificationLayer
    ) -> dict[str, list[CalibrationRecord]]:
        dispatch = {
            StratificationLayer.BY_EMOTION: self._by_emotion,
            StratificationLayer.BY_CONFIDENCE: self._by_confidence,
            StratificationLayer.BY_SOURCE: self._by_source,
            StratificationLayer.BY_AGREEMENT: self._by_agreement,
        }
        return dispatch[layer]()

    def stratify_multi(
        self, layers: list[StratificationLayer]
    ) -> dict[str, dict[str, list[CalibrationRecord]]]:
        result = {}
        for layer in layers:
            result[layer.value] = self.stratify(layer)
        return result

    def _by_emotion(self) -> dict[str, list[CalibrationRecord]]:
        groups: dict[str, list[CalibrationRecord]] = defaultdict(list)
        for r in self._records:
            groups[r.final_emotion].append(r)
        return dict(groups)

    def _by_confidence(self) -> dict[str, list[CalibrationRecord]]:
        groups: dict[str, list[CalibrationRecord]] = defaultdict(list)
        for r in self._records:
            if r.model_confidence >= 0.85:
                level = Confidence.HIGH.value
            elif r.model_confidence >= 0.6:
                level = Confidence.MEDIUM.value
            else:
                level = Confidence.LOW.value
            groups[level].append(r)
        return dict(groups)

    def _by_source(self) -> dict[str, list[CalibrationRecord]]:
        groups: dict[str, list[CalibrationRecord]] = defaultdict(list)
        for r in self._records:
            groups[r.final_source.value].append(r)
        return dict(groups)

    def _by_agreement(self) -> dict[str, list[CalibrationRecord]]:
        groups: dict[str, list[CalibrationRecord]] = defaultdict(list)
        for r in self._records:
            groups[r.agreement_status].append(r)
        return dict(groups)

    def summary(self) -> dict[str, dict[str, int]]:
        all_layers = list(StratificationLayer)
        multi = self.stratify_multi(all_layers)
        result = {}
        for layer_name, groups in multi.items():
            result[layer_name] = {k: len(v) for k, v in groups.items()}
        return result
