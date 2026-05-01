from datetime import datetime, date
from typing import List, Optional

from models.fitting_record import FittingRecord
from core.base_repository import BaseRepository


class FittingRecordRepository(BaseRepository[FittingRecord]):
    def _table_name(self) -> str:
        return "fitting_records"
    
    def _row_to_model(self, row) -> FittingRecord:
        return FittingRecord.from_row(row)
    
    def create(self, record: FittingRecord) -> FittingRecord:
        now = datetime.now()
        if record.fitting_date is None:
            record.fitting_date = date.today()
        
        sql = """
            INSERT INTO fitting_records (
                order_id, fitting_date, technician, feedback,
                adjustments, next_follow_up, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        cursor = self.db.execute(
            sql,
            (
                record.order_id, record.fitting_date, record.technician,
                record.feedback, record.adjustments, record.next_follow_up, now
            )
        )
        record.id = cursor.lastrowid
        record.created_at = now
        
        self._log_fitting(record)
        
        return record
    
    def get_by_order(self, order_id: int) -> List[FittingRecord]:
        sql = """
            SELECT * FROM fitting_records 
            WHERE order_id = ? 
            ORDER BY fitting_date DESC
        """
        cursor = self.db.execute(sql, (order_id,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_latest(self, order_id: int) -> Optional[FittingRecord]:
        sql = """
            SELECT * FROM fitting_records 
            WHERE order_id = ? 
            ORDER BY fitting_date DESC 
            LIMIT 1
        """
        cursor = self.db.execute(sql, (order_id,))
        row = cursor.fetchone()
        return self._row_to_model(row) if row else None
    
    def _log_fitting(self, record: FittingRecord) -> None:
        sql = """
            INSERT INTO audit_logs (order_id, action, details)
            VALUES (?, ?, ?)
        """
        details = f"试穿日期: {record.fitting_date}"
        if record.technician:
            details += f", 技师: {record.technician}"
        
        self.db.execute(sql, (record.order_id, "记录试穿", details))
