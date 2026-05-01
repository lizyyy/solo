import csv
import json
import yaml
from datetime import datetime
from typing import List, Dict, Any
from models import Order, CabinetEvent, BillingRule


def parse_orders_csv(content: str) -> List[Order]:
    orders = []
    reader = csv.DictReader(content.splitlines())
    for row in reader:
        order = Order(
            id=row["order_id"],
            user_id=row["user_id"],
            cabinet_id=row["cabinet_id"],
            slot_id=row["slot_id"],
            start_time=datetime.fromisoformat(row["start_time"]),
            end_time=datetime.fromisoformat(row["end_time"]) if row.get("end_time") else None,
            duration_minutes=int(row["duration_minutes"]) if row.get("duration_minutes") else None,
            amount=float(row["amount"]),
            status=row["status"]
        )
        orders.append(order)
    return orders


def parse_events_jsonl(content: str) -> List[CabinetEvent]:
    events = []
    for line in content.splitlines():
        line = line.strip()
        if not line:
            continue
        data = json.loads(line)
        event = CabinetEvent(
            id=data["event_id"],
            cabinet_id=data["cabinet_id"],
            slot_id=data["slot_id"],
            event_type=data["event_type"],
            event_time=datetime.fromisoformat(data["event_time"]),
            order_id=data.get("order_id"),
            raw_data=json.dumps(data, ensure_ascii=False)
        )
        events.append(event)
    return events


def parse_rules_yaml(content: str) -> List[BillingRule]:
    rules = []
    data = yaml.safe_load(content)
    for rule_data in data.get("rules", []):
        rule = BillingRule(
            name=rule_data["name"],
            hourly_rate=float(rule_data["hourly_rate"]),
            daily_cap=float(rule_data["daily_cap"]) if rule_data.get("daily_cap") else None,
            free_minutes=int(rule_data.get("free_minutes", 0)),
            config=yaml.dump(rule_data)
        )
        rules.append(rule)
    return rules
