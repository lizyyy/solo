from __future__ import annotations
from dataclasses import dataclass, field
from art_transport.models import Artwork, Route, ConstraintConfig
from art_transport.optimizer import RouteLeg, PathResult, evaluate_path


@dataclass
class BatchGroup:
    batch_id: str
    artworks: list[Artwork]
    destination_city_ids: list[str]
    group_reason: str

    def to_dict(self) -> dict:
        return {
            "batch_id": self.batch_id,
            "artworks": [a.to_dict() for a in self.artworks],
            "destination_city_ids": self.destination_city_ids,
            "group_reason": self.group_reason,
        }


def group_artworks_into_batches(
    artworks: list[Artwork],
    routes: list[Route],
    config: ConstraintConfig,
) -> list[BatchGroup]:
    sorted_artworks = sorted(artworks, key=lambda a: a.insurance_value_cny, reverse=True)
    batches: list[BatchGroup] = []
    remaining = list(sorted_artworks)
    batch_counter = 0

    while remaining:
        batch_counter += 1
        batch_artworks: list[Artwork] = []
        batch_insurance = 0.0
        temp_range: tuple[float, float] | None = None

        still_remaining: list[Artwork] = []
        for a in remaining:
            can_add = True
            reason_blocked = ""

            projected_insurance = batch_insurance + a.insurance_value_cny
            if projected_insurance > config.max_insurance_per_batch_cny:
                can_add = False
                reason_blocked = f"insurance_would_exceed: {projected_insurance:.0f} > {config.max_insurance_per_batch_cny:.0f}"

            if can_add and temp_range is not None:
                overlap = _batch_temp_range_overlap(temp_range, a)
                if overlap is None:
                    can_add = False
                    reason_blocked = f"temp_range_no_overlap: batch=({temp_range[0]}°C,{temp_range[1]}°C) artwork=({a.temp_min_c}°C,{a.temp_max_c}°C)"

            if can_add:
                batch_artworks.append(a)
                batch_insurance += a.insurance_value_cny
                if temp_range is None:
                    temp_range = (a.temp_min_c, a.temp_max_c)
                else:
                    new_lo = max(temp_range[0], a.temp_min_c)
                    new_hi = min(temp_range[1], a.temp_max_c)
                    temp_range = (new_lo, new_hi)
            else:
                still_remaining.append(a)
        if not batch_artworks and still_remaining:
            forced = still_remaining.pop(0)
            batch_artworks.append(forced)
            batch_insurance = forced.insurance_value_cny
            temp_range = (forced.temp_min_c, forced.temp_max_c)
        remaining = still_remaining

        dest_cities = list(set(a.destination_city_id for a in batch_artworks))
        high_value_count = sum(1 for a in batch_artworks if a.insurance_value_cny >= config.high_value_threshold_cny)
        low_value_count = len(batch_artworks) - high_value_count
        forced_placement = len(batch_artworks) == 1 and batch_artworks[0].insurance_value_cny > config.max_insurance_per_batch_cny
        reasons = []
        if forced_placement:
            reasons.append("FORCED_SINGLE: insurance exceeds batch limit")
        if temp_range:
            reasons.append(f"temp_range=({temp_range[0]}°C,{temp_range[1]}°C)")
        reasons.append(f"total_insurance={batch_insurance:.0f}CNY")
        if high_value_count > 0 and low_value_count > 0:
            reasons.append(f"mixed_high_low_value({high_value_count}h+{low_value_count}l)")
        else:
            reasons.append(f"high_value_only({high_value_count})" if high_value_count > 0 else f"low_value_only({low_value_count})")

        batches.append(
            BatchGroup(
                batch_id=f"B-{batch_counter:03d}",
                artworks=batch_artworks,
                destination_city_ids=dest_cities,
                group_reason="; ".join(reasons),
            )
        )

    return batches


def _batch_temp_range_overlap(
    current_range: tuple[float, float],
    artwork: Artwork,
) -> tuple[float, float] | None:
    lo = max(current_range[0], artwork.temp_min_c)
    hi = min(current_range[1], artwork.temp_max_c)
    if lo <= hi:
        return (lo, hi)
    return None


def build_route_legs_for_batch(
    batch: BatchGroup,
    routes: list[Route],
) -> list[RouteLeg]:
    legs: list[RouteLeg] = []
    for dest_city_id in batch.destination_city_ids:
        matching = [r for r in routes if r.to_city_id == dest_city_id]
        if not matching:
            continue
        best = min(matching, key=lambda r: r.transit_hours)
        artwork_ids = [a.artwork_id for a in batch.artworks if a.destination_city_id == dest_city_id]
        legs.append(
            RouteLeg(
                route_id=best.route_id,
                from_city_id=best.from_city_id,
                to_city_id=best.to_city_id,
                distance_km=best.distance_km,
                transit_hours=best.transit_hours,
                avg_temp_c=best.avg_temp_c,
                artworks_on_leg=artwork_ids,
            )
        )
    return legs


def plan_all_batches(
    artworks: list[Artwork],
    routes: list[Route],
    config: ConstraintConfig,
) -> tuple[list[BatchGroup], list[PathResult]]:
    batches = group_artworks_into_batches(artworks, routes, config)
    results: list[PathResult] = []
    for batch in batches:
        legs = build_route_legs_for_batch(batch, routes)
        result = evaluate_path(batch.batch_id, batch.artworks, legs, config)
        results.append(result)
    return batches, results
