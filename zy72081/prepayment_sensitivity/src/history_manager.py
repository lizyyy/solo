import os
import json
from datetime import datetime
from typing import Dict, List, Optional
from .models import (
    RunHistory,
    SensitivityResult,
    DataConflict,
    generate_id,
)


class HistoryManager:
    def __init__(self, storage_dir: str):
        self.storage_dir = storage_dir
        self.history_file = os.path.join(storage_dir, "run_history.json")
        self.pending_reviews_file = os.path.join(storage_dir, "pending_reviews.json")
        self._ensure_storage()

    def _ensure_storage(self):
        os.makedirs(self.storage_dir, exist_ok=True)
        for f in [self.history_file, self.pending_reviews_file]:
            if not os.path.exists(f):
                self._save_json(f, [])

    def _save_json(self, filepath: str, data: list):
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_json(self, filepath: str) -> list:
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def _dict_to_result(self, data: dict) -> SensitivityResult:
        from .models import CalculationStep, AnomalyFlag
        steps = [CalculationStep(**s) for s in data["calculation_steps"]]
        anomalies = [AnomalyFlag(**a) for a in data["anomalies"]]
        return SensitivityResult(
            sample_id=data["sample_id"],
            sensitivity_score=data["sensitivity_score"],
            risk_level=data["risk_level"],
            calculation_steps=steps,
            parameters_used=data["parameters_used"],
            parameter_version_id=data["parameter_version_id"],
            anomalies=anomalies,
            needs_manual_review=data["needs_manual_review"],
            review_note=data.get("review_note", ""),
            calculated_at=data["calculated_at"],
        )

    def _dict_to_conflict(self, data: dict) -> DataConflict:
        return DataConflict(**data)

    def _dict_to_run_history(self, data: dict) -> RunHistory:
        results = [self._dict_to_result(r) for r in data["results"]]
        conflicts = [self._dict_to_conflict(c) for c in data["conflicts"]]
        return RunHistory(
            run_id=data["run_id"],
            timestamp=data["timestamp"],
            parameter_version_id=data["parameter_version_id"],
            sample_count=data["sample_count"],
            anomaly_count=data["anomaly_count"],
            conflict_count=data["conflict_count"],
            manual_review_count=data["manual_review_count"],
            results=results,
            conflicts=conflicts,
            status=data.get("status", "completed"),
        )

    def save_run(self, run_history: RunHistory):
        history = self._load_json(self.history_file)
        history.append(run_history.to_dict())
        self._save_json(self.history_file, history)

        pending = self._load_json(self.pending_reviews_file)
        for result in run_history.results:
            if result.needs_manual_review:
                pending.append({
                    "sample_id": result.sample_id,
                    "run_id": run_history.run_id,
                    "status": "pending",
                    "review_note": result.review_note,
                    "created_at": result.calculated_at,
                })

        for conflict in run_history.conflicts:
            if not conflict.resolved:
                pending.append({
                    "conflict_id": conflict.conflict_id,
                    "loan_id": conflict.loan_id,
                    "run_id": run_history.run_id,
                    "status": "pending",
                    "review_note": conflict.resolution_note,
                    "created_at": run_history.timestamp,
                })
        self._save_json(self.pending_reviews_file, pending)

    def get_latest_run(self) -> Optional[RunHistory]:
        history = self._load_json(self.history_file)
        if history:
            return self._dict_to_run_history(history[-1])
        return None

    def get_run(self, run_id: str) -> Optional[RunHistory]:
        history = self._load_json(self.history_file)
        for h in history:
            if h["run_id"] == run_id:
                return self._dict_to_run_history(h)
        return None

    def list_runs(self, limit: int = 10) -> List[RunHistory]:
        history = self._load_json(self.history_file)
        return [
            self._dict_to_run_history(h) for h in history[-limit:]]

    def get_pending_reviews(self) -> List[Dict]:
        return self._load_json(self.pending_reviews_file)

    def update_review_status(
        self,
        item_id: str,
        status: str,
        review_note: str = "",
    ) -> bool:
        pending = self._load_json(self.pending_reviews_file)
        for item in pending:
            if item.get("sample_id") == item_id or item.get("conflict_id") == item_id:
                item["status"] = status
                if review_note:
                    item["review_note"] = review_note
                self._save_json(self.pending_reviews_file, pending)

                history = self._load_json(self.history_file)
                for run in history:
                    if run["run_id"] == item["run_id"]:
                        for result in run["results"]:
                            if result["sample_id"] == item_id:
                                result["review_note"] = review_note
                        for conflict in run["conflicts"]:
                            if conflict["conflict_id"] == item_id:
                                conflict["resolved"] = status == "resolved"
                                conflict["resolution_note"] = review_note
                self._save_json(self.history_file, history)
                return True
        return False

    def get_previous_results(self) -> Dict[str, SensitivityResult]:
        history = self._load_json(self.history_file)
        results = {}
        for h in history:
            for r in h["results"]:
                results[r["sample_id"]] = self._dict_to_result(r)
        return results

    def get_previous_conflicts(self) -> Dict[str, DataConflict]:
        history = self._load_json(self.history_file)
        conflicts = {}
        for h in history:
            for c in h["conflicts"]:
                conflicts[c["conflict_id"]] = self._dict_to_conflict(c)
        return conflicts

    def get_previous_parameter_versions(self) -> List[str]:
        history = self._load_json(self.history_file)
        versions = set()
        for h in history:
            versions.add(h["parameter_version_id"])
        return sorted(list(versions))

    def merge_with_previous_results(
        self,
        new_results: List[SensitivityResult],
        new_conflicts: List[DataConflict],
    ) -> tuple:
        prev_results = self.get_previous_results()
        prev_conflicts = self.get_previous_conflicts()

        merged_results = []
        for r in new_results:
            if r.sample_id in prev_results and not r.review_note:
                prev_r = prev_results[r.sample_id]
                r.review_note = prev_r.review_note
            merged_results.append(r)

        merged_conflicts = []
        for c in new_conflicts:
            if c.conflict_id in prev_conflicts:
                prev_c = prev_conflicts[c.conflict_id]
                c.resolved = prev_c.resolved
                c.resolution_note = prev_c.resolution_note
            merged_conflicts.append(c)

        return merged_results, merged_conflicts

    def generate_run_history_summary(self) -> Dict:
        history = self._load_json(self.history_file)
        total_runs = len(history)
        total_samples = sum(h["sample_count"] for h in history)
        total_anomalies = sum(h["anomaly_count"] for h in history)
        total_conflicts = sum(h["conflict_count"] for h in history)

        pending = self._load_json(self.pending_reviews_file)
        pending_count = sum(1 for p in pending if p["status"] == "pending")

        return {
            "total_runs": total_runs,
            "total_samples_processed": total_samples,
            "total_anomalies_detected": total_anomalies,
            "total_conflicts_detected": total_conflicts,
            "pending_reviews": pending_count,
            "completed_reviews": len(pending) - pending_count,
        }
