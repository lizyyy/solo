from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass
from deepdiff import DeepDiff
from .normalizer import NormalizedResource
from .renderer import RenderResult
import logging

logger = logging.getLogger(__name__)


@dataclass
class ResourceDiff:
    resource_key: str
    kind: str
    name: str
    namespace: Optional[str]
    status: str
    diff: Optional[Dict]
    left_source: Optional[NormalizedResource]
    right_source: Optional[NormalizedResource]


@dataclass
class EnvironmentDiff:
    left_env: str
    right_env: str
    left_result: RenderResult
    right_result: RenderResult
    resource_diffs: List[ResourceDiff]
    summary: Dict[str, Any]


class HelmDiffer:
    def __init__(self, exclude_paths: Optional[List[str]] = None):
        self.exclude_paths = exclude_paths or []

    def compare_environments(
        self,
        left_result: RenderResult,
        right_result: RenderResult,
        left_resources: List[NormalizedResource],
        right_resources: List[NormalizedResource]
    ) -> EnvironmentDiff:
        left_map = {r.resource_key: r for r in left_resources}
        right_map = {r.resource_key: r for r in right_resources}
        
        all_keys = set(left_map.keys()) | set(right_map.keys())
        resource_diffs = []
        
        for key in all_keys:
            left_res = left_map.get(key)
            right_res = right_map.get(key)
            
            if left_res and right_res:
                diff_result = self._compare_resource(left_res, right_res)
                resource_diffs.append(diff_result)
            elif left_res:
                resource_diffs.append(ResourceDiff(
                    resource_key=key,
                    kind=left_res.kind,
                    name=left_res.name,
                    namespace=left_res.namespace,
                    status="removed",
                    diff=None,
                    left_source=left_res,
                    right_source=None
                ))
            else:
                resource_diffs.append(ResourceDiff(
                    resource_key=key,
                    kind=right_res.kind,
                    name=right_res.name,
                    namespace=right_res.namespace,
                    status="added",
                    diff=None,
                    left_source=None,
                    right_source=right_res
                ))
        
        summary = self._make_summary(resource_diffs, left_result, right_result)
        
        return EnvironmentDiff(
            left_env=left_result.environment,
            right_env=right_result.environment,
            left_result=left_result,
            right_result=right_result,
            resource_diffs=resource_diffs,
            summary=summary
        )

    def _compare_resource(
        self,
        left_res: NormalizedResource,
        right_res: NormalizedResource
    ) -> ResourceDiff:
        diff = DeepDiff(
            left_res.normalized,
            right_res.normalized,
            exclude_paths=self.exclude_paths,
            ignore_order=False,
            report_repetition=False,
            verbose_level=2
        )
        
        status = "changed" if diff else "unchanged"
        
        return ResourceDiff(
            resource_key=left_res.resource_key,
            kind=left_res.kind,
            name=left_res.name,
            namespace=left_res.namespace,
            status=status,
            diff=diff.to_dict() if diff else None,
            left_source=left_res,
            right_source=right_res
        )

    def _make_summary(
        self,
        resource_diffs: List[ResourceDiff],
        left_result: RenderResult,
        right_result: RenderResult
    ) -> Dict[str, Any]:
        status_counts = {}
        kind_counts = {}
        
        for rd in resource_diffs:
            status_counts[rd.status] = status_counts.get(rd.status, 0) + 1
            if rd.kind not in kind_counts:
                kind_counts[rd.kind] = {}
            kind_counts[rd.kind][rd.status] = kind_counts[rd.kind].get(rd.status, 0) + 1
        
        return {
            "total_resources": {
                left_result.environment: len(left_result.manifests),
                right_result.environment: len(right_result.manifests)
            },
            "status_counts": status_counts,
            "kind_counts": kind_counts,
            "has_changes": any(rd.status != "unchanged" for rd in resource_diffs),
            "changed_count": sum(1 for rd in resource_diffs if rd.status == "changed"),
            "added_count": sum(1 for rd in resource_diffs if rd.status == "added"),
            "removed_count": sum(1 for rd in resource_diffs if rd.status == "removed"),
            "unchanged_count": sum(1 for rd in resource_diffs if rd.status == "unchanged")
        }

    def get_changed_resources(self, env_diff: EnvironmentDiff) -> List[ResourceDiff]:
        return [rd for rd in env_diff.resource_diffs if rd.status != "unchanged"]

    def get_resources_by_status(self, env_diff: EnvironmentDiff, status: str) -> List[ResourceDiff]:
        return [rd for rd in env_diff.resource_diffs if rd.status == status]

    def group_diffs_by_kind(self, env_diff: EnvironmentDiff) -> Dict[str, List[ResourceDiff]]:
        groups = {}
        for rd in env_diff.resource_diffs:
            if rd.kind not in groups:
                groups[rd.kind] = []
            groups[rd.kind].append(rd)
        return groups
