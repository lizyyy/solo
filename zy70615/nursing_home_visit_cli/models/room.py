from .base import BaseEntity


class Room(BaseEntity):
    room_number: str
    capacity: int
    current_visitors: int = 0
    floor: str
    area: str
