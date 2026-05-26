import csv
import json
from typing import List, Dict, Any, Tuple
from datetime import datetime
from io import StringIO
from .models import Waybill, TrackEvent, PenaltyRule, TransitNode


def parse_waybill_csv(content: str) -> List[Waybill]:
    waybills = []
    reader = csv.DictReader(StringIO(content))

    for row in reader:
        transit_nodes = []
        nodes_data = row.get("transit_nodes", "")
        if nodes_data:
            try:
                nodes_list = json.loads(nodes_data)
                for n in nodes_list:
                    transit_nodes.append(
                        TransitNode(
                            node_code=n.get("node_code", ""),
                            node_name=n.get("node_name", ""),
                            arrival_time=datetime.fromisoformat(n["arrival_time"]) if n.get("arrival_time") else None,
                            departure_time=datetime.fromisoformat(n["departure_time"]) if n.get("departure_time") else None,
                            status=n.get("status", "正常"),
                        )
                    )
            except (json.JSONDecodeError, KeyError, ValueError):
                pass

        waybill = Waybill(
            waybill_no=row.get("waybill_no", ""),
            sender=row.get("sender", ""),
            receiver=row.get("receiver", ""),
            origin=row.get("origin", ""),
            destination=row.get("destination", ""),
            estimated_delivery=datetime.fromisoformat(row["estimated_delivery"]) if row.get("estimated_delivery") else datetime.now(),
            actual_delivery=datetime.fromisoformat(row["actual_delivery"]) if row.get("actual_delivery") else None,
            transit_nodes=transit_nodes,
            weight=float(row.get("weight", 0)),
            cargo_type=row.get("cargo_type", ""),
            damage_count=int(row.get("damage_count", 0)),
            damage_description=row.get("damage_description"),
            is_weather_issue=row.get("is_weather_issue"),
        )
        waybills.append(waybill)

    return waybills


def parse_tracks_json(content: str) -> List[TrackEvent]:
    data = json.loads(content)
    tracks = []
    for item in data:
        tracks.append(
            TrackEvent(
                waybill_no=item.get("waybill_no", ""),
                event_time=datetime.fromisoformat(item["event_time"]) if item.get("event_time") else datetime.now(),
                event_type=item.get("event_type", ""),
                location=item.get("location", ""),
                operator=item.get("operator"),
                remark=item.get("remark"),
            )
        )
    return tracks


def parse_rules_json(content: str) -> List[PenaltyRule]:
    data = json.loads(content)
    rules = []
    for item in data:
        rules.append(
            PenaltyRule(
                rule_id=item.get("rule_id", ""),
                rule_name=item.get("rule_name", ""),
                rule_type=item.get("rule_type", ""),
                penalty_amount=float(item.get("penalty_amount", 0)),
                conditions=item.get("conditions", {}),
                description=item.get("description", ""),
            )
        )
    return rules


def read_file_content(filepath: str) -> str:
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()
