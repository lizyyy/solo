from datetime import datetime
from typing import List, Optional

from models.patient import Patient
from core.base_repository import BaseRepository


class PatientRepository(BaseRepository[Patient]):
    def _table_name(self) -> str:
        return "patients"
    
    def _row_to_model(self, row) -> Patient:
        return Patient.from_row(row)
    
    def create(self, patient: Patient) -> Patient:
        now = datetime.now()
        sql = """
            INSERT INTO patients (name, phone, id_card, diagnosis, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        cursor = self.db.execute(
            sql,
            (
                patient.name, patient.phone, patient.id_card,
                patient.diagnosis, patient.notes, now, now
            )
        )
        patient.id = cursor.lastrowid
        patient.created_at = now
        patient.updated_at = now
        return patient
    
    def update(self, patient: Patient) -> Patient:
        now = datetime.now()
        sql = """
            UPDATE patients 
            SET name = ?, phone = ?, id_card = ?, diagnosis = ?, notes = ?, updated_at = ?
            WHERE id = ?
        """
        self.db.execute(
            sql,
            (
                patient.name, patient.phone, patient.id_card,
                patient.diagnosis, patient.notes, now, patient.id
            )
        )
        patient.updated_at = now
        return patient
    
    def search(self, keyword: str) -> List[Patient]:
        sql = """
            SELECT * FROM patients 
            WHERE name LIKE ? OR phone LIKE ? OR diagnosis LIKE ?
            ORDER BY name
        """
        pattern = f"%{keyword}%"
        cursor = self.db.execute(sql, (pattern, pattern, pattern))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_by_phone(self, phone: str) -> Optional[Patient]:
        sql = "SELECT * FROM patients WHERE phone = ?"
        cursor = self.db.execute(sql, (phone,))
        row = cursor.fetchone()
        return self._row_to_model(row) if row else None
