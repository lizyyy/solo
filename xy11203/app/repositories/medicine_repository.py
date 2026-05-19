from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import Medicine
from app.models.enums import MedicineType


class MedicineRepository:
    def __init__(self):
        pass

    def get_by_code(self, db: Session, code: str) -> Optional[Medicine]:
        return db.query(Medicine).filter(Medicine.code == code).first()

    def get_by_id(self, db: Session, medicine_id: int) -> Optional[Medicine]:
        return db.query(Medicine).filter(Medicine.id == medicine_id).first()

    def get_by_type(self, db: Session, medicine_type: MedicineType) -> List[Medicine]:
        return db.query(Medicine).filter(Medicine.type == medicine_type).all()

    def get_vaccines(self, db: Session) -> List[Medicine]:
        return self.get_by_type(db, MedicineType.VACCINE)

    def get_insulins(self, db: Session) -> List[Medicine]:
        return self.get_by_type(db, MedicineType.INSULIN)

    def create(
        self,
        db: Session,
        code: str,
        name: str,
        medicine_type: MedicineType,
        manufacturer: Optional[str] = None,
        specification: Optional[str] = None,
        unit: str = "支",
        temperature_min: Optional[float] = None,
        temperature_max: Optional[float] = None,
        description: Optional[str] = None
    ) -> Medicine:
        medicine = Medicine(
            code=code,
            name=name,
            type=medicine_type,
            manufacturer=manufacturer,
            specification=specification,
            unit=unit,
            temperature_min=temperature_min,
            temperature_max=temperature_max,
            description=description
        )
        db.add(medicine)
        db.commit()
        db.refresh(medicine)
        return medicine

    def list_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[Medicine]:
        return db.query(Medicine).filter(Medicine.is_active == True).order_by(Medicine.created_at.desc()).offset(skip).limit(limit).all()
