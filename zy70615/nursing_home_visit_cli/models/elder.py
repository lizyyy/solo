from typing import Optional
from .base import BaseEntity


class Elder(BaseEntity):
    name: str
    id_card: str
    room_number: str
    bed_number: str
    health_status: str
    notes: Optional[str] = None
