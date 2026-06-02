from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
import math


@dataclass
class StratumResult:
    name: str
    count: int
    avg_model_score: Optional[float] = None
    avg_manual_score: Optional[float] = None
    avg_score_diff: Optional[float] = None
    max_score_diff: Optional[float] = None
    bias_rate: Optional[float] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "count": self.count,
            "avg_model_score": self.avg_model_score,
            "avg_manual_score": self.avg_manual_score,
            "avg_score_diff": self.avg_score_diff,
            "max_score_diff": self.max_score_diff,
            "bias_rate": self.bias_rate,
            "details": self.details,
        }


@dataclass
class StratificationResult:
    dimension: str
    strata: List[StratumResult] = field(default_factory=list)
    overall_bias_rate: Optional[float] = None

    def summary(self) -> str:
        lines = [f"[样本分层结果 - 维度: {self.dimension}]"]
        lines.append(f"  整体偏差率: {self.overall_bias_rate}")
        for s in self.strata:
            lines.append(f"  --- {s.name} (n={s.count}) ---")
            lines.append(f"    平均模型分: {s.avg_model_score}")
            lines.append(f"    平均人工分: {s.avg_manual_score}")
            lines.append(f"    平均差异: {s.avg_score_diff}")
            lines.append(f"    最大差异: {s.max_score_diff}")
            lines.append(f"    偏差率: {s.bias_rate}")
        return "\n".join(lines)


DEFAULT_STRATA = {
    "gender": {"field": "sample_gender", "values": ["male", "female", "other"]},
    "age_group": {
        "field": "sample_age",
        "ranges": [(0, 25, "young"), (26, 40, "mid"), (41, 100, "senior")],
    },
    "education": {"field": "sample_education", "values": None},
    "experience": {
        "field": "sample_experience_years",
        "ranges": [(0, 2, "junior"), (3, 5, "mid"), (6, 100, "senior")],
    },
}


class Stratifier:
    def __init__(self, score_diff_threshold: float = 0.3):
        self.score_diff_threshold = score_diff_threshold

    def stratify(
        self,
        alignment_result,
        audit_result,
        dimension: str,
        custom_field: Optional[str] = None,
    ) -> StratificationResult:
        result = StratificationResult(dimension=dimension)

        strata_groups: Dict[str, List] = {}

        for rid, aligned in alignment_result.records.items():
            stratum_name = self._assign_stratum(aligned, dimension, custom_field)
            if stratum_name is None:
                continue
            if stratum_name not in strata_groups:
                strata_groups[stratum_name] = []
            judgment = next((j for j in audit_result.judgments if j.record_id == rid), None)
            strata_groups[stratum_name].append((aligned, judgment))

        total_flagged = 0
        total_count = 0

        for name, items in sorted(strata_groups.items()):
            model_scores = []
            manual_scores = []
            diffs = []
            flagged = 0

            for aligned, judgment in items:
                ms = None
                mns = None
                if aligned.model_output:
                    try:
                        ms = float(aligned.model_output.get("score", 0))
                    except (ValueError, TypeError):
                        pass
                if aligned.manual_correction:
                    try:
                        mns = float(aligned.manual_correction.get("score", 0))
                    except (ValueError, TypeError):
                        pass
                if ms is not None:
                    model_scores.append(ms)
                if mns is not None:
                    manual_scores.append(mns)
                if ms is not None and mns is not None:
                    d = abs(ms - mns)
                    diffs.append(d)
                    if d >= self.score_diff_threshold:
                        flagged += 1

            sr = StratumResult(
                name=name,
                count=len(items),
                avg_model_score=round(sum(model_scores) / len(model_scores), 4) if model_scores else None,
                avg_manual_score=round(sum(manual_scores) / len(manual_scores), 4) if manual_scores else None,
                avg_score_diff=round(sum(diffs) / len(diffs), 4) if diffs else None,
                max_score_diff=round(max(diffs), 4) if diffs else None,
                bias_rate=round(flagged / len(items), 4) if items else None,
            )
            result.strata.append(sr)
            total_flagged += flagged
            total_count += len(items)

        result.overall_bias_rate = round(total_flagged / total_count, 4) if total_count else None
        return result

    def _assign_stratum(
        self, aligned, dimension: str, custom_field: Optional[str] = None
    ) -> Optional[str]:
        config = DEFAULT_STRATA.get(dimension)
        if config is None and custom_field is None:
            return None

        field_name = custom_field or (config["field"] if config else None)
        if field_name is None:
            return None

        record = None
        actual_field = field_name
        for src in [aligned.sample, aligned.model_output, aligned.manual_correction, aligned.online_feedback]:
            if src and field_name in src:
                record = src
                break
            if field_name.startswith("sample_") and src and field_name[7:] in src:
                record = src
                actual_field = field_name[7:]
                break

        if record is None:
            return "unknown"

        raw_val = record.get(actual_field)
        if raw_val is None:
            return "null"

        if config and "values" in config and config["values"] is not None:
            if raw_val in config["values"]:
                return str(raw_val)
            return "other"

        if config and "ranges" in config:
            try:
                num_val = float(raw_val)
            except (ValueError, TypeError):
                return "non_numeric"
            for lo, hi, label in config["ranges"]:
                if lo <= num_val <= hi:
                    return label
            return "out_of_range"

        return str(raw_val)

    def stratify_multi(
        self,
        alignment_result,
        audit_result,
        dimensions: List[str],
    ) -> Dict[str, StratificationResult]:
        results = {}
        for dim in dimensions:
            results[dim] = self.stratify(alignment_result, audit_result, dim)
        return results
