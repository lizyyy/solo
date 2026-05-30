from __future__ import annotations
from dataclasses import dataclass, field
from art_transport.models import Artwork, Route, ConstraintConfig
from art_transport.optimizer import PathResult, TempViolation, InsuranceExposure


@dataclass
class WarningRecord:
    warning_type: str
    severity: str
    message: str
    affected_batch_ids: list[str]
    affected_artwork_ids: list[str]
    affected_route_ids: list[str]
    detail: dict

    def to_dict(self) -> dict:
        return {
            "warning_type": self.warning_type,
            "severity": self.severity,
            "message": self.message,
            "affected_batch_ids": self.affected_batch_ids,
            "affected_artwork_ids": self.affected_artwork_ids,
            "affected_route_ids": self.affected_route_ids,
            "detail": self.detail,
        }


def check_high_value_mixed_packing(
    path_results: list[PathResult],
    artworks_map: dict[str, Artwork],
    config: ConstraintConfig,
) -> list[WarningRecord]:
    warnings: list[WarningRecord] = []
    for pr in path_results:
        high_value_ids = []
        low_value_ids = []
        for aid in pr.artworks:
            a = artworks_map.get(aid)
            if a is None:
                continue
            if a.insurance_value_cny >= config.high_value_threshold_cny:
                high_value_ids.append(aid)
            else:
                low_value_ids.append(aid)
        if high_value_ids and low_value_ids:
            high_total = sum(artworks_map[aid].insurance_value_cny for aid in high_value_ids)
            low_total = sum(artworks_map[aid].insurance_value_cny for aid in low_value_ids)
            ratio = high_total / (low_total + 1)
            warnings.append(
                WarningRecord(
                    warning_type="high_value_mixed_packing",
                    severity="high" if ratio > 5 else "medium",
                    message=f"批次 {pr.batch_id} 混装高价值({len(high_value_ids)}件)与低价值({len(low_value_ids)}件)作品，"
                    f"高/低保额比={ratio:.1f}，混装增加理赔复杂度",
                    affected_batch_ids=[pr.batch_id],
                    affected_artwork_ids=high_value_ids + low_value_ids,
                    affected_route_ids=[l.route_id for l in pr.legs],
                    detail={
                        "high_value_artworks": high_value_ids,
                        "low_value_artworks": low_value_ids,
                        "high_value_total_cny": high_total,
                        "low_value_total_cny": low_total,
                        "ratio_high_to_low": round(ratio, 2),
                        "threshold_cny": config.high_value_threshold_cny,
                    },
                )
            )
    return warnings


def check_temp_timeout(
    path_results: list[PathResult],
    artworks_map: dict[str, Artwork],
    routes_map: dict[str, Route],
) -> list[WarningRecord]:
    warnings: list[WarningRecord] = []
    for pr in path_results:
        artwork_total_hours: dict[str, float] = {}
        for leg in pr.legs:
            for aid in leg.artworks_on_leg:
                artwork_total_hours[aid] = artwork_total_hours.get(aid, 0.0) + leg.transit_hours
        for aid, total_h in artwork_total_hours.items():
            a = artworks_map.get(aid)
            if a is None:
                continue
            if total_h > a.max_transit_hours:
                overtime = total_h - a.max_transit_hours
                warnings.append(
                    WarningRecord(
                        warning_type="temp_control_timeout",
                        severity="high",
                        message=f"作品 {aid} 累计运输 {total_h:.1f}h 超过允许 {a.max_transit_hours:.1f}h，"
                        f"超时 {overtime:.1f}h，温控失效风险增加",
                        affected_batch_ids=[pr.batch_id],
                        affected_artwork_ids=[aid],
                        affected_route_ids=[l.route_id for l in pr.legs if aid in l.artworks_on_leg],
                        detail={
                            "artwork_id": aid,
                            "total_transit_hours": round(total_h, 2),
                            "max_allowed_hours": a.max_transit_hours,
                            "overtime_hours": round(overtime, 2),
                            "temp_range_c": [a.temp_min_c, a.temp_max_c],
                        },
                    )
                )
        for v in pr.temp_violations:
            if v.violation_degrees_c > 0:
                existing = [w for w in warnings if w.warning_type == "temp_control_timeout" and v.artwork_id in w.affected_artwork_ids and v.route_id in w.affected_route_ids]
                if not existing:
                    warnings.append(
                        WarningRecord(
                            warning_type="temp_control_timeout",
                            severity="medium" if v.violation_degrees_c <= 3 else "high",
                            message=f"作品 {v.artwork_id} 在路线 {v.route_id} 上温度偏离 {v.violation_degrees_c:.1f}°C，"
                            f"度·时={v.degree_hours:.1f}，罚金={v.penalty_cny:.0f}元",
                            affected_batch_ids=[pr.batch_id],
                            affected_artwork_ids=[v.artwork_id],
                            affected_route_ids=[v.route_id],
                            detail=v.to_dict(),
                        )
                    )
    return warnings


def check_route_duplication(
    path_results: list[PathResult],
    routes_map: dict[str, Route],
) -> list[WarningRecord]:
    warnings: list[WarningRecord] = []
    pair_to_batches: dict[str, list[tuple[str, str]]] = {}
    for pr in path_results:
        for leg in pr.legs:
            r = routes_map.get(leg.route_id)
            if r is None:
                continue
            key = r.city_pair_key()
            if key not in pair_to_batches:
                pair_to_batches[key] = []
            pair_to_batches[key].append((pr.batch_id, leg.route_id))
    for pair_key, entries in pair_to_batches.items():
        if len(entries) > 1:
            batch_ids = list(set(e[0] for e in entries))
            route_ids = list(set(e[1] for e in entries))
            warnings.append(
                WarningRecord(
                    warning_type="route_duplication",
                    severity="medium",
                    message=f"城市对 {pair_key} 被多个批次重复使用({len(entries)}次)，"
                    f"涉及批次 {', '.join(batch_ids)}，增加调度冲突风险",
                    affected_batch_ids=batch_ids,
                    affected_artwork_ids=[],
                    affected_route_ids=route_ids,
                    detail={
                        "city_pair": pair_key,
                        "occurrence_count": len(entries),
                        "batches": batch_ids,
                    },
                )
            )
    return warnings


def apply_warnings_to_results(
    path_results: list[PathResult],
    warnings: list[WarningRecord],
    config: ConstraintConfig,
) -> list[PathResult]:
    batch_penalty_map: dict[str, float] = {}
    for w in warnings:
        if w.warning_type == "route_duplication":
            for bid in w.affected_batch_ids:
                batch_penalty_map[bid] = batch_penalty_map.get(bid, 0.0) + config.route_duplication_penalty

    adjusted = []
    for pr in path_results:
        penalty = batch_penalty_map.get(pr.batch_id, 0.0)
        adjusted_composite = pr.composite_risk_score + penalty / (pr.total_insurance_cny + 1.0)
        has_high_value_warning = any(
            w.warning_type == "high_value_mixed_packing" and pr.batch_id in w.affected_batch_ids
            for w in warnings
        )
        has_temp_warning = any(
            w.warning_type == "temp_control_timeout" and pr.batch_id in w.affected_batch_ids
            for w in warnings
        )
        requires_special_handling = has_high_value_warning or has_temp_warning or adjusted_composite > 1.0

        new_formula = dict(pr.formula_detail)
        new_formula["route_duplication_penalty_applied"] = {
            "formula": "composite_risk_score + route_duplication_penalty / (total_insurance + 1)",
            "inputs": {
                "composite_risk_score": pr.composite_risk_score,
                "route_duplication_penalty_cny": penalty,
                "total_insurance_cny": pr.total_insurance_cny,
            },
            "penalty_cny": round(penalty, 2),
            "adjusted_composite": round(adjusted_composite, 6),
        }
        new_formula["requires_special_handling"] = requires_special_handling
        new_formula["special_handling_reasons"] = []
        if has_high_value_warning:
            new_formula["special_handling_reasons"].append("high_value_mixed_packing")
        if has_temp_warning:
            new_formula["special_handling_reasons"].append("temp_control_timeout")
        if adjusted_composite > 1.0:
            new_formula["special_handling_reasons"].append("composite_risk_exceeds_threshold")

        adjusted.append(
            PathResult(
                batch_id=pr.batch_id,
                artworks=pr.artworks,
                legs=pr.legs,
                total_distance_km=pr.total_distance_km,
                total_transit_hours=pr.total_transit_hours,
                total_insurance_cny=pr.total_insurance_cny,
                insurance_risk_score=pr.insurance_risk_score,
                temp_risk_score=pr.temp_risk_score,
                time_risk_score=pr.time_risk_score,
                composite_risk_score=round(adjusted_composite, 6),
                temp_violations=pr.temp_violations,
                insurance_exposures=pr.insurance_exposures,
                formula_detail=new_formula,
            )
        )
    return adjusted
