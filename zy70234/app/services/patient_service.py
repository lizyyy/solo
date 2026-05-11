from sqlalchemy.orm import Session
from typing import List

from app.models import Patient
from app.errors import ResourceNotFoundError, DuplicateResourceError
from app.schemas import PatientCreate


class PatientService:
    def __init__(self, db: Session):
        self.db = db

    def create_patient(self, data: PatientCreate) -> Patient:
        existing = self.db.query(Patient).filter(Patient.id_card == data.id_card).first()
        if existing:
            raise DuplicateResourceError("患者", data.id_card)

        patient = Patient(
            name=data.name,
            id_card=data.id_card,
            phone=data.phone,
        )

        self.db.add(patient)
        self.db.commit()
        self.db.refresh(patient)
        return patient

    def get_patient(self, patient_id: int) -> Patient:
        patient = self.db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            raise ResourceNotFoundError("患者", patient_id)
        return patient

    def get_patient_by_id_card(self, id_card: str) -> Patient:
        patient = self.db.query(Patient).filter(Patient.id_card == id_card).first()
        if not patient:
            raise ResourceNotFoundError("患者", -1)
        return patient

    def list_patients(self) -> List[Patient]:
        return self.db.query(Patient).all()
