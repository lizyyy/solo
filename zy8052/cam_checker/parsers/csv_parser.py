import csv
from dataclasses import dataclass
from typing import List


@dataclass
class OrderItem:
    case_id: str
    patient_name: str
    tooth_number: str
    restoration_type: str
    material: str
    doctor: str
    clinic: str


def parse_orders(csv_path: str) -> List[OrderItem]:
    orders = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            order = OrderItem(
                case_id=row.get("case_id", "").strip(),
                patient_name=row.get("patient_name", "").strip(),
                tooth_number=row.get("tooth_number", "").strip(),
                restoration_type=row.get("restoration_type", "").strip(),
                material=row.get("material", "").strip(),
                doctor=row.get("doctor", "").strip(),
                clinic=row.get("clinic", "").strip()
            )
            orders.append(order)
    return orders
