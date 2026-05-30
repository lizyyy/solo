from __future__ import annotations
from dataclasses import dataclass, field
from art_transport.models import Artwork, Route, ConstraintConfig


@dataclass
class TempViolation:
    artwork_id: str
    route_id: str
    route_avg_temp_c: float
    artwork_temp_min_c: float
    artwork_temp_max_c: float
    violation_degrees_c: float
    violation_hours: float
    degree_hours: float
    penalty_cny: float

    def to_dict(self) -> dict:
        return {
            "artwork_id": self.artwork_id,
            "route_id": self.route_id,
            "route_avg_temp_c": self.route_avg_temp_c,
            "artwork_temp_min_c": self.artwork_temp_min_c,
            "artwork_temp_max_c": self.artwork_temp_max_c,
            "violation_degrees_c": self.violation_degrees_c,
            "violation_hours": self.violation_hours,
            "degree_hours": self.degree_hours,
            "penalty_cny": self.penalty_cny,
        }


@dataclass
class InsuranceExposure:
    artwork_id: str
    insurance_value_cny: float
    batch_total_insurance_cny: float
    exceeds_batch_limit: bool
    over_limit_amount_cny: float

    def to_dict(self) -> dict:
        return {
            "artwork_id": self.artwork_id,
            "insurance_value_cny": self.insurance_value_cny,
            "batch_total_insurance_cny": self.batch_total_insurance_cny,
            "exceeds_batch_limit": self.exceeds_batch_limit,
            "over_limit_amount_cny": self.over_limit_amount_cny,
        }


@dataclass
class RouteLeg:
    route_id: str
    from_city_id: str
    to_city_id: str
    distance_km: float
    transit_hours: float
    avg_temp_c: float
    artworks_on_leg: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "route_id": self.route_id,
            "from_city_id": self.from_city_id,
            "to_city_id": self.to_city_id,
            "distance_km": self.distance_km,
            "transit_hours": self.transit_hours,
            "avg_temp_c": self.avg_temp_c,
            "artworks_on_leg": self.artworks_on_leg,
        }


@dataclass
class PathResult:
    batch_id: str
    artworks: list[str]
    legs: list[RouteLeg]
    total_distance_km: float
    total_transit_hours: float
    total_insurance_cny: float
    insurance_risk_score: float
    temp_risk_score: float
    time_risk_score: float
    composite_risk_score: float
    temp_violations: list[TempViolation]
    insurance_exposures: list[InsuranceExposure]
    formula_detail: dict

    def to_dict(self) -> dict:
        return {
            "batch_id": self.batch_id,
            "artworks": self.artworks,
            "legs": [l.to_dict() for l in self.legs],
            "total_distance_km": self.total_distance_km,
            "total_transit_hours": self.total_transit_hours,
            "total_insurance_cny": self.total_insurance_cny,
            "insurance_risk_score": self.insurance_risk_score,
            "temp_risk_score": self.temp_risk_score,
            "time_risk_score": self.time_risk_score,
            "composite_risk_score": self.composite_risk_score,
            "temp_violations": [v.to_dict() for v in self.temp_violations],
            "insurance_exposures": [e.to_dict() for e in self.insurance_exposures],
            "formula_detail": self.formula_detail,
        }


def compute_temp_violation(
    artwork: Artwork,
    route: Route,
    config: ConstraintConfig,
) -> TempViolation | None:
    violation_deg = 0.0
    if route.avg_temp_c < artwork.temp_min_c:
        violation_deg = artwork.temp_min_c - route.avg_temp_c
    elif route.avg_temp_c > artwork.temp_max_c:
        violation_deg = route.avg_temp_c - artwork.temp_max_c
    if violation_deg <= 0:
        return None
    degree_hours = violation_deg * route.transit_hours
    penalty = degree_hours * config.temp_violation_penalty_per_degree_hour
    return TempViolation(
        artwork_id=artwork.artwork_id,
        route_id=route.route_id,
        route_avg_temp_c=route.avg_temp_c,
        artwork_temp_min_c=artwork.temp_min_c,
        artwork_temp_max_c=artwork.temp_max_c,
        violation_degrees_c=round(violation_deg, 2),
        violation_hours=route.transit_hours,
        degree_hours=round(degree_hours, 2),
        penalty_cny=round(penalty, 2),
    )


def compute_insurance_exposure(
    artwork: Artwork,
    batch_total_insurance_cny: float,
    config: ConstraintConfig,
) -> InsuranceExposure:
    exceeds = batch_total_insurance_cny > config.max_insurance_per_batch_cny
    over_amount = max(0.0, batch_total_insurance_cny - config.max_insurance_per_batch_cny)
    return InsuranceExposure(
        artwork_id=artwork.artwork_id,
        insurance_value_cny=artwork.insurance_value_cny,
        batch_total_insurance_cny=batch_total_insurance_cny,
        exceeds_batch_limit=exceeds,
        over_limit_amount_cny=round(over_amount, 2),
    )


def evaluate_path(
    batch_id: str,
    artworks: list[Artwork],
    legs: list[RouteLeg],
    config: ConstraintConfig,
) -> PathResult:
    total_distance = sum(l.distance_km for l in legs)
    total_hours = sum(l.transit_hours for l in legs)
    total_insurance = sum(a.insurance_value_cny for a in artworks)

    route_map = {}
    for l in legs:
        route_map[l.route_id] = Route(
            route_id=l.route_id,
            from_city_id=l.from_city_id,
            to_city_id=l.to_city_id,
            distance_km=l.distance_km,
            avg_temp_c=l.avg_temp_c,
            transit_hours=l.transit_hours,
        )

    all_violations: list[TempViolation] = []
    for artwork in artworks:
        for leg in legs:
            if artwork.artwork_id in leg.artworks_on_leg:
                route_obj = route_map[leg.route_id]
                v = compute_temp_violation(artwork, route_obj, config)
                if v:
                    all_violations.append(v)

    all_exposures: list[InsuranceExposure] = []
    for artwork in artworks:
        exp = compute_insurance_exposure(artwork, total_insurance, config)
        all_exposures.append(exp)

    total_temp_penalty = sum(v.penalty_cny for v in all_violations)
    insurance_risk_score = (total_insurance / config.max_insurance_per_batch_cny) if config.max_insurance_per_batch_cny > 0 else 0.0
    temp_risk_score = total_temp_penalty / (total_insurance + 1.0)
    time_risk_score = total_hours / max(a.max_transit_hours for a in artworks) if artworks else 0.0

    composite = (
        config.insurance_risk_weight * insurance_risk_score
        + config.temp_risk_weight * temp_risk_score
        + config.time_risk_weight * time_risk_score
    )

    formula_detail = {
        "insurance_risk_score": {
            "formula": "total_insurance / max_insurance_per_batch_cny",
            "inputs": {
                "total_insurance_cny": total_insurance,
                "max_insurance_per_batch_cny": config.max_insurance_per_batch_cny,
            },
            "result": round(insurance_risk_score, 6),
        },
        "temp_risk_score": {
            "formula": "sum(temp_violation_penalties) / (total_insurance + 1)",
            "inputs": {
                "total_temp_penalty_cny": round(total_temp_penalty, 2),
                "total_insurance_cny": total_insurance,
            },
            "result": round(temp_risk_score, 6),
        },
        "time_risk_score": {
            "formula": "total_transit_hours / max(artwork.max_transit_hours)",
            "inputs": {
                "total_transit_hours": round(total_hours, 2),
                "max_artwork_transit_hours": max(a.max_transit_hours for a in artworks) if artworks else 0,
            },
            "result": round(time_risk_score, 6),
        },
        "composite_risk_score": {
            "formula": "insurance_risk_weight * insurance_risk_score + temp_risk_weight * temp_risk_score + time_risk_weight * time_risk_score",
            "inputs": {
                "insurance_risk_weight": config.insurance_risk_weight,
                "temp_risk_weight": config.temp_risk_weight,
                "time_risk_weight": config.time_risk_weight,
                "insurance_risk_score": round(insurance_risk_score, 6),
                "temp_risk_score": round(temp_risk_score, 6),
                "time_risk_score": round(time_risk_score, 6),
            },
            "result": round(composite, 6),
        },
    }

    return PathResult(
        batch_id=batch_id,
        artworks=[a.artwork_id for a in artworks],
        legs=legs,
        total_distance_km=round(total_distance, 2),
        total_transit_hours=round(total_hours, 2),
        total_insurance_cny=round(total_insurance, 2),
        insurance_risk_score=round(insurance_risk_score, 6),
        temp_risk_score=round(temp_risk_score, 6),
        time_risk_score=round(time_risk_score, 6),
        composite_risk_score=round(composite, 6),
        temp_violations=all_violations,
        insurance_exposures=all_exposures,
        formula_detail=formula_detail,
    )
