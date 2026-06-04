from __future__ import annotations

from typing import Optional

from .models import Annotation, CalculationResult, EvidenceSummary
from .rules import (
    ReviewStatus,
    AnnotationSource,
    DenominatorZeroPolicy,
    BOUNDARY_RULES,
    DENOMINATOR_ZERO_ACTIONS,
)


def _parse_numeric(raw: str) -> Optional[float]:
    val = raw.strip()
    if val == "":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def detect_edge_case(annotation: Annotation) -> Optional[str]:
    if annotation.denominator_is_zero_or_empty:
        denom_val = annotation.denominator_raw.strip()
        if denom_val == "":
            return "denominator_zero_empty_string"
        return "denominator_zero_numeric"
    return None


def apply_boundary_rule(annotation: Annotation, edge_type: str) -> Annotation:
    rule = BOUNDARY_RULES.get(edge_type)
    if rule is None:
        annotation.is_edge_case = True
        annotation.edge_case_type = edge_type
        annotation.status = ReviewStatus.FLAGGED
        return annotation

    policy = rule["policy"]

    if edge_type == "denominator_zero_empty_string":
        if policy == DenominatorZeroPolicy.FLAG_FOR_REVIEW:
            annotation.is_edge_case = True
            annotation.edge_case_type = edge_type
            annotation.status = ReviewStatus.FLAGGED
        elif policy == DenominatorZeroPolicy.TREAT_AS_ZERO:
            annotation.is_edge_case = True
            annotation.edge_case_type = edge_type
            annotation.current_value = "0"
            annotation.status = ReviewStatus.PENDING
        elif policy == DenominatorZeroPolicy.REJECT:
            annotation.status = ReviewStatus.ROLLED_BACK
        elif policy == DenominatorZeroPolicy.ROLLBACK:
            annotation.status = ReviewStatus.ROLLED_BACK
    elif edge_type == "denominator_zero_numeric":
        annotation.is_edge_case = True
        annotation.edge_case_type = edge_type
        annotation.status = ReviewStatus.PENDING

    return annotation


def build_evidence(annotation: Annotation, sampling_annotations: Optional[list[Annotation]] = None) -> EvidenceSummary:
    sampling_val = ""
    conflict_res = None
    if sampling_annotations:
        for sa in sampling_annotations:
            if sa.item_name == annotation.item_name and sa.original_line_number == annotation.original_line_number:
                sampling_val = sa.current_value
                if sampling_val != annotation.current_value:
                    from .rules import ConflictResolution
                    conflict_res = ConflictResolution.FLAG_FOR_HUMAN.value
                break

    return EvidenceSummary(
        annotation_id=annotation.id,
        original_line_number=annotation.original_line_number,
        original_value=annotation.original_value,
        current_value=annotation.current_value,
        source=annotation.source,
        is_edge_case=annotation.is_edge_case,
        edge_case_type=annotation.edge_case_type,
        status=annotation.status,
        annotation_content=annotation.current_value,
        sampling_list_value=sampling_val,
        conflict_resolution=conflict_res,
    )


def calculate_inclusion_exclusion(
    annotations: list[Annotation],
    sampling_annotations: Optional[list[Annotation]] = None,
) -> list[CalculationResult]:
    results: list[CalculationResult] = []

    grouped: dict[str, list[Annotation]] = {}
    for ann in annotations:
        key = f"{ann.category}||{ann.item_name}"
        grouped.setdefault(key, []).append(ann)

    for key, anns in grouped.items():
        category, item_name = key.split("||", 1)
        ann = anns[0]

        edge_type = detect_edge_case(ann)
        if edge_type:
            ann = apply_boundary_rule(ann, edge_type)

        numerator = _parse_numeric(ann.numerator_raw)
        denominator = _parse_numeric(ann.denominator_raw)

        value: Optional[float] = None
        was_edge = ann.is_edge_case

        if denominator is not None and denominator != 0 and numerator is not None:
            value = numerator / denominator
        elif denominator == 0 or (denominator is None and ann.denominator_raw.strip() == ""):
            if edge_type == "denominator_zero_empty_string":
                value = None
            elif edge_type == "denominator_zero_numeric":
                value = 0.0
        else:
            value = None

        evidence = build_evidence(ann, sampling_annotations)
        evidence.change_count = len(anns)

        results.append(CalculationResult(
            item_name=item_name,
            category=category,
            value=value,
            denominator=denominator if denominator is not None else 0.0,
            numerator=numerator if numerator is not None else 0.0,
            was_edge_case=was_edge,
            edge_case_type=ann.edge_case_type,
            status=ann.status,
            evidence=evidence,
        ))

    return results
