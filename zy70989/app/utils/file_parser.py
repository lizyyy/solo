import io
import csv
import json
from typing import List, Dict, Any
from app.models import MeterReading, Order, DamageClaim


def parse_meter_csv(csv_content: bytes) -> List[MeterReading]:
    content = csv_content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(content))
    readings = []
    
    for row in reader:
        raw_data = dict(row)
        reading = MeterReading(
            property_id=row.get("property_id", "").strip(),
            order_id=row.get("order_id", "").strip(),
            checkin_date=row.get("checkin_date", "").strip(),
            checkout_date=row.get("checkout_date", "").strip(),
            electricity_start=float(row.get("electricity_start", 0) or 0),
            electricity_end=float(row.get("electricity_end", 0) or 0),
            water_start=float(row.get("water_start", 0) or 0),
            water_end=float(row.get("water_end", 0) or 0),
            raw_data=raw_data
        )
        readings.append(reading)
    
    return readings


def parse_orders_json(json_content: bytes) -> List[Order]:
    data = json.loads(json_content.decode("utf-8"))
    orders = []
    
    for item in data:
        order = Order(
            order_id=str(item.get("order_id", "")).strip(),
            property_id=item.get("property_id", "").strip(),
            guest_name=item.get("guest_name", "").strip(),
            checkin_date=item.get("checkin_date", "").strip(),
            checkout_date=item.get("checkout_date", "").strip(),
            daily_rate=float(item.get("daily_rate", 0) or 0),
            total_amount=float(item.get("total_amount", 0) or 0),
            deposit_amount=float(item.get("deposit_amount", 0) or 0),
            actual_deposit_refund=float(item.get("actual_deposit_refund")) if item.get("actual_deposit_refund") is not None else None,
            deductions=item.get("deductions", []),
        )
        orders.append(order)
    
    return orders


def parse_damage_claims(json_content: bytes, photo_filenames: Dict[str, str] = None) -> List[DamageClaim]:
    data = json.loads(json_content.decode("utf-8"))
    claims = []
    photo_filenames = photo_filenames or {}
    
    for item in data:
        order_id = str(item.get("order_id", "")).strip()
        claim = DamageClaim(
            order_id=order_id,
            property_id=item.get("property_id", "").strip(),
            damage_type=item.get("damage_type", "").strip(),
            description=item.get("description", "").strip(),
            claimed_amount=float(item.get("claimed_amount", 0) or 0),
            has_photo=order_id in photo_filenames or bool(item.get("has_photo", False)),
            photo_filename=photo_filenames.get(order_id, item.get("photo_filename")),
            raw_data=dict(item)
        )
        claims.append(claim)
    
    return claims


def generate_batch_id(meter_count: int, order_count: int, damage_count: int) -> str:
    import hashlib
    content = f"{meter_count}-{order_count}-{damage_count}"
    return hashlib.md5(content.encode()).hexdigest()[:12]
