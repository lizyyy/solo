from typing import Dict, Any, List, Tuple
import yaml
from .models import (
    PipelineState,
    RecordStatus,
    ConflictEvidence,
    ReviewAction,
    ReviewRole,
)


def load_params(yaml_path: str) -> Dict[str, Any]:
    with open(yaml_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def detect_conflicts_and_supplement(
    state: PipelineState, params: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    conflict_report: List[Dict[str, Any]] = []
    supplement_report: List[Dict[str, Any]] = []

    current_caliber = params["pipeline"]["current_caliber_version"]
    supplemented = params.get("supplemented_records", {}) or {}

    for sample_id, record in state.records.items():
        row_caliber = record.raw_data.get("caliber_version", "").strip()
        ev_list: List[ConflictEvidence] = []

        if row_caliber and row_caliber != current_caliber:
            ev = ConflictEvidence(
                sample_id=sample_id,
                field_name="caliber_version",
                candidate_table_value=row_caliber,
                yaml_value=current_caliber,
                description=(
                    f"召回候选表口径版本={row_caliber}，参数YAML当前口径版本={current_caliber}"
                ),
            )
            ev_list.append(ev)

        if sample_id in supplemented:
            supp = supplemented[sample_id]
            supp_caliber = supp.get("caliber_version")
            if row_caliber and supp_caliber and row_caliber != supp_caliber:
                ev = ConflictEvidence(
                    sample_id=sample_id,
                    field_name="caliber_version (supplemented)",
                    candidate_table_value=row_caliber,
                    yaml_value=supp_caliber,
                    description=(
                        f"召回候选表口径={row_caliber}，YAML补录口径={supp_caliber}，"
                        f"补录理由: {supp.get('reason', '')}"
                    ),
                )
                ev_list.append(ev)

            supp_score = supp.get("uplift_score_recalc")
            if supp_score is not None and abs(record.uplift_score - float(supp_score)) > 1e-9:
                ev = ConflictEvidence(
                    sample_id=sample_id,
                    field_name="uplift_score",
                    candidate_table_value=record.uplift_score,
                    yaml_value=float(supp_score),
                    description=(
                        f"候选表线上分={record.uplift_score}，YAML按补录口径重算分={supp_score}"
                    ),
                )
                ev_list.append(ev)

        if ev_list:
            state.conflicts[sample_id] = ev_list
            has_yaml_supp = sample_id in supplemented
            if has_yaml_supp:
                record.status = RecordStatus.YAML_SUPPLEMENT_OLD_CALIBER
                record.caliber_source = "yaml_supplement"
                supp = supplemented[sample_id]
                if "uplift_score_recalc" in supp:
                    record.uplift_score = float(supp["uplift_score_recalc"])
                if "features" in supp:
                    record.features.update(supp["features"])
                supplement_report.append(
                    {
                        "sample_id": sample_id,
                        "status": record.status.value,
                        "supplemented_from_yaml": True,
                        "supplemented_by": supp.get("supplemented_by", ""),
                        "supplemented_at": supp.get("supplemented_at", ""),
                        "reason": supp.get("reason", ""),
                        "new_uplift_score": record.uplift_score,
                    }
                )
            else:
                record.status = RecordStatus.CONFLICT_DETECTED

            conflict_report.append(
                {
                    "sample_id": sample_id,
                    "final_status": record.status.value,
                    "conflict_count": len(ev_list),
                    "conflicts": [e.to_dict() for e in ev_list],
                    "need_confirm_by": params["review_settings"]["roles"][
                        "experiment_platform_owner"
                    ],
                }
            )
        else:
            if record.status == RecordStatus.FEATURE_MISSING_DEFAULT:
                record.status = RecordStatus.PENDING_REVIEW
                action = ReviewAction(
                    sample_id=sample_id,
                    role=ReviewRole.RECOMMEND_LEAD,
                    actor=params["review_settings"]["roles"]["recommend_lead"],
                    action="AUTO_PENDING",
                    reason=(
                        "线上特征缺失（avg_purchase_30d/ctr_7d），已给默认分，"
                        "不急着归正常，留给推荐负责人复核"
                    ),
                    before_status=RecordStatus.FEATURE_MISSING_DEFAULT,
                    after_status=RecordStatus.PENDING_REVIEW,
                )
                state.review_history.append(action)

    return conflict_report, supplement_report
