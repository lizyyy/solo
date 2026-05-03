from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from .base import BaseEntity
from .enums import DangerLevel


@dataclass
class Prop(BaseEntity):
    name: str = ""
    description: str = ""
    category: str = ""
    danger_level: DangerLevel = DangerLevel.SAFE
    is_dangerous: bool = False
    danger_description: str = ""
    requires_verification: bool = False
    location: str = ""
    owner: str = ""
    total_quantity: int = 1
    available_quantity: int = 1
    barcode: str = ""
    serial_number: str = ""
    notes: str = ""
    last_verified_at: Optional[datetime] = None

    def __post_init__(self):
        super().__post_init__()
        if self.is_dangerous and self.danger_level == DangerLevel.SAFE:
            self.danger_level = DangerLevel.MEDIUM
        if self.requires_verification is None:
            self.requires_verification = self.is_dangerous

    @classmethod
    def from_csv_row(cls, row: dict, id_prefix: str = "prop"):
        danger_level_str = row.get("danger_level", "SAFE").upper()
        try:
            danger_level = DangerLevel[danger_level_str]
        except KeyError:
            danger_level = DangerLevel.SAFE

        is_dangerous = row.get("is_dangerous", "").lower() in ("true", "yes", "1", "y")
        requires_verification = row.get("requires_verification", "").lower() in ("true", "yes", "1", "y")

        try:
            total_quantity = int(row.get("total_quantity", 1))
        except (ValueError, TypeError):
            total_quantity = 1

        try:
            available_quantity = int(row.get("available_quantity", total_quantity))
        except (ValueError, TypeError):
            available_quantity = total_quantity

        return cls(
            id=row.get("prop_id") or f"{id_prefix}_{row.get('name', 'unknown')}",
            name=row.get("name", ""),
            description=row.get("description", ""),
            category=row.get("category", ""),
            danger_level=danger_level,
            is_dangerous=is_dangerous,
            danger_description=row.get("danger_description", ""),
            requires_verification=requires_verification,
            location=row.get("location", ""),
            owner=row.get("owner", ""),
            total_quantity=total_quantity,
            available_quantity=available_quantity,
            barcode=row.get("barcode", ""),
            serial_number=row.get("serial_number", ""),
            notes=row.get("notes", ""),
        )
