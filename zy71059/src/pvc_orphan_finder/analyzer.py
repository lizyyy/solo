from typing import List, Dict, Set, Optional
from collections import defaultdict

from .models import (
    K8sResource,
    PVCStatus,
    AnalysisResult,
    ResourceType,
)
from .reference_tracker import ReferenceTracker
from .retention_engine import RetentionEngine
from .yaml_parser import YamlParser


class OrphanAnalyzer:
    def __init__(self, retention_config: Optional[Dict] = None):
        self.retention_engine = RetentionEngine(retention_config)
        self.parser = YamlParser()
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def analyze_files(self, file_paths: List[str]) -> AnalysisResult:
        resources = []

        for path in file_paths:
            resources.extend(self.parser.parse_file(path))

        self.errors.extend(self.parser.errors)
        self.warnings.extend(self.parser.warnings)

        return self.analyze_resources(resources)

    def analyze_directory(self, dir_path: str, recursive: bool = True) -> AnalysisResult:
        resources = self.parser.parse_directory(dir_path, recursive=recursive)

        self.errors.extend(self.parser.errors)
        self.warnings.extend(self.parser.warnings)

        return self.analyze_resources(resources)

    def analyze_resources(self, resources: List[K8sResource]) -> AnalysisResult:
        result = AnalysisResult()
        result.all_resources = resources
        result.errors = self.errors.copy()
        result.warnings = self.warnings.copy()

        self._check_duplicate_names(resources, result)

        pvcs = [r for r in resources if r.resource_type == ResourceType.PVC]

        tracker = ReferenceTracker(resources)
        references = tracker.build_reference_graph()
        result.references = references

        for pvc in pvcs:
            pvc_status = self._analyze_pvc(pvc, tracker, resources)
            result.pvcs.append(pvc_status)

        return result

    def _check_duplicate_names(self, resources: List[K8sResource], result: AnalysisResult) -> None:
        pvc_names: Dict[str, List[K8sResource]] = defaultdict(list)

        for r in resources:
            if r.resource_type == ResourceType.PVC:
                key = f"{r.namespace}/{r.name}"
                pvc_names[key].append(r)

        for key, dup_pvcs in pvc_names.items():
            if len(dup_pvcs) > 1:
                locations = []
                for p in dup_pvcs:
                    if p.source:
                        locations.append(str(p.source))
                    else:
                        locations.append(f"{p.namespace}/{p.name}")
                result.warnings.append(
                    f"Duplicate PVC name '{key}' found in: {', '.join(locations)}"
                )

    def _analyze_pvc(self, pvc: K8sResource, tracker: ReferenceTracker,
                     all_resources: List[K8sResource]) -> PVCStatus:
        references = tracker.find_all_pvc_references(pvc)
        retention_rules = self.retention_engine.check_retention(pvc)

        issues = []
        is_orphan = len(references) == 0

        if is_orphan:
            reason = "No references found from any workload resource"
            cleanup_recommendation = self._get_cleanup_recommendation(pvc, retention_rules, is_orphan)
        else:
            reason = f"Referenced by {len(references)} resource(s)"
            cleanup_recommendation = "keep"

        if self._has_cross_ns_conflict(pvc, all_resources):
            issues.append("Cross-namespace PVC with same name exists - verify correct namespace")

        if self.retention_engine.get_expired_rules(retention_rules):
            issues.append("Has expired retention rules")

        return PVCStatus(
            pvc=pvc,
            is_orphan=is_orphan,
            references=[r['referencer'] for r in references],
            retention_rules=retention_rules,
            cleanup_recommendation=cleanup_recommendation,
            reason=reason,
            issues=issues
        )

    def _has_cross_ns_conflict(self, pvc: K8sResource, all_resources: List[K8sResource]) -> bool:
        for r in all_resources:
            if (r.resource_type == ResourceType.PVC and
                    r.name == pvc.name and
                    r.namespace != pvc.namespace):
                return True
        return False

    def _get_cleanup_recommendation(self, pvc: K8sResource, rules: List, is_orphan: bool) -> str:
        if not is_orphan:
            return "keep"

        active_rules = self.retention_engine.get_active_rules(rules)
        expired_rules = self.retention_engine.get_expired_rules(rules)

        if expired_rules:
            return "delete-expired"

        if active_rules:
            return "keep-protected"

        return "review-delete"

    def get_orphan_pvcs(self, result: AnalysisResult) -> List[PVCStatus]:
        return [p for p in result.pvcs if p.is_orphan]

    def get_referenced_pvcs(self, result: AnalysisResult) -> List[PVCStatus]:
        return [p for p in result.pvcs if not p.is_orphan]
