from art_transport.models import (
    Artwork,
    City,
    Route,
    ConstraintConfig,
    DataSource,
)
import json
from datetime import datetime
from typing import Optional


def _default_source(source_name: str, version: str) -> DataSource:
    return DataSource(
        source_name=source_name,
        version=version,
        fetched_at=datetime.now().isoformat(),
    )


def load_artworks(path: str, source_name: str = "unknown", version: str = "0") -> list[Artwork]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    source = _default_source(source_name, version)
    artworks = []
    for item in raw:
        ds = None
        if "data_source" in item:
            ds = DataSource(**item["data_source"])
        else:
            ds = source
        artworks.append(
            Artwork(
                artwork_id=item["artwork_id"],
                name=item["name"],
                insurance_value_cny=float(item["insurance_value_cny"]),
                temp_min_c=float(item["temp_min_c"]),
                temp_max_c=float(item["temp_max_c"]),
                max_transit_hours=float(item["max_transit_hours"]),
                fragility=float(item["fragility"]),
                destination_city_id=item["destination_city_id"],
                data_source=ds,
            )
        )
    return artworks


def load_cities(path: str, source_name: str = "unknown", version: str = "0") -> list[City]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    source = _default_source(source_name, version)
    cities = []
    for item in raw:
        ds = None
        if "data_source" in item:
            ds = DataSource(**item["data_source"])
        else:
            ds = source
        cities.append(
            City(
                city_id=item["city_id"],
                name=item["name"],
                data_source=ds,
            )
        )
    return cities


def load_routes(path: str, source_name: str = "unknown", version: str = "0") -> list[Route]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    source = _default_source(source_name, version)
    routes = []
    for item in raw:
        ds = None
        if "data_source" in item:
            ds = DataSource(**item["data_source"])
        else:
            ds = source
        routes.append(
            Route(
                route_id=item["route_id"],
                from_city_id=item["from_city_id"],
                to_city_id=item["to_city_id"],
                distance_km=float(item["distance_km"]),
                avg_temp_c=float(item["avg_temp_c"]),
                transit_hours=float(item["transit_hours"]),
                data_source=ds,
            )
        )
    return routes


def load_constraints(
    path: Optional[str] = None,
    source_name: str = "unknown",
    version: str = "0",
) -> ConstraintConfig:
    if path is None:
        return ConstraintConfig(data_source=_default_source(source_name, version))
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    ds = None
    if "data_source" in raw:
        ds = DataSource(**raw["data_source"])
    else:
        ds = _default_source(source_name, version)
    return ConstraintConfig(
        max_insurance_per_batch_cny=float(raw.get("max_insurance_per_batch_cny", 5_000_000)),
        high_value_threshold_cny=float(raw.get("high_value_threshold_cny", 2_000_000)),
        temp_violation_penalty_per_degree_hour=float(raw.get("temp_violation_penalty_per_degree_hour", 500)),
        route_duplication_penalty=float(raw.get("route_duplication_penalty", 1000)),
        insurance_risk_weight=float(raw.get("insurance_risk_weight", 0.4)),
        temp_risk_weight=float(raw.get("temp_risk_weight", 0.35)),
        time_risk_weight=float(raw.get("time_risk_weight", 0.25)),
        data_source=ds,
    )
