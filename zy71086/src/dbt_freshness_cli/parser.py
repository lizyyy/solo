import json
from pathlib import Path
from typing import Dict, Optional, Tuple, List, Any
from datetime import datetime

from .models import (
    ManifestNode,
    ManifestSource,
    RunResult,
    SourceFreshnessResult,
    ModelStatus,
    FreshnessStatus,
    DBTResourceType,
)


class DBTArtifactsParser:
    def __init__(self):
        self.nodes: Dict[str, ManifestNode] = {}
        self.sources: Dict[str, ManifestSource] = {}
        self.run_results: Dict[str, RunResult] = {}
        self.freshness_results: Dict[str, SourceFreshnessResult] = {}
        self.metadata: Dict[str, Any] = {}

    def parse_manifest(self, manifest_path: Path) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        if not manifest_path.exists():
            errors.append(f"Manifest file not found: {manifest_path}")
            return False, errors

        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in manifest: {e}")
            return False, errors
        except Exception as e:
            errors.append(f"Error reading manifest: {e}")
            return False, errors

        self.metadata = data.get("metadata", {})

        nodes_data = data.get("nodes", {})
        for unique_id, node_data in nodes_data.items():
            try:
                node = ManifestNode(**node_data)
                self.nodes[unique_id] = node
            except Exception as e:
                errors.append(f"Error parsing node {unique_id}: {e}")

        sources_data = data.get("sources", {})
        for unique_id, source_data in sources_data.items():
            try:
                source = ManifestSource(**source_data)
                self.sources[unique_id] = source
            except Exception as e:
                errors.append(f"Error parsing source {unique_id}: {e}")

        return len(errors) == 0, errors

    def parse_run_results(self, run_results_path: Path) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        if not run_results_path.exists():
            errors.append(f"Run results file not found: {run_results_path}")
            return False, errors

        try:
            with open(run_results_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in run_results: {e}")
            return False, errors
        except Exception as e:
            errors.append(f"Error reading run_results: {e}")
            return False, errors

        results = data.get("results", [])
        for result_data in results:
            try:
                unique_id = result_data.get("unique_id")
                if not unique_id:
                    continue
                result = RunResult(**result_data)
                self.run_results[unique_id] = result
            except Exception as e:
                errors.append(f"Error parsing run result: {e}")

        return len(errors) == 0, errors

    def parse_source_freshness(self, freshness_path: Path) -> Tuple[bool, List[str]]:
        errors: List[str] = []
        if not freshness_path.exists():
            errors.append(f"Source freshness file not found: {freshness_path}")
            return False, errors

        try:
            with open(freshness_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON in source freshness: {e}")
            return False, errors
        except Exception as e:
            errors.append(f"Error reading source freshness: {e}")
            return False, errors

        results = data.get("results", [])
        for result_data in results:
            try:
                unique_id = result_data.get("unique_id")
                if not unique_id:
                    continue
                result = SourceFreshnessResult(**result_data)
                self.freshness_results[unique_id] = result
            except Exception as e:
                errors.append(f"Error parsing freshness result: {e}")

        return len(errors) == 0, errors

    def get_resource(self, unique_id: str) -> Optional[Any]:
        if unique_id in self.nodes:
            return self.nodes[unique_id]
        if unique_id in self.sources:
            return self.sources[unique_id]
        return None

    def get_run_result(self, unique_id: str) -> Optional[RunResult]:
        return self.run_results.get(unique_id)

    def get_freshness_result(self, unique_id: str) -> Optional[SourceFreshnessResult]:
        return self.freshness_results.get(unique_id)

    def get_model_status(self, unique_id: str) -> ModelStatus:
        result = self.run_results.get(unique_id)
        if result:
            return result.status
        return ModelStatus.SKIPPED

    def get_freshness_status(self, unique_id: str) -> FreshnessStatus:
        result = self.freshness_results.get(unique_id)
        if result:
            return result.status
        return FreshnessStatus.UNKNOWN

    def get_last_success_at(self, unique_id: str) -> Optional[datetime]:
        result = self.run_results.get(unique_id)
        if result:
            return result.completed_at
        return None

    def get_last_data_at(self, unique_id: str) -> Optional[datetime]:
        freshness = self.freshness_results.get(unique_id)
        if freshness:
            return freshness.max_loaded_at_datetime
        run_result = self.run_results.get(unique_id)
        if run_result:
            return run_result.completed_at
        return None

    def all_resources(self) -> List[Tuple[str, Any]]:
        resources = []
        for uid, node in self.nodes.items():
            resources.append((uid, node))
        for uid, source in self.sources.items():
            resources.append((uid, source))
        return resources
