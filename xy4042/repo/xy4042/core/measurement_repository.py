from datetime import datetime
from typing import List, Optional

from models.measurement import Measurement
from core.base_repository import BaseRepository


class MeasurementRepository(BaseRepository[Measurement]):
    def _table_name(self) -> str:
        return "measurements"
    
    def _row_to_model(self, row) -> Measurement:
        return Measurement.from_row(row)
    
    def create(self, measurement: Measurement) -> Measurement:
        if measurement.version == 0:
            existing = self.get_by_order(measurement.order_id)
            measurement.version = len(existing) + 1
        
        now = datetime.now()
        sql = """
            INSERT INTO measurements (
                order_id, version, dimensions, technician, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """
        cursor = self.db.execute(
            sql,
            (
                measurement.order_id, measurement.version,
                measurement.dimensions, measurement.technician,
                measurement.notes, now
            )
        )
        measurement.id = cursor.lastrowid
        measurement.created_at = now
        
        self._log_measurement_change(measurement, "创建")
        
        return measurement
    
    def get_by_order(self, order_id: int) -> List[Measurement]:
        sql = """
            SELECT * FROM measurements 
            WHERE order_id = ? 
            ORDER BY version DESC
        """
        cursor = self.db.execute(sql, (order_id,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_latest(self, order_id: int) -> Optional[Measurement]:
        sql = """
            SELECT * FROM measurements 
            WHERE order_id = ? 
            ORDER BY version DESC 
            LIMIT 1
        """
        cursor = self.db.execute(sql, (order_id,))
        row = cursor.fetchone()
        return self._row_to_model(row) if row else None
    
    def get_by_version(self, order_id: int, version: int) -> Optional[Measurement]:
        sql = """
            SELECT * FROM measurements 
            WHERE order_id = ? AND version = ?
        """
        cursor = self.db.execute(sql, (order_id, version))
        row = cursor.fetchone()
        return self._row_to_model(row) if row else None
    
    def _log_measurement_change(self, measurement: Measurement, action: str) -> None:
        sql = """
            INSERT INTO audit_logs (order_id, action, details)
            VALUES (?, ?, ?)
        """
        self.db.execute(
            sql,
            (
                measurement.order_id,
                f"尺寸记录{action}",
                f"版本: {measurement.version}"
            )
        )
