import os
from typing import Dict, List, Optional, Set
import logging
from .models import (
    OverlayLayer,
    ConfigMapResult,
    CoverageItem,
    AnalysisReport
)

logger = logging.getLogger(__name__)


class OverlayResolver:
    def __init__(self, layer_data: Dict[str, OverlayLayer], layer_order: List[str]):
        self.layer_data = layer_data
        self.layer_order = layer_order
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.total_overrides = 0
        self.total_conflicts = 0

    def resolve_configmaps(self) -> List[ConfigMapResult]:
        all_configmaps = self._collect_all_configmaps()
        results = []

        for cm_key in all_configmaps:
            result = self._resolve_single_configmap(cm_key)
            if result:
                results.append(result)

        return results

    def _collect_all_configmaps(self) -> Set[str]:
        all_cm_keys = set()
        for layer in self.layer_data.values():
            all_cm_keys.update(layer.configmaps.keys())
        return all_cm_keys

    def _resolve_single_configmap(self, cm_key: str) -> Optional[ConfigMapResult]:
        namespace, name = cm_key.split('/', 1) if '/' in cm_key else ('default', cm_key)

        final_data: Dict[str, str] = {}
        coverage_chain: Dict[str, List[CoverageItem]] = {}
        conflicts: List[str] = []

        for layer_name in self.layer_order:
            layer = self.layer_data.get(layer_name)
            if not layer:
                continue

            cm_data = layer.configmaps.get(cm_key, {})

            for key, kv in cm_data.items():
                if key not in coverage_chain:
                    coverage_chain[key] = []

                is_override = key in final_data
                prev_value = final_data.get(key)

                if is_override:
                    self.total_overrides += 1

                coverage_chain[key].append(CoverageItem(
                    key=key,
                    value=kv.value,
                    source_layer=layer_name,
                    source_file=kv.source_file,
                    is_override=is_override,
                    previous_value=prev_value,
                    previous_layer=self._get_previous_layer(key, coverage_chain)
                ))

                final_data[key] = kv.value

        self._detect_conflicts(cm_key, coverage_chain, conflicts)

        return ConfigMapResult(
            name=name,
            namespace=namespace,
            final_data=final_data,
            coverage_chain=coverage_chain,
            conflicts=conflicts
        )

    def _get_previous_layer(self, key: str, coverage_chain: Dict[str, List[CoverageItem]]) -> Optional[str]:
        chain = coverage_chain.get(key, [])
        if len(chain) >= 1:
            return chain[-1].source_layer
        return None

    def _detect_conflicts(self, cm_key: str, coverage_chain: Dict[str, List[CoverageItem]], conflicts: List[str]):
        for key, chain in coverage_chain.items():
            if len(chain) > 1:
                layers_involved = [item.source_layer for item in chain]
                if len(set(layers_involved)) != len(layers_involved):
                    conflict_msg = f"Key '{key}' defined multiple times in same layer: {layers_involved}"
                    conflicts.append(conflict_msg)
                    self.warnings.append(conflict_msg)
                    self.total_conflicts += 1

    def generate_report(self, base_dir: str) -> AnalysisReport:
        configmaps = self.resolve_configmaps()

        return AnalysisReport(
            base_dir=base_dir,
            layers=self.layer_order,
            configmaps=configmaps,
            errors=self.errors,
            warnings=self.warnings,
            total_overrides_count=self.total_overrides,
            total_conflicts_count=self.total_conflicts
        )
