import json
import os
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

from models import (
    Sample,
    ModelVersion,
    ExplanationReport,
    BatchRun,
    ExplanationStatus,
)


class Storage:
    def __init__(self, base_dir: str = "data"):
        self.base_dir = base_dir
        self._ensure_dirs()

    def _ensure_dirs(self):
        dirs = [
            self.base_dir,
            os.path.join(self.base_dir, "samples"),
            os.path.join(self.base_dir, "model_versions"),
            os.path.join(self.base_dir, "reports"),
            os.path.join(self.base_dir, "batch_runs"),
            os.path.join(self.base_dir, "annotation_table"),
        ]
        for d in dirs:
            os.makedirs(d, exist_ok=True)

    def _write_json(self, path: str, data: Dict[str, Any]):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _read_json(self, path: str) -> Optional[Dict[str, Any]]:
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_sample(self, sample: Sample) -> str:
        path = os.path.join(self.base_dir, "samples", f"{sample.sample_id}.json")
        self._write_json(path, sample.to_dict())
        return path

    def load_sample(self, sample_id: str) -> Optional[Sample]:
        path = os.path.join(self.base_dir, "samples", f"{sample_id}.json")
        data = self._read_json(path)
        return Sample.from_dict(data) if data else None

    def list_samples(self) -> List[str]:
        samples_dir = os.path.join(self.base_dir, "samples")
        if not os.path.exists(samples_dir):
            return []
        return [
            f.replace(".json", "")
            for f in os.listdir(samples_dir)
            if f.endswith(".json")
        ]

    def save_model_version(self, model_version: ModelVersion) -> str:
        path = os.path.join(
            self.base_dir, "model_versions", f"{model_version.version}.json"
        )
        self._write_json(path, model_version.to_dict())
        return path

    def load_model_version(self, version: str) -> Optional[ModelVersion]:
        path = os.path.join(self.base_dir, "model_versions", f"{version}.json")
        data = self._read_json(path)
        return ModelVersion.from_dict(data) if data else None

    def list_model_versions(self) -> List[str]:
        versions_dir = os.path.join(self.base_dir, "model_versions")
        if not os.path.exists(versions_dir):
            return []
        versions = []
        for f in os.listdir(versions_dir):
            if f.endswith(".json"):
                data = self._read_json(os.path.join(versions_dir, f))
                if data:
                    versions.append((data["version"], data["deployed_at"]))
        versions.sort(key=lambda x: x[1])
        return [v[0] for v in versions]

    def get_latest_model_version(self) -> Optional[ModelVersion]:
        versions = self.list_model_versions()
        if not versions:
            return None
        return self.load_model_version(versions[-1])

    def save_report(self, report: ExplanationReport) -> str:
        version_dir = os.path.join(
            self.base_dir, "reports", report.model_version
        )
        os.makedirs(version_dir, exist_ok=True)

        timestamp = report.generated_at.replace(":", "-").replace(".", "-")
        filename = f"{report.report_id}_{report.status.value}_{timestamp}.json"
        path = os.path.join(version_dir, filename)

        self._write_json(path, report.to_dict())
        return path

    def load_report(self, report_id: str) -> Optional[ExplanationReport]:
        reports_dir = os.path.join(self.base_dir, "reports")
        if not os.path.exists(reports_dir):
            return None

        for root, _, files in os.walk(reports_dir):
            for f in files:
                if f.startswith(report_id) and f.endswith(".json"):
                    data = self._read_json(os.path.join(root, f))
                    if data:
                        return ExplanationReport.from_dict(data)
        return None

    def list_reports_for_sample(
        self, sample_id: str, model_version: Optional[str] = None
    ) -> List[ExplanationReport]:
        reports_dir = os.path.join(self.base_dir, "reports")
        if not os.path.exists(reports_dir):
            return []

        results = []
        search_dirs = (
            [os.path.join(reports_dir, model_version)] if model_version else [reports_dir]
        )

        for search_dir in search_dirs:
            if not os.path.exists(search_dir):
                continue
            for root, _, files in os.walk(search_dir):
                for f in files:
                    if f.endswith(".json"):
                        data = self._read_json(os.path.join(root, f))
                        if data and data.get("sample_id") == sample_id:
                            results.append(ExplanationReport.from_dict(data))

        results.sort(key=lambda r: r.generated_at)
        return results

    def list_reports_for_model_version(self, model_version: str) -> List[ExplanationReport]:
        version_dir = os.path.join(self.base_dir, "reports", model_version)
        if not os.path.exists(version_dir):
            return []

        results = []
        for f in os.listdir(version_dir):
            if f.endswith(".json"):
                data = self._read_json(os.path.join(version_dir, f))
                if data:
                    results.append(ExplanationReport.from_dict(data))

        results.sort(key=lambda r: r.generated_at)
        return results

    def list_all_reports(self) -> List[ExplanationReport]:
        reports_dir = os.path.join(self.base_dir, "reports")
        if not os.path.exists(reports_dir):
            return []

        results = []
        for root, _, files in os.walk(reports_dir):
            for f in files:
                if f.endswith(".json"):
                    data = self._read_json(os.path.join(root, f))
                    if data:
                        results.append(ExplanationReport.from_dict(data))

        results.sort(key=lambda r: r.generated_at)
        return results

    def save_batch_run(self, batch_run: BatchRun) -> str:
        path = os.path.join(
            self.base_dir, "batch_runs", f"{batch_run.run_id}.json"
        )
        self._write_json(path, batch_run.to_dict())
        return path

    def load_batch_run(self, run_id: str) -> Optional[BatchRun]:
        path = os.path.join(self.base_dir, "batch_runs", f"{run_id}.json")
        data = self._read_json(path)
        return BatchRun.from_dict(data) if data else None

    def list_batch_runs(self) -> List[str]:
        runs_dir = os.path.join(self.base_dir, "batch_runs")
        if not os.path.exists(runs_dir):
            return []
        runs = []
        for f in os.listdir(runs_dir):
            if f.endswith(".json"):
                data = self._read_json(os.path.join(runs_dir, f))
                if data:
                    runs.append((data["run_id"], data["run_timestamp"]))
        runs.sort(key=lambda x: x[1])
        return [r[0] for r in runs]

    def save_legacy_annotation(
        self, annotation_id: str, data: Dict[str, Any]
    ) -> str:
        path = os.path.join(
            self.base_dir, "annotation_table", f"{annotation_id}.json"
        )
        self._write_json(path, data)
        return path

    def load_legacy_annotation(self, annotation_id: str) -> Optional[Dict[str, Any]]:
        path = os.path.join(
            self.base_dir, "annotation_table", f"{annotation_id}.json"
        )
        return self._read_json(path)

    def list_legacy_annotations(self) -> List[str]:
        ann_dir = os.path.join(self.base_dir, "annotation_table")
        if not os.path.exists(ann_dir):
            return []
        return [
            f.replace(".json", "")
            for f in os.listdir(ann_dir)
            if f.endswith(".json")
        ]

    def update_report(self, report: ExplanationReport) -> str:
        existing = self.load_report(report.report_id)
        if not existing:
            return self.save_report(report)

        version_dir = os.path.join(
            self.base_dir, "reports", report.model_version
        )
        os.makedirs(version_dir, exist_ok=True)

        timestamp = datetime.now().isoformat().replace(":", "-").replace(".", "-")
        filename = f"{report.report_id}_{report.status.value}_updated_{timestamp}.json"
        path = os.path.join(version_dir, filename)

        self._write_json(path, report.to_dict())
        return path

    def compare_batch_runs(
        self, run_id_old: str, run_id_new: str
    ) -> Dict[str, Any]:
        old_run = self.load_batch_run(run_id_old)
        new_run = self.load_batch_run(run_id_new)

        if not old_run or not new_run:
            return {"error": "One or both batch runs not found"}

        old_reports = [self.load_report(rid) for rid in old_run.report_ids]
        new_reports = [self.load_report(rid) for rid in new_run.report_ids]
        old_reports = [r for r in old_reports if r]
        new_reports = [r for r in new_reports if r]

        old_by_sample = {r.sample_id: r for r in old_reports}
        new_by_sample = {r.sample_id: r for r in new_reports}

        all_samples = set(old_by_sample.keys()) | set(new_by_sample.keys())

        sample_changes = []
        metric_diffs = {}

        for metric in set(old_run.metrics.keys()) | set(new_run.metrics.keys()):
            old_val = old_run.metrics.get(metric, 0)
            new_val = new_run.metrics.get(metric, 0)
            metric_diffs[metric] = {
                "old": old_val,
                "new": new_val,
                "diff": new_val - old_val,
            }

        for sample_id in sorted(all_samples):
            old_r = old_by_sample.get(sample_id)
            new_r = new_by_sample.get(sample_id)

            change_type = "unchanged"
            details = {}

            if old_r and not new_r:
                change_type = "removed"
            elif not old_r and new_r:
                change_type = "added"
            else:
                if old_r.status != new_r.status:
                    change_type = "status_changed"
                    details["old_status"] = old_r.status.value
                    details["new_status"] = new_r.status.value
                if old_r.recommended_path != new_r.recommended_path:
                    change_type = "path_changed" if change_type == "unchanged" else "both_changed"
                    details["old_path"] = old_r.recommended_path
                    details["new_path"] = new_r.recommended_path
                if old_r.confidence_score != new_r.confidence_score:
                    details["old_confidence"] = old_r.confidence_score
                    details["new_confidence"] = new_r.confidence_score

            sample_changes.append(
                {
                    "sample_id": sample_id,
                    "change_type": change_type,
                    "details": details,
                }
            )

        return {
            "old_run": run_id_old,
            "new_run": run_id_new,
            "old_model_version": old_run.model_version,
            "new_model_version": new_run.model_version,
            "metric_diffs": metric_diffs,
            "sample_changes": sample_changes,
            "summary": {
                "total_samples": len(all_samples),
                "added": len([c for c in sample_changes if c["change_type"] == "added"]),
                "removed": len([c for c in sample_changes if c["change_type"] == "removed"]),
                "changed": len(
                    [
                        c
                        for c in sample_changes
                        if c["change_type"] in ["status_changed", "path_changed", "both_changed"]
                    ]
                ),
                "unchanged": len(
                    [c for c in sample_changes if c["change_type"] == "unchanged"]
                ),
            },
        }
