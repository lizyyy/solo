import os
import json
import hashlib
from typing import Any, Dict, List, Tuple, Set, Optional

from deepdiff import DeepDiff

from .models import ReplayResult, ComparisonResult, FieldDiff, DiffType
from .config import RegressionConfig


class Comparator:
    def __init__(self, config: RegressionConfig):
        self.config = config

    def compare(
        self,
        baseline: ReplayResult,
        target: ReplayResult,
        sample_group: str,
    ) -> ComparisonResult:
        diffs: List[FieldDiff] = []

        if baseline.status_code != target.status_code:
            diffs.append(FieldDiff(
                path="status_code",
                diff_type=DiffType.VALUE_CHANGED,
                old_value=baseline.status_code,
                new_value=target.status_code,
            ))

        if baseline.error != target.error:
            if baseline.error or target.error:
                diffs.append(FieldDiff(
                    path="error",
                    diff_type=DiffType.ERROR_MESSAGE,
                    old_value=baseline.error,
                    new_value=target.error,
                ))

        body_diffs = self._compare_bodies(baseline.body, target.body, "body")
        diffs.extend(body_diffs)

        side_effect_diffs = self._compare_bodies(
            baseline.side_effects, target.side_effects, "side_effects"
        )
        diffs.extend(side_effect_diffs)

        for diff in diffs:
            for rule in self.config.ignore_rules:
                if diff.path == rule.path or diff.path.startswith(rule.path + ".") or diff.path.startswith(rule.path + "["):
                    diff.ignored = True
                    break

        severity_score = self._calculate_severity(diffs)

        return ComparisonResult(
            sample_id=baseline.sample_id,
            sample_group=sample_group,
            diffs=diffs,
            severity_score=severity_score,
        )

    def _compare_bodies(self, old_body: Any, new_body: Any, base_path: str) -> List[FieldDiff]:
        diffs: List[FieldDiff] = []

        if old_body == new_body:
            return diffs

        try:
            deep_diff = DeepDiff(
                old_body, new_body,
                ignore_order=False,
                report_repetition=True,
                verbose_level=2,
            )

            for path, value in deep_diff.get("dictionary_item_added", {}).items():
                diffs.append(FieldDiff(
                    path=f"{base_path}{self._normalize_deepdiff_path(path)}",
                    diff_type=DiffType.NEW_FIELD,
                    old_value=None,
                    new_value=value,
                ))

            for path, value in deep_diff.get("dictionary_item_removed", {}).items():
                diffs.append(FieldDiff(
                    path=f"{base_path}{self._normalize_deepdiff_path(path)}",
                    diff_type=DiffType.MISSING_FIELD,
                    old_value=value,
                    new_value=None,
                ))

            for path, values in deep_diff.get("values_changed", {}).items():
                diffs.append(FieldDiff(
                    path=f"{base_path}{self._normalize_deepdiff_path(path)}",
                    diff_type=DiffType.VALUE_CHANGED,
                    old_value=values.get("old_value"),
                    new_value=values.get("new_value"),
                ))

            for path, change in deep_diff.get("iterable_item_added", {}).items():
                diffs.append(FieldDiff(
                    path=f"{base_path}{self._normalize_deepdiff_path(path)}",
                    diff_type=DiffType.NEW_FIELD,
                    old_value=None,
                    new_value=change,
                ))

            for path, change in deep_diff.get("iterable_item_removed", {}).items():
                diffs.append(FieldDiff(
                    path=f"{base_path}{self._normalize_deepdiff_path(path)}",
                    diff_type=DiffType.MISSING_FIELD,
                    old_value=change,
                    new_value=None,
                ))

            for change in deep_diff.get("repetition_change", {}).values():
                new_path = f"{base_path}{self._normalize_deepdiff_path(change.get('newindex', ''))}"
                diffs.append(FieldDiff(
                    path=new_path,
                    diff_type=DiffType.ORDER_CHANGED,
                    old_value=change.get("old_repeat"),
                    new_value=change.get("new_repeat"),
                ))

        except Exception:
            diffs.append(FieldDiff(
                path=base_path,
                diff_type=DiffType.VALUE_CHANGED,
                old_value=old_body,
                new_value=new_body,
            ))

        return diffs

    def _normalize_deepdiff_path(self, path: str) -> str:
        if not path:
            return ""
        result = path.replace("root", "")
        result = result.replace("['", ".").replace("']", "")
        return result if result.startswith(".") else "." + result

    def _calculate_severity(self, diffs: List[FieldDiff]) -> float:
        score = 0.0
        for diff in diffs:
            if diff.ignored:
                continue

            if diff.diff_type == DiffType.VALUE_CHANGED:
                if diff.path == "status_code":
                    score += 50.0
                elif diff.diff_type == DiffType.ERROR_MESSAGE:
                    score += 40.0
                else:
                    score += 10.0
            elif diff.diff_type == DiffType.ERROR_MESSAGE:
                score += 40.0
            elif diff.diff_type == DiffType.MISSING_FIELD:
                score += 20.0
            elif diff.diff_type == DiffType.NEW_FIELD:
                score += 5.0
            elif diff.diff_type == DiffType.ORDER_CHANGED:
                score += 15.0

        return min(score, 100.0)

    def calculate_diffs_hash(self, result: ComparisonResult) -> str:
        diffs_data = [d.to_dict() for d in result.diffs if not d.ignored]
        content = json.dumps(diffs_data, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()

    def save_comparison(self, result: ComparisonResult, output_dir: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        file_path = os.path.join(output_dir, f"{result.sample_id}.json")

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, indent=2, ensure_ascii=False)

        return file_path

    def load_comparisons(self, input_dir: str) -> Dict[str, ComparisonResult]:
        results: Dict[str, ComparisonResult] = {}

        if not os.path.exists(input_dir):
            return results

        for filename in os.listdir(input_dir):
            if not filename.endswith(".json"):
                continue

            file_path = os.path.join(input_dir, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                diffs = []
                for d in data.get("diffs", []):
                    diffs.append(FieldDiff(
                        path=d["path"],
                        diff_type=DiffType(d["diff_type"]),
                        old_value=d.get("old_value"),
                        new_value=d.get("new_value"),
                        ignored=d.get("ignored", False),
                    ))

                result = ComparisonResult(
                    sample_id=data["sample_id"],
                    sample_group=data["sample_group"],
                    diffs=diffs,
                    severity_score=data["severity_score"],
                    approved=data.get("approved", False),
                    approval_record=data.get("approval_record"),
                )
                results[result.sample_id] = result
            except Exception:
                continue

        return results

    def exceeds_threshold(self, result: ComparisonResult) -> bool:
        non_ignored = [d for d in result.diffs if not d.ignored]
        if len(non_ignored) > self.config.thresholds.max_total_diffs:
            return True
        if result.severity_score > self.config.thresholds.max_severity_score:
            return True
        return False
