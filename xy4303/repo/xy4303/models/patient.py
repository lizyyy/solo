from dataclasses import dataclass, field
from datetime import date
from typing import Optional
from uuid import uuid4


@dataclass
class Patient:
    patient_id: str
    name: str
    gender: Optional[str] = None
    birth_date: Optional[date] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: str = ""
    internal_id: str = field(default_factory=lambda: uuid4().hex)

    def to_dict(self) -> dict:
        return {
            "internal_id": self.internal_id,
            "patient_id": self.patient_id,
            "name": self.name,
            "gender": self.gender,
            "birth_date": self.birth_date.isoformat() if self.birth_date else None,
            "phone": self.phone,
            "address": self.address,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Patient":
        birth_date = None
        if data.get("birth_date"):
            from datetime import date
            birth_date = date.fromisoformat(data["birth_date"])
        
        patient = cls(
            patient_id=data["patient_id"],
            name=data["name"],
            gender=data.get("gender"),
            birth_date=birth_date,
            phone=data.get("phone"),
            address=data.get("address"),
            notes=data.get("notes", ""),
        )
        patient.internal_id = data.get("internal_id", patient.internal_id)
        return patient
