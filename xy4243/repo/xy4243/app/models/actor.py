from dataclasses import dataclass, field
from typing import Optional

from .base import BaseEntity


@dataclass
class Actor(BaseEntity):
    name: str = ""
    role: str = ""
    contact_info: str = ""
    notes: str = ""

    def __post_init__(self):
        super().__post_init__()

    @classmethod
    def from_csv_row(cls, row: dict, id_prefix: str = "actor"):
        return cls(
            id=row.get("actor_id") or f"{id_prefix}_{row.get('name', 'unknown')}",
            name=row.get("name", ""),
            role=row.get("role", ""),
            contact_info=row.get("contact_info", ""),
            notes=row.get("notes", ""),
        )
