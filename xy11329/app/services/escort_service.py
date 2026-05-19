from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models import Escort


class EscortService:
    def __init__(self, db: Session):
        self.db = db

    def create_escort(
        self,
        name: str,
        phone: str,
        employee_id: str,
    ) -> Tuple[Optional[Escort], str]:
        existing = self.db.query(Escort).filter(Escort.employee_id == employee_id).first()
        if existing:
            return existing, "duplicate"

        escort = Escort(
            name=name,
            phone=phone,
            employee_id=employee_id,
        )
        self.db.add(escort)
        self.db.commit()
        self.db.refresh(escort)
        return escort, "created"

    def get_escort(self, escort_id: int) -> Optional[Escort]:
        return self.db.query(Escort).filter(Escort.id == escort_id).first()

    def get_escort_by_employee_id(self, employee_id: str) -> Optional[Escort]:
        return self.db.query(Escort).filter(Escort.employee_id == employee_id).first()

    def list_escorts(self, active_only: bool = True) -> List[Escort]:
        query = self.db.query(Escort)
        if active_only:
            query = query.filter(Escort.is_active == True)
        return query.order_by(Escort.name).all()

    def update_escort(
        self,
        escort_id: int,
        name: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> Tuple[Optional[Escort], str]:
        escort = self.db.query(Escort).filter(Escort.id == escort_id).first()
        if not escort:
            return None, "not_found"

        if name:
            escort.name = name
        if phone:
            escort.phone = phone

        self.db.commit()
        self.db.refresh(escort)
        return escort, "updated"

    def deactivate_escort(self, escort_id: int) -> Tuple[Optional[Escort], str]:
        escort = self.db.query(Escort).filter(Escort.id == escort_id).first()
        if not escort:
            return None, "not_found"

        escort.is_active = False
        self.db.commit()
        self.db.refresh(escort)
        return escort, "deactivated"

    def activate_escort(self, escort_id: int) -> Tuple[Optional[Escort], str]:
        escort = self.db.query(Escort).filter(Escort.id == escort_id).first()
        if not escort:
            return None, "not_found"

        escort.is_active = True
        self.db.commit()
        self.db.refresh(escort)
        return escort, "activated"
