from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List
from uuid import uuid4

from models.enums import OrderStatus


@dataclass
class Order:
    order_id: str
    model_id: str
    doctor_name: str
    clinic_name: Optional[str] = None
    patient_name: str
    patient_id: Optional[str] = None
    order_date: Optional[datetime] = None
    delivery_date: Optional[date] = None
    tooth_positions: List[str] = field(default_factory=list)
    restoration_type: str = ""
    material: str = ""
    shade: str = ""
    is_urgent: bool = False
    special_instructions: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    notes: str = ""
    internal_id: str = field(default_factory=lambda: uuid4().hex)

    def to_dict(self) -> dict:
        return {
            "internal_id": self.internal_id,
            "order_id": self.order_id,
            "model_id": self.model_id,
            "doctor_name": self.doctor_name,
            "clinic_name": self.clinic_name,
            "patient_name": self.patient_name,
            "patient_id": self.patient_id,
            "order_date": self.order_date.isoformat() if self.order_date else None,
            "delivery_date": self.delivery_date.isoformat() if self.delivery_date else None,
            "tooth_positions": self.tooth_positions,
            "restoration_type": self.restoration_type,
            "material": self.material,
            "shade": self.shade,
            "is_urgent": self.is_urgent,
            "special_instructions": self.special_instructions,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Order":
        order_date = None
        if data.get("order_date"):
            order_date = datetime.fromisoformat(data["order_date"])
        
        delivery_date = None
        if data.get("delivery_date"):
            delivery_date = date.fromisoformat(data["delivery_date"])
        
        created_at = None
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        
        updated_at = None
        if data.get("updated_at"):
            updated_at = datetime.fromisoformat(data["updated_at"])
        
        order = cls(
            order_id=data["order_id"],
            model_id=data["model_id"],
            doctor_name=data["doctor_name"],
            clinic_name=data.get("clinic_name"),
            patient_name=data["patient_name"],
            patient_id=data.get("patient_id"),
            order_date=order_date,
            delivery_date=delivery_date,
            tooth_positions=data.get("tooth_positions", []),
            restoration_type=data.get("restoration_type", ""),
            material=data.get("material", ""),
            shade=data.get("shade", ""),
            is_urgent=data.get("is_urgent", False),
            special_instructions=data.get("special_instructions", ""),
            created_at=created_at,
            updated_at=updated_at,
            notes=data.get("notes", ""),
        )
        order.internal_id = data.get("internal_id", order.internal_id)
        return order
