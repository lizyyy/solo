from typing import Optional
from .base import BaseEntity


class Visitor(BaseEntity):
    name: str
    id_card: str
    phone: str
    relation: str
    notes: Optional[str] = None
