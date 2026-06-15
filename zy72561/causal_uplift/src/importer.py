import csv
from typing import Tuple, Dict, Any, List, Optional
from .models import CandidateRecord, RecordStatus, PipelineState


def _parse_float(v: str) -> Optional[float]:
    if v is None or v.strip() == "":
        return None
    try:
        return float(v.strip())
    except ValueError:
        return None


def _parse_bool_missing(raw: Dict[str, str]) -> bool:
    return (
        _parse_float(raw.get("feature_avg_purchase_30d", "")) is None
        or _parse_float(raw.get("feature_ctr_7d", "")) is None
    )


def import_candidate_table(
    csv_path: str, default_score: float = 0.500
) -> Tuple[PipelineState, List[Dict[str, Any]]]:
    state = PipelineState()
    import_log: List[Dict[str, Any]] = []

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sample_id = row["sample_id"].strip()
            feature_missing = _parse_bool_missing(row)
            online_score = _parse_float(row.get("online_uplift_score", "")) or default_score
            default_applied = feature_missing and abs(online_score - default_score) < 1e-9

            features: Dict[str, Any] = {}
            avg_purchase = _parse_float(row.get("feature_avg_purchase_30d", ""))
            ctr = _parse_float(row.get("feature_ctr_7d", ""))
            if avg_purchase is not None:
                features["avg_purchase_30d"] = avg_purchase
            if ctr is not None:
                features["ctr_7d"] = ctr
            category_pref = row.get("feature_category_pref", "").strip()
            if category_pref:
                features["category_pref"] = category_pref

            if feature_missing and default_applied:
                status = RecordStatus.FEATURE_MISSING_DEFAULT
            else:
                status = RecordStatus.NORMAL

            record = CandidateRecord(
                sample_id=sample_id,
                user_id=row["user_id"].strip(),
                scene=row["scene"].strip(),
                uplift_score=online_score,
                features=features,
                feature_missing=feature_missing,
                default_score_applied=default_applied,
                status=status,
                caliber_source="online",
                raw_data=dict(row),
            )
            state.records[sample_id] = record

            import_log.append(
                {
                    "sample_id": sample_id,
                    "import_status": "IMPORTED",
                    "initial_status": status.value,
                    "feature_missing": feature_missing,
                    "default_score_applied": default_applied,
                    "uplift_score": online_score,
                    "remark": row.get("remark", "").strip(),
                }
            )

    return state, import_log
