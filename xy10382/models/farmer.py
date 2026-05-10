from dataclasses import dataclass, asdict
from typing import Optional
import uuid


@dataclass
class Farmer:
    id: str
    name: str
    phone: str
    address: str
    village: str

    @classmethod
    def from_dict(cls, data: dict) -> 'Farmer':
        return cls(
            id=data.get('id') or str(uuid.uuid4()),
            name=data['name'],
            phone=data['phone'],
            address=data.get('address', ''),
            village=data.get('village', '')
        )

    def to_dict(self) -> dict:
        return asdict(self)
