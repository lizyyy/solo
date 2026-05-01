from datetime import datetime, date
from typing import List, Optional

from models.rework_record import ReworkRecord
from core.base_repository import BaseRepository


class ReworkRecordRepository(BaseRepository[ReworkRecord]):
    def _table_name(self) -> str:
        return "rework_records"
    
    def _row_to_model(self, row) -> ReworkRecord:
        return ReworkRecord.from_row(row)
    
    def create(self, record: ReworkRecord) -> ReworkRecord:
        now = datetime.now()
        if record.rework_date is None:
            record.rework_date = date.today()
        
        sql = """
            INSERT INTO rework_records (
                order_id, fitting_record_id, rework_reason, rework_details,
                technician, rework_date, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """
        cursor = self.db.execute(
            sql,
            (
                record.order_id, record.fitting_record_id, record.rework_reason,
                record.rework_details, record.technician, record.rework_date, now
            )
        )
        record.id = cursor.lastrowid
        record.created_at = now
        
        self._log_rework(record)
        
        return record
    
    def complete(self, record_id: int) -> Optional[ReworkRecord]:
        record = self.get_by_id(record_id)
        if not record:
            return None
        
        now = datetime.now()
        record.completed_at = now
        
        sql = "UPDATE rework_records SET completed_at = ? WHERE id = ?"
        self.db.execute(sql, (now, record_id))
        
        self._log_rework_complete(record)
        
        return record
    
    def get_by_order(self, order_id: int) -> List[ReworkRecord]:
        sql = """
            SELECT * FROM rework_records 
            WHERE order_id = ? 
            ORDER BY rework_date DESC
        """
        cursor = self.db.execute(sql, (order_id,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_by_fitting_record(self, fitting_record_id: int) -> List[ReworkRecord]:
        sql = """
            SELECT * FROM rework_records 
            WHERE fitting_record_id = ? 
            ORDER BY rework_date DESC
        """
        cursor = self.db.execute(sql, (fitting_record_id,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def get_pending(self, order_id: int) -> List[ReworkRecord]:
        sql = """
            SELECT * FROM rework_records 
            WHERE order_id = ? AND completed_at IS NULL
            ORDER BY rework_date DESC
        """
        cursor = self.db.execute(sql, (order_id,))
        rows = cursor.fetchall()
        return [self._row_to_model(row) for row in rows]
    
    def _log_rework(self, record: ReworkRecord) -> None:
        sql = """
            INSERT INTO audit_logs (order_id, action, details)
            VALUES (?, ?, ?)
        """
        details = f"返修原因: {record.rework_reason}"
        if record.technician:
            details += f", 技师: {record.technician}"
        
        self.db.execute(sql, (record.order_id, "创建返修记录", details))
    
    def _log_rework_complete(self, record: ReworkRecord) -> None:
        sql = """
            INSERT INTO audit_logs (order_id, action, details)
            VALUES (?, ?, ?)
        """
        self.db.execute(
            sql,
            (record.order_id, "返修完成", f"返修记录ID: {record.id}")
        )
